const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { Pool } = require('pg');

const ENV_PATH = path.join(__dirname, '../../.env');

/**
 * All application tables in parent -> child order for safe schema creation and upsert sync.
 */
const SYNC_TABLES_ORDERED = [
    'users',
    'user_permissions',
    'global_settings',
    'site_content',
    'timeline_items',
    'team_members',
    'site_partners',
    'origin_paragraphs',
    'gallery_images',
    'members',
    'member_relatives',
    'subscriptions',
    'subscription_payments',
    'beneficiary_categories',
    'beneficiaries',
    'beneficiary_children_study',
    'beneficiary_children_dropout',
    'beneficiary_children_university',
    'beneficiary_children_abroad',
    'beneficiary_children_other',
    'beneficiary_helps',
    'beneficiary_help_logs',
    'families',
    'family_donations',
    'projects',
    'transactions',
    'external_donations',
    'donations',
    'ramadan_distributions',
    'ramadan_tokens',
    'madrasa_muallimahs',
    'madrasa_classes',
    'madrasa_students',
    'madrasa_attendance',
    'form_templates',
    'courses',
    'batches',
    'program_applications',
    'volunteers',
    'volunteer_activities',
    'inventory_items',
    'inventory_loans',
    'inventory_maintenance',
    'inventory_usage',
    'documents',
    'sms_gateways',
    'sms_templates',
    'sms_logs',
    'system_logs',
    'login_events'
];

const SYNC_TABLE_SET = new Set(SYNC_TABLES_ORDERED);

let _sqliteDb = null;
let _pgPool = null;
let _currentDbUrl = '';
let _schemaProvisioned = false;
let _onlineState = {
    configured: false,
    online: false,
    internetReachable: false,
    supabaseReachable: false,
    lastCheckedAt: null,
    lastSyncAt: null,
    lastSyncSummary: null,
    lastError: null,
    latencyMs: null,
    autoSync: true,
    syncInProgress: false
};
let _heartbeatTimer = null;
let _realtimeTimer = null;
const _dirtyTables = new Set();

function maskDbUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        if (u.password) {
            u.password = '••••••••';
        }
        return u.toString();
    } catch {
        return url.replace(/:[^:@/]+@/, ':••••••••@');
    }
}

function getConfiguredDbUrl() {
    return (process.env.SUPABASE_DB_URL || '').trim();
}

function updateEnvFile(updates) {
    try {
        let content = '';
        if (fs.existsSync(ENV_PATH)) {
            content = fs.readFileSync(ENV_PATH, 'utf8');
        }
        const lines = content.split(/\r?\n/);
        const seen = new Set();
        const updatedLines = lines.map((line) => {
            const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
            if (!match) return line;
            const key = match[1];
            if (Object.prototype.hasOwnProperty.call(updates, key)) {
                seen.add(key);
                return `${key}=${updates[key] ?? ''}`;
            }
            return line;
        });
        for (const [k, v] of Object.entries(updates)) {
            if (!seen.has(k)) {
                updatedLines.push(`${k}=${v ?? ''}`);
            }
        }
        fs.writeFileSync(ENV_PATH, updatedLines.join('\r\n'), 'utf8');
    } catch (err) {
        console.warn('Could not persist SUPABASE_DB_URL to .env:', err.message);
    }
}

function closePool() {
    if (_pgPool) {
        const old = _pgPool;
        _pgPool = null;
        _schemaProvisioned = false;
        old.end().catch(() => {});
    }
}

function getOrCreatePool(customUrl) {
    const url = (customUrl || getConfiguredDbUrl()).trim();
    if (!url) {
        closePool();
        _currentDbUrl = '';
        _onlineState.configured = false;
        return null;
    }
    _onlineState.configured = true;
    if (_pgPool && _currentDbUrl === url) {
        return _pgPool;
    }
    closePool();
    _currentDbUrl = url;
    _pgPool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        max: 4,
        connectionTimeoutMillis: 4500,
        idleTimeoutMillis: 15000
    });
    _pgPool.on('error', (err) => {
        _onlineState.online = false;
        _onlineState.supabaseReachable = false;
        _onlineState.lastError = err.message;
    });
    return _pgPool;
}

/**
 * Checks whether general internet + Supabase PostgreSQL are reachable.
 */
async function checkConnectivity(customUrl) {
    const url = (customUrl !== undefined ? customUrl : getConfiguredDbUrl()).trim();
    _onlineState.configured = Boolean(url);
    _onlineState.lastCheckedAt = new Date().toISOString();

    // Quick DNS check for internet status
    const hasInternet = await new Promise((resolve) => {
        dns.lookup('supabase.com', (err) => resolve(!err));
    });
    _onlineState.internetReachable = hasInternet;

    if (!url) {
        _onlineState.online = false;
        _onlineState.supabaseReachable = false;
        _onlineState.latencyMs = null;
        return { ..._onlineState };
    }

    if (!hasInternet) {
        _onlineState.online = false;
        _onlineState.supabaseReachable = false;
        _onlineState.lastError = 'No internet connection detected (using local SQLite3)';
        return { ..._onlineState };
    }

    const pool = getOrCreatePool(url);
    const start = Date.now();
    try {
        const res = await pool.query('SELECT current_database() AS db, now() AS server_time');
        _onlineState.latencyMs = Date.now() - start;
        _onlineState.online = true;
        _onlineState.supabaseReachable = true;
        _onlineState.lastError = null;
        return {
            ..._onlineState,
            databaseName: res.rows?.[0]?.db || 'postgres'
        };
    } catch (err) {
        _onlineState.latencyMs = null;
        _onlineState.online = false;
        _onlineState.supabaseReachable = false;
        _onlineState.lastError = err.message || 'Supabase connection failed';
        return { ..._onlineState };
    }
}

/**
 *Maps SQLite column type to compatible PostgreSQL column type.
 */
function mapSqliteTypeToPg(sqliteType) {
    const t = String(sqliteType || 'TEXT').toUpperCase();
    if (t.includes('INT')) return 'BIGINT';
    if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUMERIC') || t.includes('DECIMAL')) {
        return 'DOUBLE PRECISION';
    }
    if (t.includes('BLOB')) return 'BYTEA';
    return 'TEXT';
}

/**
 * Inspects local SQLite3 schema for a table and ensures the matching table + columns exist in Supabase PostgreSQL.
 */
async function ensurePgTableForSqlite(pgClient, sqliteDb, tableName) {
    const cols = await sqliteDb.all(`PRAGMA table_info("${tableName}")`);
    if (!cols || !cols.length) return null;

    const pkCols = cols.filter((c) => Number(c.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk));
    const colDefs = cols.map((c) => {
        const pgType = mapSqliteTypeToPg(c.type);
        return `"${c.name}" ${pgType}`;
    });

    if (pkCols.length > 0) {
        const pkList = pkCols.map((c) => `"${c.name}"`).join(', ');
        colDefs.push(`PRIMARY KEY (${pkList})`);
    }

    await pgClient.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`);

    // Ensure any newly-added columns exist in PostgreSQL as well
    for (const c of cols) {
        const pgType = mapSqliteTypeToPg(c.type);
        await pgClient.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${c.name}" ${pgType}`);
    }

    return {
        columns: cols.map((c) => c.name),
        pkColumns: pkCols.map((c) => c.name)
    };
}

/**
 * Ensures all EDF tables exist in Supabase PostgreSQL.
 */
async function ensureSupabaseSchema(pgClient, sqliteDb) {
    const metaMap = new Map();
    for (const table of SYNC_TABLES_ORDERED) {
        try {
            const meta = await ensurePgTableForSqlite(pgClient, sqliteDb, table);
            if (meta) metaMap.set(table, meta);
        } catch (err) {
            console.warn(`Schema provision warning for table ${table}:`, err.message);
        }
    }
    _schemaProvisioned = true;
    return metaMap;
}

/**
 * Upserts all rows of a single table from local SQLite3 -> Supabase PostgreSQL.
 */
async function pushTableToSupabase(pgClient, sqliteDb, tableName, metaOverride = null) {
    const meta = metaOverride || (await ensurePgTableForSqlite(pgClient, sqliteDb, tableName));
    if (!meta || !meta.columns.length) return { pushed: 0 };

    const rows = await sqliteDb.all(`SELECT * FROM "${tableName}"`);
    if (!rows || !rows.length) return { pushed: 0 };

    const cols = meta.columns;
    const pkCols = meta.pkColumns;
    const quotedCols = cols.map((c) => `"${c}"`).join(', ');
    let pushed = 0;

    // Batch insert/upsert in chunks of 100 rows
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const values = [];
        const valueClauses = [];
        let paramIdx = 1;

        for (const row of chunk) {
            const placeholders = [];
            for (const col of cols) {
                let v = row[col];
                if (v === undefined) v = null;
                values.push(v);
                placeholders.push(`$${paramIdx++}`);
            }
            valueClauses.push(`(${placeholders.join(', ')})`);
        }

        let conflictClause = 'ON CONFLICT DO NOTHING';
        if (pkCols.length > 0) {
            const pkQuoted = pkCols.map((c) => `"${c}"`).join(', ');
            const nonPkCols = cols.filter((c) => !pkCols.includes(c));
            if (nonPkCols.length > 0) {
                const updateSet = nonPkCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
                conflictClause = `ON CONFLICT (${pkQuoted}) DO UPDATE SET ${updateSet}`;
            } else {
                conflictClause = `ON CONFLICT (${pkQuoted}) DO NOTHING`;
            }
        }

        const sql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES ${valueClauses.join(', ')} ${conflictClause}`;
        await pgClient.query(sql, values);
        pushed += chunk.length;
    }

    return { pushed };
}

/**
 * Pulls all rows of a single table from Supabase PostgreSQL -> local SQLite3.
 */
async function pullTableFromSupabase(pgClient, sqliteDb, tableName, metaOverride = null, replaceLocal = false) {
    const meta = metaOverride || (await ensurePgTableForSqlite(pgClient, sqliteDb, tableName));
    if (!meta || !meta.columns.length) return { pulled: 0 };

    const res = await pgClient.query(`SELECT * FROM "${tableName}"`);
    const remoteRows = res.rows || [];
    if (!remoteRows.length) return { pulled: 0 };

    const cols = meta.columns;
    const quotedCols = cols.map((c) => `"${c}"`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');

    if (replaceLocal) {
        await sqliteDb.run(`DELETE FROM "${tableName}"`, [], { _skipSyncHook: true });
    }

    let pulled = 0;
    for (const r of remoteRows) {
        const args = cols.map((c) => {
            const v = r[c];
            if (v === undefined) return null;
            if (v instanceof Date) return v.toISOString();
            return v;
        });
        await sqliteDb.run(
            `INSERT OR REPLACE INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`,
            args,
            { _skipSyncHook: true }
        );
        pulled++;
    }
    return { pulled };
}

/**
 * Extracts table name and operation type from a SQL write statement.
 */
function parseWriteStatement(sql) {
    const s = String(sql || '').trim();
    if (!s) return null;
    const insertMatch = s.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
    if (insertMatch) return { op: 'INSERT', table: insertMatch[1].toLowerCase() };

    const updateMatch = s.match(/^UPDATE\s+(?:OR\s+\w+\s+)?["`]?([a-zA-Z0-9_]+)["`]?/i);
    if (updateMatch) return { op: 'UPDATE', table: updateMatch[1].toLowerCase() };

    const deleteMatch = s.match(/^DELETE\s+FROM\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
    if (deleteMatch) return { op: 'DELETE', table: deleteMatch[1].toLowerCase() };

    return null;
}

/**
 * Queues an offline mutation into local SQLite `_sync_outbox`.
 */
async function queueOutboxMutation(tableName, opType, sqlText, params) {
    if (!_sqliteDb) return;
    try {
        await _sqliteDb.run(
            `INSERT INTO _sync_outbox (table_name, op_type, sql_text, params_json, synced) VALUES (?, ?, ?, ?, 0)`,
            [tableName, opType, String(sqlText || ''), JSON.stringify(params || [])],
            { _skipSyncHook: true }
        );
    } catch (_) {}
}

/**
 * Triggered automatically after every local SQLite write (`db.run`).
 * If online with Supabase configured, replicates the table/delete immediately;
 * if offline or unreachable, queues in `_sync_outbox` for automatic/manual sync.
 */
async function onLocalWrite(sqlText, params) {
    const parsed = parseWriteStatement(sqlText);
    if (!parsed || !SYNC_TABLE_SET.has(parsed.table)) return;
    if (parsed.table.startsWith('_sync_')) return;

    _dirtyTables.add(parsed.table);
    const url = getConfiguredDbUrl();
    if (!url || !_onlineState.online) {
        await queueOutboxMutation(parsed.table, parsed.op, sqlText, params);
        return;
    }

    // Debounce live background write-through so rapid bursts batch cleanly
    await queueOutboxMutation(parsed.table, parsed.op, sqlText, params);
    if (_realtimeTimer) clearTimeout(_realtimeTimer);
    _realtimeTimer = setTimeout(() => {
        syncDirtyTablesLive().catch(() => {});
    }, 600);
}

/**
 * Background write-through for dirty tables when online.
 */
async function syncDirtyTablesLive() {
    if (_onlineState.syncInProgress || !_sqliteDb || !getConfiguredDbUrl()) return;
    const pool = getOrCreatePool();
    if (!pool) return;

    const tablesToSync = Array.from(_dirtyTables);
    if (!tablesToSync.length) return;

    let client;
    try {
        client = await pool.connect();
        for (const tbl of tablesToSync) {
            const meta = await ensurePgTableForSqlite(client, _sqliteDb, tbl);
            if (!meta) continue;

            // Check if any DELETE occurred on this table; if so, mirror missing IDs
            const delRow = await _sqliteDb.get(
                `SELECT COUNT(*) as c FROM _sync_outbox WHERE table_name = ? AND op_type = 'DELETE' AND synced = 0`,
                [tbl]
            );
            if (delRow && delRow.c > 0 && meta.pkColumns.length === 1 && meta.pkColumns[0] === 'id') {
                const localIds = await _sqliteDb.all(`SELECT id FROM "${tbl}"`);
                const idList = localIds.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
                if (idList.length === 0) {
                    await client.query(`DELETE FROM "${tbl}"`);
                } else {
                    await client.query(`DELETE FROM "${tbl}" WHERE id != ALL($1::bigint[])`, [idList]);
                }
            }

            await pushTableToSupabase(client, _sqliteDb, tbl, meta);
            await _sqliteDb.run(
                `UPDATE _sync_outbox SET synced = 1, synced_at = datetime('now') WHERE table_name = ? AND synced = 0`,
                [tbl],
                { _skipSyncHook: true }
            );
            _dirtyTables.delete(tbl);
        }
        _onlineState.online = true;
        _onlineState.supabaseReachable = true;
        _onlineState.lastSyncAt = new Date().toISOString();
    } catch (err) {
        _onlineState.online = false;
        _onlineState.supabaseReachable = false;
        _onlineState.lastError = err.message;
    } finally {
        if (client) client.release();
    }
}

/**
 * Full manual or automatic synchronization between Local SQLite3 and Supabase PostgreSQL.
 * @param {'push' | 'pull' | 'bidirectional'} mode
 */
async function runFullSync(mode = 'bidirectional') {
    if (!_sqliteDb) throw new Error('Local SQLite3 database is not initialized');
    const url = getConfiguredDbUrl();
    if (!url) throw new Error('Supabase Database URL is not configured yet');
    if (_onlineState.syncInProgress) throw new Error('A sync operation is already in progress');

    _onlineState.syncInProgress = true;
    const startMs = Date.now();
    const pool = getOrCreatePool(url);
    let client;

    try {
        client = await pool.connect();
        await client.query('SELECT 1');
        _onlineState.online = true;
        _onlineState.supabaseReachable = true;
        _onlineState.internetReachable = true;
        _onlineState.lastError = null;

        const metaMap = await ensureSupabaseSchema(client, _sqliteDb);

        let totalPushed = 0;
        let totalPulled = 0;
        let tablesSynced = 0;

        await _sqliteDb.run('PRAGMA foreign_keys = OFF', [], { _skipSyncHook: true });

        try {
            if (mode === 'push' || mode === 'bidirectional') {
                for (const table of SYNC_TABLES_ORDERED) {
                    const meta = metaMap.get(table);
                    if (!meta) continue;

                    // If pure push or if local DELETEs happened in outbox, mirror deletions first
                    const delRow = await _sqliteDb.get(
                        `SELECT COUNT(*) as c FROM _sync_outbox WHERE table_name = ? AND op_type = 'DELETE' AND synced = 0`,
                        [table]
                    );
                    if ((mode === 'push' || (delRow && delRow.c > 0)) && meta.pkColumns.length === 1 && meta.pkColumns[0] === 'id') {
                        const localIds = await _sqliteDb.all(`SELECT id FROM "${table}"`);
                        const idList = localIds.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
                        if (idList.length === 0) {
                            if (mode === 'push' || (delRow && delRow.c > 0)) {
                                await client.query(`DELETE FROM "${table}"`);
                            }
                        } else {
                            await client.query(`DELETE FROM "${table}" WHERE id != ALL($1::bigint[])`, [idList]);
                        }
                    }

                    const { pushed } = await pushTableToSupabase(client, _sqliteDb, table, meta);
                    totalPushed += pushed;
                    tablesSynced++;
                }
            }

            if (mode === 'pull' || mode === 'bidirectional') {
                for (const table of SYNC_TABLES_ORDERED) {
                    const meta = metaMap.get(table);
                    if (!meta) continue;
                    const { pulled } = await pullTableFromSupabase(
                        client,
                        _sqliteDb,
                        table,
                        meta,
                        mode === 'pull'
                    );
                    totalPulled += pulled;
                    if (mode === 'pull') tablesSynced++;
                }
            }
        } finally {
            await _sqliteDb.run('PRAGMA foreign_keys = ON', [], { _skipSyncHook: true });
        }

        // Mark all outbox records as synced
        await _sqliteDb.run(
            `UPDATE _sync_outbox SET synced = 1, synced_at = datetime('now') WHERE synced = 0`,
            [],
            { _skipSyncHook: true }
        );
        _dirtyTables.clear();

        const durationMs = Date.now() - startMs;
        const summary = {
            mode,
            tablesSynced,
            rowsPushed: totalPushed,
            rowsPulled: totalPulled,
            durationMs,
            syncedAt: new Date().toISOString()
        };

        _onlineState.lastSyncAt = summary.syncedAt;
        _onlineState.lastSyncSummary = summary;

        // Persist last sync metadata into global_settings
        try {
            await _sqliteDb.run(
                `INSERT INTO global_settings (key, value, updated_at) VALUES ('supabase_last_sync', ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
                [JSON.stringify(summary)],
                { _skipSyncHook: true }
            );
        } catch (_) {}

        return summary;
    } catch (err) {
        _onlineState.lastError = err.message;
        throw err;
    } finally {
        _onlineState.syncInProgress = false;
        if (client) client.release();
    }
}

/**
 * Returns full hybrid sync status including outbox counts & dirty tables.
 */
async function getSyncStatus(forcePing = false) {
    if (forcePing || !_onlineState.lastCheckedAt || (Date.now() - new Date(_onlineState.lastCheckedAt).getTime() > 15000)) {
        await checkConnectivity();
    }

    let pendingOutboxCount = 0;
    let pendingByTable = [];
    let recentOutbox = [];

    if (_sqliteDb) {
        try {
            const countRow = await _sqliteDb.get(`SELECT COUNT(*) AS c FROM _sync_outbox WHERE synced = 0`);
            pendingOutboxCount = countRow ? Number(countRow.c || 0) : 0;

            pendingByTable = await _sqliteDb.all(
                `SELECT table_name, COUNT(*) AS count, MAX(created_at) AS last_change
                 FROM _sync_outbox
                 WHERE synced = 0
                 GROUP BY table_name
                 ORDER BY count DESC`
            );

            recentOutbox = await _sqliteDb.all(
                `SELECT id, table_name, op_type, created_at, synced, synced_at
                 FROM _sync_outbox
                 ORDER BY id DESC
                 LIMIT 12`
            );

            if (!_onlineState.lastSyncSummary) {
                const row = await _sqliteDb.get(`SELECT value FROM global_settings WHERE key = 'supabase_last_sync'`);
                if (row && row.value) {
                    const parsed = JSON.parse(row.value);
                    _onlineState.lastSyncSummary = parsed;
                    _onlineState.lastSyncAt = parsed.syncedAt || null;
                }
            }
        } catch (_) {}
    }

    const dbUrl = getConfiguredDbUrl();
    const activeEngine = dbUrl && _onlineState.online
        ? 'hybrid_online'
        : 'sqlite_offline';

    return {
        activeEngine,
        engineLabel: activeEngine === 'hybrid_online'
            ? 'Supabase Cloud + Local SQLite3 (Online Write-Through)'
            : 'Local SQLite3 (Offline-First Mode)',
        configured: Boolean(dbUrl),
        maskedDbUrl: maskDbUrl(dbUrl),
        online: _onlineState.online,
        internetReachable: _onlineState.internetReachable,
        supabaseReachable: _onlineState.supabaseReachable,
        latencyMs: _onlineState.latencyMs,
        autoSync: _onlineState.autoSync,
        syncInProgress: _onlineState.syncInProgress,
        lastCheckedAt: _onlineState.lastCheckedAt,
        lastSyncAt: _onlineState.lastSyncAt,
        lastSyncSummary: _onlineState.lastSyncSummary,
        lastError: _onlineState.lastError,
        pendingOutboxCount,
        pendingByTable,
        recentOutbox
    };
}

/**
 * Saves Supabase configuration and optionally runs an immediate connection check.
 */
async function saveConfig({ supabaseDbUrl, autoSync }) {
    if (typeof supabaseDbUrl === 'string') {
        const cleanUrl = supabaseDbUrl.trim();
        process.env.SUPABASE_DB_URL = cleanUrl;
        updateEnvFile({ SUPABASE_DB_URL: cleanUrl });
    }
    if (typeof autoSync === 'boolean') {
        _onlineState.autoSync = autoSync;
        updateEnvFile({ SUPABASE_AUTO_SYNC: autoSync ? 'true' : 'false' });
    }
    if (_sqliteDb) {
        try {
            await _sqliteDb.run(
                `INSERT INTO global_settings (key, value, updated_at) VALUES ('supabase_auto_sync', ?, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
                [_onlineState.autoSync ? 'true' : 'false'],
                { _skipSyncHook: true }
            );
        } catch (_) {}
    }
    closePool();
    return await getSyncStatus(true);
}

/**
 * Initializes the hybrid sync engine on top of the local SQLite database.
 */
async function attachHybridSync(sqliteDb) {
    _sqliteDb = sqliteDb;

    await sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS _sync_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            op_type TEXT NOT NULL,
            sql_text TEXT,
            params_json TEXT,
            synced INTEGER DEFAULT 0,
            synced_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_synced ON _sync_outbox(synced, table_name);
    `);

    if (process.env.SUPABASE_AUTO_SYNC !== undefined) {
        _onlineState.autoSync = String(process.env.SUPABASE_AUTO_SYNC).toLowerCase() !== 'false';
    } else {
        try {
            const r = await sqliteDb.get(`SELECT value FROM global_settings WHERE key = 'supabase_auto_sync'`);
            if (r && r.value !== undefined) {
                _onlineState.autoSync = r.value !== 'false';
            }
        } catch (_) {}
    }

    // Initial non-blocking connectivity check & auto-sync if configured
    checkConnectivity().then(async (st) => {
        if (st.online && _onlineState.autoSync) {
            const countRow = await sqliteDb.get(`SELECT COUNT(*) AS c FROM _sync_outbox WHERE synced = 0`).catch(() => ({ c: 0 }));
            if (countRow && Number(countRow.c) > 0) {
                runFullSync('push').catch(() => {});
            }
        }
    }).catch(() => {});

    // Background heartbeat every 30s to detect online/offline transitions and auto-sync queued offline changes
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(async () => {
        try {
            const wasOnline = _onlineState.online;
            const st = await checkConnectivity();
            if (st.online && _onlineState.autoSync) {
                const countRow = await sqliteDb.get(`SELECT COUNT(*) AS c FROM _sync_outbox WHERE synced = 0`).catch(() => ({ c: 0 }));
                if ((!wasOnline || (countRow && Number(countRow.c) > 0)) && !_onlineState.syncInProgress) {
                    if (countRow && Number(countRow.c) > 0) {
                        await runFullSync('push');
                    }
                }
            }
        } catch (_) {}
    }, 30000);
    if (_heartbeatTimer.unref) _heartbeatTimer.unref();
}

module.exports = {
    attachHybridSync,
    onLocalWrite,
    checkConnectivity,
    getSyncStatus,
    saveConfig,
    runFullSync,
    SYNC_TABLES_ORDERED
};

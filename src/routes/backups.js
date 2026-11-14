const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');
const { authenticateToken } = require('../middleware/authMiddleware');
const storageSvc = require('../services/storage');
const supabaseSync = require('../services/supabaseSync');

const DB_PATH = path.join(__dirname, '../db/database.sqlite');
const BACKUP_DIR = path.join(__dirname, '../../backups');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.json' || file.mimetype === 'application/json' || file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON backup files (.json) are allowed'));
        }
    }
});

/**
 * Domain modules in parent -> child topological order for safe backup & restore.
 * Deletion / purge iterates in reverse order inside each table list.
 */
const BACKUP_MODULES = [
    {
        key: 'members',
        label: 'Members & Relatives',
        desc: 'Founders, executive members, family tree & dependents',
        category: 'operational',
        icon: 'users',
        color: '#3b82f6',
        tables: ['members', 'member_relatives'],
        purgeable: true
    },
    {
        key: 'subscriptions',
        label: 'Subscriptions & Payments',
        desc: 'Monthly member dues, advances, partial receipts & cheques',
        category: 'operational',
        icon: 'banknote',
        color: '#6366f1',
        tables: ['subscriptions', 'subscription_payments'],
        purgeable: true
    },
    {
        key: 'beneficiaries',
        label: 'Beneficiaries, Helps & Children',
        desc: 'Applications, assessments, child education records, direct aids & logs',
        category: 'operational',
        icon: 'hand-heart',
        color: '#10b981',
        tables: [
            'beneficiary_categories',
            'beneficiaries',
            'beneficiary_children_study',
            'beneficiary_children_dropout',
            'beneficiary_children_university',
            'beneficiary_children_abroad',
            'beneficiary_children_other',
            'beneficiary_helps',
            'beneficiary_help_logs'
        ],
        purgeable: true
    },
    {
        key: 'families',
        label: 'Families & Relief Grants',
        desc: 'Family registry households & distributed family grants',
        category: 'operational',
        icon: 'home',
        color: '#f59e0b',
        tables: ['families', 'family_donations'],
        purgeable: true
    },
    {
        key: 'finance',
        label: 'Treasury, Donations & Projects',
        desc: 'Income/expense ledger, external Zakat/Sadaqah & legacy donations',
        category: 'operational',
        icon: 'receipt',
        color: '#14b8a6',
        tables: ['transactions', 'external_donations', 'donations', 'projects'],
        purgeable: true
    },
    {
        key: 'ramadan',
        label: 'Ramadan Campaigns & Tokens',
        desc: 'Ramadan distributions, shop quotas & token collection logs',
        category: 'operational',
        icon: 'moon',
        color: '#8b5cf6',
        tables: ['ramadan_distributions', 'ramadan_tokens'],
        purgeable: true
    },
    {
        key: 'madrasa',
        label: 'Madrasa Academy',
        desc: 'Muallimahs, Halqah classes, student admissions & attendance',
        category: 'operational',
        icon: 'book-open',
        color: '#059669',
        tables: ['madrasa_muallimahs', 'madrasa_classes', 'madrasa_students', 'madrasa_attendance'],
        purgeable: true
    },
    {
        key: 'programs',
        label: 'Courses, Batches & Applications',
        desc: 'Educational courses, batches, dynamic form builders & applicants',
        category: 'operational',
        icon: 'graduation-cap',
        color: '#0284c7',
        tables: ['form_templates', 'courses', 'batches', 'program_applications'],
        purgeable: true
    },
    {
        key: 'volunteers',
        label: 'Volunteers & Field Force',
        desc: 'Volunteer roster, skills, service hours & deployment logs',
        category: 'operational',
        icon: 'heart-handshake',
        color: '#ef4444',
        tables: ['volunteers', 'volunteer_activities'],
        purgeable: true
    },
    {
        key: 'inventory',
        label: 'Inventory & Library Assets',
        desc: 'Equipment, books, asset loans, maintenance & usage ledger',
        category: 'operational',
        icon: 'package',
        color: '#ea580c',
        tables: ['inventory_items', 'inventory_loans', 'inventory_maintenance', 'inventory_usage'],
        purgeable: true
    },
    {
        key: 'documents',
        label: 'Documents Vault',
        desc: 'Document catalog metadata, folders & visibility settings',
        category: 'storage',
        icon: 'folder-open',
        color: '#0d9488',
        tables: ['documents'],
        purgeable: true
    },
    {
        key: 'sms',
        label: 'SMS Gateways, Templates & Logs',
        desc: 'Text.lk API configs, message templates & SMS dispatch history',
        category: 'comms',
        icon: 'message-square',
        color: '#2563eb',
        tables: ['sms_gateways', 'sms_templates', 'sms_logs'],
        purgeable: true
    },
    {
        key: 'cms',
        label: 'Organization & Landing CMS',
        desc: 'Global org settings, gallery, timeline, team, partners & story copy',
        category: 'config',
        icon: 'globe',
        color: '#d97706',
        tables: ['global_settings', 'site_content', 'timeline_items', 'team_members', 'site_partners', 'origin_paragraphs', 'gallery_images'],
        purgeable: false
    },
    {
        key: 'logs',
        label: 'System & Auth Logs',
        desc: 'API audit trails & user login/logout session history',
        category: 'logs',
        icon: 'scroll-text',
        color: '#64748b',
        tables: ['system_logs', 'login_events'],
        purgeable: true
    },
    {
        key: 'users',
        label: 'Users & Permissions',
        desc: 'Staff login accounts & module RBAC permissions',
        category: 'security',
        icon: 'shield',
        color: '#0f172a',
        tables: ['users', 'user_permissions'],
        purgeable: false
    }
];

const MODULE_MAP = new Map(BACKUP_MODULES.map(m => [m.key, m]));
const ALL_VALID_TABLES = new Set(BACKUP_MODULES.flatMap(m => m.tables));

// Strict dependency-safe deletion order for Operational Clean Start (children -> parents)
const OPERATIONAL_CLEAN_TABLES = [
    'madrasa_attendance',
    'madrasa_students',
    'madrasa_classes',
    'madrasa_muallimahs',
    'inventory_usage',
    'inventory_maintenance',
    'inventory_loans',
    'inventory_items',
    'program_applications',
    'batches',
    'courses',
    'form_templates',
    'ramadan_tokens',
    'ramadan_distributions',
    'beneficiary_help_logs',
    'beneficiary_helps',
    'beneficiary_children_study',
    'beneficiary_children_dropout',
    'beneficiary_children_university',
    'beneficiary_children_abroad',
    'beneficiary_children_other',
    'beneficiaries',
    'beneficiary_categories',
    'subscription_payments',
    'subscriptions',
    'family_donations',
    'families',
    'member_relatives',
    'members',
    'transactions',
    'external_donations',
    'donations',
    'projects',
    'volunteer_activities',
    'volunteers',
    'sms_logs'
];

// Global insert order when restoring across multiple modules
const GLOBAL_RESTORE_ORDER = BACKUP_MODULES.flatMap(m => m.tables);

function snapshotRelPath(filename) {
    const clean = path.basename(String(filename || ''));
    if (!clean || clean === '.' || clean === '..') {
        throw new Error('Invalid snapshot file path');
    }
    return `backups/${clean}`;
}

function safeSnapshotPath(filename) {
    const clean = path.basename(String(filename || ''));
    const full = path.resolve(BACKUP_DIR, clean);
    const root = path.resolve(BACKUP_DIR) + path.sep;
    if (!full.startsWith(root)) throw new Error('Invalid snapshot file path');
    return full;
}

function getFileSizeSafe(p) {
    try { return fs.existsSync(p) ? fs.statSync(p).size : 0; } catch (_) { return 0; }
}

async function runConcurrent(items, limit, worker) {
    const out = new Array(items.length);
    let idx = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (idx < items.length) {
            const current = idx++;
            out[current] = await worker(items[current], current);
        }
    });
    await Promise.all(runners);
    return out;
}

async function countTablesFast(db, tableNames) {
    const counts = {};
    const CHUNK = 15;
    for (let i = 0; i < tableNames.length; i += CHUNK) {
        const slice = tableNames.slice(i, i + CHUNK);
        try {
            const unionSql = slice.map((t) => `SELECT '${t}' AS tbl, COUNT(*) AS c FROM [${t}]`).join(' UNION ALL ');
            const rows = await db.all(unionSql);
            for (const r of rows) {
                counts[r.tbl] = Number(r.c || 0);
            }
        } catch (_) {
            for (const tbl of slice) {
                try {
                    const row = await db.get(`SELECT COUNT(*) AS c FROM [${tbl}]`);
                    counts[tbl] = Number(row?.c || 0);
                } catch {
                    counts[tbl] = 0;
                }
            }
        }
    }
    return counts;
}

function normalizeLegacyPayload(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Backup JSON payload is empty or invalid');
    }
    if (raw.tables && typeof raw.tables === 'object' && !Array.isArray(raw.tables)) {
        const cleaned = {};
        for (const [k, rows] of Object.entries(raw.tables)) {
            if (ALL_VALID_TABLES.has(k) && Array.isArray(rows)) {
                cleaned[k] = rows;
            }
        }
        return cleaned;
    }
    // Support legacy v1 JSON downloaded via client runFullBackup()
    const legacyKeyMap = {
        members: 'members',
        beneficiaries: 'beneficiaries',
        families: 'families',
        volunteers: 'volunteers',
        subscriptions: 'subscriptions',
        transactions: 'transactions',
        'external-donations': 'external_donations',
        external_donations: 'external_donations'
    };
    const mapped = {};
    for (const [k, v] of Object.entries(raw)) {
        const target = legacyKeyMap[k] || (ALL_VALID_TABLES.has(k) ? k : null);
        if (target && Array.isArray(v)) mapped[target] = v;
    }
    return mapped;
}

module.exports = (db) => {
    async function hasSequenceTable() {
        const row = await db.get(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'"
        ).catch(() => null);
        return !!row;
    }

    async function wipeTablesInTx(tx, tableList, collectCounts = false, hasSeq = false) {
        const counts = {};
        for (const tbl of tableList) {
            if (collectCounts) {
                const row = await tx.get(`SELECT COUNT(*) AS c FROM [${tbl}]`);
                counts[tbl] = Number(row?.c || 0);
            }
            if (tbl === 'members') {
                await tx.run('UPDATE members SET sibling_id = NULL WHERE sibling_id IS NOT NULL').catch(() => {});
            }
            await tx.run(`DELETE FROM [${tbl}]`);
            if (hasSeq) {
                await tx.run('DELETE FROM sqlite_sequence WHERE name = ?', [tbl]).catch(() => {});
            }
        }
        return counts;
    }

    async function existingTableSet() {
        const rows = await db.all(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        return new Set(rows.map(r => r.name));
    }

    async function hasSettingsAccess(req) {
        if (!req.user) return false;
        if (req.user.role === 'admin' || req.user.role === 'super_user') return true;
        const perm = await db.get(
            'SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?',
            [req.user.id, 'settings']
        );
        return !!perm;
    }

    async function requireSettingsAccess(req, res, next) {
        if (await hasSettingsAccess(req)) return next();
        return res.status(403).json({ message: 'Admin or Settings access required' });
    }

    function requireStrictAdmin(req, res, next) {
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_user')) {
            return res.status(403).json({ message: 'Administrator privileges required for destructive data actions' });
        }
        next();
    }

    async function logActivity(req, action, entityId, details) {
        try {
            await db.run(
                'INSERT INTO system_logs (user_id, action, entity, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user?.id || null, action, 'backup_vault', String(entityId || ''), String(details || ''), req.ip || null]
            );
        } catch (_) {}
    }

    async function createSnapshotInternal({
        name,
        notes = '',
        backupType = 'manual',
        scope = 'full',
        modules = null,
        isLocked = false,
        createdBy = 'admin'
    }) {
        const liveTables = await existingTableSet();
        let chosenModules = BACKUP_MODULES.map(m => m.key);
        if (Array.isArray(modules) && modules.length > 0) {
            chosenModules = modules.filter(k => MODULE_MAP.has(k));
        } else if (scope === 'operational') {
            chosenModules = BACKUP_MODULES.filter(m => m.category === 'operational').map(m => m.key);
        }
        if (chosenModules.length === 0) {
            throw new Error('Select at least one valid data module to snapshot');
        }

        const targetTables = [];
        for (const mKey of chosenModules) {
            const mod = MODULE_MAP.get(mKey);
            if (!mod) continue;
            for (const tbl of mod.tables) {
                if (liveTables.has(tbl) && !targetTables.includes(tbl)) {
                    targetTables.push(tbl);
                }
            }
        }

        const tablesData = {};
        const tableCounts = {};
        let totalRows = 0;

        await runConcurrent(targetTables, 6, async (tbl) => {
            const rows = await db.all(`SELECT * FROM [${tbl}]`);
            tablesData[tbl] = rows;
            tableCounts[tbl] = rows.length;
        });
        for (const tbl of targetTables) {
            totalRows += tableCounts[tbl] || 0;
        }

        const uid = `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const timestamp = new Date().toISOString();
        const envelope = {
            format: 'edf-backup-v2',
            uid,
            name: String(name || `EDF Backup ${timestamp.slice(0, 10)}`).trim(),
            notes: String(notes || '').trim(),
            backup_type: backupType,
            scope,
            modules: chosenModules,
            created_at: timestamp,
            created_by: createdBy,
            tables_count: targetTables.length,
            total_rows: totalRows,
            counts: tableCounts,
            tables: tablesData
        };

        const jsonStr = JSON.stringify(envelope, null, 2);
        const checksum = crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
        const filename = `${uid}.json`;
        const saved = await storageSvc.saveBuffer(
            snapshotRelPath(filename),
            Buffer.from(jsonStr, 'utf8'),
            'application/json; charset=utf-8'
        );
        const fileSize = saved.size;

        const ins = await db.run(
            `INSERT INTO backup_snapshots (
                uid, name, notes, backup_type, scope, filename, file_size, checksum,
                tables_count, total_rows, table_counts_json, includes_json, is_locked, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uid,
                envelope.name,
                envelope.notes,
                backupType,
                scope,
                filename,
                fileSize,
                checksum,
                targetTables.length,
                totalRows,
                JSON.stringify(tableCounts),
                JSON.stringify(chosenModules),
                isLocked ? 1 : 0,
                createdBy
            ]
        );

        await db.run(
            `INSERT INTO global_settings (key, value) VALUES ('last_backup_at', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
            [String(Date.now())]
        );

        return await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [ins.lastID]);
    }

    // ── GET /api/backups/overview — live database telemetry & module counts ──
    router.get('/overview', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const liveTables = await existingTableSet();
            const countable = [...liveTables].filter((t) => t !== 'backup_snapshots');
            const tableCounts = await countTablesFast(db, countable);

            let operationalRows = 0;
            let configRows = 0;
            let logRows = 0;
            let totalRows = 0;

            const modules = BACKUP_MODULES.map(mod => {
                const modTables = mod.tables.filter(t => liveTables.has(t));
                const perTable = {};
                let rowsSum = 0;
                for (const t of modTables) {
                    const cnt = tableCounts[t] || 0;
                    perTable[t] = cnt;
                    rowsSum += cnt;
                }
                totalRows += rowsSum;
                if (mod.category === 'operational') operationalRows += rowsSum;
                else if (mod.category === 'logs') logRows += rowsSum;
                else configRows += rowsSum;

                return {
                    key: mod.key,
                    label: mod.label,
                    desc: mod.desc,
                    category: mod.category,
                    icon: mod.icon,
                    color: mod.color,
                    purgeable: mod.purgeable,
                    tables: modTables,
                    tableCounts: perTable,
                    rowCount: rowsSum
                };
            });

            let dbSize = 0;
            let walSize = 0;
            let shmSize = 0;
            if (db.isRemote) {
                const pc = await db.get('PRAGMA page_count').catch(() => null);
                const ps = await db.get('PRAGMA page_size').catch(() => null);
                dbSize = Number(pc?.page_count || 0) * Number(ps?.page_size || 0);
            } else {
                dbSize = getFileSizeSafe(DB_PATH);
                walSize = getFileSizeSafe(DB_PATH + '-wal');
                shmSize = getFileSizeSafe(DB_PATH + '-shm');
            }
            const verRow = await db.get('SELECT sqlite_version() AS v').catch(() => null);
            const journalRow = db.isRemote ? null : await db.get('PRAGMA journal_mode').catch(() => null);

            const snapStats = await db.get(
                `SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS totalBytes,
                        SUM(CASE WHEN is_locked = 1 THEN 1 ELSE 0 END) AS lockedCount,
                        MAX(created_at) AS lastCreatedAt
                 FROM backup_snapshots`
            );
            const lastSet = await db.get("SELECT value FROM global_settings WHERE key = 'last_backup_at'");

            res.json({
                database: {
                    path: db.isRemote ? 'Turso Cloud (libSQL)' : 'src/db/database.sqlite',
                    engine: db.engine || 'sqlite',
                    storageMode: storageSvc.isCloudStorage() ? 'vercel-blob' : 'local-disk',
                    sizeBytes: dbSize,
                    walBytes: walSize,
                    shmBytes: shmSize,
                    totalDiskBytes: dbSize + walSize + shmSize,
                    sqliteVersion: verRow?.v || 'libsql',
                    journalMode: db.isRemote ? 'turso-cloud' : (journalRow?.journal_mode || 'delete'),
                    tablesCount: liveTables.size - (liveTables.has('backup_snapshots') ? 1 : 0)
                },
                totals: {
                    totalRows,
                    operationalRows,
                    configRows,
                    logRows
                },
                snapshots: {
                    count: Number(snapStats?.count || 0),
                    totalBytes: Number(snapStats?.totalBytes || 0),
                    lockedCount: Number(snapStats?.lockedCount || 0),
                    lastCreatedAt: snapStats?.lastCreatedAt || null,
                    lastBackupTimestamp: lastSet?.value ? Number(lastSet.value) : null
                },
                tableCounts,
                modules
            });
        } catch (err) {
            console.error('Backups overview error:', err);
            res.status(500).json({ message: 'Failed to load database telemetry: ' + err.message });
        }
    });

    // ── GET /api/backups — list/search/filter/sort/paginate saved snapshots ──
    router.get('/', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const q = String(req.query.q || '').trim().toLowerCase();
            const typeFilter = String(req.query.type || 'all').trim().toLowerCase();
            const sort = String(req.query.sort || 'newest').trim().toLowerCase();
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

            let rows = await db.all('SELECT * FROM backup_snapshots');
            rows = rows.map(r => {
                let includes = [];
                let tableCounts = {};
                try { includes = JSON.parse(r.includes_json || '[]'); } catch (_) {}
                try { tableCounts = JSON.parse(r.table_counts_json || '{}'); } catch (_) {}
                const onDisk = storageSvc.isCloudStorage()
                    ? Number(r.file_size || 0) > 0
                    : fs.existsSync(safeSnapshotPath(r.filename));
                return {
                    ...r,
                    includes,
                    tableCounts,
                    on_disk: onDisk
                };
            });

            if (typeFilter !== 'all') {
                rows = rows.filter(r => String(r.backup_type || '').toLowerCase() === typeFilter);
            }
            if (q) {
                rows = rows.filter(r =>
                    [r.name, r.notes, r.uid, r.backup_type, r.scope, r.created_by, r.checksum]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(q)
                );
            }

            rows.sort((a, b) => {
                if (sort === 'oldest') return (a.id - b.id);
                if (sort === 'largest') return Number(b.file_size || 0) - Number(a.file_size || 0);
                if (sort === 'rows') return Number(b.total_rows || 0) - Number(a.total_rows || 0);
                if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
                return (b.id - a.id);
            });

            const total = rows.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(page, totalPages);
            const start = (safePage - 1) * limit;
            const paginated = rows.slice(start, start + limit);

            res.json({
                snapshots: paginated,
                total,
                page: safePage,
                limit,
                totalPages
            });
        } catch (err) {
            console.error('List backups error:', err);
            res.status(500).json({ message: 'Failed to list backup snapshots' });
        }
    });

    // ── GET /api/backups/export/sqlite — download atomic SQLite snapshot ────
    router.get('/export/sqlite', authenticateToken, requireSettingsAccess, async (req, res) => {
        if (db.isRemote) {
            return res.status(400).json({
                message: 'Raw .sqlite export is only available on local file-based SQLite. On Turso Cloud, use Full JSON Snapshot Export instead.'
            });
        }
        const tmpFile = path.join(os.tmpdir(), `edf-db-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.sqlite`);
        try {
            const escapedTmp = tmpFile.replace(/'/g, "''");
            await db.run(`VACUUM INTO '${escapedTmp}'`);
            const dlName = `EDF-Database-${new Date().toISOString().slice(0, 10)}.sqlite`;
            await logActivity(req, 'export_sqlite', 'database', 'Downloaded live SQLite snapshot');
            res.download(tmpFile, dlName, () => {
                try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
            });
        } catch (err) {
            try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
            console.error('SQLite export error:', err);
            res.status(500).json({ message: 'Failed to export SQLite database: ' + err.message });
        }
    });

    // ── GET /api/backups/export/table/:table — export individual table CSV/JSON ─
    router.get('/export/table/:table', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const tbl = String(req.params.table || '').trim();
            if (!ALL_VALID_TABLES.has(tbl)) {
                return res.status(400).json({ message: 'Invalid or unsupported table name' });
            }
            const format = String(req.query.format || 'csv').toLowerCase();
            const rows = await db.all(`SELECT * FROM [${tbl}]`);

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="edf-${tbl}-${new Date().toISOString().slice(0, 10)}.json"`);
                return res.send(JSON.stringify({ table: tbl, exported_at: new Date().toISOString(), count: rows.length, rows }, null, 2));
            }

            if (!rows.length) {
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="edf-${tbl}-${new Date().toISOString().slice(0, 10)}.csv"`);
                return res.send('\uFEFF');
            }

            const cols = Object.keys(rows[0]);
            const escCsv = (val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`;
            const csvLines = [
                cols.map(escCsv).join(','),
                ...rows.map(r => cols.map(c => escCsv(r[c])).join(','))
            ];
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="edf-${tbl}-${new Date().toISOString().slice(0, 10)}.csv"`);
            res.send('\uFEFF' + csvLines.join('\r\n'));
        } catch (err) {
            console.error('Table export error:', err);
            res.status(500).json({ message: 'Failed to export table: ' + err.message });
        }
    });

    // ── GET /api/backups/:id — inspect snapshot metadata & optional table sample ─
    router.get('/:id', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const idNum = parseInt(req.params.id, 10);
            if (!Number.isFinite(idNum)) return res.status(400).json({ message: 'Invalid snapshot ID' });

            const snap = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [idNum]);
            if (!snap) return res.status(404).json({ message: 'Backup snapshot not found' });

            const buf = await storageSvc.readBuffer(snapshotRelPath(snap.filename));
            if (!buf) {
                return res.status(404).json({ message: 'Backup archive file missing from storage' });
            }

            const parsed = JSON.parse(buf.toString('utf8'));
            const tablesObj = normalizeLegacyPayload(parsed);

            const tableSummaries = Object.entries(tablesObj).map(([table, rows]) => ({
                table,
                rows: Array.isArray(rows) ? rows.length : 0
            })).sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));

            const previewTable = req.query.table && ALL_VALID_TABLES.has(String(req.query.table))
                ? String(req.query.table)
                : (tableSummaries.find(t => t.rows > 0)?.table || tableSummaries[0]?.table || null);

            const previewLimit = Math.min(25, Math.max(1, parseInt(req.query.previewLimit, 10) || 8));
            const previewRows = previewTable && Array.isArray(tablesObj[previewTable])
                ? tablesObj[previewTable].slice(0, previewLimit)
                : [];

            res.json({
                snapshot: {
                    ...snap,
                    includes: JSON.parse(snap.includes_json || '[]'),
                    tableCounts: JSON.parse(snap.table_counts_json || '{}')
                },
                format: parsed.format || parsed.version || 'edf-backup-v2',
                tableSummaries,
                previewTable,
                previewRows
            });
        } catch (err) {
            console.error('Inspect snapshot error:', err);
            res.status(500).json({ message: 'Failed to inspect backup snapshot: ' + err.message });
        }
    });

    // ── GET /api/backups/:id/download — download snapshot JSON ───────────────
    router.get('/:id/download', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const snap = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [parseInt(req.params.id, 10)]);
            if (!snap) return res.status(404).json({ message: 'Backup snapshot not found' });

            const buf = await storageSvc.readBuffer(snapshotRelPath(snap.filename));
            if (!buf) {
                return res.status(404).json({ message: 'Backup archive file missing from storage' });
            }

            const slug = String(snap.name || 'edf-backup')
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/^-|-$/g, '') || 'edf-backup';
            const dlName = `${slug}-${snap.uid}.json`;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
            res.send(buf);
        } catch (err) {
            console.error('Download snapshot error:', err);
            res.status(500).json({ message: 'Failed to download backup' });
        }
    });

    // ── POST /api/backups — create new server backup snapshot ────────────────
    router.post('/', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const { name, notes, scope, modules, is_locked } = req.body || {};
            const cleanName = String(name || '').trim() || `EDF Backup — ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

            const snap = await createSnapshotInternal({
                name: cleanName,
                notes: notes || '',
                backupType: 'manual',
                scope: scope || (Array.isArray(modules) && modules.length ? 'custom' : 'full'),
                modules: Array.isArray(modules) && modules.length ? modules : null,
                isLocked: !!is_locked,
                createdBy: req.user?.username || 'admin'
            });

            await logActivity(req, 'create_backup', snap.id, `Created backup "${snap.name}" (${snap.total_rows} rows across ${snap.tables_count} tables)`);
            res.status(201).json({ message: 'Backup snapshot created successfully', snapshot: snap });
        } catch (err) {
            console.error('Create backup error:', err);
            res.status(500).json({ message: err.message || 'Failed to create backup snapshot' });
        }
    });

    // ── PUT /api/backups/:id — update snapshot metadata (name, notes, lock) ──
    router.put('/:id', authenticateToken, requireSettingsAccess, async (req, res) => {
        try {
            const idNum = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [idNum]);
            if (!existing) return res.status(404).json({ message: 'Backup snapshot not found' });

            const nextName = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
            if (!nextName) return res.status(400).json({ message: 'Snapshot name cannot be empty' });
            const nextNotes = req.body.notes !== undefined ? String(req.body.notes).trim() : (existing.notes || '');
            const nextLocked = req.body.is_locked !== undefined ? (req.body.is_locked ? 1 : 0) : existing.is_locked;

            await db.run(
                `UPDATE backup_snapshots SET name = ?, notes = ?, is_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [nextName, nextNotes, nextLocked, idNum]
            );

            // Sync updated name/notes into archive file envelope too if name or notes changed
            if (nextName !== existing.name || nextNotes !== (existing.notes || '')) {
                try {
                    const rel = snapshotRelPath(existing.filename);
                    const buf = await storageSvc.readBuffer(rel);
                    if (buf) {
                        const parsed = JSON.parse(buf.toString('utf8'));
                        parsed.name = nextName;
                        parsed.notes = nextNotes;
                        await storageSvc.saveBuffer(rel, Buffer.from(JSON.stringify(parsed, null, 2), 'utf8'), 'application/json; charset=utf-8');
                    }
                } catch (_) {}
            }

            const updated = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [idNum]);
            await logActivity(req, 'update_backup', idNum, `Updated snapshot "${nextName}" (locked=${nextLocked})`);
            res.json({ message: 'Snapshot metadata updated', snapshot: updated });
        } catch (err) {
            console.error('Update backup error:', err);
            res.status(500).json({ message: 'Failed to update backup snapshot' });
        }
    });

    // ── DELETE /api/backups/:id — delete snapshot (respects lock guard) ──────
    router.delete('/:id', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const idNum = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [idNum]);
            if (!existing) return res.status(404).json({ message: 'Backup snapshot not found' });

            if (existing.is_locked) {
                return res.status(409).json({
                    message: 'This snapshot is retention-locked. Unlock it first before deleting.'
                });
            }

            try {
                await storageSvc.deleteFile(snapshotRelPath(existing.filename));
            } catch (_) {}

            await db.run('DELETE FROM backup_snapshots WHERE id = ?', [idNum]);
            await logActivity(req, 'delete_backup', idNum, `Deleted snapshot "${existing.name}" (${existing.uid})`);
            res.json({ message: 'Backup snapshot deleted' });
        } catch (err) {
            console.error('Delete backup error:', err);
            res.status(500).json({ message: 'Failed to delete backup snapshot' });
        }
    });

    // ── POST /api/backups/upload — upload external .json backup to Vault ────
    router.post('/upload', authenticateToken, requireSettingsAccess, (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'File upload failed' });
            next();
        });
    }, async (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ message: 'Please attach a valid .json backup file' });
            }

            let rawParsed;
            try {
                rawParsed = JSON.parse(req.file.buffer.toString('utf8'));
            } catch (_) {
                return res.status(400).json({ message: 'Uploaded file is not valid JSON' });
            }

            const tablesData = normalizeLegacyPayload(rawParsed);
            const tableNames = Object.keys(tablesData);
            if (!tableNames.length) {
                return res.status(400).json({ message: 'No recognizable EDF tables found inside this JSON file' });
            }

            const tableCounts = {};
            let totalRows = 0;
            for (const tbl of tableNames) {
                tableCounts[tbl] = tablesData[tbl].length;
                totalRows += tablesData[tbl].length;
            }

            const matchedModules = BACKUP_MODULES
                .filter(m => m.tables.some(t => tableNames.includes(t)))
                .map(m => m.key);

            const uid = `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const baseName = path.basename(req.file.originalname || 'Imported Backup', '.json');
            const customName = String(req.body?.name || '').trim() || rawParsed.name || `Imported: ${baseName}`;
            const customNotes = String(req.body?.notes || '').trim() || rawParsed.notes || `Imported from ${req.file.originalname}`;

            const envelope = {
                format: 'edf-backup-v2',
                uid,
                name: customName,
                notes: customNotes,
                backup_type: 'imported',
                scope: matchedModules.length === BACKUP_MODULES.length ? 'full' : 'custom',
                modules: matchedModules,
                created_at: rawParsed.created_at || rawParsed.exported_at || new Date().toISOString(),
                created_by: req.user?.username || 'admin',
                tables_count: tableNames.length,
                total_rows: totalRows,
                counts: tableCounts,
                tables: tablesData
            };

            const jsonStr = JSON.stringify(envelope, null, 2);
            const checksum = crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
            const filename = `${uid}.json`;
            const saved = await storageSvc.saveBuffer(
                snapshotRelPath(filename),
                Buffer.from(jsonStr, 'utf8'),
                'application/json; charset=utf-8'
            );
            const fileSize = saved.size;

            const ins = await db.run(
                `INSERT INTO backup_snapshots (
                    uid, name, notes, backup_type, scope, filename, file_size, checksum,
                    tables_count, total_rows, table_counts_json, includes_json, is_locked, created_by
                ) VALUES (?, ?, ?, 'imported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uid,
                    customName,
                    customNotes,
                    envelope.scope,
                    filename,
                    fileSize,
                    checksum,
                    tableNames.length,
                    totalRows,
                    JSON.stringify(tableCounts),
                    JSON.stringify(matchedModules),
                    req.body?.is_locked ? 1 : 0,
                    req.user?.username || 'admin'
                ]
            );

            const snap = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [ins.lastID]);
            await logActivity(req, 'upload_backup', snap.id, `Imported backup "${customName}" (${totalRows} rows)`);
            res.status(201).json({ message: 'Backup imported into Vault successfully', snapshot: snap });
        } catch (err) {
            console.error('Upload backup error:', err);
            res.status(500).json({ message: 'Failed to import backup: ' + err.message });
        }
    });

    // ── POST /api/backups/:id/restore — full or selective restore from snapshot ─
    router.post('/:id/restore', authenticateToken, requireStrictAdmin, async (req, res) => {
        const idNum = parseInt(req.params.id, 10);
        const {
            modules = 'all',
            mode = 'replace',
            create_safety_backup = true,
            confirm_phrase = ''
        } = req.body || {};

        if (mode === 'replace' && confirm_phrase !== 'RESTORE BACKUP') {
            return res.status(400).json({ message: 'Type "RESTORE BACKUP" to confirm full replacement restore' });
        }

        try {
            const snap = await db.get('SELECT * FROM backup_snapshots WHERE id = ?', [idNum]);
            if (!snap) return res.status(404).json({ message: 'Backup snapshot not found' });

            const buf = await storageSvc.readBuffer(snapshotRelPath(snap.filename));
            if (!buf) {
                return res.status(404).json({ message: 'Backup archive file missing from storage' });
            }

            const parsed = JSON.parse(buf.toString('utf8'));
            const tablesObj = normalizeLegacyPayload(parsed);
            const liveTables = await existingTableSet();

            // Determine requested tables in FK topological order
            let allowedTables;
            if (modules === 'all' || !Array.isArray(modules) || modules.length === 0) {
                allowedTables = GLOBAL_RESTORE_ORDER.filter(t => Object.prototype.hasOwnProperty.call(tablesObj, t) && liveTables.has(t));
            } else {
                const modSet = new Set();
                for (const mKey of modules) {
                    const mod = MODULE_MAP.get(mKey);
                    if (mod) mod.tables.forEach(t => modSet.add(t));
                }
                allowedTables = GLOBAL_RESTORE_ORDER.filter(t => modSet.has(t) && Object.prototype.hasOwnProperty.call(tablesObj, t) && liveTables.has(t));
            }

            if (allowedTables.length === 0) {
                return res.status(400).json({ message: 'No matching tables selected or found inside snapshot' });
            }

            // Safety auto-backup before overwriting live data
            let safetySnapshot = null;
            if (create_safety_backup) {
                safetySnapshot = await createSnapshotInternal({
                    name: `Pre-Restore Auto Safety (${snap.name.slice(0, 32)})`,
                    notes: `Automatic snapshot captured immediately before restoring from ${snap.uid}`,
                    backupType: 'pre_restore',
                    scope: 'full',
                    createdBy: req.user?.username || 'admin'
                });
            }

            const tableColsMap = {};
            await runConcurrent(allowedTables, 6, async (tbl) => {
                const colsInfo = await db.all(`PRAGMA table_info([${tbl}])`);
                tableColsMap[tbl] = colsInfo.map(c => c.name);
            });
            const hasSeq = await hasSequenceTable();

            const restoredCounts = {};
            let totalInserted = 0;

            if (!db.isRemote) {
                await db.run('PRAGMA foreign_keys = OFF');
            }
            try {
                await db.withTransaction(async (tx) => {
                    // In replace mode, clear target tables cleanly in reverse order first
                    if (mode === 'replace') {
                        await wipeTablesInTx(tx, [...allowedTables].reverse(), false, hasSeq);
                    }

                    // Insert restored rows using schema column intersection and batched writes
                    for (const tbl of allowedTables) {
                        const rows = tablesObj[tbl];
                        if (!Array.isArray(rows) || rows.length === 0) {
                            restoredCounts[tbl] = 0;
                            continue;
                        }
                        const validCols = tableColsMap[tbl] || [];
                        const verb = mode === 'merge' ? 'INSERT OR IGNORE' : 'INSERT OR REPLACE';
                        const stmts = [];

                        for (const row of rows) {
                            if (!row || typeof row !== 'object') continue;
                            const rowCols = validCols.filter(c => Object.prototype.hasOwnProperty.call(row, c));
                            if (!rowCols.length) continue;
                            const colSql = rowCols.map(c => `[${c}]`).join(', ');
                            const phSql = rowCols.map(() => '?').join(', ');
                            const vals = rowCols.map(c => row[c]);
                            stmts.push({
                                sql: `${verb} INTO [${tbl}] (${colSql}) VALUES (${phSql})`,
                                args: vals
                            });
                        }

                        let insertedForTable = 0;
                        if (stmts.length > 0) {
                            const batchResults = await tx.batch(stmts);
                            for (const r of batchResults) {
                                const c = r?.changes ?? r?.rowsAffected ?? 0;
                                if (c || mode === 'replace') {
                                    insertedForTable += Number(c || 0);
                                }
                            }
                        }

                        // Keep sqlite_sequence synced with MAX(id)
                        if (hasSeq && validCols.includes('id')) {
                            const maxRow = await tx.get(`SELECT MAX(id) AS m FROM [${tbl}]`);
                            if (maxRow && maxRow.m) {
                                await tx.run('DELETE FROM sqlite_sequence WHERE name = ?', [tbl]).catch(() => {});
                                await tx.run('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)', [tbl, maxRow.m]).catch(() => {});
                            }
                        }

                        restoredCounts[tbl] = insertedForTable;
                        totalInserted += insertedForTable;
                    }
                });
            } finally {
                if (!db.isRemote) {
                    await db.run('PRAGMA foreign_keys = ON').catch(() => {});
                }
            }

            await logActivity(req, 'restore_backup', snap.id, `Restored ${totalInserted} rows (${mode}) from "${snap.name}"`);
            res.json({
                message: `Restore complete (${mode} mode). ${totalInserted.toLocaleString()} records restored across ${allowedTables.length} table(s).`,
                restoredCounts,
                totalRestored: totalInserted,
                safetySnapshotId: safetySnapshot?.id || null
            });
        } catch (err) {
            console.error('Restore snapshot error:', err);
            res.status(500).json({ message: 'Failed to restore backup: ' + err.message });
        }
    });

    // ── POST /api/backups/purge-module/:moduleKey — purge single module cleanly ─
    router.post('/purge-module/:moduleKey', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const mod = MODULE_MAP.get(String(req.params.moduleKey || ''));
            if (!mod) return res.status(404).json({ message: 'Module not found' });
            if (!mod.purgeable) {
                return res.status(400).json({ message: `${mod.label} cannot be bulk-purged here for system safety.` });
            }

            const { confirm_phrase, create_safety_backup = true } = req.body || {};
            if (confirm_phrase !== 'CLEAR MODULE') {
                return res.status(400).json({ message: 'Confirmation phrase "CLEAR MODULE" is required' });
            }

            const liveTables = await existingTableSet();
            const targetTables = [...mod.tables].reverse().filter(t => liveTables.has(t));

            let safetySnapshot = null;
            if (create_safety_backup) {
                safetySnapshot = await createSnapshotInternal({
                    name: `Pre-Purge (${mod.label})`,
                    notes: `Safety backup taken before clearing module: ${mod.label}`,
                    backupType: 'pre_clean',
                    scope: 'custom',
                    modules: [mod.key],
                    createdBy: req.user?.username || 'admin'
                });
            }

            const hasSeq = await hasSequenceTable();
            let counts = {};
            if (!db.isRemote) {
                await db.run('PRAGMA foreign_keys = OFF');
            }
            try {
                await db.withTransaction(async (tx) => {
                    counts = await wipeTablesInTx(tx, targetTables, true, hasSeq);
                });
            } finally {
                if (!db.isRemote) {
                    await db.run('PRAGMA foreign_keys = ON').catch(() => {});
                }
            }
            const removed = Object.values(counts).reduce((s, c) => s + Number(c || 0), 0);

            await logActivity(req, 'purge_module', mod.key, `Cleared module ${mod.label} (${removed} rows removed)`);
            res.json({
                message: `${mod.label} cleared: ${removed.toLocaleString()} record(s) removed.`,
                counts,
                totalRemoved: removed,
                safetySnapshotId: safetySnapshot?.id || null
            });
        } catch (err) {
            console.error('Purge module error:', err);
            res.status(500).json({ message: 'Failed to clear module: ' + err.message });
        }
    });

    // ── POST /api/backups/clean-start — Full Factory Clean Start across EDF ──
    router.post('/clean-start', authenticateToken, requireStrictAdmin, async (req, res) => {
        const {
            confirm_phrase = '',
            include_operational = true,
            include_documents = true,
            include_logs = true,
            include_sms_config = false,
            include_cms = false,
            include_non_admin_users = false,
            create_safety_backup = true
        } = req.body || {};

        if (confirm_phrase !== 'CLEAR ALL DATA') {
            return res.status(400).json({ message: 'Invalid confirmation phrase. Type CLEAR ALL DATA to proceed.' });
        }

        try {
            const liveTables = await existingTableSet();
            const toWipe = [];

            if (include_operational) {
                OPERATIONAL_CLEAN_TABLES.forEach(t => {
                    if (liveTables.has(t) && !toWipe.includes(t)) toWipe.push(t);
                });
            }
            if (include_documents && liveTables.has('documents') && !toWipe.includes('documents')) {
                toWipe.push('documents');
            }
            if (include_logs) {
                ['system_logs', 'login_events'].forEach(t => {
                    if (liveTables.has(t) && !toWipe.includes(t)) toWipe.push(t);
                });
            }
            if (include_sms_config) {
                ['sms_gateways', 'sms_templates'].forEach(t => {
                    if (liveTables.has(t) && !toWipe.includes(t)) toWipe.push(t);
                });
            }
            if (include_cms) {
                ['gallery_images', 'site_content'].forEach(t => {
                    if (liveTables.has(t) && !toWipe.includes(t)) toWipe.push(t);
                });
            }

            let safetySnapshot = null;
            if (create_safety_backup) {
                safetySnapshot = await createSnapshotInternal({
                    name: `Pre-Clean Start Auto Snapshot (${new Date().toLocaleDateString('en-GB')})`,
                    notes: 'Full automatic safety snapshot created right before Clean Start data reset',
                    backupType: 'pre_clean',
                    scope: 'full',
                    createdBy: req.user?.username || 'admin'
                });
            }

            const hasSeq = await hasSequenceTable();
            let counts = {};
            if (!db.isRemote) {
                await db.run('PRAGMA foreign_keys = OFF');
            }
            try {
                await db.withTransaction(async (tx) => {
                    counts = await wipeTablesInTx(tx, toWipe, true, hasSeq);

                    if (include_non_admin_users && liveTables.has('users')) {
                        const currentAdminId = Number(req.user?.id || 1);
                        const nonAdmins = await tx.all(
                            "SELECT id FROM users WHERE id != ? AND role != 'admin'",
                            [currentAdminId]
                        );
                        if (nonAdmins.length > 0) {
                            const ids = nonAdmins.map(u => u.id);
                            const ph = ids.map(() => '?').join(',');
                            await tx.run(`DELETE FROM user_permissions WHERE user_id IN (${ph})`, ids).catch(() => {});
                            await tx.run(`DELETE FROM users WHERE id IN (${ph})`, ids);
                            counts.non_admin_users = nonAdmins.length;
                        }
                    }

                    // Keep seed guard active so server restarts never re-inject demo Madrasa rows
                    await tx.run(
                        `INSERT INTO global_settings (key, value) VALUES ('madrasa_seeded', '1')
                         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = CURRENT_TIMESTAMP`
                    );
                });
            } finally {
                if (!db.isRemote) {
                    await db.run('PRAGMA foreign_keys = ON').catch(() => {});
                }
            }

            if (!db.isRemote) {
                await db.run('VACUUM').catch(() => {});
            }

            const totalRemoved = Object.values(counts).reduce((s, c) => s + Number(c || 0), 0);
            res.json({
                message: `Clean Start complete! ${totalRemoved.toLocaleString()} record(s) removed and sequences reset to 0.`,
                counts,
                total: totalRemoved,
                safetySnapshot: safetySnapshot ? { id: safetySnapshot.id, uid: safetySnapshot.uid, name: safetySnapshot.name } : null
            });
        } catch (err) {
            console.error('Clean start error:', err);
            res.status(500).json({ message: 'Failed to run Clean Start: ' + err.message });
        }
    });

    // ── POST /api/backups/maintenance — DB Integrity Check & VACUUM ──────────
    router.post('/maintenance', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const action = String(req.body?.action || 'both').toLowerCase();
            const getSizeNow = async () => {
                if (db.isRemote) {
                    const pc = await db.get('PRAGMA page_count').catch(() => null);
                    const ps = await db.get('PRAGMA page_size').catch(() => null);
                    return Number(pc?.page_count || 0) * Number(ps?.page_size || 0);
                }
                return getFileSizeSafe(DB_PATH);
            };
            const sizeBefore = await getSizeNow();

            let integrity = 'skipped';
            if (action === 'integrity' || action === 'both') {
                const chk = await db.get('PRAGMA integrity_check').catch(() => ({ integrity_check: db.isRemote ? 'ok (managed)' : 'unknown' }));
                integrity = chk?.integrity_check || 'ok';
            }

            let vacuumNote = '';
            if (action === 'vacuum' || action === 'both') {
                if (db.isRemote) {
                    vacuumNote = ' (Turso Cloud manages storage compaction automatically)';
                } else {
                    await db.run('VACUUM');
                }
            }

            const sizeAfter = await getSizeNow();
            const reclaimed = Math.max(0, sizeBefore - sizeAfter);

            await logActivity(req, 'db_maintenance', action, `Integrity=${integrity}, before=${sizeBefore}, after=${sizeAfter}`);
            res.json({
                message: `Database maintenance completed (Integrity: ${integrity})${vacuumNote}`,
                integrity,
                sizeBefore,
                sizeAfter,
                reclaimedBytes: reclaimed
            });
        } catch (err) {
            console.error('Maintenance error:', err);
            res.status(500).json({ message: 'Maintenance failed: ' + err.message });
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // SUPABASE + LOCAL SQLITE3 HYBRID DUAL-DATABASE SYNC ROUTES
    // ══════════════════════════════════════════════════════════════════════════

    // GET /api/backups/supabase/status — Live online/offline engine & outbox status
    router.get('/supabase/status', authenticateToken, async (req, res) => {
        try {
            const force = req.query.ping === '1' || req.query.ping === 'true';
            const status = await supabaseSync.getSyncStatus(force);
            res.json(status);
        } catch (err) {
            console.error('Supabase status error:', err);
            res.status(500).json({ message: 'Failed to read Supabase sync status: ' + err.message });
        }
    });

    // POST /api/backups/supabase/config — Save Supabase PostgreSQL URL & Auto-Sync setting
    router.post('/supabase/config', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const { supabaseDbUrl, autoSync } = req.body || {};
            const status = await supabaseSync.saveConfig({ supabaseDbUrl, autoSync });
            await logActivity(req, 'supabase_config_updated', 'supabase', `configured=${status.configured}, online=${status.online}, autoSync=${status.autoSync}`);
            res.json({
                message: status.online
                    ? `Connected to Supabase (${status.latencyMs}ms) — Hybrid Dual-Database mode active!`
                    : (status.configured
                        ? 'Supabase URL saved (currently offline — using local SQLite3 with outbox queue).'
                        : 'Switched to Local SQLite3 only mode.'),
                status
            });
        } catch (err) {
            console.error('Supabase config error:', err);
            res.status(500).json({ message: 'Failed to save Supabase config: ' + err.message });
        }
    });

    // POST /api/backups/supabase/test — Test connection to a candidate or saved Supabase URL
    router.post('/supabase/test', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const candidateUrl = req.body?.supabaseDbUrl;
            const check = await supabaseSync.checkConnectivity(candidateUrl);
            res.json({
                online: check.online,
                latencyMs: check.latencyMs,
                databaseName: check.databaseName || null,
                error: check.lastError || null,
                message: check.online
                    ? `Supabase PostgreSQL reachable (${check.latencyMs}ms)`
                    : (check.lastError || 'Could not connect to Supabase')
            });
        } catch (err) {
            res.status(500).json({ online: false, message: err.message });
        }
    });

    // POST /api/backups/supabase/sync — Push (SQLite->Supabase), Pull (Supabase->SQLite), or Bidirectional Merge
    router.post('/supabase/sync', authenticateToken, requireStrictAdmin, async (req, res) => {
        try {
            const mode = ['push', 'pull', 'bidirectional'].includes(req.body?.mode)
                ? req.body.mode
                : 'bidirectional';

            if (mode === 'pull') {
                // Take automatic local safety snapshot before pulling cloud data over local SQLite
                await createSnapshotInternal({
                    label: 'Pre-Supabase Pull Safety Backup',
                    notes: 'Automatic local SQLite snapshot before pulling cloud records from Supabase.',
                    type: 'pre_restore',
                    createdBy: req.user?.username || 'admin'
                }).catch(() => {});
            }

            const summary = await supabaseSync.runFullSync(mode);
            const status = await supabaseSync.getSyncStatus(false);

            await logActivity(
                req,
                'supabase_sync',
                mode,
                `Tables=${summary.tablesSynced}, Pushed=${summary.rowsPushed}, Pulled=${summary.rowsPulled}, Duration=${summary.durationMs}ms`
            );

            res.json({
                message: mode === 'push'
                    ? `Synced ${summary.rowsPushed.toLocaleString()} records across ${summary.tablesSynced} tables to Supabase Cloud (${summary.durationMs}ms)`
                    : mode === 'pull'
                        ? `Pulled ${summary.rowsPulled.toLocaleString()} records from Supabase Cloud into local SQLite3 (${summary.durationMs}ms)`
                        : `Bidirectional sync complete — Pushed ${summary.rowsPushed.toLocaleString()} & Merged ${summary.rowsPulled.toLocaleString()} records (${summary.durationMs}ms)`,
                summary,
                status
            });
        } catch (err) {
            console.error('Supabase sync error:', err);
            res.status(500).json({ message: 'Supabase sync failed: ' + err.message });
        }
    });

    return {
        router,
        OPERATIONAL_CLEAN_TABLES,
        BACKUP_MODULES,
        createSnapshotInternal
    };
};

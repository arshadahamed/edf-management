const path = require('path');
const bcrypt = require('bcryptjs');
const supabaseSync = require('../services/supabaseSync');

const SCHEMA_VERSION = '2026-11-14-turso-v1';

let cachedDbPromise = null;
let cachedDbKey = null;

function normalizeBindValue(val) {
    if (val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'bigint') return Number(val);
    return val;
}

function normalizeSqlArgs(args) {
    if (!args || args.length === 0) return [];
    let raw = args;
    if (args.length === 1) {
        const first = args[0];
        if (first === undefined || first === null) return [];
        if (Array.isArray(first)) {
            raw = first;
        } else if (typeof first === 'object' && !(first instanceof Date) && !Buffer.isBuffer(first)) {
            const named = {};
            for (const [k, v] of Object.entries(first)) {
                named[k] = normalizeBindValue(v);
            }
            return named;
        } else {
            raw = [first];
        }
    }
    return raw.map(normalizeBindValue);
}

function toPlainRow(columns, row) {
    if (!row) return undefined;
    const out = {};
    if (Array.isArray(columns) && columns.length > 0) {
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const val = row[col] !== undefined ? row[col] : row[i];
            out[col] = typeof val === 'bigint' ? Number(val) : val;
        }
        return out;
    }
    for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
}

function normalizeBatchStatements(statements) {
    return (statements || []).map((item) => {
        if (typeof item === 'string') return { sql: item, args: [] };
        const rawArgs = item.args ?? item.params ?? [];
        const args = Array.isArray(rawArgs) ? rawArgs.map(normalizeBindValue) : normalizeSqlArgs([rawArgs]);
        return { sql: item.sql, args };
    });
}

function createTursoExecutor(target, isTx = false) {
    return {
        isRemote: true,
        engine: 'turso',
        async get(sql, ...params) {
            const rs = await target.execute({ sql, args: normalizeSqlArgs(params) });
            return rs.rows && rs.rows.length > 0 ? toPlainRow(rs.columns, rs.rows[0]) : undefined;
        },
        async all(sql, ...params) {
            const rs = await target.execute({ sql, args: normalizeSqlArgs(params) });
            if (!rs.rows || rs.rows.length === 0) return [];
            return rs.rows.map((r) => toPlainRow(rs.columns, r));
        },
        async run(sql, ...params) {
            const rs = await target.execute({ sql, args: normalizeSqlArgs(params) });
            const lastID = rs.lastInsertRowid !== undefined && rs.lastInsertRowid !== null
                ? Number(rs.lastInsertRowid)
                : 0;
            const changes = rs.rowsAffected !== undefined && rs.rowsAffected !== null
                ? Number(rs.rowsAffected)
                : 0;
            return { lastID, changes };
        },
        async exec(sql) {
            if (!sql || !String(sql).trim()) return;
            await target.executeMultiple(String(sql));
        },
        async batch(statements, chunkSize = 80) {
            const normalized = normalizeBatchStatements(statements);
            if (!normalized.length) return [];
            const results = [];
            for (let i = 0; i < normalized.length; i += chunkSize) {
                const chunk = normalized.slice(i, i + chunkSize);
                const chunkRes = isTx
                    ? await target.batch(chunk)
                    : await target.batch(chunk, 'write');
                results.push(...chunkRes);
            }
            return results;
        }
    };
}

function wrapTursoClient(client) {
    const base = createTursoExecutor(client, false);
    base.rawClient = client;
    base.close = () => client.close();
    base.withTransaction = async (fn) => {
        const tx = await client.transaction('write');
        const txExec = createTursoExecutor(tx, true);
        try {
            const result = await fn(txExec);
            await tx.commit();
            return result;
        } catch (err) {
            try { await tx.rollback(); } catch (_) {}
            throw err;
        } finally {
            try { tx.close(); } catch (_) {}
        }
    };
    return base;
}

function wrapSqliteDb(rawDb) {
    let txQueue = Promise.resolve();

    function makeExec(target) {
        return {
            isRemote: false,
            engine: 'sqlite',
            get: (sql, ...params) => target.get(sql, ...params),
            all: (sql, ...params) => target.all(sql, ...params),
            async run(sql, ...params) {
                let skipSync = false;
                if (params.length > 0) {
                    const last = params[params.length - 1];
                    if (last && typeof last === 'object' && !Array.isArray(last) && last._skipSyncHook === true) {
                        skipSync = true;
                        params = params.slice(0, -1);
                    }
                }
                const res = await target.run(sql, ...params);
                if (!skipSync) {
                    supabaseSync.onLocalWrite(sql, params).catch(() => {});
                }
                return res;
            },
            exec: (sql) => target.exec(sql),
            async batch(statements) {
                const normalized = normalizeBatchStatements(statements);
                const results = [];
                for (const st of normalized) {
                    const r = await target.run(st.sql, st.args);
                    supabaseSync.onLocalWrite(st.sql, st.args).catch(() => {});
                    results.push(r);
                }
                return results;
            }
        };
    }

    const wrapped = makeExec(rawDb);
    wrapped.rawClient = rawDb;
    wrapped.close = () => rawDb.close();
    wrapped.withTransaction = (fn) => {
        const runTx = async () => {
            await rawDb.run('BEGIN IMMEDIATE');
            try {
                const result = await fn(wrapped);
                await rawDb.run('COMMIT');
                return result;
            } catch (err) {
                try { await rawDb.run('ROLLBACK'); } catch (_) {}
                throw err;
            }
        };
        const next = txQueue.then(runTx, runTx);
        txQueue = next.catch(() => {});
        return next;
    };
    return wrapped;
}

/**
 * Adds missing columns to an existing table by inspecting PRAGMA table_info once per table.
 */
async function ensureColumns(db, tableName, colDefs) {
    const cols = await db.all(`PRAGMA table_info(${tableName})`);
    const existing = new Set(cols.map((c) => c.name));
    for (const [col, def] of colDefs) {
        if (!existing.has(col)) {
            await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${def}`);
            existing.add(col);
        }
    }
}

async function openConnection() {
    const tursoUrl = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim();
    if (tursoUrl) {
        const { createClient } = require('@libsql/client/web');
        const client = createClient({
            url: tursoUrl,
            authToken: process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : undefined,
            intMode: 'number'
        });
        return wrapTursoClient(client);
    }

    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const rawDb = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });
    await rawDb.run('PRAGMA foreign_keys = ON');
    return wrapSqliteDb(rawDb);
}

async function initDb() {
    const dbKey = (process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.trim())
        || path.join(__dirname, 'database.sqlite');
    if (cachedDbPromise && cachedDbKey === dbKey) {
        return cachedDbPromise;
    }

    cachedDbKey = dbKey;
    cachedDbPromise = _initDbInternal().catch((err) => {
        cachedDbPromise = null;
        throw err;
    });
    return cachedDbPromise;
}

function resetDbCache() {
    cachedDbPromise = null;
    cachedDbKey = null;
}

async function _initDbInternal() {
    const db = await openConnection();

    // Fast path for warm/cold serverless restarts after initial schema setup
    let schemaAlreadyCurrent = false;
    try {
        const verRow = await db.get("SELECT value FROM global_settings WHERE key = 'edf_schema_version'");
        if (verRow && verRow.value === SCHEMA_VERSION) {
            schemaAlreadyCurrent = true;
        }
    } catch (_) {
        // Fresh database before global_settings exists
    }
    db.schemaAlreadyCurrent = schemaAlreadyCurrent;
    if (schemaAlreadyCurrent) {
        if (!db.isRemote) {
            await supabaseSync.attachHybridSync(db);
        }
        return db;
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            full_name TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            address TEXT,
            city TEXT,
            gender TEXT, -- 'male', 'female'
            age INTEGER,
            monthly_income REAL DEFAULT 0,
            join_date DATE DEFAULT CURRENT_DATE,
            nic_number TEXT UNIQUE,
            marital_status TEXT, -- 'married', 'unmarried', 'other'
            bank_name TEXT,
            bank_branch TEXT,
            account_number TEXT,
            previous_balance REAL DEFAULT 0,
            blood_group TEXT,
            occupation TEXT,
            sibling_id INTEGER, -- Link to another member id
            member_type TEXT DEFAULT 'executive', -- 'founder', 'executive'
            monthly_subscription REAL DEFAULT 0,
            status TEXT DEFAULT 'active', -- 'active', 'deactivate'
            photo_url TEXT,
            membership_no TEXT,
            dob DATE,
            whatsapp TEXT,
            designation TEXT,
            account_holder_name TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sibling_id) REFERENCES members(id)
        );

        CREATE TABLE IF NOT EXISTS member_relatives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            full_name TEXT NOT NULL,
            relationship TEXT NOT NULL, -- 'wife', 'son', 'daughter'
            gender TEXT,
            age INTEGER,
            nic_number TEXT,
            occupation TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER,
            amount REAL NOT NULL,
            paid_amount REAL,          -- Actual total paid so far (supports partial)
            month TEXT NOT NULL,       -- Format 'YYYY-MM'
            payment_method TEXT DEFAULT 'cash', -- 'cash','cheque','bank_transfer','online','other'
            notes TEXT,
            is_advance INTEGER DEFAULT 0, -- 1 = advance payment
            reference_number TEXT,
            bank_name TEXT,
            bank_code TEXT,
            cheque_date DATE,
            cheque_image TEXT,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id)
        );

        CREATE TABLE IF NOT EXISTS subscription_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT DEFAULT 'cash',
            reference_number TEXT,    -- Cheque no / transaction ref
            bank_name TEXT,
            bank_code TEXT,
            cheque_date DATE,
            cheque_image TEXT,
            notes TEXT,
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS families (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            head_name TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            member_count INTEGER,
            poverty_level TEXT, -- 'low', 'medium', 'high'
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS family_donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id INTEGER,
            amount REAL NOT NULL,
            donation_type TEXT, -- 'cash', 'dry_ration', 'zakat'
            description TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (family_id) REFERENCES families(id)
        );

        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT, -- 'quran', 'skills', 'bayan'
            target_audience TEXT, -- 'men', 'women', 'children'
            description TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER,
            batch_name TEXT NOT NULL,
            start_date DATE,
            end_date DATE,
            instructor_name TEXT,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (course_id) REFERENCES courses(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'income', 'expense'
            category TEXT NOT NULL, -- 'subscription', 'donation', 'program_cost', 'operational', 'welfare'
            amount REAL NOT NULL,
            description TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            reference_id INTEGER -- Could link to subscription_id or family_donation_id
        );

        CREATE TABLE IF NOT EXISTS external_donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_name TEXT NOT NULL,
            donor_phone TEXT,
            amount REAL NOT NULL,
            donation_type TEXT NOT NULL, -- 'zakat', 'sadaqah', 'fitrana', 'lillah', 'other'
            payment_method TEXT, -- 'cash', 'bank', 'online'
            description TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS volunteers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            skills TEXT, -- 'teaching', 'distribution', 'admin', 'events'
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS beneficiaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_number TEXT UNIQUE,
            male_head_name TEXT,
            male_head_gender TEXT,
            male_head_age INTEGER,
            male_head_dob DATE,
            male_head_occupation TEXT,
            male_head_address TEXT,
            category TEXT,
            monthly_income REAL,
            contact_number TEXT,
            home_town TEXT,
            nic_number TEXT UNIQUE,
            living_home_details TEXT, -- own house, rent house, joint Family
            vehicles_in_use TEXT, -- comma separated list
            male_head_special_qualifications TEXT,
            female_head_name TEXT,
            female_head_dob DATE,
            female_head_occupation TEXT,
            female_head_address TEXT,
            female_head_home_town TEXT,
            female_head_nic TEXT,
            female_head_special_qualifications TEXT,
            children_count_male INTEGER DEFAULT 0,
            children_count_female INTEGER DEFAULT 0,
            children_total_count INTEGER DEFAULT 0,
            abroad_details TEXT, -- house or wife or children
            family_status TEXT, -- Divorced, widow, sicker
            guardian_if_divorced TEXT, -- Husband, wife
            special_needs TEXT,
            parents_live_with_head TEXT, -- yes/no
            special_needs_at_home TEXT, -- yes/no
            children_seeking_job TEXT, -- yes/no
            children_seeking_job_details TEXT,
            children_marriageable_age TEXT, -- yes/no
            children_marriageable_age_details TEXT,
            children_drugs TEXT, -- yes/no
            family_problems TEXT, -- yes/no
            applied_before TEXT, -- yes/no
            received_assistance_before TEXT, -- yes/no
            assistance_details TEXT, -- dry ration or other
            status TEXT DEFAULT 'pending', -- Active, pending, deactivate, rejected
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS beneficiary_children_study (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER,
            name TEXT,
            dob DATE,
            grade TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_children_dropout (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER,
            name TEXT,
            dob DATE,
            grade TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_children_university (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER,
            name TEXT,
            university_name TEXT,
            year TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_children_abroad (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER,
            name TEXT,
            dob DATE,
            gender TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_children_other (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER,
            name TEXT,
            dob DATE,
            gender TEXT,
            category TEXT,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS form_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            structure TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS user_permissions (
            user_id INTEGER NOT NULL,
            permission TEXT NOT NULL,
            PRIMARY KEY (user_id, permission),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS global_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS login_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER,
            username    TEXT NOT NULL,
            full_name   TEXT,
            role        TEXT,
            event_type  TEXT NOT NULL,   -- 'login' | 'logout' | 'force_logout'
            ip_address  TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS gallery_images (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            filename     TEXT NOT NULL,
            original_name TEXT,
            caption      TEXT,
            detail       TEXT,
            category     TEXT DEFAULT 'community',
            display_year TEXT,
            sort_order   INTEGER DEFAULT 0,
            is_active    INTEGER DEFAULT 1,
            uploaded_by  INTEGER REFERENCES users(id),
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS site_content (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            page         TEXT NOT NULL,
            content_key  TEXT NOT NULL,
            content_value TEXT,
            updated_by   INTEGER REFERENCES users(id),
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(page, content_key)
        );

        CREATE TABLE IF NOT EXISTS timeline_items (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            year         TEXT NOT NULL,
            label        TEXT,
            title        TEXT NOT NULL,
            description  TEXT,
            sort_order   INTEGER DEFAULT 0,
            is_active    INTEGER DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS team_members (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL,
            role         TEXT,
            bio          TEXT,
            avatar_color TEXT DEFAULT '#0A5C3E',
            avatar_letter TEXT DEFAULT 'A',
            sort_order   INTEGER DEFAULT 0,
            is_active    INTEGER DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS site_partners (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT NOT NULL,
            sort_order   INTEGER DEFAULT 0,
            is_active    INTEGER DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS origin_paragraphs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            type         TEXT DEFAULT 'text',
            content      TEXT NOT NULL,
            attribution  TEXT,
            sort_order   INTEGER DEFAULT 0,
            is_active    INTEGER DEFAULT 1,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS documents (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            original_name TEXT NOT NULL,
            filename      TEXT NOT NULL,
            category      TEXT DEFAULT 'other',
            description   TEXT DEFAULT '',
            file_size     INTEGER DEFAULT 0,
            mime_type     TEXT,
            uploaded_by   INTEGER REFERENCES users(id),
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Column migrations are applied cleanly after all tables are created.

    // Ramadan distributions and tokens tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS ramadan_distributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            title TEXT NOT NULL,
            collection_date DATE,
            collection_location TEXT,
            voucher_value REAL DEFAULT 0,
            notes TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ramadan_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distribution_id INTEGER NOT NULL,
            beneficiary_id INTEGER NOT NULL,
            token_number TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            collected_at DATETIME,
            collected_by INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (distribution_id) REFERENCES ramadan_distributions(id) ON DELETE CASCADE,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
            FOREIGN KEY (collected_by) REFERENCES users(id),
            UNIQUE(distribution_id, beneficiary_id)
        );
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            tracking_type TEXT,
            serial_number TEXT,
            quantity INTEGER DEFAULT 1,
            min_threshold INTEGER DEFAULT 0,
            status TEXT DEFAULT 'available',
            condition TEXT DEFAULT 'working',
            purchase_price REAL,
            current_value REAL,
            warranty_info TEXT,
            qr_code TEXT UNIQUE,
            book_author TEXT,
            book_language TEXT,
            book_subject TEXT,
            library_type TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            borrower_name TEXT,
            borrower_type TEXT,
            loan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expected_return_date DATETIME,
            return_date DATETIME,
            return_condition TEXT,
            notes TEXT,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id)
        );

        CREATE TABLE IF NOT EXISTS inventory_maintenance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            service_date DATETIME,
            description TEXT,
            cost REAL,
            next_service_date DATETIME,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id)
        );

        CREATE TABLE IF NOT EXISTS inventory_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            quantity_used INTEGER,
            department TEXT,
            usage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS beneficiary_helps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beneficiary_id INTEGER NOT NULL,
            help_category TEXT NOT NULL, -- 'money', 'equipment', 'home_reconstruction', 'building_repair', 'other'
            title TEXT NOT NULL,
            status TEXT DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
            priority TEXT DEFAULT 'normal', -- 'urgent', 'high', 'normal'
            amount REAL DEFAULT 0,
            quantity TEXT,
            item_or_scope TEXT,
            contractor_or_supplier TEXT,
            payment_method TEXT DEFAULT 'cash',
            reference_no TEXT,
            progress_pct INTEGER DEFAULT 0,
            help_date TEXT,
            completion_date TEXT,
            provided_by TEXT,
            description TEXT,
            sync_transaction INTEGER DEFAULT 0,
            transaction_id INTEGER,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS beneficiary_help_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            help_id INTEGER NOT NULL,
            beneficiary_id INTEGER NOT NULL,
            action_type TEXT NOT NULL, -- 'created', 'updated', 'status_change', 'field_visit', 'delivery', 'inspection', 'milestone', 'note'
            status_snapshot TEXT,
            progress_snapshot INTEGER,
            amount_snapshot REAL,
            note TEXT NOT NULL,
            logged_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (help_id) REFERENCES beneficiary_helps(id) ON DELETE CASCADE,
            FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_ben_helps_ben ON beneficiary_helps(beneficiary_id);
        CREATE INDEX IF NOT EXISTS idx_ben_helps_cat ON beneficiary_helps(help_category);
        CREATE INDEX IF NOT EXISTS idx_ben_helps_status ON beneficiary_helps(status);
        CREATE INDEX IF NOT EXISTS idx_ben_help_logs_help ON beneficiary_help_logs(help_id);
        CREATE INDEX IF NOT EXISTS idx_ben_help_logs_ben ON beneficiary_help_logs(beneficiary_id);
    `);

    // Seed default timeline items if table is empty
    const tlCount = await db.get('SELECT COUNT(*) as cnt FROM timeline_items');
    if (tlCount.cnt === 0) {
        const tlItems = [
            ['2018','Foundation','EDF is Established','Twelve founding members register the foundation. First scholarship awarded.',0],
            ['2019','Health','First Mobile Health Camp','Partnership with a medical college brings doctors to Galgamuwa. 340 patients treated.',1],
            ['2020','Resilience','COVID-19 Emergency Response','Emergency food distribution to 800 families during the pandemic.',2],
            ['2021','Livelihood','Vocational Training Centre Opened','Skills Centre begins offering tailoring, computing, and business courses.',3],
            ['2022','Growth','10,000 Lives Milestone','EDF reaches its ten-thousandth beneficiary.',4],
            ['2023','Systems','Digital Management Platform Launched','EDF launches its own digital platform for records and tracking.',5],
            ['2024','Now','Expanding the Vision','Three-year strategic plan targeting 25,000 direct beneficiaries.',6],
        ];
        for (const t of tlItems) {
            await db.run('INSERT INTO timeline_items (year,label,title,description,sort_order) VALUES (?,?,?,?,?)', t);
        }
    }

    // Seed default team members if table is empty
    const tmCount = await db.get('SELECT COUNT(*) as cnt FROM team_members');
    if (tmCount.cnt === 0) {
        const tmItems = [
            ['Mohamed Farouq','Founding Chairman','Every programme we started came from a conversation with a family we failed to help in time.','#0A5C3E','M',0],
            ['Asmath Nizar','Executive Director','Accountability is how we honour the trust of every donor and every family we serve.','#0C1A34','A',1],
            ['Fathima Haseena','Head of Education','I was one of the first scholarship students. Now I design the scholarship programme.','#C21833','F',2],
        ];
        for (const t of tmItems) {
            await db.run('INSERT INTO team_members (name,role,bio,avatar_color,avatar_letter,sort_order) VALUES (?,?,?,?,?,?)', t);
        }
    }

    // Seed default partners if table is empty
    const ptCount = await db.get('SELECT COUNT(*) as cnt FROM site_partners');
    if (ptCount.cnt === 0) {
        const partners = ['UNHCR Sri Lanka','Ministry of Education','Islamic Relief','UNICEF','World Food Programme','Sri Lanka Red Cross','Zakat Foundation','Local Government — Galgamuwa'];
        for (let i = 0; i < partners.length; i++) {
            await db.run('INSERT INTO site_partners (name,sort_order) VALUES (?,?)', [partners[i], i]);
        }
    }

    // Seed origin paragraphs if table is empty
    const opCount = await db.get('SELECT COUNT(*) as cnt FROM origin_paragraphs');
    if (opCount.cnt === 0) {
        const items = [
            { type: 'text', content: 'It began with a single conversation under a mango tree at the edge of Galgamuwa town. A handful of community elders, a few young professionals who had returned from Colombo, and one shared conviction: that the children of this district deserved more.', attribution: null, sort_order: 0 },
            { type: 'text', content: 'The Education & Development Foundation was Founded in January 2016 with a modest treasury donated by its twelve founding members.', attribution: null, sort_order: 1 },
            { type: 'quote', content: 'We did not set out to build an institution. We set out to solve a single injustice — and discovered that one injustice was connected to a thousand others.', attribution: '— Founding Chairman, EDF Galgamuwa', sort_order: 2 },
            { type: 'text', content: 'Today, EDF operates across four pillars — education, health, livelihood, and community — with over 50+ active volunteers and a full-time coordination team with the support of 240+ donors and partners. An institution trusted by families across the North Western Province.', attribution: null, sort_order: 3 },
            { type: 'text', content: 'Every programme we run begins with listening. Every rupee we spend is accounted for. Every family we serve is treated with dignity, not charity.', attribution: null, sort_order: 4 },
        ];
        for (const item of items) {
            await db.run('INSERT INTO origin_paragraphs (type,content,attribution,sort_order) VALUES (?,?,?,?)', [item.type, item.content, item.attribution, item.sort_order]);
        }
    }

    // Seed default global settings
    await db.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('maintenance_mode', '0')`);

    // Create a default admin user if it doesn't exist
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin@123', 10);
        await db.run(
            'INSERT INTO users (username, email, password, role, full_name) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@example.org', hashedPassword, 'admin', 'System Administrator']
        );
        // Grant all permissions to the default admin
        const adminUser = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
        if (adminUser) {
            const allPerms = ['members','beneficiaries','finance','volunteers','courses','ramadan','reports','settings','users'];
            for (const perm of allPerms) {
                await db.run('INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)', [adminUser.id, perm]);
            }
        }

        // Seed Founders
        const founders = [
            ['Ahmed Khan', 'founder', 5000],
            ['Mohamed Rizwan', 'founder', 7500],
            ['Ibrahim Ali', 'founder', 5000],
            ['Zaid Mansoor', 'founder', 10000],
            ['Yusuf Omar', 'founder', 5000],
            ['Siddiq Ahmed', 'founder', 6000]
        ];
        for (const f of founders) {
            await db.run('INSERT INTO members (full_name, member_type, monthly_subscription) VALUES (?, ?, ?)', f);
        }

        // Seed some families
        await db.run('INSERT INTO families (head_name, address, member_count, poverty_level) VALUES (?, ?, ?, ?)',
            ['Fathima Zeena', 'Main Street, Colombo', 5, 'high']);

        // Seed some courses
        await db.run('INSERT INTO courses (title, category, target_audience) VALUES (?, ?, ?)',
            ['Quran Essentials', 'quran', 'children']);
        await db.run('INSERT INTO courses (title, category, target_audience) VALUES (?, ?, ?)',
            ['CCTV Installation', 'skills', 'men']);
    }

    // SMS Gateways, Templates & Dispatch Logs (Text.lk & configurable REST providers)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS sms_gateways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            provider TEXT DEFAULT 'textlk',
            api_url TEXT NOT NULL,
            api_token TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            default_country_code TEXT DEFAULT '94',
            message_type TEXT DEFAULT 'plain',
            custom_headers TEXT DEFAULT '{}',
            is_default INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            last_status TEXT DEFAULT 'Configured',
            last_tested_at DATETIME,
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sms_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'Reminder',
            body TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gateway_id INTEGER,
            gateway_name TEXT,
            batch_id TEXT,
            dispatch_mode TEXT DEFAULT 'individual',
            recipient_type TEXT DEFAULT 'beneficiary',
            beneficiary_id INTEGER,
            beneficiary_name TEXT,
            phone_raw TEXT,
            phone_normalized TEXT NOT NULL,
            sender_id TEXT,
            message TEXT NOT NULL,
            segments INTEGER DEFAULT 1,
            status TEXT DEFAULT 'sent',
            scheduled_for DATETIME,
            provider_response TEXT,
            provider_message_id TEXT,
            error_message TEXT,
            reminder_tag TEXT DEFAULT '',
            sent_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const smsTplCount = await db.get('SELECT COUNT(*) as cnt FROM sms_templates');
    if (smsTplCount && smsTplCount.cnt === 0) {
        const starterTemplates = [
            [
                'Aid Distribution Reminder',
                'Reminder',
                'Assalamu Alaikum {name} ({app_no}), reminder from EDF Galgamuwa: your scheduled assistance package is ready for collection. Please bring your NIC.'
            ],
            [
                'Document Verification Call',
                'Aid Notice',
                'Assalamu Alaikum {name}, please bring the required verification documents for application {app_no} to EDF Galgamuwa office ({town}) during office hours.'
            ],
            [
                'Ramadan & Relief Update',
                'Ramadan',
                'Assalamu Alaikum {name}, EDF Galgamuwa relief distribution for {category} families will commence soon. Contact our coordination desk for timings.'
            ]
        ];
        for (const tpl of starterTemplates) {
            await db.run(
                'INSERT INTO sms_templates (title, category, body) VALUES (?, ?, ?)',
                tpl
            );
        }
    }

    // Madrasa Class, Muallimah, Student & Attendance Management Tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS madrasa_muallimahs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_code TEXT UNIQUE,
            full_name TEXT NOT NULL,
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            nic_number TEXT DEFAULT '',
            qualification TEXT DEFAULT '',
            specialization TEXT DEFAULT 'Quran & Tajweed',
            monthly_stipend REAL DEFAULT 0,
            join_date DATE,
            address TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS madrasa_classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_code TEXT UNIQUE,
            class_name TEXT NOT NULL,
            level TEXT DEFAULT 'Nazirah',
            muallimah_id INTEGER REFERENCES madrasa_muallimahs(id) ON DELETE SET NULL,
            schedule_days TEXT DEFAULT 'Mon - Fri',
            schedule_time TEXT DEFAULT '02:30 PM - 04:30 PM',
            room_name TEXT DEFAULT 'Hall A',
            capacity INTEGER DEFAULT 25,
            monthly_fee REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            description TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS madrasa_students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admission_no TEXT UNIQUE,
            full_name TEXT NOT NULL,
            gender TEXT DEFAULT 'female',
            dob DATE,
            age INTEGER,
            class_id INTEGER REFERENCES madrasa_classes(id) ON DELETE SET NULL,
            guardian_name TEXT DEFAULT '',
            guardian_phone TEXT DEFAULT '',
            guardian_relation TEXT DEFAULT 'Parent',
            address TEXT DEFAULT '',
            enrollment_date DATE,
            current_juz_or_level TEXT DEFAULT 'Noorani Qaida',
            fee_status TEXT DEFAULT 'sponsored',
            status TEXT DEFAULT 'active',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS madrasa_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL REFERENCES madrasa_classes(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES madrasa_students(id) ON DELETE CASCADE,
            attendance_date DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'present',
            lesson_note TEXT DEFAULT '',
            remarks TEXT DEFAULT '',
            marked_by TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(class_id, student_id, attendance_date)
        );
    `);

    const madrasaSeeded = await db.get("SELECT value FROM global_settings WHERE key = 'madrasa_seeded'");
    if (!madrasaSeeded) {
        const mCount = await db.get('SELECT COUNT(*) as cnt FROM madrasa_muallimahs');
        const cCount = await db.get('SELECT COUNT(*) as cnt FROM madrasa_classes');
        if (mCount && mCount.cnt === 0 && cCount && cCount.cnt === 0) {
            const m1 = await db.run(
                `INSERT INTO madrasa_muallimahs (staff_code, full_name, phone, qualification, specialization, monthly_stipend, join_date, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, date('now', '-180 days'), 'active', ?)`,
                ['MLM-001', 'Ustadha Fathima Nazeera', '+94 77 412 8890', 'Alimah & Hifz Ijazah', 'Hifz-ul-Quran & Tajweed', 25000, 'Lead morning & afternoon Hifz halqah instructor']
            );
            const m2 = await db.run(
                `INSERT INTO madrasa_muallimahs (staff_code, full_name, phone, qualification, specialization, monthly_stipend, join_date, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, date('now', '-120 days'), 'active', ?)`,
                ['MLM-002', 'Ustadha Ayesha Siddiqa', '+94 71 845 3321', 'Qariah & Islamic Studies Diploma', 'Noorani Qaida & Nazirah', 20000, 'Foundation Qaida & Fiqh for beginners']
            );
            const cls1 = await db.run(
                `INSERT INTO madrasa_classes (class_code, class_name, level, muallimah_id, schedule_days, schedule_time, room_name, capacity, monthly_fee, status, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                ['CLS-001', 'Al-Fajr Hifz Halqah', 'Hifz', m1.lastID, 'Mon - Fri', '02:30 PM - 04:45 PM', 'Sanctuary Hall 1', 20, 0, 'Intensive Quran memorization and daily tajweed murajaah circle']
            );
            const cls2 = await db.run(
                `INSERT INTO madrasa_classes (class_code, class_name, level, muallimah_id, schedule_days, schedule_time, room_name, capacity, monthly_fee, status, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                ['CLS-002', 'Noorani Qaida & Nazirah', 'Qaida / Beginners', m2.lastID, 'Mon, Wed, Fri', '03:00 PM - 04:30 PM', 'Classroom B', 25, 500, 'Foundational Arabic phonetics, daily dua memorization & adab']
            );
            const year = new Date().getFullYear();
            await db.run(
                `INSERT INTO madrasa_students (admission_no, full_name, gender, age, class_id, guardian_name, guardian_phone, guardian_relation, enrollment_date, current_juz_or_level, fee_status, status)
                 VALUES (?, ?, 'female', 12, ?, ?, ?, 'Father', date('now', '-90 days'), 'Juz 06 · Surah An-Nisa', 'sponsored', 'active')`,
                [`MDR-${year}-001`, 'Zainab Banu', cls1.lastID, 'Mohamed Farook', '+94 77 201 4410']
            );
            await db.run(
                `INSERT INTO madrasa_students (admission_no, full_name, gender, age, class_id, guardian_name, guardian_phone, guardian_relation, enrollment_date, current_juz_or_level, fee_status, status)
                 VALUES (?, ?, 'female', 11, ?, ?, ?, 'Mother', date('now', '-75 days'), 'Juz 04 · Al-Imran', 'paid', 'active')`,
                [`MDR-${year}-002`, 'Hafsa Mariyam', cls1.lastID, 'Sakeena Begum', '+94 76 903 1188']
            );
            await db.run(
                `INSERT INTO madrasa_students (admission_no, full_name, gender, age, class_id, guardian_name, guardian_phone, guardian_relation, enrollment_date, current_juz_or_level, fee_status, status)
                 VALUES (?, ?, 'female', 8, ?, ?, ?, 'Father', date('now', '-45 days'), 'Noorani Qaida Lesson 11', 'exempt', 'active')`,
                [`MDR-${year}-003`, 'Amina Zahra', cls2.lastID, 'Abdul Rahman', '+94 77 889 2201']
            );
        }
        await db.run("INSERT OR IGNORE INTO global_settings (key, value) VALUES ('madrasa_seeded', '1')");
    }

    // Server-side Backup Snapshots Vault table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS backup_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            notes TEXT DEFAULT '',
            backup_type TEXT DEFAULT 'manual',
            scope TEXT DEFAULT 'full',
            filename TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            checksum TEXT NOT NULL,
            tables_count INTEGER DEFAULT 0,
            total_rows INTEGER DEFAULT 0,
            table_counts_json TEXT DEFAULT '{}',
            includes_json TEXT DEFAULT '[]',
            is_locked INTEGER DEFAULT 0,
            created_by TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS program_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            batch_id INTEGER,
            application_no TEXT,
            applicant_name TEXT NOT NULL,
            applicant_phone TEXT,
            whatsapp_number TEXT,
            applicant_email TEXT,
            applicant_dob DATE,
            applicant_age INTEGER,
            applicant_gender TEXT,
            applicant_address TEXT,
            city TEXT,
            guardian_name TEXT,
            guardian_phone TEXT,
            emergency_contact TEXT,
            nic_number TEXT,
            education_level TEXT,
            occupation TEXT,
            monthly_family_income REAL DEFAULT 0,
            beneficiary_id INTEGER,
            fee_status TEXT DEFAULT 'free',
            fee_paid REAL DEFAULT 0,
            attendance_pct INTEGER DEFAULT 0,
            grade_result TEXT DEFAULT 'pending',
            certificate_issued INTEGER DEFAULT 0,
            certificate_no TEXT,
            motivation TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            custom_data TEXT,
            reviewed_by TEXT,
            reviewed_at DATETIME,
            applied_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS volunteer_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            volunteer_id INTEGER NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
            activity_title TEXT NOT NULL,
            activity_type TEXT DEFAULT 'Field Relief',
            activity_date DATE NOT NULL,
            hours_served REAL DEFAULT 0,
            location TEXT DEFAULT '',
            coordinator TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await ensureAllColumnMigrations(db);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteers_no ON volunteers(volunteer_no) WHERE volunteer_no IS NOT NULL`);

    await db.run(
        `INSERT OR REPLACE INTO global_settings (key, value) VALUES ('edf_schema_version', ?)`,
        [SCHEMA_VERSION]
    );

    return db;
}

async function ensureAllColumnMigrations(db) {
    await ensureColumns(db, 'users', [
        ['phone', 'TEXT'],
        ['bio', 'TEXT'],
        ['status', "TEXT DEFAULT 'active'"],
        ['last_login', 'DATETIME'],
        ['last_seen', 'DATETIME'],
        ['force_logout_at', 'DATETIME'],
        ['blocked_by', 'INTEGER REFERENCES users(id)']
    ]);

    await ensureColumns(db, 'members', [
        ['nic_number', 'TEXT'],
        ['address', 'TEXT'],
        ['city', 'TEXT'],
        ['gender', 'TEXT'],
        ['age', 'INTEGER'],
        ['monthly_income', 'REAL DEFAULT 0'],
        ['join_date', 'DATE DEFAULT CURRENT_DATE'],
        ['marital_status', 'TEXT'],
        ['bank_name', 'TEXT'],
        ['bank_branch', 'TEXT'],
        ['account_number', 'TEXT'],
        ['previous_balance', 'REAL DEFAULT 0'],
        ['blood_group', 'TEXT'],
        ['occupation', 'TEXT'],
        ['sibling_id', 'INTEGER'],
        ['member_type', "TEXT DEFAULT 'executive'"],
        ['monthly_subscription', 'REAL DEFAULT 0'],
        ['status', "TEXT DEFAULT 'active'"],
        ['photo_url', 'TEXT'],
        ['membership_no', 'TEXT'],
        ['dob', 'DATE'],
        ['whatsapp', 'TEXT'],
        ['designation', 'TEXT'],
        ['account_holder_name', 'TEXT'],
        ['emergency_contact_name', 'TEXT'],
        ['emergency_contact_phone', 'TEXT'],
        ['notes', 'TEXT']
    ]);

    await ensureColumns(db, 'member_relatives', [
        ['nic_number', 'TEXT'],
        ['gender', 'TEXT'],
        ['age', 'INTEGER'],
        ['occupation', 'TEXT']
    ]);

    await ensureColumns(db, 'subscriptions', [
        ['payment_method', "TEXT DEFAULT 'cash'"],
        ['notes', 'TEXT'],
        ['paid_amount', 'REAL'],
        ['is_advance', 'INTEGER DEFAULT 0'],
        ['reference_number', 'TEXT'],
        ['bank_name', 'TEXT'],
        ['bank_code', 'TEXT'],
        ['cheque_date', 'DATE'],
        ['cheque_image', 'TEXT']
    ]);

    await ensureColumns(db, 'subscription_payments', [
        ['bank_name', 'TEXT'],
        ['bank_code', 'TEXT'],
        ['cheque_date', 'DATE'],
        ['cheque_image', 'TEXT']
    ]);

    await ensureColumns(db, 'beneficiaries', [
        ['nic_number', 'TEXT'],
        ['male_head_age', 'INTEGER'],
        ['female_head_special_qualifications', 'TEXT'],
        ['guardian_if_divorced', 'TEXT'],
        ['assessment_notes', 'TEXT'],
        ['rejection_reason', 'TEXT'],
        ['photo_url', 'TEXT']
    ]);

    for (const childTbl of [
        'beneficiary_children_study',
        'beneficiary_children_dropout',
        'beneficiary_children_university',
        'beneficiary_children_abroad'
    ]) {
        await ensureColumns(db, childTbl, [['gender', 'TEXT']]);
    }

    await ensureColumns(db, 'families', [
        ['family_code', 'TEXT'],
        ['nic_number', 'TEXT'],
        ['head_gender', 'TEXT'],
        ['head_dob', 'DATE'],
        ['head_age', 'INTEGER'],
        ['head_occupation', 'TEXT'],
        ['marital_status', 'TEXT'],
        ['spouse_name', 'TEXT'],
        ['spouse_nic', 'TEXT'],
        ['spouse_occupation', 'TEXT'],
        ['whatsapp', 'TEXT'],
        ['city', 'TEXT'],
        ['gn_division', 'TEXT'],
        ['adults_count', 'INTEGER DEFAULT 1'],
        ['children_count', 'INTEGER DEFAULT 0'],
        ['elderly_count', 'INTEGER DEFAULT 0'],
        ['disabled_count', 'INTEGER DEFAULT 0'],
        ['dependents_json', 'TEXT'],
        ['monthly_income', 'REAL DEFAULT 0'],
        ['monthly_expenses', 'REAL DEFAULT 0'],
        ['housing_type', "TEXT DEFAULT 'own'"],
        ['aid_category', "TEXT DEFAULT 'general'"],
        ['vulnerability_tags', 'TEXT'],
        ['bank_name', 'TEXT'],
        ['bank_branch', 'TEXT'],
        ['account_number', 'TEXT'],
        ['account_holder_name', 'TEXT'],
        ['priority_score', 'INTEGER DEFAULT 0'],
        ['verified_by', 'TEXT'],
        ['verification_date', 'DATE'],
        ['notes', 'TEXT'],
        ['photo_url', 'TEXT']
    ]);

    await ensureColumns(db, 'family_donations', [
        ['payment_method', "TEXT DEFAULT 'cash'"],
        ['reference_no', 'TEXT'],
        ['distributed_by', 'TEXT']
    ]);

    await ensureColumns(db, 'ramadan_distributions', [
        ['package_type', "TEXT DEFAULT 'dry_ration'"],
        ['hijri_year', 'TEXT'],
        ['collection_time', 'TEXT'],
        ['coordinator_name', 'TEXT'],
        ['coordinator_phone', 'TEXT'],
        ['target_quota', 'INTEGER DEFAULT 0'],
        ['package_items', 'TEXT'],
        ['allocated_shops', 'TEXT']
    ]);

    await ensureColumns(db, 'ramadan_tokens', [
        ['collector_name', 'TEXT'],
        ['collector_nic', 'TEXT'],
        ['allocated_shop', 'TEXT'],
        ['redeemed_at', 'DATETIME'],
        ['redeemed_by_shop', 'TEXT'],
        ['shop_collected_at', 'DATETIME'],
        ['shop_collected_by', 'INTEGER'],
        ['issued_at', 'DATETIME'],
        ['issued_by', 'INTEGER']
    ]);

    await ensureColumns(db, 'documents', [
        ['folder', "TEXT DEFAULT 'General'"],
        ['visibility', "TEXT DEFAULT 'internal'"],
        ['is_pinned', 'INTEGER DEFAULT 0']
    ]);

    await ensureColumns(db, 'inventory_items', [
        ['location', "TEXT DEFAULT ''"],
        ['image_url', "TEXT DEFAULT ''"]
    ]);

    await ensureColumns(db, 'courses', [
        ['form_template_id', 'INTEGER REFERENCES form_templates(id)'],
        ['description', 'TEXT'],
        ['max_capacity', 'INTEGER DEFAULT 30'],
        ['fee', 'REAL DEFAULT 0'],
        ['location', 'TEXT'],
        ['duration_weeks', 'INTEGER DEFAULT 8'],
        ['duration_type', "TEXT DEFAULT 'weeks'"],
        ['program_code', 'TEXT'],
        ['level', "TEXT DEFAULT 'all_levels'"],
        ['delivery_mode', "TEXT DEFAULT 'in_person'"],
        ['language', "TEXT DEFAULT 'Tamil & Sinhala'"],
        ['schedule_days', 'TEXT'],
        ['schedule_time', 'TEXT'],
        ['coordinator_name', 'TEXT'],
        ['coordinator_phone', 'TEXT'],
        ['certification', "TEXT DEFAULT 'certificate'"],
        ['scholarship_available', 'INTEGER DEFAULT 1'],
        ['prerequisites', 'TEXT'],
        ['syllabus_topics', 'TEXT'],
        ['materials_provided', 'TEXT'],
        ['start_date', 'DATE'],
        ['application_deadline', 'DATE']
    ]);

    await ensureColumns(db, 'batches', [
        ['max_seats', 'INTEGER DEFAULT 30'],
        ['location', 'TEXT'],
        ['batch_code', 'TEXT'],
        ['instructor_phone', 'TEXT'],
        ['schedule_days', 'TEXT'],
        ['schedule_time', 'TEXT'],
        ['delivery_mode', "TEXT DEFAULT 'in_person'"],
        ['notes', 'TEXT']
    ]);

    await ensureColumns(db, 'program_applications', [
        ['custom_data', 'TEXT'],
        ['application_no', 'TEXT'],
        ['whatsapp_number', 'TEXT'],
        ['applicant_dob', 'DATE'],
        ['city', 'TEXT'],
        ['emergency_contact', 'TEXT'],
        ['occupation', 'TEXT'],
        ['monthly_family_income', 'REAL DEFAULT 0'],
        ['beneficiary_id', 'INTEGER'],
        ['fee_status', "TEXT DEFAULT 'free'"],
        ['fee_paid', 'REAL DEFAULT 0'],
        ['attendance_pct', 'INTEGER DEFAULT 0'],
        ['grade_result', "TEXT DEFAULT 'pending'"],
        ['certificate_issued', 'INTEGER DEFAULT 0'],
        ['certificate_no', 'TEXT'],
        ['motivation', 'TEXT'],
        ['reviewed_by', 'TEXT'],
        ['reviewed_at', 'DATETIME']
    ]);

    await ensureColumns(db, 'volunteers', [
        ['volunteer_no', 'TEXT'],
        ['nic_number', 'TEXT'],
        ['whatsapp', 'TEXT'],
        ['address', 'TEXT'],
        ['city', 'TEXT'],
        ['gender', 'TEXT'],
        ['blood_group', 'TEXT'],
        ['availability', "TEXT DEFAULT 'Weekends'"],
        ['wing', "TEXT DEFAULT 'Field Relief'"],
        ['role_tier', "TEXT DEFAULT 'Field Volunteer'"],
        ['transport_mode', "TEXT DEFAULT 'None'"],
        ['emergency_contact_name', 'TEXT'],
        ['emergency_contact_phone', 'TEXT'],
        ['join_date', 'DATE'],
        ['verified_id', 'INTEGER DEFAULT 0'],
        ['total_hours', 'REAL DEFAULT 0'],
        ['deployments_count', 'INTEGER DEFAULT 0'],
        ['photo_url', 'TEXT'],
        ['notes', 'TEXT'],
        ['updated_at', 'DATETIME']
    ]);

    if (!db.isRemote) {
        await supabaseSync.attachHybridSync(db);
    }

    return db;
}

module.exports = { initDb, resetDbCache, wrapTursoClient, wrapSqliteDb };

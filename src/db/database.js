const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDb() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.run('PRAGMA foreign_keys = ON');

    // Migrate users table: add phone and bio columns if they don't exist
    try { await db.run("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE users ADD COLUMN bio TEXT"); } catch (_) {}

    // User management: status, session tracking, blocking
    try { await db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'"); } catch (_) {}
    try { await db.run("ALTER TABLE users ADD COLUMN last_login DATETIME"); } catch (_) {}
    try { await db.run("ALTER TABLE users ADD COLUMN last_seen DATETIME"); } catch (_) {}
    try { await db.run("ALTER TABLE users ADD COLUMN force_logout_at DATETIME"); } catch (_) {}
    try { await db.run("ALTER TABLE users ADD COLUMN blocked_by INTEGER REFERENCES users(id)"); } catch (_) {}

    // Add nic_number to members, member_relatives, and beneficiaries if they don't exist
    try { await db.run("ALTER TABLE members ADD COLUMN nic_number TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE member_relatives ADD COLUMN nic_number TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN nic_number TEXT"); } catch (_) {}

    // Migrate members table: add all columns that may be missing in older databases
    try { await db.run("ALTER TABLE members ADD COLUMN address TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN city TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN gender TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN age INTEGER"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN monthly_income REAL DEFAULT 0"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN join_date DATE DEFAULT CURRENT_DATE"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN marital_status TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN bank_name TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN bank_branch TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN account_number TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN previous_balance REAL DEFAULT 0"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN blood_group TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN occupation TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN sibling_id INTEGER"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN member_type TEXT DEFAULT 'executive'"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN monthly_subscription REAL DEFAULT 0"); } catch (_) {}
    try { await db.run("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active'"); } catch (_) {}

    // Migrate subscriptions table: support partial payments and payment methods
    try { await db.run("ALTER TABLE subscriptions ADD COLUMN payment_method TEXT DEFAULT 'cash'"); } catch (_) {}
    try { await db.run("ALTER TABLE subscriptions ADD COLUMN notes TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE subscriptions ADD COLUMN paid_amount REAL"); } catch (_) {}
    try { await db.run("ALTER TABLE subscriptions ADD COLUMN is_advance INTEGER DEFAULT 0"); } catch (_) {}

    // Migrate member_relatives table
    try { await db.run("ALTER TABLE member_relatives ADD COLUMN gender TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE member_relatives ADD COLUMN age INTEGER"); } catch (_) {}
    try { await db.run("ALTER TABLE member_relatives ADD COLUMN occupation TEXT"); } catch (_) {}

    // Migrate beneficiaries table: add columns added in later schema updates
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN male_head_age INTEGER"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN female_head_special_qualifications TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN guardian_if_divorced TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN assessment_notes TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN rejection_reason TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiaries ADD COLUMN photo_url TEXT"); } catch (_) {}

    // Add gender to child sub-tables
    try { await db.run("ALTER TABLE beneficiary_children_study ADD COLUMN gender TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiary_children_dropout ADD COLUMN gender TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiary_children_university ADD COLUMN gender TEXT"); } catch (_) {}
    try { await db.run("ALTER TABLE beneficiary_children_abroad ADD COLUMN gender TEXT"); } catch (_) {}

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
            payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id)
        );

        CREATE TABLE IF NOT EXISTS subscription_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_method TEXT DEFAULT 'cash',
            reference_number TEXT,    -- Cheque no / transaction ref
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

    // Add form_template_id to courses if it doesn't exist
    try {
        await db.run('ALTER TABLE courses ADD COLUMN form_template_id INTEGER REFERENCES form_templates(id)');
    } catch (e) {
        // Column probably already exists
    }

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

    return db;
}

module.exports = { initDb };

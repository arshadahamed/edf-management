const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // ── DB Migration (skipped when database schema is already up to date) ──
    const initMigrations = async () => {
        if (db.schemaAlreadyCurrent) return;
        await db.exec(`
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
        `).catch(() => {});

        const cols = [
            "ALTER TABLE courses ADD COLUMN description TEXT",
            "ALTER TABLE courses ADD COLUMN max_capacity INTEGER DEFAULT 30",
            "ALTER TABLE courses ADD COLUMN fee REAL DEFAULT 0",
            "ALTER TABLE courses ADD COLUMN location TEXT",
            "ALTER TABLE courses ADD COLUMN duration_weeks INTEGER DEFAULT 8",
            "ALTER TABLE courses ADD COLUMN duration_type TEXT DEFAULT 'weeks'",
            "ALTER TABLE courses ADD COLUMN form_template_id INTEGER REFERENCES form_templates(id)",
            "ALTER TABLE courses ADD COLUMN program_code TEXT",
            "ALTER TABLE courses ADD COLUMN level TEXT DEFAULT 'all_levels'",
            "ALTER TABLE courses ADD COLUMN delivery_mode TEXT DEFAULT 'in_person'",
            "ALTER TABLE courses ADD COLUMN language TEXT DEFAULT 'Tamil & Sinhala'",
            "ALTER TABLE courses ADD COLUMN schedule_days TEXT",
            "ALTER TABLE courses ADD COLUMN schedule_time TEXT",
            "ALTER TABLE courses ADD COLUMN coordinator_name TEXT",
            "ALTER TABLE courses ADD COLUMN coordinator_phone TEXT",
            "ALTER TABLE courses ADD COLUMN certification TEXT DEFAULT 'certificate'",
            "ALTER TABLE courses ADD COLUMN scholarship_available INTEGER DEFAULT 1",
            "ALTER TABLE courses ADD COLUMN prerequisites TEXT",
            "ALTER TABLE courses ADD COLUMN syllabus_topics TEXT",
            "ALTER TABLE courses ADD COLUMN materials_provided TEXT",
            "ALTER TABLE courses ADD COLUMN start_date DATE",
            "ALTER TABLE courses ADD COLUMN application_deadline DATE",
            "ALTER TABLE batches ADD COLUMN max_seats INTEGER DEFAULT 30",
            "ALTER TABLE batches ADD COLUMN location TEXT",
            "ALTER TABLE batches ADD COLUMN batch_code TEXT",
            "ALTER TABLE batches ADD COLUMN instructor_phone TEXT",
            "ALTER TABLE batches ADD COLUMN schedule_days TEXT",
            "ALTER TABLE batches ADD COLUMN schedule_time TEXT",
            "ALTER TABLE batches ADD COLUMN delivery_mode TEXT DEFAULT 'in_person'",
            "ALTER TABLE batches ADD COLUMN notes TEXT",
            "ALTER TABLE program_applications ADD COLUMN custom_data TEXT",
            "ALTER TABLE program_applications ADD COLUMN application_no TEXT",
            "ALTER TABLE program_applications ADD COLUMN whatsapp_number TEXT",
            "ALTER TABLE program_applications ADD COLUMN applicant_dob DATE",
            "ALTER TABLE program_applications ADD COLUMN city TEXT",
            "ALTER TABLE program_applications ADD COLUMN emergency_contact TEXT",
            "ALTER TABLE program_applications ADD COLUMN occupation TEXT",
            "ALTER TABLE program_applications ADD COLUMN monthly_family_income REAL DEFAULT 0",
            "ALTER TABLE program_applications ADD COLUMN beneficiary_id INTEGER",
            "ALTER TABLE program_applications ADD COLUMN fee_status TEXT DEFAULT 'free'",
            "ALTER TABLE program_applications ADD COLUMN fee_paid REAL DEFAULT 0",
            "ALTER TABLE program_applications ADD COLUMN attendance_pct INTEGER DEFAULT 0",
            "ALTER TABLE program_applications ADD COLUMN grade_result TEXT DEFAULT 'pending'",
            "ALTER TABLE program_applications ADD COLUMN certificate_issued INTEGER DEFAULT 0",
            "ALTER TABLE program_applications ADD COLUMN certificate_no TEXT",
            "ALTER TABLE program_applications ADD COLUMN motivation TEXT",
            "ALTER TABLE program_applications ADD COLUMN reviewed_by TEXT",
            "ALTER TABLE program_applications ADD COLUMN reviewed_at DATETIME"
        ];
        for (const sql of cols) {
            try { await db.run(sql); } catch (_) {}
        }

        // Backfill missing program_code and application_no on existing records
        try {
            const progsWithoutCode = await db.all("SELECT id FROM courses WHERE program_code IS NULL OR program_code = ''");
            for (const p of progsWithoutCode) {
                const code = `EDF-PRG-${String(p.id).padStart(3, '0')}`;
                await db.run("UPDATE courses SET program_code = ? WHERE id = ?", [code, p.id]);
            }
            const appsWithoutNo = await db.all("SELECT id, applied_date FROM program_applications WHERE application_no IS NULL OR application_no = ''");
            for (const a of appsWithoutNo) {
                const yr = a.applied_date ? new Date(a.applied_date).getFullYear() : new Date().getFullYear();
                const appNo = `APP-${yr}-${String(a.id).padStart(4, '0')}`;
                await db.run("UPDATE program_applications SET application_no = ? WHERE id = ?", [appNo, a.id]);
            }
        } catch (_) {}
    };
    initMigrations();

    // Helper: generate next program code
    async function nextProgramCode() {
        const row = await db.get("SELECT MAX(id) as maxId FROM courses");
        const nextId = (row && row.maxId ? Number(row.maxId) : 0) + 1;
        return `EDF-PRG-${String(nextId).padStart(3, '0')}`;
    }

    // Helper: generate next application number
    async function nextApplicationNo() {
        const row = await db.get("SELECT MAX(id) as maxId FROM program_applications");
        const nextId = (row && row.maxId ? Number(row.maxId) : 0) + 1;
        const yr = new Date().getFullYear();
        return `APP-${yr}-${String(nextId).padStart(4, '0')}`;
    }

    // ════════════════════════════════════════════════════════
    //   PROGRAMS / COURSES
    // ════════════════════════════════════════════════════════

    const PROGRAMS_LIST_SQL = `
        SELECT c.*,
            ft.name AS form_template_name,
            (SELECT COUNT(*) FROM batches b WHERE b.course_id = c.id) AS batch_count,
            (SELECT COUNT(*) FROM batches b WHERE b.course_id = c.id AND b.status = 'active') AS active_batch_count,
            (SELECT COALESCE(SUM(b.max_seats), 0) FROM batches b WHERE b.course_id = c.id) AS total_batch_seats,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id) AS applicant_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status IN ('approved', 'enrolled', 'completed')) AS enrolled_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'pending') AS pending_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'approved') AS approved_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'enrolled') AS active_enrolled_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'completed') AS completed_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'waitlisted') AS waitlisted_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.status = 'rejected') AS rejected_count,
            (SELECT COUNT(*) FROM program_applications pa WHERE pa.course_id = c.id AND pa.certificate_issued = 1) AS certificates_count,
            (SELECT COALESCE(SUM(pa.fee_paid), 0) FROM program_applications pa WHERE pa.course_id = c.id) AS fee_collected
        FROM courses c
        LEFT JOIN form_templates ft ON c.form_template_id = ft.id
        ORDER BY c.id DESC
    `;

    // Alias GET /api/programs AND GET /api/programs/programs
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const programs = await db.all(PROGRAMS_LIST_SQL);
            res.json(programs);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.get('/programs', authenticateToken, async (req, res) => {
        try {
            const programs = await db.all(PROGRAMS_LIST_SQL);
            res.json(programs);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET single program (with batches & applications summary)
    router.get('/programs/:id', authenticateToken, async (req, res) => {
        try {
            const program = await db.get(`
                SELECT c.*, ft.name AS form_template_name
                FROM courses c
                LEFT JOIN form_templates ft ON c.form_template_id = ft.id
                WHERE c.id = ?
            `, [req.params.id]);
            if (!program) return res.status(404).json({ message: 'Program not found' });

            const batches = await db.all(`
                SELECT b.*,
                    COUNT(pa.id) AS applicant_count,
                    SUM(CASE WHEN pa.status IN ('approved', 'enrolled', 'completed') THEN 1 ELSE 0 END) AS enrolled_count,
                    SUM(CASE WHEN pa.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
                FROM batches b
                LEFT JOIN program_applications pa ON pa.batch_id = b.id
                WHERE b.course_id = ?
                GROUP BY b.id
                ORDER BY b.start_date ASC, b.id DESC
            `, [req.params.id]);

            const counts = await db.get(`
                SELECT
                    COUNT(*) AS applicant_count,
                    SUM(CASE WHEN status IN ('approved', 'enrolled', 'completed') THEN 1 ELSE 0 END) AS enrolled_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
                    SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) AS certificates_count,
                    COALESCE(SUM(fee_paid), 0) AS fee_collected
                FROM program_applications
                WHERE course_id = ?
            `, [req.params.id]);

            res.json({
                ...program,
                batch_count: batches.length,
                applicant_count: counts?.applicant_count || 0,
                enrolled_count: counts?.enrolled_count || 0,
                pending_count: counts?.pending_count || 0,
                completed_count: counts?.completed_count || 0,
                certificates_count: counts?.certificates_count || 0,
                fee_collected: counts?.fee_collected || 0,
                batches
            });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST create program (with optional initial batch creation)
    router.post('/programs', authenticateToken, async (req, res) => {
        const {
            title, program_code, category, target_audience, level, delivery_mode, language,
            description, status, max_capacity, fee, scholarship_available, certification,
            location, duration_weeks, duration_type, schedule_days, schedule_time,
            coordinator_name, coordinator_phone, prerequisites, syllabus_topics,
            materials_provided, start_date, application_deadline, form_template_id,
            create_initial_batch, initial_batch_name, initial_batch_start, initial_batch_end,
            initial_batch_seats, initial_batch_instructor
        } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ message: 'Program title is required' });
        }

        try {
            const code = (program_code && String(program_code).trim()) ? String(program_code).trim() : await nextProgramCode();
            const cap = Number(max_capacity) > 0 ? Number(max_capacity) : 30;
            const result = await db.run(
                `INSERT INTO courses (
                    title, program_code, category, target_audience, level, delivery_mode, language,
                    description, status, max_capacity, fee, scholarship_available, certification,
                    location, duration_weeks, duration_type, schedule_days, schedule_time,
                    coordinator_name, coordinator_phone, prerequisites, syllabus_topics,
                    materials_provided, start_date, application_deadline, form_template_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(title).trim(), code, category || 'skills', target_audience || 'all',
                    level || 'all_levels', delivery_mode || 'in_person', language || 'Tamil & Sinhala',
                    description || '', status || 'active', cap, Number(fee) || 0,
                    scholarship_available !== undefined ? (scholarship_available ? 1 : 0) : 1,
                    certification || 'certificate', location || '',
                    Number(duration_weeks) || 8, duration_type || 'weeks',
                    schedule_days || '', schedule_time || '',
                    coordinator_name || '', coordinator_phone || '',
                    prerequisites || '', syllabus_topics || '', materials_provided || '',
                    start_date || null, application_deadline || null,
                    form_template_id ? Number(form_template_id) : null
                ]
            );

            const courseId = result.lastID;
            let createdBatchId = null;

            if (create_initial_batch && (initial_batch_name || title)) {
                const bName = (initial_batch_name && String(initial_batch_name).trim())
                    ? String(initial_batch_name).trim()
                    : `Batch ${new Date().getFullYear()}-A`;
                const bCode = `${code}-B1`;
                const bRes = await db.run(
                    `INSERT INTO batches (
                        course_id, batch_name, batch_code, start_date, end_date,
                        instructor_name, instructor_phone, schedule_days, schedule_time,
                        delivery_mode, status, max_seats, location
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        courseId, bName, bCode,
                        initial_batch_start || start_date || null,
                        initial_batch_end || null,
                        initial_batch_instructor || coordinator_name || '',
                        coordinator_phone || '',
                        schedule_days || '', schedule_time || '',
                        delivery_mode || 'in_person', 'active',
                        Number(initial_batch_seats) || cap,
                        location || ''
                    ]
                );
                createdBatchId = bRes.lastID;
            }

            res.json({
                id: courseId,
                program_code: code,
                batch_id: createdBatchId,
                message: createdBatchId ? 'Program & initial batch created successfully' : 'Program created successfully'
            });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT update program
    router.put('/programs/:id', authenticateToken, async (req, res) => {
        const {
            title, program_code, category, target_audience, level, delivery_mode, language,
            description, status, max_capacity, fee, scholarship_available, certification,
            location, duration_weeks, duration_type, schedule_days, schedule_time,
            coordinator_name, coordinator_phone, prerequisites, syllabus_topics,
            materials_provided, start_date, application_deadline, form_template_id
        } = req.body;

        try {
            const existing = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Program not found' });

            const code = (program_code && String(program_code).trim())
                ? String(program_code).trim()
                : (existing.program_code || `EDF-PRG-${String(existing.id).padStart(3, '0')}`);

            await db.run(
                `UPDATE courses SET
                    title=?, program_code=?, category=?, target_audience=?, level=?, delivery_mode=?, language=?,
                    description=?, status=?, max_capacity=?, fee=?, scholarship_available=?, certification=?,
                    location=?, duration_weeks=?, duration_type=?, schedule_days=?, schedule_time=?,
                    coordinator_name=?, coordinator_phone=?, prerequisites=?, syllabus_topics=?,
                    materials_provided=?, start_date=?, application_deadline=?, form_template_id=?
                 WHERE id=?`,
                [
                    String(title || existing.title).trim(), code,
                    category || existing.category || 'skills',
                    target_audience || existing.target_audience || 'all',
                    level || existing.level || 'all_levels',
                    delivery_mode || existing.delivery_mode || 'in_person',
                    language !== undefined ? language : (existing.language || 'Tamil & Sinhala'),
                    description !== undefined ? description : existing.description,
                    status || existing.status || 'active',
                    Number(max_capacity) > 0 ? Number(max_capacity) : (existing.max_capacity || 30),
                    fee !== undefined ? Number(fee) || 0 : (existing.fee || 0),
                    scholarship_available !== undefined ? (scholarship_available ? 1 : 0) : (existing.scholarship_available ?? 1),
                    certification || existing.certification || 'certificate',
                    location !== undefined ? location : existing.location,
                    duration_weeks !== undefined ? (Number(duration_weeks) || 8) : (existing.duration_weeks || 8),
                    duration_type || existing.duration_type || 'weeks',
                    schedule_days !== undefined ? schedule_days : existing.schedule_days,
                    schedule_time !== undefined ? schedule_time : existing.schedule_time,
                    coordinator_name !== undefined ? coordinator_name : existing.coordinator_name,
                    coordinator_phone !== undefined ? coordinator_phone : existing.coordinator_phone,
                    prerequisites !== undefined ? prerequisites : existing.prerequisites,
                    syllabus_topics !== undefined ? syllabus_topics : existing.syllabus_topics,
                    materials_provided !== undefined ? materials_provided : existing.materials_provided,
                    start_date !== undefined ? (start_date || null) : existing.start_date,
                    application_deadline !== undefined ? (application_deadline || null) : existing.application_deadline,
                    form_template_id ? Number(form_template_id) : null,
                    req.params.id
                ]
            );
            res.json({ message: 'Program updated successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PATCH program status
    router.patch('/programs/:id/status', authenticateToken, async (req, res) => {
        const { status } = req.body;
        try {
            await db.run('UPDATE courses SET status = ? WHERE id = ?', [status, req.params.id]);
            res.json({ message: `Program marked as ${status}` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST duplicate program
    router.post('/programs/:id/duplicate', authenticateToken, async (req, res) => {
        const { title, copy_batches } = req.body || {};
        try {
            const orig = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
            if (!orig) return res.status(404).json({ message: 'Program not found' });

            const newTitle = (title && String(title).trim()) ? String(title).trim() : `${orig.title} (Copy)`;
            const newCode = await nextProgramCode();

            const result = await db.run(
                `INSERT INTO courses (
                    title, program_code, category, target_audience, level, delivery_mode, language,
                    description, status, max_capacity, fee, scholarship_available, certification,
                    location, duration_weeks, duration_type, schedule_days, schedule_time,
                    coordinator_name, coordinator_phone, prerequisites, syllabus_topics,
                    materials_provided, start_date, application_deadline, form_template_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newTitle, newCode, orig.category, orig.target_audience, orig.level, orig.delivery_mode, orig.language,
                    orig.description, 'active', orig.max_capacity, orig.fee, orig.scholarship_available, orig.certification,
                    orig.location, orig.duration_weeks, orig.duration_type, orig.schedule_days, orig.schedule_time,
                    orig.coordinator_name, orig.coordinator_phone, orig.prerequisites, orig.syllabus_topics,
                    orig.materials_provided, orig.start_date, orig.application_deadline, orig.form_template_id
                ]
            );

            const newCourseId = result.lastID;
            if (copy_batches) {
                const batches = await db.all('SELECT * FROM batches WHERE course_id = ?', [orig.id]);
                for (let i = 0; i < batches.length; i++) {
                    const b = batches[i];
                    await db.run(
                        `INSERT INTO batches (
                            course_id, batch_name, batch_code, start_date, end_date,
                            instructor_name, instructor_phone, schedule_days, schedule_time,
                            delivery_mode, status, max_seats, location, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            newCourseId, b.batch_name, `${newCode}-B${i + 1}`, b.start_date, b.end_date,
                            b.instructor_name, b.instructor_phone, b.schedule_days, b.schedule_time,
                            b.delivery_mode, 'active', b.max_seats, b.location, b.notes
                        ]
                    );
                }
            }

            res.json({ id: newCourseId, message: `Duplicated as "${newTitle}"` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT bulk status for programs
    router.put('/programs-bulk/status', authenticateToken, async (req, res) => {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || !ids.length || !status) {
            return res.status(400).json({ message: 'Invalid bulk status request' });
        }
        try {
            const placeholders = ids.map(() => '?').join(',');
            await db.run(`UPDATE courses SET status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
            res.json({ message: `Updated ${ids.length} program(s) to ${status}` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST bulk delete programs
    router.post('/programs-bulk/delete', authenticateToken, async (req, res) => {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: 'No programs selected' });
        }
        try {
            const placeholders = ids.map(() => '?').join(',');
            await db.run(`DELETE FROM batches WHERE course_id IN (${placeholders})`, ids);
            await db.run(`DELETE FROM program_applications WHERE course_id IN (${placeholders})`, ids);
            await db.run(`DELETE FROM courses WHERE id IN (${placeholders})`, ids);
            res.json({ message: `Deleted ${ids.length} program(s)` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // DELETE single program
    router.delete('/programs/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM batches WHERE course_id = ?', [req.params.id]);
            await db.run('DELETE FROM program_applications WHERE course_id = ?', [req.params.id]);
            await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
            res.json({ message: 'Program and all associated data deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // ════════════════════════════════════════════════════════
    //   BATCHES / COHORTS
    // ════════════════════════════════════════════════════════

    // GET all batches across all programs
    router.get('/batches', authenticateToken, async (req, res) => {
        try {
            const batches = await db.all(`
                SELECT b.*,
                    c.title AS program_title,
                    c.program_code,
                    c.category AS program_category,
                    COUNT(pa.id) AS applicant_count,
                    SUM(CASE WHEN pa.status IN ('approved', 'enrolled', 'completed') THEN 1 ELSE 0 END) AS enrolled_count,
                    SUM(CASE WHEN pa.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
                FROM batches b
                LEFT JOIN courses c ON b.course_id = c.id
                LEFT JOIN program_applications pa ON pa.batch_id = b.id
                GROUP BY b.id
                ORDER BY b.id DESC
            `);
            res.json(batches);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET batches for a specific program
    router.get('/programs/:id/batches', authenticateToken, async (req, res) => {
        try {
            const batches = await db.all(`
                SELECT b.*,
                    COUNT(pa.id) AS applicant_count,
                    SUM(CASE WHEN pa.status IN ('approved', 'enrolled', 'completed') THEN 1 ELSE 0 END) AS enrolled_count,
                    SUM(CASE WHEN pa.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
                FROM batches b
                LEFT JOIN program_applications pa ON pa.batch_id = b.id
                WHERE b.course_id = ?
                GROUP BY b.id
                ORDER BY b.start_date ASC, b.id DESC
            `, [req.params.id]);
            res.json(batches);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST create batch for a program
    router.post('/programs/:id/batches', authenticateToken, async (req, res) => {
        const {
            batch_name, batch_code, start_date, end_date,
            instructor_name, instructor_phone, schedule_days, schedule_time,
            delivery_mode, status, max_seats, location, notes
        } = req.body;
        try {
            const countRow = await db.get('SELECT COUNT(*) as cnt FROM batches WHERE course_id = ?', [req.params.id]);
            const code = (batch_code && String(batch_code).trim())
                ? String(batch_code).trim()
                : `B-${req.params.id}-${(countRow?.cnt || 0) + 1}`;
            const result = await db.run(
                `INSERT INTO batches (
                    course_id, batch_name, batch_code, start_date, end_date,
                    instructor_name, instructor_phone, schedule_days, schedule_time,
                    delivery_mode, status, max_seats, location, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.params.id, batch_name, code, start_date || null, end_date || null,
                    instructor_name || '', instructor_phone || '', schedule_days || '', schedule_time || '',
                    delivery_mode || 'in_person', status || 'active', Number(max_seats) || 30,
                    location || '', notes || ''
                ]
            );
            res.json({ id: result.lastID, batch_code: code, message: 'Batch created successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT update batch
    router.put('/batches/:id', authenticateToken, async (req, res) => {
        const {
            course_id, batch_name, batch_code, start_date, end_date,
            instructor_name, instructor_phone, schedule_days, schedule_time,
            delivery_mode, status, max_seats, location, notes
        } = req.body;
        try {
            const existing = await db.get('SELECT * FROM batches WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Batch not found' });

            await db.run(
                `UPDATE batches SET
                    course_id=?, batch_name=?, batch_code=?, start_date=?, end_date=?,
                    instructor_name=?, instructor_phone=?, schedule_days=?, schedule_time=?,
                    delivery_mode=?, status=?, max_seats=?, location=?, notes=?
                 WHERE id=?`,
                [
                    course_id || existing.course_id,
                    batch_name || existing.batch_name,
                    batch_code !== undefined ? batch_code : existing.batch_code,
                    start_date !== undefined ? (start_date || null) : existing.start_date,
                    end_date !== undefined ? (end_date || null) : existing.end_date,
                    instructor_name !== undefined ? instructor_name : existing.instructor_name,
                    instructor_phone !== undefined ? instructor_phone : existing.instructor_phone,
                    schedule_days !== undefined ? schedule_days : existing.schedule_days,
                    schedule_time !== undefined ? schedule_time : existing.schedule_time,
                    delivery_mode || existing.delivery_mode || 'in_person',
                    status || existing.status || 'active',
                    Number(max_seats) > 0 ? Number(max_seats) : (existing.max_seats || 30),
                    location !== undefined ? location : existing.location,
                    notes !== undefined ? notes : existing.notes,
                    req.params.id
                ]
            );
            res.json({ message: 'Batch updated successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PATCH batch status
    router.patch('/batches/:id/status', authenticateToken, async (req, res) => {
        const { status } = req.body;
        try {
            await db.run('UPDATE batches SET status = ? WHERE id = ?', [status, req.params.id]);
            res.json({ message: 'Batch status updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // DELETE batch
    router.delete('/batches/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('UPDATE program_applications SET batch_id = NULL WHERE batch_id = ?', [req.params.id]);
            await db.run('DELETE FROM batches WHERE id = ?', [req.params.id]);
            res.json({ message: 'Batch deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // ════════════════════════════════════════════════════════
    //   APPLICATIONS
    // ════════════════════════════════════════════════════════

    // GET all applications (with program & batch metadata)
    router.get('/applications', authenticateToken, async (req, res) => {
        try {
            const apps = await db.all(`
                SELECT pa.*,
                    c.title AS program_title,
                    c.program_code,
                    c.category AS program_category,
                    c.fee AS program_fee,
                    c.certification AS program_certification,
                    b.batch_name,
                    b.batch_code,
                    b.start_date AS batch_start_date
                FROM program_applications pa
                LEFT JOIN courses c ON pa.course_id = c.id
                LEFT JOIN batches b ON pa.batch_id = b.id
                ORDER BY pa.id DESC
            `);
            res.json(apps);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET single application
    router.get('/applications/:id', authenticateToken, async (req, res) => {
        try {
            const app = await db.get(`
                SELECT pa.*,
                    c.title AS program_title,
                    c.program_code,
                    c.category AS program_category,
                    c.fee AS program_fee,
                    c.location AS program_location,
                    c.duration_weeks,
                    c.duration_type,
                    c.coordinator_name,
                    b.batch_name,
                    b.batch_code,
                    b.instructor_name,
                    b.start_date AS batch_start_date,
                    b.end_date AS batch_end_date
                FROM program_applications pa
                LEFT JOIN courses c ON pa.course_id = c.id
                LEFT JOIN batches b ON pa.batch_id = b.id
                WHERE pa.id = ?
            `, [req.params.id]);
            if (!app) return res.status(404).json({ message: 'Application not found' });
            res.json(app);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET applications for a specific program
    router.get('/programs/:id/applications', authenticateToken, async (req, res) => {
        try {
            const apps = await db.all(`
                SELECT pa.*,
                    c.title AS program_title,
                    c.program_code,
                    b.batch_name,
                    b.batch_code
                FROM program_applications pa
                LEFT JOIN courses c ON pa.course_id = c.id
                LEFT JOIN batches b ON pa.batch_id = b.id
                WHERE pa.course_id = ?
                ORDER BY pa.id DESC
            `, [req.params.id]);
            res.json(apps);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST create application
    router.post('/applications', authenticateToken, async (req, res) => {
        const {
            course_id, batch_id, application_no, applicant_name, applicant_phone, whatsapp_number,
            applicant_email, applicant_dob, applicant_age, applicant_gender, applicant_address,
            city, guardian_name, guardian_phone, emergency_contact, nic_number,
            education_level, occupation, monthly_family_income, beneficiary_id,
            fee_status, fee_paid, attendance_pct, grade_result, certificate_issued,
            certificate_no, motivation, notes, status, custom_data
        } = req.body;

        if (!course_id || !applicant_name || !String(applicant_name).trim()) {
            return res.status(400).json({ message: 'Program and Applicant Name are required' });
        }

        try {
            const appNo = (application_no && String(application_no).trim())
                ? String(application_no).trim()
                : await nextApplicationNo();

            let certNo = certificate_no || null;
            if (Number(certificate_issued) === 1 && !certNo) {
                certNo = `CERT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
            }

            const result = await db.run(
                `INSERT INTO program_applications (
                    course_id, batch_id, application_no, applicant_name, applicant_phone, whatsapp_number,
                    applicant_email, applicant_dob, applicant_age, applicant_gender, applicant_address,
                    city, guardian_name, guardian_phone, emergency_contact, nic_number,
                    education_level, occupation, monthly_family_income, beneficiary_id,
                    fee_status, fee_paid, attendance_pct, grade_result, certificate_issued,
                    certificate_no, motivation, notes, status, custom_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    Number(course_id),
                    batch_id ? Number(batch_id) : null,
                    appNo,
                    String(applicant_name).trim(),
                    applicant_phone || '',
                    whatsapp_number || '',
                    applicant_email || '',
                    applicant_dob || null,
                    applicant_age ? Number(applicant_age) : null,
                    applicant_gender || '',
                    applicant_address || '',
                    city || '',
                    guardian_name || '',
                    guardian_phone || '',
                    emergency_contact || '',
                    nic_number || '',
                    education_level || '',
                    occupation || '',
                    Number(monthly_family_income) || 0,
                    beneficiary_id ? Number(beneficiary_id) : null,
                    fee_status || 'free',
                    Number(fee_paid) || 0,
                    Number(attendance_pct) || 0,
                    grade_result || 'pending',
                    certificate_issued ? 1 : 0,
                    certNo,
                    motivation || '',
                    notes || '',
                    status || 'pending',
                    typeof custom_data === 'object' && custom_data !== null ? JSON.stringify(custom_data) : (custom_data || null)
                ]
            );
            res.json({ id: result.lastID, application_no: appNo, message: 'Application submitted successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT update application
    router.put('/applications/:id', authenticateToken, async (req, res) => {
        const {
            course_id, batch_id, application_no, applicant_name, applicant_phone, whatsapp_number,
            applicant_email, applicant_dob, applicant_age, applicant_gender, applicant_address,
            city, guardian_name, guardian_phone, emergency_contact, nic_number,
            education_level, occupation, monthly_family_income, beneficiary_id,
            fee_status, fee_paid, attendance_pct, grade_result, certificate_issued,
            certificate_no, motivation, notes, status, custom_data
        } = req.body;

        try {
            const existing = await db.get('SELECT * FROM program_applications WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Application not found' });

            const appNo = (application_no && String(application_no).trim())
                ? String(application_no).trim()
                : (existing.application_no || `APP-${new Date().getFullYear()}-${String(existing.id).padStart(4, '0')}`);

            const certIssued = certificate_issued !== undefined ? (certificate_issued ? 1 : 0) : (existing.certificate_issued || 0);
            let certNo = certificate_no !== undefined ? certificate_no : existing.certificate_no;
            if (certIssued === 1 && !certNo) {
                certNo = `CERT-${new Date().getFullYear()}-${String(existing.id).padStart(4, '0')}`;
            }

            await db.run(
                `UPDATE program_applications SET
                    course_id=?, batch_id=?, application_no=?, applicant_name=?, applicant_phone=?, whatsapp_number=?,
                    applicant_email=?, applicant_dob=?, applicant_age=?, applicant_gender=?, applicant_address=?,
                    city=?, guardian_name=?, guardian_phone=?, emergency_contact=?, nic_number=?,
                    education_level=?, occupation=?, monthly_family_income=?, beneficiary_id=?,
                    fee_status=?, fee_paid=?, attendance_pct=?, grade_result=?, certificate_issued=?,
                    certificate_no=?, motivation=?, notes=?, status=?, custom_data=?
                 WHERE id=?`,
                [
                    course_id ? Number(course_id) : existing.course_id,
                    batch_id !== undefined ? (batch_id ? Number(batch_id) : null) : existing.batch_id,
                    appNo,
                    applicant_name ? String(applicant_name).trim() : existing.applicant_name,
                    applicant_phone !== undefined ? applicant_phone : existing.applicant_phone,
                    whatsapp_number !== undefined ? whatsapp_number : existing.whatsapp_number,
                    applicant_email !== undefined ? applicant_email : existing.applicant_email,
                    applicant_dob !== undefined ? (applicant_dob || null) : existing.applicant_dob,
                    applicant_age !== undefined ? (applicant_age ? Number(applicant_age) : null) : existing.applicant_age,
                    applicant_gender !== undefined ? applicant_gender : existing.applicant_gender,
                    applicant_address !== undefined ? applicant_address : existing.applicant_address,
                    city !== undefined ? city : existing.city,
                    guardian_name !== undefined ? guardian_name : existing.guardian_name,
                    guardian_phone !== undefined ? guardian_phone : existing.guardian_phone,
                    emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
                    nic_number !== undefined ? nic_number : existing.nic_number,
                    education_level !== undefined ? education_level : existing.education_level,
                    occupation !== undefined ? occupation : existing.occupation,
                    monthly_family_income !== undefined ? (Number(monthly_family_income) || 0) : (existing.monthly_family_income || 0),
                    beneficiary_id !== undefined ? (beneficiary_id ? Number(beneficiary_id) : null) : existing.beneficiary_id,
                    fee_status || existing.fee_status || 'free',
                    fee_paid !== undefined ? (Number(fee_paid) || 0) : (existing.fee_paid || 0),
                    attendance_pct !== undefined ? (Number(attendance_pct) || 0) : (existing.attendance_pct || 0),
                    grade_result || existing.grade_result || 'pending',
                    certIssued,
                    certNo,
                    motivation !== undefined ? motivation : existing.motivation,
                    notes !== undefined ? notes : existing.notes,
                    status || existing.status || 'pending',
                    custom_data !== undefined
                        ? (typeof custom_data === 'object' && custom_data !== null ? JSON.stringify(custom_data) : custom_data)
                        : existing.custom_data,
                    req.params.id
                ]
            );
            res.json({ message: 'Application updated successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PATCH application status / quick actions (status, batch_id, attendance_pct, certificate_issued)
    router.patch('/applications/:id/status', authenticateToken, async (req, res) => {
        const { status, batch_id, attendance_pct, certificate_issued, notes } = req.body;
        try {
            const existing = await db.get('SELECT * FROM program_applications WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Application not found' });

            const newStatus = status || existing.status;
            const newBatch = batch_id !== undefined ? (batch_id ? Number(batch_id) : null) : existing.batch_id;
            const newAtt = attendance_pct !== undefined ? Number(attendance_pct) : existing.attendance_pct;
            const newCert = certificate_issued !== undefined ? (certificate_issued ? 1 : 0) : existing.certificate_issued;
            let certNo = existing.certificate_no;
            if (newCert === 1 && !certNo) {
                certNo = `CERT-${new Date().getFullYear()}-${String(existing.id).padStart(4, '0')}`;
            }
            const newNotes = notes !== undefined ? notes : existing.notes;
            const reviewer = req.user ? (req.user.full_name || req.user.username) : 'Admin';

            await db.run(
                `UPDATE program_applications
                 SET status=?, batch_id=?, attendance_pct=?, certificate_issued=?, certificate_no=?, notes=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP
                 WHERE id=?`,
                [newStatus, newBatch, newAtt, newCert, certNo, newNotes, reviewer, req.params.id]
            );
            res.json({ message: 'Application updated', status: newStatus, certificate_no: certNo });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT bulk status / batch / certificate update for applications
    router.put('/applications-bulk/update', authenticateToken, async (req, res) => {
        const { ids, status, batch_id, certificate_issued } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: 'No applications selected' });
        }
        try {
            const placeholders = ids.map(() => '?').join(',');
            const reviewer = req.user ? (req.user.full_name || req.user.username) : 'Admin';

            if (status) {
                await db.run(
                    `UPDATE program_applications SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
                    [status, reviewer, ...ids]
                );
            }
            if (batch_id !== undefined) {
                await db.run(
                    `UPDATE program_applications SET batch_id=? WHERE id IN (${placeholders})`,
                    [batch_id ? Number(batch_id) : null, ...ids]
                );
            }
            if (certificate_issued !== undefined) {
                const flag = certificate_issued ? 1 : 0;
                await db.run(
                    `UPDATE program_applications SET certificate_issued=? WHERE id IN (${placeholders})`,
                    [flag, ...ids]
                );
                if (flag === 1) {
                    const yr = new Date().getFullYear();
                    for (const appId of ids) {
                        await db.run(
                            `UPDATE program_applications SET certificate_no = COALESCE(certificate_no, ?) WHERE id = ?`,
                            [`CERT-${yr}-${String(appId).padStart(4, '0')}`, appId]
                        );
                    }
                }
            }
            res.json({ message: `Updated ${ids.length} application(s)` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST bulk delete applications
    router.post('/applications-bulk/delete', authenticateToken, async (req, res) => {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: 'No applications selected' });
        }
        try {
            const placeholders = ids.map(() => '?').join(',');
            await db.run(`DELETE FROM program_applications WHERE id IN (${placeholders})`, ids);
            res.json({ message: `Deleted ${ids.length} application(s)` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // DELETE single application
    router.delete('/applications/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM program_applications WHERE id = ?', [req.params.id]);
            res.json({ message: 'Application deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // ════════════════════════════════════════════════════════
    //   STATS & DIRECTORY LOOKUP
    // ════════════════════════════════════════════════════════

    // GET comprehensive program & application stats
    router.get('/programs-stats', authenticateToken, async (req, res) => {
        try {
            const [
                progStats,
                batchStats,
                appStats
            ] = await Promise.all([
                db.get(`
                    SELECT
                        COUNT(*) AS totalPrograms,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activePrograms,
                        SUM(CASE WHEN status = 'upcoming' THEN 1 ELSE 0 END) AS upcomingPrograms,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedPrograms,
                        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactivePrograms,
                        COALESCE(SUM(max_capacity), 0) AS totalCapacity
                    FROM courses
                `),
                db.get(`
                    SELECT
                        COUNT(*) AS totalBatches,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeBatches,
                        COALESCE(SUM(max_seats), 0) AS totalBatchSeats
                    FROM batches
                `),
                db.get(`
                    SELECT
                        COUNT(*) AS totalApplicants,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingApplications,
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedApplications,
                        SUM(CASE WHEN status = 'enrolled' THEN 1 ELSE 0 END) AS enrolledApplications,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedApplications,
                        SUM(CASE WHEN status = 'waitlisted' THEN 1 ELSE 0 END) AS waitlistedApplications,
                        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedApplications,
                        SUM(CASE WHEN status IN ('approved', 'enrolled', 'completed') THEN 1 ELSE 0 END) AS totalEnrolledOrApproved,
                        SUM(CASE WHEN certificate_issued = 1 THEN 1 ELSE 0 END) AS certificatesIssued,
                        SUM(CASE WHEN fee_status IN ('free', 'scholarship', 'waived') THEN 1 ELSE 0 END) AS scholarshipCount,
                        COALESCE(SUM(fee_paid), 0) AS totalFeeCollected
                    FROM program_applications
                `)
            ]);

            res.json({
                totalPrograms: progStats?.totalPrograms || 0,
                activePrograms: progStats?.activePrograms || 0,
                upcomingPrograms: progStats?.upcomingPrograms || 0,
                completedPrograms: progStats?.completedPrograms || 0,
                inactivePrograms: progStats?.inactivePrograms || 0,
                totalCapacity: progStats?.totalCapacity || 0,
                totalBatches: batchStats?.totalBatches || 0,
                activeBatches: batchStats?.activeBatches || 0,
                totalBatchSeats: batchStats?.totalBatchSeats || 0,
                totalApplicants: appStats?.totalApplicants || 0,
                pendingApplications: appStats?.pendingApplications || 0,
                approvedApplications: appStats?.approvedApplications || 0,
                enrolledApplications: appStats?.enrolledApplications || 0,
                completedApplications: appStats?.completedApplications || 0,
                waitlistedApplications: appStats?.waitlistedApplications || 0,
                rejectedApplications: appStats?.rejectedApplications || 0,
                totalEnrolledOrApproved: appStats?.totalEnrolledOrApproved || 0,
                certificatesIssued: appStats?.certificatesIssued || 0,
                scholarshipCount: appStats?.scholarshipCount || 0,
                totalFeeCollected: appStats?.totalFeeCollected || 0
            });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET directory lookup (Beneficiaries, Families, Members) for quick-filling New Application modal
    router.get('/directory-lookup', authenticateToken, async (req, res) => {
        try {
            const [beneficiaries, families, members] = await Promise.all([
                db.all(`
                    SELECT id, application_number, male_head_name, female_head_name,
                           male_head_gender, male_head_age, male_head_dob,
                           contact_number, nic_number, male_head_address, home_town,
                           monthly_income, male_head_occupation
                    FROM beneficiaries
                    ORDER BY id DESC LIMIT 300
                `).catch(() => []),
                db.all(`
                    SELECT id, family_code, head_name, head_gender, head_dob, head_age,
                           phone, whatsapp, nic_number, address, city, monthly_income, head_occupation
                    FROM families
                    ORDER BY id DESC LIMIT 300
                `).catch(() => []),
                db.all(`
                    SELECT id, membership_no, full_name, gender, dob, age,
                           phone, whatsapp, email, nic_number, address, city, occupation, monthly_income
                    FROM members
                    ORDER BY id DESC LIMIT 200
                `).catch(() => [])
            ]);

            const records = [];
            for (const b of beneficiaries) {
                const name = b.male_head_name || b.female_head_name;
                if (!name) continue;
                records.push({
                    source: 'beneficiary',
                    source_label: `Beneficiary ${b.application_number || '#' + b.id}`,
                    beneficiary_id: b.id,
                    name,
                    gender: b.male_head_gender ? b.male_head_gender.toLowerCase() : (b.male_head_name ? 'male' : 'female'),
                    dob: b.male_head_dob || '',
                    age: b.male_head_age || '',
                    phone: b.contact_number || '',
                    whatsapp: b.contact_number || '',
                    email: '',
                    nic: b.nic_number || '',
                    address: b.male_head_address || '',
                    city: b.home_town || '',
                    occupation: b.male_head_occupation || '',
                    income: b.monthly_income || 0,
                    guardian_name: b.male_head_name && b.female_head_name ? b.female_head_name : ''
                });
            }
            for (const f of families) {
                if (!f.head_name) continue;
                records.push({
                    source: 'family',
                    source_label: `Family ${f.family_code || '#' + f.id}`,
                    beneficiary_id: null,
                    name: f.head_name,
                    gender: (f.head_gender || '').toLowerCase(),
                    dob: f.head_dob || '',
                    age: f.head_age || '',
                    phone: f.phone || '',
                    whatsapp: f.whatsapp || f.phone || '',
                    email: '',
                    nic: f.nic_number || '',
                    address: f.address || '',
                    city: f.city || '',
                    occupation: f.head_occupation || '',
                    income: f.monthly_income || 0,
                    guardian_name: ''
                });
            }
            for (const m of members) {
                if (!m.full_name) continue;
                records.push({
                    source: 'member',
                    source_label: `EDF Member ${m.membership_no || '#' + m.id}`,
                    beneficiary_id: null,
                    name: m.full_name,
                    gender: (m.gender || '').toLowerCase(),
                    dob: m.dob || '',
                    age: m.age || '',
                    phone: m.phone || '',
                    whatsapp: m.whatsapp || m.phone || '',
                    email: m.email || '',
                    nic: m.nic_number || '',
                    address: m.address || '',
                    city: m.city || '',
                    occupation: m.occupation || '',
                    income: m.monthly_income || 0,
                    guardian_name: ''
                });
            }

            res.json(records);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    return router;
};

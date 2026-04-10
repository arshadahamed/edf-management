const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // ── DB Migration (run once) ──────────────────────────────────────────────
    db.exec(`
        ALTER TABLE courses ADD COLUMN description TEXT;
    `).catch(() => {}); // column may already exist

    db.exec(`
        ALTER TABLE courses ADD COLUMN max_capacity INTEGER DEFAULT 30;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE courses ADD COLUMN fee REAL DEFAULT 0;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE courses ADD COLUMN location TEXT;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE courses ADD COLUMN duration_weeks INTEGER DEFAULT 8;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE courses ADD COLUMN duration_type TEXT DEFAULT 'weeks';
    `).catch(() => {});

    db.exec(`
        ALTER TABLE batches ADD COLUMN max_seats INTEGER DEFAULT 30;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE batches ADD COLUMN location TEXT;
    `).catch(() => {});

    db.exec(`
        ALTER TABLE program_applications ADD COLUMN custom_data TEXT;
    `).catch(() => {});

    db.exec(`
        CREATE TABLE IF NOT EXISTS program_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            batch_id INTEGER,
            applicant_name TEXT NOT NULL,
            applicant_phone TEXT,
            applicant_email TEXT,
            applicant_age INTEGER,
            applicant_gender TEXT,
            applicant_address TEXT,
            guardian_name TEXT,
            guardian_phone TEXT,
            nic_number TEXT,
            education_level TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            custom_data TEXT, -- JSON string for dynamic form fields
            applied_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
        );
    `).catch(() => {});

    // ════════════════════════════════════════════════════════
    //   PROGRAMS / COURSES
    // ════════════════════════════════════════════════════════

    // GET all programs (with batch count + applicant count)
    router.get('/programs', authenticateToken, async (req, res) => {
        try {
            const programs = await db.all(`
                SELECT c.*,
                    COUNT(DISTINCT b.id)  AS batch_count,
                    COUNT(DISTINCT pa.id) AS applicant_count,
                    SUM(CASE WHEN pa.status = 'approved' THEN 1 ELSE 0 END) AS enrolled_count
                FROM courses c
                LEFT JOIN batches b ON b.course_id = c.id
                LEFT JOIN program_applications pa ON pa.course_id = c.id
                GROUP BY c.id
                ORDER BY c.created_at DESC
            `);
            res.json(programs);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET single program
    router.get('/programs/:id', authenticateToken, async (req, res) => {
        try {
            const program = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
            if (!program) return res.status(404).json({ message: 'Program not found' });
            const batches = await db.all(`
                SELECT b.*,
                    COUNT(pa.id) AS applicant_count
                FROM batches b
                LEFT JOIN program_applications pa ON pa.batch_id = b.id
                WHERE b.course_id = ?
                GROUP BY b.id
                ORDER BY b.start_date ASC
            `, [req.params.id]);
            res.json({ ...program, batches });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST create program
    router.post('/programs', authenticateToken, async (req, res) => {
        const { title, category, target_audience, description, status, max_capacity, fee, location, duration_weeks, duration_type, form_template_id } = req.body;
        try {
            const result = await db.run(
                `INSERT INTO courses (title, category, target_audience, description, status, max_capacity, fee, location, duration_weeks, duration_type, form_template_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, category, target_audience, description, status || 'active', max_capacity || 30, fee || 0, location, duration_weeks || 8, duration_type || 'weeks', form_template_id || null]
            );
            res.json({ id: result.lastID, message: 'Program created successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT update program
    router.put('/programs/:id', authenticateToken, async (req, res) => {
        const { title, category, target_audience, description, status, max_capacity, fee, location, duration_weeks, duration_type, form_template_id } = req.body;
        try {
            await db.run(
                `UPDATE courses SET title=?, category=?, target_audience=?, description=?, status=?,
                 max_capacity=?, fee=?, location=?, duration_weeks=?, duration_type=?, form_template_id=? WHERE id=?`,
                [title, category, target_audience, description, status, max_capacity, fee, location, duration_weeks, duration_type || 'weeks', form_template_id || null, req.params.id]
            );
            res.json({ message: 'Program updated successfully' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // DELETE program
    router.delete('/programs/:id', authenticateToken, async (req, res) => {
        try {
            // Manually delete related records to be safe (if FK cascade not set up on all tables)
            await db.run('DELETE FROM batches WHERE course_id = ?', [req.params.id]);
            await db.run('DELETE FROM program_applications WHERE course_id = ?', [req.params.id]);
            await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
            res.json({ message: 'Program and all associated data deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // ════════════════════════════════════════════════════════
    //   BATCHES
    // ════════════════════════════════════════════════════════

    router.get('/programs/:id/batches', authenticateToken, async (req, res) => {
        try {
            const batches = await db.all(`
                SELECT b.*, COUNT(pa.id) AS applicant_count
                FROM batches b
                LEFT JOIN program_applications pa ON pa.batch_id = b.id
                WHERE b.course_id = ?
                GROUP BY b.id
                ORDER BY b.start_date ASC
            `, [req.params.id]);
            res.json(batches);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/programs/:id/batches', authenticateToken, async (req, res) => {
        const { batch_name, start_date, end_date, instructor_name, status, max_seats, location } = req.body;
        try {
            const result = await db.run(
                `INSERT INTO batches (course_id, batch_name, start_date, end_date, instructor_name, status, max_seats, location)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.params.id, batch_name, start_date, end_date, instructor_name, status || 'active', max_seats || 30, location]
            );
            res.json({ id: result.lastID, message: 'Batch created' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.put('/batches/:id', authenticateToken, async (req, res) => {
        const { batch_name, start_date, end_date, instructor_name, status, max_seats, location } = req.body;
        try {
            await db.run(
                `UPDATE batches SET batch_name=?, start_date=?, end_date=?, instructor_name=?, status=?, max_seats=?, location=? WHERE id=?`,
                [batch_name, start_date, end_date, instructor_name, status, max_seats, location, req.params.id]
            );
            res.json({ message: 'Batch updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.delete('/batches/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM batches WHERE id = ?', [req.params.id]);
            res.json({ message: 'Batch deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // ════════════════════════════════════════════════════════
    //   APPLICATIONS
    // ════════════════════════════════════════════════════════

    // GET all applications (with program/batch name)
    router.get('/applications', authenticateToken, async (req, res) => {
        try {
            const apps = await db.all(`
                SELECT pa.*, c.title AS program_title, b.batch_name
                FROM program_applications pa
                LEFT JOIN courses c ON pa.course_id = c.id
                LEFT JOIN batches b ON pa.batch_id = b.id
                ORDER BY pa.applied_date DESC
            `);
            res.json(apps);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET applications for a specific program
    router.get('/programs/:id/applications', authenticateToken, async (req, res) => {
        try {
            const apps = await db.all(`
                SELECT pa.*, b.batch_name
                FROM program_applications pa
                LEFT JOIN batches b ON pa.batch_id = b.id
                WHERE pa.course_id = ?
                ORDER BY pa.applied_date DESC
            `, [req.params.id]);
            res.json(apps);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // POST create application
    router.post('/applications', authenticateToken, async (req, res) => {
        const {
            course_id, batch_id, applicant_name, applicant_phone, applicant_email,
            applicant_age, applicant_gender, applicant_address, guardian_name,
            guardian_phone, nic_number, education_level, notes, status, custom_data
        } = req.body;
        try {
            const result = await db.run(
                `INSERT INTO program_applications
                 (course_id, batch_id, applicant_name, applicant_phone, applicant_email,
                  applicant_age, applicant_gender, applicant_address, guardian_name,
                  guardian_phone, nic_number, education_level, notes, status, custom_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [course_id, batch_id || null, applicant_name, applicant_phone, applicant_email,
                 applicant_age, applicant_gender, applicant_address, guardian_name,
                 guardian_phone, nic_number, education_level, notes, status || 'pending', custom_data || null]
            );
            res.json({ id: result.lastID, message: 'Application submitted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PUT update application
    router.put('/applications/:id', authenticateToken, async (req, res) => {
        const {
            course_id, batch_id, applicant_name, applicant_phone, applicant_email,
            applicant_age, applicant_gender, applicant_address, guardian_name,
            guardian_phone, nic_number, education_level, notes, status, custom_data
        } = req.body;
        try {
            await db.run(
                `UPDATE program_applications SET
                 course_id=?, batch_id=?, applicant_name=?, applicant_phone=?, applicant_email=?,
                 applicant_age=?, applicant_gender=?, applicant_address=?, guardian_name=?,
                 guardian_phone=?, nic_number=?, education_level=?, notes=?, status=?, custom_data=?
                 WHERE id=?`,
                [course_id, batch_id || null, applicant_name, applicant_phone, applicant_email,
                 applicant_age, applicant_gender, applicant_address, guardian_name,
                 guardian_phone, nic_number, education_level, notes, status, custom_data || null, req.params.id]
            );
            res.json({ message: 'Application updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // PATCH status only
    router.patch('/applications/:id/status', authenticateToken, async (req, res) => {
        const { status } = req.body;
        try {
            await db.run('UPDATE program_applications SET status=? WHERE id=?', [status, req.params.id]);
            res.json({ message: 'Status updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // DELETE application
    router.delete('/applications/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM program_applications WHERE id = ?', [req.params.id]);
            res.json({ message: 'Application deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // GET program stats
    router.get('/programs-stats', authenticateToken, async (req, res) => {
        try {
            const totalPrograms = await db.get('SELECT COUNT(*) as count FROM courses');
            const activePrograms = await db.get("SELECT COUNT(*) as count FROM courses WHERE status='active'");
            const totalBatches = await db.get('SELECT COUNT(*) as count FROM batches');
            const totalApplicants = await db.get('SELECT COUNT(*) as count FROM program_applications');
            const pendingApps = await db.get("SELECT COUNT(*) as count FROM program_applications WHERE status='pending'");
            const approvedApps = await db.get("SELECT COUNT(*) as count FROM program_applications WHERE status='approved'");
            res.json({
                totalPrograms: totalPrograms.count,
                activePrograms: activePrograms.count,
                totalBatches: totalBatches.count,
                totalApplicants: totalApplicants.count,
                pendingApplications: pendingApps.count,
                approvedApplications: approvedApps.count
            });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    return router;
};

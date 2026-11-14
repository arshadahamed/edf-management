const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');

const VALID_ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused']);

/**
 * Generates sequential readable codes (e.g., MLM-001, CLS-001, MDR-2026-001).
 */
async function generateNextCode(db, table, column, prefix) {
    const row = await db.get(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`);
    let seq = (row?.max_id || 0) + 1;
    while (seq < 100000) {
        const candidate = `${prefix}-${String(seq).padStart(3, '0')}`;
        const exists = await db.get(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [candidate]);
        if (!exists) return candidate;
        seq++;
    }
    return `${prefix}-${Date.now()}`;
}

function handleSqliteConstraint(res, err, duplicateMsg) {
    if (err && /UNIQUE constraint failed/i.test(err.message || '')) {
        return res.status(409).json({ error: duplicateMsg });
    }
    console.error('[Madrasa API]', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
}

module.exports = (db) => {
    const router = express.Router();

    // ── Dashboard Stats ──────────────────────────────────────────────────────────
    router.get('/stats', authenticateToken, async (_req, res) => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const [clsStats, stuStats, mlmStats, attToday, levelBreakdown] = await Promise.all([
                db.get(`SELECT
                    COUNT(*) AS total_classes,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_classes
                FROM madrasa_classes`),
                db.get(`SELECT
                    COUNT(*) AS total_students,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_students
                FROM madrasa_students`),
                db.get(`SELECT
                    COUNT(*) AS total_muallimahs,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_muallimahs
                FROM madrasa_muallimahs`),
                db.get(`SELECT
                    COUNT(*) AS today_marked,
                    SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS today_present,
                    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS today_absent
                FROM madrasa_attendance WHERE attendance_date = ?`, [today]),
                db.all(`SELECT level, COUNT(*) AS cnt FROM madrasa_classes GROUP BY level ORDER BY cnt DESC`)
            ]);

            const marked = attToday?.today_marked || 0;
            const present = attToday?.today_present || 0;
            const ratePct = marked > 0 ? Math.round((present / marked) * 100) : 0;

            res.json({
                today,
                total_classes: clsStats?.total_classes || 0,
                active_classes: clsStats?.active_classes || 0,
                total_students: stuStats?.total_students || 0,
                active_students: stuStats?.active_students || 0,
                total_muallimahs: mlmStats?.total_muallimahs || 0,
                active_muallimahs: mlmStats?.active_muallimahs || 0,
                today_marked: marked,
                today_present: present,
                today_absent: attToday?.today_absent || 0,
                today_rate_pct: ratePct,
                level_breakdown: levelBreakdown || []
            });
        } catch (err) {
            console.error('[Madrasa stats]', err);
            res.status(500).json({ error: 'Failed to load Madrasa stats' });
        }
    });

    // ── Muallimah Management CRUD ────────────────────────────────────────────────
    router.get('/muallimahs', authenticateToken, async (req, res) => {
        try {
            const { search = '', status = '' } = req.query;
            const where = ['1=1'];
            const params = [];
            if (status) {
                where.push('m.status = ?');
                params.push(status);
            }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                where.push('(m.full_name LIKE ? OR m.staff_code LIKE ? OR m.phone LIKE ? OR m.specialization LIKE ? OR m.qualification LIKE ?)');
                params.push(q, q, q, q, q);
            }

            const rows = await db.all(`
                SELECT
                    m.*,
                    COUNT(DISTINCT c.id) AS class_count,
                    GROUP_CONCAT(DISTINCT c.class_name) AS assigned_classes
                FROM madrasa_muallimahs m
                LEFT JOIN madrasa_classes c ON c.muallimah_id = m.id
                WHERE ${where.join(' AND ')}
                GROUP BY m.id
                ORDER BY m.status = 'active' DESC, m.full_name ASC
            `, params);

            res.json(rows);
        } catch (err) {
            console.error('[Madrasa GET muallimahs]', err);
            res.status(500).json({ error: 'Failed to fetch muallimahs' });
        }
    });

    router.post('/muallimahs', authenticateToken, async (req, res) => {
        try {
            const {
                staff_code, full_name, phone, email, nic_number,
                qualification, specialization, monthly_stipend, join_date,
                address, status, notes
            } = req.body;

            if (!full_name || !String(full_name).trim()) {
                return res.status(400).json({ error: 'Muallimah full name is required' });
            }

            const code = (staff_code && String(staff_code).trim())
                ? String(staff_code).trim()
                : await generateNextCode(db, 'madrasa_muallimahs', 'staff_code', 'MLM');

            const result = await db.run(
                `INSERT INTO madrasa_muallimahs
                    (staff_code, full_name, phone, email, nic_number, qualification, specialization, monthly_stipend, join_date, address, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    code,
                    String(full_name).trim(),
                    String(phone || '').trim(),
                    String(email || '').trim(),
                    String(nic_number || '').trim(),
                    String(qualification || '').trim(),
                    String(specialization || 'Quran & Tajweed').trim(),
                    Number(monthly_stipend) || 0,
                    join_date || new Date().toISOString().slice(0, 10),
                    String(address || '').trim(),
                    ['active', 'on_leave', 'inactive'].includes(status) ? status : 'active',
                    String(notes || '').trim()
                ]
            );
            const created = await db.get('SELECT * FROM madrasa_muallimahs WHERE id = ?', [result.lastID]);
            res.status(201).json({ id: result.lastID, muallimah: created, message: 'Muallimah registered successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Staff code already exists for another Muallimah');
        }
    });

    router.put('/muallimahs/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM madrasa_muallimahs WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Muallimah not found' });

            const b = req.body;
            if (b.full_name !== undefined && !String(b.full_name).trim()) {
                return res.status(400).json({ error: 'Full name cannot be empty' });
            }

            await db.run(
                `UPDATE madrasa_muallimahs
                 SET staff_code = ?, full_name = ?, phone = ?, email = ?, nic_number = ?,
                     qualification = ?, specialization = ?, monthly_stipend = ?, join_date = ?,
                     address = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    b.staff_code !== undefined ? (String(b.staff_code).trim() || existing.staff_code) : existing.staff_code,
                    b.full_name !== undefined ? String(b.full_name).trim() : existing.full_name,
                    b.phone !== undefined ? String(b.phone).trim() : existing.phone,
                    b.email !== undefined ? String(b.email).trim() : existing.email,
                    b.nic_number !== undefined ? String(b.nic_number).trim() : existing.nic_number,
                    b.qualification !== undefined ? String(b.qualification).trim() : existing.qualification,
                    b.specialization !== undefined ? String(b.specialization).trim() : existing.specialization,
                    b.monthly_stipend !== undefined ? (Number(b.monthly_stipend) || 0) : existing.monthly_stipend,
                    b.join_date !== undefined ? b.join_date : existing.join_date,
                    b.address !== undefined ? String(b.address).trim() : existing.address,
                    ['active', 'on_leave', 'inactive'].includes(b.status) ? b.status : existing.status,
                    b.notes !== undefined ? String(b.notes).trim() : existing.notes,
                    id
                ]
            );
            const updated = await db.get('SELECT * FROM madrasa_muallimahs WHERE id = ?', [id]);
            res.json({ muallimah: updated, message: 'Muallimah updated successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Staff code already exists for another Muallimah');
        }
    });

    router.delete('/muallimahs/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT id, full_name FROM madrasa_muallimahs WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Muallimah not found' });
            await db.run('UPDATE madrasa_classes SET muallimah_id = NULL WHERE muallimah_id = ?', [id]);
            await db.run('DELETE FROM madrasa_muallimahs WHERE id = ?', [id]);
            res.json({ message: `Muallimah "${existing.full_name}" removed successfully` });
        } catch (err) {
            console.error('[Madrasa DELETE muallimah]', err);
            res.status(500).json({ error: 'Failed to delete muallimah' });
        }
    });

    // ── Class / Halqah Management CRUD ───────────────────────────────────────────
    router.get('/classes', authenticateToken, async (req, res) => {
        try {
            const { search = '', level = '', status = '', muallimah_id = '' } = req.query;
            const today = new Date().toISOString().slice(0, 10);
            const where = ['1=1'];
            const params = [today];
            if (level) { where.push('c.level = ?'); params.push(level); }
            if (status) { where.push('c.status = ?'); params.push(status); }
            if (muallimah_id) { where.push('c.muallimah_id = ?'); params.push(parseInt(muallimah_id, 10)); }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                where.push('(c.class_name LIKE ? OR c.class_code LIKE ? OR c.room_name LIKE ? OR COALESCE(m.full_name, "") LIKE ?)');
                params.push(q, q, q, q);
            }

            const rows = await db.all(`
                SELECT
                    c.*,
                    m.full_name AS muallimah_name,
                    m.staff_code AS muallimah_code,
                    COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) AS student_count,
                    COUNT(DISTINCT s.id) AS total_enrolled,
                    COUNT(DISTINCT CASE WHEN a.attendance_date = ? AND a.status IN ('present', 'late') THEN a.id END) AS today_present_count,
                    COUNT(DISTINCT CASE WHEN a.attendance_date = ? THEN a.id END) AS today_marked_count
                FROM madrasa_classes c
                LEFT JOIN madrasa_muallimahs m ON c.muallimah_id = m.id
                LEFT JOIN madrasa_students s ON s.class_id = c.id
                LEFT JOIN madrasa_attendance a ON a.class_id = c.id
                WHERE ${where.join(' AND ')}
                GROUP BY c.id
                ORDER BY c.status = 'active' DESC, c.class_name ASC
            `, [today, ...params]);

            res.json(rows);
        } catch (err) {
            console.error('[Madrasa GET classes]', err);
            res.status(500).json({ error: 'Failed to fetch classes' });
        }
    });

    router.post('/classes', authenticateToken, async (req, res) => {
        try {
            const {
                class_code, class_name, level, muallimah_id, schedule_days,
                schedule_time, room_name, capacity, monthly_fee, status, description
            } = req.body;

            if (!class_name || !String(class_name).trim()) {
                return res.status(400).json({ error: 'Class / Halqah name is required' });
            }

            const code = (class_code && String(class_code).trim())
                ? String(class_code).trim()
                : await generateNextCode(db, 'madrasa_classes', 'class_code', 'CLS');

            const teacherId = muallimah_id ? parseInt(muallimah_id, 10) : null;
            const result = await db.run(
                `INSERT INTO madrasa_classes
                    (class_code, class_name, level, muallimah_id, schedule_days, schedule_time, room_name, capacity, monthly_fee, status, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    code,
                    String(class_name).trim(),
                    String(level || 'Nazirah').trim(),
                    teacherId || null,
                    String(schedule_days || 'Mon - Fri').trim(),
                    String(schedule_time || '02:30 PM - 04:30 PM').trim(),
                    String(room_name || 'Main Hall').trim(),
                    Math.max(1, parseInt(capacity, 10) || 25),
                    Number(monthly_fee) || 0,
                    ['active', 'paused', 'archived'].includes(status) ? status : 'active',
                    String(description || '').trim()
                ]
            );
            const created = await db.get('SELECT * FROM madrasa_classes WHERE id = ?', [result.lastID]);
            res.status(201).json({ id: result.lastID, madrasaClass: created, message: 'Class created successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Class code already exists');
        }
    });

    router.put('/classes/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM madrasa_classes WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Class not found' });

            const b = req.body;
            if (b.class_name !== undefined && !String(b.class_name).trim()) {
                return res.status(400).json({ error: 'Class name cannot be empty' });
            }

            const nextTeacherId = b.muallimah_id !== undefined
                ? (b.muallimah_id ? parseInt(b.muallimah_id, 10) : null)
                : existing.muallimah_id;

            await db.run(
                `UPDATE madrasa_classes
                 SET class_code = ?, class_name = ?, level = ?, muallimah_id = ?, schedule_days = ?,
                     schedule_time = ?, room_name = ?, capacity = ?, monthly_fee = ?, status = ?,
                     description = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    b.class_code !== undefined ? (String(b.class_code).trim() || existing.class_code) : existing.class_code,
                    b.class_name !== undefined ? String(b.class_name).trim() : existing.class_name,
                    b.level !== undefined ? String(b.level).trim() : existing.level,
                    nextTeacherId,
                    b.schedule_days !== undefined ? String(b.schedule_days).trim() : existing.schedule_days,
                    b.schedule_time !== undefined ? String(b.schedule_time).trim() : existing.schedule_time,
                    b.room_name !== undefined ? String(b.room_name).trim() : existing.room_name,
                    b.capacity !== undefined ? Math.max(1, parseInt(b.capacity, 10) || 25) : existing.capacity,
                    b.monthly_fee !== undefined ? (Number(b.monthly_fee) || 0) : existing.monthly_fee,
                    ['active', 'paused', 'archived'].includes(b.status) ? b.status : existing.status,
                    b.description !== undefined ? String(b.description).trim() : existing.description,
                    id
                ]
            );
            const updated = await db.get('SELECT * FROM madrasa_classes WHERE id = ?', [id]);
            res.json({ madrasaClass: updated, message: 'Class updated successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Class code already exists');
        }
    });

    router.delete('/classes/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT id, class_name FROM madrasa_classes WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Class not found' });
            await db.run('UPDATE madrasa_students SET class_id = NULL WHERE class_id = ?', [id]);
            await db.run('DELETE FROM madrasa_classes WHERE id = ?', [id]);
            res.json({ message: `Class "${existing.class_name}" deleted successfully` });
        } catch (err) {
            console.error('[Madrasa DELETE class]', err);
            res.status(500).json({ error: 'Failed to delete class' });
        }
    });

    // ── Student Management CRUD ──────────────────────────────────────────────────
    router.get('/students', authenticateToken, async (req, res) => {
        try {
            const { search = '', class_id = '', status = '', fee_status = '' } = req.query;
            const where = ['1=1'];
            const params = [];
            if (class_id === 'unassigned') {
                where.push('s.class_id IS NULL');
            } else if (class_id) {
                where.push('s.class_id = ?');
                params.push(parseInt(class_id, 10));
            }
            if (status) { where.push('s.status = ?'); params.push(status); }
            if (fee_status) { where.push('s.fee_status = ?'); params.push(fee_status); }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                where.push('(s.full_name LIKE ? OR s.admission_no LIKE ? OR s.guardian_name LIKE ? OR s.guardian_phone LIKE ? OR s.current_juz_or_level LIKE ?)');
                params.push(q, q, q, q, q);
            }

            const rows = await db.all(`
                SELECT
                    s.*,
                    c.class_name,
                    c.class_code,
                    c.level AS class_level,
                    m.full_name AS muallimah_name,
                    COUNT(DISTINCT a.id) AS total_sessions,
                    SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_sessions
                FROM madrasa_students s
                LEFT JOIN madrasa_classes c ON s.class_id = c.id
                LEFT JOIN madrasa_muallimahs m ON c.muallimah_id = m.id
                LEFT JOIN madrasa_attendance a ON a.student_id = s.id AND a.attendance_date >= date('now', '-30 days')
                WHERE ${where.join(' AND ')}
                GROUP BY s.id
                ORDER BY s.status = 'active' DESC, s.full_name ASC
            `, params);

            res.json(rows.map(r => ({
                ...r,
                attendance_pct: r.total_sessions > 0 ? Math.round((r.present_sessions / r.total_sessions) * 100) : null
            })));
        } catch (err) {
            console.error('[Madrasa GET students]', err);
            res.status(500).json({ error: 'Failed to fetch students' });
        }
    });

    router.post('/students', authenticateToken, async (req, res) => {
        try {
            const {
                admission_no, full_name, gender, dob, age, class_id,
                guardian_name, guardian_phone, guardian_relation, address,
                enrollment_date, current_juz_or_level, fee_status, status, notes
            } = req.body;

            if (!full_name || !String(full_name).trim()) {
                return res.status(400).json({ error: 'Student full name is required' });
            }

            const yr = new Date().getFullYear();
            const admNo = (admission_no && String(admission_no).trim())
                ? String(admission_no).trim()
                : await generateNextCode(db, 'madrasa_students', 'admission_no', `MDR-${yr}`);

            const result = await db.run(
                `INSERT INTO madrasa_students
                    (admission_no, full_name, gender, dob, age, class_id, guardian_name, guardian_phone, guardian_relation, address, enrollment_date, current_juz_or_level, fee_status, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    admNo,
                    String(full_name).trim(),
                    gender === 'male' ? 'male' : 'female',
                    dob || null,
                    age ? parseInt(age, 10) : null,
                    class_id ? parseInt(class_id, 10) : null,
                    String(guardian_name || '').trim(),
                    String(guardian_phone || '').trim(),
                    String(guardian_relation || 'Parent').trim(),
                    String(address || '').trim(),
                    enrollment_date || new Date().toISOString().slice(0, 10),
                    String(current_juz_or_level || 'Noorani Qaida').trim(),
                    ['paid', 'pending', 'sponsored', 'exempt'].includes(fee_status) ? fee_status : 'sponsored',
                    ['active', 'graduated', 'suspended', 'withdrawn'].includes(status) ? status : 'active',
                    String(notes || '').trim()
                ]
            );
            const created = await db.get('SELECT * FROM madrasa_students WHERE id = ?', [result.lastID]);
            res.status(201).json({ id: result.lastID, student: created, message: 'Student enrolled successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Admission number already exists for another student');
        }
    });

    router.put('/students/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM madrasa_students WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Student not found' });

            const b = req.body;
            if (b.full_name !== undefined && !String(b.full_name).trim()) {
                return res.status(400).json({ error: 'Student name cannot be empty' });
            }

            const nextClassId = b.class_id !== undefined
                ? (b.class_id ? parseInt(b.class_id, 10) : null)
                : existing.class_id;

            await db.run(
                `UPDATE madrasa_students
                 SET admission_no = ?, full_name = ?, gender = ?, dob = ?, age = ?, class_id = ?,
                     guardian_name = ?, guardian_phone = ?, guardian_relation = ?, address = ?,
                     enrollment_date = ?, current_juz_or_level = ?, fee_status = ?, status = ?, notes = ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    b.admission_no !== undefined ? (String(b.admission_no).trim() || existing.admission_no) : existing.admission_no,
                    b.full_name !== undefined ? String(b.full_name).trim() : existing.full_name,
                    b.gender !== undefined ? (b.gender === 'male' ? 'male' : 'female') : existing.gender,
                    b.dob !== undefined ? (b.dob || null) : existing.dob,
                    b.age !== undefined ? (b.age ? parseInt(b.age, 10) : null) : existing.age,
                    nextClassId,
                    b.guardian_name !== undefined ? String(b.guardian_name).trim() : existing.guardian_name,
                    b.guardian_phone !== undefined ? String(b.guardian_phone).trim() : existing.guardian_phone,
                    b.guardian_relation !== undefined ? String(b.guardian_relation).trim() : existing.guardian_relation,
                    b.address !== undefined ? String(b.address).trim() : existing.address,
                    b.enrollment_date !== undefined ? (b.enrollment_date || existing.enrollment_date) : existing.enrollment_date,
                    b.current_juz_or_level !== undefined ? String(b.current_juz_or_level).trim() : existing.current_juz_or_level,
                    ['paid', 'pending', 'sponsored', 'exempt'].includes(b.fee_status) ? b.fee_status : existing.fee_status,
                    ['active', 'graduated', 'suspended', 'withdrawn'].includes(b.status) ? b.status : existing.status,
                    b.notes !== undefined ? String(b.notes).trim() : existing.notes,
                    id
                ]
            );
            const updated = await db.get('SELECT * FROM madrasa_students WHERE id = ?', [id]);
            res.json({ student: updated, message: 'Student updated successfully' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Admission number already exists for another student');
        }
    });

    router.delete('/students/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT id, full_name FROM madrasa_students WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Student not found' });
            await db.run('DELETE FROM madrasa_students WHERE id = ?', [id]);
            res.json({ message: `Student "${existing.full_name}" removed successfully` });
        } catch (err) {
            console.error('[Madrasa DELETE student]', err);
            res.status(500).json({ error: 'Failed to delete student' });
        }
    });

    // ── Attendance Roll Call Sheet & History CRUD ────────────────────────────────
    router.get('/attendance/sheet', authenticateToken, async (req, res) => {
        try {
            const classId = parseInt(req.query.class_id, 10);
            const date = req.query.date ? String(req.query.date).slice(0, 10) : new Date().toISOString().slice(0, 10);

            if (!classId) {
                return res.status(400).json({ error: 'class_id is required' });
            }

            const classInfo = await db.get(`
                SELECT c.*, m.full_name AS muallimah_name
                FROM madrasa_classes c
                LEFT JOIN madrasa_muallimahs m ON c.muallimah_id = m.id
                WHERE c.id = ?
            `, [classId]);
            if (!classInfo) return res.status(404).json({ error: 'Class not found' });

            const students = await db.all(`
                SELECT
                    s.id AS student_id,
                    s.admission_no,
                    s.full_name,
                    s.current_juz_or_level,
                    s.guardian_phone,
                    s.status AS student_status,
                    a.id AS attendance_id,
                    a.status AS attendance_status,
                    a.lesson_note,
                    a.remarks,
                    a.marked_by,
                    a.updated_at
                FROM madrasa_students s
                LEFT JOIN madrasa_attendance a
                    ON a.student_id = s.id AND a.class_id = ? AND a.attendance_date = ?
                WHERE s.class_id = ? AND s.status = 'active'
                ORDER BY s.full_name ASC
            `, [classId, date, classId]);

            const summary = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
            for (const row of students) {
                if (row.attendance_status && summary[row.attendance_status] !== undefined) {
                    summary[row.attendance_status]++;
                } else {
                    summary.unmarked++;
                }
            }

            res.json({ classInfo, date, students, summary });
        } catch (err) {
            console.error('[Madrasa attendance sheet]', err);
            res.status(500).json({ error: 'Failed to load attendance sheet' });
        }
    });

    router.post('/attendance/batch', authenticateToken, async (req, res) => {
        const { class_id, attendance_date, records } = req.body;
        const classId = parseInt(class_id, 10);
        const date = attendance_date ? String(attendance_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

        if (!classId || !Array.isArray(records) || !records.length) {
            return res.status(400).json({ error: 'class_id and non-empty records array are required' });
        }

        try {
            const cls = await db.get('SELECT id FROM madrasa_classes WHERE id = ?', [classId]);
            if (!cls) return res.status(404).json({ error: 'Class not found' });

            const marker = req.user?.username || 'admin';
            await db.run('BEGIN TRANSACTION');
            let savedCount = 0;

            for (const rec of records) {
                const studentId = parseInt(rec.student_id, 10);
                if (!studentId) continue;
                const status = VALID_ATTENDANCE_STATUSES.has(rec.status) ? rec.status : 'present';
                const lessonNote = String(rec.lesson_note || '').trim();
                const remarks = String(rec.remarks || '').trim();

                await db.run(
                    `INSERT INTO madrasa_attendance (class_id, student_id, attendance_date, status, lesson_note, remarks, marked_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(class_id, student_id, attendance_date)
                     DO UPDATE SET
                        status = excluded.status,
                        lesson_note = excluded.lesson_note,
                        remarks = excluded.remarks,
                        marked_by = excluded.marked_by,
                        updated_at = CURRENT_TIMESTAMP`,
                    [classId, studentId, date, status, lessonNote, remarks, marker]
                );
                savedCount++;
            }

            await db.run('COMMIT');
            res.json({ saved: savedCount, date, message: `Attendance saved for ${savedCount} student${savedCount === 1 ? '' : 's'}` });
        } catch (err) {
            await db.run('ROLLBACK').catch(() => {});
            console.error('[Madrasa batch attendance]', err);
            res.status(500).json({ error: 'Failed to save batch attendance' });
        }
    });

    router.get('/attendance', authenticateToken, async (req, res) => {
        try {
            const { class_id = '', student_id = '', status = '', from = '', to = '', search = '', limit = 150 } = req.query;
            const where = ['1=1'];
            const params = [];

            if (class_id) { where.push('a.class_id = ?'); params.push(parseInt(class_id, 10)); }
            if (student_id) { where.push('a.student_id = ?'); params.push(parseInt(student_id, 10)); }
            if (status && VALID_ATTENDANCE_STATUSES.has(status)) { where.push('a.status = ?'); params.push(status); }
            if (from) { where.push('a.attendance_date >= ?'); params.push(from); }
            if (to) { where.push('a.attendance_date <= ?'); params.push(to); }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                where.push('(s.full_name LIKE ? OR s.admission_no LIKE ? OR c.class_name LIKE ? OR a.lesson_note LIKE ? OR a.remarks LIKE ?)');
                params.push(q, q, q, q, q);
            }

            const lim = Math.min(Math.max(parseInt(limit, 10) || 150, 1), 500);
            params.push(lim);

            const rows = await db.all(`
                SELECT
                    a.*,
                    s.full_name AS student_name,
                    s.admission_no,
                    c.class_name,
                    c.class_code,
                    m.full_name AS muallimah_name
                FROM madrasa_attendance a
                JOIN madrasa_students s ON a.student_id = s.id
                JOIN madrasa_classes c ON a.class_id = c.id
                LEFT JOIN madrasa_muallimahs m ON c.muallimah_id = m.id
                WHERE ${where.join(' AND ')}
                ORDER BY a.attendance_date DESC, a.updated_at DESC
                LIMIT ?
            `, params);

            res.json(rows);
        } catch (err) {
            console.error('[Madrasa GET attendance]', err);
            res.status(500).json({ error: 'Failed to load attendance history' });
        }
    });

    router.post('/attendance', authenticateToken, async (req, res) => {
        try {
            const { class_id, student_id, attendance_date, status, lesson_note, remarks } = req.body;
            const classId = parseInt(class_id, 10);
            const studentId = parseInt(student_id, 10);
            const date = attendance_date ? String(attendance_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
            if (!classId || !studentId) {
                return res.status(400).json({ error: 'class_id and student_id are required' });
            }
            const cleanStatus = VALID_ATTENDANCE_STATUSES.has(status) ? status : 'present';
            const marker = req.user?.username || 'admin';

            await db.run(
                `INSERT INTO madrasa_attendance (class_id, student_id, attendance_date, status, lesson_note, remarks, marked_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(class_id, student_id, attendance_date)
                 DO UPDATE SET
                    status = excluded.status,
                    lesson_note = excluded.lesson_note,
                    remarks = excluded.remarks,
                    marked_by = excluded.marked_by,
                    updated_at = CURRENT_TIMESTAMP`,
                [classId, studentId, date, cleanStatus, String(lesson_note || '').trim(), String(remarks || '').trim(), marker]
            );
            const row = await db.get(
                'SELECT * FROM madrasa_attendance WHERE class_id = ? AND student_id = ? AND attendance_date = ?',
                [classId, studentId, date]
            );
            res.status(201).json({ id: row?.id, attendance: row, message: 'Attendance record saved' });
        } catch (err) {
            console.error('[Madrasa POST attendance]', err);
            res.status(500).json({ error: 'Failed to save attendance record' });
        }
    });

    router.put('/attendance/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT * FROM madrasa_attendance WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Attendance record not found' });

            const b = req.body;
            const cleanStatus = b.status && VALID_ATTENDANCE_STATUSES.has(b.status) ? b.status : existing.status;
            const nextDate = b.attendance_date ? String(b.attendance_date).slice(0, 10) : existing.attendance_date;
            const nextClass = b.class_id ? parseInt(b.class_id, 10) : existing.class_id;
            const nextStudent = b.student_id ? parseInt(b.student_id, 10) : existing.student_id;

            await db.run(
                `UPDATE madrasa_attendance
                 SET class_id = ?, student_id = ?, attendance_date = ?, status = ?,
                     lesson_note = ?, remarks = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    nextClass,
                    nextStudent,
                    nextDate,
                    cleanStatus,
                    b.lesson_note !== undefined ? String(b.lesson_note).trim() : existing.lesson_note,
                    b.remarks !== undefined ? String(b.remarks).trim() : existing.remarks,
                    req.user?.username || existing.marked_by,
                    id
                ]
            );
            const updated = await db.get('SELECT * FROM madrasa_attendance WHERE id = ?', [id]);
            res.json({ attendance: updated, message: 'Attendance record updated' });
        } catch (err) {
            handleSqliteConstraint(res, err, 'Attendance entry already exists for this student, class, and date');
        }
    });

    router.delete('/attendance/:id', authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await db.get('SELECT id FROM madrasa_attendance WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ error: 'Attendance record not found' });
            await db.run('DELETE FROM madrasa_attendance WHERE id = ?', [id]);
            res.json({ message: 'Attendance record deleted' });
        } catch (err) {
            console.error('[Madrasa DELETE attendance]', err);
            res.status(500).json({ error: 'Failed to delete attendance record' });
        }
    });

    return router;
};


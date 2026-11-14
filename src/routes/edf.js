const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { authenticateToken } = require('../middleware/authMiddleware');

// ── Multer — beneficiary photo uploads ──────────────────────────────────────
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/images/beneficiaries')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `ben_${Date.now()}${ext}`);
    }
});
const photoUpload = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// ── Multer — cheque & payment slip uploads ──────────────────────────────────
const fs = require('fs');
const chequeDir = path.join(__dirname, '../../public/uploads/cheques');
if (!fs.existsSync(chequeDir)) fs.mkdirSync(chequeDir, { recursive: true });

const chequeStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, chequeDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `cheque_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`);
    }
});
const chequeUpload = multer({
    storage: chequeStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) || file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Only image or PDF files are allowed'));
    }
});

// ── Multer — member profile photo uploads ───────────────────────────────────
const memberPhotoDir = path.join(__dirname, '../../public/uploads/members');
if (!fs.existsSync(memberPhotoDir)) fs.mkdirSync(memberPhotoDir, { recursive: true });

const memberPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, memberPhotoDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `member_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`);
    }
});
const memberPhotoUpload = multer({
    storage: memberPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// ── Multer — volunteer badge photo uploads ──────────────────────────────────
const volunteerPhotoDir = path.join(__dirname, '../../public/uploads/volunteers');
if (!fs.existsSync(volunteerPhotoDir)) fs.mkdirSync(volunteerPhotoDir, { recursive: true });

const volunteerPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, volunteerPhotoDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `vol_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`);
    }
});
const volunteerPhotoUpload = multer({
    storage: volunteerPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

module.exports = (db) => {
    // MEMBER PHOTO UPLOAD
    router.post('/members/upload-photo', authenticateToken, (req, res) => {
        memberPhotoUpload.single('photo')(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
            if (!req.file) return res.status(400).json({ message: 'No image file provided' });
            res.json({ photo_url: `/uploads/members/${req.file.filename}` });
        });
    });

    // MEMBER CRUD
    router.get('/members', authenticateToken, async (req, res) => {
        try {
            const members = await db.all('SELECT * FROM members ORDER BY member_type DESC, full_name ASC');
            res.json(members);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/members', authenticateToken, async (req, res) => {
        const {
            full_name, email, phone, address, city, gender, age,
            monthly_income, join_date, nic_number, marital_status,
            bank_name, bank_branch, account_number, previous_balance,
            blood_group, occupation, sibling_id, member_type, monthly_subscription,
            status, photo_url, membership_no, dob, whatsapp, designation,
            account_holder_name, emergency_contact_name, emergency_contact_phone, notes,
            record_initial_payment, initial_payment_amount, initial_payment_month,
            initial_payment_method, initial_payment_ref,
            initial_bank_name, initial_bank_code, initial_cheque_date, initial_cheque_image,
            relatives // Nested array of family members
        } = req.body;
        try {
            const cleanNic = nic_number && String(nic_number).trim() !== '' ? String(nic_number).trim() : null;
            if (cleanNic) {
                const existing = await db.get('SELECT id, full_name FROM members WHERE UPPER(nic_number) = UPPER(?)', [cleanNic]);
                if (existing) {
                    return res.status(400).json({ message: `A member (${existing.full_name}) with this NIC number is already registered.` });
                }
            }

            const result = await db.run(
                `INSERT INTO members (
                    full_name, email, phone, address, city, gender, age, 
                    monthly_income, join_date, nic_number, marital_status,
                    bank_name, bank_branch, account_number, previous_balance,
                    blood_group, occupation, sibling_id, member_type, monthly_subscription,
                    status, photo_url, membership_no, dob, whatsapp, designation,
                    account_holder_name, emergency_contact_name, emergency_contact_phone, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    full_name, email || null, phone, address || null, city || null, gender || 'male', age || null,
                    monthly_income || 0, join_date || new Date().toISOString().split('T')[0], cleanNic, marital_status || 'unmarried',
                    bank_name || null, bank_branch || null, account_number || null, previous_balance || 0,
                    blood_group || null, occupation || null, sibling_id || null, member_type || 'executive', monthly_subscription || 0,
                    status || 'active', photo_url || null, membership_no || null, dob || null, whatsapp || null, designation || null,
                    account_holder_name || null, emergency_contact_name || null, emergency_contact_phone || null, notes || null
                ]
            );

            const memberId = result.lastID;

            // Save Relatives if provided
            if (relatives && Array.isArray(relatives)) {
                for (const r of relatives) {
                    if (!r.full_name) continue;
                    await db.run(
                        'INSERT INTO member_relatives (member_id, full_name, relationship, gender, age, nic_number, occupation) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [memberId, r.full_name, r.relationship || 'other', r.gender || null, r.age || null, r.nic_number || null, r.occupation || null]
                    );
                }
            }

            // Optional: Record Initial Subscription Payment upon member creation
            let initialSubId = null;
            if (record_initial_payment && Number(initial_payment_amount) > 0) {
                const payAmt = Number(initial_payment_amount);
                const dueAmt = Number(monthly_subscription) || payAmt;
                const payMonth = initial_payment_month || new Date().toISOString().slice(0, 7);
                const payMethod = initial_payment_method || 'cash';
                const payRef = initial_payment_ref || null;

                const initBankName = initial_bank_name || bank_name || null;
                const initBankCode = initial_bank_code || bank_branch || null;
                const initChqDate = initial_cheque_date || null;
                const initChqImg = initial_cheque_image || null;

                const subRes = await db.run(
                    `INSERT INTO subscriptions (member_id, amount, paid_amount, month, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [memberId, dueAmt, payAmt, payMonth, payMethod, payRef, initBankName, initBankCode, initChqDate, initChqImg, 'Initial membership subscription payment']
                );
                initialSubId = subRes.lastID;

                await db.run(
                    `INSERT INTO subscription_payments (subscription_id, amount, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [initialSubId, payAmt, payMethod, payRef, initBankName, initBankCode, initChqDate, initChqImg, 'Initial membership subscription payment']
                );

                await db.run(
                    'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                    ['income', 'subscription', payAmt, `Subscription (${payMonth}) - ${full_name} [${payMethod}]`, initialSubId]
                );
            }

            res.json({ id: memberId, initial_subscription_id: initialSubId, message: 'Member added with family details' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/members/:id', authenticateToken, async (req, res) => {
        const {
            full_name, email, phone, address, city, gender, age,
            monthly_income, join_date, nic_number, marital_status,
            bank_name, bank_branch, account_number, previous_balance,
            blood_group, occupation, sibling_id, member_type, monthly_subscription, status,
            photo_url, membership_no, dob, whatsapp, designation,
            account_holder_name, emergency_contact_name, emergency_contact_phone, notes,
            relatives
        } = req.body;
        const memberId = req.params.id;
        try {
            const cleanNic = nic_number && String(nic_number).trim() !== '' ? String(nic_number).trim() : null;
            if (cleanNic) {
                const existing = await db.get('SELECT id, full_name FROM members WHERE UPPER(nic_number) = UPPER(?) AND id != ?', [cleanNic, memberId]);
                if (existing) {
                    return res.status(400).json({ message: `Another member (${existing.full_name}) is already registered with this NIC number.` });
                }
            }

            await db.run(
                `UPDATE members SET 
                    full_name=?, email=?, phone=?, address=?, city=?, gender=?, age=?, 
                    monthly_income=?, join_date=?, nic_number=?, marital_status=?,
                    bank_name=?, bank_branch=?, account_number=?, previous_balance=?,
                    blood_group=?, occupation=?, sibling_id=?, member_type=?, 
                    monthly_subscription=?, status=?,
                    photo_url=?, membership_no=?, dob=?, whatsapp=?, designation=?,
                    account_holder_name=?, emergency_contact_name=?, emergency_contact_phone=?, notes=?
                WHERE id=?`,
                [
                    full_name, email || null, phone, address || null, city || null, gender || 'male', age || null,
                    monthly_income || 0, join_date || null, cleanNic, marital_status || 'unmarried',
                    bank_name || null, bank_branch || null, account_number || null, previous_balance || 0,
                    blood_group || null, occupation || null, sibling_id || null, member_type || 'executive',
                    monthly_subscription || 0, status || 'active',
                    photo_url || null, membership_no || null, dob || null, whatsapp || null, designation || null,
                    account_holder_name || null, emergency_contact_name || null, emergency_contact_phone || null, notes || null,
                    memberId
                ]
            );

            // Update Relatives: Simplest way is delete all and re-insert if sending full list
            if (relatives && Array.isArray(relatives)) {
                await db.run('DELETE FROM member_relatives WHERE member_id = ?', [memberId]);
                for (const r of relatives) {
                    if (!r.full_name) continue;
                    await db.run(
                        'INSERT INTO member_relatives (member_id, full_name, relationship, gender, age, nic_number, occupation) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [memberId, r.full_name, r.relationship || 'other', r.gender || null, r.age || null, r.nic_number || null, r.occupation || null]
                    );
                }
            }

            res.json({ message: 'Member updated successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/members/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM members WHERE id = ?', [req.params.id]);
            res.json({ message: 'Member deleted successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // MEMBER PAYMENT HISTORY
    router.get('/members/:id/payment-history', authenticateToken, async (req, res) => {
        try {
            const memberId = parseInt(req.params.id);
            const member = await db.get(
                `SELECT id, full_name, email, phone, member_type, monthly_subscription,
                        join_date, status
                 FROM members WHERE id = ?`,
                [memberId]
            );
            if (!member) return res.status(404).json({ message: 'Member not found' });

            const subscriptions = await db.all(
                `SELECT *
                 FROM subscriptions WHERE member_id = ?
                 ORDER BY month DESC`,
                [memberId]
            );

            const totalPaid   = subscriptions.reduce((s, r) => s + r.amount, 0);
            const monthsCount = subscriptions.length;
            const avgPayment  = monthsCount ? totalPaid / monthsCount : 0;

            res.json({
                member,
                subscriptions,
                summary: {
                    total_paid:    totalPaid,
                    months_count:  monthsCount,
                    avg_payment:   avgPayment,
                    first_payment: subscriptions.length ? subscriptions[subscriptions.length - 1].payment_date : null,
                    latest_payment: subscriptions.length ? subscriptions[0].payment_date : null,
                }
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // MEMBER RELATIVES (Family Details)
    router.get('/members/:id/relatives', authenticateToken, async (req, res) => {
        try {
            const relatives = await db.all('SELECT * FROM member_relatives WHERE member_id = ?', [req.params.id]);
            res.json(relatives);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/members/:id/relatives', authenticateToken, async (req, res) => {
        const { full_name, relationship, gender, age, nic_number, occupation } = req.body;
        try {
            const result = await db.run(
                'INSERT INTO member_relatives (member_id, full_name, relationship, gender, age, nic_number, occupation) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.params.id, full_name, relationship, gender, age, nic_number, occupation]
            );
            res.json({ id: result.lastID, message: 'Relative added' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/relatives/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM member_relatives WHERE id = ?', [req.params.id]);
            res.json({ message: 'Relative removed' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // FAMILY CRUD
    router.post('/families/upload-photo', authenticateToken, (req, res) => {
        memberPhotoUpload.single('photo')(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
            if (!req.file) return res.status(400).json({ message: 'No image file provided' });
            res.json({ photo_url: `/uploads/members/${req.file.filename}` });
        });
    });

    router.get('/families', authenticateToken, async (req, res) => {
        try {
            const families = await db.all(`
                SELECT f.*,
                    COALESCE(aid.total_aid, 0) AS total_aid_amount,
                    COALESCE(aid.aid_count, 0) AS aid_count,
                    aid.last_aid_date,
                    aid.last_aid_type
                FROM families f
                LEFT JOIN (
                    SELECT family_id,
                           SUM(amount) AS total_aid,
                           COUNT(*) AS aid_count,
                           MAX(date) AS last_aid_date,
                           (SELECT donation_type FROM family_donations fd2 WHERE fd2.family_id = family_donations.family_id ORDER BY date DESC, id DESC LIMIT 1) AS last_aid_type
                    FROM family_donations
                    GROUP BY family_id
                ) aid ON aid.family_id = f.id
                ORDER BY f.created_at DESC, f.id DESC
            `);
            res.json(families);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/families', authenticateToken, async (req, res) => {
        const {
            head_name, address, phone, member_count, poverty_level, status,
            family_code, nic_number, head_gender, head_dob, head_age, head_occupation,
            marital_status, spouse_name, spouse_nic, spouse_occupation,
            whatsapp, city, gn_division,
            adults_count, children_count, elderly_count, disabled_count, dependents_json,
            monthly_income, monthly_expenses, housing_type, aid_category, vulnerability_tags,
            bank_name, bank_branch, account_number, account_holder_name,
            priority_score, verified_by, verification_date, notes, photo_url,
            record_initial_aid, initial_aid_amount, initial_aid_type, initial_aid_method,
            initial_aid_ref, initial_aid_description, initial_aid_date
        } = req.body;

        try {
            if (!head_name || !String(head_name).trim()) {
                return res.status(400).json({ message: 'Head of Family name is required' });
            }

            const cleanNic = nic_number && String(nic_number).trim() !== '' ? String(nic_number).trim() : null;
            let finalCode = family_code && String(family_code).trim() !== '' ? String(family_code).trim() : null;
            if (!finalCode) {
                const cntRow = await db.get('SELECT COUNT(*) as c FROM families');
                let seq = (cntRow?.c || 0) + 1;
                finalCode = `EDF-FAM-${String(seq).padStart(3, '0')}`;
                while (await db.get('SELECT id FROM families WHERE UPPER(family_code) = UPPER(?)', [finalCode])) {
                    seq++;
                    finalCode = `EDF-FAM-${String(seq).padStart(3, '0')}`;
                }
            }

            const depsStr = typeof dependents_json === 'string'
                ? dependents_json
                : (Array.isArray(dependents_json) ? JSON.stringify(dependents_json) : null);

            const tagsStr = typeof vulnerability_tags === 'string'
                ? vulnerability_tags
                : (Array.isArray(vulnerability_tags) ? vulnerability_tags.join(',') : null);

            const result = await db.run(
                `INSERT INTO families (
                    head_name, address, phone, member_count, poverty_level, status,
                    family_code, nic_number, head_gender, head_dob, head_age, head_occupation,
                    marital_status, spouse_name, spouse_nic, spouse_occupation,
                    whatsapp, city, gn_division,
                    adults_count, children_count, elderly_count, disabled_count, dependents_json,
                    monthly_income, monthly_expenses, housing_type, aid_category, vulnerability_tags,
                    bank_name, bank_branch, account_number, account_holder_name,
                    priority_score, verified_by, verification_date, notes, photo_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(head_name).trim(), address || null, phone || null, Number(member_count) || 1,
                    poverty_level || 'medium', status || 'active',
                    finalCode, cleanNic, head_gender || 'male', head_dob || null, head_age ? Number(head_age) : null, head_occupation || null,
                    marital_status || 'married', spouse_name || null, spouse_nic || null, spouse_occupation || null,
                    whatsapp || null, city || null, gn_division || null,
                    adults_count != null ? Number(adults_count) : 1,
                    children_count != null ? Number(children_count) : 0,
                    elderly_count != null ? Number(elderly_count) : 0,
                    disabled_count != null ? Number(disabled_count) : 0,
                    depsStr,
                    monthly_income != null ? Number(monthly_income) : 0,
                    monthly_expenses != null ? Number(monthly_expenses) : 0,
                    housing_type || 'own', aid_category || 'general', tagsStr,
                    bank_name || null, bank_branch || null, account_number || null, account_holder_name || null,
                    priority_score != null ? Number(priority_score) : 0,
                    verified_by || null, verification_date || null, notes || null, photo_url || null
                ]
            );

            const familyId = result.lastID;

            // Optional: Record initial aid distribution upon registration
            let initialAidId = null;
            if (record_initial_aid && Number(initial_aid_amount) > 0) {
                const aidAmt = Number(initial_aid_amount);
                const aidType = initial_aid_type || 'cash';
                const aidMethod = initial_aid_method || 'cash';
                const aidRef = initial_aid_ref || null;
                const aidDesc = initial_aid_description || 'Initial registration humanitarian grant';
                const aidDate = initial_aid_date || new Date().toISOString();

                const aidRes = await db.run(
                    `INSERT INTO family_donations (family_id, amount, donation_type, payment_method, reference_no, distributed_by, description, date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [familyId, aidAmt, aidType, aidMethod, aidRef, verified_by || null, aidDesc, aidDate]
                );
                initialAidId = aidRes.lastID;

                await db.run(
                    'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                    ['expense', 'welfare', aidAmt, `${aidType.toUpperCase()} Distributed to Family: ${head_name} (${finalCode})`, initialAidId]
                );
            }

            res.json({ id: familyId, family_code: finalCode, initial_aid_id: initialAidId, message: 'Family registered successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/families/bulk-action', authenticateToken, async (req, res) => {
        const { ids, action, value } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: 'No families selected' });
        }
        try {
            const placeholders = ids.map(() => '?').join(',');
            if (action === 'status' && ['active', 'pending', 'inactive'].includes(value)) {
                await db.run(`UPDATE families SET status = ? WHERE id IN (${placeholders})`, [value, ...ids]);
                return res.json({ message: `Updated status for ${ids.length} families` });
            }
            if (action === 'poverty_level' && ['low', 'medium', 'high'].includes(value)) {
                await db.run(`UPDATE families SET poverty_level = ? WHERE id IN (${placeholders})`, [value, ...ids]);
                return res.json({ message: `Updated poverty level for ${ids.length} families` });
            }
            if (action === 'delete') {
                await db.run(`DELETE FROM family_donations WHERE family_id IN (${placeholders})`, ids);
                await db.run(`DELETE FROM families WHERE id IN (${placeholders})`, ids);
                return res.json({ message: `Deleted ${ids.length} families` });
            }
            res.status(400).json({ message: 'Invalid bulk action' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/families/:id/aid', authenticateToken, async (req, res) => {
        try {
            const aid = await db.all('SELECT * FROM family_donations WHERE family_id = ? ORDER BY date DESC, id DESC', [req.params.id]);
            res.json(aid);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/families/:id/aid', authenticateToken, async (req, res) => {
        const { amount, donation_type, payment_method, reference_no, distributed_by, description, date } = req.body;
        const family_id = req.params.id;
        try {
            const result = await db.run(
                `INSERT INTO family_donations (family_id, amount, donation_type, payment_method, reference_no, distributed_by, description, date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [family_id, amount, donation_type, payment_method || 'cash', reference_no || null, distributed_by || null, description, date || new Date().toISOString()]
            );

            // Log as expense transaction
            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                ['expense', 'welfare', amount, `${(donation_type || 'AID').toUpperCase()} Distributed to Family ID: ${family_id}`, result.lastID]
            );

            res.json({ id: result.lastID, message: 'Aid distribution recorded' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/families/:id/aid/:aidId', authenticateToken, async (req, res) => {
        const { amount, donation_type, payment_method, reference_no, distributed_by, description, date } = req.body;
        try {
            await db.run(
                `UPDATE family_donations SET amount=?, donation_type=?, payment_method=?, reference_no=?, distributed_by=?, description=?, date=?
                 WHERE id=? AND family_id=?`,
                [amount, donation_type, payment_method || 'cash', reference_no || null, distributed_by || null, description, date || new Date().toISOString(), req.params.aidId, req.params.id]
            );
            res.json({ message: 'Aid record updated' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/families/:id/aid/:aidId', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM family_donations WHERE id=? AND family_id=?', [req.params.aidId, req.params.id]);
            res.json({ message: 'Aid record deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/families/stats', authenticateToken, async (_req, res) => {
        try {
            const total        = (await db.get('SELECT COUNT(*) as c FROM families')).c;
            const active       = (await db.get("SELECT COUNT(*) as c FROM families WHERE COALESCE(status,'active')='active'")).c;
            const pending      = (await db.get("SELECT COUNT(*) as c FROM families WHERE status='pending'")).c;
            const inactive     = (await db.get("SELECT COUNT(*) as c FROM families WHERE status='inactive'")).c;
            const highNeed     = (await db.get("SELECT COUNT(*) as c FROM families WHERE poverty_level='high'")).c;
            const mediumNeed   = (await db.get("SELECT COUNT(*) as c FROM families WHERE poverty_level='medium'")).c;
            const lowNeed      = (await db.get("SELECT COUNT(*) as c FROM families WHERE poverty_level='low'")).c;
            const totalMembers = (await db.get('SELECT COALESCE(SUM(member_count),0) as s FROM families')).s;
            const zakatEligible = (await db.get("SELECT COUNT(*) as c FROM families WHERE aid_category='zakat_eligible' OR poverty_level='high'")).c;
            const totalAid     = (await db.get('SELECT COALESCE(SUM(amount),0) as s FROM family_donations')).s;
            const aidGrantsCount = (await db.get('SELECT COUNT(*) as c FROM family_donations')).c;
            const aidedFamiliesCount = (await db.get('SELECT COUNT(DISTINCT family_id) as c FROM family_donations')).c;
            const unaidedFamiliesCount = Math.max(0, total - aidedFamiliesCount);

            res.json({
                total, active, pending, inactive,
                highNeed, mediumNeed, lowNeed,
                totalMembers, zakatEligible,
                totalAid, aidGrantsCount,
                aidedFamiliesCount, unaidedFamiliesCount
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/families/:id', authenticateToken, async (req, res) => {
        const {
            head_name, address, phone, member_count, poverty_level, status,
            family_code, nic_number, head_gender, head_dob, head_age, head_occupation,
            marital_status, spouse_name, spouse_nic, spouse_occupation,
            whatsapp, city, gn_division,
            adults_count, children_count, elderly_count, disabled_count, dependents_json,
            monthly_income, monthly_expenses, housing_type, aid_category, vulnerability_tags,
            bank_name, bank_branch, account_number, account_holder_name,
            priority_score, verified_by, verification_date, notes, photo_url
        } = req.body;

        try {
            const existing = await db.get('SELECT * FROM families WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Family not found' });

            const depsStr = typeof dependents_json === 'string'
                ? dependents_json
                : (Array.isArray(dependents_json) ? JSON.stringify(dependents_json) : existing.dependents_json);

            const tagsStr = typeof vulnerability_tags === 'string'
                ? vulnerability_tags
                : (Array.isArray(vulnerability_tags) ? vulnerability_tags.join(',') : existing.vulnerability_tags);

            await db.run(
                `UPDATE families SET
                    head_name=?, address=?, phone=?, member_count=?, poverty_level=?, status=?,
                    family_code=?, nic_number=?, head_gender=?, head_dob=?, head_age=?, head_occupation=?,
                    marital_status=?, spouse_name=?, spouse_nic=?, spouse_occupation=?,
                    whatsapp=?, city=?, gn_division=?,
                    adults_count=?, children_count=?, elderly_count=?, disabled_count=?, dependents_json=?,
                    monthly_income=?, monthly_expenses=?, housing_type=?, aid_category=?, vulnerability_tags=?,
                    bank_name=?, bank_branch=?, account_number=?, account_holder_name=?,
                    priority_score=?, verified_by=?, verification_date=?, notes=?, photo_url=?
                 WHERE id=?`,
                [
                    head_name || existing.head_name,
                    address !== undefined ? address : existing.address,
                    phone !== undefined ? phone : existing.phone,
                    member_count !== undefined ? Number(member_count) : existing.member_count,
                    poverty_level || existing.poverty_level || 'medium',
                    status || existing.status || 'active',
                    family_code || existing.family_code || `EDF-FAM-${String(existing.id).padStart(3, '0')}`,
                    nic_number !== undefined ? nic_number : existing.nic_number,
                    head_gender || existing.head_gender || 'male',
                    head_dob !== undefined ? head_dob : existing.head_dob,
                    head_age !== undefined ? (head_age ? Number(head_age) : null) : existing.head_age,
                    head_occupation !== undefined ? head_occupation : existing.head_occupation,
                    marital_status || existing.marital_status || 'married',
                    spouse_name !== undefined ? spouse_name : existing.spouse_name,
                    spouse_nic !== undefined ? spouse_nic : existing.spouse_nic,
                    spouse_occupation !== undefined ? spouse_occupation : existing.spouse_occupation,
                    whatsapp !== undefined ? whatsapp : existing.whatsapp,
                    city !== undefined ? city : existing.city,
                    gn_division !== undefined ? gn_division : existing.gn_division,
                    adults_count !== undefined ? Number(adults_count) : (existing.adults_count ?? 1),
                    children_count !== undefined ? Number(children_count) : (existing.children_count ?? 0),
                    elderly_count !== undefined ? Number(elderly_count) : (existing.elderly_count ?? 0),
                    disabled_count !== undefined ? Number(disabled_count) : (existing.disabled_count ?? 0),
                    depsStr,
                    monthly_income !== undefined ? Number(monthly_income) : (existing.monthly_income ?? 0),
                    monthly_expenses !== undefined ? Number(monthly_expenses) : (existing.monthly_expenses ?? 0),
                    housing_type || existing.housing_type || 'own',
                    aid_category || existing.aid_category || 'general',
                    tagsStr,
                    bank_name !== undefined ? bank_name : existing.bank_name,
                    bank_branch !== undefined ? bank_branch : existing.bank_branch,
                    account_number !== undefined ? account_number : existing.account_number,
                    account_holder_name !== undefined ? account_holder_name : existing.account_holder_name,
                    priority_score !== undefined ? Number(priority_score) : (existing.priority_score ?? 0),
                    verified_by !== undefined ? verified_by : existing.verified_by,
                    verification_date !== undefined ? verification_date : existing.verification_date,
                    notes !== undefined ? notes : existing.notes,
                    photo_url !== undefined ? photo_url : existing.photo_url,
                    req.params.id
                ]
            );
            res.json({ message: 'Family updated successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/families/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM family_donations WHERE family_id=?', [req.params.id]);
            await db.run('DELETE FROM families WHERE id=?', [req.params.id]);
            res.json({ message: 'Family deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // SUBSCRIPTIONS
    router.get('/subscriptions', authenticateToken, async (req, res) => {
        try {
            const subs = await db.all(`
                SELECT s.*, m.full_name as member_name 
                FROM subscriptions s 
                JOIN members m ON s.member_id = m.id 
                ORDER BY s.payment_date DESC
            `);
            res.json(subs);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Upload cheque or payment slip image
    router.post('/subscriptions/upload-cheque', authenticateToken, (req, res) => {
        chequeUpload.single('cheque')(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
            const fileUrl = `/uploads/cheques/${req.file.filename}`;
            res.json({ success: true, fileUrl, filename: req.file.filename, originalName: req.file.originalname });
        });
    });

    router.post('/subscriptions', authenticateToken, async (req, res) => {
        const {
            member_id, amount, month, paid_amount, payment_method, notes,
            is_advance, payment_date, reference_number,
            bank_name, bank_code, cheque_date, cheque_image
        } = req.body;
        try {
            // Allow multiple payments per month (partial) — only block FULL duplicate if paid_amount >= amount
            const existing = await db.get('SELECT id FROM subscriptions WHERE member_id=? AND month=?', [member_id, month]);
            if (existing && !is_advance) {
                // Already has a subscription record — add a payment entry instead
                const actualPaid = parseFloat(paid_amount) || parseFloat(amount);
                await db.run(
                    `INSERT INTO subscription_payments (subscription_id, amount, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes, payment_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        existing.id, actualPaid, payment_method || 'cash',
                        reference_number || null, bank_name || null, bank_code || null,
                        cheque_date || null, cheque_image || null,
                        notes || null, payment_date || new Date().toISOString()
                    ]
                );
                // Update paid_amount and latest channel details on parent subscription
                await db.run(
                    `UPDATE subscriptions
                     SET paid_amount = COALESCE(paid_amount,0) + ?,
                         payment_method = ?,
                         reference_number = COALESCE(?, reference_number),
                         bank_name = COALESCE(?, bank_name),
                         bank_code = COALESCE(?, bank_code),
                         cheque_date = COALESCE(?, cheque_date),
                         cheque_image = COALESCE(?, cheque_image),
                         notes = COALESCE(?, notes)
                     WHERE id=?`,
                    [
                        actualPaid, payment_method || 'cash',
                        reference_number || null, bank_name || null, bank_code || null,
                        cheque_date || null, cheque_image || null, notes || null,
                        existing.id
                    ]
                );
                const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [member_id]);
                const memberName = memberRow ? memberRow.full_name : 'Unknown';
                await db.run(
                    'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                    ['income', 'subscription', actualPaid, `Partial subscription (${month}) - ${memberName} [${payment_method || 'cash'}]`, existing.id]
                );
                return res.json({ id: existing.id, message: 'Partial payment added to existing subscription' });
            }

            const actualPaid = parseFloat(paid_amount) || parseFloat(amount);
            const result = await db.run(
                `INSERT INTO subscriptions (member_id, amount, paid_amount, month, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes, is_advance, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    member_id, amount, actualPaid, month, payment_method || 'cash',
                    reference_number || null, bank_name || null, bank_code || null,
                    cheque_date || null, cheque_image || null,
                    notes || null, is_advance ? 1 : 0,
                    payment_date || new Date().toISOString()
                ]
            );

            // Record initial payment detail
            await db.run(
                `INSERT INTO subscription_payments (subscription_id, amount, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.lastID, actualPaid, payment_method || 'cash',
                    reference_number || null, bank_name || null, bank_code || null,
                    cheque_date || null, cheque_image || null,
                    notes || null, payment_date || new Date().toISOString()
                ]
            );

            const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [member_id]);
            const memberName = memberRow ? memberRow.full_name : 'Unknown';
            const advanceTag = is_advance ? ' [ADVANCE]' : '';
            const chqTag = payment_method === 'cheque' && bank_name ? ` (${bank_name}${reference_number ? ' #' + reference_number : ''})` : '';
            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                ['income', 'subscription', actualPaid,
                 `Monthly subscription (${month}) - ${memberName} [${payment_method || 'cash'}]${chqTag}${advanceTag}`,
                 result.lastID]
            );
            res.json({ id: result.lastID, message: 'Subscription recorded' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Fetch members with their subscription status for a given month
    router.get('/subscriptions/monthly-status', authenticateToken, async (req, res) => {
        const { month } = req.query; // YYYY-MM
        try {
            const members = await db.all('SELECT id, full_name, member_type, monthly_subscription, status, phone, email, nic_number FROM members ORDER BY full_name ASC');
            const subs = month
                ? await db.all(`SELECT s.*, m.full_name as member_name, m.phone, m.email, m.nic_number FROM subscriptions s JOIN members m ON s.member_id=m.id WHERE s.month=?`, [month])
                : [];
            const subMap = {};
            subs.forEach(s => { subMap[s.member_id] = s; });

            // Attach sub-payments for each subscription
            for (const sub of subs) {
                sub.payments = await db.all(
                    `SELECT * FROM subscription_payments WHERE subscription_id=? ORDER BY payment_date ASC`,
                    [sub.id]
                );
            }

            const result = members.map(m => ({
                ...m,
                subscription_record: subMap[m.id] || null,
            }));
            res.json({ members: result, subscriptions: subs });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // Fetch members with their subscription status for a given year (12-month overview of paid & pending)
    router.get('/subscriptions/yearly-status', authenticateToken, async (req, res) => {
        const year = req.query.year || new Date().getFullYear().toString();
        try {
            const members = await db.all('SELECT id, full_name, member_type, monthly_subscription, status, phone, email, nic_number FROM members ORDER BY full_name ASC');
            const subs = await db.all(
                `SELECT s.*, m.full_name as member_name, m.phone, m.email, m.nic_number 
                 FROM subscriptions s 
                 JOIN members m ON s.member_id = m.id 
                 WHERE s.month LIKE ? 
                 ORDER BY s.month ASC`,
                [`${year}-%`]
            );

            // Attach sub-payments and group subscriptions by member_id and month
            const memberSubsMap = {};
            for (const s of subs) {
                s.payments = await db.all(
                    `SELECT * FROM subscription_payments WHERE subscription_id=? ORDER BY payment_date ASC`,
                    [s.id]
                );
                if (!memberSubsMap[s.member_id]) memberSubsMap[s.member_id] = {};
                memberSubsMap[s.member_id][s.month] = s;
            }

            const currentYearStr = new Date().getFullYear().toString();
            const currentMonthIndex = new Date().getMonth() + 1; // 1-12
            const monthsList = ['01','02','03','04','05','06','07','08','09','10','11','12'];

            const result = members.map(m => {
                const subMonthly = m.monthly_subscription || 0;
                const isExempt = subMonthly <= 0;
                const memberYearSubs = memberSubsMap[m.id] || {};

                let totalPaidYear = 0;
                let paidMonthsCount = 0;
                let partialMonthsCount = 0;
                let pendingMonthsCount = 0;

                const monthsMatrix = monthsList.map(mo => {
                    const monthKey = `${year}-${mo}`;
                    const rec = memberYearSubs[monthKey] || null;
                    let status = 'pending';
                    let paid = 0;

                    if (isExempt) {
                        status = 'exempt';
                    } else if (rec) {
                        paid = rec.paid_amount != null ? rec.paid_amount : rec.amount;
                        totalPaidYear += paid;
                        if (paid >= rec.amount) {
                            status = 'paid';
                            paidMonthsCount++;
                        } else {
                            status = 'partial';
                            partialMonthsCount++;
                        }
                    } else {
                        if (year > currentYearStr || (year === currentYearStr && parseInt(mo, 10) > currentMonthIndex)) {
                            status = 'upcoming';
                        } else {
                            status = 'pending';
                            pendingMonthsCount++;
                        }
                    }

                    return {
                        month: monthKey,
                        monthNum: mo,
                        due: subMonthly,
                        paid,
                        status,
                        record: rec
                    };
                });

                const annualTarget = subMonthly * 12;
                const elapsedMonths = (year < currentYearStr) ? 12 : ((year === currentYearStr) ? currentMonthIndex : 0);
                const dueYTD = subMonthly * elapsedMonths;
                const pendingBalanceYTD = Math.max(0, dueYTD - totalPaidYear);
                const pendingBalanceAnnual = Math.max(0, annualTarget - totalPaidYear);

                let yearlyPayStatus = 'exempt';
                if (!isExempt) {
                    const targetMonths = year < currentYearStr ? 12 : elapsedMonths;
                    if (paidMonthsCount >= targetMonths && pendingBalanceYTD === 0 && totalPaidYear > 0) {
                        yearlyPayStatus = 'paid';
                    } else if (totalPaidYear > 0) {
                        yearlyPayStatus = 'partial';
                    } else {
                        yearlyPayStatus = 'pending';
                    }
                }

                return {
                    ...m,
                    yearlyPayStatus,
                    annualTarget,
                    dueYTD,
                    totalPaidYear,
                    pendingBalanceYTD,
                    pendingBalanceAnnual,
                    paidMonthsCount,
                    partialMonthsCount,
                    pendingMonthsCount,
                    monthsMatrix
                };
            });

            const yearRows = await db.all("SELECT DISTINCT SUBSTR(month, 1, 4) as y FROM subscriptions WHERE month IS NOT NULL AND length(month) >= 4 ORDER BY y DESC");
            const availableYearsSet = new Set(yearRows.map(r => r.y).filter(Boolean));
            availableYearsSet.add(new Date().getFullYear().toString());
            availableYearsSet.add((new Date().getFullYear() - 1).toString());
            const availableYears = Array.from(availableYearsSet).sort((a,b) => b.localeCompare(a));

            res.json({
                year,
                availableYears,
                members: result
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/subscriptions/:id', authenticateToken, async (req, res) => {
        const {
            amount, month, paid_amount, payment_method, notes, is_advance,
            reference_number, bank_name, bank_code, cheque_date, cheque_image
        } = req.body;
        const id = req.params.id;
        try {
            const sub = await db.get('SELECT * FROM subscriptions WHERE id=?', [id]);
            if (!sub) return res.status(404).json({ message: 'Subscription not found' });

            // Check duplicate for the new month (excluding self)
            if (!is_advance) {
                const dup = await db.get('SELECT id FROM subscriptions WHERE member_id=? AND month=? AND id!=?', [sub.member_id, month, id]);
                if (dup) return res.status(400).json({ message: 'Subscription for this member and month already exists.' });
            }

            const actualPaid = parseFloat(paid_amount) || parseFloat(amount);
            await db.run(
                `UPDATE subscriptions
                 SET amount=?, paid_amount=?, month=?, payment_method=?,
                     reference_number=?, bank_name=?, bank_code=?, cheque_date=?, cheque_image=?,
                     notes=?, is_advance=?
                 WHERE id=?`,
                [
                    amount, actualPaid, month, payment_method || 'cash',
                    reference_number || null, bank_name || null, bank_code || null,
                    cheque_date || null, cheque_image || null,
                    notes || null, is_advance ? 1 : 0, id
                ]
            );
            const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [sub.member_id]);
            const memberName = memberRow ? memberRow.full_name : 'Unknown';
            const chqTag = payment_method === 'cheque' && bank_name ? ` (${bank_name}${reference_number ? ' #' + reference_number : ''})` : '';
            await db.run(
                `UPDATE transactions SET amount=?, description=? WHERE reference_id=? AND category='subscription'`,
                [actualPaid, `Monthly subscription (${month}) - ${memberName} [${payment_method || 'cash'}]${chqTag}`, id]
            );
            res.json({ message: 'Subscription updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // Add another payment to an existing subscription
    router.post('/subscriptions/:id/payments', authenticateToken, async (req, res) => {
        const {
            amount, payment_method, notes, reference_number,
            bank_name, bank_code, cheque_date, cheque_image, payment_date
        } = req.body;
        const subId = req.params.id;
        try {
            const sub = await db.get('SELECT * FROM subscriptions WHERE id=?', [subId]);
            if (!sub) return res.status(404).json({ message: 'Subscription not found' });

            const result = await db.run(
                `INSERT INTO subscription_payments (subscription_id, amount, payment_method, reference_number, bank_name, bank_code, cheque_date, cheque_image, notes, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    subId, amount, payment_method || 'cash', reference_number || null,
                    bank_name || null, bank_code || null, cheque_date || null, cheque_image || null,
                    notes || null, payment_date || new Date().toISOString()
                ]
            );
            // Update parent subscription paid_amount and latest channel details
            await db.run(
                `UPDATE subscriptions
                 SET paid_amount = COALESCE(paid_amount,0) + ?,
                     payment_method = ?,
                     reference_number = COALESCE(?, reference_number),
                     bank_name = COALESCE(?, bank_name),
                     bank_code = COALESCE(?, bank_code),
                     cheque_date = COALESCE(?, cheque_date),
                     cheque_image = COALESCE(?, cheque_image)
                 WHERE id=?`,
                [
                    amount, payment_method || 'cash',
                    reference_number || null, bank_name || null, bank_code || null,
                    cheque_date || null, cheque_image || null, subId
                ]
            );
            const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [sub.member_id]);
            const memberName = memberRow ? memberRow.full_name : 'Unknown';
            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                ['income', 'subscription', amount,
                 `Partial subscription (${sub.month}) - ${memberName} [${payment_method || 'cash'}]`,
                 subId]
            );
            res.json({ id: result.lastID, message: 'Payment added' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // Get payments for a subscription
    router.get('/subscriptions/:id/payments', authenticateToken, async (req, res) => {
        try {
            const payments = await db.all(
                `SELECT * FROM subscription_payments WHERE subscription_id=? ORDER BY payment_date ASC`,
                [req.params.id]
            );
            res.json(payments);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // Delete a specific payment entry
    router.delete('/subscriptions/:id/payments/:payId', authenticateToken, async (req, res) => {
        try {
            const pay = await db.get('SELECT * FROM subscription_payments WHERE id=?', [req.params.payId]);
            if (!pay) return res.status(404).json({ message: 'Payment not found' });
            await db.run('DELETE FROM subscription_payments WHERE id=?', [req.params.payId]);
            // Reduce parent paid_amount
            await db.run(
                `UPDATE subscriptions SET paid_amount = MAX(0, COALESCE(paid_amount,0) - ?) WHERE id=?`,
                [pay.amount, req.params.id]
            );
            res.json({ message: 'Payment deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.delete('/subscriptions/:id', authenticateToken, async (req, res) => {
        const id = req.params.id;
        try {
            await db.run(`DELETE FROM transactions WHERE reference_id=? AND category='subscription'`, [id]);
            await db.run('DELETE FROM subscriptions WHERE id=?', [id]);
            res.json({ message: 'Subscription deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // COURSES & BATCHES
    router.get('/courses', authenticateToken, async (req, res) => {
        try {
            const courses = await db.all('SELECT * FROM courses');
            res.json(courses);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // EXTERNAL DONATIONS (Zakat, Sadaqah, etc.)
    router.get('/external-donations', authenticateToken, async (req, res) => {
        try {
            const donations = await db.all(`
                SELECT e.*, 
                    m.full_name as member_name, 
                    b.male_head_name as beneficiary_name, 
                    b.application_number as beneficiary_number,
                    f.head_name as family_name
                FROM external_donations e
                LEFT JOIN members m ON e.member_id = m.id
                LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
                LEFT JOIN families f ON e.family_id = f.id
                ORDER BY e.date DESC
            `);
            res.json(donations);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/external-donations', authenticateToken, async (req, res) => {
        const { 
            direction, donor_type, member_id, 
            recipient_type, beneficiary_id, family_id, recipient_name, 
            donor_name, donor_phone, amount, donation_type, payment_method, description, date 
        } = req.body;
        
        try {
            const result = await db.run(
                `INSERT INTO external_donations (
                    direction, donor_type, member_id, recipient_type, beneficiary_id, family_id, recipient_name,
                    donor_name, donor_phone, amount, donation_type, payment_method, description, date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    direction || 'income', donor_type || 'external', member_id || null, 
                    recipient_type || null, beneficiary_id || null, family_id || null, recipient_name || null,
                    donor_name || '', donor_phone || '', amount, donation_type, payment_method, description, date || new Date().toISOString()
                ]
            );

            // Log to general transactions (income or expense)
            const resolvedDirection = direction || 'income';
            
            let txDescription = description || '';
            if (resolvedDirection === 'income') {
                const name = donor_type === 'member' ? `Member #${member_id}` : donor_name;
                txDescription = `${donation_type.toUpperCase()} received from ${name}`;
            } else {
                let rec = recipient_name;
                if (recipient_type === 'beneficiary') rec = `Beneficiary #${beneficiary_id}`;
                if (recipient_type === 'family') rec = `Family #${family_id}`;
                txDescription = `${donation_type.toUpperCase()} given to ${rec}`;
            }

            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                [resolvedDirection, 'donation', amount, txDescription, result.lastID]
            );

            res.json({ id: result.lastID, message: 'Donation recorded successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/external-donations/:id', authenticateToken, async (req, res) => {
        const { 
            direction, donor_type, member_id, 
            recipient_type, beneficiary_id, family_id, recipient_name,
            donor_name, donor_phone, amount, donation_type, payment_method, description, date 
        } = req.body;
        const id = req.params.id;
        try {
            const existing = await db.get('SELECT * FROM external_donations WHERE id = ?', [id]);
            if (!existing) return res.status(404).json({ message: 'Donation not found' });

            await db.run(
                `UPDATE external_donations SET 
                    direction=?, donor_type=?, member_id=?, recipient_type=?, beneficiary_id=?, family_id=?, recipient_name=?,
                    donor_name=?, donor_phone=?, amount=?, donation_type=?, payment_method=?, description=?, date=? 
                 WHERE id=?`,
                [
                    direction || existing.direction, donor_type || existing.donor_type, member_id || existing.member_id,
                    recipient_type || existing.recipient_type, beneficiary_id || existing.beneficiary_id, family_id || existing.family_id, recipient_name || existing.recipient_name,
                    donor_name || existing.donor_name, donor_phone || existing.donor_phone, amount, donation_type, payment_method, description, date || existing.date, id
                ]
            );

            // Update the linked transaction record
            const resolvedDirection = direction || existing.direction;
            let txDescription = description || '';
            if (resolvedDirection === 'income') {
                const name = donor_type === 'member' ? `Member #${member_id}` : (donor_name || existing.donor_name);
                txDescription = `${donation_type.toUpperCase()} received from ${name}`;
            } else {
                let rec = recipient_name || existing.recipient_name;
                if (recipient_type === 'beneficiary') rec = `Beneficiary #${beneficiary_id || existing.beneficiary_id}`;
                if (recipient_type === 'family') rec = `Family #${family_id || existing.family_id}`;
                txDescription = `${donation_type.toUpperCase()} given to ${rec}`;
            }

            await db.run(
                `UPDATE transactions SET type=?, amount=?, description=? WHERE reference_id=? AND category='donation'`,
                [resolvedDirection, amount, txDescription, id]
            );

            res.json({ message: 'Donation updated successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/external-donations/:id', authenticateToken, async (req, res) => {
        const id = req.params.id;
        try {
            // Cascade-delete the linked transaction first
            await db.run(`DELETE FROM transactions WHERE reference_id=? AND category='donation'`, [id]);
            await db.run('DELETE FROM external_donations WHERE id=?', [id]);
            res.json({ message: 'Donation deleted successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // VOLUNTEERS — Extended Force Registry, Deployment Logs & Service Hours
    async function generateVolunteerNo() {
        const yr = new Date().getFullYear();
        const rows = await db.all('SELECT volunteer_no FROM volunteers WHERE volunteer_no LIKE ?', [`VOL-${yr}-%`]);
        let maxSeq = 0;
        for (const r of rows) {
            const m = String(r.volunteer_no || '').match(/VOL-\d{4}-(\d+)/i);
            if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
        }
        return `VOL-${yr}-${String(maxSeq + 1).padStart(3, '0')}`;
    }

    async function recalcVolunteerStats(volId) {
        const agg = await db.get(
            'SELECT COUNT(*) AS cnt, COALESCE(SUM(hours_served), 0) AS hrs FROM volunteer_activities WHERE volunteer_id = ?',
            [volId]
        );
        const cnt = Number(agg?.cnt || 0);
        const hrs = Math.round(Number(agg?.hrs || 0) * 100) / 100;
        await db.run(
            'UPDATE volunteers SET deployments_count = ?, total_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [cnt, hrs, volId]
        );
        return { deployments_count: cnt, total_hours: hrs };
    }

    router.post('/volunteers/upload-photo', authenticateToken, (req, res) => {
        volunteerPhotoUpload.single('photo')(req, res, (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Photo upload failed' });
            if (!req.file) return res.status(400).json({ message: 'No image file provided' });
            res.json({ photo_url: `/uploads/volunteers/${req.file.filename}` });
        });
    });

    router.get('/volunteers', authenticateToken, async (req, res) => {
        try {
            const volunteers = await db.all(`
                SELECT v.*,
                    COALESCE(va.act_count, v.deployments_count, 0) AS logged_activities_count,
                    COALESCE(va.act_hours, v.total_hours, 0) AS logged_hours_sum,
                    va.last_activity_date
                FROM volunteers v
                LEFT JOIN (
                    SELECT volunteer_id,
                        COUNT(*) AS act_count,
                        COALESCE(SUM(hours_served), 0) AS act_hours,
                        MAX(activity_date) AS last_activity_date
                    FROM volunteer_activities
                    GROUP BY volunteer_id
                ) va ON va.volunteer_id = v.id
                ORDER BY
                    CASE LOWER(COALESCE(v.status, 'active'))
                        WHEN 'active' THEN 0
                        WHEN 'standby' THEN 1
                        WHEN 'on_leave' THEN 2
                        ELSE 3
                    END,
                    COALESCE(va.act_hours, v.total_hours, 0) DESC,
                    v.created_at DESC
            `);
            res.json(volunteers);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/volunteers/summary', authenticateToken, async (req, res) => {
        try {
            const rows = await db.all('SELECT status, role_tier, wing, verified_id, total_hours, deployments_count, transport_mode FROM volunteers');
            const total = rows.length;
            let active = 0, onLeave = 0, standby = 0, inactive = 0, leads = 0, verified = 0, transportReady = 0, totalHours = 0, totalDeployments = 0;
            const wings = {};
            for (const r of rows) {
                const st = String(r.status || 'active').toLowerCase();
                if (st === 'active') active++;
                else if (st === 'on_leave') onLeave++;
                else if (st === 'standby') standby++;
                else inactive++;
                if (/lead|coordinator/i.test(r.role_tier || '')) leads++;
                if (Number(r.verified_id) === 1) verified++;
                if (r.transport_mode && r.transport_mode !== 'None') transportReady++;
                totalHours += Number(r.total_hours || 0);
                totalDeployments += Number(r.deployments_count || 0);
                const w = r.wing || 'Field Relief';
                wings[w] = (wings[w] || 0) + 1;
            }
            res.json({
                total,
                active,
                onLeave,
                standby,
                inactive,
                leads,
                verified,
                transportReady,
                totalHours: Math.round(totalHours * 100) / 100,
                totalDeployments,
                wings
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/volunteers', authenticateToken, async (req, res) => {
        const b = req.body || {};
        if (!b.full_name || !String(b.full_name).trim()) {
            return res.status(400).json({ message: 'Full name is required' });
        }
        try {
            const volunteerNo = (b.volunteer_no && String(b.volunteer_no).trim())
                ? String(b.volunteer_no).trim()
                : await generateVolunteerNo();
            const joinDate = b.join_date || new Date().toISOString().slice(0, 10);
            const result = await db.run(
                `INSERT INTO volunteers (
                    volunteer_no, full_name, phone, whatsapp, email, nic_number, address, city,
                    gender, blood_group, skills, availability, wing, role_tier, transport_mode,
                    emergency_contact_name, emergency_contact_phone, join_date, verified_id,
                    status, photo_url, notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    volunteerNo,
                    String(b.full_name).trim(),
                    b.phone || '',
                    b.whatsapp || b.phone || '',
                    b.email || '',
                    b.nic_number || '',
                    b.address || '',
                    b.city || '',
                    b.gender || '',
                    b.blood_group || '',
                    b.skills || '',
                    b.availability || 'Weekends',
                    b.wing || 'Field Relief',
                    b.role_tier || 'Field Volunteer',
                    b.transport_mode || 'None',
                    b.emergency_contact_name || '',
                    b.emergency_contact_phone || '',
                    joinDate,
                    b.verified_id ? 1 : 0,
                    b.status || 'active',
                    b.photo_url || '',
                    b.notes || ''
                ]
            );
            const created = await db.get('SELECT * FROM volunteers WHERE id = ?', [result.lastID]);
            res.status(201).json({ id: result.lastID, volunteer_no: volunteerNo, volunteer: created, message: 'Volunteer registered successfully' });
        } catch (err) {
            if (/UNIQUE/i.test(err.message)) {
                return res.status(409).json({ message: 'Duplicate volunteer badge ID' });
            }
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/volunteers/:id', authenticateToken, async (req, res) => {
        const b = req.body || {};
        if (!b.full_name || !String(b.full_name).trim()) {
            return res.status(400).json({ message: 'Full name is required' });
        }
        try {
            const existing = await db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Volunteer not found' });

            const volunteerNo = (b.volunteer_no && String(b.volunteer_no).trim())
                ? String(b.volunteer_no).trim()
                : (existing.volunteer_no || await generateVolunteerNo());

            await db.run(
                `UPDATE volunteers SET
                    volunteer_no = ?, full_name = ?, phone = ?, whatsapp = ?, email = ?,
                    nic_number = ?, address = ?, city = ?, gender = ?, blood_group = ?,
                    skills = ?, availability = ?, wing = ?, role_tier = ?, transport_mode = ?,
                    emergency_contact_name = ?, emergency_contact_phone = ?, join_date = ?,
                    verified_id = ?, status = ?, photo_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    volunteerNo,
                    String(b.full_name).trim(),
                    b.phone ?? existing.phone,
                    b.whatsapp ?? existing.whatsapp,
                    b.email ?? existing.email,
                    b.nic_number ?? existing.nic_number,
                    b.address ?? existing.address,
                    b.city ?? existing.city,
                    b.gender ?? existing.gender,
                    b.blood_group ?? existing.blood_group,
                    b.skills ?? existing.skills,
                    b.availability ?? existing.availability,
                    b.wing ?? existing.wing,
                    b.role_tier ?? existing.role_tier,
                    b.transport_mode ?? existing.transport_mode,
                    b.emergency_contact_name ?? existing.emergency_contact_name,
                    b.emergency_contact_phone ?? existing.emergency_contact_phone,
                    b.join_date ?? existing.join_date,
                    b.verified_id !== undefined ? (b.verified_id ? 1 : 0) : existing.verified_id,
                    b.status ?? existing.status,
                    b.photo_url ?? existing.photo_url,
                    b.notes ?? existing.notes,
                    req.params.id
                ]
            );
            const updated = await db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id]);
            res.json({ volunteer: updated, message: 'Volunteer profile updated' });
        } catch (err) {
            if (/UNIQUE/i.test(err.message)) {
                return res.status(409).json({ message: 'Duplicate volunteer badge ID' });
            }
            res.status(500).json({ message: err.message });
        }
    });

    router.patch('/volunteers/:id/status', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Volunteer not found' });
            const nextStatus = req.body.status !== undefined ? req.body.status : existing.status;
            const nextVerified = req.body.verified_id !== undefined ? (req.body.verified_id ? 1 : 0) : existing.verified_id;
            await db.run(
                'UPDATE volunteers SET status = ?, verified_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [nextStatus, nextVerified, req.params.id]
            );
            const updated = await db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id]);
            res.json({ volunteer: updated, message: 'Volunteer status updated' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/volunteers/:id/activities', authenticateToken, async (req, res) => {
        try {
            const rows = await db.all(
                'SELECT * FROM volunteer_activities WHERE volunteer_id = ? ORDER BY activity_date DESC, id DESC',
                [req.params.id]
            );
            res.json(rows);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/volunteers/:id/activities', authenticateToken, async (req, res) => {
        const b = req.body || {};
        if (!b.activity_title || !String(b.activity_title).trim()) {
            return res.status(400).json({ message: 'Mission / Activity title is required' });
        }
        try {
            const vol = await db.get('SELECT id FROM volunteers WHERE id = ?', [req.params.id]);
            if (!vol) return res.status(404).json({ message: 'Volunteer not found' });

            const hrs = Math.max(0, Number(b.hours_served || 0));
            const dt = b.activity_date || new Date().toISOString().slice(0, 10);
            const ins = await db.run(
                `INSERT INTO volunteer_activities (
                    volunteer_id, activity_title, activity_type, activity_date,
                    hours_served, location, coordinator, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.params.id,
                    String(b.activity_title).trim(),
                    b.activity_type || 'Field Relief',
                    dt,
                    hrs,
                    b.location || '',
                    b.coordinator || '',
                    b.notes || ''
                ]
            );
            const stats = await recalcVolunteerStats(req.params.id);
            const activity = await db.get('SELECT * FROM volunteer_activities WHERE id = ?', [ins.lastID]);
            res.status(201).json({ activity, stats, message: 'Service hours logged' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/volunteers/activities/:activityId', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM volunteer_activities WHERE id = ?', [req.params.activityId]);
            if (!existing) return res.status(404).json({ message: 'Activity entry not found' });
            await db.run('DELETE FROM volunteer_activities WHERE id = ?', [req.params.activityId]);
            const stats = await recalcVolunteerStats(existing.volunteer_id);
            res.json({ stats, message: 'Service log entry removed' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/volunteers/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM volunteer_activities WHERE volunteer_id = ?', [req.params.id]);
            await db.run('DELETE FROM volunteers WHERE id = ?', [req.params.id]);
            res.json({ message: 'Volunteer removed' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // BENEFICIARIES CRUD
    router.get('/beneficiaries', authenticateToken, async (req, res) => {
        try {
            const beneficiaries = await db.all(`
                SELECT b.*,
                    COALESCE(hs.helps_count, 0) AS helps_count,
                    COALESCE(hs.active_helps_count, 0) AS active_helps_count,
                    COALESCE(hs.completed_helps_count, 0) AS completed_helps_count,
                    COALESCE(hs.helps_total_value, 0) AS helps_total_value,
                    COALESCE(hs.money_helps_count, 0) AS money_helps_count,
                    COALESCE(hs.equipment_helps_count, 0) AS equipment_helps_count,
                    COALESCE(hs.reconstruction_helps_count, 0) AS reconstruction_helps_count,
                    (SELECT MAX(COALESCE(bh2.help_date, substr(bh2.created_at, 1, 10))) FROM beneficiary_helps bh2 WHERE bh2.beneficiary_id = b.id) AS last_help_date,
                    (SELECT bh3.help_category FROM beneficiary_helps bh3 WHERE bh3.beneficiary_id = b.id ORDER BY COALESCE(bh3.help_date, bh3.created_at) DESC, bh3.id DESC LIMIT 1) AS last_help_category,
                    (SELECT bh4.title FROM beneficiary_helps bh4 WHERE bh4.beneficiary_id = b.id ORDER BY COALESCE(bh4.help_date, bh4.created_at) DESC, bh4.id DESC LIMIT 1) AS last_help_title,
                    (SELECT bh5.status FROM beneficiary_helps bh5 WHERE bh5.beneficiary_id = b.id ORDER BY COALESCE(bh5.help_date, bh5.created_at) DESC, bh5.id DESC LIMIT 1) AS last_help_status
                FROM beneficiaries b
                LEFT JOIN (
                    SELECT beneficiary_id,
                        COUNT(*) AS helps_count,
                        SUM(CASE WHEN status IN ('planned', 'in_progress') THEN 1 ELSE 0 END) AS active_helps_count,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_helps_count,
                        SUM(CASE WHEN status != 'cancelled' THEN COALESCE(amount, 0) ELSE 0 END) AS helps_total_value,
                        SUM(CASE WHEN help_category = 'money' AND status != 'cancelled' THEN 1 ELSE 0 END) AS money_helps_count,
                        SUM(CASE WHEN help_category = 'equipment' AND status != 'cancelled' THEN 1 ELSE 0 END) AS equipment_helps_count,
                        SUM(CASE WHEN help_category IN ('home_reconstruction', 'building_repair') AND status != 'cancelled' THEN 1 ELSE 0 END) AS reconstruction_helps_count
                    FROM beneficiary_helps
                    GROUP BY beneficiary_id
                ) hs ON hs.beneficiary_id = b.id
                ORDER BY b.created_at DESC
            `);
            res.json(beneficiaries);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/beneficiaries/:id', authenticateToken, async (req, res) => {
        try {
            const beneficiary = await db.get('SELECT * FROM beneficiaries WHERE id = ?', [req.params.id]);
            if (!beneficiary) return res.status(404).json({ message: 'Beneficiary not found' });

            const study = await db.all('SELECT * FROM beneficiary_children_study WHERE beneficiary_id = ?', [req.params.id]);
            const dropout = await db.all('SELECT * FROM beneficiary_children_dropout WHERE beneficiary_id = ?', [req.params.id]);
            const university = await db.all('SELECT * FROM beneficiary_children_university WHERE beneficiary_id = ?', [req.params.id]);
            const abroad = await db.all('SELECT * FROM beneficiary_children_abroad WHERE beneficiary_id = ?', [req.params.id]);
            const other = await db.all('SELECT * FROM beneficiary_children_other WHERE beneficiary_id = ?', [req.params.id]);

            const helps = await db.all(
                'SELECT * FROM beneficiary_helps WHERE beneficiary_id = ? ORDER BY COALESCE(help_date, created_at) DESC, id DESC',
                [req.params.id]
            );
            const help_logs = await db.all(
                `SELECT l.*, h.title AS help_title, h.help_category
                 FROM beneficiary_help_logs l
                 LEFT JOIN beneficiary_helps h ON h.id = l.help_id
                 WHERE l.beneficiary_id = ?
                 ORDER BY l.created_at DESC, l.id DESC
                 LIMIT 120`,
                [req.params.id]
            );

            res.json({ ...beneficiary, study, dropout, university, abroad, other, helps, help_logs });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Bulk import beneficiaries
    router.post('/beneficiaries/bulk-import', authenticateToken, async (req, res) => {
        try {
            const rows = req.body;
            if (!Array.isArray(rows) || rows.length === 0) {
                return res.status(400).json({ message: 'No data provided' });
            }

            const ALLOWED = new Set([
                'application_number','male_head_name','male_head_gender','male_head_age',
                'male_head_dob','male_head_occupation','male_head_address','category',
                'monthly_income','contact_number','home_town','nic_number',
                'living_home_details','vehicles_in_use','male_head_special_qualifications',
                'female_head_name','female_head_dob','female_head_occupation',
                'female_head_address','female_head_home_town','female_head_nic',
                'female_head_special_qualifications','children_count_male',
                'children_count_female','children_total_count','family_status',
                'special_needs','status'
            ]);

            let inserted = 0, skipped = 0, errors = 0;
            const errorDetails = [];

            for (const [i, raw] of rows.entries()) {
                const row = Object.fromEntries(
                    Object.entries(raw)
                        .filter(([k]) => ALLOWED.has(k.trim().toLowerCase().replace(/ /g,'_')))
                        .map(([k, v]) => [k.trim().toLowerCase().replace(/ /g,'_'), v === '' ? null : v])
                );

                if (!row.male_head_name) {
                    errors++;
                    errorDetails.push(`Row ${i + 2}: missing male_head_name`);
                    continue;
                }
                if (!row.nic_number) {
                    errors++;
                    errorDetails.push(`Row ${i + 2}: missing nic_number`);
                    continue;
                }

                // Check for duplicate NIC or Application Number
                const existingNic = await db.get(
                    'SELECT id FROM beneficiaries WHERE nic_number = ?', [row.nic_number]
                );
                if (existingNic) { skipped++; continue; }

                if (row.application_number) {
                    const existingApp = await db.get(
                        'SELECT id FROM beneficiaries WHERE application_number = ?', [row.application_number]
                    );
                    if (existingApp) { skipped++; continue; }
                }

                // Auto-generate application_number if missing
                if (!row.application_number) {
                    const last = await db.get('SELECT COUNT(*) AS cnt FROM beneficiaries');
                    row.application_number = 'EDF-' + String((last?.cnt || 0) + inserted + 1).padStart(4, '0');
                }

                row.status = row.status || 'pending';

                const cols = Object.keys(row);
                const placeholders = cols.map(() => '?').join(',');
                await db.run(
                    `INSERT INTO beneficiaries (${cols.join(',')}) VALUES (${placeholders})`,
                    Object.values(row)
                );
                inserted++;
            }

            res.json({
                inserted, skipped, errors,
                errorDetails: errorDetails.slice(0, 20),
                message: `Import complete: ${inserted} inserted, ${skipped} skipped (duplicates), ${errors} failed`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Import failed: ' + err.message });
        }
    });

    // Photo upload endpoint
    router.post('/beneficiaries/upload-photo', authenticateToken, photoUpload.single('photo'), (req, res) => {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const publicPath = `/images/beneficiaries/${req.file.filename}`;
        res.json({ photo_url: publicPath });
    });

    // Whitelist of valid beneficiaries table columns (keeps dynamic queries safe)
    const BENEFICIARY_COLUMNS = new Set([
        'application_number', 'male_head_name', 'male_head_gender', 'male_head_age',
        'male_head_dob', 'male_head_occupation', 'male_head_address', 'category',
        'monthly_income', 'contact_number', 'home_town', 'nic_number',
        'living_home_details', 'vehicles_in_use', 'male_head_special_qualifications',
        'female_head_name', 'female_head_dob', 'female_head_occupation',
        'female_head_address', 'female_head_home_town', 'female_head_nic',
        'female_head_special_qualifications', 'children_count_male', 'children_count_female',
        'children_total_count', 'abroad_details', 'family_status', 'guardian_if_divorced',
        'special_needs', 'parents_live_with_head', 'special_needs_at_home',
        'children_seeking_job', 'children_seeking_job_details', 'children_marriageable_age',
        'children_marriageable_age_details', 'children_drugs', 'family_problems',
        'applied_before', 'received_assistance_before', 'assistance_details', 'status',
        'assessment_notes', 'rejection_reason', 'photo_url'
    ]);

    router.post('/beneficiaries', authenticateToken, async (req, res) => {
        const body = req.body;
        const { study, dropout, university, abroad, other, ...rawData } = body;
        // Strip any keys that are not actual DB columns (e.g. UI-only form fields)
        const mainData = Object.fromEntries(
            Object.entries(rawData).filter(([k]) => BENEFICIARY_COLUMNS.has(k))
        );

        try {
            // Check NIC/Application unique
            if (mainData.nic_number) {
                const existingNic = await db.get('SELECT id FROM beneficiaries WHERE nic_number = ?', [mainData.nic_number]);
                if (existingNic) return res.status(400).json({ message: 'NIC number already registered' });
            }
            if (mainData.application_number) {
                const existingApp = await db.get('SELECT id FROM beneficiaries WHERE application_number = ?', [mainData.application_number]);
                if (existingApp) return res.status(400).json({ message: 'Application number already registered' });
            }

            const keys = Object.keys(mainData).join(', ');
            const placeholders = Object.keys(mainData).map(() => '?').join(', ');
            const values = Object.values(mainData);

            const result = await db.run(
                `INSERT INTO beneficiaries (${keys}) VALUES (${placeholders})`,
                values
            );
            const beneficiaryId = result.lastID;

            // Save sub-tables
            if (study && Array.isArray(study)) {
                for (const item of study) {
                    await db.run('INSERT INTO beneficiary_children_study (beneficiary_id, name, dob, grade, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.grade, item.gender || null]);
                }
            }
            if (dropout && Array.isArray(dropout)) {
                for (const item of dropout) {
                    await db.run('INSERT INTO beneficiary_children_dropout (beneficiary_id, name, dob, grade, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.grade, item.gender || null]);
                }
            }
            if (university && Array.isArray(university)) {
                for (const item of university) {
                    await db.run('INSERT INTO beneficiary_children_university (beneficiary_id, name, university_name, year, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.university_name, item.year, item.gender || null]);
                }
            }
            if (abroad && Array.isArray(abroad)) {
                for (const item of abroad) {
                    await db.run('INSERT INTO beneficiary_children_abroad (beneficiary_id, name, dob, gender) VALUES (?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.gender || null]);
                }
            }
            if (other && Array.isArray(other)) {
                for (const item of other) {
                    await db.run('INSERT INTO beneficiary_children_other (beneficiary_id, name, dob, gender, category) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.gender || null, item.category || null]);
                }
            }

            res.json({ id: beneficiaryId, message: 'Beneficiary registered successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/beneficiaries/:id', authenticateToken, async (req, res) => {
        const beneficiaryId = req.params.id;
        const body = req.body;
        const { study, dropout, university, abroad, other, id, created_at, ...rawData } = body;
        // Strip any keys that are not actual DB columns (e.g. UI-only form fields)
        const mainData = Object.fromEntries(
            Object.entries(rawData).filter(([k]) => BENEFICIARY_COLUMNS.has(k))
        );

        try {
            // Check NIC/Application unique for update
            if (mainData.nic_number) {
                const existingNic = await db.get('SELECT id FROM beneficiaries WHERE nic_number = ? AND id != ?', [mainData.nic_number, beneficiaryId]);
                if (existingNic) return res.status(400).json({ message: 'NIC number already registered to another beneficiary' });
            }
            if (mainData.application_number) {
                const existingApp = await db.get('SELECT id FROM beneficiaries WHERE application_number = ? AND id != ?', [mainData.application_number, beneficiaryId]);
                if (existingApp) return res.status(400).json({ message: 'Application number already registered to another beneficiary' });
            }

            const keys = Object.keys(mainData).map(k => `${k} = ?`).join(', ');
            const values = Object.values(mainData);
            values.push(beneficiaryId);

            await db.run(`UPDATE beneficiaries SET ${keys} WHERE id = ?`, values);

            // Update sub-tables (Delete and Re-insert)
            await db.run('DELETE FROM beneficiary_children_study WHERE beneficiary_id = ?', [beneficiaryId]);
            if (study && Array.isArray(study)) {
                for (const item of study) {
                    await db.run('INSERT INTO beneficiary_children_study (beneficiary_id, name, dob, grade, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.grade, item.gender || null]);
                }
            }

            await db.run('DELETE FROM beneficiary_children_dropout WHERE beneficiary_id = ?', [beneficiaryId]);
            if (dropout && Array.isArray(dropout)) {
                for (const item of dropout) {
                    await db.run('INSERT INTO beneficiary_children_dropout (beneficiary_id, name, dob, grade, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.grade, item.gender || null]);
                }
            }

            await db.run('DELETE FROM beneficiary_children_university WHERE beneficiary_id = ?', [beneficiaryId]);
            if (university && Array.isArray(university)) {
                for (const item of university) {
                    await db.run('INSERT INTO beneficiary_children_university (beneficiary_id, name, university_name, year, gender) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.university_name, item.year, item.gender || null]);
                }
            }

            await db.run('DELETE FROM beneficiary_children_abroad WHERE beneficiary_id = ?', [beneficiaryId]);
            if (abroad && Array.isArray(abroad)) {
                for (const item of abroad) {
                    await db.run('INSERT INTO beneficiary_children_abroad (beneficiary_id, name, dob, gender) VALUES (?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.gender || null]);
                }
            }

            await db.run('DELETE FROM beneficiary_children_other WHERE beneficiary_id = ?', [beneficiaryId]);
            if (other && Array.isArray(other)) {
                for (const item of other) {
                    await db.run('INSERT INTO beneficiary_children_other (beneficiary_id, name, dob, gender, category) VALUES (?, ?, ?, ?, ?)',
                        [beneficiaryId, item.name, item.dob, item.gender || null, item.category || null]);
                }
            }

            res.json({ message: 'Beneficiary updated successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/beneficiaries/:id', authenticateToken, async (req, res) => {
        try {
            const linkedTx = await db.all(
                'SELECT transaction_id FROM beneficiary_helps WHERE beneficiary_id = ? AND transaction_id IS NOT NULL',
                [req.params.id]
            );
            for (const row of linkedTx) {
                await db.run('DELETE FROM transactions WHERE id = ?', [row.transaction_id]);
            }
            await db.run('DELETE FROM beneficiary_help_logs WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_helps WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_children_study WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_children_dropout WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_children_university WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_children_abroad WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiary_children_other WHERE beneficiary_id = ?', [req.params.id]);
            await db.run('DELETE FROM beneficiaries WHERE id = ?', [req.params.id]);
            res.json({ message: 'Beneficiary deleted successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    router.get('/beneficiary-categories', authenticateToken, async (req, res) => {
        try {
            const categories = await db.all('SELECT * FROM beneficiary_categories ORDER BY name ASC');
            res.json(categories);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/beneficiary-categories', authenticateToken, async (req, res) => {
        const { name, description } = req.body;
        try {
            const result = await db.run(
                'INSERT INTO beneficiary_categories (name, description) VALUES (?, ?)',
                [name, description]
            );
            res.json({ id: result.lastID, message: 'Category created' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/beneficiary-categories/:id', authenticateToken, async (req, res) => {
        const { name, description } = req.body;
        try {
            await db.run(
                'UPDATE beneficiary_categories SET name = ?, description = ? WHERE id = ?',
                [name, description, req.params.id]
            );
            res.json({ message: 'Category updated' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/beneficiary-categories/:id', authenticateToken, async (req, res) => {
        try {
            // Optional: Check if any beneficiary is using this category
            await db.run('DELETE FROM beneficiary_categories WHERE id = ?', [req.params.id]);
            res.json({ message: 'Category deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // BENEFICIARY HELPS, EQUIPMENT, HOME RECONSTRUCTION & AUDIT LOGS
    // ═══════════════════════════════════════════════════════════════════════════
    const HELP_CATEGORIES = new Set(['money', 'equipment', 'home_reconstruction', 'building_repair', 'other']);
    const HELP_STATUSES = new Set(['planned', 'in_progress', 'completed', 'cancelled']);
    const HELP_PRIORITIES = new Set(['urgent', 'high', 'normal']);
    const HELP_CAT_LABELS = {
        money: 'Cash / Money Aid',
        equipment: 'Equipment Provision',
        home_reconstruction: 'Home Reconstruction',
        building_repair: 'Building Repair',
        other: 'Other Support'
    };

    function computeBenHelpsSummary(helps) {
        const rows = Array.isArray(helps) ? helps : [];
        const active = rows.filter(h => h.status !== 'cancelled');
        const byCat = {
            money: { count: 0, value: 0 },
            equipment: { count: 0, value: 0 },
            home_reconstruction: { count: 0, value: 0 },
            building_repair: { count: 0, value: 0 },
            other: { count: 0, value: 0 }
        };
        const benIds = new Set();
        let totalValue = 0;
        let activeCount = 0;
        let completedCount = 0;
        let plannedCount = 0;

        for (const h of active) {
            const cat = HELP_CATEGORIES.has(h.help_category) ? h.help_category : 'other';
            const val = Number(h.amount || 0) || 0;
            byCat[cat].count += 1;
            byCat[cat].value += val;
            totalValue += val;
            if (h.status === 'planned') { plannedCount += 1; activeCount += 1; }
            else if (h.status === 'in_progress') { activeCount += 1; }
            else if (h.status === 'completed') { completedCount += 1; }
            if (h.beneficiary_id) benIds.add(Number(h.beneficiary_id));
        }

        return {
            total_count: rows.length,
            non_cancelled_count: active.length,
            active_count: activeCount,
            planned_count: plannedCount,
            completed_count: completedCount,
            cancelled_count: rows.length - active.length,
            total_value: totalValue,
            families_helped: benIds.size,
            by_category: byCat
        };
    }

    async function syncHelpTreasuryTx(helpId, ben, payload, existingTxId) {
        const shouldSync = Number(payload.sync_transaction) === 1
            && Number(payload.amount || 0) > 0
            && payload.status !== 'cancelled';

        const catLabel = HELP_CAT_LABELS[payload.help_category] || 'Beneficiary Aid';
        const benLabel = ben ? `${ben.male_head_name || 'Beneficiary'}${ben.application_number ? ' (' + ben.application_number + ')' : ''}` : `Beneficiary #${payload.beneficiary_id}`;
        const desc = `Beneficiary Help [${catLabel}]: ${payload.title} — ${benLabel}`;
        const txDate = payload.help_date || new Date().toISOString();

        if (!shouldSync) {
            if (existingTxId) {
                await db.run('DELETE FROM transactions WHERE id = ?', [existingTxId]);
            }
            return null;
        }

        if (existingTxId) {
            await db.run(
                `UPDATE transactions SET type = 'expense', category = 'welfare', amount = ?, description = ?, date = ?, reference_id = ? WHERE id = ?`,
                [Number(payload.amount || 0), desc, txDate, helpId, existingTxId]
            );
            return existingTxId;
        }

        const txRes = await db.run(
            `INSERT INTO transactions (type, category, amount, description, date, reference_id) VALUES (?, ?, ?, ?, ?, ?)`,
            ['expense', 'welfare', Number(payload.amount || 0), desc, txDate, helpId]
        );
        return txRes.lastID;
    }

    function normalizeHelpPayload(body, existing = null) {
        const rawCat = String(body.help_category || existing?.help_category || 'money').trim().toLowerCase();
        const help_category = HELP_CATEGORIES.has(rawCat) ? rawCat : 'other';

        const rawStatus = String(body.status || existing?.status || 'planned').trim().toLowerCase();
        const status = HELP_STATUSES.has(rawStatus) ? rawStatus : 'planned';

        const rawPrio = String(body.priority || existing?.priority || 'normal').trim().toLowerCase();
        const priority = HELP_PRIORITIES.has(rawPrio) ? rawPrio : 'normal';

        const rawAmt = body.amount !== undefined ? body.amount : existing?.amount;
        const amount = Math.max(0, Number(rawAmt || 0) || 0);

        let progress_pct = body.progress_pct !== undefined
            ? parseInt(body.progress_pct, 10)
            : (existing ? parseInt(existing.progress_pct, 10) : (status === 'completed' ? 100 : 0));
        if (Number.isNaN(progress_pct)) progress_pct = 0;
        progress_pct = Math.max(0, Math.min(100, progress_pct));
        if (status === 'completed' && body.progress_pct === undefined) progress_pct = 100;

        const todayIso = new Date().toISOString().slice(0, 10);
        const help_date = (body.help_date !== undefined ? body.help_date : existing?.help_date) || todayIso;
        let completion_date = body.completion_date !== undefined ? body.completion_date : (existing?.completion_date || null);
        if (status === 'completed' && !completion_date) completion_date = todayIso;

        return {
            beneficiary_id: Number(body.beneficiary_id || existing?.beneficiary_id),
            help_category,
            title: String(body.title !== undefined ? body.title : (existing?.title || '')).trim(),
            status,
            priority,
            amount,
            quantity: body.quantity !== undefined ? (body.quantity || null) : (existing?.quantity || null),
            item_or_scope: body.item_or_scope !== undefined ? (body.item_or_scope || null) : (existing?.item_or_scope || null),
            contractor_or_supplier: body.contractor_or_supplier !== undefined ? (body.contractor_or_supplier || null) : (existing?.contractor_or_supplier || null),
            payment_method: (body.payment_method !== undefined ? body.payment_method : existing?.payment_method) || 'cash',
            reference_no: body.reference_no !== undefined ? (body.reference_no || null) : (existing?.reference_no || null),
            progress_pct,
            help_date,
            completion_date: completion_date || null,
            provided_by: body.provided_by !== undefined ? (body.provided_by || null) : (existing?.provided_by || null),
            description: body.description !== undefined ? (body.description || null) : (existing?.description || null),
            sync_transaction: (body.sync_transaction !== undefined ? body.sync_transaction : existing?.sync_transaction) ? 1 : 0
        };
    }

    router.get('/beneficiary-helps', authenticateToken, async (req, res) => {
        try {
            const { category, status, beneficiary_id, search } = req.query;
            const where = [];
            const params = [];

            if (category && category !== 'all' && HELP_CATEGORIES.has(category)) {
                where.push('h.help_category = ?');
                params.push(category);
            }
            if (status && status !== 'all' && HELP_STATUSES.has(status)) {
                where.push('h.status = ?');
                params.push(status);
            }
            if (beneficiary_id) {
                where.push('h.beneficiary_id = ?');
                params.push(Number(beneficiary_id));
            }
            if (search && String(search).trim()) {
                const q = `%${String(search).trim()}%`;
                where.push(`(h.title LIKE ? OR h.item_or_scope LIKE ? OR h.contractor_or_supplier LIKE ? OR h.reference_no LIKE ? OR b.male_head_name LIKE ? OR b.application_number LIKE ? OR b.home_town LIKE ?)`);
                params.push(q, q, q, q, q, q, q);
            }

            const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const helps = await db.all(
                `SELECT h.*,
                    b.male_head_name AS beneficiary_name,
                    b.application_number,
                    b.home_town,
                    b.contact_number,
                    b.category AS beneficiary_category,
                    b.status AS beneficiary_status,
                    (SELECT COUNT(*) FROM beneficiary_help_logs lg WHERE lg.help_id = h.id) AS logs_count
                 FROM beneficiary_helps h
                 INNER JOIN beneficiaries b ON b.id = h.beneficiary_id
                 ${whereSql}
                 ORDER BY COALESCE(h.help_date, substr(h.created_at, 1, 10)) DESC, h.id DESC`,
                params
            );

            const logs = await db.all(
                `SELECT l.*,
                    h.title AS help_title,
                    h.help_category,
                    b.male_head_name AS beneficiary_name,
                    b.application_number
                 FROM beneficiary_help_logs l
                 LEFT JOIN beneficiary_helps h ON h.id = l.help_id
                 LEFT JOIN beneficiaries b ON b.id = l.beneficiary_id
                 ${beneficiary_id ? 'WHERE l.beneficiary_id = ?' : ''}
                 ORDER BY l.created_at DESC, l.id DESC
                 LIMIT 60`,
                beneficiary_id ? [Number(beneficiary_id)] : []
            );

            res.json({
                helps,
                logs,
                summary: computeBenHelpsSummary(helps)
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/beneficiaries/:id/helps', authenticateToken, async (req, res) => {
        try {
            const ben = await db.get('SELECT * FROM beneficiaries WHERE id = ?', [req.params.id]);
            if (!ben) return res.status(404).json({ message: 'Beneficiary not found' });

            const helps = await db.all(
                `SELECT h.*,
                    (SELECT COUNT(*) FROM beneficiary_help_logs lg WHERE lg.help_id = h.id) AS logs_count
                 FROM beneficiary_helps h
                 WHERE h.beneficiary_id = ?
                 ORDER BY COALESCE(h.help_date, substr(h.created_at, 1, 10)) DESC, h.id DESC`,
                [req.params.id]
            );
            const logs = await db.all(
                `SELECT l.*, h.title AS help_title, h.help_category
                 FROM beneficiary_help_logs l
                 LEFT JOIN beneficiary_helps h ON h.id = l.help_id
                 WHERE l.beneficiary_id = ?
                 ORDER BY l.created_at DESC, l.id DESC
                 LIMIT 120`,
                [req.params.id]
            );

            res.json({
                beneficiary: ben,
                helps,
                logs,
                summary: computeBenHelpsSummary(helps)
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/beneficiaries/:id/history', authenticateToken, async (req, res) => {
        try {
            const benId = Number(req.params.id);
            const ben = await db.get('SELECT * FROM beneficiaries WHERE id = ?', [benId]);
            if (!ben) return res.status(404).json({ message: 'Beneficiary not found' });

            const [helps, extDonations, ramadanTokens] = await Promise.all([
                db.all(
                    `SELECT h.*,
                        (SELECT COUNT(*) FROM beneficiary_help_logs lg WHERE lg.help_id = h.id) AS logs_count
                     FROM beneficiary_helps h
                     WHERE h.beneficiary_id = ?
                     ORDER BY COALESCE(h.help_date, substr(h.created_at, 1, 10)) DESC, h.id DESC`,
                    [benId]
                ),
                db.all(
                    `SELECT e.*, m.full_name AS member_name
                     FROM external_donations e
                     LEFT JOIN members m ON e.member_id = m.id
                     WHERE e.beneficiary_id = ?
                     ORDER BY e.date DESC, e.id DESC`,
                    [benId]
                ),
                db.all(
                    `SELECT t.*,
                        d.title AS campaign_title, d.year AS campaign_year,
                        d.collection_date, d.collection_location, d.voucher_value
                     FROM ramadan_tokens t
                     INNER JOIN ramadan_distributions d ON d.id = t.distribution_id
                     WHERE t.beneficiary_id = ?
                     ORDER BY COALESCE(t.collected_at, t.redeemed_at, d.collection_date, t.created_at) DESC, t.id DESC`,
                    [benId]
                )
            ]);

            let familyDonations = [];
            const cleanNic = String(ben.nic_number || '').trim();
            if (cleanNic) {
                try {
                    familyDonations = await db.all(
                        `SELECT fd.*, f.head_name AS family_head, f.family_code
                         FROM family_donations fd
                         INNER JOIN families f ON f.id = fd.family_id
                         WHERE LOWER(TRIM(COALESCE(f.nic_number, ''))) = LOWER(?)
                            OR LOWER(TRIM(COALESCE(f.spouse_nic, ''))) = LOWER(?)
                         ORDER BY fd.date DESC, fd.id DESC`,
                        [cleanNic, cleanNic]
                    );
                } catch (_) {
                    familyDonations = [];
                }
            }

            const toDateKey = (v) => {
                if (!v) return '';
                const s = String(v).trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                const parsed = new Date(s);
                return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
            };
            const capLabel = (str) => String(str || 'other')
                .replace(/[_-]+/g, ' ')
                .replace(/\b\w/g, ch => ch.toUpperCase());

            const records = [];

            for (const h of helps) {
                const cat = HELP_CATEGORIES.has(h.help_category) ? h.help_category : 'other';
                records.push({
                    uid: `help-${h.id}`,
                    source_type: 'help',
                    source_label: 'Direct Help / Project',
                    record_id: Number(h.id),
                    category: cat,
                    category_label: HELP_CAT_LABELS[cat] || 'Other Support',
                    title: h.title || 'Beneficiary Help',
                    description: [h.item_or_scope, h.description].filter(Boolean).join(' — '),
                    amount: Number(h.amount || 0) || 0,
                    quantity: h.quantity || null,
                    payment_method: (h.payment_method || 'cash').toLowerCase(),
                    status: (h.status || 'planned').toLowerCase(),
                    priority: (h.priority || 'normal').toLowerCase(),
                    progress_pct: Math.max(0, Math.min(100, Number(h.progress_pct || 0))),
                    reference_no: h.reference_no || null,
                    provider: h.contractor_or_supplier || h.provided_by || null,
                    record_date: toDateKey(h.help_date || h.created_at),
                    created_at: h.created_at || h.help_date || null,
                    logs_count: Number(h.logs_count || 0)
                });
            }

            for (const d of extDonations) {
                const dType = String(d.donation_type || 'donation').toLowerCase();
                const donorDisp = d.donor_type === 'member'
                    ? (d.member_name || `Member #${d.member_id}`)
                    : (d.donor_name || 'Organization Fund');
                const dir = String(d.direction || 'expense').toLowerCase();
                records.push({
                    uid: `donation-${d.id}`,
                    source_type: 'donation',
                    source_label: dir === 'income' ? 'Incoming Earmarked Donation' : 'Treasury Aid Grant',
                    record_id: Number(d.id),
                    category: dType,
                    category_label: capLabel(dType),
                    title: `${capLabel(dType)} Distribution${d.recipient_name ? ` — ${d.recipient_name}` : ''}`,
                    description: d.description || (donorDisp ? `Source / Donor: ${donorDisp}` : ''),
                    amount: Number(d.amount || 0) || 0,
                    quantity: null,
                    payment_method: (d.payment_method || 'cash').toLowerCase(),
                    status: 'completed',
                    priority: 'normal',
                    progress_pct: 100,
                    reference_no: `DON-${d.id}`,
                    provider: donorDisp || 'EDF Treasury',
                    record_date: toDateKey(d.date),
                    created_at: d.date || null,
                    logs_count: 0
                });
            }

            for (const fd of familyDonations) {
                const fType = String(fd.donation_type || 'cash').toLowerCase();
                records.push({
                    uid: `family-${fd.id}`,
                    source_type: 'family_donation',
                    source_label: 'Family Relief Grant',
                    record_id: Number(fd.id),
                    category: fType,
                    category_label: capLabel(fType),
                    title: `${capLabel(fType)} Relief (${fd.family_code || fd.family_head || 'Family'})`,
                    description: fd.description || '',
                    amount: Number(fd.amount || 0) || 0,
                    quantity: null,
                    payment_method: (fd.payment_method || 'cash').toLowerCase(),
                    status: 'completed',
                    priority: 'normal',
                    progress_pct: 100,
                    reference_no: fd.reference_no || `FAM-${fd.id}`,
                    provider: fd.distributed_by || 'EDF Relief Team',
                    record_date: toDateKey(fd.date),
                    created_at: fd.date || null,
                    logs_count: 0
                });
            }

            for (const rt of ramadanTokens) {
                const st = String(rt.status || 'pending').toLowerCase();
                const isDone = st === 'collected' || st === 'redeemed';
                const isCancelled = st === 'absent' || st === 'cancelled';
                records.push({
                    uid: `ramadan-${rt.id}`,
                    source_type: 'ramadan',
                    source_label: 'Ramadan Token Distribution',
                    record_id: Number(rt.id),
                    category: 'ramadan_voucher',
                    category_label: 'Ramadan Distribution',
                    title: `${rt.campaign_title || 'Ramadan Distribution'} (${rt.campaign_year || ''})`.trim(),
                    description: [
                        rt.allocated_shop ? `Shop: ${rt.allocated_shop}` : '',
                        rt.collection_location ? `Location: ${rt.collection_location}` : '',
                        rt.notes || ''
                    ].filter(Boolean).join(' · '),
                    amount: Number(rt.voucher_value || 0) || 0,
                    quantity: '1 Token Pack',
                    payment_method: 'voucher',
                    status: st,
                    priority: 'normal',
                    progress_pct: isDone ? 100 : (st === 'issued' ? 60 : (isCancelled ? 0 : 20)),
                    reference_no: rt.token_number ? `#${rt.token_number}` : `TKN-${rt.id}`,
                    provider: rt.allocated_shop || rt.collector_name || 'Ramadan Desk',
                    record_date: toDateKey(rt.collected_at || rt.redeemed_at || rt.collection_date || rt.created_at),
                    created_at: rt.collected_at || rt.redeemed_at || rt.created_at || null,
                    logs_count: 0
                });
            }

            records.sort((a, b) => {
                const da = a.record_date || '';
                const dbStr = b.record_date || '';
                if (dbStr !== da) return dbStr.localeCompare(da);
                return Number(b.record_id || 0) - Number(a.record_id || 0);
            });

            const completedStates = new Set(['completed', 'collected', 'redeemed', 'disbursed']);
            const cancelledStates = new Set(['cancelled', 'absent']);
            const activeRecords = records.filter(r => !cancelledStates.has(r.status));
            const dated = activeRecords.map(r => r.record_date).filter(Boolean).sort();
            const yearsSet = new Set(records.map(r => (r.record_date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)));

            const activeValue = activeRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const helpsRecs = activeRecords.filter(r => r.source_type === 'help');
            const donRecs = activeRecords.filter(r => r.source_type === 'donation' || r.source_type === 'family_donation');
            const ramRecs = activeRecords.filter(r => r.source_type === 'ramadan');

            const summary = {
                total_records: records.length,
                active_count: activeRecords.length,
                active_value: activeValue,
                avg_amount: activeRecords.length ? activeValue / activeRecords.length : 0,
                helps_count: records.filter(r => r.source_type === 'help').length,
                helps_value: helpsRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0),
                donations_count: records.filter(r => r.source_type === 'donation' || r.source_type === 'family_donation').length,
                donations_value: donRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0),
                ramadan_count: records.filter(r => r.source_type === 'ramadan').length,
                ramadan_value: ramRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0),
                completed_count: records.filter(r => completedStates.has(r.status)).length,
                pending_count: records.filter(r => !completedStates.has(r.status) && !cancelledStates.has(r.status)).length,
                cancelled_count: records.filter(r => cancelledStates.has(r.status)).length,
                last_aid_date: dated.length ? dated[dated.length - 1] : null,
                first_aid_date: dated.length ? dated[0] : null,
                years: Array.from(yearsSet).sort((a, b) => b.localeCompare(a)),
                logs_total: helps.reduce((s, h) => s + Number(h.logs_count || 0), 0)
            };

            res.json({ beneficiary: ben, records, summary });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/beneficiary-helps', authenticateToken, async (req, res) => {
        try {
            const payload = normalizeHelpPayload(req.body);
            if (!payload.beneficiary_id || Number.isNaN(payload.beneficiary_id)) {
                return res.status(400).json({ message: 'Beneficiary ID is required' });
            }
            if (!payload.title) {
                return res.status(400).json({ message: 'Help title / summary is required' });
            }

            const ben = await db.get('SELECT id, male_head_name, application_number FROM beneficiaries WHERE id = ?', [payload.beneficiary_id]);
            if (!ben) return res.status(404).json({ message: 'Beneficiary not found' });

            const createdBy = (req.user && req.user.username) || payload.provided_by || 'Admin';
            const result = await db.run(
                `INSERT INTO beneficiary_helps (
                    beneficiary_id, help_category, title, status, priority, amount,
                    quantity, item_or_scope, contractor_or_supplier, payment_method,
                    reference_no, progress_pct, help_date, completion_date,
                    provided_by, description, sync_transaction, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    payload.beneficiary_id, payload.help_category, payload.title, payload.status,
                    payload.priority, payload.amount, payload.quantity, payload.item_or_scope,
                    payload.contractor_or_supplier, payload.payment_method, payload.reference_no,
                    payload.progress_pct, payload.help_date, payload.completion_date,
                    payload.provided_by, payload.description, payload.sync_transaction, createdBy
                ]
            );

            const helpId = result.lastID;
            const txId = await syncHelpTreasuryTx(helpId, ben, payload, null);
            if (txId) {
                await db.run('UPDATE beneficiary_helps SET transaction_id = ? WHERE id = ?', [txId, helpId]);
            }

            const catLabel = HELP_CAT_LABELS[payload.help_category] || payload.help_category;
            const valPart = payload.amount > 0 ? ` · Value LKR ${Number(payload.amount).toLocaleString()}` : '';
            const customNote = req.body.log_note && String(req.body.log_note).trim();
            const defaultNote = customNote || `Recorded ${catLabel}: "${payload.title}" (${payload.status.replace('_', ' ')}, ${payload.progress_pct}%${valPart})${payload.contractor_or_supplier ? ` via ${payload.contractor_or_supplier}` : ''}.`;

            const logRes = await db.run(
                `INSERT INTO beneficiary_help_logs (
                    help_id, beneficiary_id, action_type, status_snapshot, progress_snapshot, amount_snapshot, note, logged_by
                ) VALUES (?, ?, 'created', ?, ?, ?, ?, ?)`,
                [helpId, payload.beneficiary_id, payload.status, payload.progress_pct, payload.amount, defaultNote, createdBy]
            );

            const help = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [helpId]);
            res.status(201).json({ id: helpId, log_id: logRes.lastID, help, message: 'Beneficiary help recorded successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/beneficiary-helps/:helpId', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [req.params.helpId]);
            if (!existing) return res.status(404).json({ message: 'Help record not found' });

            const payload = normalizeHelpPayload(req.body, existing);
            if (!payload.title) {
                return res.status(400).json({ message: 'Help title / summary is required' });
            }

            const ben = await db.get('SELECT id, male_head_name, application_number FROM beneficiaries WHERE id = ?', [payload.beneficiary_id]);
            const nextTxId = await syncHelpTreasuryTx(existing.id, ben, payload, existing.transaction_id);

            await db.run(
                `UPDATE beneficiary_helps SET
                    help_category = ?, title = ?, status = ?, priority = ?, amount = ?,
                    quantity = ?, item_or_scope = ?, contractor_or_supplier = ?, payment_method = ?,
                    reference_no = ?, progress_pct = ?, help_date = ?, completion_date = ?,
                    provided_by = ?, description = ?, sync_transaction = ?, transaction_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    payload.help_category, payload.title, payload.status, payload.priority, payload.amount,
                    payload.quantity, payload.item_or_scope, payload.contractor_or_supplier, payload.payment_method,
                    payload.reference_no, payload.progress_pct, payload.help_date, payload.completion_date,
                    payload.provided_by, payload.description, payload.sync_transaction, nextTxId,
                    existing.id
                ]
            );

            const changes = [];
            if (existing.status !== payload.status) changes.push(`Status: ${existing.status.replace('_', ' ')} -> ${payload.status.replace('_', ' ')}`);
            if (Number(existing.progress_pct || 0) !== Number(payload.progress_pct || 0)) changes.push(`Progress: ${existing.progress_pct || 0}% -> ${payload.progress_pct}%`);
            if (Number(existing.amount || 0) !== Number(payload.amount || 0)) changes.push(`Value: LKR ${Number(existing.amount || 0).toLocaleString()} -> LKR ${Number(payload.amount || 0).toLocaleString()}`);
            if (existing.help_category !== payload.help_category) changes.push(`Category: ${existing.help_category} -> ${payload.help_category}`);

            const customNote = req.body.log_note && String(req.body.log_note).trim();
            const noteText = customNote
                ? (changes.length ? `${customNote} (${changes.join(' · ')})` : customNote)
                : (changes.length ? `Updated "${payload.title}": ${changes.join(' · ')}` : `Updated details for "${payload.title}"`);
            const actionType = existing.status !== payload.status ? 'status_change' : 'updated';
            const loggedBy = (req.user && req.user.username) || payload.provided_by || 'Admin';

            await db.run(
                `INSERT INTO beneficiary_help_logs (
                    help_id, beneficiary_id, action_type, status_snapshot, progress_snapshot, amount_snapshot, note, logged_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [existing.id, payload.beneficiary_id, actionType, payload.status, payload.progress_pct, payload.amount, noteText, loggedBy]
            );

            const help = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [existing.id]);
            res.json({ help, message: 'Beneficiary help updated successfully' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/beneficiary-helps/:helpId/logs', authenticateToken, async (req, res) => {
        try {
            const help = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [req.params.helpId]);
            if (!help) return res.status(404).json({ message: 'Help record not found' });

            const note = String(req.body.note || '').trim();
            if (!note) return res.status(400).json({ message: 'Log note is required' });

            const validActionTypes = new Set(['field_visit', 'delivery', 'inspection', 'milestone', 'status_change', 'note', 'updated']);
            const rawAction = String(req.body.action_type || 'note').trim().toLowerCase();
            const action_type = validActionTypes.has(rawAction) ? rawAction : 'note';

            let nextStatus = help.status;
            let nextProgress = Number(help.progress_pct || 0);
            let nextCompletion = help.completion_date;

            if (req.body.status_update && HELP_STATUSES.has(String(req.body.status_update).trim().toLowerCase())) {
                nextStatus = String(req.body.status_update).trim().toLowerCase();
            }
            if (req.body.progress_update !== undefined && req.body.progress_update !== '' && req.body.progress_update !== null) {
                const parsed = parseInt(req.body.progress_update, 10);
                if (!Number.isNaN(parsed)) nextProgress = Math.max(0, Math.min(100, parsed));
            }
            if (nextStatus === 'completed' && (req.body.progress_update === undefined || req.body.progress_update === '')) {
                nextProgress = 100;
            }
            if (nextStatus === 'completed' && !nextCompletion) {
                nextCompletion = new Date().toISOString().slice(0, 10);
            }

            if (nextStatus !== help.status || nextProgress !== Number(help.progress_pct || 0) || nextCompletion !== help.completion_date) {
                await db.run(
                    `UPDATE beneficiary_helps SET status = ?, progress_pct = ?, completion_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [nextStatus, nextProgress, nextCompletion, help.id]
                );
                const ben = await db.get('SELECT id, male_head_name, application_number FROM beneficiaries WHERE id = ?', [help.beneficiary_id]);
                const nextTxId = await syncHelpTreasuryTx(help.id, ben, { ...help, status: nextStatus, progress_pct: nextProgress }, help.transaction_id);
                if (nextTxId !== help.transaction_id) {
                    await db.run('UPDATE beneficiary_helps SET transaction_id = ? WHERE id = ?', [nextTxId, help.id]);
                }
            }

            const loggedBy = String(req.body.logged_by || (req.user && req.user.username) || 'Admin').trim();
            const logRes = await db.run(
                `INSERT INTO beneficiary_help_logs (
                    help_id, beneficiary_id, action_type, status_snapshot, progress_snapshot, amount_snapshot, note, logged_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [help.id, help.beneficiary_id, action_type, nextStatus, nextProgress, help.amount, note, loggedBy]
            );

            const log = await db.get('SELECT * FROM beneficiary_help_logs WHERE id = ?', [logRes.lastID]);
            const updatedHelp = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [help.id]);
            res.status(201).json({ id: logRes.lastID, log, help: updatedHelp, message: 'Support log recorded' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/beneficiary-helps/:helpId', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM beneficiary_helps WHERE id = ?', [req.params.helpId]);
            if (!existing) return res.status(404).json({ message: 'Help record not found' });

            if (existing.transaction_id) {
                await db.run('DELETE FROM transactions WHERE id = ?', [existing.transaction_id]);
            }
            await db.run('DELETE FROM beneficiary_help_logs WHERE help_id = ?', [existing.id]);
            await db.run('DELETE FROM beneficiary_helps WHERE id = ?', [existing.id]);

            res.json({ message: 'Beneficiary help deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};

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

module.exports = (db) => {
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
            relatives // Nested array of family members
        } = req.body;
        try {
            // Check if NIC already exists
            if (nic_number) {
                const existing = await db.get('SELECT id FROM members WHERE nic_number = ?', [nic_number]);
                if (existing) {
                    return res.status(400).json({ message: 'A member with this NIC number is already registered.' });
                }
            }

            const result = await db.run(
                `INSERT INTO members (
                    full_name, email, phone, address, city, gender, age, 
                    monthly_income, join_date, nic_number, marital_status,
                    bank_name, bank_branch, account_number, previous_balance,
                    blood_group, occupation, sibling_id, member_type, monthly_subscription
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    full_name, email, phone, address, city, gender, age,
                    monthly_income, join_date, nic_number, marital_status,
                    bank_name, bank_branch, account_number, previous_balance,
                    blood_group, occupation, sibling_id || null, member_type, monthly_subscription
                ]
            );

            const memberId = result.lastID;

            // Save Relatives if provided
            if (relatives && Array.isArray(relatives)) {
                for (const r of relatives) {
                    if (!r.full_name) continue;
                    await db.run(
                        'INSERT INTO member_relatives (member_id, full_name, relationship, age, nic_number, occupation) VALUES (?, ?, ?, ?, ?, ?)',
                        [memberId, r.full_name, r.relationship, r.age, r.nic_number, r.occupation]
                    );
                }
            }

            res.json({ id: memberId, message: 'Member added with family details' });
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
            relatives
        } = req.body;
        const memberId = req.params.id;
        try {
            await db.run(
                `UPDATE members SET 
                    full_name=?, email=?, phone=?, address=?, city=?, gender=?, age=?, 
                    monthly_income=?, join_date=?, nic_number=?, marital_status=?,
                    bank_name=?, bank_branch=?, account_number=?, previous_balance=?,
                    blood_group=?, occupation=?, sibling_id=?, member_type=?, 
                    monthly_subscription=?, status=? 
                WHERE id=?`,
                [
                    full_name, email, phone, address, city, gender, age,
                    monthly_income, join_date, nic_number, marital_status,
                    bank_name, bank_branch, account_number, previous_balance,
                    blood_group, occupation, sibling_id || null, member_type,
                    monthly_subscription, status, memberId
                ]
            );

            // Update Relatives: Simplest way is delete all and re-insert if sending full list
            if (relatives && Array.isArray(relatives)) {
                await db.run('DELETE FROM member_relatives WHERE member_id = ?', [memberId]);
                for (const r of relatives) {
                    if (!r.full_name) continue;
                    await db.run(
                        'INSERT INTO member_relatives (member_id, full_name, relationship, age, nic_number, occupation) VALUES (?, ?, ?, ?, ?, ?)',
                        [memberId, r.full_name, r.relationship, r.age, r.nic_number, r.occupation]
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
                `SELECT id, month, amount, payment_date
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
    router.get('/families', authenticateToken, async (req, res) => {
        try {
            const families = await db.all('SELECT * FROM families ORDER BY created_at DESC');
            res.json(families);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/families', authenticateToken, async (req, res) => {
        const { head_name, address, phone, member_count, poverty_level } = req.body;
        try {
            const result = await db.run(
                'INSERT INTO families (head_name, address, phone, member_count, poverty_level) VALUES (?, ?, ?, ?, ?)',
                [head_name, address, phone, member_count, poverty_level]
            );
            res.json({ id: result.lastID, message: 'Family added' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.get('/families/:id/aid', authenticateToken, async (req, res) => {
        try {
            const aid = await db.all('SELECT * FROM family_donations WHERE family_id = ? ORDER BY date DESC', [req.params.id]);
            res.json(aid);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/families/:id/aid', authenticateToken, async (req, res) => {
        const { amount, donation_type, description, date } = req.body;
        const family_id = req.params.id;
        try {
            const result = await db.run(
                'INSERT INTO family_donations (family_id, amount, donation_type, description, date) VALUES (?, ?, ?, ?, ?)',
                [family_id, amount, donation_type, description, date || new Date().toISOString()]
            );

            // Log as expense transaction
            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                ['expense', 'welfare', amount, `${donation_type.toUpperCase()} Distributed to Family ID: ${family_id}`, result.lastID]
            );

            res.json({ id: result.lastID, message: 'Aid distribution recorded' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/families/:id/aid/:aidId', authenticateToken, async (req, res) => {
        const { amount, donation_type, description, date } = req.body;
        try {
            await db.run(
                'UPDATE family_donations SET amount=?, donation_type=?, description=?, date=? WHERE id=? AND family_id=?',
                [amount, donation_type, description, date || new Date().toISOString(), req.params.aidId, req.params.id]
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
            const total     = (await db.get('SELECT COUNT(*) as c FROM families')).c;
            const active    = (await db.get("SELECT COUNT(*) as c FROM families WHERE status='active'")).c;
            const highNeed  = (await db.get("SELECT COUNT(*) as c FROM families WHERE poverty_level='high'")).c;
            const totalAid  = (await db.get('SELECT COALESCE(SUM(amount),0) as s FROM family_donations')).s;
            res.json({ total, active, highNeed, totalAid });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.put('/families/:id', authenticateToken, async (req, res) => {
        const { head_name, address, phone, member_count, poverty_level, status } = req.body;
        try {
            await db.run(
                'UPDATE families SET head_name=?, address=?, phone=?, member_count=?, poverty_level=?, status=? WHERE id=?',
                [head_name, address, phone, member_count, poverty_level, status, req.params.id]
            );
            res.json({ message: 'Family updated' });
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

    router.post('/subscriptions', authenticateToken, async (req, res) => {
        const { member_id, amount, month, paid_amount, payment_method, notes, is_advance, payment_date } = req.body;
        try {
            // Allow multiple payments per month (partial) — only block FULL duplicate if paid_amount >= amount
            const existing = await db.get('SELECT id FROM subscriptions WHERE member_id=? AND month=?', [member_id, month]);
            if (existing && !is_advance) {
                // Already has a subscription record — add a payment entry instead
                const actualPaid = parseFloat(paid_amount) || parseFloat(amount);
                await db.run(
                    `INSERT INTO subscription_payments (subscription_id, amount, payment_method, notes, payment_date) VALUES (?, ?, ?, ?, ?)`,
                    [existing.id, actualPaid, payment_method || 'cash', notes || null, payment_date || new Date().toISOString()]
                );
                // Update paid_amount on parent subscription
                await db.run(
                    `UPDATE subscriptions SET paid_amount = COALESCE(paid_amount,0) + ?, payment_method=?, notes=? WHERE id=?`,
                    [actualPaid, payment_method || 'cash', notes || null, existing.id]
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
                `INSERT INTO subscriptions (member_id, amount, paid_amount, month, payment_method, notes, is_advance, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [member_id, amount, actualPaid, month, payment_method || 'cash',
                 notes || null, is_advance ? 1 : 0,
                 payment_date || new Date().toISOString()]
            );

            // Record initial payment detail
            await db.run(
                `INSERT INTO subscription_payments (subscription_id, amount, payment_method, notes, payment_date) VALUES (?, ?, ?, ?, ?)`,
                [result.lastID, actualPaid, payment_method || 'cash', notes || null, payment_date || new Date().toISOString()]
            );

            const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [member_id]);
            const memberName = memberRow ? memberRow.full_name : 'Unknown';
            const advanceTag = is_advance ? ' [ADVANCE]' : '';
            await db.run(
                'INSERT INTO transactions (type, category, amount, description, reference_id) VALUES (?, ?, ?, ?, ?)',
                ['income', 'subscription', actualPaid,
                 `Monthly subscription (${month}) - ${memberName} [${payment_method || 'cash'}]${advanceTag}`,
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
            const members = await db.all('SELECT id, full_name, member_type, monthly_subscription, status FROM members ORDER BY full_name ASC');
            const subs = month
                ? await db.all(`SELECT s.*, m.full_name as member_name FROM subscriptions s JOIN members m ON s.member_id=m.id WHERE s.month=?`, [month])
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

    router.put('/subscriptions/:id', authenticateToken, async (req, res) => {
        const { amount, month, paid_amount, payment_method, notes, is_advance } = req.body;
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
                `UPDATE subscriptions SET amount=?, paid_amount=?, month=?, payment_method=?, notes=?, is_advance=? WHERE id=?`,
                [amount, actualPaid, month, payment_method || 'cash', notes || null, is_advance ? 1 : 0, id]
            );
            const memberRow = await db.get('SELECT full_name FROM members WHERE id=?', [sub.member_id]);
            const memberName = memberRow ? memberRow.full_name : 'Unknown';
            await db.run(
                `UPDATE transactions SET amount=?, description=? WHERE reference_id=? AND category='subscription'`,
                [actualPaid, `Monthly subscription (${month}) - ${memberName} [${payment_method || 'cash'}]`, id]
            );
            res.json({ message: 'Subscription updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // Add another payment to an existing subscription
    router.post('/subscriptions/:id/payments', authenticateToken, async (req, res) => {
        const { amount, payment_method, notes, reference_number, payment_date } = req.body;
        const subId = req.params.id;
        try {
            const sub = await db.get('SELECT * FROM subscriptions WHERE id=?', [subId]);
            if (!sub) return res.status(404).json({ message: 'Subscription not found' });

            const result = await db.run(
                `INSERT INTO subscription_payments (subscription_id, amount, payment_method, reference_number, notes, payment_date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [subId, amount, payment_method || 'cash', reference_number || null,
                 notes || null, payment_date || new Date().toISOString()]
            );
            // Update parent subscription paid_amount
            await db.run(
                `UPDATE subscriptions SET paid_amount = COALESCE(paid_amount,0) + ?, payment_method=? WHERE id=?`,
                [amount, payment_method || 'cash', subId]
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

    // VOLUNTEERS
    router.get('/volunteers', authenticateToken, async (req, res) => {
        try {
            const volunteers = await db.all('SELECT * FROM volunteers ORDER BY created_at DESC');
            res.json(volunteers);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.post('/volunteers', authenticateToken, async (req, res) => {
        const { full_name, phone, email, skills } = req.body;
        try {
            const result = await db.run(
                'INSERT INTO volunteers (full_name, phone, email, skills) VALUES (?, ?, ?, ?)',
                [full_name, phone, email, skills]
            );
            res.json({ id: result.lastID, message: 'Volunteer registered' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    router.delete('/volunteers/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM volunteers WHERE id = ?', [req.params.id]);
            res.json({ message: 'Volunteer removed' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // BENEFICIARIES CRUD
    router.get('/beneficiaries', authenticateToken, async (req, res) => {
        try {
            const beneficiaries = await db.all('SELECT * FROM beneficiaries ORDER BY created_at DESC');
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

            res.json({ ...beneficiary, study, dropout, university, abroad, other });
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

    return router;
};

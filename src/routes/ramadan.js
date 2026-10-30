const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // Ensure extended columns exist on existing SQLite databases
    (async () => {
        const migrations = [
            "ALTER TABLE ramadan_distributions ADD COLUMN package_type TEXT DEFAULT 'dry_ration'",
            "ALTER TABLE ramadan_distributions ADD COLUMN hijri_year TEXT",
            "ALTER TABLE ramadan_distributions ADD COLUMN collection_time TEXT",
            "ALTER TABLE ramadan_distributions ADD COLUMN coordinator_name TEXT",
            "ALTER TABLE ramadan_distributions ADD COLUMN coordinator_phone TEXT",
            "ALTER TABLE ramadan_distributions ADD COLUMN target_quota INTEGER DEFAULT 0",
            "ALTER TABLE ramadan_distributions ADD COLUMN package_items TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN collector_name TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN collector_nic TEXT"
        ];
        for (const sql of migrations) {
            try { await db.run(sql); } catch (_) {}
        }
    })();

    // Helper: Safely compute next sequence number for a distribution's tokens
    async function getNextTokenSeq(distId) {
        const rows = await db.all(
            'SELECT token_number FROM ramadan_tokens WHERE distribution_id = ?',
            [distId]
        );
        let maxSeq = rows.length;
        for (const r of rows) {
            const parts = String(r.token_number || '').split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum) && lastNum > maxSeq) maxSeq = lastNum;
        }
        return maxSeq + 1;
    }

    // ── Distributions ────────────────────────────────────────────────────────

    // GET eligible beneficiaries metadata (count, towns, categories)
    router.get('/eligible-meta', authenticateToken, async (req, res) => {
        try {
            const activeRows = await db.all(`
                SELECT id, home_town, category
                FROM beneficiaries
                WHERE status = 'Active'
            `);
            const towns = [...new Set(activeRows.map(r => (r.home_town || '').trim()).filter(Boolean))].sort();
            const categories = [...new Set(activeRows.map(r => (r.category || '').trim()).filter(Boolean))].sort();
            res.json({
                active_count: activeRows.length,
                towns,
                categories
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch eligible metadata' });
        }
    });

    // GET all distributions with token counts
    router.get('/distributions', authenticateToken, async (req, res) => {
        try {
            const activeBenRow = await db.get(`SELECT COUNT(*) AS cnt FROM beneficiaries WHERE status = 'Active'`);
            const eligibleActiveCount = activeBenRow?.cnt || 0;

            const distributions = await db.all(`
                SELECT
                    d.*,
                    COUNT(t.id)                                             AS total_tokens,
                    SUM(CASE WHEN t.status = 'collected' THEN 1 ELSE 0 END) AS collected_count,
                    SUM(CASE WHEN t.status = 'pending'   THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN t.status = 'absent'    THEN 1 ELSE 0 END) AS absent_count
                FROM ramadan_distributions d
                LEFT JOIN ramadan_tokens t ON t.distribution_id = d.id
                GROUP BY d.id
                ORDER BY d.year DESC, d.created_at DESC
            `);
            res.json(distributions.map(d => ({
                ...d,
                total_tokens: d.total_tokens || 0,
                collected_count: d.collected_count || 0,
                pending_count: d.pending_count || 0,
                absent_count: d.absent_count || 0,
                eligible_active_count: eligibleActiveCount
            })));
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch distributions' });
        }
    });

    // POST create distribution (with optional auto-assignment of tokens)
    router.post('/distributions', authenticateToken, async (req, res) => {
        try {
            const {
                year,
                title,
                collection_date,
                collection_location,
                voucher_value,
                notes,
                status,
                package_type,
                hijri_year,
                collection_time,
                coordinator_name,
                coordinator_phone,
                target_quota,
                package_items,
                auto_assign_mode,
                auto_assign_category,
                auto_assign_town
            } = req.body;

            if (!year || !title) {
                return res.status(400).json({ message: 'Year and title are required' });
            }

            const result = await db.run(
                `INSERT INTO ramadan_distributions (
                    year, title, collection_date, collection_location, voucher_value,
                    notes, status, package_type, hijri_year, collection_time,
                    coordinator_name, coordinator_phone, target_quota, package_items
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    year,
                    title.trim(),
                    collection_date || null,
                    collection_location || null,
                    Number(voucher_value) || 0,
                    notes || null,
                    status || 'active',
                    package_type || 'dry_ration',
                    hijri_year || null,
                    collection_time || null,
                    coordinator_name || null,
                    coordinator_phone || null,
                    Number(target_quota) || 0,
                    package_items || null
                ]
            );

            const distId = result.lastID;
            let assignedCount = 0;

            if (auto_assign_mode === 'all_active' || auto_assign_mode === 'filtered') {
                let query = `SELECT id FROM beneficiaries WHERE status = 'Active'`;
                const params = [];

                if (auto_assign_mode === 'filtered') {
                    if (auto_assign_category && auto_assign_category !== 'all') {
                        query += ` AND LOWER(TRIM(category)) = LOWER(TRIM(?))`;
                        params.push(auto_assign_category);
                    }
                    if (auto_assign_town && auto_assign_town !== 'all') {
                        query += ` AND LOWER(TRIM(home_town)) = LOWER(TRIM(?))`;
                        params.push(auto_assign_town);
                    }
                }
                query += ` ORDER BY id`;
                if (Number(target_quota) > 0) {
                    query += ` LIMIT ?`;
                    params.push(Number(target_quota));
                }

                const beneficiaries = await db.all(query, params);
                let seq = 1;
                for (const ben of beneficiaries) {
                    const tokenNumber = `RMD-${year}-${String(seq).padStart(4, '0')}`;
                    await db.run(
                        `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number)
                         VALUES (?, ?, ?)`,
                        [distId, ben.id, tokenNumber]
                    );
                    seq++;
                    assignedCount++;
                }
            }

            res.json({
                id: distId,
                assigned_count: assignedCount,
                message: assignedCount > 0
                    ? `Distribution created and ${assignedCount} token(s) issued`
                    : 'Distribution created successfully'
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to create distribution' });
        }
    });

    // PUT bulk status update for distributions
    router.put('/distributions/bulk-status', authenticateToken, async (req, res) => {
        try {
            const { ids, status } = req.body;
            const allowed = ['active', 'completed', 'cancelled'];
            if (!Array.isArray(ids) || ids.length === 0 || !allowed.includes(status)) {
                return res.status(400).json({ message: 'Valid distribution IDs and status are required' });
            }
            const placeholders = ids.map(() => '?').join(',');
            await db.run(
                `UPDATE ramadan_distributions SET status = ? WHERE id IN (${placeholders})`,
                [status, ...ids]
            );
            res.json({ message: `Updated ${ids.length} distribution(s) to ${status}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Bulk status update failed' });
        }
    });

    // POST bulk delete distributions
    router.post('/distributions/bulk-delete', authenticateToken, async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ message: 'Valid distribution IDs are required' });
            }
            const placeholders = ids.map(() => '?').join(',');
            await db.run(
                `DELETE FROM ramadan_distributions WHERE id IN (${placeholders})`,
                ids
            );
            res.json({ message: `Deleted ${ids.length} distribution(s)` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Bulk delete failed' });
        }
    });

    // PUT update distribution
    router.put('/distributions/:id', authenticateToken, async (req, res) => {
        try {
            const {
                year,
                title,
                collection_date,
                collection_location,
                voucher_value,
                notes,
                status,
                package_type,
                hijri_year,
                collection_time,
                coordinator_name,
                coordinator_phone,
                target_quota,
                package_items
            } = req.body;

            if (!year || !title) {
                return res.status(400).json({ message: 'Year and title are required' });
            }

            await db.run(
                `UPDATE ramadan_distributions
                 SET year=?, title=?, collection_date=?, collection_location=?, voucher_value=?,
                     notes=?, status=?, package_type=?, hijri_year=?, collection_time=?,
                     coordinator_name=?, coordinator_phone=?, target_quota=?, package_items=?
                 WHERE id=?`,
                [
                    year,
                    title.trim(),
                    collection_date || null,
                    collection_location || null,
                    Number(voucher_value) || 0,
                    notes || null,
                    status || 'active',
                    package_type || 'dry_ration',
                    hijri_year || null,
                    collection_time || null,
                    coordinator_name || null,
                    coordinator_phone || null,
                    Number(target_quota) || 0,
                    package_items || null,
                    req.params.id
                ]
            );
            res.json({ message: 'Distribution updated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update distribution' });
        }
    });

    // POST duplicate a distribution campaign
    router.post('/distributions/:id/duplicate', authenticateToken, async (req, res) => {
        try {
            const orig = await db.get('SELECT * FROM ramadan_distributions WHERE id=?', [req.params.id]);
            if (!orig) return res.status(404).json({ message: 'Original distribution not found' });

            const copyBeneficiaries = req.body?.copy_beneficiaries !== false;
            const newTitle = req.body?.title || `${orig.title} (Copy)`;
            const newYear = req.body?.year || orig.year;

            const result = await db.run(
                `INSERT INTO ramadan_distributions (
                    year, title, collection_date, collection_location, voucher_value,
                    notes, status, package_type, hijri_year, collection_time,
                    coordinator_name, coordinator_phone, target_quota, package_items
                 ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newYear,
                    newTitle,
                    orig.collection_date || null,
                    orig.collection_location || null,
                    orig.voucher_value || 0,
                    orig.notes || null,
                    orig.package_type || 'dry_ration',
                    orig.hijri_year || null,
                    orig.collection_time || null,
                    orig.coordinator_name || null,
                    orig.coordinator_phone || null,
                    orig.target_quota || 0,
                    orig.package_items || null
                ]
            );

            const newDistId = result.lastID;
            let copiedTokens = 0;

            if (copyBeneficiaries) {
                const origTokens = await db.all(
                    'SELECT beneficiary_id FROM ramadan_tokens WHERE distribution_id = ? ORDER BY id',
                    [orig.id]
                );
                let seq = 1;
                for (const t of origTokens) {
                    const tokenNumber = `RMD-${newYear}-${String(seq).padStart(4, '0')}`;
                    await db.run(
                        `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, status)
                         VALUES (?, ?, ?, 'pending')`,
                        [newDistId, t.beneficiary_id, tokenNumber]
                    );
                    seq++;
                    copiedTokens++;
                }
            }

            res.json({
                id: newDistId,
                copied_tokens: copiedTokens,
                message: copiedTokens > 0
                    ? `Campaign duplicated with ${copiedTokens} pending token(s)`
                    : 'Campaign duplicated successfully'
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to duplicate distribution' });
        }
    });

    // DELETE distribution (cascades to tokens)
    router.delete('/distributions/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM ramadan_distributions WHERE id=?', [req.params.id]);
            res.json({ message: 'Distribution deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to delete distribution' });
        }
    });

    // ── Tokens ───────────────────────────────────────────────────────────────

    // GET all tokens for a distribution (with rich beneficiary details)
    router.get('/distributions/:id/tokens', authenticateToken, async (req, res) => {
        try {
            const tokens = await db.all(`
                SELECT
                    t.*,
                    b.male_head_name        AS beneficiary_name,
                    b.female_head_name,
                    b.nic_number,
                    b.female_head_nic,
                    b.contact_number,
                    b.application_number,
                    b.home_town,
                    b.category,
                    b.male_head_address     AS address,
                    b.children_total_count,
                    b.monthly_income,
                    b.family_status,
                    u.full_name             AS collected_by_name
                FROM ramadan_tokens t
                JOIN beneficiaries b ON b.id = t.beneficiary_id
                LEFT JOIN users u ON u.id = t.collected_by
                WHERE t.distribution_id = ?
                ORDER BY t.token_number
            `, [req.params.id]);
            res.json(tokens);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch tokens' });
        }
    });

    // GET unassigned active beneficiaries for a distribution
    router.get('/distributions/:id/unassigned', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const rows = await db.all(`
                SELECT
                    b.id,
                    b.application_number,
                    b.male_head_name,
                    b.female_head_name,
                    b.nic_number,
                    b.contact_number,
                    b.home_town,
                    b.category,
                    b.children_total_count,
                    b.monthly_income,
                    b.family_status
                FROM beneficiaries b
                WHERE b.status = 'Active'
                  AND b.id NOT IN (
                      SELECT beneficiary_id FROM ramadan_tokens WHERE distribution_id = ?
                  )
                ORDER BY b.male_head_name ASC, b.id ASC
            `, [distId]);
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch unassigned beneficiaries' });
        }
    });

    // POST bulk-assign active beneficiaries to a distribution (all or filtered/selected)
    router.post('/distributions/:id/assign-all', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const dist = await db.get('SELECT * FROM ramadan_distributions WHERE id=?', [distId]);
            if (!dist) return res.status(404).json({ message: 'Distribution not found' });

            const { category, home_town, beneficiary_ids } = req.body || {};

            let sql = `
                SELECT b.id FROM beneficiaries b
                WHERE b.status = 'Active'
                AND b.id NOT IN (
                    SELECT beneficiary_id FROM ramadan_tokens WHERE distribution_id = ?
                )
            `;
            const params = [distId];

            if (Array.isArray(beneficiary_ids) && beneficiary_ids.length > 0) {
                const ph = beneficiary_ids.map(() => '?').join(',');
                sql += ` AND b.id IN (${ph})`;
                params.push(...beneficiary_ids);
            } else {
                if (category && category !== 'all') {
                    sql += ` AND LOWER(TRIM(b.category)) = LOWER(TRIM(?))`;
                    params.push(category);
                }
                if (home_town && home_town !== 'all') {
                    sql += ` AND LOWER(TRIM(b.home_town)) = LOWER(TRIM(?))`;
                    params.push(home_town);
                }
            }
            sql += ` ORDER BY b.id`;

            const beneficiaries = await db.all(sql, params);

            if (beneficiaries.length === 0) {
                return res.json({ added: 0, message: 'All matching active beneficiaries are already assigned' });
            }

            let seq = await getNextTokenSeq(distId);

            for (const ben of beneficiaries) {
                const tokenNumber = `RMD-${dist.year}-${String(seq).padStart(4, '0')}`;
                await db.run(
                    `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number)
                     VALUES (?, ?, ?)`,
                    [distId, ben.id, tokenNumber]
                );
                seq++;
            }

            res.json({ added: beneficiaries.length, message: `${beneficiaries.length} beneficiary token(s) assigned` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to assign beneficiaries' });
        }
    });

    // GET verify beneficiary by Token #, NIC, beneficiary ID, application number, phone, or head name
    router.get('/distributions/:id/verify/:query', authenticateToken, async (req, res) => {
        try {
            const { id: distId, query } = req.params;
            const q = query.trim();
            const paddedSeq = /^\d{1,4}$/.test(q) ? q.padStart(4, '0') : null;

            const token = await db.get(`
                SELECT
                    t.*,
                    b.male_head_name        AS beneficiary_name,
                    b.female_head_name,
                    b.nic_number,
                    b.female_head_nic,
                    b.contact_number,
                    b.application_number,
                    b.home_town,
                    b.category,
                    b.male_head_address     AS address,
                    b.children_total_count,
                    u.full_name             AS collected_by_name
                FROM ramadan_tokens t
                JOIN beneficiaries b ON b.id = t.beneficiary_id
                LEFT JOIN users u ON u.id = t.collected_by
                WHERE t.distribution_id = ?
                  AND (
                      LOWER(t.token_number)      = LOWER(?)
                   OR (? IS NOT NULL AND t.token_number LIKE ?)
                   OR LOWER(b.nic_number)        = LOWER(?)
                   OR LOWER(b.female_head_nic)   = LOWER(?)
                   OR CAST(b.id AS TEXT)         = ?
                   OR LOWER(b.application_number)= LOWER(?)
                   OR b.contact_number           = ?
                   OR LOWER(b.male_head_name) LIKE LOWER(?)
                  )
                LIMIT 1
            `, [distId, q, paddedSeq, paddedSeq ? `%-${paddedSeq}` : '', q, q, q, q, q, `%${q}%`]);

            if (!token) {
                // Check if beneficiary exists at all
                const ben = await db.get(
                    `SELECT id, male_head_name, female_head_name, nic_number, contact_number, application_number, home_town, category, status
                     FROM beneficiaries
                     WHERE LOWER(nic_number) = LOWER(?) OR LOWER(female_head_nic) = LOWER(?)
                        OR CAST(id AS TEXT) = ? OR LOWER(application_number) = LOWER(?)
                        OR contact_number = ?
                        OR LOWER(male_head_name) LIKE LOWER(?)`,
                    [q, q, q, q, q, `%${q}%`]
                );
                if (!ben) return res.status(404).json({ message: 'No token or beneficiary found matching that search' });
                if (ben.status !== 'Active') {
                    return res.status(403).json({
                        message: `Beneficiary status is "${ben.status}" — tokens can only be issued to Active/Approved beneficiaries`,
                        beneficiary: ben,
                        ineligible: true
                    });
                }
                return res.status(404).json({ message: 'Beneficiary is Active/Approved but not yet assigned a token in this distribution', beneficiary: ben });
            }

            res.json(token);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Verification failed' });
        }
    });

    // POST add a single beneficiary to a distribution (and optionally mark collected)
    router.post('/distributions/:id/assign-one', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const { beneficiary_id, collect, notes, collector_name } = req.body;
            if (!beneficiary_id) return res.status(400).json({ message: 'beneficiary_id is required' });

            const dist = await db.get('SELECT * FROM ramadan_distributions WHERE id=?', [distId]);
            if (!dist) return res.status(404).json({ message: 'Distribution not found' });

            // Only Active/Approved beneficiaries are eligible
            const ben = await db.get('SELECT id, status FROM beneficiaries WHERE id=?', [beneficiary_id]);
            if (!ben) return res.status(404).json({ message: 'Beneficiary not found' });
            if (ben.status !== 'Active') {
                return res.status(403).json({ message: `Tokens can only be issued to Active/Approved beneficiaries. This beneficiary's status is "${ben.status}"` });
            }

            // Check not already assigned
            const existing = await db.get(
                'SELECT * FROM ramadan_tokens WHERE distribution_id=? AND beneficiary_id=?',
                [distId, beneficiary_id]
            );
            if (existing) return res.status(400).json({ message: 'Beneficiary already assigned', token: existing });

            const seq = await getNextTokenSeq(distId);
            const tokenNumber = `RMD-${dist.year}-${String(seq).padStart(4, '0')}`;

            const status      = collect ? 'collected' : 'pending';
            const collectedAt = collect ? new Date().toISOString() : null;
            const collectedBy = collect ? req.user.id : null;

            const result = await db.run(
                `INSERT INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, status, collected_at, collected_by, notes, collector_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [distId, beneficiary_id, tokenNumber, status, collectedAt, collectedBy, notes || null, collector_name || null]
            );

            res.json({
                id: result.lastID,
                token_number: tokenNumber,
                status,
                message: collect ? `Assigned ${tokenNumber} and marked as collected` : `Assigned token ${tokenNumber}`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to assign beneficiary' });
        }
    });

    // PUT bulk status update for tokens
    router.put('/tokens/bulk-status', authenticateToken, async (req, res) => {
        try {
            const { token_ids, status, notes } = req.body;
            const allowed = ['pending', 'collected', 'absent'];
            if (!Array.isArray(token_ids) || token_ids.length === 0 || !allowed.includes(status)) {
                return res.status(400).json({ message: 'Valid token_ids and status are required' });
            }
            const placeholders = token_ids.map(() => '?').join(',');
            const collected_by = status === 'collected' ? req.user.id : null;
            const collected_at = status === 'collected' ? new Date().toISOString() : null;

            if (notes !== undefined) {
                await db.run(
                    `UPDATE ramadan_tokens SET status=?, collected_by=?, collected_at=?, notes=? WHERE id IN (${placeholders})`,
                    [status, collected_by, collected_at, notes || null, ...token_ids]
                );
            } else {
                await db.run(
                    `UPDATE ramadan_tokens SET status=?, collected_by=?, collected_at=? WHERE id IN (${placeholders})`,
                    [status, collected_by, collected_at, ...token_ids]
                );
            }
            res.json({ message: `Updated ${token_ids.length} token(s) to ${status}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to bulk update tokens' });
        }
    });

    // POST bulk delete tokens
    router.post('/tokens/bulk-delete', authenticateToken, async (req, res) => {
        try {
            const { token_ids } = req.body;
            if (!Array.isArray(token_ids) || token_ids.length === 0) {
                return res.status(400).json({ message: 'Valid token_ids are required' });
            }
            const placeholders = token_ids.map(() => '?').join(',');
            await db.run(
                `DELETE FROM ramadan_tokens WHERE id IN (${placeholders})`,
                token_ids
            );
            res.json({ message: `Removed ${token_ids.length} token(s)` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to bulk remove tokens' });
        }
    });

    // PUT mark token as collected
    router.put('/tokens/:id/collect', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });
            if (token.status === 'collected') return res.status(400).json({ message: 'Token already marked as collected' });

            const { notes, collector_name, collector_nic } = req.body || {};
            const finalNotes = notes !== undefined ? (notes || null) : token.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : token.collector_name;
            const finalCollectorNic = collector_nic !== undefined ? (collector_nic || null) : token.collector_nic;

            await db.run(
                `UPDATE ramadan_tokens
                 SET status='collected', collected_at=CURRENT_TIMESTAMP, collected_by=?, notes=?, collector_name=?, collector_nic=?
                 WHERE id=?`,
                [req.user.id, finalNotes, finalCollector, finalCollectorNic, req.params.id]
            );
            res.json({ message: 'Token marked as collected' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token' });
        }
    });

    // PUT update token status (absent / pending / collected)
    router.put('/tokens/:id/status', authenticateToken, async (req, res) => {
        try {
            const { status, notes, collector_name } = req.body;
            const allowed = ['pending', 'collected', 'absent'];
            if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

            const existing = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Token not found' });

            const collected_by = status === 'collected' ? req.user.id : null;
            const collected_at = status === 'collected' ? new Date().toISOString() : null;
            const finalNotes = notes !== undefined ? (notes || null) : existing.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : existing.collector_name;

            await db.run(
                `UPDATE ramadan_tokens SET status=?, notes=?, collector_name=?, collected_by=?, collected_at=? WHERE id=?`,
                [status, finalNotes, finalCollector, collected_by, collected_at, req.params.id]
            );
            res.json({ message: 'Token status updated' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token status' });
        }
    });

    // PUT update token notes / collector remarks
    router.put('/tokens/:id/notes', authenticateToken, async (req, res) => {
        try {
            const { notes, collector_name, collector_nic } = req.body;
            await db.run(
                `UPDATE ramadan_tokens SET notes=?, collector_name=?, collector_nic=? WHERE id=?`,
                [notes || null, collector_name || null, collector_nic || null, req.params.id]
            );
            res.json({ message: 'Token remarks updated' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token remarks' });
        }
    });

    // DELETE a token (remove beneficiary from distribution)
    router.delete('/tokens/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM ramadan_tokens WHERE id=?', [req.params.id]);
            res.json({ message: 'Token removed' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to remove token' });
        }
    });

    return router;
};

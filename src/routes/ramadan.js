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
            "ALTER TABLE ramadan_distributions ADD COLUMN allocated_shops TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN collector_name TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN collector_nic TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN allocated_shop TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN redeemed_at DATETIME",
            "ALTER TABLE ramadan_tokens ADD COLUMN redeemed_by_shop TEXT",
            "ALTER TABLE ramadan_tokens ADD COLUMN shop_collected_at DATETIME",
            "ALTER TABLE ramadan_tokens ADD COLUMN shop_collected_by INTEGER",
            "ALTER TABLE ramadan_tokens ADD COLUMN issued_at DATETIME",
            "ALTER TABLE ramadan_tokens ADD COLUMN issued_by INTEGER"
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
                    SUM(CASE WHEN t.status = 'redeemed'  THEN 1 ELSE 0 END) AS redeemed_count,
                    SUM(CASE WHEN t.status = 'issued'    THEN 1 ELSE 0 END) AS issued_count,
                    SUM(CASE WHEN t.status = 'pending'   THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN t.status = 'absent'    THEN 1 ELSE 0 END) AS absent_count,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(t.allocated_shop), '')) AS token_shops
                FROM ramadan_distributions d
                LEFT JOIN ramadan_tokens t ON t.distribution_id = d.id
                GROUP BY d.id
                ORDER BY d.year DESC, d.created_at DESC
            `);
            res.json(distributions.map(d => ({
                ...d,
                total_tokens: d.total_tokens || 0,
                collected_count: d.collected_count || 0,
                redeemed_count: d.redeemed_count || 0,
                issued_count: d.issued_count || 0,
                pending_count: d.pending_count || 0,
                absent_count: d.absent_count || 0,
                token_shops: d.token_shops || '',
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
                allocated_shops,
                auto_assign_mode,
                auto_assign_category,
                auto_assign_town,
                auto_assign_shop
            } = req.body;

            if (!year || !title) {
                return res.status(400).json({ message: 'Year and title are required' });
            }

            const result = await db.run(
                `INSERT INTO ramadan_distributions (
                    year, title, collection_date, collection_location, voucher_value,
                    notes, status, package_type, hijri_year, collection_time,
                    coordinator_name, coordinator_phone, target_quota, package_items,
                    allocated_shops
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    allocated_shops || null
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
                const shopList = String(allocated_shops || '').split(',').map(s => s.trim()).filter(Boolean);
                let seq = 1;
                for (let idx = 0; idx < beneficiaries.length; idx++) {
                    const ben = beneficiaries[idx];
                    const tokenNumber = `RMD-${year}-${String(seq).padStart(4, '0')}`;
                    let chosenShop = auto_assign_shop || null;
                    if (auto_assign_shop === '__round_robin__' && shopList.length > 0) {
                        chosenShop = shopList[idx % shopList.length];
                    } else if (auto_assign_shop === '__round_robin__') {
                        chosenShop = null;
                    }
                    await db.run(
                        `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, allocated_shop)
                         VALUES (?, ?, ?, ?)`,
                        [distId, ben.id, tokenNumber, chosenShop]
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
                package_items,
                allocated_shops
            } = req.body;

            if (!year || !title) {
                return res.status(400).json({ message: 'Year and title are required' });
            }

            await db.run(
                `UPDATE ramadan_distributions
                 SET year=?, title=?, collection_date=?, collection_location=?, voucher_value=?,
                     notes=?, status=?, package_type=?, hijri_year=?, collection_time=?,
                     coordinator_name=?, coordinator_phone=?, target_quota=?, package_items=?,
                     allocated_shops=?
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
                    allocated_shops || null,
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
                    coordinator_name, coordinator_phone, target_quota, package_items,
                    allocated_shops
                 ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    orig.package_items || null,
                    orig.allocated_shops || null
                ]
            );

            const newDistId = result.lastID;
            let copiedTokens = 0;

            if (copyBeneficiaries) {
                const origTokens = await db.all(
                    'SELECT beneficiary_id, allocated_shop FROM ramadan_tokens WHERE distribution_id = ? ORDER BY id',
                    [orig.id]
                );
                let seq = 1;
                for (const t of origTokens) {
                    const tokenNumber = `RMD-${newYear}-${String(seq).padStart(4, '0')}`;
                    await db.run(
                        `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, status, allocated_shop)
                         VALUES (?, ?, ?, 'pending', ?)`,
                        [newDistId, t.beneficiary_id, tokenNumber, t.allocated_shop || null]
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

    // GET all tokens for a distribution (with rich beneficiary details & shop tracking)
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
                    u.full_name             AS collected_by_name,
                    u_shop.full_name        AS shop_collected_by_name,
                    u_iss.full_name         AS issued_by_name
                FROM ramadan_tokens t
                JOIN beneficiaries b ON b.id = t.beneficiary_id
                LEFT JOIN users u ON u.id = t.collected_by
                LEFT JOIN users u_shop ON u_shop.id = t.shop_collected_by
                LEFT JOIN users u_iss ON u_iss.id = t.issued_by
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

            const { category, home_town, beneficiary_ids, allocated_shop } = req.body || {};

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
            const shopList = String(dist.allocated_shops || '').split(',').map(s => s.trim()).filter(Boolean);

            for (let idx = 0; idx < beneficiaries.length; idx++) {
                const ben = beneficiaries[idx];
                const tokenNumber = `RMD-${dist.year}-${String(seq).padStart(4, '0')}`;
                let chosenShop = allocated_shop || null;
                if (allocated_shop === '__round_robin__' && shopList.length > 0) {
                    chosenShop = shopList[idx % shopList.length];
                } else if (allocated_shop === '__round_robin__') {
                    chosenShop = null;
                }
                await db.run(
                    `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, allocated_shop)
                     VALUES (?, ?, ?, ?)`,
                    [distId, ben.id, tokenNumber, chosenShop]
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
            const rawQ = String(query || '').trim();
            const cleanQ = rawQ.replace(/[\s\-_.]/g, '').toLowerCase();
            const paddedSeq = /^\d{1,4}$/.test(rawQ) ? rawQ.padStart(4, '0') : null;
            const nameWildcard = `%${rawQ}%`;

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
                    b.photo_url,
                    b.male_head_age,
                    b.male_head_gender,
                    b.male_head_occupation,
                    b.female_head_occupation,
                    b.family_status,
                    b.status                AS beneficiary_status,
                    u.full_name             AS collected_by_name,
                    u_shop.full_name        AS shop_collected_by_name,
                    u_iss.full_name         AS issued_by_name,
                    d.title                 AS dist_title,
                    d.year                  AS dist_year,
                    d.hijri_year            AS dist_hijri_year,
                    d.voucher_value,
                    d.package_type,
                    d.package_items,
                    d.collection_location,
                    d.collection_date,
                    d.collection_time,
                    d.allocated_shops
                FROM ramadan_tokens t
                JOIN beneficiaries b ON b.id = t.beneficiary_id
                JOIN ramadan_distributions d ON d.id = t.distribution_id
                LEFT JOIN users u ON u.id = t.collected_by
                LEFT JOIN users u_shop ON u_shop.id = t.shop_collected_by
                LEFT JOIN users u_iss ON u_iss.id = t.issued_by
                WHERE t.distribution_id = ?
                  AND (
                      LOWER(t.token_number)      = LOWER(?)
                   OR (? IS NOT NULL AND t.token_number LIKE ?)
                   OR LOWER(b.nic_number)        = LOWER(?)
                   OR LOWER(b.female_head_nic)   = LOWER(?)
                   OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(b.nic_number,'')), ' ', ''), '-', ''), '.', '') = ?
                   OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(b.female_head_nic,'')), ' ', ''), '-', ''), '.', '') = ?
                   OR CAST(b.id AS TEXT)         = ?
                   OR LOWER(b.application_number)= LOWER(?)
                   OR b.contact_number           = ?
                   OR REPLACE(REPLACE(COALESCE(b.contact_number,''), ' ', ''), '-', '') = ?
                   OR LOWER(b.male_head_name)    LIKE LOWER(?)
                   OR LOWER(COALESCE(b.female_head_name,'')) LIKE LOWER(?)
                  )
                LIMIT 1
            `, [
                distId,
                rawQ,
                paddedSeq, paddedSeq ? `%-${paddedSeq}` : '',
                rawQ, rawQ,
                cleanQ, cleanQ,
                rawQ, rawQ,
                rawQ, cleanQ,
                nameWildcard, nameWildcard
            ]);

            if (!token) {
                // Check if beneficiary exists at all in directory
                const ben = await db.get(
                    `SELECT id, male_head_name, female_head_name, nic_number, female_head_nic,
                            contact_number, application_number, home_town, category, status,
                            male_head_address AS address, children_total_count, photo_url,
                            male_head_age, male_head_gender, male_head_occupation, family_status
                     FROM beneficiaries
                     WHERE LOWER(nic_number) = LOWER(?) OR LOWER(female_head_nic) = LOWER(?)
                        OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(nic_number,'')), ' ', ''), '-', ''), '.', '') = ?
                        OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(female_head_nic,'')), ' ', ''), '-', ''), '.', '') = ?
                        OR CAST(id AS TEXT) = ? OR LOWER(application_number) = LOWER(?)
                        OR contact_number = ?
                        OR REPLACE(REPLACE(COALESCE(contact_number,''), ' ', ''), '-', '') = ?
                        OR LOWER(male_head_name) LIKE LOWER(?)
                        OR LOWER(COALESCE(female_head_name,'')) LIKE LOWER(?)
                     LIMIT 1`,
                    [rawQ, rawQ, cleanQ, cleanQ, rawQ, rawQ, rawQ, cleanQ, nameWildcard, nameWildcard]
                );

                if (!ben) {
                    return res.status(404).json({
                        message: `No token or beneficiary found matching ID Card / query "${rawQ}"`
                    });
                }

                if (ben.status !== 'Active') {
                    return res.status(403).json({
                        message: `Beneficiary status is "${ben.status}" — tokens can only be issued to Active/Approved beneficiaries`,
                        beneficiary: ben,
                        ineligible: true
                    });
                }

                return res.status(404).json({
                    message: `Beneficiary is Active & Approved (NIC: ${ben.nic_number || 'N/A'}), but not yet assigned a token in this distribution`,
                    beneficiary: ben,
                    unassigned: true
                });
            }

            res.json(token);
        } catch (err) {
            console.error('Verify error:', err);
            res.status(500).json({ message: 'Verification failed' });
        }
    });

    // POST add a single beneficiary to a distribution (optionally mark redeemed or collected)
    router.post('/distributions/:id/assign-one', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const { beneficiary_id, action, collect, notes, collector_name, collector_nic, allocated_shop } = req.body;
            if (!beneficiary_id) return res.status(400).json({ message: 'beneficiary_id is required' });

            const dist = await db.get('SELECT * FROM ramadan_distributions WHERE id=?', [distId]);
            if (!dist) return res.status(404).json({ message: 'Distribution not found' });

            // Only Active/Approved beneficiaries are eligible
            const ben = await db.get('SELECT id, status, male_head_name, nic_number FROM beneficiaries WHERE id=?', [beneficiary_id]);
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

            let status = 'pending';
            let issuedAt = null;
            let issuedBy = null;
            let collectedAt = null;
            let collectedBy = null;
            let redeemedAt = null;
            let redeemedByShop = null;
            let shopCollectedAt = null;
            let shopCollectedBy = null;
            const finalCollectorName = collector_name || ben.male_head_name || null;
            const finalCollectorNic = collector_nic || ben.nic_number || null;

            if (action === 'issue' || collect === 'issue' || collect === true) {
                // Stage 1: Beneficiary scanned ID card -> Handover physical token to beneficiary
                status = 'issued';
                issuedAt = new Date().toISOString();
                issuedBy = req.user.id;
            } else if (action === 'redeem') {
                status = 'redeemed';
                issuedAt = new Date().toISOString();
                issuedBy = req.user.id;
                redeemedAt = new Date().toISOString();
                redeemedByShop = allocated_shop || null;
            } else if (action === 'collect') {
                status = 'collected';
                issuedAt = new Date().toISOString();
                issuedBy = req.user.id;
                collectedAt = new Date().toISOString();
                collectedBy = req.user.id;
                redeemedAt = new Date().toISOString();
                redeemedByShop = allocated_shop || null;
                shopCollectedAt = new Date().toISOString();
                shopCollectedBy = req.user.id;
            }

            const result = await db.run(
                `INSERT INTO ramadan_tokens (
                    distribution_id, beneficiary_id, token_number, status,
                    issued_at, issued_by,
                    collected_at, collected_by, notes, collector_name, collector_nic,
                    allocated_shop, redeemed_at, redeemed_by_shop,
                    shop_collected_at, shop_collected_by
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    distId, beneficiary_id, tokenNumber, status,
                    issuedAt, issuedBy,
                    collectedAt, collectedBy, notes || null, finalCollectorName, finalCollectorNic,
                    allocated_shop || null, redeemedAt, redeemedByShop,
                    shopCollectedAt, shopCollectedBy
                ]
            );

            let msg = `Assigned token ${tokenNumber}`;
            if (status === 'issued') msg = `Issued physical token ${tokenNumber} to ${finalCollectorName || 'beneficiary'} (ID Verified)`;
            else if (status === 'redeemed') msg = `Assigned ${tokenNumber} & marked Redeemed at Shop`;
            else if (status === 'collected') msg = `Assigned ${tokenNumber} & marked Collected from Shop`;

            res.json({
                id: result.lastID,
                token_number: tokenNumber,
                status,
                message: msg
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to assign beneficiary' });
        }
    });

    // STAGE 1: PUT mark token as Issued (Physical Token Handed to Beneficiary after ID Scan)
    router.put('/tokens/:id/issue', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });

            const { allocated_shop, notes, collector_name, collector_nic } = req.body || {};
            const finalShop = allocated_shop !== undefined ? (allocated_shop ? allocated_shop.trim() : token.allocated_shop) : token.allocated_shop;
            const finalNotes = notes !== undefined ? (notes || null) : token.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : token.collector_name;
            const finalCollectorNic = collector_nic !== undefined ? (collector_nic || null) : token.collector_nic;

            await db.run(
                `UPDATE ramadan_tokens
                 SET status='issued',
                     issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                     issued_by=COALESCE(issued_by, ?),
                     allocated_shop=?,
                     redeemed_at=NULL,
                     redeemed_by_shop=NULL,
                     shop_collected_at=NULL,
                     shop_collected_by=NULL,
                     collected_at=NULL,
                     collected_by=NULL,
                     notes=?,
                     collector_name=?,
                     collector_nic=?
                 WHERE id=?`,
                [req.user.id, finalShop || null, finalNotes, finalCollector, finalCollectorNic, req.params.id]
            );
            res.json({
                message: `Physical token ${token.token_number} handed over to ${finalCollector || 'beneficiary'}${finalShop ? ' (Allocated Shop: ' + finalShop + ')' : ''}`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to issue physical token' });
        }
    });

    // STAGE 2: PUT mark token as Redeemed at Allocated Shop (or re-open from Collected back to Redeemed)
    router.put('/tokens/:id/redeem', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });

            const { shop_name, redeemed_by_shop, notes, collector_name, collector_nic } = req.body || {};
            const finalShop = (redeemed_by_shop || shop_name || token.allocated_shop || token.redeemed_by_shop || 'Allocated Shop').trim();
            const finalNotes = notes !== undefined ? (notes || null) : token.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : token.collector_name;
            const finalCollectorNic = collector_nic !== undefined ? (collector_nic || null) : token.collector_nic;

            await db.run(
                `UPDATE ramadan_tokens
                 SET status='redeemed',
                     issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                     issued_by=COALESCE(issued_by, ?),
                     redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                     redeemed_by_shop=?,
                     allocated_shop=COALESCE(NULLIF(TRIM(allocated_shop), ''), ?),
                     shop_collected_at=NULL,
                     shop_collected_by=NULL,
                     collected_at=NULL,
                     collected_by=NULL,
                     notes=?,
                     collector_name=?,
                     collector_nic=?
                 WHERE id=?`,
                [req.user.id, finalShop, finalShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
            );
            res.json({ message: `Token ${token.token_number} marked as Redeemed from Shop (${finalShop})` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to record shop redemption' });
        }
    });

    // PUT step token back to its previous lifecycle process stage (collected -> redeemed -> issued -> pending)
    router.put('/tokens/:id/prev-stage', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });

            const prevStatus = token.status;
            let nextStatus = 'pending';
            let stageLabel = 'Awaiting ID Scan (Pending)';

            if (prevStatus === 'collected') {
                nextStatus = 'redeemed';
                stageLabel = 'Redeemed from Shop';
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='redeemed',
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL
                     WHERE id=?`,
                    [req.params.id]
                );
            } else if (prevStatus === 'redeemed') {
                nextStatus = 'issued';
                stageLabel = 'Verified & Issued';
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='issued',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL
                     WHERE id=?`,
                    [req.user.id, req.params.id]
                );
            } else {
                // 'issued' or 'absent' or 'pending' -> reset to 'pending'
                nextStatus = 'pending';
                stageLabel = 'Awaiting ID Scan (Pending)';
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='pending',
                         issued_at=NULL,
                         issued_by=NULL,
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL
                     WHERE id=?`,
                    [req.params.id]
                );
            }

            res.json({
                id: token.id,
                token_number: token.token_number,
                previous_status: prevStatus,
                status: nextStatus,
                message: `Token ${token.token_number} reset to previous process: ${stageLabel}`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to reset token to previous stage' });
        }
    });

    // POST batch settle / audit tokens for a specific Partner Shop in a distribution
    router.post('/distributions/:id/shop-settle', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const { shop_name, action } = req.body || {};
            if (!shop_name) return res.status(400).json({ message: 'Partner shop name is required' });

            if (action === 'issue_pending') {
                const r = await db.run(
                    `UPDATE ramadan_tokens
                     SET status='issued',
                         issued_at=CURRENT_TIMESTAMP,
                         issued_by=?
                     WHERE distribution_id=?
                       AND status='pending'
                       AND (? = '__all__' OR LOWER(TRIM(COALESCE(allocated_shop, ''))) = LOWER(TRIM(?)))`,
                    [req.user.id, distId, shop_name, shop_name]
                );
                return res.json({
                    updated: r.changes || 0,
                    message: `Handed over ${r.changes || 0} physical token(s) to beneficiaries`
                });
            }

            if (action === 'redeem_pending' || action === 'redeem_issued') {
                const r = await db.run(
                    `UPDATE ramadan_tokens
                     SET status='redeemed',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=CURRENT_TIMESTAMP,
                         redeemed_by_shop=COALESCE(NULLIF(TRIM(allocated_shop), ''), ?)
                     WHERE distribution_id=?
                       AND status IN ('pending', 'issued')
                       AND (? = '__all__' OR LOWER(TRIM(COALESCE(allocated_shop, ''))) = LOWER(TRIM(?)))`,
                    [req.user.id, shop_name === '__all__' ? 'Allocated Shop' : shop_name, distId, shop_name, shop_name]
                );
                return res.json({
                    updated: r.changes || 0,
                    message: `Marked ${r.changes || 0} voucher(s) at ${shop_name === '__all__' ? 'all shops' : shop_name} as Redeemed`
                });
            }

            // Default action: 'collect_redeemed' — EDF audits & collects back all redeemed vouchers from this shop
            const r = await db.run(
                `UPDATE ramadan_tokens
                 SET status='collected',
                     issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                     issued_by=COALESCE(issued_by, ?),
                     shop_collected_at=CURRENT_TIMESTAMP,
                     shop_collected_by=?,
                     collected_at=COALESCE(collected_at, CURRENT_TIMESTAMP),
                     collected_by=COALESCE(collected_by, ?)
                 WHERE distribution_id=?
                   AND status='redeemed'
                   AND (
                       ? = '__all__'
                       OR (? = '__unassigned__' AND NULLIF(TRIM(COALESCE(allocated_shop, redeemed_by_shop, '')), '') IS NULL)
                       OR LOWER(TRIM(COALESCE(NULLIF(TRIM(allocated_shop), ''), NULLIF(TRIM(redeemed_by_shop), ''), ''))) = LOWER(TRIM(?))
                   )`,
                [req.user.id, req.user.id, req.user.id, distId, shop_name, shop_name, shop_name]
            );
            res.json({
                updated: r.changes || 0,
                message: `Audited & collected ${r.changes || 0} redeemed voucher(s) from ${shop_name === '__all__' ? 'all shops' : (shop_name === '__unassigned__' ? 'Unassigned Shop' : shop_name)}`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Shop batch settlement failed' });
        }
    });

    // PUT mark token as Collected back from shop by EDF staff
    router.put('/tokens/:id/collect-from-shop', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });
            if (token.status === 'collected') return res.status(400).json({ message: 'Token is already collected back from shop' });

            const { notes } = req.body || {};
            const finalNotes = notes !== undefined ? (notes || null) : token.notes;

            await db.run(
                `UPDATE ramadan_tokens
                 SET status='collected',
                     shop_collected_at=CURRENT_TIMESTAMP,
                     shop_collected_by=?,
                     collected_at=COALESCE(collected_at, CURRENT_TIMESTAMP),
                     collected_by=COALESCE(collected_by, ?),
                     notes=?
                 WHERE id=?`,
                [req.user.id, req.user.id, finalNotes, req.params.id]
            );
            res.json({ message: `Token ${token.token_number} collected back from shop by EDF staff` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to record shop collection' });
        }
    });

    // PUT allocate or change shop for a single token
    router.put('/tokens/:id/allocate-shop', authenticateToken, async (req, res) => {
        try {
            const { allocated_shop } = req.body;
            await db.run('UPDATE ramadan_tokens SET allocated_shop=? WHERE id=?', [allocated_shop || null, req.params.id]);
            res.json({ message: 'Allocated shop updated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update allocated shop' });
        }
    });

    // PUT bulk allocate shop for tokens
    router.put('/tokens/bulk-allocate-shop', authenticateToken, async (req, res) => {
        try {
            const { token_ids, allocated_shop } = req.body;
            if (!Array.isArray(token_ids) || token_ids.length === 0) {
                return res.status(400).json({ message: 'Valid token_ids are required' });
            }
            const placeholders = token_ids.map(() => '?').join(',');
            await db.run(
                `UPDATE ramadan_tokens SET allocated_shop=? WHERE id IN (${placeholders})`,
                [allocated_shop || null, ...token_ids]
            );
            res.json({ message: `Assigned shop to ${token_ids.length} token(s)` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Bulk allocate shop failed' });
        }
    });

    // PUT bulk status update for tokens (supports pending, issued, redeemed, collected, absent)
    router.put('/tokens/bulk-status', authenticateToken, async (req, res) => {
        try {
            const { token_ids, status, notes, shop_name, redeemed_by_shop } = req.body;
            const chosenShop = redeemed_by_shop || shop_name || null;
            const allowed = ['pending', 'issued', 'redeemed', 'collected', 'absent'];
            if (!Array.isArray(token_ids) || token_ids.length === 0 || !allowed.includes(status)) {
                return res.status(400).json({ message: 'Valid token_ids and status are required' });
            }
            const placeholders = token_ids.map(() => '?').join(',');

            if (status === 'issued') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='issued',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         allocated_shop=COALESCE(NULLIF(TRIM(allocated_shop), ''), ?),
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=COALESCE(?, notes)
                     WHERE id IN (${placeholders})`,
                    [req.user.id, chosenShop, notes || null, ...token_ids]
                );
            } else if (status === 'redeemed') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='redeemed',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                         redeemed_by_shop=COALESCE(?, allocated_shop, 'Allocated Shop'),
                         allocated_shop=COALESCE(NULLIF(TRIM(allocated_shop), ''), ?),
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=COALESCE(?, notes)
                     WHERE id IN (${placeholders})`,
                    [req.user.id, chosenShop, chosenShop, notes || null, ...token_ids]
                );
            } else if (status === 'collected') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='collected',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                         redeemed_by_shop=COALESCE(redeemed_by_shop, allocated_shop, 'Allocated Shop'),
                         shop_collected_at=COALESCE(shop_collected_at, CURRENT_TIMESTAMP),
                         shop_collected_by=?,
                         collected_at=COALESCE(collected_at, CURRENT_TIMESTAMP),
                         collected_by=?,
                         notes=COALESCE(?, notes)
                     WHERE id IN (${placeholders})`,
                    [req.user.id, req.user.id, req.user.id, notes || null, ...token_ids]
                );
            } else if (status === 'pending') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='pending',
                         issued_at=NULL,
                         issued_by=NULL,
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=COALESCE(?, notes)
                     WHERE id IN (${placeholders})`,
                    [notes || null, ...token_ids]
                );
            } else {
                // absent
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='absent',
                         notes=COALESCE(?, notes)
                     WHERE id IN (${placeholders})`,
                    [notes || null, ...token_ids]
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

    // PUT mark token as collected (legacy direct collect or full settle)
    router.put('/tokens/:id/collect', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });
            if (token.status === 'collected') return res.status(400).json({ message: 'Token already marked as collected' });

            const { notes, collector_name, collector_nic, shop_name } = req.body || {};
            const finalNotes = notes !== undefined ? (notes || null) : token.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : token.collector_name;
            const finalCollectorNic = collector_nic !== undefined ? (collector_nic || null) : token.collector_nic;
            const finalShop = shop_name || token.allocated_shop || 'Allocated Shop';

            await db.run(
                `UPDATE ramadan_tokens
                 SET status='collected',
                     collected_at=CURRENT_TIMESTAMP,
                     collected_by=?,
                     shop_collected_at=COALESCE(shop_collected_at, CURRENT_TIMESTAMP),
                     shop_collected_by=?,
                     redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                     redeemed_by_shop=COALESCE(redeemed_by_shop, ?),
                     notes=?,
                     collector_name=?,
                     collector_nic=?
                 WHERE id=?`,
                [req.user.id, req.user.id, finalShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
            );
            res.json({ message: 'Token marked as collected' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token' });
        }
    });

    // PUT update token status (pending / issued / redeemed / collected / absent)
    router.put('/tokens/:id/status', authenticateToken, async (req, res) => {
        try {
            const { status, notes, collector_name, collector_nic, allocated_shop, shop_name, redeemed_by_shop } = req.body;
            const allowed = ['pending', 'issued', 'redeemed', 'collected', 'absent'];
            if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

            const existing = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!existing) return res.status(404).json({ message: 'Token not found' });

            const finalNotes = notes !== undefined ? (notes || null) : existing.notes;
            const finalCollector = collector_name !== undefined ? (collector_name || null) : existing.collector_name;
            const finalCollectorNic = collector_nic !== undefined ? (collector_nic || null) : existing.collector_nic;
            const finalAllocatedShop = allocated_shop !== undefined ? (allocated_shop || null) : existing.allocated_shop;

            if (status === 'issued') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='issued',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         allocated_shop=?,
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=?,
                         collector_name=?,
                         collector_nic=?
                     WHERE id=?`,
                    [req.user.id, finalAllocatedShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
                );
            } else if (status === 'redeemed') {
                const finalShop = redeemed_by_shop || shop_name || finalAllocatedShop || 'Allocated Shop';
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='redeemed',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                         redeemed_by_shop=?,
                         allocated_shop=COALESCE(NULLIF(TRIM(?), ''), allocated_shop, ?),
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=?,
                         collector_name=?,
                         collector_nic=?
                     WHERE id=?`,
                    [req.user.id, finalShop, finalAllocatedShop, finalShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
                );
            } else if (status === 'collected') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='collected',
                         issued_at=COALESCE(issued_at, CURRENT_TIMESTAMP),
                         issued_by=COALESCE(issued_by, ?),
                         redeemed_at=COALESCE(redeemed_at, CURRENT_TIMESTAMP),
                         redeemed_by_shop=COALESCE(redeemed_by_shop, ?, 'Allocated Shop'),
                         allocated_shop=?,
                         shop_collected_at=COALESCE(shop_collected_at, CURRENT_TIMESTAMP),
                         shop_collected_by=?,
                         collected_at=COALESCE(collected_at, CURRENT_TIMESTAMP),
                         collected_by=?,
                         notes=?,
                         collector_name=?,
                         collector_nic=?
                     WHERE id=?`,
                    [req.user.id, finalAllocatedShop, finalAllocatedShop, req.user.id, req.user.id, finalNotes, finalCollector, finalCollectorNic, req.params.id]
                );
            } else if (status === 'pending') {
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='pending',
                         allocated_shop=?,
                         issued_at=NULL,
                         issued_by=NULL,
                         redeemed_at=NULL,
                         redeemed_by_shop=NULL,
                         shop_collected_at=NULL,
                         shop_collected_by=NULL,
                         collected_at=NULL,
                         collected_by=NULL,
                         notes=?,
                         collector_name=?,
                         collector_nic=?
                     WHERE id=?`,
                    [finalAllocatedShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
                );
            } else {
                // absent
                await db.run(
                    `UPDATE ramadan_tokens
                     SET status='absent',
                         allocated_shop=?,
                         notes=?,
                         collector_name=?,
                         collector_nic=?
                     WHERE id=?`,
                    [finalAllocatedShop, finalNotes, finalCollector, finalCollectorNic, req.params.id]
                );
            }

            res.json({ message: `Token status updated to ${status}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token status' });
        }
    });

    // PUT update token notes / remarks / collector / shop
    router.put('/tokens/:id/notes', authenticateToken, async (req, res) => {
        try {
            const { notes, collector_name, collector_nic, allocated_shop } = req.body;
            await db.run(
                `UPDATE ramadan_tokens
                 SET notes=?,
                     collector_name=?,
                     collector_nic=?,
                     allocated_shop=COALESCE(?, allocated_shop)
                 WHERE id=?`,
                [notes || null, collector_name || null, collector_nic || null, allocated_shop || null, req.params.id]
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

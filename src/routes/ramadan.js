const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // ── Distributions ────────────────────────────────────────────────────────

    // GET all distributions with token counts
    router.get('/distributions', authenticateToken, async (req, res) => {
        try {
            const distributions = await db.all(`
                SELECT
                    d.*,
                    COUNT(t.id)                                         AS total_tokens,
                    SUM(CASE WHEN t.status = 'collected' THEN 1 ELSE 0 END) AS collected_count,
                    SUM(CASE WHEN t.status = 'pending'   THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN t.status = 'absent'    THEN 1 ELSE 0 END) AS absent_count
                FROM ramadan_distributions d
                LEFT JOIN ramadan_tokens t ON t.distribution_id = d.id
                GROUP BY d.id
                ORDER BY d.year DESC, d.created_at DESC
            `);
            res.json(distributions);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch distributions' });
        }
    });

    // POST create distribution
    router.post('/distributions', authenticateToken, async (req, res) => {
        try {
            const { year, title, collection_date, collection_location, voucher_value, notes } = req.body;
            if (!year || !title) return res.status(400).json({ message: 'Year and title are required' });

            const result = await db.run(
                `INSERT INTO ramadan_distributions (year, title, collection_date, collection_location, voucher_value, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [year, title, collection_date || null, collection_location || null, voucher_value || 0, notes || null]
            );
            res.json({ id: result.lastID, message: 'Distribution created successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to create distribution' });
        }
    });

    // PUT update distribution
    router.put('/distributions/:id', authenticateToken, async (req, res) => {
        try {
            const { year, title, collection_date, collection_location, voucher_value, notes, status } = req.body;
            await db.run(
                `UPDATE ramadan_distributions
                 SET year=?, title=?, collection_date=?, collection_location=?, voucher_value=?, notes=?, status=?
                 WHERE id=?`,
                [year, title, collection_date || null, collection_location || null, voucher_value || 0, notes || null, status || 'active', req.params.id]
            );
            res.json({ message: 'Distribution updated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update distribution' });
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

    // GET all tokens for a distribution (with beneficiary details)
    router.get('/distributions/:id/tokens', authenticateToken, async (req, res) => {
        try {
            const tokens = await db.all(`
                SELECT
                    t.*,
                    b.male_head_name   AS beneficiary_name,
                    b.nic_number,
                    b.contact_number,
                    b.application_number,
                    u.full_name        AS collected_by_name
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

    // POST bulk-assign all active beneficiaries to a distribution
    router.post('/distributions/:id/assign-all', authenticateToken, async (req, res) => {
        try {
            const distId = req.params.id;
            const dist = await db.get('SELECT * FROM ramadan_distributions WHERE id=?', [distId]);
            if (!dist) return res.status(404).json({ message: 'Distribution not found' });

            // Get Active (approved) beneficiaries not yet assigned to this distribution
            const beneficiaries = await db.all(`
                SELECT b.id FROM beneficiaries b
                WHERE b.status = 'Active'
                AND b.id NOT IN (
                    SELECT beneficiary_id FROM ramadan_tokens WHERE distribution_id = ?
                )
                ORDER BY b.id
            `, [distId]);

            if (beneficiaries.length === 0) {
                return res.json({ added: 0, message: 'All active/approved beneficiaries are already assigned' });
            }

            // Get current max sequence for this distribution
            const maxRow = await db.get(
                'SELECT COUNT(*) AS cnt FROM ramadan_tokens WHERE distribution_id=?', [distId]
            );
            let seq = (maxRow?.cnt || 0) + 1;

            for (const ben of beneficiaries) {
                const tokenNumber = `RMD-${dist.year}-${String(seq).padStart(4, '0')}`;
                await db.run(
                    `INSERT OR IGNORE INTO ramadan_tokens (distribution_id, beneficiary_id, token_number)
                     VALUES (?, ?, ?)`,
                    [distId, ben.id, tokenNumber]
                );
                seq++;
            }

            res.json({ added: beneficiaries.length, message: `${beneficiaries.length} beneficiaries assigned` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to assign beneficiaries' });
        }
    });

    // GET verify beneficiary by NIC / beneficiary ID / application number / head name
    router.get('/distributions/:id/verify/:query', authenticateToken, async (req, res) => {
        try {
            const { id: distId, query } = req.params;
            const q = query.trim();
            const token = await db.get(`
                SELECT
                    t.*,
                    b.male_head_name   AS beneficiary_name,
                    b.nic_number,
                    b.contact_number,
                    b.application_number,
                    b.category,
                    u.full_name        AS collected_by_name
                FROM ramadan_tokens t
                JOIN beneficiaries b ON b.id = t.beneficiary_id
                LEFT JOIN users u ON u.id = t.collected_by
                WHERE t.distribution_id = ?
                  AND (
                      b.nic_number        = ?
                   OR b.female_head_nic   = ?
                   OR CAST(b.id AS TEXT)  = ?
                   OR b.application_number = ?
                   OR LOWER(b.male_head_name) LIKE LOWER(?)
                  )
                LIMIT 1
            `, [distId, q, q, q, q, `%${q}%`]);

            if (!token) {
                // Check if beneficiary exists at all
                const ben = await db.get(
                    `SELECT id, male_head_name, status FROM beneficiaries
                     WHERE nic_number = ? OR female_head_nic = ?
                        OR CAST(id AS TEXT) = ? OR application_number = ?
                        OR LOWER(male_head_name) LIKE LOWER(?)`,
                    [q, q, q, q, `%${q}%`]
                );
                if (!ben) return res.status(404).json({ message: 'No beneficiary found matching that search' });
                if (ben.status !== 'Active') {
                    return res.status(403).json({
                        message: `Beneficiary status is "${ben.status}" — tokens can only be issued to Active/Approved beneficiaries`,
                        beneficiary: ben,
                        ineligible: true
                    });
                }
                return res.status(404).json({ message: 'Beneficiary is not yet assigned a token in this distribution', beneficiary: ben });
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
            const { beneficiary_id, collect } = req.body;
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

            const maxRow = await db.get('SELECT COUNT(*) AS cnt FROM ramadan_tokens WHERE distribution_id=?', [distId]);
            const seq = (maxRow?.cnt || 0) + 1;
            const tokenNumber = `RMD-${dist.year}-${String(seq).padStart(4, '0')}`;

            const status      = collect ? 'collected' : 'pending';
            const collectedAt = collect ? new Date().toISOString() : null;
            const collectedBy = collect ? req.user.id : null;

            const result = await db.run(
                `INSERT INTO ramadan_tokens (distribution_id, beneficiary_id, token_number, status, collected_at, collected_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [distId, beneficiary_id, tokenNumber, status, collectedAt, collectedBy]
            );

            res.json({ id: result.lastID, token_number: tokenNumber, status, message: collect ? 'Added and marked as collected' : 'Beneficiary added to distribution' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to assign beneficiary' });
        }
    });

    // PUT mark token as collected
    router.put('/tokens/:id/collect', authenticateToken, async (req, res) => {
        try {
            const token = await db.get('SELECT * FROM ramadan_tokens WHERE id=?', [req.params.id]);
            if (!token) return res.status(404).json({ message: 'Token not found' });
            if (token.status === 'collected') return res.status(400).json({ message: 'Token already marked as collected' });

            await db.run(
                `UPDATE ramadan_tokens SET status='collected', collected_at=CURRENT_TIMESTAMP, collected_by=? WHERE id=?`,
                [req.user.id, req.params.id]
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
            const { status, notes } = req.body;
            const allowed = ['pending', 'collected', 'absent'];
            if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

            const collected_by = status === 'collected' ? req.user.id : null;
            const collected_at = status === 'collected' ? new Date().toISOString() : null;

            await db.run(
                `UPDATE ramadan_tokens SET status=?, notes=?, collected_by=?, collected_at=? WHERE id=?`,
                [status, notes || null, collected_by, collected_at, req.params.id]
            );
            res.json({ message: 'Token status updated' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update token status' });
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

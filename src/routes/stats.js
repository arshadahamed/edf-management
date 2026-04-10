const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {
    // Get all transactions (for Transactions view)
    router.get('/transactions', authenticateToken, async (req, res) => {
        try {
            const transactions = await db.all('SELECT * FROM transactions ORDER BY date DESC');
            res.json(transactions);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Delete a specific transaction
    router.delete('/transactions/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM transactions WHERE id=?', [req.params.id]);
            res.json({ message: 'Transaction deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Get stats for dashboard
    router.get('/stats', authenticateToken, async (req, res) => {
        try {
            const [
                donationStats, expenseStats,
                familyCount,
                benTotal, benActive, benPending,
                memberCount, memberActive,
                volunteerCount,
                courseCount, courseActive,
                externalDonations,
                rdActive, rdTokensTotal, rdCollected, rdPending,
                recentTransactions
            ] = await Promise.all([
                db.get("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE category IN ('donation','subscription') AND type='income'"),
                db.get("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense'"),
                db.get("SELECT COUNT(*) AS count FROM families"),
                db.get("SELECT COUNT(*) AS count FROM beneficiaries"),
                db.get("SELECT COUNT(*) AS count FROM beneficiaries WHERE status='Active'"),
                db.get("SELECT COUNT(*) AS count FROM beneficiaries WHERE status='pending'"),
                db.get("SELECT COUNT(*) AS count FROM members"),
                db.get("SELECT COUNT(*) AS count FROM members WHERE status='active'"),
                db.get("SELECT COUNT(*) AS count FROM volunteers WHERE status='active'"),
                db.get("SELECT COUNT(*) AS count FROM courses"),
                db.get("SELECT COUNT(*) AS count FROM courses WHERE status='active'"),
                db.get("SELECT COALESCE(SUM(amount),0) AS total FROM external_donations"),
                db.get("SELECT COUNT(*) AS count FROM ramadan_distributions WHERE status='active'"),
                db.get("SELECT COUNT(*) AS count FROM ramadan_tokens"),
                db.get("SELECT COUNT(*) AS count FROM ramadan_tokens WHERE status='collected'"),
                db.get("SELECT COUNT(*) AS count FROM ramadan_tokens WHERE status='pending'"),
                db.all("SELECT * FROM transactions ORDER BY date DESC LIMIT 8")
            ]);

            res.json({
                totalDonations:      donationStats.total,
                totalExpenses:       expenseStats.total,
                netBalance:          donationStats.total - expenseStats.total,
                familyCount:         familyCount.count,
                beneficiaryCount:    benTotal.count,
                beneficiaryActive:   benActive.count,
                beneficiaryPending:  benPending.count,
                memberCount:         memberCount.count,
                memberActive:        memberActive.count,
                volunteerCount:      volunteerCount.count,
                courseCount:         courseCount.count,
                courseActive:        courseActive.count,
                externalDonations:   externalDonations.total,
                ramadanActive:       rdActive.count,
                ramadanTokensTotal:  rdTokensTotal.count,
                ramadanCollected:    rdCollected.count,
                ramadanPending:      rdPending.count,
                recentTransactions
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error fetching stats' });
        }
    });

    return router;
};

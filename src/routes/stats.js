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

    // Get stats for dashboard Overview Command Center
    router.get('/stats', authenticateToken, async (req, res) => {
        const safeGet = (sql, params = [], fallback = {}) =>
            db.get(sql, params).then(r => r || fallback).catch(() => fallback);
        const safeAll = (sql, params = []) =>
            db.all(sql, params).catch(() => []);

        try {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Build chronological last 6 months keys ('YYYY-MM')
            const monthBuckets = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                monthBuckets.push({
                    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    label: d.toLocaleString('en-US', { month: 'short' }),
                    income: 0,
                    expense: 0
                });
            }
            const sixMonthsStart = `${monthBuckets[0].month}-01`;

            const [
                donationStats, expenseStats,
                familyCount,
                benTotal, benActive, benPending,
                memberCount, memberActive, memberFounders, memberExecutives, memberExpectedSub,
                subMonthStats,
                volunteerCount,
                courseCount, courseActive,
                batchTotal, batchActive,
                appTotal, appPending, appApproved,
                externalDonations,
                rdActive, rdTokensTotal, rdCollected, rdPending, rdActiveCampaign,
                invSummary, invLowStock, invActiveLoans, invOverdueLoans,
                pendingBenList,
                monthlyTxRows, expenseByCat, incomeByCat,
                recentTransactions,
                recentActivity
            ] = await Promise.all([
                safeGet("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE category IN ('donation','subscription') AND type='income'", [], { total: 0 }),
                safeGet("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense'", [], { total: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM families", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM beneficiaries", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM beneficiaries WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM beneficiaries WHERE LOWER(status)='pending'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM members", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM members WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM members WHERE LOWER(status)='active' AND member_type='founder'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM members WHERE LOWER(status)='active' AND member_type='executive'", [], { count: 0 }),
                safeGet("SELECT COALESCE(SUM(COALESCE(monthly_subscription,0)),0) AS expected, COUNT(CASE WHEN COALESCE(monthly_subscription,0) > 0 THEN 1 END) AS expectedCount FROM members WHERE LOWER(status)='active'", [], { expected: 0, expectedCount: 0 }),
                safeGet("SELECT COALESCE(SUM(COALESCE(paid_amount, amount, 0)),0) AS collected, COUNT(DISTINCT member_id) AS paidCount FROM subscriptions WHERE month = ?", [currentMonth], { collected: 0, paidCount: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM volunteers WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM courses", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM courses WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM batches", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM batches WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM program_applications", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM program_applications WHERE LOWER(status)='pending'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM program_applications WHERE LOWER(status) IN ('approved','enrolled','accepted')", [], { count: 0 }),
                safeGet("SELECT COALESCE(SUM(amount),0) AS total FROM external_donations", [], { total: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM ramadan_distributions WHERE LOWER(status)='active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM ramadan_tokens", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM ramadan_tokens WHERE LOWER(status) IN ('collected','redeemed')", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM ramadan_tokens WHERE LOWER(status)='pending'", [], { count: 0 }),
                safeGet("SELECT id, year, title, hijri_year, collection_date, collection_location, voucher_value FROM ramadan_distributions WHERE LOWER(status)='active' ORDER BY year DESC, id DESC LIMIT 1", [], null),
                safeGet("SELECT COUNT(*) AS totalItems, COALESCE(SUM(COALESCE(quantity,1)),0) AS totalQuantity, COUNT(CASE WHEN library_type IS NOT NULL OR LOWER(COALESCE(category,'')) LIKE '%book%' THEN 1 END) AS bookCount FROM inventory_items", [], { totalItems: 0, totalQuantity: 0, bookCount: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM inventory_items WHERE COALESCE(quantity,0) <= COALESCE(min_threshold,0) AND COALESCE(min_threshold,0) > 0", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM inventory_loans WHERE return_date IS NULL", [], { count: 0 }),
                safeGet("SELECT COUNT(*) AS count FROM inventory_loans WHERE return_date IS NULL AND expected_return_date IS NOT NULL AND date(expected_return_date) < date('now')", [], { count: 0 }),
                safeAll("SELECT id, application_number, COALESCE(male_head_name, female_head_name, 'Applicant') AS name, home_town, created_at FROM beneficiaries WHERE LOWER(status)='pending' ORDER BY id DESC LIMIT 4"),
                safeAll("SELECT strftime('%Y-%m', date) AS ym, type, COALESCE(SUM(amount),0) AS total FROM transactions WHERE date(date) >= date(?) GROUP BY ym, type", [sixMonthsStart]),
                safeAll("SELECT COALESCE(NULLIF(TRIM(category),''), 'other') AS category, COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' GROUP BY category ORDER BY total DESC LIMIT 6"),
                safeAll("SELECT COALESCE(NULLIF(TRIM(category),''), 'other') AS category, COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='income' GROUP BY category ORDER BY total DESC LIMIT 6"),
                safeAll("SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT 15"),
                safeAll("SELECT l.id, l.action, l.entity, l.entity_id, l.details, l.created_at, COALESCE(u.full_name, u.username, 'System') AS actorName FROM system_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 8")
            ]);

            // Fill 6-month trend buckets
            const bucketMap = new Map(monthBuckets.map(b => [b.month, b]));
            for (const row of monthlyTxRows) {
                const target = bucketMap.get(row.ym);
                if (!target) continue;
                if (row.type === 'income') target.income = Number(row.total) || 0;
                else if (row.type === 'expense') target.expense = Number(row.total) || 0;
            }

            const expectedMonthly = Number(memberExpectedSub.expected) || 0;
            const collectedThisMonth = Number(subMonthStats.collected) || 0;
            const paidMembersCount = Number(subMonthStats.paidCount) || 0;
            const expectedMembersCount = Number(memberExpectedSub.expectedCount) || 0;
            const subCollectionPct = expectedMonthly > 0
                ? Math.min(100, Math.round((collectedThisMonth / expectedMonthly) * 100))
                : (paidMembersCount > 0 ? 100 : 0);

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
                memberFounders:      memberFounders.count,
                memberExecutives:    memberExecutives.count,
                volunteerCount:      volunteerCount.count,
                courseCount:         courseCount.count,
                courseActive:        courseActive.count,
                externalDonations:   externalDonations.total,
                ramadanActive:       rdActive.count,
                ramadanTokensTotal:  rdTokensTotal.count,
                ramadanCollected:    rdCollected.count,
                ramadanPending:      rdPending.count,
                recentTransactions,
                subscriptionPulse: {
                    currentMonth,
                    expectedMonthly,
                    collectedThisMonth,
                    paidMembersCount,
                    expectedMembersCount,
                    collectionPct: subCollectionPct
                },
                monthlyCashflow: monthBuckets,
                expenseBreakdown: expenseByCat,
                incomeBreakdown: incomeByCat,
                programsSummary: {
                    totalCourses: courseCount.count,
                    activeCourses: courseActive.count,
                    totalBatches: batchTotal.count,
                    activeBatches: batchActive.count,
                    totalApplications: appTotal.count,
                    pendingApplications: appPending.count,
                    approvedApplications: appApproved.count
                },
                inventorySummary: {
                    totalItems: invSummary.totalItems || 0,
                    totalQuantity: invSummary.totalQuantity || 0,
                    bookCount: invSummary.bookCount || 0,
                    lowStockCount: invLowStock.count || 0,
                    activeLoans: invActiveLoans.count || 0,
                    overdueLoans: invOverdueLoans.count || 0
                },
                ramadanSummary: rdActiveCampaign || null,
                actionQueue: {
                    pendingBeneficiaries: benPending.count || 0,
                    pendingProgramApps: appPending.count || 0,
                    pendingRamadanTokens: rdPending.count || 0,
                    lowStockInventory: invLowStock.count || 0,
                    overdueLoans: invOverdueLoans.count || 0,
                    unpaidSubMembersThisMonth: Math.max(0, expectedMembersCount - paidMembersCount),
                    pendingBeneficiarySamples: pendingBenList
                },
                recentActivity
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error fetching stats' });
        }
    });

    return router;
};

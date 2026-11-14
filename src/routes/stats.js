const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');

let _statsCache = null;
let _statsCacheExpiry = 0;
const STATS_CACHE_TTL = 12000; // 12 seconds

module.exports = (db) => {
    const router = express.Router();

    const safeGet = async (sql, params = [], fallback = {}) => {
        try {
            return (await db.get(sql, params)) || fallback;
        } catch {
            return fallback;
        }
    };

    const safeAll = async (sql, params = [], fallback = []) => {
        try {
            return (await db.all(sql, params)) || fallback;
        } catch {
            return fallback;
        }
    };

    // GET /api/stats/public - Public impact numbers (no auth required)
    let _publicCache = null;
    let _publicExpiry = 0;
    router.get('/public', async (_req, res) => {
        try {
            const now = Date.now();
            if (_publicCache && now < _publicExpiry) {
                return res.json(_publicCache);
            }
            const [familyCount, memberCount, benActive] = await Promise.all([
                safeGet("SELECT COUNT(*) as count FROM families", [], { count: 0 }),
                safeGet("SELECT COUNT(*) as count FROM members WHERE status = 'active'", [], { count: 0 }),
                safeGet("SELECT COUNT(*) as count FROM beneficiaries WHERE status = 'active'", [], { count: 0 })
            ]);
            _publicCache = {
                familiesHelped: familyCount.count || 0,
                activeMembers: memberCount.count || 0,
                activeBeneficiaries: benActive.count || 0
            };
            _publicExpiry = now + 30000;
            res.json(_publicCache);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Error fetching public stats' });
        }
    });

    // GET /api/stats/stats - Comprehensive Dashboard Overview Intelligence
    router.get('/stats', authenticateToken, async (req, res) => {
        try {
            const nowMs = Date.now();
            if (!req.query.refresh && _statsCache && nowMs < _statsCacheExpiry) {
                return res.json(_statsCache);
            }

            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            // Build last 6 months YYYY-MM keys (oldest -> newest)
            const monthBuckets = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                monthBuckets.push({ month: ym, label, income: 0, expense: 0 });
            }
            const oldestMonth = monthBuckets[0].month;

            const [
                txSummary,
                familyCount,
                benSummary,
                memberSummary,
                volunteerCount,
                courseSummary,
                rdCampaignSummary,
                rdTokenSummary,
                subMonthStats,
                batchSummary,
                appSummary,
                invSummary,
                loanSummary,
                pendingBenList,
                monthlyTxRows,
                expenseByCat,
                incomeByCat,
                recentTransactions,
                recentActivity
            ] = await Promise.all([
                safeGet(`
                    SELECT
                        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS totalDonations,
                        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS totalExpenses,
                        COALESCE(SUM(CASE WHEN type = 'income' AND category = 'donation' THEN amount ELSE 0 END), 0) AS externalDonations
                    FROM transactions
                `, [], { totalDonations: 0, totalExpenses: 0, externalDonations: 0 }),
                safeGet("SELECT COUNT(*) as count FROM families", [], { count: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
                    FROM beneficiaries
                `, [], { total: 0, active: 0, pending: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
                        COALESCE(SUM(CASE WHEN category = 'Founder' AND status = 'active' THEN 1 ELSE 0 END), 0) AS founders,
                        COALESCE(SUM(CASE WHEN category = 'Executive' AND status = 'active' THEN 1 ELSE 0 END), 0) AS executives,
                        COALESCE(SUM(CASE WHEN status = 'active' AND COALESCE(monthly_sub, 0) > 0 THEN monthly_sub ELSE 0 END), 0) AS expected,
                        COALESCE(SUM(CASE WHEN status = 'active' AND COALESCE(monthly_sub, 0) > 0 THEN 1 ELSE 0 END), 0) AS expectedCount
                    FROM members
                `, [], { total: 0, active: 0, founders: 0, executives: 0, expected: 0, expectedCount: 0 }),
                safeGet("SELECT COUNT(*) as count FROM volunteers WHERE status = 'active'", [], { count: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
                    FROM courses
                `, [], { total: 0, active: 0 }),
                safeGet("SELECT id, year, name, pack_items, pack_value, status, (SELECT COUNT(*) FROM ramadan_campaigns WHERE status = 'active') AS activeCount FROM ramadan_campaigns WHERE status = 'active' ORDER BY id DESC LIMIT 1", [], null),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'collected' THEN 1 ELSE 0 END), 0) AS collected,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
                    FROM ramadan_tokens
                `, [], { total: 0, collected: 0, pending: 0 }),
                safeGet("SELECT COALESCE(SUM(amount), 0) as collected, COUNT(DISTINCT member_id) as paidCount FROM member_subscriptions WHERE month = ?", [currentMonth], { collected: 0, paidCount: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
                    FROM batches
                `, [], { total: 0, active: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
                        COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved
                    FROM program_applications
                `, [], { total: 0, pending: 0, approved: 0 }),
                safeGet(`
                    SELECT
                        COUNT(*) AS totalItems,
                        COALESCE(SUM(quantity), 0) AS totalQuantity,
                        COALESCE(SUM(CASE WHEN category = 'books' THEN 1 ELSE 0 END), 0) AS bookCount,
                        COALESCE(SUM(CASE WHEN quantity <= COALESCE(min_stock, 2) THEN 1 ELSE 0 END), 0) AS lowStockCount
                    FROM inventory_items
                    WHERE status != 'disposed'
                `, [], { totalItems: 0, totalQuantity: 0, bookCount: 0, lowStockCount: 0 }),
                safeGet(`
                    SELECT
                        COALESCE(SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END), 0) AS activeLoans,
                        COALESCE(SUM(CASE WHEN status = 'borrowed' AND due_date IS NOT NULL AND due_date != '' AND date(due_date) < date('now') THEN 1 ELSE 0 END), 0) AS overdueLoans
                    FROM inventory_loans
                `, [], { activeLoans: 0, overdueLoans: 0 }),
                safeAll("SELECT id, name, category, area, created_at FROM beneficiaries WHERE status = 'pending' ORDER BY id DESC LIMIT 5"),
                safeAll("SELECT substr(date, 1, 7) AS ym, type, COALESCE(SUM(amount), 0) AS total FROM transactions WHERE substr(date, 1, 7) >= ? GROUP BY ym, type", [oldestMonth]),
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

            const expectedMonthly = Number(memberSummary.expected) || 0;
            const collectedThisMonth = Number(subMonthStats.collected) || 0;
            const paidMembersCount = Number(subMonthStats.paidCount) || 0;
            const expectedMembersCount = Number(memberSummary.expectedCount) || 0;
            const subCollectionPct = expectedMonthly > 0
                ? Math.min(100, Math.round((collectedThisMonth / expectedMonthly) * 100))
                : (paidMembersCount > 0 ? 100 : 0);

            const payload = {
                totalDonations:      txSummary.totalDonations,
                totalExpenses:       txSummary.totalExpenses,
                netBalance:          txSummary.totalDonations - txSummary.totalExpenses,
                familyCount:         familyCount.count,
                beneficiaryCount:    benSummary.total,
                beneficiaryActive:   benSummary.active,
                beneficiaryPending:  benSummary.pending,
                memberCount:         memberSummary.total,
                memberActive:        memberSummary.active,
                memberFounders:      memberSummary.founders,
                memberExecutives:    memberSummary.executives,
                volunteerCount:      volunteerCount.count,
                courseCount:         courseSummary.total,
                courseActive:        courseSummary.active,
                externalDonations:   txSummary.externalDonations,
                ramadanActive:       rdCampaignSummary ? (rdCampaignSummary.activeCount || 1) : 0,
                ramadanTokensTotal:  rdTokenSummary.total,
                ramadanCollected:    rdTokenSummary.collected,
                ramadanPending:      rdTokenSummary.pending,
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
                    totalCourses: courseSummary.total,
                    activeCourses: courseSummary.active,
                    totalBatches: batchSummary.total,
                    activeBatches: batchSummary.active,
                    totalApplications: appSummary.total,
                    pendingApplications: appSummary.pending,
                    approvedApplications: appSummary.approved
                },
                inventorySummary: {
                    totalItems: invSummary.totalItems || 0,
                    totalQuantity: invSummary.totalQuantity || 0,
                    bookCount: invSummary.bookCount || 0,
                    lowStockCount: invSummary.lowStockCount || 0,
                    activeLoans: loanSummary.activeLoans || 0,
                    overdueLoans: loanSummary.overdueLoans || 0
                },
                ramadanSummary: rdCampaignSummary || null,
                actionQueue: {
                    pendingBeneficiaries: benSummary.pending || 0,
                    pendingProgramApps: appSummary.pending || 0,
                    pendingRamadanTokens: rdTokenSummary.pending || 0,
                    lowStockInventory: invSummary.lowStockCount || 0,
                    overdueLoans: loanSummary.overdueLoans || 0,
                    unpaidSubMembersThisMonth: Math.max(0, expectedMembersCount - paidMembersCount),
                    pendingBeneficiarySamples: pendingBenList
                },
                recentActivity
            };

            _statsCache = payload;
            _statsCacheExpiry = Date.now() + STATS_CACHE_TTL;
            res.json(payload);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error fetching stats' });
        }
    });

    return router;
};

const express = require('express');
const router  = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // ── Stats summary ────────────────────────────────────────────────────────
    router.get('/stats', authenticateToken, async (_req, res) => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const [total, todayCount, errorsToday, activeUsers] = await Promise.all([
                db.get("SELECT COUNT(*) as count FROM system_logs WHERE entity NOT IN ('STATS','LOGS')"),
                db.get("SELECT COUNT(*) as count FROM system_logs WHERE date(created_at) = ? AND entity NOT IN ('STATS','LOGS')", [today]),
                db.get("SELECT COUNT(*) as count FROM system_logs WHERE action LIKE 'ERROR%' AND date(created_at) = ? AND entity NOT IN ('STATS','LOGS')", [today]),
                db.get("SELECT COUNT(DISTINCT user_id) as count FROM system_logs WHERE date(created_at) = ? AND user_id IS NOT NULL AND entity NOT IN ('STATS','LOGS')", [today])
            ]);

            // Action breakdown (top 20)
            const byAction = await db.all(
                "SELECT action, COUNT(*) as count FROM system_logs WHERE entity NOT IN ('STATS','LOGS') GROUP BY action ORDER BY count DESC LIMIT 20"
            );

            // Entity breakdown
            const byEntity = await db.all(
                "SELECT entity, COUNT(*) as count FROM system_logs WHERE entity NOT IN ('STATS','LOGS') GROUP BY entity ORDER BY count DESC"
            );

            // Recent errors with user info
            const recentErrors = await db.all(`
                SELECT sl.*, u.username, u.full_name
                FROM system_logs sl
                LEFT JOIN users u ON sl.user_id = u.id
                WHERE sl.action LIKE 'ERROR%' AND sl.entity NOT IN ('STATS','LOGS')
                ORDER BY sl.created_at DESC LIMIT 5
            `);

            // Top active users today
            const topUsers = await db.all(`
                SELECT u.id, u.username, u.full_name, u.avatar_url, COUNT(*) as action_count
                FROM system_logs sl
                JOIN users u ON sl.user_id = u.id
                WHERE date(sl.created_at) = ? AND sl.entity NOT IN ('STATS','LOGS')
                GROUP BY sl.user_id
                ORDER BY action_count DESC
                LIMIT 5
            `, [today]);

            res.json({
                total:       total.count,
                todayCount:  todayCount.count,
                errorsToday: errorsToday.count,
                activeUsers: activeUsers.count,
                byAction,
                byEntity,
                recentErrors,
                topUsers,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // ── All distinct users who have logs (for user filter dropdown) ──────────
    router.get('/users', authenticateToken, async (_req, res) => {
        try {
            const users = await db.all(`
                SELECT DISTINCT u.id, u.username, u.full_name
                FROM system_logs sl
                JOIN users u ON sl.user_id = u.id
                ORDER BY u.full_name ASC
            `);
            res.json(users);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // ── Paginated log list with filters ─────────────────────────────────────
    router.get('/system-logs', authenticateToken, async (req, res) => {
        try {
            const {
                action, entity, type, search,
                user_id,
                limit = 100, offset = 0,
                from, to
            } = req.query;

            const where  = ["1=1", "sl.entity NOT IN ('STATS','LOGS')"];
            const params = [];

            if (action && action !== 'all') {
                where.push('sl.action = ?');
                params.push(action.toUpperCase());
            }
            if (entity && entity !== 'all') {
                where.push('sl.entity = ?');
                params.push(entity.toUpperCase());
            }
            if (user_id && user_id !== 'all') {
                where.push('sl.user_id = ?');
                params.push(parseInt(user_id));
            }
            if (type === 'error') {
                where.push("sl.action LIKE 'ERROR%'");
            } else if (type === 'create') {
                where.push("sl.action = 'POST'");
            } else if (type === 'update') {
                where.push("sl.action IN ('PUT','PATCH')");
            } else if (type === 'delete') {
                where.push("sl.action = 'DELETE'");
            } else if (type === 'auth') {
                where.push("sl.action IN ('LOGIN','LOGOUT')");
            } else if (type === 'admin') {
                where.push("sl.action IN ('BLOCK_USER','UNBLOCK_USER','FORCE_LOGOUT')");
            } else if (type === 'ramadan') {
                where.push("sl.entity = 'RAMADAN'");
            }
            if (from) {
                where.push('date(sl.created_at) >= ?');
                params.push(from);
            }
            if (to) {
                where.push('date(sl.created_at) <= ?');
                params.push(to);
            }
            if (search) {
                where.push(`(
                    COALESCE(u.username,'')   LIKE ? OR
                    COALESCE(u.full_name,'')  LIKE ? OR
                    sl.entity                  LIKE ? OR
                    COALESCE(sl.entity_id,'') LIKE ? OR
                    sl.action                  LIKE ? OR
                    sl.details                 LIKE ?
                )`);
                const q = `%${search}%`;
                params.push(q, q, q, q, q, q);
            }

            const whereStr = where.join(' AND ');
            const lim = Math.min(parseInt(limit) || 100, 500);
            const off = parseInt(offset) || 0;

            const [logs, countResult] = await Promise.all([
                db.all(`
                    SELECT sl.*, u.username, u.full_name, u.avatar_url, u.role as user_role
                    FROM system_logs sl
                    LEFT JOIN users u ON sl.user_id = u.id
                    WHERE ${whereStr}
                    ORDER BY sl.created_at DESC
                    LIMIT ? OFFSET ?
                `, [...params, lim, off]),
                db.get(`
                    SELECT COUNT(*) as total
                    FROM system_logs sl
                    LEFT JOIN users u ON sl.user_id = u.id
                    WHERE ${whereStr}
                `, params)
            ]);

            res.json({ logs, total: countResult.total });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // ── Export logs as CSV ───────────────────────────────────────────────────
    router.get('/export', authenticateToken, async (req, res) => {
        try {
            const { entity, type, from, to, search, user_id } = req.query;

            const where  = ["1=1", "sl.entity NOT IN ('STATS','LOGS')"];
            const params = [];

            if (entity && entity !== 'all') {
                where.push('sl.entity = ?');
                params.push(entity.toUpperCase());
            }
            if (user_id && user_id !== 'all') {
                where.push('sl.user_id = ?');
                params.push(parseInt(user_id));
            }
            if (type === 'error') {
                where.push("sl.action LIKE 'ERROR%'");
            } else if (type === 'create') {
                where.push("sl.action = 'POST'");
            } else if (type === 'update') {
                where.push("sl.action IN ('PUT','PATCH')");
            } else if (type === 'delete') {
                where.push("sl.action = 'DELETE'");
            } else if (type === 'auth') {
                where.push("sl.action IN ('LOGIN','LOGOUT')");
            } else if (type === 'admin') {
                where.push("sl.action IN ('BLOCK_USER','UNBLOCK_USER','FORCE_LOGOUT')");
            }
            if (from) { where.push('date(sl.created_at) >= ?'); params.push(from); }
            if (to)   { where.push('date(sl.created_at) <= ?'); params.push(to);   }
            if (search) {
                where.push(`(COALESCE(u.username,'') LIKE ? OR COALESCE(u.full_name,'') LIKE ? OR sl.entity LIKE ? OR sl.action LIKE ? OR sl.details LIKE ?)`);
                const q = `%${search}%`;
                params.push(q, q, q, q, q);
            }

            const logs = await db.all(`
                SELECT sl.id, sl.created_at, u.username, u.full_name, sl.action, sl.entity,
                       sl.entity_id, sl.ip_address, sl.details
                FROM system_logs sl
                LEFT JOIN users u ON sl.user_id = u.id
                WHERE ${where.join(' AND ')}
                ORDER BY sl.created_at DESC
                LIMIT 5000
            `, params);

            // Build CSV
            const header = ['ID','Timestamp','Username','Full Name','Action','Entity','Entity ID','IP Address','Description'];
            const rows = logs.map(l => {
                let desc = '';
                try {
                    const d = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
                    desc = d.description || '';
                } catch (_) {}
                return [
                    l.id,
                    l.created_at,
                    l.username  || '',
                    l.full_name || '',
                    l.action,
                    l.entity,
                    l.entity_id || '',
                    (l.ip_address || '').replace(/^::ffff:/, ''),
                    desc,
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
            });

            const csv = [header.join(','), ...rows].join('\r\n');
            const filename = `edf-logs-${new Date().toISOString().split('T')[0]}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send('\uFEFF' + csv); // BOM for Excel compatibility
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // ── Clear all logs ───────────────────────────────────────────────────────
    router.delete('/system-logs', authenticateToken, async (_req, res) => {
        try {
            await db.run('DELETE FROM system_logs');
            res.json({ message: 'All system logs cleared successfully.' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};

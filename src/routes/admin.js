const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { authenticateToken } = require('../middleware/authMiddleware');

// All available module permissions
const ALL_PERMISSIONS = [
    'members', 'beneficiaries', 'finance', 'volunteers',
    'courses', 'ramadan', 'reports', 'settings', 'users'
];

// Default permissions granted per role
const ROLE_DEFAULTS = {
    admin:      ['members', 'beneficiaries', 'finance', 'volunteers', 'courses', 'ramadan', 'reports', 'settings', 'users'],
    super_user: ['members', 'beneficiaries', 'finance', 'volunteers', 'courses', 'ramadan', 'reports', 'settings', 'users'],
    manager:    ['members', 'beneficiaries', 'finance', 'volunteers', 'courses', 'ramadan', 'reports'],
    editor:     ['members', 'beneficiaries', 'volunteers', 'courses', 'ramadan'],
    viewer:     ['members', 'beneficiaries', 'finance', 'volunteers', 'courses', 'ramadan', 'reports'],
    user:       [],
};

// Middleware: only admin or super_user may call these routes
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
        return res.status(403).json({ message: 'Admin or Super User access required' });
    }
    next();
}

module.exports = (db) => {

    // ── GET all users ────────────────────────────────────────────────────────
    router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const users = await db.all(`
                SELECT
                    id, username, email, full_name, role, status,
                    avatar_url, last_login, last_seen, created_at, blocked_by,
                    CASE
                        WHEN last_seen >= datetime('now', '-90 seconds') THEN 1
                        ELSE 0
                    END AS is_online
                FROM users
                ORDER BY created_at ASC
            `);

            for (const u of users) {
                const perms = await db.all(
                    'SELECT permission FROM user_permissions WHERE user_id = ?', [u.id]
                );
                u.permissions = perms.map(p => p.permission);
            }

            res.json(users);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch users' });
        }
    });

    // ── GET online users only ────────────────────────────────────────────────
    router.get('/users/online', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const users = await db.all(`
                SELECT id, username, full_name, role, last_seen, avatar_url
                FROM users
                WHERE last_seen >= datetime('now', '-90 seconds')
                  AND status = 'active'
                ORDER BY last_seen DESC
            `);
            res.json(users);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch online users' });
        }
    });

    // ── GET available permissions + role defaults ────────────────────────────
    router.get('/permissions', authenticateToken, requireAdmin, (req, res) => {
        res.json({ permissions: ALL_PERMISSIONS, roleDefaults: ROLE_DEFAULTS });
    });

    // ── POST create user ─────────────────────────────────────────────────────
    router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { username, email, full_name, password, role, permissions } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ message: 'Username, email, and password are required' });
            }
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password must be at least 8 characters' });
            }

            const targetRole = role || 'user';

            // Only full admin can create admin/super_user accounts
            if ((targetRole === 'admin' || targetRole === 'super_user') && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can create admin or super user accounts' });
            }

            const existing = await db.get(
                'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
            );
            if (existing) {
                return res.status(409).json({ message: 'Username or email already exists' });
            }

            const hashed = await bcrypt.hash(password, 10);
            const result = await db.run(
                'INSERT INTO users (username, email, full_name, password, role) VALUES (?, ?, ?, ?, ?)',
                [username, email, full_name || null, hashed, targetRole]
            );
            const newId = result.lastID;

            const permsToSet = Array.isArray(permissions) ? permissions : (ROLE_DEFAULTS[targetRole] || []);
            for (const perm of permsToSet) {
                if (ALL_PERMISSIONS.includes(perm)) {
                    await db.run(
                        'INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)',
                        [newId, perm]
                    );
                }
            }

            res.json({ id: newId, message: 'User created successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to create user' });
        }
    });

    // ── PUT update user ──────────────────────────────────────────────────────
    router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);
            const { full_name, email, role, permissions, password } = req.body;

            const target = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            // super_user cannot modify admin accounts (only admin can)
            if (target.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can modify admin accounts' });
            }

            // Protect the last admin: cannot downgrade role
            if (target.role === 'admin' && role && role !== 'admin') {
                const adminCount = await db.get("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
                if (adminCount.c <= 1) {
                    return res.status(400).json({ message: 'Cannot change role: this is the last administrator account' });
                }
            }

            // Email uniqueness check
            if (email && email !== target.email) {
                const taken = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, targetId]);
                if (taken) return res.status(409).json({ message: 'Email address is already in use' });
            }

            await db.run(
                'UPDATE users SET full_name = ?, email = ?, role = ? WHERE id = ?',
                [
                    full_name  !== undefined ? full_name  : target.full_name,
                    email      !== undefined ? email      : target.email,
                    role       !== undefined ? role       : target.role,
                    targetId
                ]
            );

            if (password) {
                if (password.length < 8) {
                    return res.status(400).json({ message: 'Password must be at least 8 characters' });
                }
                const hashed = await bcrypt.hash(password, 10);
                await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, targetId]);
            }

            if (Array.isArray(permissions)) {
                await db.run('DELETE FROM user_permissions WHERE user_id = ?', [targetId]);
                for (const perm of permissions) {
                    if (ALL_PERMISSIONS.includes(perm)) {
                        await db.run(
                            'INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)',
                            [targetId, perm]
                        );
                    }
                }
            }

            res.json({ message: 'User updated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update user' });
        }
    });

    // ── DELETE user ──────────────────────────────────────────────────────────
    router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);

            if (targetId === req.user.id) {
                return res.status(400).json({ message: 'You cannot delete your own account' });
            }

            const target = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            if (target.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can delete admin accounts' });
            }

            if (target.role === 'admin') {
                const adminCount = await db.get("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
                if (adminCount.c <= 1) {
                    return res.status(400).json({ message: 'Cannot delete the last administrator account' });
                }
            }

            await db.run('DELETE FROM users WHERE id = ?', [targetId]);
            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to delete user' });
        }
    });

    // ── POST block user ──────────────────────────────────────────────────────
    router.post('/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);
            if (targetId === req.user.id) {
                return res.status(400).json({ message: 'You cannot block your own account' });
            }

            const target = await db.get('SELECT role, status FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            if (target.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can block admin accounts' });
            }

            await db.run(
                "UPDATE users SET status = 'blocked', blocked_by = ? WHERE id = ?",
                [req.user.id, targetId]
            );
            res.json({ message: 'User blocked successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to block user' });
        }
    });

    // ── POST unblock user ────────────────────────────────────────────────────
    router.post('/users/:id/unblock', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);
            const target = await db.get('SELECT id FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            await db.run(
                "UPDATE users SET status = 'active', blocked_by = NULL WHERE id = ?",
                [targetId]
            );
            res.json({ message: 'User unblocked successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to unblock user' });
        }
    });

    // ── POST change another user's password ─────────────────────────────────
    router.post('/users/:id/change-password', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);
            const { new_password } = req.body;

            if (!new_password || new_password.length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters' });
            }

            const target = await db.get('SELECT role FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            if (target.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can change admin passwords' });
            }

            const hashed = await bcrypt.hash(new_password, 10);
            await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, targetId]);

            // Force logout + clear last_seen so status flips to Offline immediately
            await db.run("UPDATE users SET force_logout_at = CURRENT_TIMESTAMP, last_seen = NULL WHERE id = ?", [targetId]);

            res.json({ message: 'Password changed successfully. User will be required to sign in again.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to change password' });
        }
    });

    // ── POST force logout ────────────────────────────────────────────────────
    router.post('/users/:id/force-logout', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const targetId = parseInt(req.params.id);
            if (targetId === req.user.id) {
                return res.status(400).json({ message: 'Use normal sign-out for your own session' });
            }

            const target = await db.get('SELECT role FROM users WHERE id = ?', [targetId]);
            if (!target) return res.status(404).json({ message: 'User not found' });

            if (target.role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Only administrators can force-logout admin accounts' });
            }

            // Clear last_seen so the admin panel reflects Offline immediately
            await db.run(
                "UPDATE users SET force_logout_at = CURRENT_TIMESTAMP, last_seen = NULL WHERE id = ?",
                [targetId]
            );
            // Log the force_logout event for admin notifications
            const evUser = await db.get('SELECT username, full_name, role FROM users WHERE id = ?', [targetId]);
            if (evUser) {
                db.run(
                    'INSERT INTO login_events (user_id, username, full_name, role, event_type, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                    [targetId, evUser.username, evUser.full_name || null, evUser.role, 'force_logout', req.ip || null]
                ).catch(() => {});
            }
            res.json({ message: 'User session terminated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to force logout' });
        }
    });

    // ── POST clear all operational data ─────────────────────────────────────
    router.post('/clear-data', authenticateToken, async (req, res) => {
        // Only full admins may wipe the database
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only administrators can clear system data' });
        }

        const { confirm_phrase, include_logs } = req.body;
        if (confirm_phrase !== 'CLEAR ALL DATA') {
            return res.status(400).json({ message: 'Invalid confirmation phrase' });
        }

        try {
            // Tables to wipe, ordered to satisfy foreign-key constraints
            const operationalTables = [
                'ramadan_tokens',
                'ramadan_distributions',
                'beneficiary_children_study',
                'beneficiary_children_dropout',
                'beneficiary_children_university',
                'beneficiary_children_abroad',
                'beneficiary_children_other',
                'beneficiaries',
                'subscriptions',
                'family_donations',
                'families',
                'member_relatives',
                'members',
                'batches',
                'courses',
                'transactions',
                'external_donations',
                'volunteers',
            ];

            if (include_logs) operationalTables.push('system_logs');

            const counts = {};
            await db.run('PRAGMA foreign_keys = OFF');
            for (const table of operationalTables) {
                const row = await db.get(`SELECT COUNT(*) AS c FROM ${table}`);
                counts[table] = row ? row.c : 0;
                await db.run(`DELETE FROM ${table}`);
                await db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
            }
            await db.run('PRAGMA foreign_keys = ON');

            const totalRows = Object.values(counts).reduce((s, c) => s + c, 0);
            res.json({
                message: `Data cleared successfully. ${totalRows.toLocaleString()} records removed.`,
                counts,
                total: totalRows,
            });
        } catch (err) {
            console.error(err);
            await db.run('PRAGMA foreign_keys = ON').catch(() => {});
            res.status(500).json({ message: 'Failed to clear data: ' + err.message });
        }
    });

    // ── GET login/logout events (for admin notification polling) ─────────────
    router.get('/login-events', authenticateToken, requireAdmin, async (req, res) => {
        try {
            // 'since' is an ISO timestamp from the client; strip 'Z' for SQLite UTC comparison
            const raw = req.query.since || '';
            const since = raw
                ? raw.replace('T', ' ').replace('Z', '').split('.')[0]
                : null;

            const events = since
                ? await db.all(
                    `SELECT * FROM login_events WHERE created_at > ? ORDER BY created_at ASC LIMIT 50`,
                    [since]
                )
                : await db.all(
                    `SELECT * FROM login_events WHERE created_at >= datetime('now','-1 minute') ORDER BY created_at ASC LIMIT 50`
                );

            res.json(events);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch login events' });
        }
    });

    // ── GET online users summary (for overview widget) ───────────────────────
    router.get('/users/online-summary', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const users = await db.all(`
                SELECT id, username, full_name, role, avatar_url, last_login, last_seen,
                    CASE
                        WHEN last_seen >= datetime('now', '-90 seconds') THEN 1
                        ELSE 0
                    END AS is_online
                FROM users
                WHERE status = 'active'
                ORDER BY is_online DESC, last_seen DESC
                LIMIT 20
            `);
            res.json(users);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch online summary' });
        }
    });

    return router;
};

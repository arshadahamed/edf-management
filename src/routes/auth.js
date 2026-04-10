const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = (db) => {
    // Login Route
    router.post('/login', async (req, res) => {
        const { username, password } = req.body;

        try {
            const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }

            if (user.status === 'blocked') {
                return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
            }

            // Record login time and log the event
            await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            db.run(
                'INSERT INTO login_events (user_id, username, full_name, role, event_type, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, user.username, user.full_name || null, user.role, 'login', req.ip || null]
            ).catch(() => {});

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600000, // 1 hour
                sameSite: 'strict'
            });

            res.json({
                message: 'Login successful',
                user: {
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    full_name: user.full_name,
                    avatar_url: user.avatar_url
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Logout Route
    router.post('/logout', async (req, res) => {
        const token = req.cookies?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await db.get(
                    'SELECT username, full_name, role FROM users WHERE id = ?', [decoded.id]
                );
                if (user) {
                    // Log the logout event
                    db.run(
                        'INSERT INTO login_events (user_id, username, full_name, role, event_type, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                        [decoded.id, user.username, user.full_name || null, user.role, 'logout', req.ip || null]
                    ).catch(() => {});
                    // Clear last_seen so the user immediately shows Offline in admin panel
                    db.run('UPDATE users SET last_seen = NULL WHERE id = ?', [decoded.id]).catch(() => {});
                }
            } catch {}
        }
        res.clearCookie('token');
        res.json({ message: 'Logged out successfully' });
    });

    // Verify Token / Get Current User
    router.get('/me', async (req, res) => {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Not logged in' });

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await db.get(
                'SELECT id, username, email, role, full_name, avatar_url, phone, bio, created_at FROM users WHERE id = ?',
                [decoded.id]
            );
            const perms = await db.all(
                'SELECT permission FROM user_permissions WHERE user_id = ?',
                [decoded.id]
            );
            user.permissions = perms.map(p => p.permission);
            res.json(user);
        } catch (err) {
            res.clearCookie('token');
            res.status(401).json({ message: 'Invalid session' });
        }
    });

    // Update Profile
    router.put('/profile', async (req, res) => {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Not logged in' });

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { full_name, email, phone, bio, avatar_url } = req.body;

            if (!full_name || !email) {
                return res.status(400).json({ message: 'Full name and email are required' });
            }

            // Check if email is taken by another user
            const existing = await db.get(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, decoded.id]
            );
            if (existing) {
                return res.status(409).json({ message: 'Email address is already in use' });
            }

            await db.run(
                'UPDATE users SET full_name = ?, email = ?, phone = ?, bio = ?, avatar_url = ? WHERE id = ?',
                [full_name, email, phone || null, bio || null, avatar_url || null, decoded.id]
            );

            res.json({ message: 'Profile updated successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Change Password
    router.put('/password', async (req, res) => {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: 'Not logged in' });

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { current_password, new_password } = req.body;

            if (!current_password || !new_password) {
                return res.status(400).json({ message: 'Both current and new password are required' });
            }
            if (new_password.length < 8) {
                return res.status(400).json({ message: 'New password must be at least 8 characters' });
            }

            const user = await db.get('SELECT password FROM users WHERE id = ?', [decoded.id]);
            const isMatch = await bcrypt.compare(current_password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            const hashed = await bcrypt.hash(new_password, 10);
            await db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, decoded.id]);

            res.json({ message: 'Password changed successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Heartbeat — keeps last_seen accurate while user is active in the browser.
    // userGuard (which wraps all /api routes) already updates last_seen on every
    // request, so this endpoint just needs to be reachable.
    router.post('/heartbeat', (req, res) => {
        if (!req.cookies?.token) return res.status(401).json({ ok: false });
        res.json({ ok: true });
    });

    return router;
};

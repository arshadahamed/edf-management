const jwt = require('jsonwebtoken');

/**
 * userGuard — runs on every /api request after cookie-parser.
 * 1. Skips unauthenticated requests (no token) — authenticateToken handles those.
 * 2. Checks if the account is blocked → 403.
 * 3. Checks if a force-logout was issued after the token was minted → 401.
 * 4. Updates last_seen timestamp so the admin panel can show online status.
 */
module.exports = (db) => async (req, res, next) => {
    const token = req.cookies?.token ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null);

    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db.get(
            'SELECT status, force_logout_at FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) return next();

        if (user.status === 'blocked') {
            res.clearCookie('token');
            return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
        }

        if (user.force_logout_at) {
            // SQLite CURRENT_TIMESTAMP is UTC but stored without 'Z'.
            // Appending 'Z' forces correct UTC parsing in all JS engines.
            const raw    = user.force_logout_at.endsWith('Z') ? user.force_logout_at : user.force_logout_at + 'Z';
            const forceMs      = new Date(raw).getTime();
            const tokenMintedMs = decoded.iat * 1000;
            if (tokenMintedMs < forceMs) {
                res.clearCookie('token');
                return res.status(401).json({ message: 'Your session was terminated by an administrator. Please sign in again.' });
            }
        }

        // Update last_seen for online-status tracking (fire-and-forget, don't await)
        db.run('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?', [decoded.id]).catch(() => {});

        next();
    } catch (_) {
        // Invalid/expired token — let authenticateToken produce the proper error
        next();
    }
};

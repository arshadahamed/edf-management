const jwt = require('jsonwebtoken');

module.exports = (db) => {
    let cache = { on: false, at: 0 };

    async function isMaintenanceOn() {
        if (Date.now() - cache.at < 5000) return cache.on;
        try {
            const row = await db.get("SELECT value FROM global_settings WHERE key = 'maintenance_mode'");
            cache = { on: row?.value === '1', at: Date.now() };
        } catch (_) {
            cache.at = Date.now(); // retry in 5s on error
        }
        return cache.on;
    }

    const STATIC_EXT = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|avif)$/i;

    return async (req, res, next) => {
        if (!(await isMaintenanceOn())) return next();

        const p = req.path;

        // Always allow the maintenance page and its assets
        if (p === '/maintenance' || p === '/maintenance.html') return next();

        // Allow the login page so admins can sign in
        if (p === '/login' || p === '/login.html') return next();

        // Allow static assets (CSS, JS, images) so maintenance page renders correctly
        if (STATIC_EXT.test(p)) return next();

        // Allow auth API and the public maintenance-status endpoint
        if (p.startsWith('/api/auth/') || p === '/api/settings/maintenance') return next();

        // Admins bypass maintenance mode
        const token =
            req.cookies?.token ||
            (req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : null);
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.role === 'admin' || decoded.role === 'super_user') return next();
            } catch (_) { /* invalid / expired */ }
        }

        // Block API calls with 503
        if (p.startsWith('/api/')) {
            return res.status(503).json({ message: 'System is under maintenance. Please check back soon.', maintenance: true });
        }

        // Redirect all other requests to the maintenance page
        return res.redirect('/maintenance');
    };
};

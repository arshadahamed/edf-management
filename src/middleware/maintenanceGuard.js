const path = require('path');

let _cachedVal = null;
let _cacheExpiry = 0;
const CACHE_TTL = 30000; // 30 seconds

const BYPASS_EXACT = new Set([
    '/login', '/login.html',
    '/dashboard', '/dashboard.html',
    '/maintenance.html',
    '/404.html'
]);

const BYPASS_PREFIX = ['/api/', '/css/', '/js/', '/uploads/', '/vendor/', '/images/'];
const STATIC_EXT = /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|map)$/i;

module.exports = function maintenanceGuard(db) {
    async function isMaintenanceOn() {
        const now = Date.now();
        if (_cachedVal !== null && now < _cacheExpiry) return _cachedVal;
        try {
            const row = await db.get("SELECT value FROM global_settings WHERE key = 'maintenance_mode'");
            _cachedVal = row ? row.value === 'true' : false;
        } catch {
            _cachedVal = false;
        }
        _cacheExpiry = now + CACHE_TTL;
        return _cachedVal;
    }

    return async function (req, res, next) {
        const p = req.path;

        // If maintenance mode is toggled via settings API, invalidate cache immediately
        if (req.method !== 'GET' && p.startsWith('/api/settings')) {
            _cachedVal = null;
            _cacheExpiry = 0;
        }

        // Fast bypass for all static files, API routes, login & dashboard before touching DB
        if (STATIC_EXT.test(p)) return next();
        if (BYPASS_EXACT.has(p)) return next();
        if (BYPASS_PREFIX.some(prefix => p.startsWith(prefix))) return next();

        if (!(await isMaintenanceOn())) return next();

        // Redirect all other visitors to the maintenance page
        return res.status(503).sendFile(
            path.join(__dirname, '../../public/maintenance.html')
        );
    };
};

const jwt = require('jsonwebtoken');

// Mutations that require permission checks
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Roles that bypass per-module permission checks
const ADMIN_ROLES = ['admin', 'super_user'];

// Map req.path (relative to /api mount) → required permission key
const PATH_PERMISSION_MAP = [
    { pattern: /^\/edf\/members/,            permission: 'members'       },
    { pattern: /^\/edf\/beneficiaries/,      permission: 'beneficiaries' },
    { pattern: /^\/edf\/families/,           permission: 'beneficiaries' },
    { pattern: /^\/edf\/relatives/,          permission: 'beneficiaries' },
    { pattern: /^\/edf\/beneficiary-categories/, permission: 'beneficiaries' },
    { pattern: /^\/edf\/donations/,          permission: 'finance'       },
    { pattern: /^\/edf\/external-donations/, permission: 'finance'       },
    { pattern: /^\/edf\/subscriptions/,      permission: 'finance'       },
    { pattern: /^\/edf\/volunteers/,         permission: 'volunteers'    },
    { pattern: /^\/programs/,               permission: 'courses'       },
    { pattern: /^\/forms/,                  permission: 'courses'       },
    { pattern: /^\/ramadan/,                permission: 'ramadan'       },
];

module.exports = (db) => {
    return async (req, res, next) => {
        // Only guard mutation requests
        if (!MUTATION_METHODS.includes(req.method)) return next();

        // Extract JWT
        const token = req.cookies?.token ||
            (req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.split(' ')[1]
                : null);

        if (!token) return next(); // no token → let authenticateToken handle 401

        let userId, userRole;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId   = decoded.id;
            userRole = decoded.role;
        } catch (_) {
            return next(); // invalid/expired → let authenticateToken handle it
        }

        // Admins and super_users always have full access
        if (ADMIN_ROLES.includes(userRole)) return next();

        // Check if this path requires a specific permission
        const match = PATH_PERMISSION_MAP.find(r => r.pattern.test(req.path));
        if (!match) return next(); // no permission mapping for this route

        // Check user_permissions table
        const perm = await db.get(
            'SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?',
            [userId, match.permission]
        );

        if (!perm) {
            return res.status(403).json({
                message: `Access denied. You need the "${match.permission}" permission to perform this action.`
            });
        }

        next();
    };
};

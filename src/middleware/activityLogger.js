const jwt = require('jsonwebtoken');

// Human-readable action labels
const METHOD_META = {
    POST:   { label: 'Created',  category: 'create' },
    PUT:    { label: 'Updated',  category: 'update' },
    PATCH:  { label: 'Updated',  category: 'update' },
    DELETE: { label: 'Deleted',  category: 'delete' },
    GET:    { label: 'Viewed',   category: 'read'   },
};

// Map route segments to readable entity names
const ENTITY_LABELS = {
    members:                 'MEMBERS',
    beneficiaries:           'BENEFICIARIES',
    families:                'FAMILIES',
    volunteers:              'VOLUNTEERS',
    donations:               'DONATIONS',
    'external-donations':    'DONATIONS',
    subscriptions:           'SUBSCRIPTIONS',
    relatives:               'RELATIVES',
    programs:                'PROGRAMS',
    batches:                 'BATCHES',
    applications:            'APPLICATIONS',
    'form-templates':        'FORMS',
    'bulk-import':           'BENEFICIARIES',
    forms:                   'FORMS',
    'beneficiary-categories':'CATEGORIES',
    distributions:           'RAMADAN',
    tokens:                  'RAMADAN',
    users:                   'USERS',
    auth:                    'AUTH',
    stats:                   'STATS',
};

// Special sub-path action labels (POST /api/admin/users/:id/block → BLOCK_USER)
const SPECIAL_ACTIONS = {
    'block':         'BLOCK_USER',
    'unblock':       'UNBLOCK_USER',
    'force-logout':  'FORCE_LOGOUT',
    'assign-all':    'ASSIGN_ALL_TOKENS',
    'assign-one':    'ASSIGN_TOKEN',
    'collect':       'COLLECT_TOKEN',
    'absent':        'MARK_ABSENT',
    'pending':       'MARK_PENDING',
    'verify':        'VERIFY_TOKEN',
    'bulk-import':   'BULK_IMPORT',
};

function resolveEntity(req) {
    const parts = req.path.replace(/^\/api\//, '').split('/').filter(Boolean);
    const prefix   = parts[0] || '';
    const resource = parts[1] || parts[0] || 'system';

    if (prefix === 'auth')   return 'AUTH';
    if (prefix === 'stats')  return 'STATS';
    if (prefix === 'logs')   return 'LOGS';
    if (prefix === 'ramadan') return 'RAMADAN';
    if (prefix === 'admin')  return ENTITY_LABELS[resource] || resource.toUpperCase();

    return ENTITY_LABELS[resource] || resource.toUpperCase();
}

function resolveEntityId(req) {
    if (req.params) {
        const val = req.params.id || req.params.memberId || req.params.beneficiaryId;
        if (val && /^\d+$/.test(val)) return String(val);
    }
    const parts = req.path.split('/').filter(Boolean);
    const numeric = parts.find(p => /^\d+$/.test(p));
    return numeric || null;
}

function resolveAction(req, method, statusCode) {
    if (req.path.includes('/auth/login'))  return 'LOGIN';
    if (req.path.includes('/auth/logout')) return 'LOGOUT';

    // Check for special sub-path actions (e.g. /block, /unblock, /force-logout)
    const pathParts = req.path.split('/').filter(Boolean);
    const lastPart  = pathParts[pathParts.length - 1];
    if (SPECIAL_ACTIONS[lastPart] && method === 'POST') return SPECIAL_ACTIONS[lastPart];

    // bulk-import on POST
    if (lastPart === 'bulk-import' && method === 'POST') return 'BULK_IMPORT';

    if (statusCode >= 400) return `ERROR (${method})`;
    return method;
}

function buildDescription(action, entity, entityId, req, statusCode, responseBody) {
    const entityLabel = entity.charAt(0) + entity.slice(1).toLowerCase();
    const idPart      = entityId ? ` #${entityId}` : '';

    // Auth
    if (action === 'LOGIN')  return `User signed in`;
    if (action === 'LOGOUT') return `User signed out`;

    // Admin special actions
    if (action === 'BLOCK_USER')     return `Blocked user account${idPart}`;
    if (action === 'UNBLOCK_USER')   return `Unblocked user account${idPart}`;
    if (action === 'FORCE_LOGOUT')   return `Force signed out user${idPart}`;
    if (action === 'BULK_IMPORT')    return `Bulk imported records into ${entityLabel}`;

    // Ramadan special actions
    if (action === 'ASSIGN_ALL_TOKENS') return `Assigned all tokens for distribution${idPart}`;
    if (action === 'ASSIGN_TOKEN')      return `Assigned token for distribution${idPart}`;
    if (action === 'COLLECT_TOKEN')     return `Marked token collected${idPart}`;
    if (action === 'MARK_ABSENT')       return `Marked token absent${idPart}`;
    if (action === 'MARK_PENDING')      return `Reset token to pending${idPart}`;
    if (action === 'VERIFY_TOKEN')      return `Verified beneficiary token${idPart}`;

    // Error
    if (action.startsWith('ERROR')) {
        const msg = responseBody?.message ? `: ${responseBody.message}` : '';
        return `Failed ${req.method} on ${entityLabel}${idPart}${msg}`;
    }

    // Standard CRUD
    const meta = METHOD_META[req.method] || { label: req.method };
    if (statusCode >= 400) return `Failed to ${req.method.toLowerCase()} ${entityLabel}${idPart}`;
    return `${meta.label} ${entityLabel}${idPart}`;
}

module.exports = (db) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        let responseBody = null;
        res.json = (body) => {
            responseBody = body;
            return originalJson(body);
        };

        res.on('finish', async () => {
            const method     = req.method;
            const statusCode = res.statusCode;

            // Always log: mutations, auth events, errors
            // Skip successful GETs to avoid noise
            const isAuth     = req.path.includes('/auth/login') || req.path.includes('/auth/logout');
            const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
            const isError    = statusCode >= 400;

            if (!isAuth && !isMutation && !isError) return;

            // ── Skip noisy / polling routes that would clutter logs ──────────────
            const SKIP_PATHS = [
                '/api/stats',
                '/api/auth/verify',
                '/api/auth/me',
                '/api/auth/heartbeat',
                '/api/logs/',
                '/api/logs/stats',
                '/api/logs/users',
                '/api/logs/system-logs',
                '/api/edf/subscriptions/monthly-status',
                '/api/edf/beneficiary-categories',
            ];
            const isSkipped = SKIP_PATHS.some(p => req.originalUrl.startsWith(p));
            if (isSkipped) return;

            // ── Resolve user identity ──────────────────────────────────────────
            let userId = null;
            const token = req.cookies?.token ||
                (req.headers.authorization?.startsWith('Bearer ')
                    ? req.headers.authorization.split(' ')[1]
                    : null);
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    userId = decoded.id;
                } catch (_) { /* expired / invalid */ }
            }

            // ── Resolve action, entity, ID ─────────────────────────────────────
            const action   = resolveAction(req, method, statusCode);
            const entity   = resolveEntity(req);
            const entityId = resolveEntityId(req);

            // ── Build details payload ──────────────────────────────────────────
            const detailsObj = {
                path:   req.path,
                status: statusCode,
                method,
            };

            if (action === 'LOGIN' && req.body?.username) {
                detailsObj.attempted_user = req.body.username;
            }

            if (isMutation && req.body && method !== 'GET') {
                const safeBody = { ...req.body };
                if (safeBody.password)         safeBody.password = '***';
                if (safeBody.current_password) safeBody.current_password = '***';
                if (safeBody.new_password)     safeBody.new_password = '***';
                if (Array.isArray(safeBody.relatives))  safeBody.relatives  = `[${safeBody.relatives.length} entries]`;
                if (Array.isArray(safeBody.study))      safeBody.study      = `[${safeBody.study.length} entries]`;
                if (Array.isArray(safeBody.dropout))    safeBody.dropout    = `[${safeBody.dropout.length} entries]`;
                if (Array.isArray(safeBody.university)) safeBody.university = `[${safeBody.university.length} entries]`;
                if (Array.isArray(safeBody.abroad))     safeBody.abroad     = `[${safeBody.abroad.length} entries]`;
                if (Array.isArray(safeBody.fields))     safeBody.fields     = `[${safeBody.fields.length} fields]`;
                // Don't log large bulk import arrays
                if (Array.isArray(req.body) && req.body.length > 0) {
                    detailsObj.bulk_count = req.body.length;
                } else {
                    detailsObj.body = safeBody;
                }
            }

            if (isError && responseBody?.message) {
                detailsObj.error = responseBody.message;
            }

            // Result summary for bulk operations
            if (action === 'BULK_IMPORT' && responseBody) {
                detailsObj.result = {
                    inserted: responseBody.inserted,
                    skipped:  responseBody.skipped,
                    errors:   responseBody.errors,
                };
            }

            detailsObj.description = buildDescription(action, entity, entityId, req, statusCode, responseBody);

            const ipAddress = req.ip || req.socket?.remoteAddress || null;

            try {
                await db.run(
                    `INSERT INTO system_logs
                        (user_id, action, entity, entity_id, details, ip_address)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, action, entity, entityId, JSON.stringify(detailsObj), ipAddress]
                );
            } catch (err) {
                console.error('Activity logger error:', err.message);
            }
        });

        next();
    };
};

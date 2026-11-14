const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/authMiddleware');

const PROVIDER_DEFAULTS = {
    textlk: 'https://app.text.lk/api/v3/sms/send',
    textlk_http: 'https://app.text.lk/api/http/sms/send',
    notify_lk: 'https://app.notify.lk/api/v1/send',
    custom_json: ''
};

/** Mask API secret for safe client display while preserving last 4 chars. */
function maskToken(token) {
    if (!token) return '';
    const str = String(token);
    if (str.length <= 6) return '••••••';
    return '••••' + str.slice(-4);
}

/** Normalize phone numbers (e.g. 0771234567 -> 94771234567) using gateway country code. */
function normalizePhoneNumber(raw, defaultCountryCode = '94') {
    if (!raw) return '';
    const cc = String(defaultCountryCode || '94').replace(/\D/g, '') || '94';
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length >= 9) {
        digits = cc + digits.slice(1);
    } else if (digits.length === 9 && digits.startsWith('7')) {
        digits = cc + digits;
    }
    return digits.length >= 9 ? digits : '';
}

/** Compute GSM-7 vs Unicode SMS segment count for accurate cost awareness. */
function calculateSmsSegments(message = '') {
    const text = String(message || '');
    if (!text.length) return 0;
    const isUnicode = /[^\u0000-\u007F]/.test(text);
    const singleLimit = isUnicode ? 70 : 160;
    const multiLimit = isUnicode ? 67 : 153;
    if (text.length <= singleLimit) return 1;
    return Math.ceil(text.length / multiLimit);
}

/** Convert HTML datetime-local or ISO into "YYYY-MM-DD HH:mm" expected by Text.lk. */
function formatScheduleTime(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
        return str.replace('T', ' ').slice(0, 16);
    }
    return str.slice(0, 16);
}

/** Replace beneficiary merge tags inside message/reminder templates. */
function renderMergeTags(templateBody, beneficiary = {}) {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const name = beneficiary.male_head_name || beneficiary.female_head_name || beneficiary.name || 'Beneficiary';
    const replacements = {
        '{name}': name,
        '{app_no}': beneficiary.application_number || '',
        '{town}': beneficiary.home_town || 'Galgamuwa',
        '{category}': beneficiary.category || 'Beneficiary',
        '{date}': today
    };
    let out = String(templateBody || '');
    for (const [tag, val] of Object.entries(replacements)) {
        out = out.split(tag).join(val);
    }
    return out;
}

/** Parse optional JSON headers safely without throwing on empty strings. */
function parseCustomHeaders(raw) {
    if (!raw || typeof raw !== 'string') return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

/** Build provider-specific HTTP request spec cleanly via table lookup. */
function buildGatewayRequest(gateway, { recipients, message, scheduleTime }) {
    const provider = gateway.provider || 'textlk';
    const url = (gateway.api_url || PROVIDER_DEFAULTS[provider] || '').trim();
    const extraHeaders = parseCustomHeaders(gateway.custom_headers);
    const formattedSchedule = formatScheduleTime(scheduleTime);

    const adapters = {
        textlk: () => ({
            url,
            headers: {
                'Authorization': `Bearer ${gateway.api_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders
            },
            payload: {
                recipient: recipients.join(','),
                sender_id: gateway.sender_id,
                type: gateway.message_type || 'plain',
                message,
                ...(formattedSchedule ? { schedule_time: formattedSchedule } : {})
            }
        }),
        textlk_http: () => ({
            url,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders
            },
            payload: {
                api_token: gateway.api_token,
                recipient: recipients.join(','),
                sender_id: gateway.sender_id,
                type: gateway.message_type || 'plain',
                message,
                ...(formattedSchedule ? { schedule_time: formattedSchedule } : {})
            }
        }),
        notify_lk: () => ({
            url,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders
            },
            payload: {
                user_id: extraHeaders.user_id || '',
                api_key: gateway.api_token,
                sender_id: gateway.sender_id,
                to: recipients.join(','),
                message
            }
        }),
        custom_json: () => ({
            url,
            headers: {
                ...(gateway.api_token ? { 'Authorization': `Bearer ${gateway.api_token}` } : {}),
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...extraHeaders
            },
            payload: {
                recipient: recipients.join(','),
                recipients,
                sender_id: gateway.sender_id,
                message,
                type: gateway.message_type || 'plain',
                ...(formattedSchedule ? { schedule_time: formattedSchedule } : {})
            }
        })
    };

    const builder = adapters[provider] || adapters.custom_json;
    return builder();
}

/** Dispatch SMS via gateway or return exact formatted preview in dry-run simulation. */
async function dispatchViaGateway(gateway, { recipients, message, scheduleTime, dryRun = false }) {
    const reqSpec = buildGatewayRequest(gateway, { recipients, message, scheduleTime });
    if (!reqSpec.url) {
        return {
            ok: false,
            status: 'failed',
            error: 'Gateway API URL is not configured.',
            responseJson: null
        };
    }

    if (dryRun) {
        return {
            ok: true,
            status: scheduleTime ? 'scheduled' : 'simulated',
            messageId: 'SIM-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
            responseJson: {
                mode: 'dry_run',
                provider: gateway.provider,
                endpoint: reqSpec.url,
                payload: reqSpec.payload
            }
        };
    }

    try {
        const res = await fetch(reqSpec.url, {
            method: 'POST',
            headers: reqSpec.headers,
            body: JSON.stringify(reqSpec.payload),
            signal: AbortSignal.timeout(15000)
        });
        const rawText = await res.text();
        let parsed = null;
        try {
            parsed = JSON.parse(rawText);
        } catch (_) {
            parsed = { raw: rawText };
        }

        const providerFailed = parsed && (parsed.status === 'error' || parsed.status === false);
        const ok = res.ok && !providerFailed;
        const messageId =
            (parsed && (parsed.data?.uid || parsed.data?.id || parsed.uid || parsed.message_id || parsed.id)) ||
            null;
        const errMsg = !ok
            ? (parsed?.message || parsed?.error || `HTTP ${res.status}`)
            : null;

        return {
            ok,
            status: ok ? (scheduleTime ? 'scheduled' : 'sent') : 'failed',
            messageId: messageId ? String(messageId) : null,
            error: errMsg,
            responseJson: parsed
        };
    } catch (err) {
        return {
            ok: false,
            status: 'failed',
            messageId: null,
            error: err.message || 'Network dispatch error',
            responseJson: { error: err.message }
        };
    }
}

module.exports = (db) => {
    const router = express.Router();

    async function resolveGateway(gatewayId) {
        if (gatewayId) {
            const g = await db.get('SELECT * FROM sms_gateways WHERE id = ?', [gatewayId]);
            if (g) return g;
        }
        return (
            (await db.get('SELECT * FROM sms_gateways WHERE is_default = 1 AND is_active = 1 LIMIT 1')) ||
            (await db.get('SELECT * FROM sms_gateways WHERE is_active = 1 ORDER BY id ASC LIMIT 1'))
        );
    }

    async function requireGatewayManager(req, res, next) {
        if (['admin', 'super_user'].includes(req.user?.role)) return next();
        const perm = await db.get(
            'SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?',
            [req.user?.id, 'settings']
        );
        if (perm) return next();
        return res.status(403).json({ error: 'Settings or Admin access required to manage SMS API gateways.' });
    }

    // ── KPI Summary ──────────────────────────────────────────────────────────
    router.get('/stats', authenticateToken, async (_req, res) => {
        try {
            const gateways = await db.all('SELECT id, name, provider, sender_id, is_default, is_active, last_status FROM sms_gateways');
            const defaultGw = gateways.find((g) => g.is_default === 1) || gateways[0] || null;
            const benCounts = await db.get(
                `SELECT
                    COUNT(*) AS total_beneficiaries,
                    SUM(CASE WHEN LENGTH(TRIM(COALESCE(contact_number, ''))) >= 9 THEN 1 ELSE 0 END) AS reachable_beneficiaries
                 FROM beneficiaries`
            );
            const logCounts = await db.get(
                `SELECT
                    SUM(CASE WHEN status IN ('sent', 'simulated') AND date(created_at) >= date('now', '-30 days') THEN 1 ELSE 0 END) AS sent_30d,
                    SUM(CASE WHEN status = 'scheduled' OR (reminder_tag != '' AND status IN ('sent', 'simulated', 'scheduled')) THEN 1 ELSE 0 END) AS reminders_count,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
                 FROM sms_logs`
            );

            res.json({
                total_gateways: gateways.length,
                active_gateways: gateways.filter((g) => g.is_active === 1).length,
                default_gateway: defaultGw ? { id: defaultGw.id, name: defaultGw.name, provider: defaultGw.provider, sender_id: defaultGw.sender_id } : null,
                total_beneficiaries: benCounts?.total_beneficiaries || 0,
                reachable_beneficiaries: benCounts?.reachable_beneficiaries || 0,
                sent_30d: logCounts?.sent_30d || 0,
                reminders_count: logCounts?.reminders_count || 0,
                failed_count: logCounts?.failed_count || 0
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── SMS Gateways CRUD (Text.lk & REST Providers) ─────────────────────────
    router.get('/gateways', authenticateToken, async (_req, res) => {
        try {
            const rows = await db.all('SELECT * FROM sms_gateways ORDER BY is_default DESC, id DESC');
            const safe = rows.map((g) => ({
                ...g,
                api_token_masked: maskToken(g.api_token),
                has_token: Boolean(g.api_token),
                api_token: undefined
            }));
            res.json(safe);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/gateways', authenticateToken, requireGatewayManager, async (req, res) => {
        try {
            const {
                name,
                provider = 'textlk',
                api_url,
                api_token,
                sender_id,
                default_country_code = '94',
                message_type = 'plain',
                custom_headers = '{}',
                is_default = 0,
                is_active = 1,
                notes = ''
            } = req.body;

            const resolvedUrl = (api_url || PROVIDER_DEFAULTS[provider] || '').trim();
            if (!name || !resolvedUrl || !api_token || !sender_id) {
                return res.status(400).json({ error: 'Name, API URL, API Token, and Sender ID are required.' });
            }

            if (is_default) {
                await db.run('UPDATE sms_gateways SET is_default = 0');
            } else {
                const countRow = await db.get('SELECT COUNT(*) as cnt FROM sms_gateways');
                if ((countRow?.cnt || 0) === 0) req.body._forceDefault = 1;
            }
            const makeDefault = is_default || req.body._forceDefault ? 1 : 0;

            const result = await db.run(
                `INSERT INTO sms_gateways
                    (name, provider, api_url, api_token, sender_id, default_country_code, message_type, custom_headers, is_default, is_active, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name.trim(),
                    provider,
                    resolvedUrl,
                    api_token.trim(),
                    sender_id.trim(),
                    String(default_country_code || '94').replace(/\D/g, '') || '94',
                    message_type || 'plain',
                    typeof custom_headers === 'string' ? custom_headers : JSON.stringify(custom_headers || {}),
                    makeDefault,
                    is_active ? 1 : 0,
                    notes || ''
                ]
            );
            res.status(201).json({ id: result.lastID, message: 'SMS gateway saved successfully.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/gateways/:id', authenticateToken, requireGatewayManager, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ error: 'SMS gateway not found.' });

            const {
                name,
                provider,
                api_url,
                api_token,
                sender_id,
                default_country_code,
                message_type,
                custom_headers,
                is_default,
                is_active,
                notes
            } = req.body;

            const nextToken = (api_token && !String(api_token).startsWith('••••'))
                ? String(api_token).trim()
                : existing.api_token;

            if (is_default) {
                await db.run('UPDATE sms_gateways SET is_default = 0');
            }

            await db.run(
                `UPDATE sms_gateways SET
                    name = ?, provider = ?, api_url = ?, api_token = ?, sender_id = ?,
                    default_country_code = ?, message_type = ?, custom_headers = ?,
                    is_default = ?, is_active = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    (name ?? existing.name).trim(),
                    provider ?? existing.provider,
                    (api_url ?? existing.api_url).trim(),
                    nextToken,
                    (sender_id ?? existing.sender_id).trim(),
                    String(default_country_code ?? existing.default_country_code ?? '94').replace(/\D/g, '') || '94',
                    message_type ?? existing.message_type ?? 'plain',
                    custom_headers !== undefined
                        ? (typeof custom_headers === 'string' ? custom_headers : JSON.stringify(custom_headers))
                        : existing.custom_headers,
                    is_default !== undefined ? (is_default ? 1 : 0) : existing.is_default,
                    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
                    notes !== undefined ? notes : existing.notes,
                    req.params.id
                ]
            );

            res.json({ message: 'SMS gateway updated successfully.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.patch('/gateways/:id/default', authenticateToken, requireGatewayManager, async (req, res) => {
        try {
            const existing = await db.get('SELECT id FROM sms_gateways WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ error: 'SMS gateway not found.' });
            await db.run('UPDATE sms_gateways SET is_default = 0');
            await db.run('UPDATE sms_gateways SET is_default = 1, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
            res.json({ message: 'Default SMS gateway updated.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/gateways/:id', authenticateToken, requireGatewayManager, async (req, res) => {
        try {
            const result = await db.run('DELETE FROM sms_gateways WHERE id = ?', [req.params.id]);
            if (!result.changes) return res.status(404).json({ error: 'SMS gateway not found.' });
            res.json({ message: 'SMS gateway deleted.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/gateways/:id/test', authenticateToken, requireGatewayManager, async (req, res) => {
        try {
            const gateway = await db.get('SELECT * FROM sms_gateways WHERE id = ?', [req.params.id]);
            if (!gateway) return res.status(404).json({ error: 'SMS gateway not found.' });

            const rawPhone = (req.body?.phone || '').trim();
            const phone = normalizePhoneNumber(rawPhone, gateway.default_country_code);
            if (!phone) {
                return res.status(400).json({ error: 'Please provide a valid test phone number (e.g. 0771234567).' });
            }

            const msg = (req.body?.message || `EDF Galgamuwa gateway test via ${gateway.name}`).trim();
            const dryRun = Boolean(req.body?.dry_run);
            const result = await dispatchViaGateway(gateway, { recipients: [phone], message: msg, dryRun });

            await db.run(
                'UPDATE sms_gateways SET last_status = ?, last_tested_at = CURRENT_TIMESTAMP WHERE id = ?',
                [result.ok ? (dryRun ? 'Dry-Run OK' : 'Connected') : `Error: ${result.error || 'Failed'}`, gateway.id]
            );

            await db.run(
                `INSERT INTO sms_logs
                    (gateway_id, gateway_name, dispatch_mode, recipient_type, phone_raw, phone_normalized, sender_id, message, segments, status, provider_response, provider_message_id, error_message, reminder_tag, sent_by)
                 VALUES (?, ?, 'test', 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Gateway Test', ?)`,
                [
                    gateway.id, gateway.name, rawPhone, phone, gateway.sender_id, msg,
                    calculateSmsSegments(msg), result.status,
                    JSON.stringify(result.responseJson || {}), result.messageId || null,
                    result.error || null, req.user?.username || 'admin'
                ]
            );

            res.status(result.ok ? 200 : 502).json({
                ok: result.ok,
                status: result.status,
                phone_normalized: phone,
                message_id: result.messageId,
                error: result.error,
                provider_response: result.responseJson
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Beneficiaries Recipient Directory ─────────────────────────────────────
    router.get('/recipients', authenticateToken, async (req, res) => {
        try {
            const { search = '', category = 'all', town = 'all', status = 'all' } = req.query;
            let sql = `SELECT id, application_number, male_head_name, female_head_name,
                              contact_number, home_town, category, status, family_status
                       FROM beneficiaries WHERE 1=1`;
            const params = [];

            if (category !== 'all') {
                sql += ' AND category = ?';
                params.push(category);
            }
            if (town !== 'all') {
                sql += ' AND home_town = ?';
                params.push(town);
            }
            if (status !== 'all') {
                sql += ' AND LOWER(COALESCE(status, \'\')) = LOWER(?)';
                params.push(status);
            }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                sql += ` AND (COALESCE(male_head_name,'') LIKE ?
                          OR COALESCE(female_head_name,'') LIKE ?
                          OR COALESCE(application_number,'') LIKE ?
                          OR COALESCE(contact_number,'') LIKE ?
                          OR COALESCE(home_town,'') LIKE ?
                          OR COALESCE(nic_number,'') LIKE ?)`;
                params.push(q, q, q, q, q, q);
            }
            sql += ' ORDER BY id DESC LIMIT 1000';

            const rows = await db.all(sql, params);
            const mapped = rows.map((b) => {
                const norm = normalizePhoneNumber(b.contact_number, '94');
                return {
                    ...b,
                    display_name: b.male_head_name || b.female_head_name || `Beneficiary #${b.id}`,
                    normalized_phone: norm,
                    has_valid_phone: Boolean(norm)
                };
            });
            res.json(mapped);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Templates CRUD ────────────────────────────────────────────────────────
    router.get('/templates', authenticateToken, async (_req, res) => {
        try {
            const rows = await db.all('SELECT * FROM sms_templates ORDER BY id DESC');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/templates', authenticateToken, async (req, res) => {
        try {
            const { title, category = 'Reminder', body } = req.body;
            if (!title || !body) return res.status(400).json({ error: 'Template title and body are required.' });
            const result = await db.run(
                'INSERT INTO sms_templates (title, category, body) VALUES (?, ?, ?)',
                [title.trim(), category.trim(), body.trim()]
            );
            res.status(201).json({ id: result.lastID, message: 'Template saved.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/templates/:id', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM sms_templates WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ error: 'Template not found.' });
            const { title, category, body } = req.body;
            await db.run(
                'UPDATE sms_templates SET title = ?, category = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [(title ?? existing.title).trim(), (category ?? existing.category).trim(), (body ?? existing.body).trim(), req.params.id]
            );
            res.json({ message: 'Template updated.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/templates/:id', authenticateToken, async (req, res) => {
        try {
            const result = await db.run('DELETE FROM sms_templates WHERE id = ?', [req.params.id]);
            if (!result.changes) return res.status(404).json({ error: 'Template not found.' });
            res.json({ message: 'Template deleted.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Individual & Bulk Beneficiary SMS Dispatch ────────────────────────────
    router.post('/send/individual', authenticateToken, async (req, res) => {
        try {
            const {
                gateway_id,
                beneficiary_id = null,
                phone = '',
                recipient_name = '',
                message,
                reminder_tag = '',
                schedule_time = null,
                dry_run = false
            } = req.body;

            if (!message || !String(message).trim()) {
                return res.status(400).json({ error: 'SMS message body is required.' });
            }

            const gateway = await resolveGateway(gateway_id);
            if (!gateway) {
                return res.status(400).json({ error: 'No active SMS API gateway configured. Add a Text.lk or REST gateway first.' });
            }

            let beneficiary = null;
            if (beneficiary_id) {
                beneficiary = await db.get('SELECT * FROM beneficiaries WHERE id = ?', [beneficiary_id]);
            }

            const rawPhone = (phone || beneficiary?.contact_number || '').trim();
            const normalized = normalizePhoneNumber(rawPhone, gateway.default_country_code);
            if (!normalized) {
                return res.status(400).json({ error: 'Recipient has no valid phone number.' });
            }

            const finalMessage = beneficiary ? renderMergeTags(message, beneficiary) : String(message).trim();
            const displayName = recipient_name || beneficiary?.male_head_name || beneficiary?.female_head_name || rawPhone;
            const dispatchMode = reminder_tag ? 'reminder' : 'individual';

            const result = await dispatchViaGateway(gateway, {
                recipients: [normalized],
                message: finalMessage,
                scheduleTime: schedule_time,
                dryRun: Boolean(dry_run)
            });

            const logInsert = await db.run(
                `INSERT INTO sms_logs
                    (gateway_id, gateway_name, dispatch_mode, recipient_type, beneficiary_id, beneficiary_name, phone_raw, phone_normalized, sender_id, message, segments, status, scheduled_for, provider_response, provider_message_id, error_message, reminder_tag, sent_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    gateway.id,
                    gateway.name,
                    dispatchMode,
                    beneficiary ? 'beneficiary' : 'custom',
                    beneficiary ? beneficiary.id : null,
                    displayName,
                    rawPhone,
                    normalized,
                    gateway.sender_id,
                    finalMessage,
                    calculateSmsSegments(finalMessage),
                    result.status,
                    schedule_time || null,
                    JSON.stringify(result.responseJson || {}),
                    result.messageId || null,
                    result.error || null,
                    reminder_tag || '',
                    req.user?.username || 'staff'
                ]
            );

            res.status(result.ok ? 200 : 502).json({
                ok: result.ok,
                log_id: logInsert.lastID,
                status: result.status,
                phone_normalized: normalized,
                message: result.ok ? 'SMS dispatched cleanly.' : `Dispatch failed: ${result.error}`,
                error: result.error || null
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/send/bulk', authenticateToken, async (req, res) => {
        try {
            const {
                gateway_id,
                beneficiary_ids = [],
                custom_numbers = [],
                message,
                reminder_tag = '',
                schedule_time = null,
                dry_run = false
            } = req.body;

            if (!message || !String(message).trim()) {
                return res.status(400).json({ error: 'SMS message body is required.' });
            }

            const gateway = await resolveGateway(gateway_id);
            if (!gateway) {
                return res.status(400).json({ error: 'No active SMS API gateway configured.' });
            }

            const targets = [];
            const seenPhones = new Set();

            if (Array.isArray(beneficiary_ids) && beneficiary_ids.length > 0) {
                const cleanIds = beneficiary_ids.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
                if (cleanIds.length > 0) {
                    const placeholders = cleanIds.map(() => '?').join(',');
                    const benRows = await db.all(
                        `SELECT * FROM beneficiaries WHERE id IN (${placeholders})`,
                        cleanIds
                    );
                    benRows.forEach((b) => {
                        const norm = normalizePhoneNumber(b.contact_number, gateway.default_country_code);
                        if (norm && !seenPhones.has(norm)) {
                            seenPhones.add(norm);
                            targets.push({
                                recipient_type: 'beneficiary',
                                beneficiary_id: b.id,
                                beneficiary_name: b.male_head_name || b.female_head_name || `Beneficiary #${b.id}`,
                                phone_raw: b.contact_number,
                                phone_normalized: norm,
                                rendered_message: renderMergeTags(message, b)
                            });
                        }
                    });
                }
            }

            if (Array.isArray(custom_numbers) && custom_numbers.length > 0) {
                custom_numbers.forEach((raw) => {
                    const norm = normalizePhoneNumber(raw, gateway.default_country_code);
                    if (norm && !seenPhones.has(norm)) {
                        seenPhones.add(norm);
                        targets.push({
                            recipient_type: 'custom',
                            beneficiary_id: null,
                            beneficiary_name: String(raw).trim(),
                            phone_raw: String(raw).trim(),
                            phone_normalized: norm,
                            rendered_message: String(message).trim()
                        });
                    }
                });
            }

            if (targets.length === 0) {
                return res.status(400).json({ error: 'No valid recipient phone numbers found in selection.' });
            }

            const batchId = 'BATCH-' + Date.now();
            const hasDynamicMergeTags = /\{(name|app_no|town|category)\}/.test(message);
            let sentCount = 0;
            let failedCount = 0;

            // If no merge tags and using Text.lk/custom JSON, batch comma-separated up to 50 per HTTP request for speed
            if (!hasDynamicMergeTags) {
                const chunkSize = 50;
                for (let i = 0; i < targets.length; i += chunkSize) {
                    const chunk = targets.slice(i, i + chunkSize);
                    const result = await dispatchViaGateway(gateway, {
                        recipients: chunk.map((t) => t.phone_normalized),
                        message: String(message).trim(),
                        scheduleTime: schedule_time,
                        dryRun: Boolean(dry_run)
                    });
                    for (const t of chunk) {
                        if (result.ok) sentCount++;
                        else failedCount++;
                        await db.run(
                            `INSERT INTO sms_logs
                                (gateway_id, gateway_name, batch_id, dispatch_mode, recipient_type, beneficiary_id, beneficiary_name, phone_raw, phone_normalized, sender_id, message, segments, status, scheduled_for, provider_response, provider_message_id, error_message, reminder_tag, sent_by)
                             VALUES (?, ?, ?, 'bulk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                gateway.id, gateway.name, batchId, t.recipient_type,
                                t.beneficiary_id, t.beneficiary_name, t.phone_raw, t.phone_normalized,
                                gateway.sender_id, t.rendered_message, calculateSmsSegments(t.rendered_message),
                                result.status, schedule_time || null,
                                JSON.stringify(result.responseJson || {}), result.messageId || null,
                                result.error || null, reminder_tag || '', req.user?.username || 'staff'
                            ]
                        );
                    }
                }
            } else {
                for (const t of targets) {
                    const result = await dispatchViaGateway(gateway, {
                        recipients: [t.phone_normalized],
                        message: t.rendered_message,
                        scheduleTime: schedule_time,
                        dryRun: Boolean(dry_run)
                    });
                    if (result.ok) sentCount++;
                    else failedCount++;
                    await db.run(
                        `INSERT INTO sms_logs
                            (gateway_id, gateway_name, batch_id, dispatch_mode, recipient_type, beneficiary_id, beneficiary_name, phone_raw, phone_normalized, sender_id, message, segments, status, scheduled_for, provider_response, provider_message_id, error_message, reminder_tag, sent_by)
                         VALUES (?, ?, ?, 'bulk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            gateway.id, gateway.name, batchId, t.recipient_type,
                            t.beneficiary_id, t.beneficiary_name, t.phone_raw, t.phone_normalized,
                            gateway.sender_id, t.rendered_message, calculateSmsSegments(t.rendered_message),
                            result.status, schedule_time || null,
                            JSON.stringify(result.responseJson || {}), result.messageId || null,
                            result.error || null, reminder_tag || '', req.user?.username || 'staff'
                        ]
                    );
                }
            }

            res.json({
                batch_id: batchId,
                total_targets: targets.length,
                sent_count: sentCount,
                failed_count: failedCount,
                dry_run: Boolean(dry_run)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── SMS Logs & Reminders CRUD ─────────────────────────────────────────────
    router.get('/logs', authenticateToken, async (req, res) => {
        try {
            const { status = 'all', mode = 'all', search = '', beneficiary_id = '', limit = '250' } = req.query;
            let sql = 'SELECT * FROM sms_logs WHERE 1=1';
            const params = [];

            if (status !== 'all') {
                sql += ' AND status = ?';
                params.push(status);
            }
            if (mode !== 'all') {
                sql += ' AND dispatch_mode = ?';
                params.push(mode);
            }
            if (beneficiary_id) {
                sql += ' AND beneficiary_id = ?';
                params.push(parseInt(beneficiary_id, 10));
            }
            if (search.trim()) {
                const q = `%${search.trim()}%`;
                sql += ' AND (COALESCE(beneficiary_name,\'\') LIKE ? OR phone_normalized LIKE ? OR message LIKE ? OR COALESCE(reminder_tag,\'\') LIKE ?)';
                params.push(q, q, q, q);
            }
            sql += ' ORDER BY id DESC LIMIT ?';
            params.push(Math.min(1000, Math.max(1, parseInt(limit, 10) || 250)));

            const rows = await db.all(sql, params);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/logs/:id', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM sms_logs WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ error: 'SMS log not found.' });

            const { reminder_tag, status, scheduled_for } = req.body;
            await db.run(
                'UPDATE sms_logs SET reminder_tag = ?, status = ?, scheduled_for = ? WHERE id = ?',
                [
                    reminder_tag !== undefined ? reminder_tag : existing.reminder_tag,
                    status || existing.status,
                    scheduled_for !== undefined ? scheduled_for : existing.scheduled_for,
                    req.params.id
                ]
            );
            res.json({ message: 'SMS log record updated.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/logs/:id/resend', authenticateToken, async (req, res) => {
        try {
            const existing = await db.get('SELECT * FROM sms_logs WHERE id = ?', [req.params.id]);
            if (!existing) return res.status(404).json({ error: 'SMS log not found.' });

            const gateway = await resolveGateway(req.body?.gateway_id || existing.gateway_id);
            if (!gateway) return res.status(400).json({ error: 'No active SMS gateway configured.' });

            const dryRun = Boolean(req.body?.dry_run);
            const result = await dispatchViaGateway(gateway, {
                recipients: [existing.phone_normalized],
                message: existing.message,
                dryRun
            });

            const newLog = await db.run(
                `INSERT INTO sms_logs
                    (gateway_id, gateway_name, dispatch_mode, recipient_type, beneficiary_id, beneficiary_name, phone_raw, phone_normalized, sender_id, message, segments, status, provider_response, provider_message_id, error_message, reminder_tag, sent_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    gateway.id, gateway.name, existing.dispatch_mode || 'individual',
                    existing.recipient_type, existing.beneficiary_id, existing.beneficiary_name,
                    existing.phone_raw, existing.phone_normalized, gateway.sender_id, existing.message,
                    existing.segments || 1, result.status,
                    JSON.stringify(result.responseJson || {}), result.messageId || null,
                    result.error || null, existing.reminder_tag || '', req.user?.username || 'staff'
                ]
            );

            res.status(result.ok ? 200 : 502).json({
                ok: result.ok,
                log_id: newLog.lastID,
                status: result.status,
                error: result.error || null
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/logs/:id', authenticateToken, async (req, res) => {
        try {
            const result = await db.run('DELETE FROM sms_logs WHERE id = ?', [req.params.id]);
            if (!result.changes) return res.status(404).json({ error: 'SMS log not found.' });
            res.json({ message: 'SMS log deleted.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/logs/bulk-delete', authenticateToken, async (req, res) => {
        try {
            const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
            const ids = rawIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n) && n > 0);
            if (!ids.length) return res.status(400).json({ error: 'No log IDs provided.' });

            const placeholders = ids.map(() => '?').join(',');
            const result = await db.run(`DELETE FROM sms_logs WHERE id IN (${placeholders})`, ids);
            res.json({ deleted: result.changes || 0 });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};


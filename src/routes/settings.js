const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/authMiddleware');
const storageSvc = require('../services/storage');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

function makeUploadFilename(fieldname, originalName) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    return fieldname + '-' + uniqueSuffix + path.extname(originalName || '');
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'super_user') {
        return res.status(403).json({ message: 'Admin or Super User access required' });
    }
    next();
}

module.exports = (db) => {
    // Get settings
    router.get('/', async (req, res) => {
        try {
            const rows = await db.all('SELECT key, value FROM global_settings');
            const config = {};
            rows.forEach(r => config[r.key] = r.value);
            res.json(config);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to get settings' });
        }
    });

    // ── Maintenance mode ──────────────────────────────────────────────────────
    // Public: GET /api/settings/maintenance — returns current flag
    router.get('/maintenance', async (req, res) => {
        try {
            const row = await db.get("SELECT value FROM global_settings WHERE key = 'maintenance_mode'");
            res.json({ maintenance_mode: row?.value ?? '0' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to read maintenance status' });
        }
    });

    // Admin: POST /api/settings/maintenance — toggle the flag
    router.post('/maintenance', authenticateToken, requireAdmin, async (req, res) => {
        const { enabled } = req.body; // true / false or 1 / 0
        const value = (enabled === true || enabled === 1 || enabled === '1') ? '1' : '0';
        try {
            await db.run(
                `INSERT INTO global_settings (key, value) VALUES ('maintenance_mode', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                [value]
            );
            res.json({ message: value === '1' ? 'Maintenance mode enabled' : 'Maintenance mode disabled', maintenance_mode: value });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update maintenance mode' });
        }
    });

    // Update settings (logo and favicon)
    router.post('/', authenticateToken, requireAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), async (req, res) => {
        try {
            const files = req.files || {};
            const toUpdate = {};
            
            if (files.logo && files.logo[0]) {
                const file = files.logo[0];
                const filename = makeUploadFilename(file.fieldname, file.originalname);
                await storageSvc.saveBuffer(`uploads/${filename}`, file.buffer, file.mimetype);
                toUpdate.logo_url = '/uploads/' + filename;
            }
            if (files.favicon && files.favicon[0]) {
                const file = files.favicon[0];
                const filename = makeUploadFilename(file.fieldname, file.originalname);
                await storageSvc.saveBuffer(`uploads/${filename}`, file.buffer, file.mimetype);
                toUpdate.favicon_url = '/uploads/' + filename;
            }
            
            // Allow storing brand & organization text settings cleanly
            const allowedTextKeys = [
                'brand_text',
                'brand_subtitle',
                'org_name',
                'org_reg_no',
                'org_address',
                'org_phone',
                'org_email',
                'org_desc'
            ];
            for (const key of allowedTextKeys) {
                if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
                    toUpdate[key] = String(req.body[key] ?? '').trim();
                }
            }

            for (const [key, value] of Object.entries(toUpdate)) {
                await db.run(
                    'INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
                    [key, value]
                );
            }

            res.json({ message: 'Settings updated successfully', settings: toUpdate });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to update settings' });
        }
    });

    return router;
};

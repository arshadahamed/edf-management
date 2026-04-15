const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

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

    // Update settings (logo and favicon)
    router.post('/', authenticateToken, requireAdmin, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), async (req, res) => {
        try {
            const files = req.files || {};
            const toUpdate = {};
            
            if (files.logo && files.logo[0]) {
                toUpdate.logo_url = '/uploads/' + files.logo[0].filename;
            }
            if (files.favicon && files.favicon[0]) {
                toUpdate.favicon_url = '/uploads/' + files.favicon[0].filename;
            }
            
            // Allow storing a brand text as well if passed
            if (req.body.brand_text) {
                toUpdate.brand_text = req.body.brand_text;
            }
            if (req.body.brand_subtitle) {
                toUpdate.brand_subtitle = req.body.brand_subtitle;
            }

            for (const [key, value] of Object.entries(toUpdate)) {
                await db.run(
                    'INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
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

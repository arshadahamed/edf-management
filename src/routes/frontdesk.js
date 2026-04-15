const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middleware/authMiddleware');

/* ── Upload directories ── */
const galleryDir = path.join(__dirname, '../../public/uploads/gallery');
const logoDir    = path.join(__dirname, '../../public/uploads/logo');
if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
if (!fs.existsSync(logoDir))    fs.mkdirSync(logoDir,    { recursive: true });

const imgFilter = (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif|svg/.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Images only'), ok);
};

/* Gallery multer */
const galleryStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, galleryDir),
    filename:    (_req, file,  cb) => {
        const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'gallery-' + safe + path.extname(file.originalname).toLowerCase());
    }
});
const upload = multer({ storage: galleryStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imgFilter });

/* Logo multer — fixed filename so browser cache busts via query string */
const logoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logoDir),
    filename:    (_req, file,  cb) => {
        const ts = Date.now();
        cb(null, 'logo-' + ts + path.extname(file.originalname).toLowerCase());
    }
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imgFilter });

function requireAdmin(req, res, next) {
    if (!['admin','super_user'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

module.exports = (db) => {

    /* ════════════════════════════════════════════
       GALLERY IMAGES
    ════════════════════════════════════════════ */

    // GET all active gallery images (public)
    router.get('/gallery', async (req, res) => {
        try {
            const rows = await db.all(
                `SELECT * FROM gallery_images WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
            );
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch gallery' });
        }
    });

    // GET all images including inactive (admin)
    router.get('/gallery/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all(`SELECT * FROM gallery_images ORDER BY sort_order ASC, created_at DESC`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ message: 'Failed to fetch gallery' });
        }
    });

    // POST upload new image
    router.post('/gallery', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
            const { caption, detail, category, display_year } = req.body;
            const maxOrder = await db.get('SELECT MAX(sort_order) as m FROM gallery_images');
            const sortOrder = (maxOrder?.m ?? -1) + 1;
            const result = await db.run(
                `INSERT INTO gallery_images (filename, original_name, caption, detail, category, display_year, sort_order, uploaded_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.file.filename, req.file.originalname, caption || '', detail || '',
                 category || 'community', display_year || '', sortOrder, req.user.id]
            );
            const image = await db.get('SELECT * FROM gallery_images WHERE id = ?', [result.lastID]);
            res.json({ message: 'Image uploaded', image });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Upload failed' });
        }
    });

    // PUT reorder — accepts { items: [{ id, sort_order }] }  — must be before /:id
    router.put('/gallery/reorder', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const items = req.body.items || [];
            for (const item of items) {
                await db.run('UPDATE gallery_images SET sort_order=? WHERE id=?', [item.sort_order, item.id]);
            }
            res.json({ message: 'Reordered' });
        } catch (err) {
            res.status(500).json({ message: 'Reorder failed' });
        }
    });

    // PUT update image metadata
    router.put('/gallery/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { caption, detail, category, display_year, sort_order, is_active } = req.body;
            await db.run(
                `UPDATE gallery_images SET caption=?, detail=?, category=?, display_year=?, sort_order=?, is_active=?
                 WHERE id=?`,
                [caption, detail, category, display_year, sort_order ?? 0, is_active ?? 1, req.params.id]
            );
            const image = await db.get('SELECT * FROM gallery_images WHERE id = ?', [req.params.id]);
            res.json({ message: 'Updated', image });
        } catch (err) {
            res.status(500).json({ message: 'Update failed' });
        }
    });

    // DELETE image
    router.delete('/gallery/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const image = await db.get('SELECT filename FROM gallery_images WHERE id = ?', [req.params.id]);
            if (!image) return res.status(404).json({ message: 'Image not found in database' });
            
            // Delete file from disk if it exists
            const filePath = path.join(galleryDir, image.filename);
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (fsErr) {
                console.error("Warning: Could not delete physical file:", fsErr);
                // Proceed to delete from db even if file is locked
            }
            
            await db.run('DELETE FROM gallery_images WHERE id = ?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) {
            console.error('Gallery Delete Route Error:', err);
            res.status(500).json({ message: 'Delete failed: ' + err.message });
        }
    });

    /* ════════════════════════════════════════════
       SITE CONTENT (key-value per page)
    ════════════════════════════════════════════ */

    // GET all content for a page
    router.get('/content/:page', async (req, res) => {
        try {
            const rows = await db.all(
                'SELECT content_key, content_value FROM site_content WHERE page = ?', [req.params.page]
            );
            const out = {};
            rows.forEach(r => out[r.content_key] = r.content_value);
            res.json(out);
        } catch (err) {
            res.status(500).json({ message: 'Failed to get content' });
        }
    });

    // PUT upsert content fields for a page — body: { key: value, ... }
    router.put('/content/:page', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const page = req.params.page;
            for (const [key, value] of Object.entries(req.body)) {
                await db.run(
                    `INSERT INTO site_content (page, content_key, content_value, updated_by)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(page, content_key)
                     DO UPDATE SET content_value=excluded.content_value, updated_by=excluded.updated_by, updated_at=datetime('now')`,
                    [page, key, value, req.user.id]
                );
            }
            res.json({ message: 'Content updated' });
        } catch (err) {
            res.status(500).json({ message: 'Update failed' });
        }
    });

    /* ════════════════════════════════════════════
       LOGO
    ════════════════════════════════════════════ */

    // GET current logo URL (public)
    router.get('/logo', async (req, res) => {
        try {
            const row = await db.get(
                `SELECT content_value FROM site_content WHERE page='site' AND content_key='logo.filename'`
            );
            res.json({ url: row ? `/uploads/logo/${row.content_value}` : null });
        } catch (err) {
            res.status(500).json({ message: 'Failed' });
        }
    });

    // POST upload new logo
    router.post('/logo', authenticateToken, requireAdmin, uploadLogo.single('logo'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

            // Delete old logo file from disk
            const old = await db.get(
                `SELECT content_value FROM site_content WHERE page='site' AND content_key='logo.filename'`
            );
            if (old) {
                const oldPath = path.join(logoDir, old.content_value);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }

            // Persist new filename in site_content
            await db.run(
                `INSERT INTO site_content (page, content_key, content_value, updated_by)
                 VALUES ('site','logo.filename',?,?)
                 ON CONFLICT(page, content_key)
                 DO UPDATE SET content_value=excluded.content_value, updated_by=excluded.updated_by, updated_at=datetime('now')`,
                [req.file.filename, req.user.id]
            );
            res.json({ message: 'Logo updated', url: `/uploads/logo/${req.file.filename}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Upload failed' });
        }
    });

    // DELETE logo — revert to default
    router.delete('/logo', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const row = await db.get(
                `SELECT content_value FROM site_content WHERE page='site' AND content_key='logo.filename'`
            );
            if (row) {
                const filePath = path.join(logoDir, row.content_value);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                await db.run(`DELETE FROM site_content WHERE page='site' AND content_key='logo.filename'`);
            }
            res.json({ message: 'Logo removed' });
        } catch (err) {
            res.status(500).json({ message: 'Failed' });
        }
    });

    /* ════════════════════════════════════════════
       TIMELINE ITEMS
    ════════════════════════════════════════════ */

    router.get('/timeline', async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM timeline_items WHERE is_active=1 ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.get('/timeline/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM timeline_items ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.post('/timeline', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { year, label, title, description } = req.body;
            const maxO = await db.get('SELECT MAX(sort_order) as m FROM timeline_items');
            const result = await db.run(
                'INSERT INTO timeline_items (year,label,title,description,sort_order) VALUES (?,?,?,?,?)',
                [year, label, title, description, (maxO?.m ?? -1) + 1]
            );
            const row = await db.get('SELECT * FROM timeline_items WHERE id=?', [result.lastID]);
            res.json({ message: 'Created', item: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.put('/timeline/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { year, label, title, description, sort_order, is_active } = req.body;
            await db.run(
                'UPDATE timeline_items SET year=?,label=?,title=?,description=?,sort_order=?,is_active=? WHERE id=?',
                [year, label, title, description, sort_order ?? 0, is_active ?? 1, req.params.id]
            );
            const row = await db.get('SELECT * FROM timeline_items WHERE id=?', [req.params.id]);
            res.json({ message: 'Updated', item: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.delete('/timeline/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await db.run('DELETE FROM timeline_items WHERE id=?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    /* ════════════════════════════════════════════
       TEAM MEMBERS
    ════════════════════════════════════════════ */

    router.get('/team', async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM team_members WHERE is_active=1 ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.get('/team/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM team_members ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.post('/team', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { name, role, bio, avatar_color, avatar_letter } = req.body;
            const maxO = await db.get('SELECT MAX(sort_order) as m FROM team_members');
            const result = await db.run(
                'INSERT INTO team_members (name,role,bio,avatar_color,avatar_letter,sort_order) VALUES (?,?,?,?,?,?)',
                [name, role, bio, avatar_color || '#0A5C3E', (avatar_letter || name[0]).toUpperCase(), (maxO?.m ?? -1) + 1]
            );
            const row = await db.get('SELECT * FROM team_members WHERE id=?', [result.lastID]);
            res.json({ message: 'Created', member: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.put('/team/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { name, role, bio, avatar_color, avatar_letter, sort_order, is_active } = req.body;
            await db.run(
                'UPDATE team_members SET name=?,role=?,bio=?,avatar_color=?,avatar_letter=?,sort_order=?,is_active=? WHERE id=?',
                [name, role, bio, avatar_color, avatar_letter, sort_order ?? 0, is_active ?? 1, req.params.id]
            );
            const row = await db.get('SELECT * FROM team_members WHERE id=?', [req.params.id]);
            res.json({ message: 'Updated', member: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.delete('/team/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await db.run('DELETE FROM team_members WHERE id=?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    /* ════════════════════════════════════════════
       ORIGIN PARAGRAPHS
    ════════════════════════════════════════════ */

    router.get('/origin-paragraphs', async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM origin_paragraphs WHERE is_active=1 ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.get('/origin-paragraphs/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM origin_paragraphs ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.post('/origin-paragraphs', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { type, content, attribution } = req.body;
            if (!content) return res.status(400).json({ message: 'Content required' });
            const maxO = await db.get('SELECT MAX(sort_order) as m FROM origin_paragraphs');
            const result = await db.run(
                'INSERT INTO origin_paragraphs (type,content,attribution,sort_order) VALUES (?,?,?,?)',
                [type || 'text', content, attribution || null, (maxO?.m ?? -1) + 1]
            );
            const row = await db.get('SELECT * FROM origin_paragraphs WHERE id=?', [result.lastID]);
            res.json({ message: 'Created', item: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.put('/origin-paragraphs/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { type, content, attribution, sort_order, is_active } = req.body;
            await db.run(
                'UPDATE origin_paragraphs SET type=?,content=?,attribution=?,sort_order=?,is_active=? WHERE id=?',
                [type || 'text', content, attribution || null, sort_order ?? 0, is_active ?? 1, req.params.id]
            );
            const row = await db.get('SELECT * FROM origin_paragraphs WHERE id=?', [req.params.id]);
            res.json({ message: 'Updated', item: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.delete('/origin-paragraphs/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await db.run('DELETE FROM origin_paragraphs WHERE id=?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    /* ════════════════════════════════════════════
       SITE PARTNERS
    ════════════════════════════════════════════ */

    router.get('/partners', async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM site_partners WHERE is_active=1 ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.get('/partners/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all('SELECT * FROM site_partners ORDER BY sort_order ASC');
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.post('/partners', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { name } = req.body;
            const maxO = await db.get('SELECT MAX(sort_order) as m FROM site_partners');
            const result = await db.run(
                'INSERT INTO site_partners (name, sort_order) VALUES (?,?)',
                [name, (maxO?.m ?? -1) + 1]
            );
            const row = await db.get('SELECT * FROM site_partners WHERE id=?', [result.lastID]);
            res.json({ message: 'Created', partner: row });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.put('/partners/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { name, sort_order, is_active } = req.body;
            await db.run(
                'UPDATE site_partners SET name=?,sort_order=?,is_active=? WHERE id=?',
                [name, sort_order ?? 0, is_active ?? 1, req.params.id]
            );
            res.json({ message: 'Updated' });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    router.delete('/partners/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await db.run('DELETE FROM site_partners WHERE id=?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) { res.status(500).json({ message: 'Failed' }); }
    });

    return router;
};

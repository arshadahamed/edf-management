const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middleware/authMiddleware');

const documentsDir = path.join(__dirname, '../../public/uploads/documents');
if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });

function requireAdmin(req, res, next) {
    if (!['admin', 'super_user'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, documentsDir),
    filename: (_req, file, cb) => {
        const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'doc-' + safe + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
    fileFilter: (_req, file, cb) => {
        const blocked = /\.exe$|\.sh$|\.bat$|\.cmd$|\.ps1$/i;
        if (blocked.test(file.originalname)) {
            return cb(new Error('Executable files are not allowed'), false);
        }
        cb(null, true);
    }
});

function detectCategory(mimeType, filename) {
    if (!mimeType) return 'other';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || /\.xlsx?$/i.test(filename)) return 'excel';
    if (mimeType.includes('wordprocessing') || mimeType.includes('msword') || /\.docx?$/i.test(filename)) return 'word';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || /\.pptx?$/i.test(filename)) return 'presentation';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
    return 'other';
}

module.exports = (db) => {

    /* ── GET all (with optional ?category= & ?search=) ── */
    router.get('/', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { category, search } = req.query;
            let query = `SELECT d.*, u.full_name AS uploader_name
                         FROM documents d
                         LEFT JOIN users u ON d.uploaded_by = u.id
                         WHERE 1=1`;
            const params = [];
            if (category && category !== 'all') { query += ' AND d.category = ?'; params.push(category); }
            if (search) { query += ' AND d.original_name LIKE ?'; params.push('%' + search + '%'); }
            query += ' ORDER BY d.created_at DESC';
            const rows = await db.all(query, params);
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch documents' });
        }
    });

    /* ── GET stats (counts per category + total size) ── */
    router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all(
                `SELECT category, COUNT(*) as count, SUM(file_size) as total_size FROM documents GROUP BY category`
            );
            const total = await db.get('SELECT COUNT(*) as count, SUM(file_size) as total_size FROM documents');
            res.json({ byCategory: rows, total });
        } catch (err) {
            res.status(500).json({ message: 'Failed' });
        }
    });

    /* ── POST upload ── */
    router.post('/', authenticateToken, requireAdmin, (req, res) => {
        upload.single('file')(req, res, async (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
            try {
                if (!req.file) return res.status(400).json({ message: 'No file provided' });
                const { category, description, display_name } = req.body;
                const cat = category && category !== 'auto'
                    ? category
                    : detectCategory(req.file.mimetype, req.file.originalname);
                const result = await db.run(
                    `INSERT INTO documents (original_name, filename, category, description, file_size, mime_type, uploaded_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [display_name || req.file.originalname, req.file.filename, cat,
                     description || '', req.file.size, req.file.mimetype, req.user.id]
                );
                const doc = await db.get('SELECT * FROM documents WHERE id = ?', [result.lastID]);
                res.json({ message: 'Uploaded', document: doc });
            } catch (e) {
                console.error(e);
                res.status(500).json({ message: 'Upload failed' });
            }
        });
    });

    /* ── PUT update metadata ── */
    router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { original_name, category, description } = req.body;
            if (!original_name) return res.status(400).json({ message: 'Name is required' });
            await db.run(
                'UPDATE documents SET original_name=?, category=?, description=? WHERE id=?',
                [original_name, category || 'other', description || '', req.params.id]
            );
            const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            res.json({ message: 'Updated', document: doc });
        } catch (err) {
            res.status(500).json({ message: 'Update failed' });
        }
    });

    /* ── DELETE ── */
    router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const doc = await db.get('SELECT filename FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            const filePath = path.join(documentsDir, doc.filename);
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
            await db.run('DELETE FROM documents WHERE id = ?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) {
            res.status(500).json({ message: 'Delete failed' });
        }
    });

    /* ── GET download ── */
    router.get('/:id/download', authenticateToken, async (req, res) => {
        try {
            const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            const filePath = path.join(documentsDir, doc.filename);
            if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on disk' });
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
            res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
            res.sendFile(filePath);
        } catch (err) {
            res.status(500).json({ message: 'Download failed' });
        }
    });

    return router;
};

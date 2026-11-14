const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { authenticateToken } = require('../middleware/authMiddleware');
const storageSvc = require('../services/storage');

function requireAdmin(req, res, next) {
    if (!['admin', 'super_user'].includes(req.user?.role)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const blocked = /\.exe$|\.sh$|\.bat$|\.cmd$|\.ps1$/i;
        if (blocked.test(file.originalname)) {
            return cb(new Error('Executable files are not allowed'), false);
        }
        cb(null, true);
    }
});

function makeDocFilename(originalName) {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return 'doc-' + safe + path.extname(originalName || '').toLowerCase();
}

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

    /* ── GET all (with optional ?category=, ?folder=, ?pinned=, ?sort=, ?search=) ── */
    router.get('/', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const { category, folder, pinned, sort, search } = req.query;
            let query = `SELECT d.*, u.full_name AS uploader_name
                         FROM documents d
                         LEFT JOIN users u ON d.uploaded_by = u.id
                         WHERE 1=1`;
            const params = [];
            if (category && category !== 'all') { query += ' AND d.category = ?'; params.push(category); }
            if (folder && folder !== 'all') { query += " AND COALESCE(d.folder, 'General') = ?"; params.push(folder); }
            if (pinned === '1' || pinned === 'true') { query += ' AND COALESCE(d.is_pinned, 0) = 1'; }
            if (search && String(search).trim()) {
                const q = '%' + String(search).trim() + '%';
                query += " AND (d.original_name LIKE ? OR COALESCE(d.description, '') LIKE ? OR COALESCE(d.folder, '') LIKE ?)";
                params.push(q, q, q);
            }
            let orderSql = 'ORDER BY COALESCE(d.is_pinned, 0) DESC, d.created_at DESC, d.id DESC';
            if (sort === 'oldest') orderSql = 'ORDER BY d.created_at ASC, d.id ASC';
            else if (sort === 'name') orderSql = 'ORDER BY LOWER(d.original_name) ASC';
            else if (sort === 'size') orderSql = 'ORDER BY d.file_size DESC, d.created_at DESC';
            else if (sort === 'newest_only') orderSql = 'ORDER BY d.created_at DESC, d.id DESC';

            query += ' ' + orderSql;
            const rows = await db.all(query, params);
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Failed to fetch documents' });
        }
    });

    /* ── GET stats (counts per category + folders + pinned + total size) ── */
    router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const rows = await db.all(
                `SELECT category, COUNT(*) as count, SUM(file_size) as total_size FROM documents GROUP BY category`
            );
            const byFolder = await db.all(
                `SELECT COALESCE(folder, 'General') as folder, COUNT(*) as count FROM documents GROUP BY COALESCE(folder, 'General')`
            );
            const pinnedRow = await db.get('SELECT COUNT(*) as count FROM documents WHERE COALESCE(is_pinned, 0) = 1');
            const total = await db.get('SELECT COUNT(*) as count, SUM(file_size) as total_size FROM documents');
            res.json({ byCategory: rows, byFolder, pinnedCount: pinnedRow?.count || 0, total });
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
                const { category, description, display_name, folder, visibility, is_pinned } = req.body;
                const cat = category && category !== 'auto'
                    ? category
                    : detectCategory(req.file.mimetype, req.file.originalname);
                const cleanFolder = (folder && String(folder).trim()) || 'General';
                const cleanVis = ['internal', 'board_only', 'restricted'].includes(visibility) ? visibility : 'internal';
                const pinnedVal = (is_pinned === '1' || is_pinned === 1 || is_pinned === true || is_pinned === 'true') ? 1 : 0;

                const storedFilename = makeDocFilename(req.file.originalname);
                await storageSvc.saveBuffer(`uploads/documents/${storedFilename}`, req.file.buffer, req.file.mimetype);

                const result = await db.run(
                    `INSERT INTO documents (original_name, filename, category, description, file_size, mime_type, uploaded_by, folder, visibility, is_pinned)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [display_name || req.file.originalname, storedFilename, cat,
                     description || '', req.file.size, req.file.mimetype, req.user.id, cleanFolder, cleanVis, pinnedVal]
                );
                const doc = await db.get(
                    `SELECT d.*, u.full_name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?`,
                    [result.lastID]
                );
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
            const { original_name, category, description, folder, visibility, is_pinned } = req.body;
            if (!original_name) return res.status(400).json({ message: 'Name is required' });
            const cleanFolder = (folder && String(folder).trim()) || 'General';
            const cleanVis = ['internal', 'board_only', 'restricted'].includes(visibility) ? visibility : 'internal';
            const pinnedVal = (is_pinned === '1' || is_pinned === 1 || is_pinned === true || is_pinned === 'true') ? 1 : 0;
            await db.run(
                'UPDATE documents SET original_name=?, category=?, description=?, folder=?, visibility=?, is_pinned=? WHERE id=?',
                [original_name, category || 'other', description || '', cleanFolder, cleanVis, pinnedVal, req.params.id]
            );
            const doc = await db.get(
                `SELECT d.*, u.full_name AS uploader_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE d.id = ?`,
                [req.params.id]
            );
            res.json({ message: 'Updated', document: doc });
        } catch (err) {
            res.status(500).json({ message: 'Update failed' });
        }
    });

    /* ── PATCH quick pin toggle ── */
    router.patch('/:id/pin', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const doc = await db.get('SELECT id, COALESCE(is_pinned, 0) AS is_pinned FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            const nextPin = doc.is_pinned ? 0 : 1;
            await db.run('UPDATE documents SET is_pinned = ? WHERE id = ?', [nextPin, req.params.id]);
            res.json({ id: doc.id, is_pinned: nextPin, message: nextPin ? 'Document pinned' : 'Document unpinned' });
        } catch (err) {
            res.status(500).json({ message: 'Pin update failed' });
        }
    });

    /* ── POST bulk delete ── */
    router.post('/bulk-delete', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
            if (!ids.length) return res.status(400).json({ message: 'No document IDs selected' });
            const placeholders = ids.map(() => '?').join(',');
            const docs = await db.all(`SELECT id, filename FROM documents WHERE id IN (${placeholders})`, ids);
            for (const d of docs) {
                try { await storageSvc.deleteFile(`uploads/documents/${d.filename}`); } catch {}
            }
            await db.run(`DELETE FROM documents WHERE id IN (${placeholders})`, ids);
            res.json({ deleted: docs.length, message: `Deleted ${docs.length} file(s)` });
        } catch (err) {
            res.status(500).json({ message: 'Bulk delete failed' });
        }
    });

    /* ── DELETE ── */
    router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const doc = await db.get('SELECT filename FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            try { await storageSvc.deleteFile(`uploads/documents/${doc.filename}`); } catch {}
            await db.run('DELETE FROM documents WHERE id = ?', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (err) {
            res.status(500).json({ message: 'Delete failed' });
        }
    });

    /* ── GET inline preview ── */
    router.get('/:id/preview', authenticateToken, async (req, res) => {
        try {
            const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            const buffer = await storageSvc.readBuffer(`uploads/documents/${doc.filename}`);
            if (!buffer) return res.status(404).json({ message: 'File missing in storage' });
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
            res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
            res.send(buffer);
        } catch (err) {
            res.status(500).json({ message: 'Preview failed' });
        }
    });

    /* ── GET download ── */
    router.get('/:id/download', authenticateToken, async (req, res) => {
        try {
            const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            if (!doc) return res.status(404).json({ message: 'Not found' });
            const buffer = await storageSvc.readBuffer(`uploads/documents/${doc.filename}`);
            if (!buffer) return res.status(404).json({ message: 'File missing in storage' });
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
            res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
            res.send(buffer);
        } catch (err) {
            res.status(500).json({ message: 'Download failed' });
        }
    });

    return router;
};

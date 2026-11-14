const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const storageSvc = require('../services/storage');

const invImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype || '')
            || /\.(png|jpe?g|webp|gif)$/i.test(file.originalname || '');
        cb(ok ? null : new Error('Only PNG, JPG, WEBP, or GIF images are allowed'), ok);
    }
});

module.exports = (db) => {
    // UPLOAD ASSET IMAGE
    router.post('/upload-image', authenticateToken, (req, res) => {
        invImageUpload.single('image')(req, res, async (err) => {
            if (err) return res.status(400).json({ message: err.message || 'Image upload failed' });
            if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });
            try {
                const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
                const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
                await storageSvc.saveBuffer(`uploads/inventory/${safe}`, req.file.buffer, req.file.mimetype);
                res.json({ image_url: `/uploads/inventory/${safe}` });
            } catch (uploadErr) {
                console.error('Inventory upload error:', uploadErr);
                res.status(500).json({ message: 'Failed to store inventory image' });
            }
        });
    });

    // ITEMS CRUD
    router.get('/items', authenticateToken, async (req, res) => {
        try {
            const items = await db.all('SELECT * FROM inventory_items ORDER BY created_at DESC');
            res.json(items);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/items', authenticateToken, async (req, res) => {
        const {
            name, category, tracking_type, serial_number, quantity, min_threshold,
            status, condition, purchase_price, current_value, warranty_info,
            qr_code, book_author, book_language, book_subject, library_type, location, image_url
        } = req.body;

        const cleanQr = qr_code && String(qr_code).trim() ? String(qr_code).trim() : null;
        try {
            const result = await db.run(
                `INSERT INTO inventory_items (
                    name, category, tracking_type, serial_number, quantity,
                    min_threshold, status, condition, purchase_price, current_value,
                    warranty_info, qr_code, book_author, book_language,
                    book_subject, library_type, location, image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name, category, tracking_type || 'Serialized', serial_number || null, Number(quantity) >= 0 ? Number(quantity) : 1,
                    Number(min_threshold) || 0, status || 'Available', condition || 'Good',
                    Number(purchase_price) || 0, Number(current_value) || 0, warranty_info || null,
                    cleanQr, book_author || null, book_language || null, book_subject || null,
                    library_type || null, location || '', image_url ? String(image_url).trim() : ''
                ]
            );
            res.status(201).json({ id: result.lastID, message: 'Item created' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.put('/items/:id', authenticateToken, async (req, res) => {
        const id = req.params.id;
        const {
            name, category, tracking_type, serial_number, quantity, min_threshold,
            status, condition, purchase_price, current_value, warranty_info,
            qr_code, book_author, book_language, book_subject, library_type, location, image_url
        } = req.body;

        const cleanQr = qr_code && String(qr_code).trim() ? String(qr_code).trim() : null;
        try {
            await db.run(
                `UPDATE inventory_items SET
                    name=?, category=?, tracking_type=?, serial_number=?, quantity=?,
                    min_threshold=?, status=?, condition=?, purchase_price=?, current_value=?,
                    warranty_info=?, qr_code=?, book_author=?, book_language=?,
                    book_subject=?, library_type=?, location=?, image_url=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?`,
                [
                    name, category, tracking_type || 'Serialized', serial_number || null, Number(quantity) >= 0 ? Number(quantity) : 0,
                    Number(min_threshold) || 0, status || 'Available', condition || 'Good',
                    Number(purchase_price) || 0, Number(current_value) || 0, warranty_info || null,
                    cleanQr, book_author || null, book_language || null, book_subject || null,
                    library_type || null, location || '', image_url ? String(image_url).trim() : '', id
                ]
            );
            res.json({ message: 'Item updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.patch('/items/:id/restock', authenticateToken, async (req, res) => {
        const addQty = parseInt(req.body?.add_quantity, 10);
        if (!Number.isFinite(addQty) || addQty <= 0) {
            return res.status(400).json({ message: 'Positive restock quantity required' });
        }
        try {
            await db.run(
                `UPDATE inventory_items SET quantity = COALESCE(quantity, 0) + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [addQty, req.params.id]
            );
            const item = await db.get('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
            if (!item) return res.status(404).json({ message: 'Item not found' });
            res.json({ item, message: `Added ${addQty} unit(s) to stock` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/items/bulk-delete', authenticateToken, async (req, res) => {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
        if (!ids.length) return res.status(400).json({ message: 'No items selected' });
        const ph = ids.map(() => '?').join(',');
        try {
            await db.run(`DELETE FROM inventory_loans WHERE item_id IN (${ph})`, ids);
            await db.run(`DELETE FROM inventory_maintenance WHERE item_id IN (${ph})`, ids);
            await db.run(`DELETE FROM inventory_usage WHERE item_id IN (${ph})`, ids);
            await db.run(`DELETE FROM inventory_items WHERE id IN (${ph})`, ids);
            res.json({ deleted: ids.length, message: `Deleted ${ids.length} asset(s)` });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.delete('/items/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM inventory_loans WHERE item_id=?', [req.params.id]);
            await db.run('DELETE FROM inventory_maintenance WHERE item_id=?', [req.params.id]);
            await db.run('DELETE FROM inventory_usage WHERE item_id=?', [req.params.id]);
            await db.run('DELETE FROM inventory_items WHERE id=?', [req.params.id]);
            res.json({ message: 'Item deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // LOANS (Check-out / Check-in)
    router.get('/loans', authenticateToken, async (req, res) => {
        try {
            const loans = await db.all(`
                SELECT l.*,
                       i.name as item_name,
                       i.serial_number,
                       l.loan_date as checkout_date,
                       l.return_date as actual_return_date,
                       CASE WHEN l.return_date IS NOT NULL THEN 'Returned' ELSE 'Out' END as status
                FROM inventory_loans l
                JOIN inventory_items i ON l.item_id = i.id
                ORDER BY l.loan_date DESC
            `);
            res.json(loans);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/loans', authenticateToken, async (req, res) => {
        const { item_id, borrower_name, borrower_type, expected_return_date, notes } = req.body;
        try {
            await db.run("UPDATE inventory_items SET status='Checked Out', updated_at=CURRENT_TIMESTAMP WHERE id=?", [item_id]);
            
            const result = await db.run(
                `INSERT INTO inventory_loans (item_id, borrower_name, borrower_type, expected_return_date, notes) 
                 VALUES (?, ?, ?, ?, ?)`,
                [item_id, borrower_name, borrower_type, expected_return_date, notes]
            );
            res.status(201).json({ id: result.lastID, message: 'Item checked out' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.put('/loans/:id/return', authenticateToken, async (req, res) => {
        const { return_condition, notes, item_id } = req.body;
        const noteSuffix = notes && String(notes).trim() ? String(notes).trim() : '';
        try {
            // Update loan (null-safe note append)
            await db.run(
                `UPDATE inventory_loans
                 SET return_date=CURRENT_TIMESTAMP,
                     return_condition=?,
                     notes=TRIM(COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') != '' AND ? != '' THEN CHAR(10) ELSE '' END || ?)
                 WHERE id=?`,
                [return_condition || 'Good', noteSuffix, noteSuffix, req.params.id]
            );
            // Update item
            await db.run(
                `UPDATE inventory_items SET status='Available', condition=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, 
                [return_condition || 'Good', item_id]
            );
            res.json({ message: 'Item returned' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });
    
    router.delete('/loans/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM inventory_loans WHERE id=?', [req.params.id]);
            res.json({ message: 'Loan record deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // MAINTENANCE
    router.get('/maintenance', authenticateToken, async (req, res) => {
        try {
            const records = await db.all(`
                SELECT m.*, i.name as item_name 
                FROM inventory_maintenance m
                JOIN inventory_items i ON m.item_id = i.id
                ORDER BY m.service_date DESC
            `);
            res.json(records);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/maintenance', authenticateToken, async (req, res) => {
        const { item_id, service_date, description, cost, next_service_date } = req.body;
        try {
            await db.run(
                `INSERT INTO inventory_maintenance (item_id, service_date, description, cost, next_service_date) 
                 VALUES (?, ?, ?, ?, ?)`,
                [item_id, service_date, description, cost, next_service_date]
            );
            res.status(201).json({ message: 'Maintenance recorded' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // USAGE / CONSUMABLES
    router.get('/usage', authenticateToken, async (req, res) => {
        try {
            const records = await db.all(`
                SELECT u.*, i.name as item_name 
                FROM inventory_usage u
                JOIN inventory_items i ON u.item_id = i.id
                ORDER BY u.usage_date DESC
            `);
            res.json(records);
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.post('/usage', authenticateToken, async (req, res) => {
        const { item_id, quantity_used, department } = req.body;
        try {
            const used = Math.max(1, parseInt(quantity_used, 10) || 1);
            await db.withTransaction(async (tx) => {
                // Deduct quantity safely without dropping below zero
                await tx.run(
                    `UPDATE inventory_items SET quantity = MAX(0, COALESCE(quantity, 0) - ?), updated_at = CURRENT_TIMESTAMP WHERE id=?`,
                    [used, item_id]
                );

                // Log usage
                await tx.run(
                    `INSERT INTO inventory_usage (item_id, quantity_used, department) VALUES (?, ?, ?)`,
                    [item_id, used, department || '']
                );
            });
            res.status(201).json({ message: 'Usage recorded' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};

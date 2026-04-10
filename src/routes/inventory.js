const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {
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
            qr_code, book_author, book_language, book_subject, library_type
        } = req.body;
        
        try {
            const result = await db.run(
                `INSERT INTO inventory_items (
                    name, category, tracking_type, serial_number, quantity, 
                    min_threshold, status, condition, purchase_price, current_value, 
                    warranty_info, qr_code, book_author, book_language, 
                    book_subject, library_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name, category, tracking_type, serial_number, quantity || 1, 
                    min_threshold || 0, status || 'available', condition || 'working', 
                    purchase_price || 0, current_value || 0, warranty_info, 
                    qr_code, book_author, book_language, book_subject, library_type
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
            qr_code, book_author, book_language, book_subject, library_type
        } = req.body;
        
        try {
            await db.run(
                `UPDATE inventory_items SET 
                    name=?, category=?, tracking_type=?, serial_number=?, quantity=?, 
                    min_threshold=?, status=?, condition=?, purchase_price=?, current_value=?, 
                    warranty_info=?, qr_code=?, book_author=?, book_language=?, 
                    book_subject=?, library_type=?, updated_at=CURRENT_TIMESTAMP
                WHERE id=?`,
                [
                    name, category, tracking_type, serial_number, quantity, 
                    min_threshold, status, condition, purchase_price, current_value, 
                    warranty_info, qr_code, book_author, book_language, 
                    book_subject, library_type, id
                ]
            );
            res.json({ message: 'Item updated' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.delete('/items/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM inventory_items WHERE id=?', [req.params.id]);
            res.json({ message: 'Item deleted' });
        } catch (err) { res.status(500).json({ message: err.message }); }
    });

    // LOANS (Check-out / Check-in)
    router.get('/loans', authenticateToken, async (req, res) => {
        try {
            const loans = await db.all(`
                SELECT l.*, i.name as item_name, i.serial_number 
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
            // Update item status to in_use
            await db.run("UPDATE inventory_items SET status='in_use' WHERE id=?", [item_id]);
            
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
        try {
            // Update loan
            await db.run(
                `UPDATE inventory_loans SET return_date=CURRENT_TIMESTAMP, return_condition=?, notes=notes|| CHAR(10) || ? WHERE id=?`,
                [return_condition, notes, req.params.id]
            );
            // Update item
            await db.run(
                `UPDATE inventory_items SET status='available', condition=? WHERE id=?`, 
                [return_condition, item_id]
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
            await db.run('BEGIN TRANSACTION');
            
            // Deduct quantity
            await db.run(
                `UPDATE inventory_items SET quantity = quantity - ? WHERE id=?`, 
                [quantity_used, item_id]
            );
            
            // Log usage
            await db.run(
                `INSERT INTO inventory_usage (item_id, quantity_used, department) VALUES (?, ?, ?)`,
                [item_id, quantity_used, department]
            );
            
            await db.run('COMMIT');
            res.status(201).json({ message: 'Usage recorded' });
        } catch (err) { 
            await db.run('ROLLBACK');
            res.status(500).json({ message: err.message }); 
        }
    });

    return router;
};

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

module.exports = (db) => {

    // GET all templates
    router.get('/templates', authenticateToken, async (req, res) => {
        try {
            const templates = await db.all('SELECT * FROM form_templates ORDER BY created_at DESC');
            res.json(templates);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Save template
    router.post('/templates', authenticateToken, async (req, res) => {
        const { name, structure, is_default } = req.body;
        try {
            if (is_default) {
                await db.run('UPDATE form_templates SET is_default = 0');
            }
            const result = await db.run(
                'INSERT INTO form_templates (name, structure, is_default) VALUES (?, ?, ?)',
                [name, structure, is_default ? 1 : 0]
            );
            res.json({ id: result.lastID, message: 'Template saved' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Update template
    router.put('/templates/:id', authenticateToken, async (req, res) => {
        const { name, structure, is_default } = req.body;
        try {
            if (is_default) {
                await db.run('UPDATE form_templates SET is_default = 0');
            }
            await db.run(
                'UPDATE form_templates SET name = ?, structure = ?, is_default = ? WHERE id = ?',
                [name, structure, is_default ? 1 : 0, req.params.id]
            );
            res.json({ message: 'Template updated' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Delete template
    router.delete('/templates/:id', authenticateToken, async (req, res) => {
        try {
            await db.run('DELETE FROM form_templates WHERE id = ?', [req.params.id]);
            res.json({ message: 'Template deleted' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // Set default
    router.patch('/templates/:id/default', authenticateToken, async (req, res) => {
        try {
            await db.run('UPDATE form_templates SET is_default = 0');
            await db.run('UPDATE form_templates SET is_default = 1 WHERE id = ?', [req.params.id]);
            res.json({ message: 'Default template updated' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./src/db/database');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB and start server
async function startServer() {
    try {
        const db = await initDb();
        console.log('Database initialized successfully.');

        // Routes
        const authRoutes = require('./src/routes/auth')(db);
        const statsRoutes = require('./src/routes/stats')(db);
        const edfRoutes = require('./src/routes/edf')(db);
        const inventoryRoutes = require('./src/routes/inventory')(db);
        const programsRoutes = require('./src/routes/programs')(db);
        const formsRoutes = require('./src/routes/forms')(db);
        const logsRoutes = require('./src/routes/logs')(db);
        const ramadanRoutes = require('./src/routes/ramadan')(db);
        const adminRoutes   = require('./src/routes/admin')(db);
        const activityLogger  = require('./src/middleware/activityLogger')(db);
        const userGuard       = require('./src/middleware/userGuard')(db);
        const permissionGuard = require('./src/middleware/permissionGuard')(db);

        app.use('/api', activityLogger);   // Log all /api requests
        app.use('/api', userGuard);        // Block/force-logout check + last_seen update
        app.use('/api', permissionGuard);  // Per-module permission enforcement
        app.use('/api/auth', authRoutes);
        app.use('/api/stats', statsRoutes);
        app.use('/api/edf', edfRoutes);
        app.use('/api/inventory', inventoryRoutes);
        app.use('/api/programs', programsRoutes);
        app.use('/api/forms', formsRoutes);
        app.use('/api/logs', logsRoutes);
        app.use('/api/ramadan', ramadanRoutes);
        app.use('/api/admin',  adminRoutes);

        // Serve HTML files
        app.get('/login', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });

        app.get('/dashboard', (req, res) => {
            const token = req.cookies.token;
            if (!token) {
                return res.redirect('/login');
            }

            // Set headers to prevent caching of the dashboard page
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        app.use((req, res) => {
            res.redirect('/login');
        });

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    }
}

startServer();

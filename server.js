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
        const adminRoutes     = require('./src/routes/admin')(db);
        const settingsRoutes  = require('./src/routes/settings')(db);
        const frontdeskRoutes = require('./src/routes/frontdesk')(db);
        const documentsRoutes = require('./src/routes/documents')(db);
        const activityLogger    = require('./src/middleware/activityLogger')(db);
        const userGuard         = require('./src/middleware/userGuard')(db);
        const permissionGuard   = require('./src/middleware/permissionGuard')(db);
        const maintenanceGuard  = require('./src/middleware/maintenanceGuard')(db);

        // maintenanceGuard MUST come before express.static so that requests for
        // index.html, gallery.html, about.html etc. are intercepted first.
        app.use(maintenanceGuard);

        // Static files served after the maintenance check
        app.use(express.static(path.join(__dirname, 'public')));
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
        app.use('/api/settings', settingsRoutes);
        app.use('/api/frontdesk', frontdeskRoutes);
        app.use('/api/documents', documentsRoutes);

        // Serve HTML files
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        app.get('/login', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });

        app.get('/gallery', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
        });

        app.get('/about', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'about.html'));
        });

        app.get('/maintenance', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
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

        // 404 fallback — serves custom page with correct HTTP status
        app.use((req, res) => {
            // API routes that don't exist get a JSON 404
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ message: 'API endpoint not found.' });
            }
            res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
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

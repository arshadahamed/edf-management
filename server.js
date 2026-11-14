require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./src/db/database');
const storageSvc = require('./src/services/storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = fs.existsSync(path.join(process.cwd(), 'public'))
    ? path.join(process.cwd(), 'public')
    : path.join(__dirname, 'public');

let appPromise = null;

/**
 * Lazily initializes DB schema and builds the Express app singleton once per process/lambda instance.
 */
async function createApp() {
    if (appPromise) return appPromise;

    appPromise = (async () => {
        const db = await initDb();
        console.log(`Database initialized successfully (${db.engine || 'sqlite'}).`);

        const app = express();
        app.set('trust proxy', 1);

        // Security headers
        app.use(helmet({ contentSecurityPolicy: false }));

        // Built-in Gzip compression for HTML, CSS, JS, JSON & SVG (critical for Cloudflare Tunnel & local speed)
        app.use((req, res, next) => {
            const acceptEncoding = req.headers['accept-encoding'] || '';
            if (!/\bgzip\b/i.test(acceptEncoding) || req.method === 'HEAD') return next();

            // Intercept sendFile / send / json for compressible text responses
            const origSend = res.send.bind(res);
            res.send = function (body) {
                if (res.headersSent || res.getHeader('Content-Encoding')) {
                    return origSend(body);
                }
                const cType = String(res.getHeader('Content-Type') || '');
                const isCompressible = /text\/|javascript|json|xml|svg/i.test(cType);
                if (!isCompressible || !body) return origSend(body);

                const buf = Buffer.isBuffer(body)
                    ? body
                    : typeof body === 'string'
                        ? Buffer.from(body, 'utf8')
                        : null;
                if (!buf || buf.length < 1024) return origSend(body);

                try {
                    const gz = zlib.gzipSync(buf, { level: zlib.constants.Z_BEST_SPEED });
                    res.setHeader('Content-Encoding', 'gzip');
                    res.setHeader('Vary', 'Accept-Encoding');
                    res.removeHeader('Content-Length');
                    return origSend(gz);
                } catch (_) {
                    return origSend(body);
                }
            };
            next();
        });

        // Rate limiting
        const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
        const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { message: 'Too many attempts. Try again in 15 minutes.' } });
        app.use('/api/auth/login', authLimiter);
        app.use('/api', apiLimiter);

        // Body & cookie parsers
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());
        app.use(cors());

        // Routes & Guards
        const authRoutes      = require('./src/routes/auth')(db);
        const statsRoutes     = require('./src/routes/stats')(db);
        const edfRoutes       = require('./src/routes/edf')(db);
        const inventoryRoutes = require('./src/routes/inventory')(db);
        const programsRoutes  = require('./src/routes/programs')(db);
        const formsRoutes     = require('./src/routes/forms')(db);
        const logsRoutes      = require('./src/routes/logs')(db);
        const ramadanRoutes   = require('./src/routes/ramadan')(db);
        const adminRoutes     = require('./src/routes/admin')(db);
        const settingsRoutes  = require('./src/routes/settings')(db);
        const backupsModule   = require('./src/routes/backups')(db);
        const frontdeskRoutes = require('./src/routes/frontdesk')(db);
        const documentsRoutes = require('./src/routes/documents')(db);
        const smsRoutes       = require('./src/routes/sms')(db);
        const madrasaRoutes   = require('./src/routes/madrasa')(db);
        const activityLogger  = require('./src/middleware/activityLogger')(db);
        const userGuard       = require('./src/middleware/userGuard')(db);
        const permissionGuard = require('./src/middleware/permissionGuard')(db);
        const maintenanceGuard = require('./src/middleware/maintenanceGuard')(db);

        // maintenanceGuard MUST come before express.static so page requests are intercepted first.
        app.use(maintenanceGuard);

        // Static files served locally / from bundled public directory with fast browser caching for CSS/JS/images/vendor
        app.use(express.static(PUBLIC_DIR, {
            etag: true,
            lastModified: true,
            setHeaders: (res, filePath) => {
                if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i.test(filePath)) {
                    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
                }
            }
        }));

        // Cloud storage fallback for dynamic uploads (/uploads/* and /images/beneficiaries/*)
        app.use(['/uploads', '/images/beneficiaries'], async (req, res, next) => {
            if (req.method !== 'GET' && req.method !== 'HEAD') return next();
            if (!storageSvc.isCloudStorage()) return next();

            const reqPath = `${req.baseUrl || ''}${req.path || ''}`;
            // Never expose private documents via public URL paths (use /api/documents/:id/preview|download)
            if (reqPath.startsWith('/uploads/documents/')) return next();

            const relPath = storageSvc.relPathFromPublicUrl(reqPath);
            if (!relPath || (!relPath.startsWith('uploads/') && !relPath.startsWith('images/beneficiaries/'))) {
                return next();
            }

            try {
                const meta = await storageSvc.getBlobMeta(relPath);
                if (!meta || !meta.url) return next();

                if ((process.env.BLOB_ACCESS || 'public') === 'private') {
                    const buf = await storageSvc.readBuffer(relPath);
                    if (!buf) return next();
                    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream');
                    res.setHeader('Cache-Control', 'private, max-age=3600');
                    return res.send(buf);
                }

                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return res.redirect(302, meta.url);
            } catch (err) {
                console.error('Cloud asset fallback error:', err);
                return next();
            }
        });

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
        app.use('/api/admin', adminRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/backups', express.json({ limit: '50mb' }), backupsModule.router);
        app.use('/api/frontdesk', frontdeskRoutes);
        app.use('/api/documents', documentsRoutes);
        app.use('/api/sms', smsRoutes);
        app.use('/api/madrasa', madrasaRoutes);

        // Serve HTML files
        app.get('/', (req, res) => {
            res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
        });

        app.get('/login', (req, res) => {
            res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
        });

        app.get('/gallery', (req, res) => {
            res.sendFile(path.join(PUBLIC_DIR, 'gallery.html'));
        });

        app.get('/about', (req, res) => {
            res.sendFile(path.join(PUBLIC_DIR, 'about.html'));
        });

        app.get('/maintenance', (req, res) => {
            res.sendFile(path.join(PUBLIC_DIR, 'maintenance.html'));
        });

        app.get('/dashboard', (req, res) => {
            const token = req.cookies.token;
            if (!token) {
                return res.redirect('/login');
            }

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
        });

        // 404 fallback
        app.use((req, res) => {
            if (req.path.startsWith('/api/')) {
                return res.status(404).json({ message: 'API endpoint not found.' });
            }
            res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
        });

        return app;
    })().catch((err) => {
        appPromise = null;
        throw err;
    });

    return appPromise;
}

if (require.main === module) {
    createApp()
        .then((app) => {
            const os = require('os');
            const net = require('net');
            const http = require('http');
            const https = require('https');

            const certPath = process.env.SSL_CERT_PATH || path.join(os.homedir(), '.cloudflared', 'localhost-cert.pem');
            const keyPath = process.env.SSL_KEY_PATH || path.join(os.homedir(), '.cloudflared', 'localhost-key.pem');

            if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                const httpServer = http.createServer(app);
                const httpsServer = https.createServer({
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath)
                }, app);

                // Multiplex both HTTP and HTTPS on the same PORT (so both http://localhost:3000 and https://localhost:3000 work)
                const muxServer = net.createServer((socket) => {
                    socket.once('readable', () => {
                        const chunk = socket.read(1);
                        if (!chunk) return;
                        socket.unshift(chunk);
                        // 0x16 (22) is TLS handshake record type
                        const target = chunk[0] === 0x16 ? httpsServer : httpServer;
                        target.emit('connection', socket);
                    });
                    socket.on('error', () => {});
                });

                muxServer.on('error', (err) => {
                    console.error(`Failed to bind port ${PORT}:`, err.message);
                    process.exit(1);
                });

                muxServer.listen(PORT, () => {
                    console.log(`Server is running on http://localhost:${PORT} and https://localhost:${PORT}`);
                });
            } else {
                app.listen(PORT, (err) => {
                    if (err) {
                        console.error(`Failed to bind port ${PORT}:`, err.message);
                        process.exit(1);
                    }
                    console.log(`Server is running on http://localhost:${PORT}`);
                });
            }
        })
        .catch((err) => {
            console.error('Failed to initialize database:', err);
            process.exit(1);
        });
}

async function handler(req, res) {
    try {
        const app = await createApp();
        return app(req, res);
    } catch (err) {
        console.error('Request handler initialization error:', err);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Server initialization failed: ' + (err?.message || 'Unknown error') });
        }
    }
}

handler.createApp = createApp;
module.exports = handler;

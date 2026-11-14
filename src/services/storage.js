const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const MIME_TYPES = {
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.sqlite': 'application/vnd.sqlite3'
};

let blobSdkPromise = null;
let blobSdkOverride = null;

/**
 * Returns true when Vercel Blob cloud storage credentials are configured.
 */
function isCloudStorage() {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.trim());
}

/**
 * Normalizes a relative storage path and blocks directory traversal.
 */
function normalizeRelPath(relPath) {
    if (!relPath || typeof relPath !== 'string') {
        throw new Error('Invalid storage path');
    }
    const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (!parts.length || parts.some(p => p === '.' || p === '..')) {
        throw new Error(`Unsafe storage path: ${relPath}`);
    }
    return parts.join('/');
}

/**
 * Resolves a relative storage key to its local filesystem path when running locally.
 */
function localPathFor(relPath) {
    const norm = normalizeRelPath(relPath);
    if (norm === 'backups' || norm.startsWith('backups/')) {
        return path.join(PROJECT_ROOT, norm);
    }
    return path.join(PROJECT_ROOT, 'public', norm);
}

/**
 * Infers a sensible Content-Type from filename extension.
 */
function guessContentType(filename, fallback = 'application/octet-stream') {
    const ext = path.extname(String(filename || '')).toLowerCase();
    return MIME_TYPES[ext] || fallback;
}

async function getBlobSdk() {
    if (blobSdkOverride) return blobSdkOverride;
    if (!blobSdkPromise) {
        blobSdkPromise = import('@vercel/blob');
    }
    return blobSdkPromise;
}

function _setBlobSdkForTest(sdk) {
    blobSdkOverride = sdk || null;
}

function isBlobNotFoundError(err) {
    if (!err) return false;
    if (err.name === 'BlobNotFoundError') return true;
    if (err.status === 404 || err.statusCode === 404) return true;
    return /not found|does not exist|404/i.test(String(err.message || ''));
}

/**
 * Persists a Buffer or string to Vercel Blob (when configured) or local disk.
 */
async function saveBuffer(relPath, content, contentType) {
    const norm = normalizeRelPath(relPath);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const resolvedType = contentType || guessContentType(norm);

    if (isCloudStorage()) {
        const sdk = await getBlobSdk();
        const blob = await sdk.put(norm, buffer, {
            access: process.env.BLOB_ACCESS || 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: resolvedType
        });
        return {
            relPath: norm,
            url: blob.url,
            size: buffer.length,
            contentType: resolvedType
        };
    }

    const absPath = localPathFor(norm);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);
    return {
        relPath: norm,
        url: norm.startsWith('backups/') ? null : `/${norm}`,
        size: buffer.length,
        contentType: resolvedType
    };
}

/**
 * Retrieves file metadata from Vercel Blob or local disk, or null if absent.
 */
async function getBlobMeta(relPath) {
    const norm = normalizeRelPath(relPath);
    if (isCloudStorage()) {
        const sdk = await getBlobSdk();
        try {
            const meta = await sdk.head(norm);
            return meta ? {
                url: meta.url,
                downloadUrl: meta.downloadUrl || meta.url,
                size: Number(meta.size || 0),
                contentType: meta.contentType || guessContentType(norm)
            } : null;
        } catch (err) {
            if (isBlobNotFoundError(err)) return null;
            throw err;
        }
    }

    const absPath = localPathFor(norm);
    try {
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) return null;
        return {
            url: norm.startsWith('backups/') ? null : `/${norm}`,
            downloadUrl: null,
            size: stat.size,
            contentType: guessContentType(norm)
        };
    } catch (_) {
        return null;
    }
}

async function exists(relPath) {
    return Boolean(await getBlobMeta(relPath));
}

async function getFileSize(relPath) {
    const meta = await getBlobMeta(relPath);
    return meta ? Number(meta.size || 0) : 0;
}

/**
 * Reads a stored file into memory as a Buffer, returning null if missing.
 */
async function readBuffer(relPath) {
    const norm = normalizeRelPath(relPath);
    if (isCloudStorage()) {
        const meta = await getBlobMeta(norm);
        if (!meta || !meta.url) return null;
        const headers = {};
        if ((process.env.BLOB_ACCESS || 'public') === 'private' && process.env.BLOB_READ_WRITE_TOKEN) {
            headers.Authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
        }
        const resp = await fetch(meta.url, { headers });
        if (resp.status === 404) return null;
        if (!resp.ok) {
            throw new Error(`Blob read failed (${resp.status}) for ${norm}`);
        }
        return Buffer.from(await resp.arrayBuffer());
    }

    const absPath = localPathFor(norm);
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath);
}

/**
 * Deletes a stored file if present. Silently succeeds if already missing.
 */
async function deleteFile(relPath) {
    const norm = normalizeRelPath(relPath);
    if (isCloudStorage()) {
        const sdk = await getBlobSdk();
        try {
            await sdk.del(norm);
            return true;
        } catch (err) {
            if (isBlobNotFoundError(err)) return false;
            throw err;
        }
    }

    const absPath = localPathFor(norm);
    if (!fs.existsSync(absPath)) return false;
    fs.unlinkSync(absPath);
    return true;
}

/**
 * Extracts a safe filename from an uploaded/stored path or URL (e.g. /uploads/members/a.jpg -> uploads/members/a.jpg).
 */
function relPathFromPublicUrl(urlPath) {
    if (!urlPath || typeof urlPath !== 'string') return null;
    if (/^https?:\/\//i.test(urlPath)) return null;
    const stripped = urlPath.split('?')[0].split('#')[0];
    try {
        return normalizeRelPath(stripped);
    } catch (_) {
        return null;
    }
}

module.exports = {
    isCloudStorage,
    normalizeRelPath,
    localPathFor,
    guessContentType,
    saveBuffer,
    getBlobMeta,
    exists,
    getFileSize,
    readBuffer,
    deleteFile,
    relPathFromPublicUrl,
    _setBlobSdkForTest
};

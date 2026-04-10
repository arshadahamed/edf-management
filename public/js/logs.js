/* ═══════════════════════════════════════════════════════════════
   SYSTEM LOGS — Activity Log & Monitoring
   ═══════════════════════════════════════════════════════════════ */

let _logState = {
    type:     'all',
    entity:   'all',
    search:   '',
    from:     '',
    to:       '',
    offset:   0,
    limit:    50,
    total:    0,
    loading:  false,
    debounceTimer: null
};

/* ── Public entry: called by tab navigation ─────────────────── */
async function fetchSystemLogs(reset = false) {
    if (_logState.loading) return;

    if (reset) {
        _logState.offset = 0;
        document.getElementById('systemLogsBody').innerHTML = '';
    }

    _logState.type   = _logState.type   || 'all';
    _logState.entity = (document.getElementById('logEntityFilter')?.value) || 'all';
    _logState.from   = (document.getElementById('logDateFrom')?.value) || '';
    _logState.to     = (document.getElementById('logDateTo')?.value)   || '';
    _logState.search = (document.getElementById('logSearchInput')?.value || '').trim();

    _logState.loading = true;
    _showLogSkeleton();

    try {
        const params = new URLSearchParams({
            type:   _logState.type,
            entity: _logState.entity,
            search: _logState.search,
            from:   _logState.from,
            to:     _logState.to,
            limit:  _logState.limit,
            offset: _logState.offset
        });

        const res = await fetch(`/api/logs/system-logs?${params}`, { credentials: 'include' });

        if (res.status === 401 || res.status === 403) {
            showToast('No permission to view system logs.', 'error');
            _showLogEmpty('Permission denied.');
            return;
        }
        if (!res.ok) throw new Error('Server returned ' + res.status);

        const data = await res.json();
        // API returns { logs: [], total: N }
        const logs  = Array.isArray(data) ? data : (data.logs || []);
        const total = data.total ?? logs.length;

        _logState.total  = total;
        _logState.offset = _logState.offset + logs.length;

        _renderLogEntries(logs, reset);
        _updateLogStats();
        _updateLogLoadMore();

    } catch (err) {
        showToast('Error loading logs: ' + err.message, 'error');
        if (reset) _showLogEmpty('Failed to load logs. Please refresh.');
    } finally {
        _logState.loading = false;
    }
}

/* ── Load more ──────────────────────────────────────────────── */
function loadMoreLogs() {
    fetchSystemLogs(false);
}

/* ── Filter pill handler ────────────────────────────────────── */
function setLogTypeFilter(type, btn) {
    _logState.type = type;
    document.querySelectorAll('#logsTab .filter-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    fetchSystemLogs(true);
}

/* ── Debounced search ───────────────────────────────────────── */
function debounceLogSearch() {
    clearTimeout(_logState.debounceTimer);
    _logState.debounceTimer = setTimeout(() => fetchSystemLogs(true), 350);
}

/* ── Clear all logs ─────────────────────────────────────────── */
async function clearAllSystemLogs() {
    if (!confirm('Permanently delete ALL system logs? This cannot be undone.')) return;
    const btn = document.getElementById('logClearBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Clearing…'; if (window.lucide) lucide.createIcons(); }

    try {
        const res = await fetch('/api/logs/system-logs', { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
            showToast('All logs cleared.', 'success');
            _logState.offset = 0;
            _logState.total  = 0;
            fetchSystemLogs(true);
            _fetchLogStats();
        } else {
            showToast('Failed to clear logs.', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="trash-2"></i> Clear All'; if (window.lucide) lucide.createIcons(); }
    }
}

/* ── Stats banner ───────────────────────────────────────────── */
async function _fetchLogStats() {
    try {
        const res = await fetch('/api/logs/stats', { credentials: 'include' });
        if (!res.ok) return;
        const d = await res.json();
        _setEl('logStatTotal',  d.total       ?? '—');
        _setEl('logStatToday',  d.todayCount  ?? '—');
        _setEl('logStatErrors', d.errorsToday ?? '—');
        _setEl('logStatUsers',  d.activeUsers ?? '—');
    } catch (_) {}
}

function _updateLogStats() {
    const shown = document.querySelectorAll('.log-entry').length;
    const countEl = document.getElementById('logFilterCount');
    if (countEl) {
        countEl.textContent = _logState.total > 0
            ? `Showing ${shown} of ${_logState.total.toLocaleString()} entries`
            : '';
    }
}

function _updateLogLoadMore() {
    const btn = document.getElementById('logLoadMoreBtn');
    if (!btn) return;
    const shown = _logState.offset;
    if (shown < _logState.total) {
        btn.style.display = 'flex';
        btn.textContent = `Load more  (${shown} / ${_logState.total})`;
    } else {
        btn.style.display = 'none';
    }
}

/* ── Render entries ─────────────────────────────────────────── */
function _renderLogEntries(logs, reset) {
    const body = document.getElementById('systemLogsBody');
    if (!body) return;

    // Remove skeleton
    body.querySelectorAll('.log-skeleton').forEach(s => s.remove());

    if (reset && logs.length === 0) {
        _showLogEmpty('No log entries match the current filters.');
        return;
    }
    if (logs.length === 0) return;

    logs.forEach((log, i) => {
        const el = _buildLogEntry(log, i);
        body.appendChild(el);
    });

    if (window.lucide) lucide.createIcons();
}

function _buildLogEntry(log, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'log-entry';
    wrap.style.animationDelay = `${idx * 30}ms`;

    const d = new Date(log.created_at);
    const dateStr  = d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    const timeStr  = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: true });

    // Action badge
    const { color, bg, icon, label, category } = _resolveAction(log.action);

    // User
    const userName  = log.full_name || log.username || (log.user_id ? `User #${log.user_id}` : 'System');
    const userInitial = userName.charAt(0).toUpperCase();
    const userColor   = _strColor(userName);

    // Entity
    const entityLabel = (log.entity || 'SYSTEM').charAt(0) + (log.entity || 'system').slice(1).toLowerCase();
    const entityBadge = log.entity_id ? `<span class="log-entity-id">#${_esc(log.entity_id)}</span>` : '';

    // Details
    let descriptionText = '';
    let hasDetails = false;
    let detailId = `log-detail-${log.id || idx}`;
    if (log.details) {
        try {
            const parsed = JSON.parse(log.details);
            descriptionText = parsed.description || '';
            hasDetails = true;
        } catch (_) {
            descriptionText = log.details;
        }
    }

    // IP
    const ipStr = log.ip_address ? `<span class="log-ip"><i data-lucide="globe" style="width:11px;"></i>${_esc(log.ip_address)}</span>` : '';

    wrap.innerHTML = `
        <div class="log-entry-left">
            <div class="log-action-dot" style="background:${bg}; color:${color};" title="${label}">
                <i data-lucide="${icon}" style="width:13px;height:13px;"></i>
            </div>
            <div class="log-entry-line"></div>
        </div>

        <div class="log-entry-content">
            <div class="log-entry-header">
                <div class="log-user-chip">
                    <div class="log-avatar" style="background:${userColor};">${userInitial}</div>
                    <span class="log-username">${_esc(userName)}</span>
                </div>
                <span class="log-action-badge" style="background:${bg}; color:${color};">${label}</span>
                <span class="log-entity-tag">
                    <i data-lucide="layers" style="width:11px;"></i>
                    ${_esc(entityLabel)}${entityBadge}
                </span>
                <div class="log-meta-right">
                    ${ipStr}
                    <span class="log-time" title="${d.toISOString()}">
                        <i data-lucide="clock" style="width:11px;"></i>
                        ${timeStr} · ${dateStr}
                    </span>
                </div>
            </div>
            ${descriptionText ? `<div class="log-description">${_esc(descriptionText)}</div>` : ''}
            ${hasDetails ? `
                <button class="log-payload-toggle" onclick="_toggleLogPayload('${detailId}', this)">
                    <i data-lucide="code-2" style="width:12px;"></i> View Payload
                </button>
                <pre class="log-payload hidden" id="${detailId}"></pre>
            ` : ''}
        </div>
    `;

    // Lazily fill payload (avoid XSS in JSON)
    if (hasDetails) {
        const pre = wrap.querySelector(`#${detailId}`);
        if (pre) {
            try {
                const parsed = JSON.parse(log.details);
                pre.textContent = JSON.stringify(parsed, null, 2);
            } catch (_) {
                pre.textContent = log.details;
            }
        }
    }

    return wrap;
}

function _toggleLogPayload(id, btn) {
    const pre = document.getElementById(id);
    if (!pre) return;
    const hidden = pre.classList.toggle('hidden');
    btn.innerHTML = hidden
        ? '<i data-lucide="code-2" style="width:12px;"></i> View Payload'
        : '<i data-lucide="code-2" style="width:12px;"></i> Hide Payload';
    if (window.lucide) lucide.createIcons();
}

/* ── Skeleton loader ────────────────────────────────────────── */
function _showLogSkeleton() {
    const body = document.getElementById('systemLogsBody');
    if (!body) return;
    body.querySelectorAll('.log-skeleton, .log-empty-state').forEach(e => e.remove());

    for (let i = 0; i < 5; i++) {
        const s = document.createElement('div');
        s.className = 'log-skeleton';
        s.style.animationDelay = `${i * 80}ms`;
        s.innerHTML = `
            <div class="log-sk-dot"></div>
            <div class="log-sk-body">
                <div class="log-sk-line" style="width: ${55 + Math.random()*30}%;"></div>
                <div class="log-sk-line short" style="width: ${25 + Math.random()*20}%;"></div>
            </div>
        `;
        body.appendChild(s);
    }
}

/* ── Empty state ────────────────────────────────────────────── */
function _showLogEmpty(msg = 'No logs recorded yet.') {
    const body = document.getElementById('systemLogsBody');
    if (!body) return;
    body.querySelectorAll('.log-skeleton').forEach(e => e.remove());
    const empty = document.createElement('div');
    empty.className = 'log-empty-state';
    empty.innerHTML = `
        <div class="log-empty-icon">
            <i data-lucide="scroll-text" style="width:40px;height:40px;opacity:0.4;"></i>
        </div>
        <h3>Nothing here yet</h3>
        <p>${_esc(msg)}</p>
    `;
    body.appendChild(empty);
    if (window.lucide) lucide.createIcons();
}

/* ── Helpers ────────────────────────────────────────────────── */
function _resolveAction(action) {
    const a = (action || '').toUpperCase();
    if (a === 'LOGIN')          return { color:'#10b981', bg:'rgba(16,185,129,0.12)', icon:'log-in',        label:'Login',   category:'auth'   };
    if (a === 'LOGOUT')         return { color:'#6b7280', bg:'rgba(107,114,128,0.12)', icon:'log-out',      label:'Logout',  category:'auth'   };
    if (a === 'POST')           return { color:'#10b981', bg:'rgba(16,185,129,0.12)', icon:'plus-circle',   label:'Created', category:'create' };
    if (a === 'PUT' || a === 'PATCH') return { color:'#3b82f6', bg:'rgba(59,130,246,0.12)', icon:'pencil', label:'Updated', category:'update' };
    if (a === 'DELETE')         return { color:'#f59e0b', bg:'rgba(245,158,11,0.12)', icon:'trash-2',       label:'Deleted', category:'delete' };
    if (a.startsWith('ERROR'))  return { color:'#ef4444', bg:'rgba(239,68,68,0.12)',  icon:'alert-triangle',label:'Error',   category:'error'  };
    return                             { color:'var(--text-muted)', bg:'rgba(107,114,128,0.08)', icon:'activity', label:action, category:'other' };
}

function _strColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    const colors = ['#6366f1','#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#f59e0b','#84cc16'];
    return colors[Math.abs(h) % colors.length];
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;','`':'&#96;'}[c]));
}

function _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ── Init on tab navigation ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Fetch stats immediately for the badge counters
    _fetchLogStats();

    // Listen for tab switch
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-tab]');
        if (link && link.getAttribute('data-tab') === 'logs') {
            setTimeout(() => {
                _logState.offset = 0;
                _logState.type   = 'all';
                document.getElementById('systemLogsBody').innerHTML = '';
                // Reset pill UI
                document.querySelectorAll('#logsTab .filter-pill').forEach(p => p.classList.remove('active'));
                const allPill = document.querySelector('#logsTab .filter-pill[data-log-type="all"]');
                if (allPill) allPill.classList.add('active');
                fetchSystemLogs(true);
                _fetchLogStats();
            }, 80);
        }
    });
});

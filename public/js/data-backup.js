/* ==========================================================================
 * EDF Portal — Data, Backup, Restore & Clean Start Center (Full CRUD)
 * ========================================================================== */

const _dbkState = {
    overview: null,
    snapshots: [],
    totalSnapshots: 0,
    page: 1,
    limit: 6,
    totalPages: 1,
    q: '',
    typeFilter: 'all',
    sort: 'newest',
    activeInspectId: null,
    activeRestoreSnap: null,
    activePurgeModKey: null,
    uploadFile: null
};

function escapeDbkHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDbkBytes(bytes) {
    const b = Number(bytes || 0);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDbkDate(ts) {
    if (!ts) return '—';
    const isoLike = String(ts).includes('T') ? String(ts) : String(ts).replace(' ', 'T') + 'Z';
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return escapeDbkHtml(String(ts));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function _dbkSetIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function _dbkRefreshAppCaches() {
    const refreshers = [
        'fetchStats',
        'fetchMembers',
        'fetchBeneficiaries',
        'fetchFamilies',
        'fetchVolunteers',
        'fetchSubscriptions',
        'fetchInventory',
        'fetchMadrasaWorkspace',
        'fetchSmsWorkspace'
    ];
    for (const fn of refreshers) {
        try {
            if (typeof window[fn] === 'function') await window[fn]();
        } catch (_) {}
    }
    if (typeof loadSettings === 'function') {
        try { loadSettings(); } catch (_) {}
    }
    await loadDataBackupWorkspace();
}

/* ── 1. Workspace Loader & Telemetry ─────────────────────────────────────── */
async function loadDataBackupWorkspace() {
    try {
        const params = new URLSearchParams({
            q: _dbkState.q || '',
            type: _dbkState.typeFilter || 'all',
            sort: _dbkState.sort || 'newest',
            page: String(_dbkState.page || 1),
            limit: String(_dbkState.limit || 6)
        });
        const [ovRes, listRes] = await Promise.all([
            fetch('/api/backups/overview'),
            fetch(`/api/backups?${params.toString()}`)
        ]);
        if (ovRes.ok) {
            _dbkState.overview = await ovRes.json();
            _dbkRenderOverview();
        }
        if (listRes.ok) {
            const listData = await listRes.json();
            _dbkState.snapshots = Array.isArray(listData.snapshots) ? listData.snapshots : [];
            _dbkState.totalSnapshots = Number(listData.total || 0);
            _dbkState.page = Number(listData.page || 1);
            _dbkState.totalPages = Number(listData.totalPages || 1);
            _dbkRenderVault();
        }
    } catch (err) {
        console.error('loadDataBackupWorkspace error:', err);
    }
}

function _dbkRenderOverview() {
    const ov = _dbkState.overview;
    if (!ov) return;

    const db = ov.database || {};
    const tot = ov.totals || {};
    const sn = ov.snapshots || {};

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    setTxt('dbkKpiTotalRows', Number(tot.totalRows || 0).toLocaleString());
    setTxt('dbkKpiRowsSub', `Operational: ${Number(tot.operationalRows || 0).toLocaleString()} · Logs: ${Number(tot.logRows || 0).toLocaleString()}`);

    setTxt('dbkKpiDbSize', formatDbkBytes(db.totalDiskBytes || db.sizeBytes || 0));
    setTxt('dbkKpiDbSub', `SQLite v${db.sqliteVersion || '?'} · ${db.tablesCount || 0} live tables`);

    setTxt('dbkKpiSnapCount', String(Number(sn.count || 0)));
    setTxt('dbkKpiSnapSub', `${formatDbkBytes(sn.totalBytes || 0)} vault · ${Number(sn.lockedCount || 0)} locked`);

    const lastTs = sn.lastBackupTimestamp || (sn.lastCreatedAt ? Date.parse(sn.lastCreatedAt.replace(' ', 'T') + 'Z') : null);
    if (lastTs && !Number.isNaN(lastTs)) {
        localStorage.setItem('edf-last-backup', String(lastTs));
        const d = new Date(lastTs);
        setTxt('dbkKpiLastTime', d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
        setTxt('dbkKpiLastSub', `At ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
    } else {
        setTxt('dbkKpiLastTime', 'No Backup');
        setTxt('dbkKpiLastSub', 'Create first snapshot now');
    }

    if (typeof updateLastBackupStatus === 'function') updateLastBackupStatus();
    if (typeof syncSettingsHeroPills === 'function') syncSettingsHeroPills();

    const journalChip = document.getElementById('dbkJournalChip');
    if (journalChip) journalChip.textContent = `Journal: ${String(db.journalMode || 'delete').toUpperCase()}`;

    const opCleanLbl = document.getElementById('dbkCleanOperationalBadge');
    if (opCleanLbl) opCleanLbl.textContent = `${Number(tot.operationalRows || 0).toLocaleString()} operational rows live`;

    _dbkRenderModulesGrid(ov.modules || []);
}

function _dbkRenderModulesGrid(modules) {
    const grid = document.getElementById('dbkModulesGrid');
    if (!grid) return;

    grid.innerHTML = modules.map(m => {
        const cnt = Number(m.rowCount || 0);
        const primaryTable = (m.tables && m.tables[0]) || '';
        const disExport = !primaryTable || cnt === 0 ? 'disabled' : '';
        const canPurge = m.purgeable && cnt > 0;
        return `
            <div class="export-module-card dbk-mod-card">
                <div class="dbk-mod-left">
                    <div class="dbk-mod-ico" style="background:${escapeDbkHtml(m.color)}1a; color:${escapeDbkHtml(m.color)};">
                        <i data-lucide="${escapeDbkHtml(m.icon || 'database')}" style="width:16px;height:16px;"></i>
                    </div>
                    <div style="min-width:0;">
                        <div class="dbk-mod-title">
                            <span>${escapeDbkHtml(m.label)}</span>
                            <span class="dbk-mod-count ${cnt === 0 ? 'is-zero' : ''}">${cnt.toLocaleString()} row${cnt === 1 ? '' : 's'}</span>
                        </div>
                        <div class="dbk-mod-desc" title="${escapeDbkHtml(m.desc)}">${escapeDbkHtml(m.tables.length)} table${m.tables.length === 1 ? '' : 's'} · ${escapeDbkHtml(m.desc)}</div>
                    </div>
                </div>
                <div class="dbk-mod-btns">
                    <button type="button" class="dbk-mini-btn" ${disExport} onclick="exportModule('${escapeDbkHtml(m.key)}', 'csv')" title="Download CSV (${escapeDbkHtml(primaryTable)})">
                        <i data-lucide="file-spreadsheet" style="width:12px;height:12px;"></i> CSV
                    </button>
                    <button type="button" class="dbk-mini-btn" ${disExport} onclick="exportModule('${escapeDbkHtml(m.key)}', 'json')" title="Download Module JSON">
                        <i data-lucide="braces" style="width:12px;height:12px;"></i> JSON
                    </button>
                    ${m.purgeable ? `
                    <button type="button" class="dbk-mini-btn is-purge" ${canPurge ? '' : 'disabled'} onclick="openPurgeModuleModal('${escapeDbkHtml(m.key)}')" title="Clear all records in ${escapeDbkHtml(m.label)}">
                        <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
    _dbkSetIcons();
}

/* ── 2. Snapshot Vault Table CRUD Render & Filters ───────────────────────── */
function dbkVaultFilterChanged() {
    _dbkState.q = document.getElementById('dbkVaultSearch')?.value || '';
    _dbkState.typeFilter = document.getElementById('dbkVaultTypeFilter')?.value || 'all';
    _dbkState.sort = document.getElementById('dbkVaultSort')?.value || 'newest';
    _dbkState.page = 1;
    loadDataBackupWorkspace();
}

function dbkVaultGoPage(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 1) return;
    _dbkState.page = n;
    loadDataBackupWorkspace();
}

function _dbkRenderVault() {
    const tbody = document.getElementById('dbkVaultBody');
    const emptyEl = document.getElementById('dbkVaultEmpty');
    const tblWrap = document.getElementById('dbkVaultTableWrap');
    const infoEl = document.getElementById('dbkVaultPageInfo');
    const btnsEl = document.getElementById('dbkVaultPgBtns');

    const snaps = _dbkState.snapshots || [];
    const total = _dbkState.totalSnapshots;

    if (!snaps.length) {
        if (tblWrap) tblWrap.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (tbody) tbody.innerHTML = '';
        if (infoEl) infoEl.textContent = '0 snapshots in vault';
        if (btnsEl) btnsEl.innerHTML = '';
        _dbkSetIcons();
        return;
    }

    if (tblWrap) tblWrap.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const typeLabelMap = {
        manual: 'Manual Snapshot',
        imported: 'Imported JSON',
        pre_restore: 'Pre-Restore Safety',
        pre_clean: 'Pre-Clean Safety'
    };

    if (tbody) {
        tbody.innerHTML = snaps.map(s => {
            const typeKey = escapeDbkHtml(s.backup_type || 'manual');
            const typeLbl = typeLabelMap[s.backup_type] || 'Snapshot';
            const locked = Number(s.is_locked) === 1;
            const shortSha = String(s.checksum || '').slice(0, 10);
            return `
                <tr>
                    <td style="min-width:220px;">
                        <div class="dbk-snap-title">
                            <span>${escapeDbkHtml(s.name)}</span>
                            ${locked ? `<span class="dbk-lock-badge" title="Retention Locked"><i data-lucide="lock" style="width:10px;height:10px;"></i> Locked</span>` : ''}
                        </div>
                        ${s.notes ? `<div class="dbk-snap-notes">${escapeDbkHtml(s.notes)}</div>` : ''}
                        <div class="dbk-snap-meta">
                            <span>#${escapeDbkHtml(s.uid)}</span>
                            <span>· sha256:${escapeDbkHtml(shortSha)}</span>
                        </div>
                    </td>
                    <td>
                        <span class="dbk-type-pill dbk-type-${typeKey}">${escapeDbkHtml(typeLbl)}</span>
                        <div style="font-size:0.69rem; color:var(--text-muted); margin-top:3px; text-transform:capitalize;">${escapeDbkHtml(s.scope || 'full')} · ${escapeDbkHtml(s.created_by || 'admin')}</div>
                    </td>
                    <td style="white-space:nowrap;">
                        <div style="font-weight:800; font-variant-numeric:tabular-nums;">${Number(s.total_rows || 0).toLocaleString()} rows</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">${Number(s.tables_count || 0)} tables · ${formatDbkBytes(s.file_size || 0)}</div>
                    </td>
                    <td style="white-space:nowrap; font-size:0.75rem; color:var(--text-muted);">
                        ${formatDbkDate(s.created_at)}
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                        <div class="dbk-row-actions">
                            <button type="button" class="dbk-act-btn" onclick="openInspectBackupModal(${s.id})" title="Inspect Tables &amp; Sample Data">
                                <i data-lucide="eye" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="dbk-act-btn is-restore" onclick="openRestoreBackupModal(${s.id})" title="Restore From Snapshot">
                                <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="dbk-act-btn" onclick="openEditBackupModal(${s.id})" title="Edit Name, Notes or Lock">
                                <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="dbk-act-btn" onclick="downloadBackupSnapshot(${s.id})" title="Download JSON Archive">
                                <i data-lucide="download" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="dbk-act-btn is-delete" onclick="deleteBackupSnapshot(${s.id})" title="${locked ? 'Unlock to Delete' : 'Delete Snapshot'}">
                                <i data-lucide="${locked ? 'lock' : 'trash-2'}" style="width:14px;height:14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    const start = ((_dbkState.page - 1) * _dbkState.limit) + 1;
    const end = Math.min(_dbkState.page * _dbkState.limit, total);
    if (infoEl) infoEl.textContent = `Showing ${start}–${end} of ${total} saved snapshot${total === 1 ? '' : 's'}`;

    if (btnsEl) {
        const tp = _dbkState.totalPages;
        const cp = _dbkState.page;
        let html = `<button type="button" class="dbk-pg-btn" ${cp <= 1 ? 'disabled' : ''} onclick="dbkVaultGoPage(${cp - 1})">&lsaquo;</button>`;
        for (let i = 1; i <= tp; i++) {
            if (tp <= 7 || i === 1 || i === tp || Math.abs(i - cp) <= 1) {
                html += `<button type="button" class="dbk-pg-btn ${i === cp ? 'active' : ''}" onclick="dbkVaultGoPage(${i})">${i}</button>`;
            }
        }
        html += `<button type="button" class="dbk-pg-btn" ${cp >= tp ? 'disabled' : ''} onclick="dbkVaultGoPage(${cp + 1})">&rsaquo;</button>`;
        btnsEl.innerHTML = html;
    }

    _dbkSetIcons();
}

/* ── 3. CREATE Snapshot CRUD ─────────────────────────────────────────────── */
function openCreateBackupModal() {
    const nowStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const nameEl = document.getElementById('bkpCreateName');
    const notesEl = document.getElementById('bkpCreateNotes');
    const scopeEl = document.getElementById('bkpCreateScope');
    const lockEl = document.getElementById('bkpCreateLocked');

    if (nameEl) nameEl.value = `EDF Backup — ${nowStr}`;
    if (notesEl) notesEl.value = '';
    if (scopeEl) scopeEl.value = 'full';
    if (lockEl) lockEl.checked = false;

    _bkpRenderCreateModuleGrid();
    bkpCreateScopeChanged();
    openModal('bkpCreateModal');
    _dbkSetIcons();
}

function _bkpRenderCreateModuleGrid() {
    const grid = document.getElementById('bkpCreateModuleGrid');
    if (!grid) return;
    const mods = _dbkState.overview?.modules || [];
    grid.innerHTML = mods.map(m => `
        <div class="bkp-check-item">
            <label>
                <input type="checkbox" name="bkpCreateMod" value="${escapeDbkHtml(m.key)}" checked>
                <span>${escapeDbkHtml(m.label)}</span>
            </label>
            <span class="dbk-mod-count ${Number(m.rowCount) === 0 ? 'is-zero' : ''}">${Number(m.rowCount || 0).toLocaleString()}</span>
        </div>
    `).join('');
}

function bkpCreateScopeChanged() {
    const scope = document.getElementById('bkpCreateScope')?.value || 'full';
    const wrap = document.getElementById('bkpCreateModulesWrap');
    const mods = _dbkState.overview?.modules || [];
    const opSet = new Set(mods.filter(m => m.category === 'operational').map(m => m.key));

    document.querySelectorAll('input[name="bkpCreateMod"]').forEach(cb => {
        if (scope === 'full') cb.checked = true;
        else if (scope === 'operational') cb.checked = opSet.has(cb.value);
    });
    if (wrap) wrap.style.display = scope === 'custom' ? 'block' : 'none';
}

async function submitCreateBackup(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('bkpCreateSubmitBtn');
    const name = document.getElementById('bkpCreateName')?.value.trim();
    const notes = document.getElementById('bkpCreateNotes')?.value.trim() || '';
    const scope = document.getElementById('bkpCreateScope')?.value || 'full';
    const isLocked = !!document.getElementById('bkpCreateLocked')?.checked;

    const selectedMods = scope === 'custom'
        ? Array.from(document.querySelectorAll('input[name="bkpCreateMod"]:checked')).map(c => c.value)
        : null;

    if (scope === 'custom' && (!selectedMods || !selectedMods.length)) {
        showToast('Select at least one module for custom backup', 'warning');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Creating Snapshot...'; }
    try {
        const res = await fetch('/api/backups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, notes, scope, modules: selectedMods, is_locked: isLocked })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create backup');
        closeModal('bkpCreateModal');
        showToast(`Snapshot "${data.snapshot?.name || name}" created (${Number(data.snapshot?.total_rows || 0).toLocaleString()} rows)`, 'success');
        await loadDataBackupWorkspace();
    } catch (err) {
        showToast(err.message || 'Backup creation failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Save Backup Snapshot'; _dbkSetIcons(); }
    }
}

/* ── Quick Full Backup + Download JSON (preserves runFullBackup() CTA) ─── */
async function runFullBackup() {
    const btn = document.getElementById('fullBackupBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Backing up...'; _dbkSetIcons(); }
    showToast('Creating full server snapshot & preparing download...', 'info');
    try {
        const res = await fetch('/api/backups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `Quick Full Backup — ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
                notes: 'Full JSON snapshot triggered from Settings Quick Backup',
                scope: 'full'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Full backup failed');

        if (data.snapshot?.id) {
            downloadBackupSnapshot(data.snapshot.id);
        }
        await loadDataBackupWorkspace();
        showToast('Full backup saved to Vault & downloaded!', 'success');
    } catch (err) {
        showToast('Backup failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="download"></i> Snapshot &amp; Download JSON'; _dbkSetIcons(); }
    }
}

/* ── 4. UPDATE Snapshot Metadata CRUD ────────────────────────────────────── */
function openEditBackupModal(id) {
    const snap = (_dbkState.snapshots || []).find(s => Number(s.id) === Number(id));
    if (!snap) return;
    document.getElementById('bkpEditId').value = String(snap.id);
    document.getElementById('bkpEditName').value = snap.name || '';
    document.getElementById('bkpEditNotes').value = snap.notes || '';
    document.getElementById('bkpEditLocked').checked = Number(snap.is_locked) === 1;
    openModal('bkpEditModal');
    _dbkSetIcons();
}

async function submitEditBackup(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('bkpEditId')?.value;
    const name = document.getElementById('bkpEditName')?.value.trim();
    const notes = document.getElementById('bkpEditNotes')?.value.trim() || '';
    const isLocked = !!document.getElementById('bkpEditLocked')?.checked;

    if (!name) {
        showToast('Snapshot name is required', 'warning');
        return;
    }

    try {
        const res = await fetch(`/api/backups/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, notes, is_locked: isLocked })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Update failed');
        closeModal('bkpEditModal');
        showToast('Snapshot metadata updated', 'success');
        await loadDataBackupWorkspace();
    } catch (err) {
        showToast(err.message || 'Failed to update snapshot', 'error');
    }
}

/* ── 5. READ / INSPECT Snapshot Modal ────────────────────────────────────── */
async function openInspectBackupModal(id, tableName = null) {
    _dbkState.activeInspectId = id;
    const body = document.getElementById('bkpInspectBody');
    const titleEl = document.getElementById('bkpInspectTitle');
    const subEl = document.getElementById('bkpInspectSub');
    if (body) body.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Reading archive checksum &amp; table structures...</div>';

    openModal('bkpInspectModal');
    _dbkSetIcons();

    try {
        const q = tableName ? `?table=${encodeURIComponent(tableName)}` : '';
        const res = await fetch(`/api/backups/${id}${q}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to inspect backup');

        const s = data.snapshot;
        if (titleEl) titleEl.textContent = s.name;
        if (subEl) subEl.textContent = `${s.uid} · ${s.tables_count} tables · ${Number(s.total_rows || 0).toLocaleString()} rows · ${formatDbkBytes(s.file_size)}`;

        const dlBtn = document.getElementById('bkpInspectDlBtn');
        if (dlBtn) dlBtn.onclick = () => downloadBackupSnapshot(s.id);
        const rstBtn = document.getElementById('bkpInspectRestoreBtn');
        if (rstBtn) rstBtn.onclick = () => { closeModal('bkpInspectModal'); openRestoreBackupModal(s.id); };

        const tblRows = (data.tableSummaries || []).map(t => `
            <tr style="cursor:pointer; ${t.table === data.previewTable ? 'background:rgba(16,185,129,0.1);' : ''}" onclick="openInspectBackupModal(${s.id}, '${escapeDbkHtml(t.table)}')">
                <td style="font-family:monospace; font-weight:700;">${escapeDbkHtml(t.table)}</td>
                <td style="text-align:right; font-weight:800; font-variant-numeric:tabular-nums;">${Number(t.rows).toLocaleString()}</td>
                <td style="text-align:right;"><span class="dbk-mini-btn">Preview</span></td>
            </tr>
        `).join('');

        if (body) {
            body.innerHTML = `
                <div style="display:flex; flex-wrap:wrap; gap:0.45rem;">
                    <span class="dbk-chip ok">Format: ${escapeDbkHtml(data.format)}</span>
                    <span class="dbk-chip">SHA-256: ${escapeDbkHtml(String(s.checksum || '').slice(0, 18))}…</span>
                    <span class="dbk-chip">Created: ${formatDbkDate(s.created_at)}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1.25fr; gap:0.85rem;">
                    <div class="dbk-table-wrap" style="max-height:290px;">
                        <table class="dbk-table">
                            <thead><tr><th>Table Name</th><th style="text-align:right;">Rows</th><th></th></tr></thead>
                            <tbody>${tblRows || '<tr><td colspan="3">Empty archive</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.45rem;">
                        <div style="font-size:0.75rem; font-weight:800; color:var(--text-main);">
                            Preview: <span style="font-family:monospace; color:#059669;">${escapeDbkHtml(data.previewTable || 'None')}</span>
                            (${(data.previewRows || []).length} sample row${(data.previewRows || []).length === 1 ? '' : 's'})
                        </div>
                        <pre class="bkp-preview-pre">${escapeDbkHtml(JSON.stringify(data.previewRows || [], null, 2))}</pre>
                    </div>
                </div>
            `;
        }
        _dbkSetIcons();
    } catch (err) {
        if (body) body.innerHTML = `<div style="padding:1.5rem; color:#ef4444; font-weight:700;">${escapeDbkHtml(err.message)}</div>`;
    }
}

/* ── 6. RESTORE From Snapshot CRUD ───────────────────────────────────────── */
async function openRestoreBackupModal(id) {
    const snap = (_dbkState.snapshots || []).find(s => Number(s.id) === Number(id));
    if (!snap) return;
    _dbkState.activeRestoreSnap = snap;

    document.getElementById('bkpRestoreId').value = String(snap.id);
    document.getElementById('bkpRestoreTitle').textContent = `Restore: ${snap.name}`;
    document.getElementById('bkpRestoreSub').textContent = `${Number(snap.total_rows || 0).toLocaleString()} rows across ${snap.tables_count} tables · Created ${formatDbkDate(snap.created_at)}`;
    document.getElementById('bkpRestoreMode').value = 'replace';
    document.getElementById('bkpRestoreSafety').checked = true;
    document.getElementById('bkpRestoreConfirmInput').value = '';

    const grid = document.getElementById('bkpRestoreModuleGrid');
    const allMods = _dbkState.overview?.modules || [];
    const snapMods = new Set(snap.includes || []);
    const countsObj = snap.tableCounts || {};

    if (grid) {
        grid.innerHTML = allMods.map(m => {
            const snapRowsInMod = (m.tables || []).reduce((acc, t) => acc + Number(countsObj[t] || 0), 0);
            const hasInSnap = snapMods.has(m.key) || (m.tables || []).some(t => Object.prototype.hasOwnProperty.call(countsObj, t));
            return `
                <div class="bkp-check-item" style="${!hasInSnap ? 'opacity:0.45;' : ''}">
                    <label>
                        <input type="checkbox" name="bkpRestoreMod" value="${escapeDbkHtml(m.key)}" ${hasInSnap ? 'checked' : 'disabled'}>
                        <span>${escapeDbkHtml(m.label)}</span>
                    </label>
                    <span class="dbk-mod-count ${snapRowsInMod === 0 ? 'is-zero' : ''}">${snapRowsInMod.toLocaleString()}</span>
                </div>
            `;
        }).join('');
    }

    bkpRestoreModeChanged();
    openModal('bkpRestoreModal');
    _dbkSetIcons();
}

function bkpRestoreSelectPreset(kind) {
    const mods = _dbkState.overview?.modules || [];
    const opSet = new Set(mods.filter(m => m.category === 'operational').map(m => m.key));
    document.querySelectorAll('input[name="bkpRestoreMod"]:not(:disabled)').forEach(cb => {
        cb.checked = kind === 'all' ? true : (kind === 'operational' ? opSet.has(cb.value) : false);
    });
}

function bkpRestoreModeChanged() {
    const mode = document.getElementById('bkpRestoreMode')?.value || 'replace';
    const confirmBox = document.getElementById('bkpRestoreConfirmWrap');
    if (confirmBox) confirmBox.style.display = mode === 'replace' ? 'block' : 'none';
    bkpCheckRestoreConfirm();
}

function bkpCheckRestoreConfirm() {
    const mode = document.getElementById('bkpRestoreMode')?.value || 'replace';
    const val = (document.getElementById('bkpRestoreConfirmInput')?.value || '').trim();
    const btn = document.getElementById('bkpRestoreExecBtn');
    const ok = mode === 'merge' || val === 'RESTORE BACKUP';
    if (btn) btn.disabled = !ok;
}

async function submitRestoreBackup(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('bkpRestoreId')?.value;
    const mode = document.getElementById('bkpRestoreMode')?.value || 'replace';
    const createSafety = !!document.getElementById('bkpRestoreSafety')?.checked;
    const confirmPhrase = (document.getElementById('bkpRestoreConfirmInput')?.value || '').trim();
    const modules = Array.from(document.querySelectorAll('input[name="bkpRestoreMod"]:checked')).map(c => c.value);

    if (!modules.length) {
        showToast('Select at least one module to restore', 'warning');
        return;
    }

    const btn = document.getElementById('bkpRestoreExecBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Restoring Database...'; }
    try {
        const res = await fetch(`/api/backups/${id}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modules,
                mode,
                create_safety_backup: createSafety,
                confirm_phrase: confirmPhrase
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Restore failed');
        closeModal('bkpRestoreModal');
        showToast(data.message || 'Backup restored successfully', 'success');
        await _dbkRefreshAppCaches();
    } catch (err) {
        showToast(err.message || 'Restore failed', 'error');
        bkpCheckRestoreConfirm();
    } finally {
        if (btn) { btn.innerHTML = '<i data-lucide="rotate-ccw"></i> Execute Restore'; _dbkSetIcons(); bkpCheckRestoreConfirm(); }
    }
}

/* ── 7. UPLOAD External JSON Backup Modal ────────────────────────────────── */
function openUploadBackupModal() {
    _dbkState.uploadFile = null;
    const fileEl = document.getElementById('bkpUploadFileInput');
    if (fileEl) fileEl.value = '';
    const nameEl = document.getElementById('bkpUploadName');
    if (nameEl) nameEl.value = '';
    const prevEl = document.getElementById('bkpUploadPreview');
    if (prevEl) prevEl.style.display = 'none';
    const subBtn = document.getElementById('bkpUploadSubmitBtn');
    if (subBtn) subBtn.disabled = true;
    openModal('bkpUploadModal');
    _dbkSetIcons();
}

async function handleBkpUploadFileSelected(file) {
    if (!file) return;
    _dbkState.uploadFile = file;
    const nameEl = document.getElementById('bkpUploadName');
    const prevEl = document.getElementById('bkpUploadPreview');
    const subBtn = document.getElementById('bkpUploadSubmitBtn');

    try {
        const txt = await file.text();
        const parsed = JSON.parse(txt);
        const tables = parsed.tables && typeof parsed.tables === 'object' ? parsed.tables : parsed;
        const keys = Object.keys(tables).filter(k => Array.isArray(tables[k]));
        const rows = keys.reduce((s, k) => s + tables[k].length, 0);

        if (!keys.length) throw new Error('No table arrays found in JSON');

        if (nameEl && !nameEl.value.trim()) {
            nameEl.value = parsed.name || `Imported: ${file.name.replace(/\.json$/i, '')}`;
        }
        if (prevEl) {
            prevEl.style.display = 'block';
            prevEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <strong>${escapeDbkHtml(file.name)} (${formatDbkBytes(file.size)})</strong>
                    <span class="dbk-chip ok">${keys.length} tables · ${rows.toLocaleString()} rows ready</span>
                </div>
            `;
        }
        if (subBtn) subBtn.disabled = false;
    } catch (err) {
        _dbkState.uploadFile = null;
        if (prevEl) {
            prevEl.style.display = 'block';
            prevEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">Invalid JSON backup file: ${escapeDbkHtml(err.message)}</span>`;
        }
        if (subBtn) subBtn.disabled = true;
    }
}

async function submitUploadBackup(openRestoreAfter = false) {
    if (!_dbkState.uploadFile) {
        showToast('Select a valid .json backup file first', 'warning');
        return;
    }
    const fd = new FormData();
    fd.append('file', _dbkState.uploadFile);
    fd.append('name', document.getElementById('bkpUploadName')?.value.trim() || '');
    fd.append('notes', document.getElementById('bkpUploadNotes')?.value.trim() || '');

    const btn = document.getElementById('bkpUploadSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
    try {
        const res = await fetch('/api/backups/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        closeModal('bkpUploadModal');
        showToast(`Imported "${data.snapshot?.name || 'backup'}" into Vault`, 'success');
        await loadDataBackupWorkspace();
        if (openRestoreAfter && data.snapshot?.id) {
            openRestoreBackupModal(data.snapshot.id);
        }
    } catch (err) {
        showToast(err.message || 'Upload failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="upload"></i> Import to Vault'; _dbkSetIcons(); }
    }
}

/* ── 8. DELETE & DOWNLOAD & BINARY EXPORT & MAINTENANCE ──────────────────── */
function downloadBackupSnapshot(id) {
    window.location.href = `/api/backups/${id}/download`;
}

function downloadSqliteBinary() {
    window.location.href = '/api/backups/export/sqlite';
    showToast('Downloading atomic SQLite binary database (.sqlite)', 'info');
}

async function deleteBackupSnapshot(id) {
    const snap = (_dbkState.snapshots || []).find(s => Number(s.id) === Number(id));
    if (snap && Number(snap.is_locked) === 1) {
        showToast('This snapshot is retention-locked. Click Edit to unlock it before deleting.', 'warning');
        return;
    }
    if (!confirm(`Delete saved snapshot "${snap?.name || '#' + id}" permanently from disk?`)) return;

    try {
        const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete snapshot');
        showToast('Backup snapshot deleted', 'success');
        await loadDataBackupWorkspace();
    } catch (err) {
        showToast(err.message || 'Failed to delete snapshot', 'error');
    }
}

async function runDbMaintenance(action = 'both') {
    const btn = document.getElementById('dbkMaintBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Optimizing…'; _dbkSetIcons(); }
    try {
        const res = await fetch('/api/backups/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Maintenance failed');
        const chip = document.getElementById('dbkIntegrityChip');
        if (chip) chip.innerHTML = `<i data-lucide="shield-check" style="width:11px;height:11px;"></i> Integrity: ${escapeDbkHtml(String(data.integrity).toUpperCase())}`;
        showToast(`${data.message} · Reclaimed ${formatDbkBytes(data.reclaimedBytes || 0)}`, 'success');
        await loadDataBackupWorkspace();
    } catch (err) {
        showToast(err.message || 'Maintenance failed', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="wrench"></i> Verify &amp; Vacuum DB'; _dbkSetIcons(); }
    }
}

/* ── 9. Per-Module Export & Selective Purge ──────────────────────────────── */
async function exportModule(type, format = 'csv') {
    const mods = _dbkState.overview?.modules || [];
    const mod = mods.find(m => m.key === type);
    const tblMap = {
        members: 'members',
        beneficiaries: 'beneficiaries',
        families: 'families',
        volunteers: 'volunteers',
        subscriptions: 'subscriptions',
        transactions: 'transactions',
        'external-donations': 'external_donations'
    };
    const primaryTbl = mod?.tables?.[0] || tblMap[type] || type;
    if (format === 'json' || format === 'csv') {
        window.location.href = `/api/backups/export/table/${encodeURIComponent(primaryTbl)}?format=${format}`;
        showToast(`Exporting ${primaryTbl} as ${format.toUpperCase()}`, 'info');
    }
}

function openPurgeModuleModal(modKey) {
    const mod = (_dbkState.overview?.modules || []).find(m => m.key === modKey);
    if (!mod) return;
    _dbkState.activePurgeModKey = modKey;
    document.getElementById('bkpPurgeModTitle').textContent = `Clear ${mod.label}`;
    document.getElementById('bkpPurgeModSub').textContent = `Will permanently clear ${Number(mod.rowCount || 0).toLocaleString()} rows across ${mod.tables.join(', ')}`;
    document.getElementById('bkpPurgeConfirmInput').value = '';
    document.getElementById('bkpPurgeSafety').checked = true;
    document.getElementById('bkpPurgeExecBtn').disabled = true;
    openModal('bkpPurgeModuleModal');
    _dbkSetIcons();
}

function bkpCheckPurgeConfirm() {
    const ok = (document.getElementById('bkpPurgeConfirmInput')?.value || '').trim() === 'CLEAR MODULE';
    const btn = document.getElementById('bkpPurgeExecBtn');
    if (btn) btn.disabled = !ok;
}

async function submitPurgeModule(e) {
    if (e) e.preventDefault();
    const modKey = _dbkState.activePurgeModKey;
    if (!modKey) return;
    const createSafety = !!document.getElementById('bkpPurgeSafety')?.checked;
    const btn = document.getElementById('bkpPurgeExecBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Clearing…'; }
    try {
        const res = await fetch(`/api/backups/purge-module/${encodeURIComponent(modKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm_phrase: 'CLEAR MODULE', create_safety_backup: createSafety })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to clear module');
        closeModal('bkpPurgeModuleModal');
        showToast(data.message, 'success');
        await _dbkRefreshAppCaches();
    } catch (err) {
        showToast(err.message || 'Module purge failed', 'error');
    } finally {
        if (btn) { btn.innerHTML = '<i data-lucide="trash-2"></i> Clear Module'; _dbkSetIcons(); bkpCheckPurgeConfirm(); }
    }
}

/* ── 10. Upgraded Clean Start Factory Reset Wizard (#clearDataModal) ─────── */
function openClearDataModal() {
    cldGoStep1();
    openModal('clearDataModal');
}

function cldGoStep1() {
    document.getElementById('clearDataStep1').style.display = '';
    document.getElementById('clearDataStep2').style.display = 'none';
    document.getElementById('clearDataStep3').style.display = 'none';
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    setChk('cldIncludeOperational', true);
    setChk('cldIncludeDocs', true);
    setChk('cldIncludeLogs', true);
    setChk('cldIncludeSmsConfig', false);
    setChk('cldIncludeCms', false);
    setChk('cldIncludeUsers', false);
    setChk('cldCreateSafety', true);

    const ov = _dbkState.overview;
    const badge = document.getElementById('cldLiveSummaryChip');
    if (badge && ov?.totals) {
        badge.textContent = `${Number(ov.totals.operationalRows || 0).toLocaleString()} operational · ${Number(ov.totals.logRows || 0).toLocaleString()} logs live`;
    }
    _dbkSetIcons();
}

function cldGoStep2() {
    document.getElementById('clearDataStep1').style.display = 'none';
    document.getElementById('clearDataStep2').style.display = '';
    document.getElementById('clearDataStep3').style.display = 'none';
    document.getElementById('cldConfirmInput').value = '';
    document.getElementById('cldConfirmHint').textContent = '';
    const btn = document.getElementById('cldExecuteBtn');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
    }
    setTimeout(() => document.getElementById('cldConfirmInput')?.focus(), 80);
    _dbkSetIcons();
}

function cldCheckConfirm() {
    const val = (document.getElementById('cldConfirmInput')?.value || '').trim();
    const btn = document.getElementById('cldExecuteBtn');
    const hint = document.getElementById('cldConfirmHint');
    const ok = val === 'CLEAR ALL DATA';
    if (btn) {
        btn.disabled = !ok;
        btn.style.opacity = ok ? '1' : '0.4';
        btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
    if (hint) {
        if (val.length > 0 && !ok) {
            hint.textContent = 'Keep typing CLEAR ALL DATA…';
            hint.style.color = 'var(--text-muted)';
        } else if (ok) {
            hint.textContent = 'Confirmed — ready for Clean Start reset';
            hint.style.color = '#16a34a';
        } else {
            hint.textContent = '';
        }
    }
}

async function executeClearData() {
    const btn = document.getElementById('cldExecuteBtn');
    const isChk = (id, def = false) => {
        const el = document.getElementById(id);
        return el ? !!el.checked : def;
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Cleaning Database…';
        _dbkSetIcons();
    }

    try {
        const res = await fetch('/api/backups/clean-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                confirm_phrase: 'CLEAR ALL DATA',
                include_operational: isChk('cldIncludeOperational', true),
                include_documents: isChk('cldIncludeDocs', true),
                include_logs: isChk('cldIncludeLogs', true),
                include_sms_config: isChk('cldIncludeSmsConfig', false),
                include_cms: isChk('cldIncludeCms', false),
                include_non_admin_users: isChk('cldIncludeUsers', false),
                create_safety_backup: isChk('cldCreateSafety', true)
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Clean start failed');

        document.getElementById('clearDataStep2').style.display = 'none';
        document.getElementById('clearDataStep3').style.display = '';
        document.getElementById('cldResultMsg').textContent = data.message +
            (data.safetySnapshot ? ` Auto-saved safety snapshot: "${data.safetySnapshot.name}".` : '');

        const counts = data.counts || {};
        const rows = Object.entries(counts).filter(([, c]) => Number(c) > 0);
        const tbl = document.getElementById('cldResultTable');
        if (tbl) {
            if (rows.length) {
                tbl.style.display = '';
                tbl.innerHTML = rows.map(([k, c], i) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.9rem;${i > 0 ? 'border-top:1px solid var(--border-color);' : ''}font-size:0.8rem;">
                        <span style="color:var(--text-muted);font-family:monospace;">${escapeDbkHtml(k)}</span>
                        <span style="font-weight:700;color:#ef4444;">${Number(c).toLocaleString()} removed</span>
                    </div>`).join('');
            } else {
                tbl.style.display = 'none';
            }
        }
        _dbkSetIcons();
        await _dbkRefreshAppCaches();
    } catch (err) {
        showToast(err.message || 'Clean start failed', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="trash-2"></i> Execute Clean Start';
            _dbkSetIcons();
        }
    }
}

function cldDone() {
    closeModal('clearDataModal');
    if (typeof fetchStats === 'function') fetchStats();
}


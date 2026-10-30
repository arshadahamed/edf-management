// ═══════════════════════════════════════════════════════════════════════════
// RAMADAN TOKEN DISTRIBUTION MODULE  (campaign page, campaign modal, tokens console)
// Depends on globals from dashboard.html / dashboard.js: openModal, closeModal,
// showToast, lucide, XLSX
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared constants & helpers ──────────────────────────────────────────────

const RD_PKG = {
    dry_ration:   { label: 'Dry Ration Pack',    short: 'Dry Ration'   },
    cash_voucher: { label: 'Cash / Voucher',     short: 'Cash Voucher' },
    zakat_pack:   { label: 'Zakat Relief Pack',  short: 'Zakat Pack'   },
    iftar_kit:    { label: 'Iftar & Suhoor Kit', short: 'Iftar Kit'    },
    eid_gift:     { label: 'Eid Family Pack',    short: 'Eid Pack'     },
    mixed:        { label: 'Mixed Package',      short: 'Mixed'        },
};

const RD_STATUS_STYLE = {
    active:    'background:#d1fae5; color:#065f46;',
    completed: 'background:#e0f2fe; color:#0369a1;',
    cancelled: 'background:#fee2e2; color:#991b1b;',
};

const RD_TOKEN_STATUS = {
    collected: { badge: 'background:#d1fae5; color:#065f46;', label: 'Collected' },
    pending:   { badge: 'background:#fef3c7; color:#92400e;', label: 'Pending'   },
    absent:    { badge: 'background:#fee2e2; color:#991b1b;', label: 'Absent'    },
};

const RD_PRESETS = {
    dry_ration:   { title: y => `Ramadan ${y} – Dry Ration Relief`,     voucher: 10000, items: 'Rice 10kg, Wheat Flour 5kg, Sugar 3kg, Red Dhal 2kg, Cooking Oil 2L, Dates 1kg, Tea 500g' },
    zakat_pack:   { title: y => `Zakat Relief ${y}`,                    voucher: 15000, items: 'Zakat grant, Rice 10kg, Sugar 3kg, Cooking Oil 2L' },
    cash_voucher: { title: y => `Ramadan ${y} – Supermarket Voucher`,   voucher: 5000,  items: 'Supermarket voucher' },
    eid_gift:     { title: y => `Eid ul-Fitr ${y} – Family Pack`,       voucher: 7500,  items: 'Vermicelli & Spices, Milk Powder 400g, Sugar 3kg, Dates 1kg, Cooking Oil 2L' },
};

function _rdEl(id) { return document.getElementById(id); }
function _rdSet(id, v) { const e = _rdEl(id); if (e) e.textContent = v; }
function _rdEsc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _rdMoney(n) { return 'LKR ' + Number(n || 0).toLocaleString(); }
function _rdIsoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _rdParseDate(s) { return s ? new Date(String(s).split('T')[0] + 'T00:00:00') : null; }
function _rdFmtDate(s, opts) {
    const d = _rdParseDate(s);
    return d ? d.toLocaleDateString('en-GB', opts || { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function _rdHijriFromYear(y) { return Math.floor((Number(y) - 622) * 33 / 32); }
function _rdPkgLabel(t) { return (RD_PKG[t] || RD_PKG.dry_ration).label; }
function _rdPkgShort(t) { return (RD_PKG[t] || RD_PKG.dry_ration).short; }
function _rdPkgBadge(t) {
    const key = RD_PKG[t] ? t : 'dry_ration';
    return `<span class="rd-pkg-badge rd-pkg-${key}">${_rdEsc(_rdPkgShort(key))}</span>`;
}
function _rdDownload(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}
function _rdExportRows(rows, baseName, format, sheetName) {
    if (!rows.length) { showToast('Nothing to export', 'error'); return; }
    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Export').slice(0, 31));
        XLSX.writeFile(wb, `${baseName}.xlsx`);
    } else {
        const cols = Object.keys(rows[0]);
        const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
        _rdDownload(`${baseName}.csv`, new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    }
    showToast(`Exported ${rows.length} row(s)`, 'success');
}
function _rdPageButtons(current, totalPages, fnName, cls) {
    const btn = (p, label, disabled, active) =>
        `<button type="button" class="${cls}${active ? ' active' : ''}" ${disabled ? 'disabled' : ''} onclick="${fnName}(${p})">${label}</button>`;
    let out = btn(current - 1, '←', current === 1, false);
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - current) <= 2) pages.push(i);
    }
    let prev = 0;
    for (const p of pages) {
        if (p - prev > 1) out += `<span class="rd-page-ellipsis">…</span>`;
        out += btn(p, p, false, p === current);
        prev = p;
    }
    out += btn(current + 1, '→', current === totalPages, false);
    return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 1 — DISTRIBUTION CAMPAIGNS PAGE
// ═══════════════════════════════════════════════════════════════════════════

let ramadanDistData = [];
let _rdDistView      = 'table';
let _rdDistStatus    = 'all';
let _rdDistType      = 'all';
let _rdDistAdv       = { year: 'all', location: 'all', progress: 'all', schedule: 'all' };
let _rdDistSortCol   = 'year';
let _rdDistSortDir   = 'desc';
let _rdDistPage      = 1;
let _rdDistPageSize  = 10;
let _rdDistSelected  = new Set();

async function fetchRamadanDistributions() {
    try {
        const res = await fetch('/api/ramadan/distributions');
        if (!res.ok) throw new Error('Failed');
        ramadanDistData = await res.json();
        const ids = new Set(ramadanDistData.map(d => d.id));
        _rdDistSelected.forEach(id => { if (!ids.has(id)) _rdDistSelected.delete(id); });
        updateRamadanStats();
        populateRamadanDistFilterOptions();
        renderRamadanDistributions();
    } catch (err) { console.error(err); }
}

function _rdDistMetrics(d) {
    const total = d.total_tokens || 0, collected = d.collected_count || 0;
    const pending = d.pending_count || 0, absent = d.absent_count || 0;
    const voucher = Number(d.voucher_value) || 0;
    return {
        total, collected, pending, absent, voucher,
        pct: total ? Math.round((collected / total) * 100) : 0,
        budget: voucher * total,
        disbursed: voucher * collected,
        pendingVal: voucher * pending,
    };
}

function updateRamadanStats() {
    const data = ramadanDistData;
    const m = data.map(_rdDistMetrics);
    const sum = k => m.reduce((s, x) => s + x[k], 0);
    const totalTokens = sum('total'), collected = sum('collected');
    const eligible = data.length ? (data[0].eligible_active_count || 0) : 0;
    const venues = new Set(data.map(d => (d.collection_location || '').trim()).filter(Boolean)).size;
    const vouchers = data.map(d => Number(d.voucher_value) || 0).filter(v => v > 0);
    const rate = totalTokens ? Math.round((collected / totalTokens) * 100) : 0;

    _rdSet('rdStatTotal', data.length);
    _rdSet('rdStatActiveSub', `${data.filter(d => d.status === 'active').length} Active`);
    _rdSet('rdStatCompletedSub', `${data.filter(d => d.status === 'completed').length} Completed`);
    _rdSet('rdStatTokens', totalTokens);
    _rdSet('rdStatAvgTokensSub', `Avg: ${data.length ? Math.round(totalTokens / data.length) : 0} / dist`);
    _rdSet('rdStatEligibleSub', `${eligible} Eligible Active`);
    _rdSet('rdStatCollected', collected);
    _rdSet('rdStatRateChip', `${rate}% Rate`);
    _rdSet('rdStatDisbursedSub', `${_rdMoney(sum('disbursed'))} Disbursed`);
    const bar = _rdEl('rdStatMiniProgress'); if (bar) bar.style.width = rate + '%';
    _rdSet('rdStatPending', sum('pending'));
    _rdSet('rdStatAbsentSub', `${sum('absent')} Absent`);
    _rdSet('rdStatPendingValSub', `${_rdMoney(sum('pendingVal'))} Pending`);
    _rdSet('rdStatBudget', _rdMoney(sum('budget')));
    _rdSet('rdStatAvgVoucherSub', `Avg Pack: ${_rdMoney(vouchers.length ? Math.round(vouchers.reduce((a, b) => a + b, 0) / vouchers.length) : 0)}`);
    _rdSet('rdStatLocationsSub', `${venues} Venue${venues === 1 ? '' : 's'}`);

    _rdSet('rdDistCountAll', data.length);
    _rdSet('rdDistCountActive', data.filter(d => d.status === 'active').length);
    _rdSet('rdDistCountCompleted', data.filter(d => d.status === 'completed').length);
    _rdSet('rdDistCountCancelled', data.filter(d => d.status === 'cancelled').length);
}

function populateRamadanDistFilterOptions() {
    const fill = (id, values, allLabel, key) => {
        const sel = _rdEl(id); if (!sel) return;
        const current = _rdDistAdv[key];
        sel.innerHTML = `<option value="all">${allLabel}</option>` +
            values.map(v => `<option value="${_rdEsc(v)}">${_rdEsc(v)}</option>`).join('');
        if (values.map(String).includes(String(current))) sel.value = current;
        else { sel.value = 'all'; _rdDistAdv[key] = 'all'; }
    };
    const years = [...new Set(ramadanDistData.map(d => String(d.year)))].sort((a, b) => b - a);
    const locs  = [...new Set(ramadanDistData.map(d => (d.collection_location || '').trim()).filter(Boolean))].sort();
    fill('rdDistYearFilter', years, 'All Years', 'year');
    fill('rdDistLocationFilter', locs, 'All Venues / Locations', 'location');
}

function _rdDistScheduleBucket(d) {
    if (!d.collection_date) return 'unscheduled';
    const day = String(d.collection_date).split('T')[0], today = _rdIsoToday();
    if (day === today) return 'today';
    return day > today ? 'upcoming' : 'past';
}

function _rdGetFilteredDists() {
    const q = (_rdEl('ramadanSearchInput')?.value || '').trim().toLowerCase();
    let list = ramadanDistData.filter(d => {
        const m = _rdDistMetrics(d);
        if (_rdDistStatus !== 'all' && d.status !== _rdDistStatus) return false;
        if (_rdDistType !== 'all') {
            const t = d.package_type || 'dry_ration';
            if (_rdDistType === 'other' ? !['iftar_kit', 'eid_gift', 'mixed'].includes(t) : t !== _rdDistType) return false;
        }
        if (_rdDistAdv.year !== 'all' && String(d.year) !== _rdDistAdv.year) return false;
        if (_rdDistAdv.location !== 'all' && (d.collection_location || '').trim() !== _rdDistAdv.location) return false;
        if (_rdDistAdv.schedule !== 'all' && _rdDistScheduleBucket(d) !== _rdDistAdv.schedule) return false;
        switch (_rdDistAdv.progress) {
            case 'completed_100': if (!(m.total > 0 && m.pct === 100)) return false; break;
            case 'in_progress':   if (!(m.pct > 0 && m.pct < 100)) return false; break;
            case 'not_started':   if (!(m.total > 0 && m.collected === 0)) return false; break;
            case 'has_pending':   if (m.pending <= 0) return false; break;
            case 'no_tokens':     if (m.total !== 0) return false; break;
        }
        if (q) {
            const hay = [d.title, d.year, d.hijri_year, d.collection_location, d.coordinator_name,
                d.coordinator_phone, d.package_items, d.notes, _rdPkgLabel(d.package_type), d.status]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    const val = d => {
        const m = _rdDistMetrics(d);
        switch (_rdDistSortCol) {
            case 'progress': return m.pct;
            case 'budget': return m.budget;
            case 'total_tokens': return m.total;
            case 'voucher_value': return m.voucher;
            case 'year': return Number(d.year) || 0;
            case 'collection_date': return d.collection_date ? String(d.collection_date).split('T')[0] : null;
            default: return String(d[_rdDistSortCol] ?? '').toLowerCase();
        }
    };
    const dir = _rdDistSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
        const va = val(a), vb = val(b);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return c !== 0 ? c * dir : b.id - a.id;
    });
    return list;
}

function _rdDistHasActiveFilters() {
    return _rdDistStatus !== 'all' || _rdDistType !== 'all' ||
        Object.values(_rdDistAdv).some(v => v !== 'all') ||
        !!(_rdEl('ramadanSearchInput')?.value || '').trim();
}

function _rdScheduleChip(d) {
    if (!d.collection_date) return '';
    const days = Math.round((_rdParseDate(d.collection_date) - _rdParseDate(_rdIsoToday())) / 86400000);
    if (days === 0) return `<span class="rd-mini-chip" style="color:#10b981; border-color:rgba(16,185,129,.3); background:rgba(16,185,129,.08);">Today</span>`;
    if (days > 0)   return `<span class="rd-mini-chip" style="color:#6366f1; border-color:rgba(99,102,241,.3); background:rgba(99,102,241,.08);">In ${days} day${days === 1 ? '' : 's'}</span>`;
    return `<span class="rd-mini-chip">${-days} day${days === -1 ? '' : 's'} ago</span>`;
}

function renderRamadanDistributions() {
    const filtered = _rdGetFilteredDists();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / _rdDistPageSize));
    if (_rdDistPage > totalPages) _rdDistPage = totalPages;
    const start = (_rdDistPage - 1) * _rdDistPageSize;
    const paged = filtered.slice(start, start + _rdDistPageSize);

    const clearBtn = _rdEl('rdDistSearchClearBtn');
    if (clearBtn) clearBtn.style.display = (_rdEl('ramadanSearchInput')?.value || '') ? 'inline-flex' : 'none';
    const resetBtn = _rdEl('rdDistResetBtn');
    if (resetBtn) resetBtn.style.display = _rdDistHasActiveFilters() ? 'inline-flex' : 'none';
    _rdSet('rdDistFilterCount', `Showing ${total} of ${ramadanDistData.length} campaign${ramadanDistData.length === 1 ? '' : 's'}`);
    ['rdDistYearFilter', 'rdDistLocationFilter', 'rdDistProgressFilter', 'rdDistScheduleFilter'].forEach(id => {
        const s = _rdEl(id); if (s) s.classList.toggle('active-select', s.value !== 'all');
    });

    const emptyHtml = `<div class="rd-empty"><div class="rd-empty-icon">🌙</div>
        <div style="font-size:.9rem; font-weight:600; color:var(--text-main); margin-bottom:.35rem;">
        ${ramadanDistData.length ? 'No distributions match your filters.' : 'No distributions yet. Create one to get started.'}</div></div>`;

    const tableWrap = _rdEl('rdDistTableViewWrap'), gridWrap = _rdEl('rdDistGridViewWrap');
    if (tableWrap) tableWrap.style.display = _rdDistView === 'table' ? '' : 'none';
    if (gridWrap)  gridWrap.style.display  = _rdDistView === 'grid' ? 'grid' : 'none';
    _rdEl('rdViewTableBtn')?.classList.toggle('active', _rdDistView === 'table');
    _rdEl('rdViewGridBtn')?.classList.toggle('active', _rdDistView === 'grid');

    const actionBtns = (d, compact) => `
        <button class="btn" style="padding:0.4rem ${compact ? '0.5rem' : '0.7rem'}; background:var(--glow-bg); font-size:0.78rem;" onclick="openRdTokensModal(${d.id})" title="Manage Tokens"><i data-lucide="ticket" style="width:14px;"></i>${compact ? '' : ' Manage'}</button>
        <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openRamadanDistModal('edit',${d.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;"></i></button>
        <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="duplicateRamadanDist(${d.id})" title="Duplicate campaign"><i data-lucide="copy" style="width:14px;"></i></button>
        <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteRamadanDist(${d.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>`;

    const tbody = _rdEl('ramadanDistBody');
    if (tbody) {
        tbody.innerHTML = paged.length ? paged.map((d, i) => {
            const m = _rdDistMetrics(d);
            const sel = _rdDistSelected.has(d.id);
            return `
            <tr ${sel ? 'class="rd-row-selected"' : ''}>
                <td style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRamadanDistSelect(${d.id}, this.checked)" style="cursor:pointer;"></td>
                <td style="text-align:center; color:var(--text-muted); font-size:.78rem;">${start + i + 1}</td>
                <td>
                    <div style="font-weight:700; color:var(--text-main);">${_rdEsc(d.title)}</div>
                    <div style="margin-top:3px; display:flex; gap:.35rem; align-items:center; flex-wrap:wrap;">
                        ${_rdPkgBadge(d.package_type)}
                        ${d.package_items ? `<span class="rd-td-sub" title="${_rdEsc(d.package_items)}" style="max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_rdEsc(d.package_items)}</span>` : ''}
                    </div>
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:700;">${_rdEsc(d.year)}${d.hijri_year ? ` <span class="rd-td-sub" style="display:inline;">· ${_rdEsc(d.hijri_year)}</span>` : ''}</div>
                    <div class="rd-td-sub">${_rdFmtDate(d.collection_date)}${d.collection_time ? ' · ' + _rdEsc(d.collection_time) : ''}</div>
                    <div style="margin-top:3px;">${_rdScheduleChip(d)}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${_rdEsc(d.collection_location) || '—'}</div>
                    ${d.coordinator_name ? `<div class="rd-td-sub">${_rdEsc(d.coordinator_name)}${d.coordinator_phone ? ' · ' + _rdEsc(d.coordinator_phone) : ''}</div>` : ''}
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:700;">${m.voucher ? _rdMoney(m.voucher) : '—'}</div>
                    <div class="rd-td-sub">Budget: ${_rdMoney(m.budget)}</div>
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:800;">${m.total}${d.target_quota > 0 ? `<span class="rd-td-sub" style="display:inline;"> / ${d.target_quota} quota</span>` : ''}</div>
                    <div class="rd-td-sub"><span style="color:#10b981;">${m.collected} ✓</span> · <span style="color:#f59e0b;">${m.pending} ⏳</span> · <span style="color:#ef4444;">${m.absent} ✗</span></div>
                </td>
                <td style="min-width:130px;">
                    <div style="display:flex; align-items:center; gap:.5rem;">
                        <div style="flex:1; height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
                            <div style="width:${m.pct}%; height:100%; background:#10b981; border-radius:3px;"></div>
                        </div>
                        <span style="font-size:.75rem; font-weight:700; color:var(--text-main); white-space:nowrap;">${m.pct}%</span>
                    </div>
                    <div class="rd-td-sub">${_rdMoney(m.disbursed)} disbursed</div>
                </td>
                <td><span class="status-badge" style="${RD_STATUS_STYLE[d.status] || RD_STATUS_STYLE.active} text-transform:capitalize;">${_rdEsc(d.status)}</span></td>
                <td style="text-align:right; white-space:nowrap;">${actionBtns(d, true)}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="10">${emptyHtml}</td></tr>`;
    }

    if (gridWrap) {
        gridWrap.innerHTML = paged.length ? paged.map(d => {
            const m = _rdDistMetrics(d);
            const sel = _rdDistSelected.has(d.id);
            return `
            <div class="rd-dist-card" ${sel ? 'style="border-color:#6366f1;"' : ''}>
                <div style="display:flex; justify-content:space-between; gap:.6rem; align-items:flex-start;">
                    <div style="min-width:0;">
                        <div style="font-weight:800; font-size:.95rem; color:var(--text-main);">${_rdEsc(d.title)}</div>
                        <div style="margin-top:4px; display:flex; gap:.35rem; flex-wrap:wrap; align-items:center;">
                            ${_rdPkgBadge(d.package_type)}
                            <span class="status-badge" style="${RD_STATUS_STYLE[d.status] || RD_STATUS_STYLE.active} text-transform:capitalize; font-size:.66rem; padding:.1rem .45rem;">${_rdEsc(d.status)}</span>
                        </div>
                    </div>
                    <input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRamadanDistSelect(${d.id}, this.checked)" style="cursor:pointer; margin-top:3px;">
                </div>
                <div style="font-size:.76rem; color:var(--text-muted); display:grid; gap:.25rem;">
                    <div><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:-2px;"></i> ${_rdEsc(d.year)}${d.hijri_year ? ' · ' + _rdEsc(d.hijri_year) : ''} · ${_rdFmtDate(d.collection_date)}${d.collection_time ? ' · ' + _rdEsc(d.collection_time) : ''} ${_rdScheduleChip(d)}</div>
                    <div><i data-lucide="map-pin" style="width:12px;height:12px;vertical-align:-2px;"></i> ${_rdEsc(d.collection_location) || 'Venue TBD'}</div>
                    ${d.coordinator_name ? `<div><i data-lucide="user" style="width:12px;height:12px;vertical-align:-2px;"></i> ${_rdEsc(d.coordinator_name)}${d.coordinator_phone ? ' · ' + _rdEsc(d.coordinator_phone) : ''}</div>` : ''}
                </div>
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:.4rem; text-align:center;">
                    <div class="rd-mini-chip" style="flex-direction:column; padding:.4rem; border-radius:12px;"><b style="font-size:.95rem;">${m.total}</b>Tokens</div>
                    <div class="rd-mini-chip" style="flex-direction:column; padding:.4rem; border-radius:12px; color:#10b981;"><b style="font-size:.95rem;">${m.collected}</b>Collected</div>
                    <div class="rd-mini-chip" style="flex-direction:column; padding:.4rem; border-radius:12px; color:#f59e0b;"><b style="font-size:.95rem;">${m.pending}</b>Pending</div>
                    <div class="rd-mini-chip" style="flex-direction:column; padding:.4rem; border-radius:12px; color:#ef4444;"><b style="font-size:.95rem;">${m.absent}</b>Absent</div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:.72rem; color:var(--text-muted); margin-bottom:3px;">
                        <span>${m.voucher ? _rdMoney(m.voucher) + ' / pack' : 'No voucher value'}</span><b style="color:var(--text-main);">${m.pct}%</b>
                    </div>
                    <div style="height:7px; background:var(--border-color); border-radius:99px; overflow:hidden;"><div style="width:${m.pct}%; height:100%; background:#10b981;"></div></div>
                </div>
                <div style="display:flex; gap:.35rem; flex-wrap:wrap; justify-content:flex-end;">${actionBtns(d)}</div>
            </div>`;
        }).join('') : emptyHtml;
    }

    _rdRenderDistPagination(total, totalPages);
    _rdSyncDistBulkBar(paged);
    lucide.createIcons();
}

function _rdRenderDistPagination(total, totalPages) {
    const bar = _rdEl('rdDistPaginationBar'); if (!bar) return;
    const start = total ? (_rdDistPage - 1) * _rdDistPageSize + 1 : 0;
    const end = Math.min(_rdDistPage * _rdDistPageSize, total);
    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:.65rem; flex-wrap:wrap;">
            <span style="font-size:.78rem; color:var(--text-muted); font-weight:600;">${total ? `Showing ${start}–${end} of ${total}` : 'No results'}</span>
            <select class="fam-filter-select" onchange="setRamadanDistPageSize(this.value)" title="Rows per page">
                ${[6, 10, 20, 50].map(n => `<option value="${n}" ${n === _rdDistPageSize ? 'selected' : ''}>${n} / page</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; gap:.25rem; align-items:center;">${_rdPageButtons(_rdDistPage, totalPages, 'setRamadanDistPage', 'fam-page-btn')}</div>`;
}

function setRamadanDistPage(p) { _rdDistPage = Math.max(1, p); renderRamadanDistributions(); }
function setRamadanDistPageSize(v) { _rdDistPageSize = parseInt(v, 10) || 10; _rdDistPage = 1; renderRamadanDistributions(); }
function filterRamadanDistributions() { renderRamadanDistributions(); }
function setRamadanDistViewMode(m) { _rdDistView = m; renderRamadanDistributions(); }

function setRamadanDistStatusFilter(s) {
    _rdDistStatus = s; _rdDistPage = 1;
    document.querySelectorAll('[id^="rdDistStat-"]').forEach(b => b.classList.remove('active'));
    _rdEl(`rdDistStat-${s}`)?.classList.add('active');
    renderRamadanDistributions();
}
function setRamadanDistTypeFilter(t) {
    _rdDistType = t; _rdDistPage = 1;
    document.querySelectorAll('[id^="rdDistType-"]').forEach(b => b.classList.remove('active'));
    _rdEl(`rdDistType-${t}`)?.classList.add('active');
    renderRamadanDistributions();
}
function setRamadanDistAdvFilter(key, value) {
    _rdDistAdv[key] = value; _rdDistPage = 1;
    const map = { year: 'rdDistYearFilter', location: 'rdDistLocationFilter', progress: 'rdDistProgressFilter', schedule: 'rdDistScheduleFilter' };
    const s = _rdEl(map[key]); if (s) s.value = value;
    renderRamadanDistributions();
}
function onRamadanDistSortChange(v) {
    const [col, dir] = String(v).split(':');
    _rdDistSortCol = col; _rdDistSortDir = dir || 'desc'; _rdDistPage = 1;
    const sel = _rdEl('rdDistSortSelect');
    if (sel && [...sel.options].some(o => o.value === v)) sel.value = v;
    renderRamadanDistributions();
}
function sortRamadanDists(col) {
    if (_rdDistSortCol === col) _rdDistSortDir = _rdDistSortDir === 'asc' ? 'desc' : 'asc';
    else { _rdDistSortCol = col; _rdDistSortDir = 'asc'; }
    _rdDistPage = 1;
    renderRamadanDistributions();
}
function resetRamadanDistFilters() {
    _rdDistStatus = 'all'; _rdDistType = 'all';
    _rdDistAdv = { year: 'all', location: 'all', progress: 'all', schedule: 'all' };
    _rdDistPage = 1;
    const s = _rdEl('ramadanSearchInput'); if (s) s.value = '';
    document.querySelectorAll('[id^="rdDistStat-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdDistStat-all')?.classList.add('active');
    document.querySelectorAll('[id^="rdDistType-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdDistType-all')?.classList.add('active');
    ['rdDistYearFilter', 'rdDistLocationFilter', 'rdDistProgressFilter', 'rdDistScheduleFilter'].forEach(id => { const e = _rdEl(id); if (e) e.value = 'all'; });
    renderRamadanDistributions();
}

// ── Bulk selection (campaigns) ──────────────────────────────────────────────
function _rdSyncDistBulkBar(pagedRows) {
    const bar = _rdEl('rdDistBulkBar');
    if (bar) bar.classList.toggle('visible', _rdDistSelected.size > 0);
    _rdSet('rdDistBulkCount', _rdDistSelected.size);
    const cb = _rdEl('rdDistSelectAllCb');
    if (cb && pagedRows) {
        const all = pagedRows.length > 0 && pagedRows.every(d => _rdDistSelected.has(d.id));
        cb.checked = all;
        cb.indeterminate = !all && pagedRows.some(d => _rdDistSelected.has(d.id));
    }
}
function toggleRamadanDistSelect(id, checked) {
    checked ? _rdDistSelected.add(id) : _rdDistSelected.delete(id);
    renderRamadanDistributions();
}
function toggleSelectAllRamadanDists(checked) {
    const filtered = _rdGetFilteredDists();
    const start = (_rdDistPage - 1) * _rdDistPageSize;
    filtered.slice(start, start + _rdDistPageSize).forEach(d => checked ? _rdDistSelected.add(d.id) : _rdDistSelected.delete(d.id));
    renderRamadanDistributions();
}
function clearRamadanDistSelection() { _rdDistSelected.clear(); renderRamadanDistributions(); }

async function executeRamadanDistBulkAction(action, value) {
    const ids = [..._rdDistSelected];
    if (!ids.length) return;
    try {
        let res;
        if (action === 'delete') {
            if (!confirm(`Delete ${ids.length} campaign(s)? All associated tokens will also be deleted. This cannot be undone.`)) return;
            res = await fetch('/api/ramadan/distributions/bulk-delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
            });
        } else {
            res = await fetch('/api/ramadan/distributions/bulk-status', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, status: value })
            });
        }
        const r = await res.json();
        if (res.ok) { showToast(r.message, 'success'); _rdDistSelected.clear(); fetchRamadanDistributions(); }
        else showToast(r.message || 'Bulk action failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

// ── Export (campaigns) ──────────────────────────────────────────────────────
function _rdDistExportRows(list) {
    return list.map(d => {
        const m = _rdDistMetrics(d);
        return {
            'Title': d.title, 'Year': d.year, 'Hijri Year': d.hijri_year || '',
            'Package Type': _rdPkgLabel(d.package_type), 'Status': d.status,
            'Collection Date': d.collection_date ? String(d.collection_date).split('T')[0] : '',
            'Collection Time': d.collection_time || '', 'Venue': d.collection_location || '',
            'Coordinator': d.coordinator_name || '', 'Coordinator Phone': d.coordinator_phone || '',
            'Voucher Value (LKR)': m.voucher, 'Target Quota': d.target_quota || 0,
            'Tokens Issued': m.total, 'Collected': m.collected, 'Pending': m.pending, 'Absent': m.absent,
            'Progress %': m.pct, 'Total Budget (LKR)': m.budget, 'Disbursed (LKR)': m.disbursed,
            'Pack Items': d.package_items || '', 'Notes': d.notes || '',
        };
    });
}
function exportRamadanDistributions(format) {
    _rdExportRows(_rdDistExportRows(_rdGetFilteredDists()), `EDF_Ramadan_Distributions_${_rdIsoToday()}`, format, 'Distributions');
}
function exportSelectedRamadanDistCSV() {
    const list = ramadanDistData.filter(d => _rdDistSelected.has(d.id));
    _rdExportRows(_rdDistExportRows(list), `EDF_Ramadan_Selected_${_rdIsoToday()}`, 'csv');
}

// ── Delete / duplicate ──────────────────────────────────────────────────────
async function deleteRamadanDist(id) {
    const d = ramadanDistData.find(x => x.id === id);
    if (!confirm(`Delete "${d ? d.title : 'this distribution'}"? All associated tokens will also be deleted.`)) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('Distribution deleted', 'success'); _rdDistSelected.delete(id); fetchRamadanDistributions(); }
        else showToast('Failed to delete', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}

async function duplicateRamadanDist(id) {
    const d = ramadanDistData.find(x => x.id === id);
    if (!d) return;
    const yearIn = prompt(`Duplicate "${d.title}"\n\nYear for the new campaign:`, String(Number(d.year) + 1));
    if (yearIn === null) return;
    const newYear = parseInt(yearIn, 10);
    if (!newYear || newYear < 2000 || newYear > 2100) { showToast('Enter a valid year', 'error'); return; }
    const copy = (d.total_tokens || 0) > 0 &&
        confirm(`Also copy the ${d.total_tokens} beneficiaries as new PENDING tokens?\n\nOK = copy beneficiaries\nCancel = copy settings only`);
    let title = String(d.title).replace(String(d.year), String(newYear));
    if (title === d.title) title += ' (Copy)';
    try {
        const res = await fetch(`/api/ramadan/distributions/${id}/duplicate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: newYear, title, copy_beneficiaries: copy })
        });
        const r = await res.json();
        if (res.ok) { showToast(r.message, 'success'); fetchRamadanDistributions(); }
        else showToast(r.message || 'Duplicate failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 — NEW / EDIT DISTRIBUTION MODAL
// ═══════════════════════════════════════════════════════════════════════════

let _rdMeta = { active_count: 0, towns: [], categories: [] };

function _rdFormVal(id) { return (_rdEl(id)?.value || '').trim(); }

function updateRamadanModalPreview() {
    const year = _rdFormVal('ramadanDistYear') || new Date().getFullYear();
    const pkg = _rdEl('ramadanDistPkgType')?.value || 'dry_ration';
    const status = _rdEl('ramadanDistStatus')?.value || 'active';
    const voucher = Number(_rdFormVal('ramadanDistVoucher')) || 0;
    const quota = Number(_rdFormVal('ramadanDistQuota')) || 0;
    const mode = _rdEl('ramadanDistAssignMode')?.value;
    const isEdit = !!_rdFormVal('ramadanDistId');
    const expected = quota > 0 ? quota : (!isEdit && mode !== 'none' ? _rdMeta.active_count : 0);
    const date = _rdFormVal('ramadanDistDate');

    _rdSet('rdPreviewYearBox', year);
    _rdSet('rdPreviewTitle', _rdFormVal('ramadanDistTitle') || 'Untitled Distribution');
    const pb = _rdEl('rdPreviewPkgBadge');
    if (pb) { pb.className = `rd-pkg-badge rd-pkg-${RD_PKG[pkg] ? pkg : 'dry_ration'}`; pb.textContent = _rdPkgLabel(pkg); }
    const sb = _rdEl('rdPreviewStatusBadge');
    if (sb) { sb.style.cssText = `${RD_STATUS_STYLE[status]} font-size:0.66rem; padding:0.1rem 0.48rem; text-transform:capitalize;`; sb.textContent = status; }
    _rdSet('rdPreviewSubMeta', [
        _rdFormVal('ramadanDistHijri') || `${_rdHijriFromYear(year)} AH`,
        _rdFormVal('ramadanDistLocation') || 'Venue TBD',
        date ? _rdFmtDate(date) + (_rdFormVal('ramadanDistTime') ? ' ' + _rdFormVal('ramadanDistTime') : '') : 'Schedule TBD',
    ].join(' • '));
    _rdSet('rdPreviewVoucherVal', _rdMoney(voucher));
    _rdSet('rdPreviewTotalBudget', expected ? _rdMoney(voucher * expected) : 'LKR 0');
    _rdSet('rdModalActiveBenCount', _rdMeta.active_count);
    _rdSet('rdAssignCardCount', _rdMeta.active_count);
}

function onRamadanYearInput(v) {
    const hij = _rdEl('ramadanDistHijri');
    if (hij && (!hij.value || hij.dataset.auto === '1') && v) {
        hij.value = `${_rdHijriFromYear(v)} AH`; hij.dataset.auto = '1';
    }
    updateRamadanModalPreview();
}

function autoFillRamadanTitle() {
    const y = _rdFormVal('ramadanDistYear') || new Date().getFullYear();
    const pkg = _rdEl('ramadanDistPkgType')?.value || 'dry_ration';
    const p = RD_PRESETS[pkg] || RD_PRESETS.dry_ration;
    _rdEl('ramadanDistTitle').value = p.title(y);
    updateRamadanModalPreview();
}

function selectRamadanPkgType(t) {
    const input = _rdEl('ramadanDistPkgType'); if (input) input.value = t;
    document.querySelectorAll('.rd-pkg-type-card').forEach(c => c.classList.toggle('active', c.dataset.pkg === t));
    updateRamadanModalPreview();
}

function applyRamadanCampaignPreset(type) {
    const p = RD_PRESETS[type]; if (!p) return;
    const y = _rdFormVal('ramadanDistYear') || new Date().getFullYear();
    selectRamadanPkgType(type);
    _rdEl('ramadanDistTitle').value = p.title(y);
    _rdEl('ramadanDistVoucher').value = p.voucher;
    _rdEl('ramadanDistItems').value = p.items;
    syncRamadanItemChipsFromInput();
    updateRamadanModalPreview();
    showToast('Preset applied — adjust as needed', 'info');
}

function setRamadanVoucherPreset(v) { _rdEl('ramadanDistVoucher').value = v; updateRamadanModalPreview(); }
function setRamadanQuickDate(offset) {
    const d = new Date(); d.setDate(d.getDate() + offset);
    _rdEl('ramadanDistDate').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    updateRamadanModalPreview();
}

function _rdItemList() {
    return (_rdEl('ramadanDistItems')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
}
function syncRamadanItemChipsFromInput() {
    const lower = _rdItemList().map(s => s.toLowerCase());
    document.querySelectorAll('#rdPackItemChips .rd-item-chip').forEach(c =>
        c.classList.toggle('selected', lower.includes(c.dataset.ritem.toLowerCase())));
}
function toggleRamadanPackItem(item) {
    const list = _rdItemList();
    const idx = list.findIndex(s => s.toLowerCase() === item.toLowerCase());
    idx >= 0 ? list.splice(idx, 1) : list.push(item);
    _rdEl('ramadanDistItems').value = list.join(', ');
    syncRamadanItemChipsFromInput();
}
function clearRamadanPackItems() { _rdEl('ramadanDistItems').value = ''; syncRamadanItemChipsFromInput(); }

function selectRamadanAssignMode(mode) {
    _rdEl('ramadanDistAssignMode').value = mode;
    document.querySelectorAll('.rd-assign-mode-card').forEach(c => c.classList.toggle('active', c.dataset.amode === mode));
    const wrap = _rdEl('rdModalAssignFilterWrap');
    if (wrap) wrap.style.display = mode === 'filtered' ? 'grid' : 'none';
    updateRamadanModalPreview();
}

async function _rdLoadEligibleMeta() {
    try {
        const res = await fetch('/api/ramadan/eligible-meta');
        if (!res.ok) return;
        _rdMeta = await res.json();
        const fill = (id, vals, label) => {
            const s = _rdEl(id); if (!s) return;
            s.innerHTML = `<option value="all">${label}</option>` + vals.map(v => `<option value="${_rdEsc(v)}">${_rdEsc(v)}</option>`).join('');
        };
        fill('ramadanDistAssignTown', _rdMeta.towns, 'All Towns');
        fill('ramadanDistAssignCategory', _rdMeta.categories, 'All Categories');
        updateRamadanModalPreview();
    } catch (_) {}
}

function openRamadanDistModal(mode, distId = null) {
    const dist = distId ? ramadanDistData.find(d => d.id === distId) : null;
    const isEdit = mode === 'edit' && !!dist;
    const y = dist ? dist.year : new Date().getFullYear();

    const setVal = (id, val) => { const el = _rdEl(id); if (el) el.value = val ?? ''; };

    setVal('ramadanDistId', isEdit ? dist.id : '');
    setVal('ramadanDistTitle', dist ? dist.title : '');
    setVal('ramadanDistYear', y);
    const hij = _rdEl('ramadanDistHijri');
    if (hij) {
        hij.value = dist && dist.hijri_year ? dist.hijri_year : `${_rdHijriFromYear(y)} AH`;
        hij.dataset.auto = dist && dist.hijri_year ? '0' : '1';
    }
    setVal('ramadanDistDate', dist && dist.collection_date ? String(dist.collection_date).split('T')[0] : '');
    setVal('ramadanDistTime', dist ? (dist.collection_time || '') : '');
    setVal('ramadanDistLocation', dist ? (dist.collection_location || '') : '');
    setVal('ramadanDistVoucher', dist ? (dist.voucher_value || '') : '');
    setVal('ramadanDistQuota', dist && dist.target_quota ? dist.target_quota : '');
    setVal('ramadanDistItems', dist ? (dist.package_items || '') : '');
    setVal('ramadanDistCoordName', dist ? (dist.coordinator_name || '') : '');
    setVal('ramadanDistCoordPhone', dist ? (dist.coordinator_phone || '') : '');
    setVal('ramadanDistNotes', dist ? (dist.notes || '') : '');
    setVal('ramadanDistStatus', dist ? dist.status : 'active');

    if (typeof selectRamadanPkgType === 'function') selectRamadanPkgType(dist?.package_type || 'dry_ration');
    if (typeof selectRamadanAssignMode === 'function') selectRamadanAssignMode('all_active');
    if (typeof syncRamadanItemChipsFromInput === 'function') syncRamadanItemChipsFromInput();

    _rdSet('ramadanDistModalTitle', isEdit ? 'Edit Distribution Campaign' : 'New Distribution Campaign');
    _rdSet('rdModalModeBadge', isEdit ? 'Edit Mode' : 'Create Campaign');
    const assign = _rdEl('rdModalAssignSection');
    if (assign) assign.style.display = isEdit ? 'none' : '';
    const submitBtn = _rdEl('ramadanDistSubmitBtn');
    if (submitBtn) submitBtn.innerHTML = `<i data-lucide="save"></i> ${isEdit ? 'Update Distribution' : 'Save Distribution'}`;

    if (typeof updateRamadanModalPreview === 'function') {
        try { updateRamadanModalPreview(); } catch (_) {}
    }
    if (window.lucide) lucide.createIcons();
    openModal('ramadanDistModal');
    if (typeof _rdLoadEligibleMeta === 'function') {
        try { _rdLoadEligibleMeta(); } catch (_) {}
    }
}

async function saveRamadanDist(e, openTokensAfter = false) {
    if (e && e.preventDefault) e.preventDefault();
    const form = _rdEl('ramadanDistForm');
    if (form && !form.reportValidity()) return;

    const id = _rdEl('ramadanDistId')?.value;
    const isEdit = !!id;
    const payload = {
        title:               _rdFormVal('ramadanDistTitle'),
        year:                _rdFormVal('ramadanDistYear'),
        hijri_year:          _rdFormVal('ramadanDistHijri'),
        package_type:        _rdEl('ramadanDistPkgType')?.value || _rdEl('ramadanDistPkgTypeSelect')?.value || 'dry_ration',
        collection_date:     _rdFormVal('ramadanDistDate') || null,
        collection_time:     _rdFormVal('ramadanDistTime'),
        collection_location: _rdFormVal('ramadanDistLocation'),
        voucher_value:       _rdFormVal('ramadanDistVoucher') || 0,
        target_quota:        _rdFormVal('ramadanDistQuota') || 0,
        package_items:       _rdFormVal('ramadanDistItems'),
        coordinator_name:    _rdFormVal('ramadanDistCoordName'),
        coordinator_phone:   _rdFormVal('ramadanDistCoordPhone'),
        notes:               _rdFormVal('ramadanDistNotes'),
        status:              _rdEl('ramadanDistStatus')?.value || 'active',
    };
    if (!isEdit && _rdEl('ramadanDistAssignMode')) {
        payload.auto_assign_mode = _rdEl('ramadanDistAssignMode').value;
        if (payload.auto_assign_mode === 'filtered') {
            payload.auto_assign_town = _rdEl('ramadanDistAssignTown')?.value || '';
            payload.auto_assign_category = _rdEl('ramadanDistAssignCategory')?.value || '';
        }
    }
    try {
        const res = await fetch(isEdit ? `/api/ramadan/distributions/${id}` : '/api/ramadan/distributions', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const r = await res.json();
        if (!res.ok) { showToast(r.message || 'Save failed', 'error'); return; }
        closeModal('ramadanDistModal');
        showToast(isEdit ? 'Distribution updated' : (r.message || 'Distribution created'), 'success');
        _rdDistPage = 1;
        await fetchRamadanDistributions();
        if (openTokensAfter) openRdTokensModal(isEdit ? Number(id) : r.id);
    } catch (err) { showToast('Network error', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 3 — TOKENS CONSOLE MODAL
// ═══════════════════════════════════════════════════════════════════════════

let _rdCurrentDistId = null;
let _rdTokenData     = [];
let _rdUnassigned    = [];
let _rdTokFilter     = 'all';
let _rdTokTown       = 'all';
let _rdTokCategory   = 'all';
let _rdTokExtra      = 'all';
let _rdTokSortCol    = 'token_number';
let _rdTokSortDir    = 'asc';
let _rdTokPage       = 1;
let _rdTokPageSize   = 20;
let _rdTokSelected   = new Set();

function _rdCurrentDist() { return ramadanDistData.find(d => d.id === _rdCurrentDistId) || null; }

async function openRdTokensModal(distId) {
    _rdCurrentDistId = distId;
    _rdTokenData = []; _rdUnassigned = [];
    _rdTokFilter = 'all'; _rdTokTown = 'all'; _rdTokCategory = 'all'; _rdTokExtra = 'all';
    _rdTokSortCol = 'token_number'; _rdTokSortDir = 'asc';
    _rdTokPage = 1; _rdTokPageSize = 20; _rdTokSelected.clear();

    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdTokFilter-all')?.classList.add('active');
    _rdUpdateSortArrows();
    const setVal = (id, v) => { const e = _rdEl(id); if (e) e.value = v; };
    setVal('rdTokSortSel', 'token_number|asc'); setVal('rdTokPageSizeSel', '20');
    setVal('rdTokExtraFilter', 'all'); setVal('rdTokSearch', '');
    setVal('rdVerifyNic', ''); setVal('rdAssignSearchInput', '');
    const vr = _rdEl('rdVerifyResult'); if (vr) { vr.style.display = 'none'; vr.innerHTML = ''; }
    _rdEl('rdAssignDrawer')?.classList.remove('open');
    _rdSet('rdToggleAssignBtnText', 'Assign Beneficiary');

    const dist = _rdCurrentDist();
    _rdSet('rdTokModalTitle', dist ? dist.title : 'Distribution Tokens');
    const pb = _rdEl('rdTokModalPkgBadge');
    if (pb) { const t = dist?.package_type || 'dry_ration'; pb.className = `rd-pkg-badge rd-pkg-${RD_PKG[t] ? t : 'dry_ration'}`; pb.textContent = _rdPkgShort(t); }
    const sb = _rdEl('rdTokModalStatusBadge');
    if (sb && dist) { sb.style.cssText = `${RD_STATUS_STYLE[dist.status] || RD_STATUS_STYLE.active} font-size:0.66rem; padding:0.1rem 0.45rem; text-transform:capitalize;`; sb.textContent = dist.status; }
    const sub = _rdEl('rdTokModalSub');
    if (sub) {
        const bits = dist ? [
            dist.year + (dist.hijri_year ? ` (${dist.hijri_year})` : ''),
            dist.collection_date ? _rdFmtDate(dist.collection_date) + (dist.collection_time ? ' ' + dist.collection_time : '') : null,
            dist.collection_location,
            dist.voucher_value ? _rdMoney(dist.voucher_value) + ' / pack' : null,
            dist.coordinator_name ? `Coordinator: ${dist.coordinator_name}${dist.coordinator_phone ? ' ' + dist.coordinator_phone : ''}` : null,
        ].filter(Boolean) : [];
        sub.textContent = bits.join(' · ');
    }

    // Initialize scanner toggles
    const ac = _rdEl('rdAutoCollectCheck'); if (ac) { ac.checked = _rdAutoCollectEnabled; ac.closest('.rd-toggle-chip')?.classList.toggle('active', _rdAutoCollectEnabled); }
    const gm = _rdEl('rdGunModeCheck'); if (gm) { gm.checked = _rdGunModeEnabled; _rdApplyGunMode(_rdGunModeEnabled); }
    const bp = _rdEl('rdAudioBeepCheck'); if (bp) { bp.checked = _rdAudioBeepEnabled; }
    // Ensure camera drawer is closed on fresh open
    const camDrawer = _rdEl('rdCameraDrawer'); if (camDrawer) camDrawer.style.display = 'none';
    const camBtn = _rdEl('rdCameraToggleBtn'); if (camBtn) camBtn.classList.remove('active');
    const camBtnText = _rdEl('rdCameraBtnText'); if (camBtnText) camBtnText.textContent = 'Scan Camera';

    openModal('ramadanTokensModal');
    lucide.createIcons();
    setTimeout(() => { _rdEl('rdVerifyNic')?.focus(); }, 180);
    await fetchRdTokens();
}

async function fetchRdTokens() {
    if (!_rdCurrentDistId) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/tokens`);
        if (!res.ok) throw new Error('Failed');
        _rdTokenData = await res.json();
        const ids = new Set(_rdTokenData.map(t => t.id));
        _rdTokSelected.forEach(id => { if (!ids.has(id)) _rdTokSelected.delete(id); });
        _rdPopulateTokFilterOptions();
        updateRdTokenStats();
        renderRdTokens();
        fetchRdUnassigned();
    } catch (err) { console.error(err); }
}

async function fetchRdUnassigned() {
    if (!_rdCurrentDistId) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/unassigned`);
        if (!res.ok) return;
        _rdUnassigned = await res.json();
        const hint = _rdEl('rdUnassignedEligibleHint');
        if (hint) hint.textContent = _rdUnassigned.length ? `+ ${_rdUnassigned.length} eligible unassigned` : '';
        _rdSet('rdUnassignedCountBadge', `${_rdUnassigned.length} Unassigned`);
        _rdPopulateAssignFilters();
        renderRdUnassignedList();
    } catch (_) {}
}

function _rdPopulateTokFilterOptions() {
    const fill = (id, vals, label, current, setter) => {
        const s = _rdEl(id); if (!s) return;
        s.innerHTML = `<option value="all">${label}</option>` + vals.map(v => `<option value="${_rdEsc(v)}">${_rdEsc(v)}</option>`).join('');
        if (vals.includes(current)) s.value = current; else { s.value = 'all'; setter('all'); }
    };
    const uniq = k => [...new Set(_rdTokenData.map(t => (t[k] || '').trim()).filter(Boolean))].sort();
    fill('rdTokTownFilter', uniq('home_town'), 'All Towns / Areas', _rdTokTown, v => _rdTokTown = v);
    fill('rdTokCategoryFilter', uniq('category'), 'All Categories', _rdTokCategory, v => _rdTokCategory = v);
}

function updateRdTokenStats() {
    const dist = _rdCurrentDist();
    const voucher = Number(dist?.voucher_value) || 0;
    const count = s => _rdTokenData.filter(t => t.status === s).length;
    const total = _rdTokenData.length, collected = count('collected'), pending = count('pending'), absent = count('absent');
    const pct = total ? Math.round((collected / total) * 100) : 0;
    const absentPct = total ? Math.round((absent / total) * 100) : 0;
    _rdSet('rdTokTotal', total); _rdSet('rdTokCollected', collected);
    _rdSet('rdTokPending', pending); _rdSet('rdTokAbsent', absent);
    _rdSet('rdTokTotalValSub', `Value: ${_rdMoney(voucher * total)}`);
    _rdSet('rdTokCollectedValSub', `Disbursed: ${_rdMoney(voucher * collected)}`);
    _rdSet('rdTokPendingValSub', `Remaining: ${_rdMoney(voucher * pending)}`);
    _rdSet('rdTokAbsentSub', absent ? `${absentPct}% unclaimed` : 'Unclaimed');
    _rdSet('rdProgressPct', pct + '%');
    _rdSet('rdProgressFractionText', `${collected} of ${total} collected`);
    const bar = _rdEl('rdProgressBar'); if (bar) bar.style.width = pct + '%';
    const abar = _rdEl('rdProgressAbsentBar'); if (abar) abar.style.width = absentPct + '%';
    _rdSet('rdTokCnt-all', total); _rdSet('rdTokCnt-pending', pending);
    _rdSet('rdTokCnt-collected', collected); _rdSet('rdTokCnt-absent', absent);
}

// ── Filters / sort / pagination ─────────────────────────────────────────────
function setRdTokFilter(f) {
    _rdTokFilter = f; _rdTokPage = 1;
    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    _rdEl(`rdTokFilter-${f}`)?.classList.add('active');
    renderRdTokens();
}
function onRdTokAdvFilterChange() {
    _rdTokTown = _rdEl('rdTokTownFilter')?.value || 'all';
    _rdTokCategory = _rdEl('rdTokCategoryFilter')?.value || 'all';
    _rdTokExtra = _rdEl('rdTokExtraFilter')?.value || 'all';
    _rdTokPage = 1;
    renderRdTokens();
}
function resetRdTokFilters() {
    _rdTokTown = 'all'; _rdTokCategory = 'all'; _rdTokExtra = 'all';
    ['rdTokTownFilter', 'rdTokCategoryFilter', 'rdTokExtraFilter'].forEach(id => { const e = _rdEl(id); if (e) e.value = 'all'; });
    const s = _rdEl('rdTokSearch'); if (s) s.value = '';
    setRdTokFilter('all');
}
function rdToggleSort(col) {
    if (_rdTokSortCol === col) _rdTokSortDir = _rdTokSortDir === 'asc' ? 'desc' : 'asc';
    else { _rdTokSortCol = col; _rdTokSortDir = 'asc'; }
    _rdTokPage = 1;
    const sel = _rdEl('rdTokSortSel');
    if (sel && [...sel.options].some(o => o.value === `${col}|${_rdTokSortDir}`)) sel.value = `${col}|${_rdTokSortDir}`;
    _rdUpdateSortArrows();
    renderRdTokens();
}
function rdTokSortChange() {
    const val = _rdEl('rdTokSortSel')?.value || 'token_number|asc';
    [_rdTokSortCol, _rdTokSortDir] = val.split('|');
    _rdTokPage = 1; _rdUpdateSortArrows(); renderRdTokens();
}
function rdTokSearchChange() { _rdTokPage = 1; renderRdTokens(); }
function rdTokPageSizeChange() {
    _rdTokPageSize = parseInt(_rdEl('rdTokPageSizeSel')?.value || '20', 10);
    _rdTokPage = 1; renderRdTokens();
}
function setRdTokPage(p) { _rdTokPage = Math.max(1, p); renderRdTokens(); }
function _rdUpdateSortArrows() {
    ['token_number', 'beneficiary_name', 'home_town', 'status', 'collected_at'].forEach(col => {
        const el = _rdEl(`rdSort-${col}`); if (!el) return;
        if (col !== _rdTokSortCol) { el.textContent = ''; el.classList.remove('on'); }
        else { el.textContent = _rdTokSortDir === 'asc' ? '↑' : '↓'; el.classList.add('on'); }
    });
}

function _rdGetFilteredTokens() {
    const q = (_rdEl('rdTokSearch')?.value || '').trim().toLowerCase();
    const today = _rdIsoToday();
    const list = _rdTokenData.filter(t => {
        if (_rdTokFilter !== 'all' && t.status !== _rdTokFilter) return false;
        if (_rdTokTown !== 'all' && (t.home_town || '').trim() !== _rdTokTown) return false;
        if (_rdTokCategory !== 'all' && (t.category || '').trim() !== _rdTokCategory) return false;
        if (_rdTokExtra === 'with_notes' && !(t.notes || '').trim()) return false;
        if (_rdTokExtra === 'has_phone' && !(t.contact_number || '').trim()) return false;
        if (_rdTokExtra === 'collected_today') {
            if (t.status !== 'collected' || !t.collected_at) return false;
            const d = new Date(t.collected_at);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (iso !== today) return false;
        }
        if (q) {
            const hay = [t.beneficiary_name, t.female_head_name, t.nic_number, t.female_head_nic, t.token_number,
                t.application_number, t.contact_number, t.home_town, t.category, t.notes, t.collector_name]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    list.sort((a, b) => {
        if (_rdTokSortCol === 'collected_at') {
            const va = a.collected_at ? new Date(a.collected_at).getTime() : 0;
            const vb = b.collected_at ? new Date(b.collected_at).getTime() : 0;
            return _rdTokSortDir === 'asc' ? va - vb : vb - va;
        }
        const c = String(a[_rdTokSortCol] ?? '').toLowerCase().localeCompare(String(b[_rdTokSortCol] ?? '').toLowerCase(), undefined, { numeric: true });
        return _rdTokSortDir === 'asc' ? c : -c;
    });
    return list;
}

function renderRdTokens() {
    const filtered = _rdGetFilteredTokens();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / _rdTokPageSize));
    if (_rdTokPage > totalPages) _rdTokPage = totalPages;
    const start = (_rdTokPage - 1) * _rdTokPageSize;
    const paged = filtered.slice(start, start + _rdTokPageSize);

    const search = (_rdEl('rdTokSearch')?.value || '').trim();
    const clr = _rdEl('rdTokSearchClearBtn'); if (clr) clr.style.display = search ? 'inline-flex' : 'none';
    const anyFilter = _rdTokFilter !== 'all' || _rdTokTown !== 'all' || _rdTokCategory !== 'all' || _rdTokExtra !== 'all' || !!search;
    const rst = _rdEl('rdTokResetFiltersBtn'); if (rst) rst.style.display = anyFilter ? 'inline-flex' : 'none';
    ['rdTokTownFilter', 'rdTokCategoryFilter', 'rdTokExtraFilter'].forEach(id => {
        const s = _rdEl(id); if (s) s.classList.toggle('active-sel', s.value !== 'all');
    });
    _rdSet('rdTokFilterSummary', `Showing ${total} of ${_rdTokenData.length} token${_rdTokenData.length === 1 ? '' : 's'}`);

    const tbody = _rdEl('rdTokensBody'); if (!tbody) return;
    if (!paged.length) {
        const msg = !_rdTokenData.length
            ? 'No tokens assigned yet. Use <strong>Assign Beneficiary</strong> or <strong>Assign All Active</strong> to get started.'
            : 'No tokens match your filters.';
        tbody.innerHTML = `<tr><td colspan="8"><div class="rd-empty"><div class="rd-empty-icon">🎫</div>
            <div style="font-size:.9rem; font-weight:600; color:var(--text-main);">${msg}</div></div></td></tr>`;
    } else {
        tbody.innerHTML = paged.map(t => {
            const st = RD_TOKEN_STATUS[t.status] || RD_TOKEN_STATUS.pending;
            const isCollected = t.status === 'collected';
            const collAt = t.collected_at
                ? new Date(t.collected_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const sel = _rdTokSelected.has(t.id);
            const actions = isCollected
                ? `<button class="rd-act-btn rd-act-reset" onclick="markRdTokenPending(${t.id})" title="Reset to Pending"><i data-lucide="rotate-ccw" style="width:13px;"></i></button>`
                : `<button class="rd-act-btn rd-act-collect" onclick="markRdTokenCollected(${t.id})" title="Mark Collected"><i data-lucide="check" style="width:13px;"></i></button>
                   <button class="rd-act-btn rd-act-absent" onclick="${t.status === 'absent' ? `markRdTokenPending(${t.id})` : `markRdTokenAbsent(${t.id})`}" title="${t.status === 'absent' ? 'Reset to Pending' : 'Mark Absent'}"><i data-lucide="${t.status === 'absent' ? 'rotate-ccw' : 'user-x'}" style="width:13px;"></i></button>`;
            return `
            <tr class="${sel ? 'rd-row-selected' : ''}">
                <td style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRdTokSelect(${t.id}, this.checked)" style="cursor:pointer;"></td>
                <td class="rd-td-mono">${_rdEsc(t.token_number)}</td>
                <td>
                    <div style="font-weight:700; font-size:.85rem; color:var(--text-main);">${_rdEsc(t.beneficiary_name) || '—'}</div>
                    ${t.contact_number ? `<div class="rd-td-sub">${_rdEsc(t.contact_number)}</div>` : ''}
                </td>
                <td>
                    <div class="rd-td-sub" style="font-family:'Courier New',monospace; margin:0;">${_rdEsc(t.application_number) || '—'}</div>
                    <div class="rd-td-sub" style="font-family:'Courier New',monospace;">${_rdEsc(t.nic_number) || '—'}</div>
                </td>
                <td>
                    <div style="font-size:.82rem;">${_rdEsc(t.home_town) || '—'}</div>
                    ${t.category ? `<div class="rd-td-sub">${_rdEsc(t.category)}</div>` : ''}
                </td>
                <td><span class="status-badge" style="${st.badge} border-radius:6px;">${st.label}</span></td>
                <td>
                    ${isCollected ? `<div class="rd-td-sub" style="margin:0;">${collAt}${t.collected_by_name ? ` · by ${_rdEsc(t.collected_by_name)}` : ''}</div>` : ''}
                    ${t.collector_name ? `<div class="rd-td-sub">Collected by: ${_rdEsc(t.collector_name)}</div>` : ''}
                    ${t.notes ? `<div class="rd-td-sub" style="color:#6366f1;" title="${_rdEsc(t.notes)}">📝 ${_rdEsc(t.notes.length > 40 ? t.notes.slice(0, 40) + '…' : t.notes)}</div>` : ''}
                    ${!isCollected && !t.notes && !t.collector_name ? '<span class="rd-td-sub">—</span>' : ''}
                </td>
                <td class="rd-td-actions">
                    ${actions}
                    <button class="rd-act-btn" onclick="editRdTokenRemarks(${t.id})" title="Edit remarks"><i data-lucide="message-square" style="width:13px;"></i></button>
                    <button class="rd-act-btn rd-act-print" onclick="printRamadanTokens([${t.id}])" title="Print Token"><i data-lucide="printer" style="width:13px;"></i></button>
                    <button class="rd-act-btn rd-act-danger" onclick="removeRdToken(${t.id})" title="Remove"><i data-lucide="trash-2" style="width:13px;"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    _rdRenderTokPagination(total, totalPages);
    _rdSyncTokBulkBar(paged);
    lucide.createIcons();
}

function _rdRenderTokPagination(total, totalPages) {
    const pg = _rdEl('rdPagination'); if (!pg) return;
    const start = total ? (_rdTokPage - 1) * _rdTokPageSize + 1 : 0;
    const end = Math.min(_rdTokPage * _rdTokPageSize, total);
    pg.innerHTML = `<span class="rd-page-info">${total ? `Showing ${start}–${end} of ${total}` : 'No results'}</span>
        <div class="rd-page-btns">${_rdPageButtons(_rdTokPage, totalPages, 'setRdTokPage', 'rd-page-btn')}</div>`;
}

// ── Bulk selection (tokens) ─────────────────────────────────────────────────
function _rdSyncTokBulkBar(pagedRows) {
    _rdEl('rdTokBulkBar')?.classList.toggle('visible', _rdTokSelected.size > 0);
    _rdSet('rdTokBulkCount', _rdTokSelected.size);
    const cb = _rdEl('rdTokSelectAllCb');
    if (cb && pagedRows) {
        const all = pagedRows.length > 0 && pagedRows.every(t => _rdTokSelected.has(t.id));
        cb.checked = all;
        cb.indeterminate = !all && pagedRows.some(t => _rdTokSelected.has(t.id));
    }
}
function toggleRdTokSelect(id, checked) { checked ? _rdTokSelected.add(id) : _rdTokSelected.delete(id); renderRdTokens(); }
function toggleSelectAllRdTokens(checked) {
    const start = (_rdTokPage - 1) * _rdTokPageSize;
    _rdGetFilteredTokens().slice(start, start + _rdTokPageSize).forEach(t => checked ? _rdTokSelected.add(t.id) : _rdTokSelected.delete(t.id));
    renderRdTokens();
}
function clearRdTokSelection() { _rdTokSelected.clear(); renderRdTokens(); }

async function executeRdTokBulkAction(action) {
    const ids = [..._rdTokSelected];
    if (!ids.length) return;
    try {
        let res;
        if (action === 'delete') {
            if (!confirm(`Remove ${ids.length} beneficiary token(s) from this distribution?`)) return;
            res = await fetch('/api/ramadan/tokens/bulk-delete', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_ids: ids })
            });
        } else {
            res = await fetch('/api/ramadan/tokens/bulk-status', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_ids: ids, status: action })
            });
        }
        const r = await res.json();
        if (res.ok) {
            showToast(r.message, 'success');
            _rdTokSelected.clear();
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else showToast(r.message || 'Bulk action failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

// ── Single-token actions ────────────────────────────────────────────────────
async function _rdTokenAction(url, opts, okMsg) {
    try {
        const res = await fetch(url, opts);
        const r = await res.json().catch(() => ({}));
        if (res.ok) {
            if (okMsg) showToast(okMsg, 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
            return true;
        }
        showToast(r.message || 'Failed', 'error');
    } catch (err) { showToast('Network error', 'error'); }
    return false;
}
function markRdTokenCollected(id) { return _rdTokenAction(`/api/ramadan/tokens/${id}/collect`, { method: 'PUT' }, 'Token marked as collected'); }
function markRdTokenAbsent(id) {
    return _rdTokenAction(`/api/ramadan/tokens/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'absent' }) }, 'Marked as absent');
}
function markRdTokenPending(id) {
    return _rdTokenAction(`/api/ramadan/tokens/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) }, 'Reset to pending');
}
async function removeRdToken(id) {
    if (!confirm('Remove this beneficiary from the distribution?')) return;
    return _rdTokenAction(`/api/ramadan/tokens/${id}`, { method: 'DELETE' }, 'Token removed');
}
async function editRdTokenRemarks(id) {
    const t = _rdTokenData.find(x => x.id === id); if (!t) return;
    const notes = prompt(`Remarks for ${t.token_number} (${t.beneficiary_name || ''}):`, t.notes || '');
    if (notes === null) return;
    const collector = prompt('Name of person who collected (leave blank if the beneficiary):', t.collector_name || '');
    if (collector === null) return;
    _rdTokenAction(`/api/ramadan/tokens/${id}/notes`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, collector_name: collector, collector_nic: t.collector_nic || '' })
    }, 'Remarks saved');
}

// ── Assign beneficiaries ────────────────────────────────────────────────────
async function assignAllBeneficiaries() {
    if (!_rdCurrentDistId) return;
    if (!confirm('Issue tokens to ALL remaining Active/Approved beneficiaries?')) return;
    await _rdAssignRequest({});
}
async function _rdAssignRequest(body) {
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-all`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const r = await res.json();
        if (res.ok) { showToast(r.message, 'success'); await fetchRdTokens(); fetchRamadanDistributions(); }
        else showToast(r.message || 'Failed', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}
function toggleRdAssignDrawer(force) {
    const d = _rdEl('rdAssignDrawer'); if (!d) return;
    const open = typeof force === 'boolean' ? force : !d.classList.contains('open');
    d.classList.toggle('open', open);
    _rdSet('rdToggleAssignBtnText', open ? 'Hide Assign Panel' : 'Assign Beneficiary');
    if (open) fetchRdUnassigned();
}
function _rdPopulateAssignFilters() {
    const fill = (id, key, label) => {
        const s = _rdEl(id); if (!s) return;
        const cur = s.value;
        const vals = [...new Set(_rdUnassigned.map(b => (b[key] || '').trim()).filter(Boolean))].sort();
        s.innerHTML = `<option value="all">${label}</option>` + vals.map(v => `<option value="${_rdEsc(v)}">${_rdEsc(v)}</option>`).join('');
        s.value = vals.includes(cur) ? cur : 'all';
    };
    fill('rdAssignTownFilter', 'home_town', 'All Towns');
    fill('rdAssignCatFilter', 'category', 'All Categories');
}
function _rdFilteredUnassigned() {
    const q = (_rdEl('rdAssignSearchInput')?.value || '').trim().toLowerCase();
    const town = _rdEl('rdAssignTownFilter')?.value || 'all';
    const cat = _rdEl('rdAssignCatFilter')?.value || 'all';
    return _rdUnassigned.filter(b => {
        if (town !== 'all' && (b.home_town || '').trim() !== town) return false;
        if (cat !== 'all' && (b.category || '').trim() !== cat) return false;
        if (q) {
            const hay = [b.male_head_name, b.female_head_name, b.nic_number, b.application_number, b.contact_number, b.home_town]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}
function renderRdUnassignedList() {
    const box = _rdEl('rdUnassignedListContainer'); if (!box) return;
    const list = _rdFilteredUnassigned();
    _rdSet('rdAssignFilteredCount', list.length);
    box.innerHTML = list.length ? list.map(b => `
        <div class="rd-unassigned-item">
            <div style="min-width:0;">
                <div style="font-weight:700; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_rdEsc(b.male_head_name) || '—'}</div>
                <div class="rd-td-sub" style="margin:0;">${_rdEsc(b.application_number) || ''}${b.nic_number ? ' · ' + _rdEsc(b.nic_number) : ''}${b.home_town ? ' · ' + _rdEsc(b.home_town) : ''}</div>
            </div>
            <button type="button" class="rd-hdr-btn rd-hdr-btn-emerald" style="padding:.25rem .55rem;" onclick="assignOneUnassignedBeneficiary(${b.id})"><i data-lucide="plus" style="width:12px;"></i> Assign</button>
        </div>`).join('')
        : `<div class="rd-td-sub" style="grid-column:1/-1; padding:.5rem;">${_rdUnassigned.length ? 'No unassigned beneficiaries match the filters.' : 'All Active/Approved beneficiaries already have a token.'}</div>`;
    lucide.createIcons();
}
async function assignFilteredUnassignedBeneficiaries() {
    const list = _rdFilteredUnassigned();
    if (!list.length) { showToast('No beneficiaries to assign', 'error'); return; }
    if (!confirm(`Issue tokens to ${list.length} beneficiar${list.length === 1 ? 'y' : 'ies'}?`)) return;
    await _rdAssignRequest({ beneficiary_ids: list.map(b => b.id) });
}
async function assignOneUnassignedBeneficiary(id) {
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-one`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beneficiary_id: id, collect: false })
        });
        const r = await res.json();
        if (res.ok) { showToast(r.message, 'success'); await fetchRdTokens(); fetchRamadanDistributions(); }
        else showToast(r.message || 'Failed', 'error');
    } catch (e) { showToast('Network error', 'error'); }
}

// ── Optical Camera & Hardware Scanner Engine ────────────────────────────────
let _rdHtml5QrCode = null;
let _rdCameraScanning = false;
let _rdCameraPaused = false;
let _rdAvailableCameras = [];
let _rdActiveCameraId = localStorage.getItem('edf-rd-camera-id') || null;
let _rdAutoCollectEnabled = localStorage.getItem('edf-rd-auto-collect') === 'true';
let _rdGunModeEnabled = localStorage.getItem('edf-rd-gun-mode') === 'true';
let _rdAudioBeepEnabled = localStorage.getItem('edf-rd-audio-beep') !== 'false';
let _rdLastScannedCode = '';
let _rdLastScanTimestamp = 0;
let _rdTorchActive = false;
let _rdAudioCtx = null;

// Synthetic Web Audio API Sound Generator (zero latency, offline)
function _rdPlayBeep(type = 'success') {
    if (!_rdAudioBeepEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!_rdAudioCtx) _rdAudioCtx = new AudioCtx();
        if (_rdAudioCtx.state === 'suspended') _rdAudioCtx.resume();
        const ctx = _rdAudioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            // Pleasant double beep (880Hz then 1760Hz)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'collect') {
            // Upbeat tri-tone arpeggio (C5 -> E5 -> G5)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            gain.gain.setValueAtTime(0.28, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        } else if (type === 'warn') {
            // Warning tone (amber)
            osc.type = 'square';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.setValueAtTime(260, now + 0.12);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
            osc.start(now);
            osc.stop(now + 0.26);
        } else if (type === 'error') {
            // Low buzz (red)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(140, now + 0.12);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (_) {}
}

// Clean and parse raw scanned payload from QR / Barcode / PVC ID card / URL / JSON
function _rdParseScannedPayload(raw) {
    if (!raw) return '';
    let str = String(raw).trim();

    // Check JSON payload
    if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
        try {
            const parsed = JSON.parse(str);
            if (parsed.token) return parsed.token;
            if (parsed.token_number) return parsed.token_number;
            if (parsed.nic) return parsed.nic;
            if (parsed.nic_number) return parsed.nic_number;
            if (parsed.app) return parsed.app;
            if (parsed.application_number) return parsed.application_number;
            if (parsed.id) return String(parsed.id);
        } catch (_) {}
    }

    // Check URL payload
    if (str.startsWith('http://') || str.startsWith('https://')) {
        try {
            const u = new URL(str);
            const t = u.searchParams.get('token') || u.searchParams.get('token_number') || u.searchParams.get('nic') || u.searchParams.get('q');
            if (t) return t.trim();
        } catch (_) {}
    }

    // Check EDF PVC Beneficiary Card format: EDF-BEN|appNum|Name|NIC:xxx|...
    if (str.startsWith('EDF-BEN|')) {
        const parts = str.split('|');
        for (const p of parts) {
            if (p.startsWith('NIC:')) {
                const nic = p.slice(4).trim();
                if (nic && nic !== 'N/A') return nic;
            }
        }
        if (parts[1]) return parts[1].trim();
    }

    // Check prefixed token formats
    const prefixMatch = str.match(/^(?:EDF:TOKEN:|EDF-TOKEN:|TOKEN:|RMD-TOKEN:)\s*([A-Za-z0-9\-_]+)$/i);
    if (prefixMatch) return prefixMatch[1].trim();

    return str;
}

// Toggle Auto-Collect on Scan
function rdToggleAutoCollect(val) {
    _rdAutoCollectEnabled = Boolean(val);
    localStorage.setItem('edf-rd-auto-collect', _rdAutoCollectEnabled ? 'true' : 'false');
    const chip = _rdEl('rdAutoCollectCheck')?.closest('.rd-toggle-chip');
    if (chip) chip.classList.toggle('active', _rdAutoCollectEnabled);
    if (_rdAutoCollectEnabled) {
        showToast('Auto-Collect ON: Scanning a valid pending token will disburse instantly', 'info');
    }
}

// Toggle Handheld Scanner Gun Mode (keeps focus locked to input)
function rdToggleGunMode(val) {
    _rdGunModeEnabled = Boolean(val);
    localStorage.setItem('edf-rd-gun-mode', _rdGunModeEnabled ? 'true' : 'false');
    _rdApplyGunMode(_rdGunModeEnabled);
}

function _rdApplyGunMode(active) {
    const chip = _rdEl('rdGunModeChip');
    if (chip) chip.classList.toggle('active', active);
    const inp = _rdEl('rdVerifyNic');
    if (active && inp) {
        inp.focus();
        showToast('Handheld Gun Mode ACTIVE: Focus locked to scanner input', 'info');
    }
}

// Toggle Audio Beep
function rdToggleAudioBeep(val) {
    _rdAudioBeepEnabled = Boolean(val);
    localStorage.setItem('edf-rd-audio-beep', _rdAudioBeepEnabled ? 'true' : 'false');
    if (_rdAudioBeepEnabled) _rdPlayBeep('success');
}

// Camera Drawer toggle
async function toggleRdCameraDrawer(forceState) {
    const drawer = _rdEl('rdCameraDrawer');
    const btn = _rdEl('rdCameraToggleBtn');
    const btnText = _rdEl('rdCameraBtnText');
    if (!drawer) return;

    const shouldOpen = (forceState !== undefined) ? Boolean(forceState) : (drawer.style.display === 'none' || !drawer.style.display);
    if (shouldOpen) {
        drawer.style.display = 'block';
        if (btn) btn.classList.add('active');
        if (btnText) btnText.textContent = 'Close Camera';
        await startRdCameraScanner();
    } else {
        await stopRdCameraScanner();
        drawer.style.display = 'none';
        if (btn) btn.classList.remove('active');
        if (btnText) btnText.textContent = 'Scan Camera';
    }
    if (window.lucide) lucide.createIcons();
}

// Start Camera Stream with device enumeration
async function startRdCameraScanner(preferredCameraId = null) {
    const badge = _rdEl('rdCamStatusBadge');
    const dot = _rdEl('rdCamPulseDot');
    const select = _rdEl('rdCameraDeviceSelect');

    if (typeof Html5Qrcode === 'undefined') {
        if (badge) badge.textContent = 'Library Loading...';
        showToast('Camera scanner library is initializing. Please try again in a moment.', 'info');
        return;
    }

    try {
        if (badge) badge.textContent = 'Detecting Cameras...';
        _rdAvailableCameras = await Html5Qrcode.getCameras();
        if (!_rdAvailableCameras || !_rdAvailableCameras.length) {
            if (badge) badge.textContent = 'No Camera';
            if (dot) dot.className = 'rd-cam-pulse-dot stopped';
            showToast('No cameras detected. Connect a webcam or external camera device.', 'error');
            return;
        }

        // Populate camera selector
        if (select) {
            select.innerHTML = _rdAvailableCameras.map((cam, idx) => {
                const label = cam.label || `Camera ${idx + 1} (${cam.id.slice(0, 8)}...)`;
                const isUsb = /usb|external|logi|hd web/i.test(label);
                return `<option value="${cam.id}">${isUsb ? '📹 ' : '📷 '}${_rdEsc(label)}</option>`;
            }).join('');
        }

        // Determine camera target
        let targetId = preferredCameraId || _rdActiveCameraId;
        const exists = _rdAvailableCameras.some(c => c.id === targetId);
        if (!exists) {
            // Default to USB / external camera if detected, otherwise first camera
            const usbCam = _rdAvailableCameras.find(c => /usb|external|logitech/i.test(c.label));
            targetId = usbCam ? usbCam.id : _rdAvailableCameras[0].id;
        }
        _rdActiveCameraId = targetId;
        if (select) select.value = targetId;
        localStorage.setItem('edf-rd-camera-id', targetId);

        // Clear existing instance if running
        if (_rdHtml5QrCode) {
            try {
                if (_rdHtml5QrCode.isScanning) await _rdHtml5QrCode.stop();
                _rdHtml5QrCode.clear();
            } catch (_) {}
        }

        // Initialize with explicit multi-format support
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.ITF
        ];

        _rdHtml5QrCode = new Html5Qrcode("rdCameraViewfinder", {
            formatsToSupport,
            verbose: false
        });

        // Config: generous wide scanning zone (no 220x220 crop clipping) + HD camera preference
        const config = {
            fps: 20,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                return {
                    width: Math.min(viewfinderWidth - 12, Math.max(280, Math.floor(viewfinderWidth * 0.92))),
                    height: Math.min(viewfinderHeight - 12, Math.max(190, Math.floor(viewfinderHeight * 0.86)))
                };
            },
            disableFlip: false,
            videoConstraints: {
                deviceId: { exact: targetId },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                focusMode: { ideal: "continuous" }
            }
        };

        let _rdFrameCount = 0;
        await _rdHtml5QrCode.start(
            targetId,
            config,
            (decodedText, decodedResult) => {
                _rdOnCodeScanned(decodedText, decodedResult);
            },
            (errorMsg) => {
                _rdFrameCount++;
                if (_rdFrameCount % 20 === 0) {
                    const resBadge = _rdEl('rdCamResBadge');
                    if (resBadge) {
                        const video = document.querySelector('#rdCameraViewfinder video');
                        if (video && video.videoWidth) {
                            resBadge.textContent = `${video.videoWidth}×${video.videoHeight} • Ready`;
                        } else {
                            resBadge.textContent = `Streaming (${_rdFrameCount} frames)`;
                        }
                    }
                }
            }
        );

        _rdCameraScanning = true;
        _rdCameraPaused = false;
        if (badge) badge.textContent = 'Scanning Live';
        if (dot) dot.className = 'rd-cam-pulse-dot';

        // Check torch capabilities
        const torchBtn = _rdEl('rdTorchBtn');
        if (torchBtn) {
            try {
                const track = _rdHtml5QrCode.getRunningTrackCameraCapabilities();
                torchBtn.style.display = track?.torch ? 'inline-flex' : 'none';
            } catch (_) { torchBtn.style.display = 'none'; }
        }
    } catch (err) {
        console.error('Camera start error:', err);
        if (badge) badge.textContent = 'Permission Denied / Busy';
        if (dot) dot.className = 'rd-cam-pulse-dot stopped';
        showToast('Unable to start camera. Please verify camera permissions or check if another application is using it.', 'error');
    }
}

// Stop Camera Stream cleanly
async function stopRdCameraScanner() {
    if (_rdHtml5QrCode) {
        try {
            if (_rdHtml5QrCode.isScanning) {
                await _rdHtml5QrCode.stop();
            }
            _rdHtml5QrCode.clear();
        } catch (err) {
            console.warn('Camera stop err:', err);
        }
        _rdHtml5QrCode = null;
    }
    _rdCameraScanning = false;
    _rdCameraPaused = false;
    _rdTorchActive = false;
    _rdMirrored = false;
    const badge = _rdEl('rdCamStatusBadge');
    if (badge) badge.textContent = 'Off';
    const dot = _rdEl('rdCamPulseDot');
    if (dot) dot.className = 'rd-cam-pulse-dot stopped';
    const resBadge = _rdEl('rdCamResBadge');
    if (resBadge) resBadge.textContent = 'Camera Off';
}

// Flip/Mirror Camera (fixes backwards scan on selfie webcams)
let _rdMirrored = false;
function rdToggleMirror() {
    _rdMirrored = !_rdMirrored;
    const video = document.querySelector('#rdCameraViewfinder video');
    const btn = _rdEl('rdMirrorBtn');
    if (video) video.style.transform = _rdMirrored ? 'scaleX(-1)' : 'none';
    if (btn) btn.classList.toggle('active', _rdMirrored);
    showToast(_rdMirrored ? 'Camera Mirrored (Horizontal Flip)' : 'Camera Normal (Un-mirrored)', 'info');
}

// Scan uploaded image file / snapshot
async function rdScanFile(input) {
    const file = input?.files?.[0];
    if (!file) return;
    try {
        showToast('Analyzing image for QR code or Barcode...', 'info');
        let scanner = _rdHtml5QrCode;
        let createdTemporary = false;
        if (!scanner) {
            scanner = new Html5Qrcode("rdCameraViewfinder", {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.UPC_A
                ],
                verbose: false
            });
            createdTemporary = true;
        }
        const decodedText = await scanner.scanFile(file, true);
        if (decodedText) {
            _rdOnCodeScanned(decodedText, { result: decodedText });
        }
        if (createdTemporary && !_rdCameraScanning) {
            scanner.clear();
        }
    } catch (err) {
        _rdPlayBeep('error');
        showToast('Could not detect QR code or Barcode in this image. Please ensure code is clear and in focus.', 'error');
    } finally {
        input.value = '';
    }
}

// Switch Camera Device (e.g. built-in webcam to external USB camera)
async function rdSwitchCameraDevice(cameraId) {
    if (!cameraId || cameraId === _rdActiveCameraId) return;
    _rdActiveCameraId = cameraId;
    localStorage.setItem('edf-rd-camera-id', cameraId);
    await startRdCameraScanner(cameraId);
}

// Pause or Resume scanning
function rdTogglePauseScan() {
    if (!_rdHtml5QrCode || !_rdCameraScanning) return;
    const btn = _rdEl('rdPauseScanBtn');
    const badge = _rdEl('rdCamStatusBadge');
    const dot = _rdEl('rdCamPulseDot');

    if (!_rdCameraPaused) {
        _rdHtml5QrCode.pause();
        _rdCameraPaused = true;
        if (btn) { btn.classList.add('active'); btn.innerHTML = '<i data-lucide="play" style="width:13px;"></i>'; }
        if (badge) badge.textContent = 'Paused';
        if (dot) dot.className = 'rd-cam-pulse-dot paused';
    } else {
        _rdHtml5QrCode.resume();
        _rdCameraPaused = false;
        if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i data-lucide="pause" style="width:13px;"></i>'; }
        if (badge) badge.textContent = 'Scanning Live';
        if (dot) dot.className = 'rd-cam-pulse-dot';
    }
    if (window.lucide) lucide.createIcons();
}

// Toggle torch / flashlight
async function rdToggleTorch() {
    if (!_rdHtml5QrCode || !_rdCameraScanning) return;
    const btn = _rdEl('rdTorchBtn');
    _rdTorchActive = !_rdTorchActive;
    try {
        await _rdHtml5QrCode.applyVideoConstraints({ advanced: [{ torch: _rdTorchActive }] });
        if (btn) btn.classList.toggle('active', _rdTorchActive);
    } catch (_) {}
}

// Callback when QR Code or Barcode is decoded
function _rdOnCodeScanned(decodedText, decodedResult) {
    if (!decodedText) return;
    const now = Date.now();
    const clean = _rdParseScannedPayload(decodedText);

    // Debounce duplicate scans within 1.5s
    if (clean === _rdLastScannedCode && (now - _rdLastScanTimestamp < 1500)) {
        return;
    }
    _rdLastScannedCode = clean;
    _rdLastScanTimestamp = now;

    // Visual scan flash
    const flash = _rdEl('rdScanFlash');
    if (flash) {
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 160);
    }

    // Audio chime
    _rdPlayBeep('success');

    // Show last scanned badge
    const badge = _rdEl('rdLastScannedCodeBadge');
    if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = `Scanned: ${clean}`;
    }

    // Populate input field
    const inp = _rdEl('rdVerifyNic');
    if (inp) inp.value = clean;

    // Trigger verification (with auto-collect if enabled)
    verifyBeneficiaryNic();
}

// Global Hardware Barcode/QR Scanner HID Keyboard Listener
let _rdHwBuffer = '';
let _rdHwLastKeyTime = 0;

window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('ramadanTokensModal');
    if (!modal || modal.style.display === 'none') return;

    // If typing in another input (like town filter or search), don't intercept unless it's a very fast scanner stream
    const target = e.target;
    const isOtherInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') && target.id !== 'rdVerifyNic';

    const now = Date.now();
    const diff = now - _rdHwLastKeyTime;
    _rdHwLastKeyTime = now;

    if (e.key === 'Enter') {
        if (_rdHwBuffer.length >= 3 && diff < 85) {
            e.preventDefault();
            const scanned = _rdHwBuffer;
            _rdHwBuffer = '';
            const clean = _rdParseScannedPayload(scanned);
            const inp = _rdEl('rdVerifyNic');
            if (inp) {
                inp.value = clean;
                inp.focus();
            }
            _rdPlayBeep('success');
            verifyBeneficiaryNic();
        } else {
            _rdHwBuffer = '';
        }
        return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (diff < 85 || _rdHwBuffer.length === 0) {
            _rdHwBuffer += e.key;
        } else {
            _rdHwBuffer = e.key;
        }
    }
});

// Gun Mode focus keeper (re-focuses #rdVerifyNic on clicks)
document.addEventListener('click', (e) => {
    if (!_rdGunModeEnabled) return;
    const modal = document.getElementById('ramadanTokensModal');
    if (!modal || modal.style.display === 'none') return;

    const target = e.target;
    const isInteractive = target.closest('input, textarea, select, button, a, label, .rd-stat-pill');
    if (!isInteractive || target.id === 'ramadanTokensModal') {
        const inp = _rdEl('rdVerifyNic');
        if (inp && document.activeElement !== inp) inp.focus();
    }
});

// Close modal & cleanly release camera streams
async function closeRamadanTokensModal() {
    await stopRdCameraScanner();
    const drawer = _rdEl('rdCameraDrawer');
    if (drawer) drawer.style.display = 'none';
    const btn = _rdEl('rdCameraToggleBtn');
    if (btn) btn.classList.remove('active');
    const btnText = _rdEl('rdCameraBtnText');
    if (btnText) btnText.textContent = 'Scan Camera';
    closeModal('ramadanTokensModal');
}

// ── Fast verify & collect ───────────────────────────────────────────────────
function clearRdVerifyStrip() {
    const i = _rdEl('rdVerifyNic'); if (i) { i.value = ''; i.focus(); }
    const r = _rdEl('rdVerifyResult'); if (r) { r.style.display = 'none'; r.innerHTML = ''; }
}

async function verifyBeneficiaryNic() {
    const q = (_rdEl('rdVerifyNic')?.value || '').trim();
    const el = _rdEl('rdVerifyResult');
    if (!q) { showToast('Enter a token #, NIC, ID, application number, phone, or name', 'error'); return; }
    if (!_rdCurrentDistId) return;

    const box = (bg, border, inner) => `<div style="padding:0.9rem 1.15rem; background:${bg}; border:1px solid ${border}; border-radius:14px; margin:.4rem 0;">${inner}</div>`;
    el.style.display = 'block';
    el.innerHTML = box('var(--input-bg)', 'var(--border-color)', '<span style="color:var(--text-muted); font-size:.875rem;"><i data-lucide="loader" style="width:14px;animation:spin 1s linear infinite;"></i> Searching token database…</span>');
    if (window.lucide) lucide.createIcons();

    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/verify/${encodeURIComponent(q)}`);
        const data = await res.json();

        if (!res.ok) {
            _rdPlayBeep('error');
            if (data.ineligible) {
                el.innerHTML = box('#fee2e2', 'rgba(239,68,68,0.4)', `
                    <div style="display:flex; align-items:center; gap:.75rem;">
                        <i data-lucide="shield-x" style="width:22px; height:22px; color:#ef4444; flex-shrink:0;"></i>
                        <div>
                            <div style="font-weight:800; color:#991b1b; font-size:0.95rem;">${_rdEsc(data.beneficiary?.male_head_name || 'Beneficiary Ineligible')}</div>
                            <div style="font-size:.82rem; color:#b91c1c; margin-top:2px;">${_rdEsc(data.message)}</div>
                        </div>
                    </div>`);
            } else if (data.beneficiary && data.beneficiary.id) {
                const b = data.beneficiary;
                el.innerHTML = box('#fefce8', 'rgba(245,158,11,0.4)', `
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.75rem;">
                        <div>
                            <div style="font-weight:800; font-size:1rem; color:#713f12;">${_rdEsc(b.male_head_name) || '—'}</div>
                            <div style="font-size:.8rem; color:#92400e; margin-top:2px;">
                                Active beneficiary, but not yet issued a token for this distribution${b.home_town ? ' · ' + _rdEsc(b.home_town) : ''}${b.nic_number ? ' · NIC: ' + _rdEsc(b.nic_number) : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
                            <button class="btn" style="background:#fef3c7; color:#92400e; border:1px solid rgba(245,158,11,.4); font-size:.82rem; padding:.45rem .9rem;" onclick="addAndCollectBeneficiary(${b.id}, false)">
                                <i data-lucide="plus-circle"></i> Issue Token
                            </button>
                            <button class="btn btn-primary" style="font-size:.82rem; padding:.45rem .9rem;" onclick="addAndCollectBeneficiary(${b.id}, true)">
                                <i data-lucide="check-circle"></i> Issue &amp; Collect Now
                            </button>
                        </div>
                    </div>`);
            } else {
                el.innerHTML = box('#fee2e2', 'rgba(239,68,68,0.4)', `
                    <div style="display:flex; align-items:center; gap:.75rem;">
                        <i data-lucide="alert-circle" style="width:20px; height:20px; color:#ef4444; flex-shrink:0;"></i>
                        <div>
                            <div style="font-weight:800; color:#991b1b; font-size:0.92rem;">Verification Failed</div>
                            <span style="font-size:.84rem; color:#b91c1c;">${_rdEsc(data.message || 'No matching token found')}</span>
                        </div>
                    </div>`);
            }
            if (window.lucide) lucide.createIcons();
            return;
        }

        const isCollected = data.status === 'collected';
        const collectedAt = data.collected_at ? new Date(data.collected_at).toLocaleString('en-GB') : null;

        // If ALREADY COLLECTED
        if (isCollected) {
            _rdPlayBeep('warn');
            el.innerHTML = box('#fef3c7', 'rgba(245,158,11,0.4)', `
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="status-badge" style="background:#fef3c7; color:#92400e; border:1px solid #f59e0b; font-weight:800; text-transform:uppercase;">Already Collected</span>
                            <span style="font-family:monospace; font-weight:800; font-size:0.95rem; color:#78350f;">${_rdEsc(data.token_number)}</span>
                        </div>
                        <div style="font-weight:800; font-size:1.05rem; color:#78350f; margin-top:3px;">${_rdEsc(data.beneficiary_name) || '—'}</div>
                        <div style="font-size:0.8rem; color:#92400e; margin-top:2px;">
                            Disbursed on <strong>${_rdEsc(collectedAt)}</strong>${data.collected_by_name ? ' by Staff: ' + _rdEsc(data.collected_by_name) : ''}
                            ${data.collector_name ? ' · Received by: <strong>' + _rdEsc(data.collector_name) + '</strong>' + (data.collector_nic ? ' (NIC: ' + _rdEsc(data.collector_nic) + ')' : '') : ''}
                        </div>
                        ${data.notes ? `<div style="font-size:0.78rem; color:#92400e; margin-top:3px;">Remarks: ${_rdEsc(data.notes)}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <button class="btn" style="font-size:0.8rem; padding:0.4rem 0.8rem;" onclick="editRdTokenRemarks(${data.id})">
                            <i data-lucide="edit-3" style="width:13px;"></i> Edit Collector / Remarks
                        </button>
                        <button class="btn" style="font-size:0.8rem; padding:0.4rem 0.7rem;" onclick="clearRdVerifyStrip()">Done</button>
                    </div>
                </div>`);
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Token is PENDING:
        // Check if Auto-Collect is ON!
        if (_rdAutoCollectEnabled) {
            // Immediate collection!
            const markOk = await _rdTokenAction(`/api/ramadan/tokens/${data.id}/collect`, { method: 'PUT' }, null, false);
            if (markOk) {
                _rdPlayBeep('collect');
                const dist = _rdCurrentDist() || {};
                el.innerHTML = `
                    <div class="rd-auto-collect-banner">
                        <div class="rd-ac-icon"><i data-lucide="check-check" style="width:24px;height:24px;"></i></div>
                        <div class="rd-ac-content">
                            <div class="rd-ac-title">✅ Token Disbursed &amp; Collected Successfully!</div>
                            <div class="rd-ac-name">${_rdEsc(data.beneficiary_name || 'Beneficiary')} &bull; <span style="font-family:monospace;">${_rdEsc(data.token_number)}</span></div>
                            <div class="rd-ac-meta">
                                ${data.application_number ? 'App# ' + _rdEsc(data.application_number) + ' &bull; ' : ''}
                                ${data.nic_number ? 'NIC: ' + _rdEsc(data.nic_number) + ' &bull; ' : ''}
                                ${data.home_town ? _rdEsc(data.home_town) + ' &bull; ' : ''}
                                Package: <strong>${_rdEsc(_rdPkgLabel(dist.package_type))}</strong>
                                ${dist.voucher_value ? ' &bull; Value: ' + _rdEsc(_rdMoney(dist.voucher_value)) : ''}
                            </div>
                        </div>
                        <div style="display:flex; gap:0.4rem;">
                            <button type="button" class="rd-hdr-btn" onclick="editRdTokenRemarks(${data.id})">Add Proxy / Remarks</button>
                            <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" onclick="clearRdVerifyStrip()">Next Scan</button>
                        </div>
                    </div>`;
                if (window.lucide) lucide.createIcons();
                // Clear input after a short delay so scanner is ready for the next person
                setTimeout(() => {
                    const inp = _rdEl('rdVerifyNic');
                    if (inp) { inp.value = ''; inp.focus(); }
                }, 1400);
                return;
            }
        }

        // Auto-Collect is OFF: Show Verification Review Card with manual collect button
        _rdPlayBeep('success');
        const dist = _rdCurrentDist() || {};
        el.innerHTML = box('var(--input-bg)', 'var(--border-color)', `
            <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                <div style="flex:1; min-width:260px;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge" style="background:#fef3c7; color:#d97706; border:1px solid #f59e0b; font-weight:800; text-transform:uppercase;">Pending Collection</span>
                        <span style="font-family:monospace; font-weight:800; font-size:1.05rem; color:var(--text-main);">${_rdEsc(data.token_number)}</span>
                        ${dist.voucher_value ? `<span class="rd-mini-chip" style="color:#10b981; font-weight:800;">${_rdEsc(_rdMoney(dist.voucher_value))}</span>` : ''}
                    </div>
                    <div style="font-weight:800; font-size:1.15rem; color:var(--text-main); margin-top:4px;">${_rdEsc(data.beneficiary_name) || '—'}</div>
                    <div style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">
                        ${data.application_number ? 'App# <strong>' + _rdEsc(data.application_number) + '</strong> &bull; ' : ''}
                        ${data.nic_number ? 'NIC: <strong>' + _rdEsc(data.nic_number) + '</strong> &bull; ' : ''}
                        ${data.contact_number ? 'Phone: <strong>' + _rdEsc(data.contact_number) + '</strong> &bull; ' : ''}
                        ${data.home_town ? 'Town: ' + _rdEsc(data.home_town) : ''}
                    </div>
                    ${dist.package_items ? `<div style="font-size:0.78rem; color:#6366f1; margin-top:4px; font-weight:600;">📦 Pack Items: ${_rdEsc(dist.package_items)}</div>` : ''}

                    <!-- Optional Proxy Collector Accordion -->
                    <div style="margin-top:0.6rem; border-top:1px dashed var(--border-color); padding-top:0.5rem;">
                        <details style="font-size:0.78rem; color:var(--text-muted);">
                            <summary style="cursor:pointer; font-weight:700; color:#6366f1;">
                                <i data-lucide="user-check" style="width:13px;vertical-align:middle;"></i> Proxy Collector Details (If collected on behalf)
                            </summary>
                            <div style="display:flex; gap:0.5rem; margin-top:0.4rem; flex-wrap:wrap;">
                                <input type="text" id="rdCollectorNameInput" class="rd-sel" style="cursor:text; min-width:180px;" placeholder="Collector Full Name" value="${_rdEsc(data.collector_name || '')}">
                                <input type="text" id="rdCollectorNicInput" class="rd-sel" style="cursor:text; min-width:140px;" placeholder="Collector NIC" value="${_rdEsc(data.collector_nic || '')}">
                                <input type="text" id="rdCollectorNotesInput" class="rd-sel" style="cursor:text; min-width:180px;" placeholder="Notes / Remarks" value="${_rdEsc(data.notes || '')}">
                            </div>
                        </details>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.45rem; align-items:flex-end;">
                    <button class="btn btn-primary" onclick="confirmRdTokenCollection(${data.id})" style="font-size:0.92rem; padding:0.6rem 1.25rem; font-weight:800; background:#10b981; border-color:#059669;">
                        <i data-lucide="check-circle" style="width:16px;"></i> Confirm &amp; Mark Collected
                    </button>
                    <div style="display:flex; gap:0.4rem;">
                        <button class="btn" style="font-size:0.78rem; padding:0.35rem 0.7rem; color:#ef4444;" onclick="markRdTokenAbsent(${data.id}).then(()=>clearRdVerifyStrip())">Mark Absent</button>
                        <button class="btn" style="font-size:0.78rem; padding:0.35rem 0.7rem;" onclick="clearRdVerifyStrip()">Dismiss</button>
                    </div>
                </div>
            </div>`);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        _rdPlayBeep('error');
        el.innerHTML = box('#fee2e2', 'rgba(239,68,68,0.4)', '<span style="font-size:.875rem; color:#991b1b;">Network error. Please try again.</span>');
    }
}

async function confirmRdTokenCollection(tokenId) {
    const colName = (_rdEl('rdCollectorNameInput')?.value || '').trim();
    const colNic  = (_rdEl('rdCollectorNicInput')?.value || '').trim();
    const notes   = (_rdEl('rdCollectorNotesInput')?.value || '').trim();

    const ok = await _rdTokenAction(`/api/ramadan/tokens/${tokenId}/collect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collector_name: colName || null, collector_nic: colNic || null, notes: notes || null })
    }, 'Token marked as collected');

    if (ok) {
        _rdPlayBeep('collect');
        clearRdVerifyStrip();
    }
}

async function addAndCollectBeneficiary(beneficiaryId, collect) {
    if (!_rdCurrentDistId) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-one`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beneficiary_id: beneficiaryId, collect })
        });
        const r = await res.json();
        if (res.ok) {
            _rdPlayBeep(collect ? 'collect' : 'success');
            showToast(r.message, 'success');
            clearRdVerifyStrip();
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            _rdPlayBeep('error');
            showToast(r.message || 'Failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Export / Print (Tokens & Checklists) ────────────────────────────────────
function exportRdTokens(format) {
    const dist = _rdCurrentDist() || {};
    const rows = _rdGetFilteredTokens().map(t => ({
        'Token #': t.token_number, 'Beneficiary': t.beneficiary_name || '', 'Spouse': t.female_head_name || '',
        'Application #': t.application_number || '', 'NIC': t.nic_number || '', 'Phone': t.contact_number || '',
        'Town': t.home_town || '', 'Category': t.category || '', 'Status': t.status,
        'Collected At': t.collected_at ? new Date(t.collected_at).toLocaleString('en-GB') : '',
        'Collected By (Staff)': t.collected_by_name || '', 'Collector Name': t.collector_name || '',
        'Voucher Value (LKR)': Number(dist.voucher_value) || 0, 'Remarks': t.notes || '',
    }));
    const safe = String(dist.title || 'Tokens').replace(/[^\w\-]+/g, '_');
    _rdExportRows(rows, `EDF_${safe}_Tokens_${_rdIsoToday()}`, format, 'Tokens');
}

function printSelectedRdTokens() {
    if (!_rdTokSelected.size) return;
    printRamadanTokens([..._rdTokSelected]);
}

function printRamadanChecklist() {
    const dist = _rdCurrentDist() || {};
    const rows = _rdGetFilteredTokens();
    if (!rows.length) { showToast('No tokens to print', 'error'); return; }
    const org = JSON.parse(localStorage.getItem('edf-org-settings') || '{}');
    const body = rows.map((t, i) => `
        <tr><td>${i + 1}</td><td class="m">${_rdEsc(t.token_number)}</td><td>${_rdEsc(t.beneficiary_name)}</td>
        <td class="m">${_rdEsc(t.nic_number)}</td><td>${_rdEsc(t.contact_number)}</td><td>${_rdEsc(t.home_town)}</td>
        <td>${t.status === 'collected' ? '✔ Collected' : t.status === 'absent' ? 'Absent' : ''}</td><td class="sig"></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Checklist – ${_rdEsc(dist.title || '')}</title>
<style>
 body{font-family:'Segoe UI',Arial,sans-serif; padding:12mm; color:#111;}
 h1{font-size:16px; margin:0;} .sub{font-size:11px; color:#555; margin:3px 0 10px;}
 table{width:100%; border-collapse:collapse; font-size:10.5px;}
 th,td{border:1px solid #999; padding:5px 6px; text-align:left;} th{background:#eee;}
 .m{font-family:'Courier New',monospace;} .sig{width:130px;}
 tr{page-break-inside:avoid;} .np{margin-bottom:8px;}
 @media print{.np{display:none;} body{padding:6mm;}}
</style></head><body>
<div class="np"><button onclick="window.print()">Print</button></div>
<h1>${_rdEsc(org.name || 'EDF Galgamuwa')} – ${_rdEsc(dist.title || 'Ramadan Distribution')}</h1>
<div class="sub">${_rdEsc(dist.year || '')} · ${_rdEsc(_rdFmtDate(dist.collection_date))}${dist.collection_time ? ' · ' + _rdEsc(dist.collection_time) : ''} · ${_rdEsc(dist.collection_location || '')} · ${rows.length} beneficiaries</div>
<table><thead><tr><th>#</th><th>Token</th><th>Beneficiary</th><th>NIC</th><th>Phone</th><th>Town</th><th>Status</th><th>Signature</th></tr></thead><tbody>${body}</tbody></table>
<script>window.onload=()=>window.print();<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to print', 'error'); return; }
    win.document.write(html); win.document.close();
}

// Generate Scannable QR Code Data URL (using QRCode library with SVG fallback)
function _rdGenerateQrDataUrl(text, size = 90) {
    if (typeof QRCode === 'undefined') {
        if (typeof _generateReceiptQrSvg === 'function') {
            const svgStr = _generateReceiptQrSvg(text, size);
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr);
        }
        return '';
    }
    try {
        const holder = document.createElement('div');
        holder.style.position = 'absolute';
        holder.style.left = '-9999px';
        holder.style.top = '-9999px';
        document.body.appendChild(holder);

        new QRCode(holder, {
            text: String(text || ''),
            width: size,
            height: size,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });

        const img = holder.querySelector('img');
        const canvas = holder.querySelector('canvas');
        let dataUrl = '';
        if (img && img.src && img.src.startsWith('data:')) {
            dataUrl = img.src;
        } else if (canvas && canvas.toDataURL) {
            dataUrl = canvas.toDataURL('image/png');
        }
        document.body.removeChild(holder);
        return dataUrl;
    } catch (err) {
        console.warn('QR error:', err);
        return '';
    }
}

// Generate Vector Code-128 Barcode SVG (using JsBarcode with SVG fallback)
function _rdGenerateBarcodeSvg(text) {
    if (typeof JsBarcode === 'undefined') {
        if (typeof _generateCode128BarcodeSvg === 'function') {
            return _generateCode128BarcodeSvg(text);
        }
        return '';
    }
    try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, String(text || '').toUpperCase(), {
            format: "CODE128",
            width: 1.5,
            height: 26,
            displayValue: false,
            margin: 0,
            lineColor: "#0f172a"
        });
        return svg.outerHTML;
    } catch (err) {
        if (typeof _generateCode128BarcodeSvg === 'function') {
            return _generateCode128BarcodeSvg(text);
        }
        return '';
    }
}

// Official Beneficiary Token Voucher Cards with Scannable QR & Code-128 Barcode
function printRamadanTokens(tokenIds = null) {
    const tokens = tokenIds ? _rdTokenData.filter(t => tokenIds.includes(t.id)) : _rdGetFilteredTokens();
    if (!tokens.length) { showToast('No tokens to print', 'error'); return; }

    const dist = _rdCurrentDist() || {};
    const org = JSON.parse(localStorage.getItem('edf-org-settings') || '{}');
    const orgName = org.name || 'EDF Galgamuwa';
    const collDate = dist.collection_date ? _rdFmtDate(dist.collection_date, { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const when = collDate + (dist.collection_time ? ' · ' + dist.collection_time : '');
    const pkgLabel = _rdPkgLabel(dist.package_type);

    const cards = tokens.map(t => {
        const qrDataUrl = _rdGenerateQrDataUrl(t.token_number, 84);
        const barcodeSvg = _rdGenerateBarcodeSvg(t.token_number);

        return `
        <div class="token-card">
            <div class="tk-header">
                <div class="tk-logo"><span>EDF</span></div>
                <div class="tk-org">
                    <div class="tk-org-name">${_rdEsc(orgName)}</div>
                    <div class="tk-org-sub">Ramadan ${_rdEsc(pkgLabel)} Distribution</div>
                </div>
                <div class="tk-year">${_rdEsc(dist.year || '')}${dist.hijri_year ? ' · ' + _rdEsc(dist.hijri_year) : ''}</div>
            </div>
            <div class="tk-body">
                <div class="tk-body-left">
                    <div class="tk-label-sm">OFFICIAL TOKEN NUMBER</div>
                    <div class="tk-token-no">${_rdEsc(t.token_number)}</div>
                    <div class="tk-dist-title">${_rdEsc(dist.title || 'Ramadan Distribution')}${dist.voucher_value ? ' · ' + _rdEsc(_rdMoney(dist.voucher_value)) : ''}</div>
                    ${barcodeSvg ? `<div class="tk-barcode-wrap">${barcodeSvg}</div>` : ''}
                </div>
                <div class="tk-body-right">
                    ${qrDataUrl ? `
                        <div class="tk-qr-wrap">
                            <img src="${qrDataUrl}" alt="QR" class="tk-qr-img">
                            <span class="tk-qr-lbl">SCAN TO VERIFY</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="tk-details">
                <div class="tk-detail-cell"><div class="tk-detail-label">BENEFICIARY</div><div class="tk-detail-value">${_rdEsc(t.beneficiary_name) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">APPLICATION #</div><div class="tk-detail-value mono">${_rdEsc(t.application_number) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">NIC NUMBER</div><div class="tk-detail-value mono">${_rdEsc(t.nic_number) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">COLLECTION</div><div class="tk-detail-value">${_rdEsc(when)}</div></div>
                ${dist.collection_location ? `<div class="tk-detail-cell"><div class="tk-detail-label">LOCATION</div><div class="tk-detail-value">${_rdEsc(dist.collection_location)}</div></div>` : ''}
                ${dist.package_items ? `<div class="tk-detail-cell tk-wide"><div class="tk-detail-label">PACK CONTENTS</div><div class="tk-detail-value tk-wrap">${_rdEsc(dist.package_items)}</div></div>` : ''}
            </div>
            <div class="tk-footer">
                <span>Present this token with your NIC at the collection point.${dist.coordinator_phone ? ' Coordinator: ' + _rdEsc(dist.coordinator_phone) : ''}</span>
                <span class="tk-footer-right">Non-transferable &bull; Official Aid Voucher</span>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Ramadan Tokens – ${_rdEsc(dist.title || '')}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box;}
 body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f0f0;padding:14mm;color:#111;}
 h1.print-heading{text-align:center;font-size:13px;color:#555;margin-bottom:8mm;letter-spacing:.05em;text-transform:uppercase;}
 .tokens-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm;}
 .token-card{background:#fff;border:1.5px solid #d1d5db;border-radius:10px;overflow:hidden;break-inside:avoid;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.08);}
 .tk-header{background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;}
 .tk-logo{width:32px;height:32px;background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#3730a3;flex-shrink:0;}
 .tk-org{flex:1;} .tk-org-name{color:#fff;font-size:11px;font-weight:700;line-height:1.2;}
 .tk-org-sub{color:rgba(255,255,255,.65);font-size:8.5px;margin-top:1px;}
 .tk-year{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:20px;color:#e0e7ff;font-size:10px;font-weight:700;padding:2px 9px;}
 
 .tk-body{padding:8px 12px;background:#fafafa;border-bottom:1px dashed #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:10px;}
 .tk-body-left{flex:1;min-width:0;}
 .tk-label-sm{font-size:7px;font-weight:700;color:#6b7280;letter-spacing:.12em;margin-bottom:2px;}
 .tk-token-no{font-size:24px;font-weight:800;color:#1e1b4b;font-family:'Courier New',monospace;letter-spacing:.05em;line-height:1;}
 .tk-dist-title{font-size:9px;color:#6b7280;margin:3px 0 2px;}
 .tk-barcode-wrap{max-width:180px;height:24px;margin-top:3px;}
 .tk-barcode-wrap svg{width:100%;height:100%;display:block;}
 .tk-body-right{flex-shrink:0;text-align:center;}
 .tk-qr-wrap{background:#fff;padding:4px;border:1px solid #e2e8f0;border-radius:6px;display:inline-flex;flex-direction:column;align-items:center;}
 .tk-qr-img{width:68px;height:68px;display:block;}
 .tk-qr-lbl{font-size:6px;font-weight:700;color:#64748b;letter-spacing:.08em;margin-top:2px;}

 .tk-details{display:grid;grid-template-columns:repeat(2,1fr);padding:8px 12px;gap:6px 10px;}
 .tk-detail-cell{min-width:0;} .tk-wide{grid-column:1/-1;}
 .tk-detail-label{font-size:6.5px;font-weight:700;color:#9ca3af;letter-spacing:.1em;margin-bottom:2px;}
 .tk-detail-value{font-size:9px;font-weight:600;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
 .tk-wrap{white-space:normal;line-height:1.35;} .mono{font-family:'Courier New',monospace;font-size:9.5px;}
 .tk-footer{padding:5px 12px;background:#f3f4f6;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:6.5px;color:#9ca3af;}
 .tk-footer-right{text-align:right;flex-shrink:0;}
 @media print{body{background:#fff;padding:8mm;} h1.print-heading{margin-bottom:5mm;} .tokens-grid{gap:4mm;} .token-card{box-shadow:none;border-color:#ccc;} .no-print{display:none;}}
</style></head><body>
<p class="print-heading no-print">${tokens.length} token(s) ready to print &mdash; <button onclick="window.print()" style="font-size:12px;padding:4px 12px;cursor:pointer;border:1px solid #999;border-radius:4px;background:#fff;">Print</button></p>
<div class="tokens-grid">${cards}</div>
<script>window.onload=()=>window.print();<\/script></body></html>`;

    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to print', 'error'); return; }
    win.document.write(html);
    win.document.close();
}

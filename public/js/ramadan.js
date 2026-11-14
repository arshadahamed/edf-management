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
    pending:   { badge: 'background:#fef3c7; color:#92400e;', label: '0. Awaiting ID Scan', shortLabel: 'Awaiting ID Scan' },
    issued:    { badge: 'background:#e0e7ff; color:#3730a3;', label: '1. Verified & Issued', shortLabel: 'Verified & Issued' },
    redeemed:  { badge: 'background:#e0f2fe; color:#0369a1;', label: '2. Redeemed from Shop', shortLabel: 'Redeemed from Shop' },
    collected: { badge: 'background:#d1fae5; color:#065f46;', label: '3. Collected by EDF', shortLabel: 'Collected by EDF' },
    absent:    { badge: 'background:#fee2e2; color:#991b1b;', label: 'Absent', shortLabel: 'Absent' },
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
const RD_PKG_ACCENT = {
    dry_ration: '#10b981', cash_voucher: '#3b82f6', zakat_pack: '#f59e0b',
    iftar_kit: '#8b5cf6', eid_gift: '#ec4899', mixed: '#6366f1',
};
function _rdPkgAccent(t) { return RD_PKG_ACCENT[t] || RD_PKG_ACCENT.dry_ration; }
function _rdStatusPill(status) {
    const s = ['active', 'completed', 'cancelled'].includes(status) ? status : 'active';
    return `<span class="rd-status-pill rd-status-${s}"><span class="rd-status-dot"></span>${_rdEsc(s)}</span>`;
}
function _rdProgressColor(pct) {
    if (pct >= 100) return '#10b981';
    if (pct >= 60) return '#22c55e';
    if (pct >= 25) return '#f59e0b';
    return '#6366f1';
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
let _rdDistAdv       = { year: 'all', location: 'all', shop: 'all', progress: 'all', schedule: 'all' };
let _rdDistSortCol   = 'year';
let _rdDistSortDir   = 'desc';
let _rdDistPage      = 1;
let _rdDistPageSize  = 10;
let _rdDistSelected  = new Set();

function _rdDistShopsList(d) {
    const raw = [d.allocated_shops || '', d.token_shops || ''].join(',');
    return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
}

async function fetchRamadanDistributions() {
    try {
        const res = await fetch('/api/ramadan/distributions');
        if (!res.ok) throw new Error('Failed');
        ramadanDistData = await res.json();
        const ids = new Set(ramadanDistData.map(d => d.id));
        _rdDistSelected.forEach(id => { if (!ids.has(id)) _rdDistSelected.delete(id); });
        updateRamadanStats();
        populateRamadanDistFilterOptions();
        _rdRenderSpotlight();
        renderRamadanDistributions();
    } catch (err) { console.error(err); }
}

// Pick the campaign field staff most likely want right now:
// active + scheduled today → active upcoming (soonest) → most recent active.
function _rdPickSpotlightDist() {
    const active = ramadanDistData.filter(d => d.status === 'active');
    if (!active.length) return null;
    const today = _rdIsoToday();
    const day = d => d.collection_date ? String(d.collection_date).split('T')[0] : null;
    const todays = active.find(d => day(d) === today);
    if (todays) return todays;
    const upcoming = active.filter(d => day(d) && day(d) > today).sort((a, b) => day(a).localeCompare(day(b)));
    if (upcoming.length) return upcoming[0];
    return [...active].sort((a, b) => (Number(b.year) - Number(a.year)) || (b.id - a.id))[0];
}

function _rdRenderSpotlight() {
    const wrap = _rdEl('rdSpotlightWrap');
    const activeCount = ramadanDistData.filter(d => d.status === 'active').length;
    const latest = [...ramadanDistData].sort((a, b) => Number(b.year) - Number(a.year))[0];
    _rdSet('rdHeroSeasonBadge', latest
        ? `${latest.hijri_year || _rdHijriFromYear(latest.year) + ' AH'} · ${activeCount} Active`
        : 'Seasonal Relief');
    if (!wrap) return;
    const d = _rdPickSpotlightDist();
    if (!d) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    const m = _rdDistMetrics(d);
    const isToday = _rdDistScheduleBucket(d) === 'today';
    const shops = _rdDistShopsList(d);
    wrap.style.display = '';
    wrap.innerHTML = `
        <div class="rd-spotlight-card">
            <div class="rd-spotlight-left">
                <div class="rd-spotlight-pulse"><i data-lucide="${isToday ? 'radio' : 'calendar-clock'}" style="width:18px;height:18px;"></i></div>
                <div style="min-width:0;">
                    <div style="display:flex; align-items:center; gap:.45rem; flex-wrap:wrap;">
                        <span style="font-size:.66rem; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:#10b981;">${isToday ? 'Live Today' : 'Active Campaign'}</span>
                        ${_rdPkgBadge(d.package_type)}
                    </div>
                    <div class="rd-camp-title-link" style="margin-top:2px;" onclick="openRdTokensModal(${d.id})">${_rdEsc(d.title)}</div>
                    <div class="rd-spotlight-meta">
                        <span><i data-lucide="calendar" style="width:12px;height:12px;vertical-align:-2px;"></i> ${_rdFmtDate(d.collection_date)}${d.collection_time ? ' · ' + _rdEsc(d.collection_time) : ''}</span>
                        ${_rdScheduleChip(d)}
                        <span><i data-lucide="map-pin" style="width:12px;height:12px;vertical-align:-2px;"></i> ${_rdEsc(d.collection_location) || 'Venue TBD'}</span>
                        ${shops.length ? `<span style="color:#0284c7;font-weight:700;"><i data-lucide="store" style="width:12px;height:12px;vertical-align:-2px;color:#0284c7;"></i> ${_rdEsc(shops.join(', '))}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="rd-spotlight-progress-box">
                <div style="display:flex; justify-content:space-between; font-size:.72rem; color:var(--text-muted); font-weight:600;">
                    <span>${m.issuedFlow} handed · ${m.redeemedFlow} redeemed · ${m.collected} settled</span><b style="color:var(--text-main);">${m.pct}% settled</b>
                </div>
                <div style="height:8px; background:var(--border-color); border-radius:99px; overflow:hidden; display:flex;">
                    <div style="width:${m.pct}%; background:#10b981; transition:width .4s ease;" title="3. Collected back from shop by EDF"></div>
                    <div style="width:${m.atShopPct}%; background:#0284c7; transition:width .4s ease;" title="2. Redeemed at Partner Shop (Awaiting EDF Pickup)"></div>
                    <div style="width:${m.atBenPct}%; background:#6366f1; transition:width .4s ease;" title="1. Physical Token Handed to Beneficiary"></div>
                    <div style="width:${m.total ? Math.round(m.absent / m.total * 100) : 0}%; background:#ef4444;" title="Absent / Unclaimed"></div>
                </div>
                <div class="rd-breakdown-pills">
                    <span class="rd-bd-pill rd-bd-pen">${m.pending} awaiting ID</span>
                    <span class="rd-bd-pill rd-bd-iss">🪪 ${m.issued} handed</span>
                    <span class="rd-bd-pill" style="background:rgba(14,165,233,0.12); color:#0284c7; border:1px solid rgba(14,165,233,0.3);">🏪 ${m.redeemed} at shop</span>
                    <span class="rd-bd-pill rd-bd-col">✓ ${m.collected} settled</span>
                </div>
            </div>
            <div class="rd-spotlight-actions">
                <button type="button" class="rd-btn-scanner-hero" onclick="openRdTokensModal(${d.id}, { scan: true })"><i data-lucide="scan-line" style="width:15px;height:15px;"></i> Field Scanner</button>
                <button type="button" class="rd-btn-action-outline" onclick="openRdTokensModal(${d.id}, { shopAudit: true })" style="color:#0284c7; border-color:rgba(14,165,233,0.35);"><i data-lucide="store" style="width:14px;height:14px;"></i> Shop Audit</button>
                <button type="button" class="rd-btn-action-outline" onclick="openRamadanDistModal('edit', ${d.id})"><i data-lucide="edit-2" style="width:14px;height:14px;"></i> Edit</button>
            </div>
        </div>`;
}

function openRdQuickScanner() {
    const d = _rdPickSpotlightDist();
    if (!d) {
        showToast('No active campaign found. Create a campaign first.', 'error');
        return;
    }
    openRdTokensModal(d.id, { scan: true });
}

function toggleRdExportMenu(e) {
    if (e) e.stopPropagation();
    const m = _rdEl('rdExportMenu'); if (!m) return;
    m.style.display = m.style.display === 'none' || !m.style.display ? 'block' : 'none';
}
document.addEventListener('click', (e) => {
    const m = document.getElementById('rdExportMenu');
    if (m && m.style.display === 'block' && !e.target.closest('#rdExportMenu')) m.style.display = 'none';
});

// "/" focuses campaign search while the Ramadan tab is visible (and no modal is open)
document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const tab = document.getElementById('ramadanTab');
    if (!tab || !tab.classList.contains('active')) return;
    const anyModalOpen = [...document.querySelectorAll('.modal')].some(md => md.style.display && md.style.display !== 'none');
    if (anyModalOpen) return;
    e.preventDefault();
    _rdEl('ramadanSearchInput')?.focus();
});

function _rdDistMetrics(d) {
    const total = Number(d.total_tokens) || 0;
    const issued = Number(d.issued_count) || 0;
    const redeemed = Number(d.redeemed_count) || 0;
    const collected = Number(d.collected_count) || 0;
    const pending = Number(d.pending_count) || 0;
    const absent = Number(d.absent_count) || 0;
    const voucher = Number(d.voucher_value) || 0;
    const issuedFlow = issued + redeemed + collected;   // All tokens handed over to beneficiaries (Stage 1+)
    const redeemedFlow = redeemed + collected;         // All tokens redeemed at shops (Stage 2+)
    return {
        total, issued, redeemed, collected, pending, absent, voucher,
        issuedFlow, redeemedFlow,
        pct: total ? Math.round((collected / total) * 100) : 0,
        atShopPct: total ? Math.round((redeemed / total) * 100) : 0,
        atBenPct: total ? Math.round((issued / total) * 100) : 0,
        redeemedPct: total ? Math.round((redeemedFlow / total) * 100) : 0,
        issuedPct: total ? Math.round((issuedFlow / total) * 100) : 0,
        budget: voucher * total,
        disbursed: voucher * collected,
        redeemedVal: voucher * redeemed,
        issuedVal: voucher * issued,
        pendingVal: voucher * pending,
    };
}

function updateRamadanStats() {
    const data = ramadanDistData;
    const m = data.map(_rdDistMetrics);
    const sum = k => m.reduce((s, x) => s + x[k], 0);
    const totalTokens = sum('total');
    const issued = sum('issued');
    const redeemed = sum('redeemed');
    const collected = sum('collected');
    const pending = sum('pending');
    const absent = sum('absent');
    const issuedFlow = sum('issuedFlow');
    const eligible = data.length ? (data[0].eligible_active_count || 0) : 0;
    const venues = new Set(data.map(d => (d.collection_location || '').trim()).filter(Boolean)).size;
    const allShops = new Set();
    data.forEach(d => _rdDistShopsList(d).forEach(s => allShops.add(s)));
    const vouchers = data.map(d => Number(d.voucher_value) || 0).filter(v => v > 0);
    const rate = totalTokens ? Math.round((collected / totalTokens) * 100) : 0;
    const redeemRate = totalTokens ? Math.round((redeemed / totalTokens) * 100) : 0;

    // Card 1: Campaigns & Partner Shops
    _rdSet('rdStatTotal', data.length);
    _rdSet('rdStatActiveSub', `${data.filter(d => d.status === 'active').length} Active`);
    _rdSet('rdStatShopsSub', `${allShops.size} Shop${allShops.size === 1 ? '' : 's'}`);
    _rdSet('rdStatCompletedSub', `${data.filter(d => d.status === 'completed').length} Completed`);

    // Card 2: Stage 1 — Tokens Assigned & Handed Over (ID Scanned)
    _rdSet('rdStatTokens', totalTokens);
    _rdSet('rdStatIssuedChip', `${issuedFlow} Handed Over`);
    _rdSet('rdStatPendingSub', `${pending} Awaiting ID`);
    _rdSet('rdStatEligibleSub', `${eligible} Eligible`);

    // Card 3: Stage 2 — Redeemed at Partner Shops
    _rdSet('rdStatRedeemed', redeemed);
    _rdSet('rdStatRedeemedChip', `${redeemRate}% At Shop`);
    _rdSet('rdStatRedeemedValSub', `${_rdMoney(sum('redeemedVal'))} At Shops`);
    _rdSet('rdStatPending', pending);
    _rdSet('rdStatAbsentSub', `${absent} Absent`);

    // Card 4: Stage 3 — Collected Back from Shops by EDF
    _rdSet('rdStatCollected', collected);
    _rdSet('rdStatRateChip', `${rate}% Settled`);
    _rdSet('rdStatDisbursedSub', `${_rdMoney(sum('disbursed'))} Settled`);
    const bar = _rdEl('rdStatMiniProgress'); if (bar) bar.style.width = rate + '%';

    // Card 5: Total Voucher Budget
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
    const shops = [...new Set(ramadanDistData.flatMap(_rdDistShopsList))].sort();
    fill('rdDistYearFilter', years, 'All Years', 'year');
    fill('rdDistLocationFilter', locs, 'All Venues / Locations', 'location');
    fill('rdDistShopFilter', shops, 'All Partner Shops', 'shop');
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
        if (_rdDistAdv.shop !== 'all' && !_rdDistShopsList(d).includes(_rdDistAdv.shop)) return false;
        if (_rdDistAdv.schedule !== 'all' && _rdDistScheduleBucket(d) !== _rdDistAdv.schedule) return false;
        switch (_rdDistAdv.progress) {
            case 'completed_100': if (!(m.total > 0 && m.pct === 100)) return false; break;
            case 'in_progress':   if (!((m.issuedFlow > 0 || m.pct > 0) && m.pct < 100)) return false; break;
            case 'has_redeemed':  if (m.redeemed <= 0) return false; break;
            case 'has_issued':    if (m.issued <= 0) return false; break;
            case 'not_started':   if (!(m.total > 0 && m.issuedFlow === 0)) return false; break;
            case 'has_pending':   if (m.pending <= 0) return false; break;
            case 'no_tokens':     if (m.total !== 0) return false; break;
        }
        if (q) {
            const hay = [d.title, d.year, d.hijri_year, d.collection_location, d.allocated_shops, d.token_shops,
                d.coordinator_name, d.coordinator_phone, d.package_items, d.notes, _rdPkgLabel(d.package_type), d.status]
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
    ['rdDistYearFilter', 'rdDistLocationFilter', 'rdDistShopFilter', 'rdDistProgressFilter', 'rdDistScheduleFilter'].forEach(id => {
        const s = _rdEl(id); if (s) s.classList.toggle('active-select', s.value !== 'all');
    });

    const hasData = ramadanDistData.length > 0;
    const emptyHtml = `<div class="rd-empty">
        <div class="rd-empty-icon">🌙</div>
        <div style="font-size:.95rem; font-weight:700; color:var(--text-main); margin-bottom:.3rem;">
            ${hasData ? 'No campaigns match your filters' : 'No distribution campaigns yet'}</div>
        <div style="font-size:.8rem; color:var(--text-muted); margin-bottom:.9rem;">
            ${hasData ? 'Try a different search term or clear the active filters.' : 'Create your first Ramadan or Eid campaign to start issuing beneficiary tokens.'}</div>
        ${hasData
            ? `<button type="button" class="rd-reset-btn" onclick="resetRamadanDistFilters()"><i data-lucide="rotate-ccw" style="width:12px;height:12px;"></i> Reset Filters</button>`
            : `<button type="button" class="rd-btn-cta-primary" onclick="openRamadanDistModal('add')"><i data-lucide="plus" style="width:15px;height:15px;"></i> New Campaign</button>`}
    </div>`;

    const tableWrap = _rdEl('rdDistTableViewWrap'), gridWrap = _rdEl('rdDistGridViewWrap');
    if (tableWrap) tableWrap.style.display = _rdDistView === 'table' ? '' : 'none';
    if (gridWrap)  gridWrap.style.display  = _rdDistView === 'grid' ? 'grid' : 'none';
    _rdEl('rdViewTableBtn')?.classList.toggle('active', _rdDistView === 'table');
    _rdEl('rdViewGridBtn')?.classList.toggle('active', _rdDistView === 'grid');

    // Highlight the KPI card matching the active progress filter
    document.querySelectorAll('[id^="rdKpi-"]').forEach(k => k.classList.remove('active-kpi'));
    if (['in_progress', 'has_pending', 'has_redeemed'].includes(_rdDistAdv.progress)) {
        _rdEl(`rdKpi-${_rdDistAdv.progress}`)?.classList.add('active-kpi');
    }

    const actionButtons = d => `
        <div style="display:inline-flex; align-items:center; gap:.35rem; justify-content:flex-end;">
            <button type="button" class="rd-act-btn rd-act-primary" onclick="openRdTokensModal(${d.id})" title="Open 3-Stage Token Console">
                <i data-lucide="ticket" style="width:13px;height:13px;"></i> <span>Tokens</span>
            </button>
            <div class="rd-act-cluster">
                <button type="button" class="rd-act-icon-btn rd-act-shop" onclick="openRdTokensModal(${d.id}, { shopAudit: true })" title="Partner Shop Audit &amp; EDF Token Settlement">
                    <i data-lucide="store" style="width:13px;height:13px;"></i>
                </button>
                <button type="button" class="rd-act-icon-btn rd-act-scan" onclick="openRdTokensModal(${d.id}, { scan: true })" title="Open Field ID / Token Scanner">
                    <i data-lucide="scan-line" style="width:13px;height:13px;"></i>
                </button>
                <button type="button" class="rd-act-icon-btn" onclick="openRamadanDistModal('edit',${d.id})" title="Edit campaign">
                    <i data-lucide="edit-2" style="width:13px;height:13px;"></i>
                </button>
                <button type="button" class="rd-act-icon-btn" onclick="duplicateRamadanDist(${d.id})" title="Duplicate campaign">
                    <i data-lucide="copy" style="width:13px;height:13px;"></i>
                </button>
                <button type="button" class="rd-act-icon-btn rd-act-danger" onclick="deleteRamadanDist(${d.id})" title="Delete campaign">
                    <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                </button>
            </div>
        </div>`;

    const progressBar = (m, h) => `
        <div style="flex:1; height:${h}px; background:var(--border-color); border-radius:99px; overflow:hidden; display:flex;" title="3. Settled by EDF: ${m.collected} (${m.pct}%), 2. At Shop: ${m.redeemed} (${m.atShopPct}%), 1. Handed to Beneficiary: ${m.issued} (${m.atBenPct}%)">
            <div style="width:${m.pct}%; height:100%; background:#10b981; transition:width .35s ease;"></div>
            <div style="width:${m.atShopPct}%; height:100%; background:#38bdf8; transition:width .35s ease;"></div>
            <div style="width:${m.atBenPct}%; height:100%; background:#6366f1; transition:width .35s ease;"></div>
            <div style="width:${m.total ? Math.round(m.absent / m.total * 100) : 0}%; height:100%; background:rgba(239,68,68,.65);"></div>
        </div>`;

    const tbody = _rdEl('ramadanDistBody');
    if (tbody) {
        tbody.innerHTML = paged.length ? paged.map((d, i) => {
            const m = _rdDistMetrics(d);
            const sel = _rdDistSelected.has(d.id);
            const shops = _rdDistShopsList(d);
            const quotaPct = d.target_quota > 0 ? Math.min(100, Math.round((m.total / d.target_quota) * 100)) : null;
            return `
            <tr ${sel ? 'class="rd-row-selected"' : ''} style="box-shadow: inset 3px 0 0 ${_rdPkgAccent(d.package_type)};">
                <td style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRamadanDistSelect(${d.id}, this.checked)" style="cursor:pointer;"></td>
                <td style="text-align:center; color:var(--text-muted); font-size:.76rem; font-variant-numeric:tabular-nums;">${start + i + 1}</td>
                <td style="min-width:215px;">
                    <div class="rd-camp-title-link" onclick="openRdTokensModal(${d.id})" title="Open tokens console">${_rdEsc(d.title)}</div>
                    <div style="margin-top:4px; display:flex; gap:.35rem; align-items:center; flex-wrap:wrap;">
                        ${_rdPkgBadge(d.package_type)}
                        ${d.package_items ? `<span class="rd-td-sub" title="${_rdEsc(d.package_items)}" style="margin:0; max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_rdEsc(d.package_items)}</span>` : ''}
                    </div>
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:700;">${_rdFmtDate(d.collection_date)}</div>
                    <div class="rd-td-sub">${_rdEsc(d.year)}${d.hijri_year ? ' · ' + _rdEsc(d.hijri_year) : ''}${d.collection_time ? ' · ' + _rdEsc(d.collection_time) : ''}</div>
                    <div style="margin-top:4px;">${_rdScheduleChip(d) || '<span class="rd-mini-chip" style="color:var(--text-muted);">Unscheduled</span>'}</div>
                </td>
                <td style="min-width:165px;">
                    <div style="font-weight:600; display:flex; align-items:center; gap:.3rem;"><i data-lucide="map-pin" style="width:13px;height:13px;color:var(--text-muted);flex-shrink:0;"></i>${_rdEsc(d.collection_location) || '<span style="color:var(--text-muted);">Venue TBD</span>'}</div>
                    ${shops.length ? `<div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:4px;">${shops.slice(0, 2).map(sh => `<span class="rd-shop-pill" onclick="openRdTokensModal(${d.id}, { shopAudit: true })" style="cursor:pointer; font-size:0.65rem; padding:0.1rem 0.42rem;"><i data-lucide="store" style="width:10px;height:10px;"></i> ${_rdEsc(sh)}</span>`).join('')}${shops.length > 2 ? `<span class="rd-mini-chip">+${shops.length - 2}</span>` : ''}</div>` : ''}
                    ${d.coordinator_name ? `<div class="rd-td-sub">${_rdEsc(d.coordinator_name)}${d.coordinator_phone ? ' · ' + _rdEsc(d.coordinator_phone) : ''}</div>` : ''}
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:800; font-variant-numeric:tabular-nums;">${m.voucher ? _rdMoney(m.voucher) : '—'}</div>
                    <div class="rd-td-sub">Budget ${_rdMoney(m.budget)}</div>
                </td>
                <td style="white-space:nowrap;">
                    <div style="font-weight:800; font-size:.95rem; font-variant-numeric:tabular-nums;">${m.total}${d.target_quota > 0 ? `<span class="rd-td-sub" style="display:inline; font-weight:600;"> / ${d.target_quota}</span>` : ''}</div>
                    <div class="rd-breakdown-pills">
                        <span class="rd-bd-pill rd-bd-iss" title="1. ID Scanned &amp; Physical Token Handed to Beneficiary">🪪 ${m.issued}</span>
                        <span class="rd-bd-pill" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;" title="2. Submitted &amp; Redeemed at Partner Shop">🏪 ${m.redeemed}</span>
                        <span class="rd-bd-pill rd-bd-col" title="3. Collected Back from Shop by EDF">✓ ${m.collected}</span>
                        <span class="rd-bd-pill rd-bd-pen" title="0. Awaiting ID Scan">⏳ ${m.pending}</span>
                    </div>
                    ${quotaPct !== null ? `<div class="rd-td-sub">${quotaPct}% of quota assigned</div>` : ''}
                </td>
                <td style="min-width:145px;">
                    <div style="display:flex; align-items:center; gap:.5rem;">
                        ${progressBar(m, 7)}
                        <span style="font-size:.76rem; font-weight:800; color:var(--text-main); white-space:nowrap; font-variant-numeric:tabular-nums;">${m.pct}%</span>
                    </div>
                    <div class="rd-td-sub">${_rdMoney(m.disbursed)} settled${m.redeemedVal ? ` · ${_rdMoney(m.redeemedVal)} at shop` : ''}</div>
                </td>
                <td>${_rdStatusPill(d.status)}</td>
                <td style="text-align:right; white-space:nowrap;">
                    ${actionButtons(d)}
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="10">${emptyHtml}</td></tr>`;
    }

    if (gridWrap) {
        gridWrap.innerHTML = paged.length ? paged.map(d => {
            const m = _rdDistMetrics(d);
            const sel = _rdDistSelected.has(d.id);
            const shops = _rdDistShopsList(d);
            const items = (d.package_items || '').split(',').map(s => s.trim()).filter(Boolean);
            const shown = items.slice(0, 4);
            return `
            <div class="rd-dist-card" style="--rd-card-accent:${_rdPkgAccent(d.package_type)};${sel ? ' border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,.18);' : ''}">
                <div style="display:flex; justify-content:space-between; gap:.6rem; align-items:flex-start;">
                    <div style="min-width:0;">
                        <div style="display:flex; gap:.35rem; flex-wrap:wrap; align-items:center; margin-bottom:5px;">
                            ${_rdPkgBadge(d.package_type)}
                            ${_rdStatusPill(d.status)}
                        </div>
                        <div class="rd-camp-title-link" style="font-size:.98rem;" onclick="openRdTokensModal(${d.id})">${_rdEsc(d.title)}</div>
                    </div>
                    <input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRamadanDistSelect(${d.id}, this.checked)" style="cursor:pointer; margin-top:4px; width:16px; height:16px;" title="Select campaign">
                </div>
                <div class="rd-card-meta-box">
                    <div style="display:flex; align-items:center; gap:.4rem; flex-wrap:wrap;"><i data-lucide="calendar" style="width:13px;height:13px;"></i> ${_rdFmtDate(d.collection_date)}${d.collection_time ? ' · ' + _rdEsc(d.collection_time) : ''} ${_rdScheduleChip(d)}</div>
                    <div style="display:flex; align-items:center; gap:.4rem;"><i data-lucide="map-pin" style="width:13px;height:13px;"></i> ${_rdEsc(d.collection_location) || 'Venue TBD'}</div>
                    ${shops.length ? `<div style="display:flex; align-items:center; gap:.4rem; color:#0369a1; font-weight:700;"><i data-lucide="store" style="width:13px;height:13px;"></i> ${_rdEsc(shops.join(', '))}</div>` : ''}
                    ${d.coordinator_name ? `<div style="display:flex; align-items:center; gap:.4rem;"><i data-lucide="user" style="width:13px;height:13px;"></i> ${_rdEsc(d.coordinator_name)}${d.coordinator_phone ? ' · ' + _rdEsc(d.coordinator_phone) : ''}</div>` : ''}
                </div>
                ${shown.length ? `<div class="rd-card-item-tags">${shown.map(it => `<span class="rd-card-item-tag">${_rdEsc(it)}</span>`).join('')}${items.length > shown.length ? `<span class="rd-card-item-tag">+${items.length - shown.length} more</span>` : ''}</div>` : ''}
                <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:.32rem; text-align:center;">
                    <div style="padding:.42rem .15rem; border-radius:10px; background:rgba(245,158,11,.07); border:1px solid rgba(245,158,11,.22);"><div style="font-weight:800; font-size:.92rem; color:#d97706; font-variant-numeric:tabular-nums;">${m.pending}</div><div style="font-size:.56rem; font-weight:700; text-transform:uppercase; color:#d97706;">0. Await ID</div></div>
                    <div style="padding:.42rem .15rem; border-radius:10px; background:rgba(99,102,241,.08); border:1px solid rgba(99,102,241,.25);"><div style="font-weight:800; font-size:.92rem; color:#4f46e5; font-variant-numeric:tabular-nums;">${m.issued}</div><div style="font-size:.56rem; font-weight:700; text-transform:uppercase; color:#4f46e5;">1. Issued</div></div>
                    <div style="padding:.42rem .15rem; border-radius:10px; background:rgba(56,189,248,.08); border:1px solid rgba(56,189,248,.25);"><div style="font-weight:800; font-size:.92rem; color:#0284c7; font-variant-numeric:tabular-nums;">${m.redeemed}</div><div style="font-size:.56rem; font-weight:700; text-transform:uppercase; color:#0284c7;">2. At Shop</div></div>
                    <div style="padding:.42rem .15rem; border-radius:10px; background:rgba(16,185,129,.07); border:1px solid rgba(16,185,129,.22);"><div style="font-weight:800; font-size:.92rem; color:#10b981; font-variant-numeric:tabular-nums;">${m.collected}</div><div style="font-size:.56rem; font-weight:700; text-transform:uppercase; color:#10b981;">3. Settled</div></div>
                    <div style="padding:.42rem .15rem; border-radius:10px; background:var(--input-bg); border:1px solid var(--border-color);"><div style="font-weight:800; font-size:.92rem; font-variant-numeric:tabular-nums;">${m.total}</div><div style="font-size:.56rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Total</div></div>
                </div>
                <div>
                    <div style="display:flex; justify-content:space-between; font-size:.73rem; color:var(--text-muted); margin-bottom:4px; font-weight:600;">
                        <span>${m.voucher ? _rdMoney(m.voucher) + ' / pack · ' + _rdMoney(m.budget) + ' total' : 'No voucher value set'}</span><b style="color:var(--text-main);">${m.pct}% settled</b>
                    </div>
                    <div style="display:flex;">${progressBar(m, 8)}</div>
                </div>
                <div style="display:flex; gap:.35rem; align-items:center; justify-content:space-between; padding-top:.75rem; border-top:1px dashed var(--border-color);">
                    ${actionButtons(d)}
                </div>
            </div>`;
        }).join('') : `<div style="grid-column:1/-1; background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px;">${emptyHtml}</div>`;
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
    const map = { year: 'rdDistYearFilter', location: 'rdDistLocationFilter', shop: 'rdDistShopFilter', progress: 'rdDistProgressFilter', schedule: 'rdDistScheduleFilter' };
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
    _rdDistAdv = { year: 'all', location: 'all', shop: 'all', progress: 'all', schedule: 'all' };
    _rdDistPage = 1;
    const s = _rdEl('ramadanSearchInput'); if (s) s.value = '';
    document.querySelectorAll('[id^="rdDistStat-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdDistStat-all')?.classList.add('active');
    document.querySelectorAll('[id^="rdDistType-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdDistType-all')?.classList.add('active');
    ['rdDistYearFilter', 'rdDistLocationFilter', 'rdDistShopFilter', 'rdDistProgressFilter', 'rdDistScheduleFilter'].forEach(id => { const e = _rdEl(id); if (e) e.value = 'all'; });
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
            'Partner Shops': _rdDistShopsList(d).join(', '),
            'Coordinator': d.coordinator_name || '', 'Coordinator Phone': d.coordinator_phone || '',
            'Voucher Value (LKR)': m.voucher, 'Target Quota': d.target_quota || 0,
            'Tokens Assigned': m.total, '1. Token Issued': m.issued, '2. Redeemed at Shop': m.redeemed,
            '3. Collected by EDF': m.collected, '0. Awaiting ID': m.pending, 'Absent': m.absent,
            'Settled %': m.pct, 'Total Budget (LKR)': m.budget, 'Settled (LKR)': m.disbursed,
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
    const shopWrap = _rdEl('rdModalAssignShopWrap');
    if (shopWrap) shopWrap.style.display = mode === 'none' ? 'none' : 'flex';
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

function _rdShopInputList() {
    return (_rdEl('ramadanDistAllocatedShops')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
}
function syncRamadanShopChipsFromInput() {
    const shops = _rdShopInputList();
    const lower = shops.map(s => s.toLowerCase());
    document.querySelectorAll('#rdAllocatedShopChips .rd-item-chip').forEach(c => {
        const s = (c.dataset.rshop || c.textContent.replace(/^\+\s*/, '')).trim();
        c.classList.toggle('selected', lower.includes(s.toLowerCase()));
    });
    const assignShopSel = _rdEl('ramadanDistAssignShop');
    if (assignShopSel) {
        const prev = assignShopSel.value;
        let opts = `<option value="__round_robin__">Auto-Distribute Evenly Across Shops (Round-Robin)</option>`;
        if (shops.length) {
            opts += shops.map(s => `<option value="${_rdEsc(s)}">All Tokens → ${_rdEsc(s)}</option>`).join('');
        } else {
            opts += `<option value="">First Listed Partner Shop (Default)</option>`;
        }
        opts += `<option value="__none__">Leave Shop Unassigned (Assign at ID Scan Desk)</option>`;
        assignShopSel.innerHTML = opts;
        if ([...assignShopSel.options].some(o => o.value === prev)) assignShopSel.value = prev;
    }
}
function toggleRamadanShopChip(shopName) {
    const list = _rdShopInputList();
    const idx = list.findIndex(s => s.toLowerCase() === shopName.toLowerCase());
    idx >= 0 ? list.splice(idx, 1) : list.push(shopName);
    const el = _rdEl('ramadanDistAllocatedShops');
    if (el) el.value = list.join(', ');
    syncRamadanShopChipsFromInput();
    updateRamadanModalPreview();
}
function addRamadanShopChip(shopName) {
    toggleRamadanShopChip(shopName);
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
    setVal('ramadanDistAllocatedShops', dist ? (dist.allocated_shops || '') : '');
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
    if (typeof syncRamadanShopChipsFromInput === 'function') syncRamadanShopChipsFromInput();

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
        allocated_shops:     _rdFormVal('ramadanDistAllocatedShops'),
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
        payload.auto_assign_shop = _rdEl('ramadanDistAssignShop')?.value ?? '__round_robin__';
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
// PART 3 — TOKENS CONSOLE MODAL (3-STAGE PHYSICAL TOKEN WORKFLOW)
// ═══════════════════════════════════════════════════════════════════════════

let _rdCurrentDistId = null;
let _rdTokenData     = [];
let _rdUnassigned    = [];
let _rdTokFilter     = 'all';
let _rdTokTown       = 'all';
let _rdTokCategory   = 'all';
let _rdTokShop       = 'all';
let _rdTokExtra      = 'all';
let _rdTokSortCol    = 'token_number';
let _rdTokSortDir    = 'asc';
let _rdTokPage       = 1;
let _rdTokPageSize   = 20;
let _rdTokSelected   = new Set();
let _rdScanMode      = localStorage.getItem('edf-rd-scan-mode') || 'issue';

// ── Column Visibility & Dynamic Modal Width Controller ──────────────────────
const RD_TOK_COL_META = {
    select:  { label: 'Select',        width: 34 },
    token:   { label: 'Token #',       width: 112 },
    name:    { label: 'Beneficiary',   width: 195 },
    ids:     { label: 'App # & NIC',   width: 115 },
    town:    { label: 'Town / Area',   width: 105 },
    shop:    { label: 'Allocated Shop',width: 130 },
    status:  { label: 'Stage / Status',width: 135 },
    coll:    { label: 'Lifecycle Trail',width: 235 },
    actions: { label: 'Actions',       width: 260 },
};

const RD_TOK_COL_PRESETS = {
    compact: { select: true, token: true, name: true, ids: false, town: false, shop: true, status: true, coll: true, actions: true },
    minimal: { select: false, token: true, name: true, ids: false, town: false, shop: true, status: true, coll: false, actions: true },
    all:     { select: true, token: true, name: true, ids: true,  town: true,  shop: true, status: true, coll: true, actions: true },
};

let _rdVisibleCols = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem('edf-rd-tok-cols-v1') || 'null');
        if (saved && typeof saved === 'object') {
            return { ...RD_TOK_COL_PRESETS.compact, ...saved };
        }
    } catch (_) {}
    return { ...RD_TOK_COL_PRESETS.compact };
})();

let _rdAutoFitModalWidth = localStorage.getItem('edf-rd-autofit-modal') !== '0';
let _rdScannerVisible    = localStorage.getItem('edf-rd-scanner-visible') !== '0';

function _rdSaveColPrefs() {
    try {
        localStorage.setItem('edf-rd-tok-cols-v1', JSON.stringify(_rdVisibleCols));
        localStorage.setItem('edf-rd-autofit-modal', _rdAutoFitModalWidth ? '1' : '0');
    } catch (_) {}
}

function applyRdTokenColsUI() {
    const tbl = _rdEl('rdTokensTable') || document.querySelector('#ramadanTokensModal .rd-table');
    const colKeys = Object.keys(RD_TOK_COL_META);
    let visibleCount = 0;
    let computedWidth = 85; // horizontal modal padding & breathing room

    colKeys.forEach(k => {
        const isVis = _rdVisibleCols[k] !== false;
        if (isVis) {
            visibleCount++;
            computedWidth += RD_TOK_COL_META[k].width;
        }
        if (tbl) tbl.classList.toggle(`rd-hide-${k}`, !isVis);
        const cb = _rdEl(`rdColCheck-${k}`);
        if (cb) cb.checked = isVis;
    });

    // If IDS or Town is hidden, give Beneficiary slightly more breathing room
    if (!_rdVisibleCols.ids || !_rdVisibleCols.town) {
        computedWidth += 35;
    }

    const clampedWidth = _rdAutoFitModalWidth
        ? Math.max(960, Math.min(1380, computedWidth))
        : 1380;

    const modal = _rdEl('ramadanTokensModal');
    if (modal) {
        modal.style.setProperty('--rd-modal-max-w', `${clampedWidth}px`);
    }

    _rdSet('rdVisibleColsBadge', `${visibleCount}/${colKeys.length}`);
    _rdSet('rdModalWidthIndicator', `${clampedWidth}px`);

    const autoCheck = _rdEl('rdAutoFitModalCheck');
    if (autoCheck) autoCheck.checked = _rdAutoFitModalWidth;

    const colsBtn = _rdEl('rdColsToggleBtn');
    if (colsBtn) {
        colsBtn.classList.toggle('active', visibleCount < colKeys.length || !!_rdEl('rdColsMenu')?.classList.contains('open'));
    }

    // Highlight matching preset button
    ['compact', 'minimal', 'all'].forEach(presetName => {
        const preset = RD_TOK_COL_PRESETS[presetName];
        const matches = colKeys.every(k => Boolean(_rdVisibleCols[k]) === Boolean(preset[k]));
        _rdEl(`rdColPreset-${presetName}`)?.classList.toggle('active', matches);
    });

    // Render Hidden Columns Quick-Restore Bar
    const hiddenBar = _rdEl('rdHiddenColsBar');
    if (hiddenBar) {
        const hiddenKeys = colKeys.filter(k => _rdVisibleCols[k] === false);
        if (hiddenKeys.length > 0) {
            hiddenBar.classList.add('visible');
            hiddenBar.innerHTML = `
                <span style="font-weight:700; display:inline-flex; align-items:center; gap:0.25rem;">
                    <i data-lucide="eye-off" style="width:11px;height:11px;"></i> Hidden (${hiddenKeys.length}):
                </span>
                ${hiddenKeys.map(k => `
                    <button type="button" class="rd-hidden-col-chip" onclick="toggleRdTokenCol('${k}', true)" title="Click to show ${_rdEsc(RD_TOK_COL_META[k].label)} column">
                        + ${_rdEsc(RD_TOK_COL_META[k].label)}
                    </button>
                `).join('')}
                <button type="button" class="rd-hidden-col-chip" style="background:var(--input-bg); color:var(--text-main); border-color:var(--border-color);" onclick="setRdTokenColPreset('all')" title="Restore all 9 columns">
                    Show All
                </button>
            `;
        } else {
            hiddenBar.classList.remove('visible');
            hiddenBar.innerHTML = '';
        }
    }
    if (window.lucide) lucide.createIcons();
}

function toggleRdTokenCol(colKey, visible) {
    if (!(colKey in RD_TOK_COL_META)) return;
    const nextVal = typeof visible === 'boolean' ? visible : !_rdVisibleCols[colKey];
    // Prevent hiding every single column
    const remaining = Object.keys(RD_TOK_COL_META).filter(k => (k === colKey ? nextVal : _rdVisibleCols[k] !== false));
    if (remaining.length === 0) {
        showToast('At least one column must remain visible', 'error');
        applyRdTokenColsUI();
        return;
    }
    _rdVisibleCols[colKey] = nextVal;
    _rdSaveColPrefs();
    applyRdTokenColsUI();
    renderRdTokens();
}

function setRdTokenColPreset(presetName) {
    const preset = RD_TOK_COL_PRESETS[presetName];
    if (!preset) return;
    _rdVisibleCols = { ...preset };
    _rdSaveColPrefs();
    applyRdTokenColsUI();
    renderRdTokens();
}

function toggleRdAutoFitModal(enabled) {
    _rdAutoFitModalWidth = Boolean(enabled);
    _rdSaveColPrefs();
    applyRdTokenColsUI();
}

function toggleRdColsMenu(force) {
    const menu = _rdEl('rdColsMenu');
    if (!menu) return;
    const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    applyRdTokenColsUI();
}

function toggleRdScannerStation(force) {
    const station = document.querySelector('#ramadanTokensModal .rd-scanner-station');
    const btn = _rdEl('rdToggleScannerBtn');
    if (!station) return;
    const show = typeof force === 'boolean' ? force : station.classList.contains('collapsed');
    _rdScannerVisible = show;
    localStorage.setItem('edf-rd-scanner-visible', show ? '1' : '0');
    station.classList.toggle('collapsed', !show);
    if (btn) btn.classList.toggle('active', show);
}

function _rdCurrentDist() { return ramadanDistData.find(d => d.id === _rdCurrentDistId) || null; }

function _rdAllAvailableShops() {
    const dist = _rdCurrentDist();
    const distShops = (dist?.allocated_shops || '').split(',').map(s => s.trim()).filter(Boolean);
    const tokShops = _rdTokenData.map(t => (t.allocated_shop || '').trim()).filter(Boolean);
    return [...new Set([...distShops, ...tokShops])];
}

let _rdSessionFeed = [];

function toggleRdModalFullscreen(force) {
    const modal = _rdEl('ramadanTokensModal');
    const btn = _rdEl('rdExpandModalBtn');
    if (!modal) return;
    const expanded = typeof force === 'boolean' ? force : !modal.classList.contains('rd-modal-maximized');
    modal.classList.toggle('rd-modal-maximized', expanded);
    if (btn) {
        btn.classList.toggle('active', expanded);
        btn.innerHTML = `<i data-lucide="${expanded ? 'minimize-2' : 'maximize-2'}" style="width:15px;height:15px;"></i>`;
        if (window.lucide) lucide.createIcons();
    }
}

function copyRdTokenField(val, label = 'Value', e = null) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const str = String(val ?? '').trim();
    if (!str) return;
    const done = () => showToast(`${label} copied: ${str}`, 'success');
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(str).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(); } catch (_) {}
            ta.remove();
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (_) {}
        ta.remove();
    }
}

function _rdPushSessionEvent(stageKey, tokenNumber, beneficiaryName, tokenId) {
    const tok = _rdTokenData.find(t => t.id === tokenId) || {};
    const num = tokenNumber || tok.token_number || (tokenId ? `#${tokenId}` : 'Token');
    const name = beneficiaryName || tok.beneficiary_name || '';
    const labels = { issue: 'Issued', redeem: 'Redeemed', collect: 'Settled', absent: 'Absent', pending: 'Reset' };
    _rdSessionFeed.unshift({
        stage: stageKey,
        badge: labels[stageKey] || 'Updated',
        tokenNumber: num,
        name: name,
        tokenId: tokenId || tok.id || null,
        ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    });
    if (_rdSessionFeed.length > 8) _rdSessionFeed.length = 8;
    renderRdSessionFeed();
}

function renderRdSessionFeed() {
    const bar = _rdEl('rdSessionFeedBar');
    const itemsEl = _rdEl('rdSessionFeedItems');
    if (!bar || !itemsEl) return;
    _rdSet('rdSessionFeedCount', _rdSessionFeed.length);
    bar.classList.toggle('visible', _rdSessionFeed.length > 0);
    if (!_rdSessionFeed.length) {
        itemsEl.innerHTML = '';
        return;
    }
    itemsEl.innerHTML = _rdSessionFeed.map(item => `
        <button type="button" class="rd-feed-chip ${item.stage === 'redeem' ? 'is-redeem' : ''}"
            onclick="${item.tokenId ? `openRdTokenQuickModal(${item.tokenId})` : ''}" title="${_rdEsc(item.name || item.tokenNumber)} · ${_rdEsc(item.ts)}">
            <span class="rd-feed-chip-tag">${_rdEsc(item.tokenNumber)}</span>
            <span>${_rdEsc(item.badge)}</span>
            ${item.name ? `<span style="color:var(--text-muted); max-width:95px; overflow:hidden; text-overflow:ellipsis;">${_rdEsc(item.name.split(' ')[0])}</span>` : ''}
        </button>
    `).join('');
}

function clearRdSessionFeed() {
    _rdSessionFeed = [];
    renderRdSessionFeed();
}

function setRdScanMode(mode) {
    if (mode === 'collect') _rdScanMode = 'collect';
    else if (mode === 'redeem') _rdScanMode = 'redeem';
    else _rdScanMode = 'issue';

    localStorage.setItem('edf-rd-scan-mode', _rdScanMode);
    _rdEl('rdScanMode-issue')?.classList.toggle('active', _rdScanMode === 'issue');
    _rdEl('rdScanMode-redeem')?.classList.toggle('active', _rdScanMode === 'redeem');
    _rdEl('rdScanMode-collect')?.classList.toggle('active', _rdScanMode === 'collect');

    const station = _rdEl('rdScannerStation');
    const actionBtn = _rdEl('rdVerifyActionBtn');
    ['issue', 'redeem', 'collect'].forEach(m => {
        station?.classList.toggle(`rd-mode-${m}`, _rdScanMode === m);
        actionBtn?.classList.toggle(`rd-mode-${m}`, _rdScanMode === m);
    });

    const autoLabel = _rdEl('rdAutoActionLabel');
    const nicInput = _rdEl('rdVerifyNic');
    const actionLabel = _rdEl('rdVerifyActionLabel');
    const actionIcon = _rdEl('rdVerifyActionIcon');
    const shopLabel = _rdEl('rdScannerShopLabel');

    if (_rdScanMode === 'issue') {
        if (autoLabel) autoLabel.textContent = 'Auto-Issue Token';
        if (actionLabel) actionLabel.textContent = 'Verify ID & Issue Token';
        if (actionIcon) actionIcon.setAttribute('data-lucide', 'id-card');
        if (shopLabel) shopLabel.textContent = 'Allocate Shop:';
        if (nicInput) {
            nicInput.placeholder = 'Stage 1: Scan Beneficiary ID Card (NIC / PVC Card) or type NIC / Token # to Issue Physical Token…';
        }
    } else if (_rdScanMode === 'redeem') {
        if (autoLabel) autoLabel.textContent = 'Auto-Redeem at Shop';
        if (actionLabel) actionLabel.textContent = 'Redeem at Shop';
        if (actionIcon) actionIcon.setAttribute('data-lucide', 'store');
        if (shopLabel) shopLabel.textContent = 'Active Shop:';
        if (nicInput) {
            nicInput.placeholder = 'Stage 2: Scan Physical Token or type Token # / NIC to Redeem Goods at Allocated Shop…';
        }
    } else { // 'collect'
        if (autoLabel) autoLabel.textContent = 'Auto-Collect (EDF)';
        if (actionLabel) actionLabel.textContent = 'Collect Back (EDF)';
        if (actionIcon) actionIcon.setAttribute('data-lucide', 'archive-restore');
        if (shopLabel) shopLabel.textContent = 'Audit Shop:';
        if (nicInput) {
            nicInput.placeholder = 'Stage 3: Scan Submitted Physical Token to Collect Back from Partner Shop for EDF Settlement…';
        }
    }
    if (window.lucide) lucide.createIcons();
    if (typeof window.refreshEdfLottieState === 'function') window.refreshEdfLottieState();
}

async function openRdTokensModal(distId, opts = {}) {
    _rdCurrentDistId = distId;
    _rdTokenData = []; _rdUnassigned = [];
    _rdTokFilter = 'all'; _rdTokTown = 'all'; _rdTokCategory = 'all'; _rdTokShop = 'all'; _rdTokExtra = 'all';
    _rdTokSortCol = 'token_number'; _rdTokSortDir = 'asc';
    _rdTokPage = 1; _rdTokPageSize = 20; _rdTokSelected.clear();

    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    _rdEl('rdTokFilter-all')?.classList.add('active');
    _rdUpdateSortArrows();
    const setVal = (id, v) => { const e = _rdEl(id); if (e) e.value = v; };
    setVal('rdTokSortSel', 'token_number|asc'); setVal('rdTokPageSizeSel', '20');
    setVal('rdTokExtraFilter', 'all'); setVal('rdTokShopFilter', 'all'); setVal('rdTokSearch', '');
    setVal('rdVerifyNic', ''); setVal('rdAssignSearchInput', '');
    const vr = _rdEl('rdVerifyResult'); if (vr) { vr.style.display = 'none'; vr.innerHTML = ''; }
    _rdEl('rdAssignDrawer')?.classList.remove('open');
    _rdEl('rdShopAuditDrawer')?.classList.toggle('open', Boolean(opts.shopAudit));
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
            dist.allocated_shops ? '🏪 Shops: ' + dist.allocated_shops : null,
            dist.voucher_value ? _rdMoney(dist.voucher_value) + ' / pack' : null,
            dist.coordinator_name ? `Coordinator: ${dist.coordinator_name}${dist.coordinator_phone ? ' ' + dist.coordinator_phone : ''}` : null,
        ].filter(Boolean) : [];
        sub.textContent = bits.join(' · ');
    }

    setRdScanMode(opts.scanMode || _rdScanMode);

    // Initialize scanner toggles
    const ac = _rdEl('rdAutoCollectCheck'); if (ac) { ac.checked = _rdAutoCollectEnabled; ac.closest('.rd-toggle-chip')?.classList.toggle('active', _rdAutoCollectEnabled); }
    const gm = _rdEl('rdGunModeCheck'); if (gm) { gm.checked = _rdGunModeEnabled; _rdApplyGunMode(_rdGunModeEnabled); }
    const bp = _rdEl('rdAudioBeepCheck'); if (bp) { bp.checked = _rdAudioBeepEnabled; }
    // Ensure camera drawer is closed on fresh open
    const camDrawer = _rdEl('rdCameraDrawer'); if (camDrawer) camDrawer.style.display = 'none';
    const camBtn = _rdEl('rdCameraToggleBtn'); if (camBtn) camBtn.classList.remove('active');
    const camBtnText = _rdEl('rdCameraBtnText'); if (camBtnText) camBtnText.textContent = 'Scan Camera';

    _rdEl('ramadanTokensModal')?.classList.remove('rd-cam-open', 'rd-has-selection');
    toggleRdHeaderMenu(false);
    toggleRdColsMenu(false);
    toggleRdScannerStation(_rdScannerVisible);
    applyRdTokenColsUI();
    _rdEl('rdTokAdvRow')?.classList.remove('open');
    _rdSyncFilterToggle();

    openModal('ramadanTokensModal');
    renderRdSessionFeed();
    lucide.createIcons();
    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    if (typeof window.refreshEdfLottieState === 'function') window.refreshEdfLottieState();
    const scroller = _rdEl('ramadanTokensModal')?.querySelector('.modal-content');
    if (scroller) scroller.scrollTop = 0;
    if (!_rdIsTouch()) setTimeout(() => { _rdEl('rdVerifyNic')?.focus(); }, 180);
    if (opts.scan && _rdIsTouch()) setTimeout(() => toggleRdCameraDrawer(true), 250);
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

    const allShops = _rdAllAvailableShops().sort();

    // 1. Toolbar Partner Shop Filter
    const shopSel = _rdEl('rdTokShopFilter');
    if (shopSel) {
        let shopOpts = `<option value="all">All Allocated Shops</option>`;
        if (allShops.length) {
            shopOpts += allShops.map(s => `<option value="${_rdEsc(s)}">${_rdEsc(s)}</option>`).join('');
        }
        shopOpts += `<option value="unassigned">⚠️ Unassigned to any shop</option>`;
        shopSel.innerHTML = shopOpts;
        if (allShops.includes(_rdTokShop) || _rdTokShop === 'unassigned') shopSel.value = _rdTokShop;
        else { shopSel.value = 'all'; _rdTokShop = 'all'; }
    }

    // 2. Scanner Station Active Partner Shop Selector
    const scanShopSel = _rdEl('rdScannerShopSelect');
    if (scanShopSel) {
        const prev = scanShopSel.value;
        let opts = `<option value="">Beneficiary's Allocated Shop</option>`;
        opts += allShops.map(s => `<option value="${_rdEsc(s)}">${_rdEsc(s)}</option>`).join('');
        scanShopSel.innerHTML = opts;
        if (allShops.includes(prev)) scanShopSel.value = prev;
    }

    // 3. Assign Drawer Partner Shop Selector
    const assignShopSel = _rdEl('rdAssignShopSelect');
    if (assignShopSel) {
        const prev = assignShopSel.value;
        let opts = `<option value="__round_robin__">Shop: Auto Round-Robin</option>`;
        opts += allShops.map(s => `<option value="${_rdEsc(s)}">Shop: ${_rdEsc(s)}</option>`).join('');
        opts += `<option value="">Shop: Leave Unassigned</option>`;
        assignShopSel.innerHTML = opts;
        if ([...assignShopSel.options].some(o => o.value === prev)) assignShopSel.value = prev;
    }
}

function updateRdTokenStats() {
    const dist = _rdCurrentDist();
    const voucher = Number(dist?.voucher_value) || 0;
    const count = s => _rdTokenData.filter(t => t.status === s).length;
    const total = _rdTokenData.length;
    const pending = count('pending');
    const issued = count('issued');
    const redeemed = count('redeemed');
    const collected = count('collected');
    const absent = count('absent');
    const collPct = total ? Math.round((collected / total) * 100) : 0;
    const redPct = total ? Math.round((redeemed / total) * 100) : 0;
    const issPct = total ? Math.round((issued / total) * 100) : 0;
    const absentPct = total ? Math.round((absent / total) * 100) : 0;

    _rdSet('rdTokPending', pending);
    _rdSet('rdTokIssued', issued);
    _rdSet('rdTokRedeemed', redeemed);
    _rdSet('rdTokCollected', collected);
    _rdSet('rdTokTotal', total);
    _rdSet('rdTokAbsent', absent);

    _rdSet('rdTokPendingValSub', pending ? `${_rdMoney(voucher * pending)} Awaiting ID` : 'All IDs Scanned ✓');
    _rdSet('rdTokIssuedValSub', `Handed: ${_rdMoney(voucher * issued)}`);
    _rdSet('rdTokRedeemedValSub', `At Shop: ${_rdMoney(voucher * redeemed)}`);
    _rdSet('rdTokCollectedValSub', `Settled: ${_rdMoney(voucher * collected)}`);
    _rdSet('rdTokTotalValSub', `Total: ${_rdMoney(voucher * total)}`);
    _rdSet('rdTokAbsentSub', absent ? `${absentPct}% unclaimed` : 'Unclaimed');

    _rdSet('rdProgressPct', `${collPct}% settled`);
    _rdSet('rdProgressFractionText', `${collected} settled · ${redeemed} at shop · ${issued} handed`);

    const bar = _rdEl('rdProgressBar'); if (bar) bar.style.width = collPct + '%';
    const rbar = _rdEl('rdProgressRedeemedBar'); if (rbar) rbar.style.width = redPct + '%';
    const ibar = _rdEl('rdProgressIssuedBar'); if (ibar) ibar.style.width = issPct + '%';
    const abar = _rdEl('rdProgressAbsentBar'); if (abar) abar.style.width = absentPct + '%';

    _rdSet('rdTokCnt-all', total);
    _rdSet('rdTokCnt-pending', pending);
    _rdSet('rdTokCnt-issued', issued);
    _rdSet('rdTokCnt-redeemed', redeemed);
    _rdSet('rdTokCnt-collected', collected);
    _rdSet('rdTokCnt-absent', absent);

    // Highlight active KPI pill
    document.querySelectorAll('.rd-tok-stats-bar .rd-stat-pill').forEach(p => p.classList.remove('active-stat-pill'));
    const pillMap = {
        all: '.rd-stat-total',
        pending: '.rd-stat-pending',
        issued: '.rd-stat-issued',
        redeemed: '.rd-stat-redeemed',
        collected: '.rd-stat-collected',
    };
    if (pillMap[_rdTokFilter]) {
        document.querySelector(`.rd-tok-stats-bar ${pillMap[_rdTokFilter]}`)?.classList.add('active-stat-pill');
    }

    // Update Shop Audit badge & drawer
    const allShops = _rdAllAvailableShops();
    _rdSet('rdShopAuditBadge', redeemed > 0 ? `${redeemed} at shop` : `${allShops.length} shops`);
    renderRdShopAuditDrawer();
}

// ── Partner Shop Audit & Batch Settlement Drawer (Stage 2 -> Stage 3) ───────
function toggleRdShopAuditDrawer(force) {
    const d = _rdEl('rdShopAuditDrawer'); if (!d) return;
    const open = typeof force === 'boolean' ? force : !d.classList.contains('open');
    d.classList.toggle('open', open);
    const btn = _rdEl('rdToggleShopAuditBtn');
    if (btn) btn.classList.toggle('active', open);
    if (open) renderRdShopAuditDrawer();
}

function renderRdShopAuditDrawer() {
    const grid = _rdEl('rdShopAuditGrid'); if (!grid) return;
    const dist = _rdCurrentDist() || {};
    const voucher = Number(dist.voucher_value) || 0;
    const allShops = _rdAllAvailableShops();

    // Group tokens by shop (allocated_shop or redeemed_by_shop)
    const groups = new Map();
    allShops.forEach(s => groups.set(s, []));
    const unassigned = [];

    _rdTokenData.forEach(t => {
        const sh = (t.allocated_shop || t.redeemed_by_shop || '').trim();
        if (!sh) {
            unassigned.push(t);
        } else {
            if (!groups.has(sh)) groups.set(sh, []);
            groups.get(sh).push(t);
        }
    });

    const cards = [];
    for (const [shopName, list] of groups.entries()) {
        const total = list.length;
        const pending = list.filter(t => t.status === 'pending').length;
        const issued = list.filter(t => t.status === 'issued').length;
        const redeemed = list.filter(t => t.status === 'redeemed').length;
        const collected = list.filter(t => t.status === 'collected').length;
        const settledPct = total ? Math.round((collected / total) * 100) : 0;
        const redeemedPct = total ? Math.round((redeemed / total) * 100) : 0;
        const issuedPct = total ? Math.round((issued / total) * 100) : 0;

        cards.push(`
        <div class="rd-shop-audit-card">
            <div class="rd-shop-audit-hdr">
                <div>
                    <div class="rd-shop-audit-name">
                        <i data-lucide="store" style="width:14px;height:14px;color:#0284c7;"></i>
                        <span>${_rdEsc(shopName)}</span>
                    </div>
                    <div style="font-size:0.68rem; color:var(--text-muted); margin-top:1px;">
                        ${total} allocated · ${_rdMoney(voucher * total)} total value
                    </div>
                </div>
                <span class="rd-mini-chip" style="color:${settledPct === 100 && total > 0 ? '#059669' : '#0284c7'}; font-weight:800;">
                    ${settledPct}% settled
                </span>
            </div>
            <div style="height:6px; background:var(--border-color); border-radius:99px; overflow:hidden; display:flex;">
                <div style="width:${settledPct}%; background:#10b981;" title="3. Collected by EDF (${collected})"></div>
                <div style="width:${redeemedPct}%; background:#0284c7;" title="2. Redeemed at Shop (${redeemed})"></div>
                <div style="width:${issuedPct}%; background:#0d9488;" title="1. Token Issued (${issued})"></div>
            </div>
            <div class="rd-shop-audit-metrics">
                <div class="rd-shop-metric-cell" style="background:rgba(245,158,11,0.06);">
                    <div class="rd-shop-metric-num" style="color:#d97706;">${pending}</div>
                    <div class="rd-shop-metric-lbl">0. Await ID</div>
                </div>
                <div class="rd-shop-metric-cell" style="background:rgba(20,184,166,0.08);">
                    <div class="rd-shop-metric-num" style="color:#0d9488;">${issued}</div>
                    <div class="rd-shop-metric-lbl">1. Issued</div>
                </div>
                <div class="rd-shop-metric-cell" style="background:rgba(14,165,233,0.1);">
                    <div class="rd-shop-metric-num" style="color:#0284c7;">${redeemed}</div>
                    <div class="rd-shop-metric-lbl">2. At Shop</div>
                </div>
                <div class="rd-shop-metric-cell" style="background:rgba(16,185,129,0.1);">
                    <div class="rd-shop-metric-num" style="color:#059669;">${collected}</div>
                    <div class="rd-shop-metric-lbl">3. EDF</div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:var(--text-muted); font-weight:600;">
                <span>At Shop: <strong style="color:#0284c7;">${_rdMoney(voucher * redeemed)}</strong></span>
                <span>Settled: <strong style="color:#059669;">${_rdMoney(voucher * collected)}</strong></span>
            </div>
            <div class="rd-shop-audit-actions">
                <button type="button" class="rd-act-btn rd-act-collect" style="padding:0.28rem 0.6rem; font-size:0.7rem;" ${redeemed === 0 ? 'disabled style="opacity:0.45;cursor:not-allowed;padding:0.28rem 0.6rem;font-size:0.7rem;"' : ''} onclick="settleRdPartnerShop('${_rdEsc(shopName)}', 'collect_redeemed')" title="Stage 3: EDF Staff collects all ${redeemed} redeemed physical tokens from this shop">
                    <i data-lucide="archive-restore" style="width:12px;height:12px;"></i> Collect Redeemed (${redeemed})
                </button>
                ${issued > 0 ? `
                <button type="button" class="rd-act-btn rd-act-redeem" style="padding:0.28rem 0.55rem; font-size:0.7rem;" onclick="settleRdPartnerShop('${_rdEsc(shopName)}', 'redeem_issued')" title="Stage 2: Mark all ${issued} issued tokens for this shop as Redeemed">
                    <i data-lucide="store" style="width:12px;height:12px;"></i> Redeem Issued (${issued})
                </button>` : ''}
                <button type="button" class="rd-hdr-btn" style="padding:0.24rem 0.5rem; font-size:0.68rem;" onclick="filterRdTokensByShop('${_rdEsc(shopName)}')" title="Filter table to this shop">
                    <i data-lucide="filter" style="width:11px;height:11px;"></i> Filter
                </button>
                <button type="button" class="rd-hdr-btn" style="padding:0.24rem 0.5rem; font-size:0.68rem;" onclick="printRdShopSettlementSheet('${_rdEsc(shopName)}')" title="Print Shop Settlement &amp; Signature Sheet">
                    <i data-lucide="printer" style="width:11px;height:11px;"></i> Sheet
                </button>
            </div>
        </div>`);
    }

    if (unassigned.length > 0) {
        cards.push(`
        <div class="rd-shop-audit-card" style="border-style:dashed; border-color:rgba(245,158,11,0.45);">
            <div class="rd-shop-audit-hdr">
                <div>
                    <div class="rd-shop-audit-name" style="color:#d97706;">
                        <i data-lucide="alert-circle" style="width:14px;height:14px;color:#d97706;"></i>
                        <span>Unassigned Partner Shop</span>
                    </div>
                    <div style="font-size:0.68rem; color:var(--text-muted); margin-top:1px;">
                        ${unassigned.length} token(s) have no allocated shop yet
                    </div>
                </div>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.45;">
                Allocate a partner shop when the beneficiary scans their ID card, or click below to distribute evenly across your campaign's partner shops.
            </div>
            <div class="rd-shop-audit-actions" style="margin-top:auto;">
                <button type="button" class="rd-act-btn rd-act-issue" style="padding:0.28rem 0.65rem; font-size:0.7rem;" onclick="autoDistributeUnassignedShops()">
                    <i data-lucide="shuffle" style="width:12px;height:12px;"></i> Auto-Allocate Across Shops
                </button>
                <button type="button" class="rd-hdr-btn" style="padding:0.24rem 0.5rem; font-size:0.68rem;" onclick="filterRdTokensByShop('unassigned')">
                    <i data-lucide="filter" style="width:11px;height:11px;"></i> View (${unassigned.length})
                </button>
            </div>
        </div>`);
    }

    if (!cards.length) {
        grid.innerHTML = `<div style="grid-column:1/-1; padding:0.9rem; text-align:center; color:var(--text-muted); font-size:0.78rem;">
            No Partner Shops configured yet. Edit the campaign to add Partner Shops (e.g. Amana Food Mart, Al-Madina Supermarket) or click any token's shop badge to assign one.
        </div>`;
    } else {
        grid.innerHTML = cards.join('');
    }
    if (window.lucide) lucide.createIcons();
}

function filterRdTokensByShop(shopVal) {
    _rdTokShop = shopVal;
    const sel = _rdEl('rdTokShopFilter');
    if (sel) sel.value = shopVal;
    _rdTokPage = 1;
    renderRdTokens();
}

async function settleRdPartnerShop(shopName, action) {
    if (!_rdCurrentDistId) return;
    const labelMap = {
        collect_redeemed: shopName === '__ALL__'
            ? 'Collect back ALL redeemed tokens from all partner shops for EDF settlement?'
            : `Collect back all redeemed physical tokens from "${shopName}" for EDF settlement?`,
        redeem_issued: `Mark all issued tokens allocated to "${shopName}" as Redeemed at Shop?`,
    };
    if (!confirm(labelMap[action] || 'Proceed with batch shop action?')) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/shop-settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_name: shopName, action })
        });
        const r = await res.json();
        if (res.ok) {
            _rdPlayBeep('collect');
            showToast(r.message, 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            showToast(r.message || 'No matching tokens to update', 'error');
        }
    } catch (_) { showToast('Network error', 'error'); }
}

async function autoDistributeUnassignedShops() {
    const shops = _rdAllAvailableShops();
    if (!shops.length) {
        showToast('Please add Partner Shops to this campaign first (Edit Campaign → Allocated Partner Shops)', 'error');
        return;
    }
    const unassigned = _rdTokenData.filter(t => !(t.allocated_shop || '').trim());
    if (!unassigned.length) {
        showToast('All tokens already have an allocated partner shop!', 'info');
        return;
    }
    try {
        // Group unassigned IDs round-robin across shops
        const buckets = new Map();
        shops.forEach(s => buckets.set(s, []));
        unassigned.forEach((t, idx) => {
            const s = shops[idx % shops.length];
            buckets.get(s).push(t.id);
        });
        for (const [shop, ids] of buckets.entries()) {
            if (!ids.length) continue;
            await fetch('/api/ramadan/tokens/bulk-allocate-shop', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token_ids: ids, allocated_shop: shop })
            });
        }
        showToast(`Distributed ${unassigned.length} token(s) evenly across ${shops.length} Partner Shop(s)`, 'success');
        await fetchRdTokens();
        fetchRamadanDistributions();
    } catch (_) { showToast('Network error', 'error'); }
}

// ── Filters / sort / pagination ─────────────────────────────────────────────
function setRdTokFilter(f) {
    _rdTokFilter = f; _rdTokPage = 1;
    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    _rdEl(`rdTokFilter-${f}`)?.classList.add('active');
    updateRdTokenStats();
    renderRdTokens();
}
function onRdTokAdvFilterChange() {
    _rdTokTown = _rdEl('rdTokTownFilter')?.value || 'all';
    _rdTokCategory = _rdEl('rdTokCategoryFilter')?.value || 'all';
    _rdTokShop = _rdEl('rdTokShopFilter')?.value || 'all';
    _rdTokExtra = _rdEl('rdTokExtraFilter')?.value || 'all';
    _rdTokPage = 1;
    renderRdTokens();
}
function resetRdTokFilters() {
    _rdTokTown = 'all'; _rdTokCategory = 'all'; _rdTokShop = 'all'; _rdTokExtra = 'all';
    ['rdTokTownFilter', 'rdTokCategoryFilter', 'rdTokShopFilter', 'rdTokExtraFilter'].forEach(id => { const e = _rdEl(id); if (e) e.value = 'all'; });
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
    ['token_number', 'beneficiary_name', 'home_town', 'allocated_shop', 'status', 'issued_at', 'redeemed_at', 'collected_at'].forEach(col => {
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
        if (_rdTokShop !== 'all') {
            const sh = (t.allocated_shop || '').trim();
            if (_rdTokShop === 'unassigned') {
                if (sh) return false;
            } else if (sh !== _rdTokShop) {
                return false;
            }
        }
        if (_rdTokExtra === 'with_notes' && !(t.notes || '').trim()) return false;
        if (_rdTokExtra === 'has_phone' && !(t.contact_number || '').trim()) return false;
        if (_rdTokExtra === 'issued_today') {
            if (!t.issued_at) return false;
            const d = new Date(t.issued_at);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (iso !== today) return false;
        }
        if (_rdTokExtra === 'redeemed_today') {
            if (!t.redeemed_at) return false;
            const d = new Date(t.redeemed_at);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (iso !== today) return false;
        }
        if (_rdTokExtra === 'collected_today') {
            if (t.status !== 'collected' || !(t.shop_collected_at || t.collected_at)) return false;
            const d = new Date(t.shop_collected_at || t.collected_at);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (iso !== today) return false;
        }
        if (q) {
            const hay = [t.beneficiary_name, t.female_head_name, t.nic_number, t.female_head_nic, t.token_number,
                t.application_number, t.contact_number, t.home_town, t.category, t.allocated_shop, t.redeemed_by_shop,
                t.notes, t.collector_name, t.issued_by_name, t.collected_by_name, t.shop_collected_by_name]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    const stageOrder = { pending: 0, issued: 1, redeemed: 2, collected: 3, absent: 4 };
    list.sort((a, b) => {
        if (_rdTokSortCol === 'status') {
            const sa = stageOrder[a.status] ?? 9;
            const sb = stageOrder[b.status] ?? 9;
            return _rdTokSortDir === 'asc' ? sa - sb : sb - sa;
        }
        if (_rdTokSortCol === 'issued_at') {
            const va = a.issued_at ? new Date(a.issued_at).getTime() : 0;
            const vb = b.issued_at ? new Date(b.issued_at).getTime() : 0;
            return _rdTokSortDir === 'asc' ? va - vb : vb - va;
        }
        if (_rdTokSortCol === 'collected_at') {
            const va = (a.shop_collected_at || a.collected_at) ? new Date(a.shop_collected_at || a.collected_at).getTime() : 0;
            const vb = (b.shop_collected_at || b.collected_at) ? new Date(b.shop_collected_at || b.collected_at).getTime() : 0;
            return _rdTokSortDir === 'asc' ? va - vb : vb - va;
        }
        if (_rdTokSortCol === 'redeemed_at') {
            const va = a.redeemed_at ? new Date(a.redeemed_at).getTime() : 0;
            const vb = b.redeemed_at ? new Date(b.redeemed_at).getTime() : 0;
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
    const anyFilter = _rdTokFilter !== 'all' || _rdTokTown !== 'all' || _rdTokCategory !== 'all' || _rdTokShop !== 'all' || _rdTokExtra !== 'all' || !!search;
    const rst = _rdEl('rdTokResetFiltersBtn'); if (rst) rst.style.display = anyFilter ? 'inline-flex' : 'none';
    ['rdTokTownFilter', 'rdTokCategoryFilter', 'rdTokShopFilter', 'rdTokExtraFilter'].forEach(id => {
        const s = _rdEl(id); if (s) s.classList.toggle('active-sel', s.value !== 'all');
    });
    _rdSyncFilterToggle();
    _rdSet('rdTokFilterSummary', `Showing ${total} of ${_rdTokenData.length} token${_rdTokenData.length === 1 ? '' : 's'}`);

    const tbody = _rdEl('rdTokensBody'); if (!tbody) return;
    if (!paged.length) {
        const hasTokens = _rdTokenData.length > 0;
        const msg = !hasTokens
            ? 'No tokens assigned yet. Assign beneficiaries or auto-generate vouchers to launch distribution.'
            : 'No tokens match your current filters or search query.';
        const actionsHtml = !hasTokens
            ? `<button type="button" class="rd-hdr-btn rd-hdr-btn-emerald" onclick="toggleRdAssignDrawer(true)"><i data-lucide="user-plus" style="width:13px;"></i> Assign Beneficiary</button>
               <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" onclick="assignAllBeneficiaries()"><i data-lucide="users" style="width:13px;"></i> Assign All Active</button>`
            : `<button type="button" class="rd-hdr-btn" onclick="resetRdTokFilters()"><i data-lucide="rotate-ccw" style="width:13px;"></i> Reset All Filters</button>`;
        tbody.innerHTML = `<tr class="rd-empty-row"><td colspan="9"><div class="rd-empty">
            <div class="rd-empty-lottie-wrap"><span class="edf-lottie-slot" data-lottie-icon="ticket" data-lottie-trigger="loop"></span></div>
            <div style="font-size:.92rem; font-weight:700; color:var(--text-main);">${msg}</div>
            <div class="rd-empty-actions">${actionsHtml}</div>
        </div></td></tr>`;
    } else {
        tbody.innerHTML = paged.map(t => {
            const st = RD_TOKEN_STATUS[t.status] || RD_TOKEN_STATUS.pending;
            const isPending = t.status === 'pending';
            const isIssued = t.status === 'issued';
            const isRedeemed = t.status === 'redeemed';
            const isCollected = t.status === 'collected';
            const isAbsent = t.status === 'absent';

            const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            const issAt = fmtTs(t.issued_at);
            const redAt = fmtTs(t.redeemed_at);
            const collAt = fmtTs(t.shop_collected_at || t.collected_at);
            const sel = _rdTokSelected.has(t.id);

            let primaryBtn = '';
            let prevStageBtn = '';
            let stateToggleBtn = '';
            if (isPending) {
                primaryBtn = `<button type="button" class="rd-act-btn rd-act-issue" onclick="markRdTokenIssued(${t.id})" title="Stage 1: Verify ID &amp; Issue Physical Token to Beneficiary"><i data-lucide="id-card" style="width:13px;height:13px;"></i> <span>Verify &amp; Issue</span></button>`;
                stateToggleBtn = `<button type="button" class="rd-act-icon-btn rd-act-absent" onclick="markRdTokenAbsent(${t.id})" title="Mark Absent / Unclaimed"><i data-lucide="user-x" style="width:13px;height:13px;"></i></button>`;
            } else if (isIssued) {
                primaryBtn = `<button type="button" class="rd-act-btn rd-act-redeem" onclick="markRdTokenRedeemed(${t.id})" title="Stage 2: Beneficiary Redeems Physical Token from Allocated Shop"><i data-lucide="store" style="width:13px;height:13px;"></i> <span>Redeem from Shop</span></button>`;
                prevStageBtn = `<button type="button" class="rd-act-btn rd-act-prev" onclick="resetRdTokenPrevStage(${t.id})" title="Reset to previous process: 0. Awaiting ID Scan"><i data-lucide="undo-2" style="width:13px;height:13px;"></i> <span>Reset</span></button>`;
            } else if (isRedeemed) {
                primaryBtn = `<button type="button" class="rd-act-btn rd-act-collect" onclick="markRdTokenCollectedFromShop(${t.id})" title="Stage 3: Collect Submitted Physical Token from Shop by EDF"><i data-lucide="archive-restore" style="width:13px;height:13px;"></i> <span>Collect by EDF</span></button>`;
                prevStageBtn = `<button type="button" class="rd-act-btn rd-act-prev" onclick="resetRdTokenPrevStage(${t.id})" title="Reset to previous process: 1. Verified &amp; Issued"><i data-lucide="undo-2" style="width:13px;height:13px;"></i> <span>Reset</span></button>`;
            } else if (isCollected) {
                primaryBtn = `<button type="button" class="rd-act-btn rd-act-settled" onclick="openRdTokenQuickModal(${t.id})" title="Stage 3 Complete: Collected by EDF (Click to inspect/edit)"><i data-lucide="badge-check" style="width:13px;height:13px;"></i> <span>Collected ✓</span></button>`;
                prevStageBtn = `<button type="button" class="rd-act-btn rd-act-prev" onclick="resetRdTokenPrevStage(${t.id})" title="Reset to previous process: 2. Redeemed from Shop"><i data-lucide="undo-2" style="width:13px;height:13px;"></i> <span>Reset</span></button>`;
            } else {
                primaryBtn = `<button type="button" class="rd-act-btn rd-act-prev" onclick="resetRdTokenPrevStage(${t.id})" title="Reset from Absent to previous process: 0. Awaiting ID Scan"><i data-lucide="undo-2" style="width:13px;height:13px;"></i> <span>Reset</span></button>`;
                stateToggleBtn = '';
            }

            const statusSelectHtml = `
                <select class="rd-status-select rd-st-${_rdEsc(t.status || 'pending')}" onchange="changeRdTokenStatusDirect(${t.id}, this.value)" title="Current Process Status — click to change stage directly">
                    <option value="pending" ${isPending ? 'selected' : ''}>0. Awaiting ID Scan</option>
                    <option value="issued" ${isIssued ? 'selected' : ''}>1. Verified &amp; Issued</option>
                    <option value="redeemed" ${isRedeemed ? 'selected' : ''}>2. Redeemed from Shop</option>
                    <option value="collected" ${isCollected ? 'selected' : ''}>3. Collected by EDF</option>
                    <option value="absent" ${isAbsent ? 'selected' : ''}>Absent</option>
                </select>
            `;

            const actionCluster = `
                <div class="rd-act-cluster">
                    <button type="button" class="rd-act-icon-btn ${t.notes ? 'has-notes' : ''}" onclick="openRdTokenQuickModal(${t.id})" title="${t.notes ? 'Notes: ' + _rdEsc(t.notes) + ' (Click to edit stage, shop & remarks)' : 'Edit token stage, allocated shop & remarks'}">
                        <i data-lucide="sliders-horizontal" style="width:13px;height:13px;"></i>
                    </button>
                    <button type="button" class="rd-act-icon-btn rd-act-print" onclick="printRamadanTokens([${t.id}])" title="Print Physical Token Card">
                        <i data-lucide="printer" style="width:13px;height:13px;"></i>
                    </button>
                    ${stateToggleBtn}
                    <button type="button" class="rd-act-icon-btn rd-act-danger" onclick="removeRdToken(${t.id})" title="Remove Token">
                        <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                    </button>
                </div>
            `;

            const inlineMetaBits = [];
            if (!_rdVisibleCols.ids) {
                if (t.nic_number) inlineMetaBits.push(`<span class="rd-inline-meta-tag" style="font-family:'Courier New',monospace;">${_rdEsc(t.nic_number)}</span>`);
                else if (t.application_number) inlineMetaBits.push(`<span class="rd-inline-meta-tag" style="font-family:'Courier New',monospace;">${_rdEsc(t.application_number)}</span>`);
            }
            if (!_rdVisibleCols.town) {
                if (t.home_town) inlineMetaBits.push(`<span class="rd-inline-meta-tag">${_rdEsc(t.home_town)}</span>`);
            }

            return `
            <tr class="${sel ? 'rd-row-selected' : ''}">
                <td class="rd-c-select" style="text-align:center;"><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleRdTokSelect(${t.id}, this.checked)" style="cursor:pointer;"></td>
                <td class="rd-c-token">
                    <span class="rd-token-pill-wrap">
                        <span class="rd-token-pill" onclick="openRdTokenQuickModal(${t.id})" style="cursor:pointer;" title="Click to inspect or edit token">${_rdEsc(t.token_number)}</span>
                        <button type="button" class="rd-copy-mini-btn" onclick="copyRdTokenField('${_rdEsc(t.token_number)}', 'Token #', event)" title="Copy Token #"><i data-lucide="copy" style="width:11px;height:11px;"></i></button>
                    </span>
                </td>
                <td class="rd-c-name">
                    <div style="font-weight:700; font-size:.84rem; color:var(--text-main); line-height:1.2;">${_rdEsc(t.beneficiary_name) || '—'}</div>
                    ${t.contact_number ? `<div class="rd-td-sub" style="margin-top:1px;">${_rdEsc(t.contact_number)}</div>` : ''}
                    ${inlineMetaBits.length ? `<div class="rd-inline-meta">${inlineMetaBits.join('')}</div>` : ''}
                </td>
                <td class="rd-c-ids">
                    <div class="rd-td-sub" style="font-family:'Courier New',monospace; margin:0; white-space:nowrap;">${_rdEsc(t.application_number) || '—'}</div>
                    <div class="rd-td-sub" style="font-family:'Courier New',monospace; white-space:nowrap;">${_rdEsc(t.nic_number) || '—'}</div>
                </td>
                <td class="rd-c-town">
                    <div style="font-size:.82rem;">${_rdEsc(t.home_town) || '—'}</div>
                    ${t.category ? `<div class="rd-td-sub">${_rdEsc(t.category)}</div>` : ''}
                </td>
                <td class="rd-c-shop">
                    <span class="rd-shop-pill ${t.allocated_shop ? '' : 'unassigned'}" onclick="openRdTokenQuickModal(${t.id})" title="Click to assign or change allocated partner shop" style="cursor:pointer;">
                        <i data-lucide="store" style="width:11px;height:11px;"></i>
                        ${_rdEsc(t.allocated_shop || 'Assign Shop')}
                    </span>
                </td>
                <td class="rd-c-status">${statusSelectHtml}</td>
                <td class="rd-c-coll">
                    ${isCollected ? `
                        <div style="font-size:0.74rem; font-weight:800; color:#065f46; display:flex; align-items:center; gap:0.25rem;">
                            <i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> 3. Collected by EDF from ${_rdEsc(t.redeemed_by_shop || t.allocated_shop || 'Shop')}
                        </div>
                        <div class="rd-td-sub" style="margin:1px 0 0 0;">${collAt}${t.shop_collected_by_name || t.collected_by_name ? ` · ${_rdEsc(t.shop_collected_by_name || t.collected_by_name)}` : ''}</div>
                    ` : isRedeemed ? `
                        <div style="font-size:0.74rem; font-weight:800; color:#0369a1; display:flex; align-items:center; gap:0.25rem;">
                            <i data-lucide="store" style="width:12px;height:12px;"></i> 2. Redeemed from ${_rdEsc(t.redeemed_by_shop || t.allocated_shop || 'Shop')}
                        </div>
                        <div class="rd-td-sub" style="margin:1px 0 0 0;">${redAt} · <span style="color:#d97706;font-weight:700;">Ready for EDF Collection</span></div>
                    ` : isIssued ? `
                        <div style="font-size:0.74rem; font-weight:800; color:#0d9488; display:flex; align-items:center; gap:0.25rem;">
                            <i data-lucide="id-card" style="width:12px;height:12px;"></i> 1. Verified &amp; Token Issued
                        </div>
                        <div class="rd-td-sub" style="margin:1px 0 0 0;">${issAt ? issAt + ' · ' : ''}Next: Redeem at <strong>${_rdEsc(t.allocated_shop || 'Partner Shop')}</strong></div>
                    ` : isAbsent ? `
                        <div class="rd-td-sub" style="color:#991b1b; font-weight:600;">Unclaimed / Absent</div>
                    ` : `
                        <div class="rd-td-sub" style="color:var(--text-muted);">0. Awaiting ID Card Scan &amp; Token Issue</div>
                    `}
                    ${t.collector_name ? `<div class="rd-td-sub" style="font-size:0.69rem;">Collector: ${_rdEsc(t.collector_name)}</div>` : ''}
                    ${t.notes ? `<div class="rd-td-sub" style="color:#0d9488; font-size:0.69rem;" title="${_rdEsc(t.notes)}">📝 ${_rdEsc(t.notes.length > 35 ? t.notes.slice(0, 35) + '…' : t.notes)}</div>` : ''}
                </td>
                <td class="rd-td-actions">
                    ${primaryBtn}
                    ${prevStageBtn}
                    ${actionCluster}
                </td>
            </tr>`;
        }).join('');
    }

    _rdRenderTokPagination(total, totalPages);
    _rdSyncTokBulkBar(paged);
    lucide.createIcons();
    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
}

function _rdRenderTokPagination(total, totalPages) {
    const pg = _rdEl('rdPagination'); if (!pg) return;
    const start = total ? (_rdTokPage - 1) * _rdTokPageSize + 1 : 0;
    const end = Math.min(_rdTokPage * _rdTokPageSize, total);
    pg.innerHTML = `<span class="rd-page-info">${total ? `Showing ${start}–${end} of ${total}` : 'No results'}</span>
        <span class="rd-shortcuts-hint"><span class="rd-kbd">F2</span> Scan &bull; <span class="rd-kbd">Alt+1/2/3</span> Stage &bull; <span class="rd-kbd">/</span> Filter</span>
        <div class="rd-page-btns">${_rdPageButtons(_rdTokPage, totalPages, 'setRdTokPage', 'rd-page-btn')}</div>`;
}

// ── Bulk selection (tokens) ─────────────────────────────────────────────────
function _rdSyncTokBulkBar(pagedRows) {
    _rdEl('rdTokBulkBar')?.classList.toggle('visible', _rdTokSelected.size > 0);
    _rdEl('ramadanTokensModal')?.classList.toggle('rd-has-selection', _rdTokSelected.size > 0);
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
            const activeShop = (_rdEl('rdScannerShopSelect')?.value || '').trim();
            res = await fetch('/api/ramadan/tokens/bulk-status', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token_ids: ids, status: action, allocated_shop: activeShop || undefined })
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

async function bulkAssignShopToSelected() {
    const ids = [..._rdTokSelected];
    if (!ids.length) { showToast('Select one or more tokens first', 'error'); return; }
    const suggestions = _rdAllAvailableShops();
    const promptMsg = suggestions.length
        ? `Assign Allocated Partner Shop to ${ids.length} selected token(s):\nAvailable shops: ${suggestions.join(', ')}`
        : `Enter Allocated Partner Shop name for ${ids.length} selected token(s):`;
    const newShop = prompt(promptMsg, suggestions[0] || '');
    if (newShop === null) return;
    try {
        const res = await fetch('/api/ramadan/tokens/bulk-allocate-shop', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token_ids: ids, allocated_shop: newShop.trim() })
        });
        const r = await res.json();
        if (res.ok) {
            showToast(r.message || 'Shops assigned successfully', 'success');
            _rdTokSelected.clear();
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            showToast(r.message || 'Failed to assign shops', 'error');
        }
    } catch (_) { showToast('Network error', 'error'); }
}

// ── Single-token 3-Stage CRUD actions ───────────────────────────────────────
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

// Stage 1: Beneficiary scanned ID Card & received Physical Token
async function markRdTokenIssued(id, shopName = null) {
    const t = _rdTokenData.find(x => x.id === id);
    const dist = _rdCurrentDist();
    const scannerShop = (_rdEl('rdScannerShopSelect')?.value || '').trim();
    const defaultShop = shopName || scannerShop || t?.allocated_shop || (dist?.allocated_shops?.split(',')[0]?.trim()) || '';
    const ok = await _rdTokenAction(`/api/ramadan/tokens/${id}/issue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            allocated_shop: defaultShop || undefined,
            collector_name: t?.collector_name || t?.beneficiary_name || undefined,
            collector_nic: t?.collector_nic || t?.nic_number || undefined
        })
    }, `Status changed to: 1. Verified & Issued (${t?.token_number || ''})${defaultShop ? ' · Shop: ' + defaultShop : ''}`);
    if (ok) _rdPushSessionEvent('issue', t?.token_number, t?.beneficiary_name, id);
    return ok;
}

// Stage 2: Beneficiary submitted physical token at Allocated Partner Shop to purchase goods
async function markRdTokenRedeemed(id, shopName = null) {
    const t = _rdTokenData.find(x => x.id === id);
    const dist = _rdCurrentDist();
    const scannerShop = (_rdEl('rdScannerShopSelect')?.value || '').trim();
    const defaultShop = shopName || scannerShop || t?.allocated_shop || (dist?.allocated_shops?.split(',')[0]?.trim()) || 'Partner Shop';
    const ok = await _rdTokenAction(`/api/ramadan/tokens/${id}/redeem`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemed_by_shop: defaultShop })
    }, `Status changed to: 2. Redeemed from Shop (${t?.token_number || ''} at ${defaultShop})`);
    if (ok) _rdPushSessionEvent('redeem', t?.token_number, t?.beneficiary_name, id);
    return ok;
}

// Stage 3: EDF Staff collected back submitted/redeemed physical token from Partner Shop
async function markRdTokenCollectedFromShop(id) {
    const t = _rdTokenData.find(x => x.id === id);
    const ok = await _rdTokenAction(`/api/ramadan/tokens/${id}/collect-from-shop`, {
        method: 'PUT'
    }, `Status changed to: 3. Collected by EDF (${t?.token_number || ''})`);
    if (ok) _rdPushSessionEvent('collect', t?.token_number, t?.beneficiary_name, id);
    return ok;
}

// Reset token to its exact previous process stage (Collected -> Redeemed -> Issued -> Pending)
async function resetRdTokenPrevStage(id) {
    try {
        const res = await fetch(`/api/ramadan/tokens/${id}/prev-stage`, { method: 'PUT' });
        const r = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(r.message || 'Reset to previous process stage', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
            return true;
        }
        showToast(r.message || 'Failed to reset to previous stage', 'error');
    } catch (_) {
        showToast('Network error', 'error');
    }
    return false;
}

// Direct status change from the STAGE / STATUS dropdown in rd-table
function changeRdTokenStatusDirect(id, newStatus) {
    if (newStatus === 'issued') return markRdTokenIssued(id);
    if (newStatus === 'redeemed') return markRdTokenRedeemed(id);
    if (newStatus === 'collected') return markRdTokenCollectedFromShop(id);
    if (newStatus === 'absent') return markRdTokenAbsent(id);
    return markRdTokenPending(id);
}

function markRdTokenCollected(id) { return markRdTokenCollectedFromShop(id); }
function markRdTokenAbsent(id) {
    return _rdTokenAction(`/api/ramadan/tokens/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'absent' }) }, 'Status changed to: Absent');
}
function markRdTokenPending(id) {
    return _rdTokenAction(`/api/ramadan/tokens/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) }, 'Status reset to: 0. Awaiting ID Scan');
}
async function removeRdToken(id) {
    if (!confirm('Remove this beneficiary token from the distribution?')) return;
    return _rdTokenAction(`/api/ramadan/tokens/${id}`, { method: 'DELETE' }, 'Token removed');
}

// ── Quick Token Lifecycle & Shop Edit Modal (No ugly browser prompts) ───────
function openRdTokenQuickModal(tokenId) {
    const t = _rdTokenData.find(x => x.id === tokenId);
    if (!t) return;
    _rdEl('rdQuickTokenId').value = t.id;
    _rdSet('rdQuickModalTitle', `Edit Token ${t.token_number}`);
    _rdSet('rdQuickModalSub', `${t.beneficiary_name || 'Beneficiary'} · NIC: ${t.nic_number || 'N/A'}`);

    const stSel = _rdEl('rdQuickStatus');
    if (stSel) stSel.value = t.status || 'pending';

    const shopInp = _rdEl('rdQuickAllocatedShop');
    if (shopInp) shopInp.value = t.allocated_shop || t.redeemed_by_shop || '';

    const colName = _rdEl('rdQuickCollectorName');
    if (colName) colName.value = t.collector_name || '';

    const colNic = _rdEl('rdQuickCollectorNic');
    if (colNic) colNic.value = t.collector_nic || '';

    const notes = _rdEl('rdQuickNotes');
    if (notes) notes.value = t.notes || '';

    const shops = _rdAllAvailableShops();
    const dl = _rdEl('rdQuickShopDatalist');
    if (dl) dl.innerHTML = shops.map(s => `<option value="${_rdEsc(s)}">`).join('');

    const chips = _rdEl('rdQuickShopChips');
    if (chips) {
        chips.innerHTML = shops.map(s =>
            `<button type="button" class="rd-item-chip ${s === (t.allocated_shop || '') ? 'selected' : ''}" onclick="document.getElementById('rdQuickAllocatedShop').value='${_rdEsc(s)}'; document.querySelectorAll('#rdQuickShopChips .rd-item-chip').forEach(c=>c.classList.remove('selected')); this.classList.add('selected');">${_rdEsc(s)}</button>`
        ).join('');
    }

    openModal('rdTokenQuickModal');
    if (window.lucide) lucide.createIcons();
}

async function saveRdTokenQuickModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = Number(_rdEl('rdQuickTokenId')?.value);
    if (!id) return;
    const status = _rdEl('rdQuickStatus')?.value || 'pending';
    const allocated_shop = (_rdEl('rdQuickAllocatedShop')?.value || '').trim();
    const collector_name = (_rdEl('rdQuickCollectorName')?.value || '').trim();
    const collector_nic = (_rdEl('rdQuickCollectorNic')?.value || '').trim();
    const notes = (_rdEl('rdQuickNotes')?.value || '').trim();

    try {
        await fetch(`/api/ramadan/tokens/${id}/allocate-shop`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allocated_shop })
        });
        await fetch(`/api/ramadan/tokens/${id}/notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes, collector_name, collector_nic })
        });
        const res = await fetch(`/api/ramadan/tokens/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, allocated_shop })
        });
        if (res.ok) {
            closeModal('rdTokenQuickModal');
            showToast('Token stage, shop & details updated', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            const r = await res.json().catch(() => ({}));
            showToast(r.message || 'Update failed', 'error');
        }
    } catch (_) {
        showToast('Network error', 'error');
    }
}

function editRdTokenShop(id) { openRdTokenQuickModal(id); }
function editRdTokenRemarks(id) { openRdTokenQuickModal(id); }

// ── Assign beneficiaries ────────────────────────────────────────────────────
async function assignAllBeneficiaries() {
    if (!_rdCurrentDistId) return;
    if (!confirm('Assign tokens to ALL remaining Active/Approved beneficiaries?')) return;
    const shopMode = _rdEl('rdAssignShopSelect')?.value ?? '__round_robin__';
    await _rdAssignRequest({ allocated_shop: shopMode });
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
            <div style="display:flex; gap:0.3rem;">
                <button type="button" class="rd-hdr-btn" style="padding:.24rem .5rem; font-size:0.7rem;" onclick="assignOneUnassignedBeneficiary(${b.id}, 'pending')" title="Assign token (Stage 0: Awaiting ID Scan)"><i data-lucide="plus" style="width:11px;"></i> Assign</button>
                <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" style="padding:.24rem .5rem; font-size:0.7rem;" onclick="assignOneUnassignedBeneficiary(${b.id}, 'issue')" title="Assign &amp; Issue Physical Token Now (Stage 1)"><i data-lucide="id-card" style="width:11px;"></i> Issue Now</button>
            </div>
        </div>`).join('')
        : `<div class="rd-td-sub" style="grid-column:1/-1; padding:.5rem;">${_rdUnassigned.length ? 'No unassigned beneficiaries match the filters.' : 'All Active/Approved beneficiaries already have a token.'}</div>`;
    lucide.createIcons();
}
async function assignFilteredUnassignedBeneficiaries() {
    const list = _rdFilteredUnassigned();
    if (!list.length) { showToast('No beneficiaries to assign', 'error'); return; }
    if (!confirm(`Assign tokens to ${list.length} beneficiar${list.length === 1 ? 'y' : 'ies'}?`)) return;
    const shopMode = _rdEl('rdAssignShopSelect')?.value ?? '__round_robin__';
    await _rdAssignRequest({ beneficiary_ids: list.map(b => b.id), allocated_shop: shopMode });
}
async function assignOneUnassignedBeneficiary(id, action = 'pending') {
    try {
        const shopMode = _rdEl('rdAssignShopSelect')?.value || '';
        const shops = _rdAllAvailableShops();
        const chosenShop = shopMode === '__round_robin__' ? (shops[0] || '') : shopMode;
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-one`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beneficiary_id: id, action, allocated_shop: chosenShop || undefined })
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
    _rdHaptic(type);
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

    // Check EDF PVC Beneficiary Card format: EDF-BEN|appNum|NIC:xxx (or ID:xxx)
    if (str.startsWith('EDF-BEN|') || str.startsWith('EDF-CARD|')) {
        const parts = str.split('|');
        for (const p of parts) {
            if (p.startsWith('NIC:') || p.startsWith('ID:')) {
                const val = p.replace(/^(NIC:|ID:)/, '').trim();
                if (val && val !== 'N/A' && val !== '—') return val;
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
    const modalEl = _rdEl('ramadanTokensModal');
    modalEl?.classList.toggle('rd-cam-open', shouldOpen);
    if (shouldOpen) {
        modalEl?.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (typeof window.refreshEdfLottieState === 'function') window.refreshEdfLottieState();
}
async function startRdCameraScanner(preferredCameraId = null) {
    const badge = _rdEl('rdCamStatusBadge');
    const dot = _rdEl('rdCamPulseDot');
    const select = _rdEl('rdCameraDeviceSelect');

    if (typeof Html5Qrcode === 'undefined') {
        if (badge) badge.textContent = 'Library Loading...';
        showToast('Camera scanner library is initializing. Please try again in a moment.', 'info');
        return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices) {
        if (badge) badge.textContent = 'HTTPS required';
        if (dot) dot.className = 'rd-cam-pulse-dot stopped';
        showToast('Camera scanning needs a secure (HTTPS) connection. Open this site via https://, or use the photo-scan button / manual entry.', 'error');
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
            const rearCam = _rdIsTouch() ? _rdAvailableCameras.find(c => /back|rear|environment|world/i.test(c.label || '')) : null;
            const usbCam = _rdAvailableCameras.find(c => /usb|external|logitech/i.test(c.label));
            targetId = (rearCam || usbCam || _rdAvailableCameras[0]).id;
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
            verbose: false,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        });

        // Config: generous wide scanning zone (no 220x220 crop clipping) + HD camera preference
        const config = {
            fps: 24,
            qrbox: function(vw, vh) {
                const narrow = vw < 600;   // phones: tighter, centred scan window
                return {
                    width: Math.max(150, Math.min(vw - 12, Math.floor(vw * (narrow ? 0.88 : 0.92)))),
                    height: Math.max(120, Math.min(vh - 12, Math.floor(vh * (narrow ? 0.62 : 0.86))))
                };
            },
            disableFlip: false
        };

        const cameraTarget = targetId ? targetId : { facingMode: "environment" };

        let _rdFrameCount = 0;
        await _rdHtml5QrCode.start(
            cameraTarget,
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

        // Check torch capabilities & apply continuous autofocus if supported
        try {
            const track = _rdHtml5QrCode.getRunningTrackCameraCapabilities();
            const torchBtn = _rdEl('rdTorchBtn');
            if (torchBtn) {
                torchBtn.style.display = track?.torch ? 'inline-flex' : 'none';
            }
            if (track?.focusMode && track.focusMode.includes('continuous')) {
                await _rdHtml5QrCode.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] });
            }
        } catch (_) {}
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
                verbose: false,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
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

// Cycle through available cameras (front/back on phones)
async function rdCycleCamera() {
    if (!_rdAvailableCameras || _rdAvailableCameras.length < 2) {
        showToast('Only one camera detected', 'info');
        return;
    }
    const idx = _rdAvailableCameras.findIndex(c => c.id === _rdActiveCameraId);
    const next = _rdAvailableCameras[(idx + 1) % _rdAvailableCameras.length];
    await rdSwitchCameraDevice(next.id);
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

    // Debounce duplicate scans (camera keeps seeing the same code for a few seconds)
    if (clean === _rdLastScannedCode && (now - _rdLastScanTimestamp < 4000)) {
        return;
    }
    if (_rdVerifyBusy) return;
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
    _rdEl('ramadanTokensModal')?.classList.remove('rd-cam-open', 'rd-has-selection');
    toggleRdModalFullscreen(false);
    toggleRdHeaderMenu(false);
    const vr = _rdEl('rdVerifyResult'); if (vr) { vr.style.display = 'none'; vr.innerHTML = ''; }
    closeModal('ramadanTokensModal');
    if (typeof window.refreshEdfLottieState === 'function') window.refreshEdfLottieState();
}

// ── Mobile helpers ──────────────────────────────────────────────────────────
function _rdIsTouch() {
    try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (_) { return false; }
}
// Short vibration feedback for phones (silently ignored where unsupported)
function _rdHaptic(type) {
    try {
        if (!navigator.vibrate) return;
        const pattern = { success: 25, collect: [40, 40, 90], warn: [70, 50, 70], error: [160, 60, 160] }[type];
        if (pattern) navigator.vibrate(pattern);
    } catch (_) {}
}

function toggleRdHeaderMenu(force) {
    const menu = _rdEl('rdHdrMenu'), btn = _rdEl('rdHdrMoreBtn');
    if (!menu) return;
    const open = typeof force === 'boolean' ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    if (btn) btn.classList.toggle('active', open);
}

function _rdSyncFilterToggle() {
    const row = _rdEl('rdTokAdvRow'), btn = _rdEl('rdFilterToggleBtn');
    if (!btn) return;
    const advActive = _rdTokTown !== 'all' || _rdTokCategory !== 'all' || _rdTokShop !== 'all' || _rdTokExtra !== 'all';
    btn.classList.toggle('active', advActive || !!row?.classList.contains('open'));
}
function toggleRdTokFilters(force) {
    const row = _rdEl('rdTokAdvRow'); if (!row) return;
    const open = typeof force === 'boolean' ? force : !row.classList.contains('open');
    row.classList.toggle('open', open);
    _rdSyncFilterToggle();
}

// Floating "Scan" button: jump to the scanner and start the camera
async function rdMobileScanNow() {
    await toggleRdCameraDrawer(true);
}

// Tap outside the header menu or columns menu closes it; Esc also releases the camera
document.addEventListener('click', (e) => {
    const menu = document.getElementById('rdHdrMenu');
    if (menu && menu.classList.contains('open') && !e.target.closest('.rd-tok-header')) toggleRdHeaderMenu(false);
    const colsMenu = document.getElementById('rdColsMenu');
    if (colsMenu && colsMenu.classList.contains('open') && !e.target.closest('#rdColsDropdownWrap')) toggleRdColsMenu(false);
});
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('ramadanTokensModal');
    if (!modal || modal.style.display !== 'flex') return;

    if (e.key === 'Escape') {
        closeRamadanTokensModal();
        return;
    }
    if (e.key === 'F2') {
        e.preventDefault();
        const inp = _rdEl('rdVerifyNic');
        if (inp) { inp.focus(); inp.select(); }
        return;
    }
    if (e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault();
        setRdScanMode(e.key === '1' ? 'issue' : (e.key === '2' ? 'redeem' : 'collect'));
        return;
    }
    if (e.key === '/' && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
        const srch = _rdEl('rdTokSearch');
        if (srch) { srch.focus(); srch.select(); }
    }
});

// ── Fast verify & collect (ID Card Desk / Shop Redeem / Shop Audit) ──────────
function clearRdVerifyStrip() {
    const i = _rdEl('rdVerifyNic');
    if (i) { i.value = ''; if (!_rdIsTouch()) i.focus(); }   // don't pop the keyboard on phones
    const r = _rdEl('rdVerifyResult'); if (r) { r.style.display = 'none'; r.innerHTML = ''; }
}

function toggleRdCollectorProxy(isProxy) {
    const wrap = _rdEl('rdProxyCollectorFields');
    if (wrap) wrap.style.display = isProxy ? 'flex' : 'none';
}

let _rdVerifyBusy = false;

async function verifyBeneficiaryNic() {
    let q = (_rdEl('rdVerifyNic')?.value || '').trim();
    const el = _rdEl('rdVerifyResult');
    if (!q) {
        showToast('Please enter an ID Card (NIC) number, Token #, or scan the card', 'error');
        return;
    }
    if (!_rdCurrentDistId || !el) return;
    if (_rdVerifyBusy) return;           // ignore re-entrant scans while a lookup is in flight
    _rdVerifyBusy = true;

    // Normalize NIC format: uppercase trailing v or x (e.g. 943052212v -> 943052212V)
    if (/^\d{9}[vVxX]$/.test(q)) {
        q = q.toUpperCase();
        const inp = _rdEl('rdVerifyNic');
        if (inp) inp.value = q;
    }

    const show = (kind, inner) => {
        el.style.display = 'block';
        el.innerHTML = `<div class="rd-vr rd-vr-${kind}">${inner}</div>`;
        if (window.lucide) lucide.createIcons();
    };
    const iconBox = (name, color, bg) =>
        `<div class="rd-vr-icon" style="background:${bg}; color:${color};"><i data-lucide="${name}" style="width:22px;height:22px;"></i></div>`;

    show('pending', `<span style="color:var(--text-muted); font-size:.9rem;"><i data-lucide="loader" style="width:15px;height:15px;vertical-align:-3px;animation:spin 1s linear infinite;"></i> Verifying Beneficiary ID &amp; Token database…</span>`);

    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/verify/${encodeURIComponent(q)}`);
        const data = await res.json();

        if (!res.ok) {
            _rdPlayBeep('error');
            if (data.ineligible) {
                show('err', `<div class="rd-vr-row" style="flex-wrap:nowrap; align-items:center;">
                    ${iconBox('shield-x', '#ef4444', 'rgba(239,68,68,.16)')}
                    <div class="rd-vr-main" style="min-width:0;">
                        <span class="rd-vr-tag rd-vr-tag-err">ID Not Eligible</span>
                        <div class="rd-vr-name">${_rdEsc(data.beneficiary?.male_head_name || 'Beneficiary')}</div>
                        <div class="rd-vr-meta">${_rdEsc(data.message)}</div>
                        ${data.beneficiary?.nic_number ? `<div class="rd-vr-meta">NIC: <strong>${_rdEsc(data.beneficiary.nic_number)}</strong></div>` : ''}
                    </div>
                    <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                </div>`);
            } else if (data.beneficiary && (data.unassigned || !data.token_number)) {
                const b = data.beneficiary;
                const dist = _rdCurrentDist() || {};
                const defaultShop = (_rdEl('rdScannerShopSelect')?.value || '').trim() || (dist.allocated_shops?.split(',')[0]?.trim()) || '';
                show('warn', `
                <div class="rd-vr-id-dossier">
                    <div class="rd-vr-id-topbar">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <span class="rd-vr-nic-verified-badge"><i data-lucide="shield-check" style="width:14px;"></i> ID Card Verified</span>
                            <span class="rd-vr-tag rd-vr-tag-warn">Eligible &bull; No Token Assigned Yet</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">
                            Active Beneficiary Directory
                        </div>
                    </div>
                    <div class="rd-vr-id-bio-row">
                        <div class="rd-vr-photo-frame">
                            ${b.photo_url
                                ? `<img src="${_rdEsc(b.photo_url)}" alt="Beneficiary Photo">`
                                : `<div class="rd-vr-photo-fallback"><i data-lucide="${b.male_head_gender === 'female' ? 'user-round' : 'user'}" style="width:30px;height:30px;opacity:.7;"></i><span>ID Photo</span></div>`
                            }
                        </div>
                        <div class="rd-vr-id-details">
                            <div class="rd-vr-id-name">
                                ${_rdEsc(b.male_head_name || '—')}
                                ${b.male_head_age ? `<span style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">(${b.male_head_age} yrs)</span>` : ''}
                            </div>
                            <div class="rd-vr-id-pills">
                                <span class="rd-vr-nic-pill"><i data-lucide="id-card" style="width:13px;"></i> NIC: ${_rdEsc(b.nic_number || b.female_head_nic || 'N/A')}</span>
                                ${b.application_number ? `<span class="rd-mini-chip">App# ${_rdEsc(b.application_number)}</span>` : ''}
                                ${b.category ? `<span class="rd-mini-chip" style="text-transform:capitalize;">${_rdEsc(b.category)}</span>` : ''}
                            </div>
                            <div class="rd-vr-meta" style="margin-top:5px;">
                                ${b.female_head_name ? `Spouse: <strong>${_rdEsc(b.female_head_name)}</strong>${b.female_head_nic ? ' (NIC ' + _rdEsc(b.female_head_nic) + ')' : ''} &bull; ` : ''}
                                ${b.contact_number ? `Phone: <strong>${_rdEsc(b.contact_number)}</strong> &bull; ` : ''}
                                ${b.address || b.home_town ? `Address: <strong>${_rdEsc(b.address || b.home_town)}</strong>` : ''}
                            </div>
                            <div style="margin-top:8px; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <label style="font-size:0.74rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Allocate Partner Shop:</label>
                                <input type="text" id="rdUnassignedShopInput" value="${_rdEsc(defaultShop)}" placeholder="Select or type Partner Shop..." style="font-size:0.8rem; padding:0.3rem 0.6rem; border-radius:7px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); min-width:200px; font-weight:700;">
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:0.65rem;">
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                            <button type="button" class="rd-vr-btn rd-vr-btn-handover" onclick="addAndCollectBeneficiary(${b.id}, 'issue', '${_rdEsc(b.male_head_name)}', '${_rdEsc(b.nic_number)}')">
                                <i data-lucide="id-card" style="width:17px;"></i> 1. Assign &amp; Hand Over Physical Token Now
                            </button>
                            <button type="button" class="rd-vr-btn rd-vr-btn-issue" onclick="addAndCollectBeneficiary(${b.id}, 'pending', '${_rdEsc(b.male_head_name)}', '${_rdEsc(b.nic_number)}')">
                                <i data-lucide="plus-circle" style="width:15px;"></i> 0. Reserve Token Only (Pending)
                            </button>
                        </div>
                        <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                    </div>
                </div>`);
            } else {
                show('err', `<div class="rd-vr-row" style="flex-wrap:nowrap; align-items:center;">
                    ${iconBox('alert-circle', '#ef4444', 'rgba(239,68,68,.16)')}
                    <div class="rd-vr-main" style="min-width:0;">
                        <span class="rd-vr-tag rd-vr-tag-err">No Match Found</span>
                        <div class="rd-vr-meta" style="font-size:.9rem; color:var(--text-main); font-weight:600; margin-top:2px;">
                            ${_rdEsc(data.message || `No beneficiary or token found matching ID Card / query "${q}"`)}
                        </div>
                        <div class="rd-vr-meta" style="margin-top:3px;">
                            Please check if the beneficiary is registered in the Beneficiary Directory or try searching by Name or Phone.
                        </div>
                    </div>
                    <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                </div>`);
            }
            return;
        }

        const dist = _rdCurrentDist() || {};
        const isPending   = data.status === 'pending';
        const isIssued    = data.status === 'issued';
        const isRedeemed  = data.status === 'redeemed';
        const isCollected = data.status === 'collected';
        const issAt  = data.issued_at ? new Date(data.issued_at).toLocaleString('en-GB') : null;
        const redAt  = data.redeemed_at ? new Date(data.redeemed_at).toLocaleString('en-GB') : null;
        const collAt = (data.shop_collected_at || data.collected_at)
            ? new Date(data.shop_collected_at || data.collected_at).toLocaleString('en-GB') : null;
        const scannerShop = (_rdEl('rdScannerShopSelect')?.value || '').trim();
        const shopOptions = typeof _rdAllAvailableShops === 'function'
            ? _rdAllAvailableShops()
            : (dist.allocated_shops || '').split(',').map(s => s.trim()).filter(Boolean);
        const currentShop = scannerShop || data.allocated_shop || shopOptions[0] || 'Partner Shop';

        // ══════════════════════════════════════════════════════════
        // CASE 1: Token is ALREADY COLLECTED BACK BY EDF (STAGE 3 COMPLETE)
        // ══════════════════════════════════════════════════════════
        if (isCollected) {
            _rdPlayBeep('warn');
            const isIssueDesk = _rdScanMode === 'issue';
            show('warn', `
            <div class="rd-vr-row">
                <div class="rd-vr-main">
                    <div class="rd-vr-head">
                        <span class="rd-vr-tag rd-vr-tag-warn">
                            ${isIssueDesk ? '⚠️ Lifecycle Complete (Already Collected)' : '✔ Stage 3 Complete: Collected Back by EDF'}
                        </span>
                        <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                        ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                    </div>
                    <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                    <div class="rd-vr-meta">
                        ${issAt ? `1. ID Scanned &amp; Issued: <strong>${_rdEsc(issAt)}</strong>${data.issued_by_name ? ' by ' + _rdEsc(data.issued_by_name) : ''}<br>` : ''}
                        ${redAt ? `2. Redeemed at Shop (<strong>${_rdEsc(data.redeemed_by_shop || data.allocated_shop || 'Shop')}</strong>): <strong>${_rdEsc(redAt)}</strong><br>` : ''}
                        3. Collected Back by EDF: <strong>${_rdEsc(collAt || 'Completed')}</strong>${data.shop_collected_by_name || data.collected_by_name ? ' by ' + _rdEsc(data.shop_collected_by_name || data.collected_by_name) : ''}
                        ${data.collector_name ? '<br>Beneficiary / Proxy: <strong>' + _rdEsc(data.collector_name) + '</strong>' + (data.collector_nic ? ' (NIC ' + _rdEsc(data.collector_nic) + ')' : '') : ''}
                        ${data.notes ? '<br>Remarks: ' + _rdEsc(data.notes) : ''}
                    </div>
                </div>
                <div class="rd-vr-actions">
                    <button type="button" class="rd-vr-btn" onclick="printRamadanTokens([${data.id}])"><i data-lucide="printer" style="width:15px;"></i> Re-Print Token Card</button>
                    <div class="rd-vr-actions-row">
                        <button type="button" class="rd-vr-btn" onclick="openRdTokenQuickModal(${data.id})"><i data-lucide="sliders-horizontal" style="width:14px;"></i> Edit / Shop</button>
                        <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                    </div>
                </div>
            </div>`);
            return;
        }

        // ══════════════════════════════════════════════════════════
        // MODE 1: BENEFICIARY ID CARD TOKEN DESK (STAGE 1: PENDING -> ISSUED)
        // ══════════════════════════════════════════════════════════
        if (_rdScanMode === 'issue') {
            if (isRedeemed) {
                _rdPlayBeep('warn');
                show('warn', `
                <div class="rd-vr-row">
                    <div class="rd-vr-main">
                        <div class="rd-vr-head">
                            <span class="rd-vr-tag rd-vr-tag-warn">Stage 2: Already Redeemed at Shop</span>
                            <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                            ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                        </div>
                        <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                        <div class="rd-vr-meta">
                            This physical token was already handed over and redeemed at <strong>${_rdEsc(data.redeemed_by_shop || data.allocated_shop || 'Partner Store')}</strong> on ${_rdEsc(redAt)}.
                            <div style="margin-top:4px; color:#059669; font-weight:700;">Ready for Stage 3: EDF Staff Collection from Shop.</div>
                        </div>
                    </div>
                    <div class="rd-vr-actions">
                        <button type="button" class="rd-vr-btn rd-vr-btn-collect" onclick="confirmRdTokenShopCollection(${data.id})"><i data-lucide="package-check" style="width:16px;"></i> 3. Collect Back for EDF</button>
                        <div class="rd-vr-actions-row">
                            <button type="button" class="rd-vr-btn" onclick="printRamadanTokens([${data.id}])"><i data-lucide="printer" style="width:14px;"></i> Re-Print</button>
                            <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                        </div>
                    </div>
                </div>`);
                return;
            }

            if (isIssued) {
                _rdPlayBeep('warn');
                show('warn', `
                <div class="rd-vr-row">
                    <div class="rd-vr-main">
                        <div class="rd-vr-head">
                            <span class="rd-vr-tag rd-vr-tag-warn">⚠️ Stage 1 Complete: Physical Token Already Issued</span>
                            <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                            ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                        </div>
                        <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                        <div class="rd-vr-meta">
                            Physical token was <strong>already handed over</strong> on <strong>${_rdEsc(issAt || 'Earlier')}</strong>${data.issued_by_name ? ' by ' + _rdEsc(data.issued_by_name) : ''}.<br>
                            Allocated Partner Shop: <strong>${_rdEsc(data.allocated_shop || 'Not Assigned')}</strong> &bull;
                            Collector: <strong>${_rdEsc(data.collector_name || data.beneficiary_name)}</strong>${data.collector_nic ? ' (NIC ' + _rdEsc(data.collector_nic) + ')' : ''}.<br>
                            <span style="color:#0284c7; font-weight:700;">Next Step: Beneficiary submits this physical token at ${_rdEsc(data.allocated_shop || 'their allocated shop')} to purchase goods (Stage 2).</span>
                        </div>
                    </div>
                    <div class="rd-vr-actions">
                        <button type="button" class="rd-vr-btn rd-vr-btn-redeem" onclick="setRdScanMode('redeem'); verifyBeneficiaryNic();">
                            <i data-lucide="store" style="width:16px;"></i> 2. Proceed to Shop Redeem
                        </button>
                        <div class="rd-vr-actions-row">
                            <button type="button" class="rd-vr-btn" onclick="printRamadanTokens([${data.id}])"><i data-lucide="printer" style="width:14px;"></i> Print Card</button>
                            <button type="button" class="rd-vr-btn" onclick="openRdTokenQuickModal(${data.id})"><i data-lucide="sliders-horizontal" style="width:14px;"></i> Edit Shop</button>
                            <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                        </div>
                    </div>
                </div>`);
                return;
            }

            // Token is PENDING (or ABSENT): Beneficiary presents ID card to receive physical token (Stage 1)
            if (_rdAutoCollectEnabled) {
                await confirmRdTokenBeneficiaryHandover(data.id, data.beneficiary_name, data.nic_number, true);
                return;
            }

            // High-Trust Beneficiary ID Card Verification & Physical Token Handover Dossier
            _rdPlayBeep('success');
            const prefillShop = scannerShop || data.allocated_shop || shopOptions[0] || '';
            const shopChipHtml = shopOptions.length > 0 ? `
                <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.35rem;">
                    ${shopOptions.map(s => `<button type="button" class="rd-shop-chip ${s === prefillShop ? 'active' : ''}" style="padding:0.2rem 0.55rem; font-size:0.71rem;" onclick="const inp=document.getElementById('rdHandoverShopInput'); if(inp) inp.value='${_rdEsc(s)}'; this.parentElement.querySelectorAll('.rd-shop-chip').forEach(b=>b.classList.remove('active')); this.classList.add('active');"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(s)}</button>`).join('')}
                </div>` : '';

            show('ok', `
            <div class="rd-vr-id-dossier">
                <!-- Topbar -->
                <div class="rd-vr-id-topbar">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="rd-vr-nic-verified-badge"><i data-lucide="shield-check" style="width:14px;"></i> Stage 1: National ID Verified</span>
                        <span class="rd-vr-tag rd-vr-tag-pending">Ready to Hand Over Physical Token</span>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">
                        Campaign: <strong>${_rdEsc(dist.title || 'Ramadan Campaign')}</strong>
                    </div>
                </div>

                <!-- Bio & Identity Row -->
                <div class="rd-vr-id-bio-row">
                    <!-- Photo -->
                    <div class="rd-vr-photo-frame">
                        ${data.photo_url
                            ? `<img src="${_rdEsc(data.photo_url)}" alt="Beneficiary Photo">`
                            : `<div class="rd-vr-photo-fallback">
                                  <i data-lucide="${data.male_head_gender === 'female' ? 'user-round' : 'user'}" style="width:30px;height:30px;opacity:.7;"></i>
                                  <span>ID Photo</span>
                               </div>`
                        }
                    </div>

                    <!-- Details -->
                    <div class="rd-vr-id-details">
                        <div class="rd-vr-id-name">
                            ${_rdEsc(data.beneficiary_name || '—')}
                            ${data.male_head_age ? `<span style="font-size:0.78rem; font-weight:600; color:var(--text-muted); font-family:sans-serif;">(${data.male_head_age} yrs)</span>` : ''}
                        </div>
                        <div class="rd-vr-id-pills">
                            <span class="rd-vr-nic-pill"><i data-lucide="id-card" style="width:13px;"></i> NIC: ${_rdEsc(data.nic_number || data.female_head_nic || 'N/A')}</span>
                            ${data.application_number ? `<span class="rd-mini-chip">App# ${_rdEsc(data.application_number)}</span>` : ''}
                            ${data.category ? `<span class="rd-mini-chip" style="text-transform:capitalize;">${_rdEsc(data.category)}</span>` : ''}
                        </div>
                        <div class="rd-vr-meta" style="margin-top:5px;">
                            ${data.female_head_name ? `Spouse: <strong>${_rdEsc(data.female_head_name)}</strong>${data.female_head_nic ? ' (NIC ' + _rdEsc(data.female_head_nic) + ')' : ''} &bull; ` : ''}
                            ${data.contact_number ? `Phone: <strong>${_rdEsc(data.contact_number)}</strong> &bull; ` : ''}
                            ${data.address || data.home_town ? `Address: <strong>${_rdEsc(data.address || data.home_town)}</strong>` : ''}
                        </div>

                        <!-- Allocate Partner Shop on Handover -->
                        <div style="margin-top:8px; padding:0.5rem 0.65rem; border-radius:9px; background:rgba(20,184,166,.06); border:1px solid rgba(20,184,166,.22);">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <label style="font-size:0.73rem; font-weight:800; color:#0f766e; text-transform:uppercase; letter-spacing:0.03em;">
                                    <i data-lucide="store" style="width:12px;height:12px;vertical-align:-2px;"></i> Allocate Partner Shop for Redemption:
                                </label>
                                <input type="text" id="rdHandoverShopInput" value="${_rdEsc(prefillShop)}" placeholder="Enter Partner Shop Name..." style="flex:1; min-width:180px; padding:0.32rem 0.6rem; border-radius:7px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); font-size:0.82rem; font-weight:700;">
                            </div>
                            ${shopChipHtml}
                        </div>
                    </div>

                    <!-- Token Showcase -->
                    <div class="rd-vr-token-showcase">
                        <div style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Physical Token #</div>
                        <div class="rd-vr-token-num-large">${_rdEsc(data.token_number)}</div>
                        <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:2px;">
                            ${dist.voucher_value || data.voucher_value ? `<span class="rd-mini-chip" style="color:#059669; font-weight:800; background:rgba(16,185,129,.12);">${_rdEsc(_rdMoney(dist.voucher_value || data.voucher_value))}</span>` : ''}
                            <span class="rd-mini-chip">${_rdEsc(_rdPkgShort(data.package_type || dist.package_type))}</span>
                        </div>
                    </div>
                </div>

                <!-- Collector Selection (Beneficiary In Person vs Representative) -->
                <div class="rd-vr-collector-radios">
                    <span style="color:var(--text-muted); font-size:0.75rem; margin-right:4px;">Physical Token Received by:</span>
                    <label>
                        <input type="radio" name="rdCollectorType_${data.id}" id="rdCollectorIsSelfRadio" value="self" checked onchange="toggleRdCollectorProxy(false)">
                        <span>Beneficiary In Person (ID: ${_rdEsc(data.nic_number || 'NIC')})</span>
                    </label>
                    <label>
                        <input type="radio" name="rdCollectorType_${data.id}" id="rdCollectorIsProxyRadio" value="proxy" onchange="toggleRdCollectorProxy(true)">
                        <span>Representative / Family Member (with ID Card)</span>
                    </label>
                </div>

                <!-- Proxy fields (hidden unless proxy radio selected) -->
                <div id="rdProxyCollectorFields" style="display:none; gap:0.5rem; flex-wrap:wrap; padding:0.6rem 0.8rem; border-radius:10px; background:rgba(99,102,241,.06); border:1px solid rgba(99,102,241,.2);">
                    <input type="text" id="rdProxyCollectorNameInput" placeholder="Representative Full Name" style="flex:1; min-width:160px; padding:0.4rem 0.65rem; border-radius:8px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); font-size:0.82rem;">
                    <input type="text" id="rdProxyCollectorNicInput" placeholder="Representative NIC (e.g. 981234567V)" style="flex:1; min-width:160px; padding:0.4rem 0.65rem; border-radius:8px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); font-size:0.82rem;">
                    <input type="text" id="rdProxyCollectorNotesInput" placeholder="Relationship / Remarks (e.g. Son, Spouse, Brother)" style="flex:1; min-width:180px; padding:0.4rem 0.65rem; border-radius:8px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); font-size:0.82rem;">
                </div>

                <!-- Action Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:0.75rem;">
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button type="button" class="rd-vr-btn rd-vr-btn-handover" onclick="confirmRdTokenBeneficiaryHandover(${data.id}, '${_rdEsc(data.beneficiary_name)}', '${_rdEsc(data.nic_number)}')">
                            <i data-lucide="id-card" style="width:19px;height:19px;"></i> 1. Verify ID &amp; Hand Over Physical Token
                        </button>
                        <button type="button" class="rd-vr-btn" onclick="printRamadanTokens([${data.id}])" title="Print physical token slip for beneficiary">
                            <i data-lucide="printer" style="width:15px;"></i> Print Token Card
                        </button>
                    </div>
                    <div style="display:flex; gap:0.4rem;">
                        <button type="button" class="rd-vr-btn rd-vr-btn-danger" onclick="markRdTokenAbsent(${data.id}).then(()=>clearRdVerifyStrip())">Mark Absent</button>
                        <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                    </div>
                </div>
            </div>`);
            return;
        }

        // ══════════════════════════════════════════════════════════
        // MODE 2: REDEEM AT ALLOCATED SHOP (STAGE 2: ISSUED/PENDING -> REDEEMED)
        // ══════════════════════════════════════════════════════════
        if (_rdScanMode === 'redeem') {
            if (isRedeemed) {
                _rdPlayBeep('warn');
                show('warn', `<div class="rd-vr-row">
                    <div class="rd-vr-main">
                        <div class="rd-vr-head">
                            <span class="rd-vr-tag rd-vr-tag-warn">Stage 2 Complete: Already Redeemed at Shop</span>
                            <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                            ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                        </div>
                        <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                        <div class="rd-vr-meta">
                            Beneficiary already submitted this token &amp; purchased goods on <strong>${_rdEsc(redAt)}</strong> at <strong>${_rdEsc(data.redeemed_by_shop || data.allocated_shop || 'Partner Store')}</strong>.
                            <div style="margin-top:4px; color:#059669; font-weight:700;">
                                Physical token is now held at the shop awaiting Stage 3 (EDF Staff Collection).
                            </div>
                        </div>
                    </div>
                    <div class="rd-vr-actions">
                        <button type="button" class="rd-vr-btn rd-vr-btn-collect" onclick="confirmRdTokenShopCollection(${data.id})"><i data-lucide="package-check" style="width:16px;"></i> 3. Collect Back for EDF Now</button>
                        <div class="rd-vr-actions-row">
                            <button type="button" class="rd-vr-btn" onclick="openRdTokenQuickModal(${data.id})"><i data-lucide="edit-3" style="width:15px;"></i> Edit</button>
                            <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                        </div>
                    </div>
                </div>`);
                return;
            }

            // Token is ISSUED or PENDING: Beneficiary submits physical token to Allocated Shop to purchase goods
            if (_rdAutoCollectEnabled) {
                const markOk = await _rdTokenAction(`/api/ramadan/tokens/${data.id}/redeem`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ redeemed_by_shop: currentShop })
                }, null);

                if (markOk) {
                    _rdPlayBeep('collect');
                    el.style.display = 'block';
                    el.innerHTML = `
                        <div class="rd-auto-collect-banner" style="border-color:#38bdf8;">
                            <div style="display:flex; align-items:center; gap:.8rem; flex:1; min-width:0;">
                                <div class="rd-ac-icon" style="background:#0284c7;"><i data-lucide="store" style="width:24px;height:24px;"></i></div>
                                <div class="rd-ac-content">
                                    <div class="rd-ac-title" style="color:#0369a1;">Stage 2: Redeemed at Partner Shop (${_rdEsc(currentShop)})</div>
                                    <div class="rd-ac-name">${_rdEsc(data.beneficiary_name || 'Beneficiary')} &bull; <span style="font-family:monospace;">${_rdEsc(data.token_number)}</span></div>
                                    <div class="rd-ac-meta">
                                        🏪 Goods purchased at <strong>${_rdEsc(currentShop)}</strong> &bull; Physical token held at shop for EDF collection
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                                <button type="button" class="rd-hdr-btn" onclick="confirmRdTokenShopCollection(${data.id})"><i data-lucide="package-check" style="width:13px;"></i> 3. Also Collect Back</button>
                                <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" onclick="clearRdVerifyStrip()">Next Voucher</button>
                            </div>
                        </div>`;
                    if (window.lucide) lucide.createIcons();
                    setTimeout(() => {
                        const inp = _rdEl('rdVerifyNic');
                        if (inp) { inp.value = ''; if (!_rdIsTouch()) inp.focus(); }
                    }, 1400);
                    return;
                }
            }

            // Manual confirmation card for Stage 2 shop redemption
            _rdPlayBeep('success');
            const prefillRedeemShop = scannerShop || data.allocated_shop || shopOptions[0] || '';
            const redeemShopChips = shopOptions.length > 0 ? `
                <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.35rem;">
                    ${shopOptions.map(s => `<button type="button" class="rd-shop-chip ${s === prefillRedeemShop ? 'active' : ''}" style="padding:0.2rem 0.55rem; font-size:0.71rem;" onclick="const inp=document.getElementById('rdRedeemShopInput'); if(inp) inp.value='${_rdEsc(s)}'; this.parentElement.querySelectorAll('.rd-shop-chip').forEach(b=>b.classList.remove('active')); this.classList.add('active');"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(s)}</button>`).join('')}
                </div>` : '';

            show('pending', `<div class="rd-vr-row">
                <div class="rd-vr-main">
                    <div class="rd-vr-head">
                        <span class="rd-vr-tag rd-vr-tag-redeemed">${isIssued ? '1. Token Issued → Ready for Shop Redemption' : '0. Pending → Ready for Shop Redemption'}</span>
                        <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                        ${dist.voucher_value ? `<span class="rd-mini-chip" style="color:#0284c7; font-weight:800;">${_rdEsc(_rdMoney(dist.voucher_value))}</span>` : ''}
                    </div>
                    <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                    <div class="rd-vr-meta">
                        ${data.application_number ? 'App# <strong>' + _rdEsc(data.application_number) + '</strong> &bull; ' : ''}${data.nic_number ? 'NIC <strong>' + _rdEsc(data.nic_number) + '</strong> &bull; ' : ''}${data.contact_number ? 'Phone <strong>' + _rdEsc(data.contact_number) + '</strong> &bull; ' : ''}${data.home_town ? _rdEsc(data.home_town) : ''}
                        ${issAt ? `<br><span style="color:#0d9488; font-weight:600;">✔ Handed over at ID Desk on ${_rdEsc(issAt)}</span>` : ''}
                    </div>
                    ${dist.package_items ? `<div class="rd-vr-items">📦 ${_rdEsc(dist.package_items)}</div>` : ''}
                    
                    <div style="margin-top:0.65rem; padding:0.5rem 0.65rem; border-radius:9px; background:rgba(2,132,199,.06); border:1px solid rgba(2,132,199,.2);">
                        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                            <label style="font-size:0.74rem; font-weight:800; color:#0369a1; text-transform:uppercase;"><i data-lucide="store" style="width:12px;height:12px;vertical-align:-2px;"></i> Redeeming at Partner Shop:</label>
                            <input type="text" id="rdRedeemShopInput" value="${_rdEsc(prefillRedeemShop)}" placeholder="Partner store name" style="flex:1; font-size:0.82rem; font-weight:700; padding:0.3rem 0.6rem; border-radius:6px; border:1px solid var(--border-color); background:var(--input-bg); color:var(--text-main); min-width:180px;">
                        </div>
                        ${redeemShopChips}
                    </div>

                    <details class="rd-vr-proxy" style="margin-top:0.5rem;">
                        <summary>Redeemed by representative / add shop remarks?</summary>
                        <div class="rd-vr-proxy-fields">
                            <input type="text" id="rdCollectorNameInput" placeholder="Collector full name" value="${_rdEsc(data.collector_name || '')}">
                            <input type="text" id="rdCollectorNicInput" placeholder="Collector NIC" value="${_rdEsc(data.collector_nic || '')}">
                            <input type="text" id="rdCollectorNotesInput" placeholder="Shop bill # / remarks" value="${_rdEsc(data.notes || '')}">
                        </div>
                    </details>
                </div>
                <div class="rd-vr-actions">
                    <button type="button" class="rd-vr-btn rd-vr-btn-redeem" onclick="confirmRdTokenRedemption(${data.id})"><i data-lucide="shopping-bag" style="width:18px;"></i> 2. Confirm Shop Redemption</button>
                    <div class="rd-vr-actions-row">
                        <button type="button" class="rd-vr-btn rd-vr-btn-danger" onclick="markRdTokenAbsent(${data.id}).then(()=>clearRdVerifyStrip())">Mark Absent</button>
                        <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                    </div>
                </div>
            </div>`);
            return;
        }

        // ══════════════════════════════════════════════════════════
        // MODE 3: EDF STAFF COLLECT BACK FROM SHOP (STAGE 3: REDEEMED -> COLLECTED)
        // ══════════════════════════════════════════════════════════
        if (_rdScanMode === 'collect') {
            if (isPending || isIssued) {
                // Physical voucher is being scanned by EDF staff, but wasn't marked 'redeemed' in the system yet
                _rdPlayBeep('warn');
                show('warn', `<div class="rd-vr-row">
                    <div class="rd-vr-main">
                        <div class="rd-vr-head">
                            <span class="rd-vr-tag rd-vr-tag-pending">${isIssued ? '1. Token Issued (Not Yet Marked Redeemed)' : '0. Awaiting ID Scan / Redemption'}</span>
                            <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                            ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                        </div>
                        <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                        <div class="rd-vr-meta">
                            This token is currently in status <strong>${isIssued ? '1. Token Issued' : '0. Awaiting ID Scan'}</strong>.
                            <div style="margin-top:4px; color:var(--text-muted);">
                                If the beneficiary already redeemed this physical token at <strong>${_rdEsc(currentShop)}</strong> and you are now collecting the physical token from the shop, click <strong>"Redeem &amp; Collect Back Now"</strong> to complete both stages at once.
                            </div>
                        </div>
                    </div>
                    <div class="rd-vr-actions">
                        <button type="button" class="rd-vr-btn rd-vr-btn-collect" onclick="redeemAndCollectRdTokenNow(${data.id}, '${_rdEsc(currentShop)}')">
                            <i data-lucide="package-check" style="width:16px;"></i> Redeem &amp; Collect Back Now
                        </button>
                        <div class="rd-vr-actions-row">
                            <button type="button" class="rd-vr-btn rd-vr-btn-redeem" onclick="setRdScanMode('redeem'); verifyBeneficiaryNic();">Switch to Stage 2</button>
                            <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                        </div>
                    </div>
                </div>`);
                return;
            }

            // Token is REDEEMED: Ready for EDF staff audit & collection from shop (Stage 3)
            if (_rdAutoCollectEnabled) {
                const markOk = await _rdTokenAction(`/api/ramadan/tokens/${data.id}/collect-from-shop`, {
                    method: 'PUT'
                }, null);

                if (markOk) {
                    _rdPlayBeep('collect');
                    el.style.display = 'block';
                    el.innerHTML = `
                        <div class="rd-auto-collect-banner">
                            <div style="display:flex; align-items:center; gap:.8rem; flex:1; min-width:0;">
                                <div class="rd-ac-icon"><i data-lucide="package-check" style="width:24px;height:24px;"></i></div>
                                <div class="rd-ac-content">
                                    <div class="rd-ac-title">Stage 3 Complete: Collected Back from Shop by EDF</div>
                                    <div class="rd-ac-name">${_rdEsc(data.beneficiary_name || 'Beneficiary')} &bull; <span style="font-family:monospace;">${_rdEsc(data.token_number)}</span></div>
                                    <div class="rd-ac-meta">
                                        Retrieved from <strong>${_rdEsc(data.redeemed_by_shop || data.allocated_shop || 'Partner Store')}</strong> &bull; Physical token settled
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.4rem;">
                                <button type="button" class="rd-hdr-btn" onclick="openRdTokenQuickModal(${data.id})">Edit</button>
                                <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" onclick="clearRdVerifyStrip()">Next Token</button>
                            </div>
                        </div>`;
                    if (window.lucide) lucide.createIcons();
                    setTimeout(() => {
                        const inp = _rdEl('rdVerifyNic');
                        if (inp) { inp.value = ''; if (!_rdIsTouch()) inp.focus(); }
                    }, 1400);
                    return;
                }
            }

            // Manual confirmation card for Stage 3 shop return
            _rdPlayBeep('success');
            show('warn', `<div class="rd-vr-row">
                <div class="rd-vr-main">
                    <div class="rd-vr-head">
                        <span class="rd-vr-tag rd-vr-tag-redeemed">Stage 2 Redeemed → Ready for EDF Collection</span>
                        <span class="rd-vr-token">${_rdEsc(data.token_number)}</span>
                        ${data.allocated_shop ? `<span class="rd-shop-pill"><i data-lucide="store" style="width:11px;height:11px;"></i> ${_rdEsc(data.allocated_shop)}</span>` : ''}
                    </div>
                    <div class="rd-vr-name">${_rdEsc(data.beneficiary_name) || '—'}</div>
                    <div class="rd-vr-meta">
                        Submitted &amp; redeemed at <strong>${_rdEsc(data.redeemed_by_shop || data.allocated_shop || 'Shop')}</strong> on ${_rdEsc(redAt)}
                        ${data.collector_name ? '<br>Beneficiary / Collector: <strong>' + _rdEsc(data.collector_name) + '</strong>' : ''}
                        ${data.notes ? '<br>Remarks: ' + _rdEsc(data.notes) : ''}
                    </div>
                </div>
                <div class="rd-vr-actions">
                    <button type="button" class="rd-vr-btn rd-vr-btn-collect" onclick="confirmRdTokenShopCollection(${data.id})"><i data-lucide="package-check" style="width:18px;"></i> 3. Confirm Collected from Shop</button>
                    <button type="button" class="rd-vr-btn" onclick="clearRdVerifyStrip()">Dismiss</button>
                </div>
            </div>`);
            return;
        }

    } catch (err) {
        _rdPlayBeep('error');
        show('err', `<span style="font-size:.9rem; color:var(--text-main);"><strong>Network error.</strong> Please check the connection and try again.</span>`);
    } finally {
        _rdVerifyBusy = false;
    }
}

// Stage 1: Confirm ID Card Verification & Physical Token Handover to Beneficiary (sets status = 'issued')
async function confirmRdTokenBeneficiaryHandover(tokenId, defaultName, defaultNic, isAuto = false) {
    let colName = defaultName || null;
    let colNic = defaultNic || null;
    let notes = null;
    const allocatedShop = (_rdEl('rdHandoverShopInput')?.value || _rdEl('rdScannerShopSelect')?.value || '').trim() || undefined;

    if (!isAuto) {
        const isProxy = _rdEl('rdCollectorIsProxyRadio')?.checked;
        if (isProxy) {
            colName = (_rdEl('rdProxyCollectorNameInput')?.value || '').trim() || colName;
            colNic = (_rdEl('rdProxyCollectorNicInput')?.value || '').trim() || colNic;
            notes = (_rdEl('rdProxyCollectorNotesInput')?.value || '').trim() || null;
        }
    }

    const ok = await _rdTokenAction(`/api/ramadan/tokens/${tokenId}/issue`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            allocated_shop: allocatedShop,
            collector_name: colName,
            collector_nic: colNic,
            notes: notes
        })
    }, `1. ID Verified & Physical Token Issued to ${colName || 'beneficiary'}`);

    if (ok) {
        _rdPlayBeep('collect');
        const tok = _rdTokenData.find(t => t.id === tokenId);
        _rdPushSessionEvent('issue', tok?.token_number, colName || tok?.beneficiary_name, tokenId);
        const el = _rdEl('rdVerifyResult');
        if (el) {
            el.style.display = 'block';
            el.innerHTML = `
                <div class="rd-auto-collect-banner rd-ac-stage1">
                    <div style="display:flex; align-items:center; gap:.8rem; flex:1; min-width:0;">
                        <div class="rd-ac-icon"><i data-lucide="id-card" style="width:24px;height:24px;"></i></div>
                        <div class="rd-ac-content">
                            <div class="rd-ac-title">Stage 1 Complete: Physical Token Handed Over</div>
                            <div class="rd-ac-name">${_rdEsc(colName || 'Beneficiary')} &bull; NIC: <strong>${_rdEsc(colNic || 'Verified')}</strong></div>
                            <div class="rd-ac-meta">
                                ✔ ID Card Scanned &bull; Allocated Shop: <strong>${_rdEsc(allocatedShop || 'Assigned')}</strong> &bull; Beneficiary may now redeem at shop
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        <button type="button" class="rd-hdr-btn" onclick="printRamadanTokens([${tokenId}])"><i data-lucide="printer" style="width:13px;"></i> Print Token Card</button>
                        <button type="button" class="rd-hdr-btn rd-hdr-btn-primary" onclick="clearRdVerifyStrip()">Next Beneficiary</button>
                    </div>
                </div>`;
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
                const inp = _rdEl('rdVerifyNic');
                if (inp) { inp.value = ''; if (!_rdIsTouch()) inp.focus(); }
            }, 1800);
        }
    }
}

// Stage 2: Confirm Token Redeemed at Allocated Partner Shop (sets status = 'redeemed')
async function confirmRdTokenRedemption(tokenId) {
    const shop    = (_rdEl('rdRedeemShopInput')?.value || _rdEl('rdScannerShopSelect')?.value || '').trim();
    const colName = (_rdEl('rdCollectorNameInput')?.value || '').trim();
    const colNic  = (_rdEl('rdCollectorNicInput')?.value || '').trim();
    const notes   = (_rdEl('rdCollectorNotesInput')?.value || '').trim();

    const ok = await _rdTokenAction(`/api/ramadan/tokens/${tokenId}/redeem`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            redeemed_by_shop: shop || null,
            collector_name: colName || null,
            collector_nic: colNic || null,
            notes: notes || null
        })
    }, `2. Token marked as Redeemed at ${shop || 'Partner Shop'}`);

    if (ok) {
        _rdPlayBeep('collect');
        const tok = _rdTokenData.find(t => t.id === tokenId);
        _rdPushSessionEvent('redeem', tok?.token_number, colName || tok?.beneficiary_name, tokenId);
        clearRdVerifyStrip();
    }
}

// Stage 3: Confirm Physical Token Collected Back from Shop by EDF Staff (sets status = 'collected')
async function confirmRdTokenShopCollection(tokenId) {
    const ok = await _rdTokenAction(`/api/ramadan/tokens/${tokenId}/collect-from-shop`, {
        method: 'PUT'
    }, '3. Physical token audited and collected back from shop by EDF');

    if (ok) {
        _rdPlayBeep('collect');
        const tok = _rdTokenData.find(t => t.id === tokenId);
        _rdPushSessionEvent('collect', tok?.token_number, tok?.beneficiary_name, tokenId);
        clearRdVerifyStrip();
    }
}

// Combined helper when EDF collects a physical token from a shop that hadn't been marked redeemed yet
async function redeemAndCollectRdTokenNow(tokenId, shopName) {
    const step1 = await fetch(`/api/ramadan/tokens/${tokenId}/redeem`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redeemed_by_shop: shopName || null })
    });
    if (!step1.ok) {
        showToast('Failed to mark token redeemed', 'error');
        return;
    }
    await confirmRdTokenShopCollection(tokenId);
}

async function confirmRdTokenCollection(tokenId) {
    return confirmRdTokenBeneficiaryHandover(tokenId);
}

async function addAndCollectBeneficiary(beneficiaryId, actionOrCollect, defaultName = null, defaultNic = null) {
    if (!_rdCurrentDistId) return;
    const action = actionOrCollect === true ? 'issue' : (actionOrCollect || 'pending');
    const allocatedShop = (_rdEl('rdUnassignedShopInput')?.value || _rdEl('rdScannerShopSelect')?.value || '').trim() || undefined;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-one`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                beneficiary_id: beneficiaryId,
                action,
                allocated_shop: allocatedShop,
                collector_name: defaultName || undefined,
                collector_nic: defaultNic || undefined
            })
        });
        const r = await res.json();
        if (res.ok) {
            _rdPlayBeep(action !== 'pending' ? 'collect' : 'success');
            _rdPushSessionEvent(action === 'pending' ? 'pending' : 'issue', r.token_number, defaultName, r.id);
            showToast(r.message, 'success');
            clearRdVerifyStrip();
            await fetchRdTokens();
            fetchRamadanDistributions();
            if (action !== 'pending' && r.id) {
                setTimeout(() => {
                    if (confirm(`Token ${r.token_number} assigned and issued! Would you like to print the physical token card now?`)) {
                        printRamadanTokens([r.id]);
                    }
                }, 300);
            }
        } else {
            _rdPlayBeep('error');
            showToast(r.message || 'Failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Export / Print (Tokens, Checklists & Partner Shop Settlement Sheets) ──────
function exportRdTokens(format) {
    const dist = _rdCurrentDist() || {};
    const statusMap = {
        pending: '0. Awaiting ID Scan',
        issued: '1. Token Issued (Handed Over)',
        redeemed: '2. Redeemed at Shop',
        collected: '3. Collected by EDF',
        absent: 'Absent'
    };
    const rows = _rdGetFilteredTokens().map(t => ({
        'Token #': t.token_number,
        'Beneficiary': t.beneficiary_name || '',
        'Spouse': t.female_head_name || '',
        'Application #': t.application_number || '',
        'NIC': t.nic_number || '',
        'Phone': t.contact_number || '',
        'Town': t.home_town || '',
        'Category': t.category || '',
        'Allocated Shop': t.allocated_shop || '',
        'Lifecycle Stage': statusMap[t.status] || t.status,
        '1. Issued At (ID Desk)': t.issued_at ? new Date(t.issued_at).toLocaleString('en-GB') : '',
        'Issued By Staff': t.issued_by_name || '',
        '2. Redeemed At Shop': t.redeemed_at ? new Date(t.redeemed_at).toLocaleString('en-GB') : '',
        'Redeemed By Shop': t.redeemed_by_shop || '',
        '3. Collected From Shop At': (t.shop_collected_at || t.collected_at) ? new Date(t.shop_collected_at || t.collected_at).toLocaleString('en-GB') : '',
        'Collected By EDF Staff': t.shop_collected_by_name || t.collected_by_name || '',
        'Collector Name': t.collector_name || '',
        'Voucher Value (LKR)': Number(dist.voucher_value) || 0,
        'Remarks': t.notes || '',
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
    const stageLabel = s => s === 'collected' ? '3. EDF Collected' : s === 'redeemed' ? '2. Shop Redeemed' : s === 'issued' ? '1. Token Issued' : s === 'absent' ? 'Absent' : '0. Awaiting ID';
    const body = rows.map((t, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="m">${_rdEsc(t.token_number)}</td>
            <td>${_rdEsc(t.beneficiary_name)}</td>
            <td class="m">${_rdEsc(t.nic_number)}</td>
            <td>${_rdEsc(t.contact_number)}</td>
            <td>${_rdEsc(t.home_town)}</td>
            <td><strong>${_rdEsc(t.allocated_shop || '—')}</strong></td>
            <td>${stageLabel(t.status)}</td>
            <td class="sig"></td>
        </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Checklist – ${_rdEsc(dist.title || '')}</title>
<style>
 body{font-family:'Segoe UI',Arial,sans-serif; padding:12mm; color:#111;}
 h1{font-size:16px; margin:0;} .sub{font-size:11px; color:#555; margin:3px 0 10px;}
 table{width:100%; border-collapse:collapse; font-size:10.5px;}
 th,td{border:1px solid #999; padding:5px 6px; text-align:left;} th{background:#eee;}
 .m{font-family:'Courier New',monospace;} .sig{width:110px;}
 tr{page-break-inside:avoid;} .np{margin-bottom:8px;}
 @media print{.np{display:none;} body{padding:6mm;}}
</style></head><body>
<div class="np"><button onclick="window.print()">Print</button></div>
<h1>${_rdEsc(org.name || 'EDF Galgamuwa')} – ${_rdEsc(dist.title || 'Ramadan Distribution')}</h1>
<div class="sub">${_rdEsc(dist.year || '')} · ${_rdEsc(_rdFmtDate(dist.collection_date))}${dist.collection_time ? ' · ' + _rdEsc(dist.collection_time) : ''} · ${_rdEsc(dist.collection_location || '')}${dist.allocated_shops ? ' · Allocated Shops: ' + _rdEsc(dist.allocated_shops) : ''} · ${rows.length} beneficiaries</div>
<table><thead><tr><th>#</th><th>Token</th><th>Beneficiary</th><th>NIC</th><th>Phone</th><th>Town</th><th>Allocated Shop</th><th>Lifecycle Stage</th><th>Signature</th></tr></thead><tbody>${body}</tbody></table>
<script>window.onload=()=>window.print();<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { showToast('Allow pop-ups to print', 'error'); return; }
    win.document.write(html); win.document.close();
}

function printRdShopSettlementSheet(shopName = '') {
    const dist = _rdCurrentDist() || {};
    const vVal = Number(dist.voucher_value) || 0;
    const rows = _rdTokenData.filter(t => {
        if (!shopName) return true;
        const s = (t.redeemed_by_shop || t.allocated_shop || '').trim();
        return s === shopName;
    });
    if (!rows.length) {
        showToast('No tokens found for this Partner Shop', 'error');
        return;
    }
    const org = JSON.parse(localStorage.getItem('edf-org-settings') || '{}');
    const issuedCnt = rows.filter(t => t.status === 'issued').length;
    const redeemedCnt = rows.filter(t => t.status === 'redeemed').length;
    const collectedCnt = rows.filter(t => t.status === 'collected').length;
    const totalSettledCnt = redeemedCnt + collectedCnt;
    const stageLabel = s => s === 'collected' ? '3. Collected by EDF' : s === 'redeemed' ? '2. Redeemed at Shop' : s === 'issued' ? '1. Issued (With Beneficiary)' : s === 'absent' ? 'Absent' : '0. Pending';

    const body = rows.map((t, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="m"><strong>${_rdEsc(t.token_number)}</strong></td>
            <td>${_rdEsc(t.beneficiary_name)}</td>
            <td class="m">${_rdEsc(t.nic_number)}</td>
            <td>${_rdEsc(t.redeemed_by_shop || t.allocated_shop || '—')}</td>
            <td>${stageLabel(t.status)}</td>
            <td>${t.redeemed_at ? new Date(t.redeemed_at).toLocaleDateString('en-GB') : '—'}</td>
            <td style="text-align:right;">${vVal ? _rdEsc(_rdMoney(vVal)) : '—'}</td>
        </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Partner Shop Settlement – ${_rdEsc(shopName || 'All Partner Shops')}</title>
<style>
 body{font-family:'Segoe UI',Arial,sans-serif; padding:12mm; color:#111;}
 h1{font-size:16px; margin:0;} .sub{font-size:11px; color:#555; margin:4px 0 12px;}
 .summary{display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px;}
 .scard{border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; background:#f8fafc;}
 .scard .lbl{font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase;}
 .scard .val{font-size:15px; font-weight:800; color:#0f172a; margin-top:2px;}
 table{width:100%; border-collapse:collapse; font-size:10.5px;}
 th,td{border:1px solid #94a3b8; padding:5px 7px; text-align:left;} th{background:#f1f5f9;}
 .m{font-family:'Courier New',monospace;}
 .sigs{display:grid; grid-template-columns:1fr 1fr; gap:30mm; margin-top:22mm; font-size:11px;}
 .sigbox{border-top:1px solid #334155; padding-top:6px; text-align:center;}
 @media print{.np{display:none;} body{padding:6mm;}}
</style></head><body>
<div class="np" style="margin-bottom:10px;"><button onclick="window.print()">Print Settlement Sheet</button></div>
<h1>${_rdEsc(org.name || 'EDF Galgamuwa')} – Partner Shop Token Settlement &amp; Audit Sheet</h1>
<div class="sub">Campaign: <strong>${_rdEsc(dist.title || '')}</strong> (${_rdEsc(dist.year || '')}) &bull; Partner Shop: <strong>${_rdEsc(shopName || 'All Allocated Partner Shops')}</strong> &bull; Printed: ${new Date().toLocaleString('en-GB')}</div>
<div class="summary">
    <div class="scard"><div class="lbl">Allocated Tokens</div><div class="val">${rows.length}</div></div>
    <div class="scard"><div class="lbl">1. With Beneficiaries</div><div class="val">${issuedCnt}</div></div>
    <div class="scard"><div class="lbl">2. At Shop (To Collect)</div><div class="val">${redeemedCnt} ${vVal ? '(' + _rdEsc(_rdMoney(redeemedCnt * vVal)) + ')' : ''}</div></div>
    <div class="scard"><div class="lbl">3. Collected by EDF</div><div class="val">${collectedCnt} ${vVal ? '(' + _rdEsc(_rdMoney(collectedCnt * vVal)) + ')' : ''}</div></div>
</div>
<table>
    <thead><tr><th>#</th><th>Token #</th><th>Beneficiary</th><th>NIC</th><th>Partner Shop</th><th>Lifecycle Stage</th><th>Redeemed Date</th><th style="text-align:right;">Value</th></tr></thead>
    <tbody>${body}</tbody>
</table>
<div style="margin-top:10px; font-size:11px; text-align:right; font-weight:700;">
    Total Redeemed + Collected Physical Vouchers: ${totalSettledCnt} / ${rows.length} ${vVal ? ' — Total Settlement Value: ' + _rdEsc(_rdMoney(totalSettledCnt * vVal)) : ''}
</div>
<div class="sigs">
    <div class="sigbox">Partner Merchant Signature &amp; Stamp (${_rdEsc(shopName || 'Shop')})</div>
    <div class="sigbox">EDF Auditing Officer Signature &amp; Date</div>
</div>
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
        if (!dataUrl && typeof _generateReceiptQrSvg === 'function') {
            const svgStr = _generateReceiptQrSvg(text, size);
            dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr);
        }
        return dataUrl;
    } catch (err) {
        console.warn('QR error:', err);
        if (typeof _generateReceiptQrSvg === 'function') {
            const svgStr = _generateReceiptQrSvg(text, size);
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgStr);
        }
        return '';
    }
}

// Generate Vector Code-128 Barcode SVG (using JsBarcode with SVG fallback)
function _rdGenerateBarcodeSvg(text) {
    if (typeof JsBarcode === 'undefined') {
        if (typeof _generateCode128BarcodeSvg === 'function') {
            return _generateCode128BarcodeSvg(text, 26);
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
            margin: 8,
            background: "#ffffff",
            lineColor: "#0f172a"
        });
        svg.setAttribute("preserveAspectRatio", "none");
        return svg.outerHTML;
    } catch (err) {
        if (typeof _generateCode128BarcodeSvg === 'function') {
            return _generateCode128BarcodeSvg(text, 26);
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
        const designatedShop = t.allocated_shop || dist.allocated_shops || 'Allocated Partner Store';

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
            <div class="tk-shop-banner" style="background:#ecfdf5; border-top:1px dashed #a7f3d0; border-bottom:1px dashed #a7f3d0; padding:6px 12px; display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px;">🏪</span>
                <div style="font-size:8.5px; color:#065f46; font-weight:700;">
                    REDEEM AT ALLOCATED SHOP: <span style="font-size:10px; font-weight:800; color:#064e3b;">${_rdEsc(designatedShop)}</span>
                </div>
            </div>
            <div class="tk-details">
                <div class="tk-detail-cell"><div class="tk-detail-label">BENEFICIARY</div><div class="tk-detail-value">${_rdEsc(t.beneficiary_name) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">APPLICATION #</div><div class="tk-detail-value mono">${_rdEsc(t.application_number) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">NIC NUMBER</div><div class="tk-detail-value mono">${_rdEsc(t.nic_number) || '—'}</div></div>
                <div class="tk-detail-cell"><div class="tk-detail-label">VALIDITY / DATE</div><div class="tk-detail-value">${_rdEsc(when)}</div></div>
                ${dist.collection_location ? `<div class="tk-detail-cell"><div class="tk-detail-label">LOCATION</div><div class="tk-detail-value">${_rdEsc(dist.collection_location)}</div></div>` : ''}
                ${dist.package_items ? `<div class="tk-detail-cell tk-wide"><div class="tk-detail-label">PACK CONTENTS</div><div class="tk-detail-value tk-wrap">${_rdEsc(dist.package_items)}</div></div>` : ''}
            </div>
            <div class="tk-footer">
                <span>Surrender this voucher to the allocated merchant to claim goods. Merchant retains voucher for EDF audit.${dist.coordinator_phone ? ' Helpline: ' + _rdEsc(dist.coordinator_phone) : ''}</span>
                <span class="tk-footer-right">Member-Funded &bull; Official Aid Voucher</span>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Ramadan Tokens – ${_rdEsc(dist.title || '')}</title>
<style>
 *{margin:0;padding:0;box-sizing:border-box;}
 body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f0f0;padding:14mm;color:#111;}
 h1.print-heading{text-align:center;font-size:13px;color:#555;margin-bottom:8mm;letter-spacing:.05em;text-transform:uppercase;}
 .tokens-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm;}
 .token-card{background:#fff;border:1.5px solid #a7f3d0;border-radius:10px;overflow:hidden;break-inside:avoid;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.08);}
 .tk-header{background:linear-gradient(135deg,#064e3b 0%,#059669 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;border-bottom:2px solid #d97706;}
 .tk-logo{width:32px;height:32px;background:#fff;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#065f46;flex-shrink:0;}
 .tk-org{flex:1;} .tk-org-name{color:#fff;font-size:11px;font-weight:700;line-height:1.2;}
 .tk-org-sub{color:rgba(255,255,255,.78);font-size:8.5px;margin-top:1px;}
 .tk-year{background:rgba(245,158,11,.22);border:1px solid rgba(251,191,36,.45);border-radius:20px;color:#fef3c7;font-size:10px;font-weight:700;padding:2px 9px;}
 
 .tk-body{padding:8px 12px;background:#fafafa;border-bottom:1px dashed #d1fae5;display:flex;align-items:center;justify-content:space-between;gap:10px;}
 .tk-body-left{flex:1;min-width:0;}
 .tk-label-sm{font-size:7px;font-weight:700;color:#047857;letter-spacing:.12em;margin-bottom:2px;}
 .tk-token-no{font-size:24px;font-weight:800;color:#064e3b;font-family:'Courier New',monospace;letter-spacing:.05em;line-height:1;}
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

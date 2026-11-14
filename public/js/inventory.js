/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *   EDF GALGAMUWA — Inventory & Assets Studio Controller
 *   Manages items, custody loans, inspection check-in, maintenance & usage logs
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let invData = [];
let invLoansData = [];
let invMaintData = [];
let invUsageData = [];

let invFilterCat = 'All';
let invView = 'list';
let invSortKey = 'name';
let invSortDir = 1;
let invPage = 1;
let invPageSize = 25;

let invSelectedIds = new Set();
let invLoansTab = 'active';
let invOpsTab = 'maintenance';

const INV_CAT_META = {
    'Equipment':        { icon: 'fa-toolbox',            isBook: false },
    'Furniture':        { icon: 'fa-chair',              isBook: false },
    'Audio / Visual':   { icon: 'fa-microphone-lines',   isBook: false },
    'Books & Library':  { icon: 'fa-book-quran',         isBook: true  },
    'Supplies':         { icon: 'fa-boxes-packing',      isBook: false },
    'Tools':            { icon: 'fa-screwdriver-wrench', isBook: false },
    'Electronics':      { icon: 'fa-laptop',             isBook: false },
    'Maintenance Gear': { icon: 'fa-broom',              isBook: false },
    'Vehicles':         { icon: 'fa-van-shuttle',        isBook: false },
    'Other':            { icon: 'fa-tag',                isBook: false }
};

// ── Shared Helpers ─────────────────────────────────────────────────────────────

function escInv(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function invNotify(msg, type = 'success') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else if (type === 'error') {
        console.error('[Inventory]', msg);
    }
}

function invFmtCurrency(num) {
    const val = Number(num) || 0;
    return 'LKR ' + val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function invFmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return escInv(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function invTodayIso(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
}

function getInvCatMeta(cat) {
    return INV_CAT_META[cat] || INV_CAT_META['Other'];
}

function isLoanOverdue(loan) {
    if (!loan || loan.status !== 'Out' || !loan.expected_return_date) return false;
    return String(loan.expected_return_date).slice(0, 10) < invTodayIso(0);
}

function isItemOverdue(itemId) {
    return invLoansData.some((l) => Number(l.item_id) === Number(itemId) && isLoanOverdue(l));
}

function isItemLowStock(item) {
    if (!item) return false;
    const qty = Number(item.quantity) || 0;
    const thresh = Number(item.min_threshold) || 0;
    if (item.tracking_type === 'Bulk') {
        return qty <= thresh;
    }
    return thresh > 0 && qty <= thresh;
}

function getInvEffectiveStatus(item) {
    if (isItemOverdue(item.id)) {
        return { key: 'Overdue', label: 'Overdue Loan', cls: 'inv-status-overdue', icon: 'fa-clock-rotate-left' };
    }
    if (item.status === 'Maintenance') {
        return { key: 'Maintenance', label: 'Maintenance', cls: 'inv-status-maint', icon: 'fa-wrench' };
    }
    if (item.status === 'Retired') {
        return { key: 'Retired', label: 'Retired', cls: 'inv-status-retired', icon: 'fa-box-archive' };
    }
    if (item.status === 'Checked Out') {
        return { key: 'Checked Out', label: 'Checked Out', cls: 'inv-status-out', icon: 'fa-hand-holding' };
    }
    if (isItemLowStock(item)) {
        return { key: 'Low Stock', label: 'Low Stock', cls: 'inv-status-low', icon: 'fa-triangle-exclamation' };
    }
    return { key: 'Available', label: 'Available', cls: 'inv-status-available', icon: 'fa-circle-check' };
}

function refreshInvLottie() {
    if (typeof window !== 'undefined' && typeof window.initEdfLottieIcons === 'function') {
        window.initEdfLottieIcons();
    }
}

function normalizeInvItem(item) {
    if (!item || typeof item !== 'object') return item;
    const rawStatus = String(item.status || '').trim().toLowerCase();
    const statusMap = {
        available: 'Available',
        in_use: 'Checked Out',
        'checked out': 'Checked Out',
        checked_out: 'Checked Out',
        maintenance: 'Maintenance',
        retired: 'Retired'
    };
    const rawTrack = String(item.tracking_type || '').trim().toLowerCase();
    const trackMap = { serialized: 'Serialized', bulk: 'Bulk' };
    const rawCond = String(item.condition || '').trim().toLowerCase();
    const condMap = { new: 'New', good: 'Good', working: 'Good', fair: 'Fair', damaged: 'Damaged' };
    const rawCat = String(item.category || '').trim().toLowerCase();
    const catMap = { it: 'Electronics', library: 'Books & Library', stationery: 'Supplies' };

    return {
        ...item,
        category: catMap[rawCat] || item.category || 'Other',
        tracking_type: trackMap[rawTrack] || item.tracking_type || 'Serialized',
        status: statusMap[rawStatus] || item.status || 'Available',
        condition: condMap[rawCond] || item.condition || 'Good',
        image_url: (item.image_url || '').trim()
    };
}

function normalizeInvLoan(loan) {
    if (!loan || typeof loan !== 'object') return loan;
    const isReturned = Boolean(loan.return_date || loan.actual_return_date || loan.status === 'Returned');
    return {
        ...loan,
        status: loan.status || (isReturned ? 'Returned' : 'Out'),
        checkout_date: loan.checkout_date || loan.loan_date || '',
        actual_return_date: loan.actual_return_date || loan.return_date || ''
    };
}

function sanitizeInvImgUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (raw.startsWith('/') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:image/')) {
        return raw;
    }
    return '';
}

function handleInvThumbError(imgEl, iconCls) {
    if (!imgEl || !imgEl.parentElement) return;
    const wrap = imgEl.parentElement;
    wrap.classList.remove('has-photo');
    if (wrap.classList.contains('inv-card-media')) {
        wrap.remove();
        return;
    }
    const i = document.createElement('i');
    i.className = `fas ${iconCls || 'fa-box'}`;
    imgEl.replaceWith(i);
}

function renderInvQrVisual(container, text, size = 64) {
    if (!container || !text) return;
    container.innerHTML = '';
    if (typeof window !== 'undefined' && typeof window.QRCode === 'function') {
        try {
            new window.QRCode(container, {
                text: String(text),
                width: size,
                height: size,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
            });
            return;
        } catch (err) {
            console.warn('QRCode render fallback:', err);
        }
    }
    container.innerHTML = `<i class="fas fa-qrcode" style="font-size:1.75rem;color:#059669;"></i>`;
}

function openInvModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    el.style.display = 'flex';
    refreshInvLottie();
}

function closeInvModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open', 'active');
    el.style.display = 'none';
}

async function invApi(url, options = {}) {
    const cfg = {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    };
    const res = await fetch(url, cfg);
    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        data = null;
    }
    if (!res.ok) {
        const msg = (data && data.error) || `Request failed (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

if (typeof document !== 'undefined' && !window._invEscListenerBound) {
    window._invEscListenerBound = true;
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const modalIds = [
            'invDetailModal',
            'invReturnModal',
            'invLoansViewModal',
            'invMaintViewModal',
            'invItemModal',
            'invLoanModal',
            'invMaintModal',
            'invUsageModal'
        ];
        for (const id of modalIds) {
            const el = document.getElementById(id);
            if (el && (el.classList.contains('open') || el.style.display === 'flex')) {
                closeInvModal(id);
                break;
            }
        }
    });
}

// ── Fetch & Telemetry Hydration ───────────────────────────────────────────────

async function fetchInventory() {
    try {
        const [itemsRes, loansRes, maintRes, usageRes] = await Promise.allSettled([
            invApi('/api/inventory/items'),
            invApi('/api/inventory/loans'),
            invApi('/api/inventory/maintenance'),
            invApi('/api/inventory/usage')
        ]);

        invData = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value)
            ? itemsRes.value.map(normalizeInvItem)
            : [];
        invLoansData = loansRes.status === 'fulfilled' && Array.isArray(loansRes.value)
            ? loansRes.value.map(normalizeInvLoan)
            : [];
        invMaintData = maintRes.status === 'fulfilled' && Array.isArray(maintRes.value) ? maintRes.value : [];
        invUsageData = usageRes.status === 'fulfilled' && Array.isArray(usageRes.value) ? usageRes.value : [];

        // Prune stale selections after deletion/reload
        const existingIds = new Set(invData.map((i) => Number(i.id)));
        invSelectedIds = new Set([...invSelectedIds].filter((id) => existingIds.has(id)));

        populateInvLocationFilter();
        updateInvStats();
        renderInventory();
        refreshInvLottie();
    } catch (err) {
        console.error('Error loading inventory:', err);
        invNotify('Could not load inventory ledger.', 'error');
    }
}

function populateInvLocationFilter() {
    const sel = document.getElementById('invLocationFilter');
    if (!sel) return;
    const prev = sel.value || 'all';
    const locations = [...new Set(invData.map((i) => (i.location || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="all">All Locations</option>' +
        locations.map((loc) => `<option value="${escInv(loc)}">${escInv(loc)}</option>`).join('');
    if (locations.includes(prev)) {
        sel.value = prev;
    } else {
        sel.value = 'all';
    }
}

function updateInvStats() {
    const totalAssets = invData.length;
    const totalUnits = invData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const activeLoans = invLoansData.filter((l) => l.status === 'Out');
    const outCount = activeLoans.length;
    const overdueCount = activeLoans.filter(isLoanOverdue).length;
    const lowStockCount = invData.filter(isItemLowStock).length;

    const totalCurrentVal = invData.reduce((sum, item) => {
        const val = item.current_value !== null && item.current_value !== undefined
            ? Number(item.current_value) || 0
            : Number(item.purchase_price) || 0;
        const qty = item.tracking_type === 'Bulk' ? Math.max(1, Number(item.quantity) || 0) : 1;
        return sum + (item.tracking_type === 'Bulk' && Number(item.quantity) === 0 ? 0 : val * (item.tracking_type === 'Bulk' ? qty : Math.max(1, qty)));
    }, 0);

    const totalPurchVal = invData.reduce((sum, item) => {
        const val = Number(item.purchase_price) || 0;
        const qty = item.tracking_type === 'Bulk' ? Math.max(0, Number(item.quantity) || 0) : Math.max(1, Number(item.quantity) || 1);
        return sum + (val * qty);
    }, 0);

    const uniqueLocations = new Set(invData.map((i) => (i.location || '').trim()).filter(Boolean)).size;

    const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setTxt('invStatTotal', String(totalAssets));
    setTxt('invStatUnits', `${totalUnits.toLocaleString('en-US')} total units tracked`);
    setTxt('invStatOut', String(outCount));
    setTxt('invStatOutSub', outCount === 1 ? '1 active loan out' : `${outCount} active loans out`);
    setTxt('invStatOverdue', String(overdueCount));
    setTxt('invStatOverdueSub', overdueCount > 0 ? `${overdueCount} overdue return${overdueCount > 1 ? 's' : ''}` : 'All returns on schedule');
    setTxt('invStatLow', String(lowStockCount));
    setTxt('invStatLowSub', lowStockCount > 0 ? `${lowStockCount} item${lowStockCount > 1 ? 's' : ''} below threshold` : 'Thresholds healthy');
    setTxt('invStatValue', invFmtCurrency(totalCurrentVal));
    setTxt('invStatDeprec', `Cost basis: ${invFmtCurrency(totalPurchVal)}`);

    setTxt('invMetaCount', `${totalAssets} Asset${totalAssets === 1 ? '' : 's'}`);
    setTxt('invMetaUtil', `${outCount} Checked Out`);
    setTxt('invMetaLocations', `${uniqueLocations} Location${uniqueLocations === 1 ? '' : 's'}`);
    setTxt('invHeroLoansBadge', String(outCount));
    setTxt('invCatCountAll', String(totalAssets));

    const overdueCard = document.getElementById('invKpiOverdueCard');
    if (overdueCard) overdueCard.classList.toggle('kpi-alert', overdueCount > 0);

    const lowCard = document.getElementById('invKpiLowCard');
    if (lowCard) lowCard.classList.toggle('kpi-warn', lowStockCount > 0);
}

// ── Filtering, Sorting & View Switching ───────────────────────────────────────

function getFilteredInvItems() {
    const q = (document.getElementById('invSearchInput')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('invStatusFilter')?.value || 'all';
    const trackFilter = document.getElementById('invTrackingFilter')?.value || 'all';
    const locFilter = document.getElementById('invLocationFilter')?.value || 'all';

    const clearBtn = document.getElementById('invSearchClearBtn');
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);

    const filtered = invData.filter((item) => {
        if (invFilterCat !== 'All' && item.category !== invFilterCat) return false;
        if (trackFilter !== 'all' && item.tracking_type !== trackFilter) return false;
        if (locFilter !== 'all' && (item.location || '').trim() !== locFilter) return false;

        if (statusFilter !== 'all') {
            if (statusFilter === 'Low Stock') {
                if (!isItemLowStock(item)) return false;
            } else if (statusFilter === 'Overdue') {
                if (!isItemOverdue(item.id)) return false;
            } else if ((item.status || 'Available') !== statusFilter) {
                return false;
            }
        }

        if (q) {
            const haystack = [
                item.name,
                item.category,
                item.serial_number,
                item.qr_code,
                item.location,
                item.book_author,
                item.book_subject,
                item.warranty_info
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        let va;
        let vb;
        if (invSortKey === 'quantity' || invSortKey === 'id') {
            va = Number(a[invSortKey]) || 0;
            vb = Number(b[invSortKey]) || 0;
            return (va - vb) * invSortDir;
        }
        if (invSortKey === 'current_value') {
            va = Number(a.current_value ?? a.purchase_price ?? 0);
            vb = Number(b.current_value ?? b.purchase_price ?? 0);
            return (va - vb) * invSortDir;
        }
        if (invSortKey === 'status') {
            va = getInvEffectiveStatus(a).label.toLowerCase();
            vb = getInvEffectiveStatus(b).label.toLowerCase();
            return va.localeCompare(vb) * invSortDir;
        }
        va = String(a[invSortKey] || '').toLowerCase();
        vb = String(b[invSortKey] || '').toLowerCase();
        return va.localeCompare(vb) * invSortDir;
    });

    return filtered;
}

function filterInventory() {
    invPage = 1;
    updateKpiHighlights();
    renderInventory();
}

function clearInvSearch() {
    const inp = document.getElementById('invSearchInput');
    if (inp) inp.value = '';
    filterInventory();
}

function resetInvFilters() {
    invFilterCat = 'All';
    const inp = document.getElementById('invSearchInput');
    const st = document.getElementById('invStatusFilter');
    const tr = document.getElementById('invTrackingFilter');
    const lc = document.getElementById('invLocationFilter');
    if (inp) inp.value = '';
    if (st) st.value = 'all';
    if (tr) tr.value = 'all';
    if (lc) lc.value = 'all';
    syncCatPillsActive('All');
    filterInventory();
}

function syncCatPillsActive(cat) {
    document.querySelectorAll('#invCatPills .inv-cat-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
    });
}

function setInvCategoryFilter(cat) {
    invFilterCat = cat || 'All';
    syncCatPillsActive(invFilterCat);
    filterInventory();
}

function setInvStatusFilter(status) {
    const st = document.getElementById('invStatusFilter');
    if (st) st.value = status || 'all';
    filterInventory();
}

function filterInvByKpi(status) {
    const st = document.getElementById('invStatusFilter');
    if (st) {
        st.value = st.value === status && status !== 'all' ? 'all' : status;
    }
    filterInventory();
}

function updateKpiHighlights() {
    const statusVal = document.getElementById('invStatusFilter')?.value || 'all';
    const map = {
        invKpiTotalCard: statusVal === 'all',
        invKpiOutCard: statusVal === 'Checked Out',
        invKpiOverdueCard: statusVal === 'Overdue',
        invKpiLowCard: statusVal === 'Low Stock'
    };
    Object.entries(map).forEach(([id, active]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active-kpi', active);
    });
}

function setInvView(view) {
    invView = view === 'grid' ? 'grid' : 'list';
    document.getElementById('invListBtn')?.classList.toggle('active', invView === 'list');
    document.getElementById('invGridBtn')?.classList.toggle('active', invView === 'grid');
    renderInventory();
}

function setInvPageSize(val) {
    invPageSize = val === 'all' ? 999999 : Math.max(1, parseInt(val, 10) || 25);
    invPage = 1;
    renderInventory();
}

function invSort(key) {
    if (invSortKey === key) {
        invSortDir *= -1;
    } else {
        invSortKey = key;
        invSortDir = key === 'current_value' || key === 'id' ? -1 : 1;
    }
    renderInventory();
}

function onInvSortSelect(val) {
    if (!val || !val.includes(':')) return;
    const [key, dir] = val.split(':');
    invSortKey = key;
    invSortDir = dir === 'desc' ? -1 : 1;
    renderInventory();
}

// ── Rendering Table, Bento Grid & Bulk Controls ───────────────────────────────

function renderInventory() {
    const filtered = getFilteredInvItems();
    const listWrap = document.getElementById('invListView');
    const gridWrap = document.getElementById('invGridView');
    const emptyEl = document.getElementById('invEmptyState');
    const tbody = document.getElementById('invTableBody');
    const selectAllCb = document.getElementById('invSelectAll');

    updateBulkBarUI();

    if (filtered.length === 0) {
        if (listWrap) listWrap.style.display = 'none';
        if (gridWrap) gridWrap.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        renderInvPagination(0, 0, 0);
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    const totalPages = Math.max(1, Math.ceil(filtered.length / invPageSize));
    if (invPage > totalPages) invPage = totalPages;
    const startIdx = (invPage - 1) * invPageSize;
    const pageRows = filtered.slice(startIdx, startIdx + invPageSize);

    if (selectAllCb) {
        const allVisibleSelected = pageRows.length > 0 && pageRows.every((r) => invSelectedIds.has(Number(r.id)));
        selectAllCb.checked = allVisibleSelected;
    }

    if (invView === 'list') {
        if (listWrap) listWrap.style.display = 'block';
        if (gridWrap) gridWrap.style.display = 'none';
        if (tbody) {
            tbody.innerHTML = pageRows.map(renderInvTableRow).join('');
        }
    } else {
        if (listWrap) listWrap.style.display = 'none';
        if (gridWrap) {
            gridWrap.style.display = 'grid';
            gridWrap.innerHTML = pageRows.map(renderInvGridCard).join('');
        }
    }

    renderInvPagination(filtered.length, totalPages, startIdx);
}

function buildInvSubMetaHtml(item) {
    const parts = [];
    if (item.serial_number) {
        parts.push(`<span class="inv-tag-chip"><i class="fas fa-hashtag"></i> ${escInv(item.serial_number)}</span>`);
    }
    if (item.qr_code) {
        parts.push(`<span class="inv-tag-chip"><i class="fas fa-qrcode"></i> ${escInv(item.qr_code)}</span>`);
    }
    if (item.category === 'Books & Library' && item.book_author) {
        parts.push(`<span><i class="fas fa-feather-pointed"></i> ${escInv(item.book_author)}</span>`);
    }
    return parts.join('');
}

function buildInvStockMeter(item) {
    const qty = Number(item.quantity) || 0;
    const minT = Number(item.min_threshold) || 0;
    const isLow = isItemLowStock(item);
    const barMax = Math.max(qty, minT * 2, 10);
    const pct = Math.min(100, Math.round((qty / barMax) * 100));
    const fillCls = qty === 0 ? 'empty' : isLow ? 'low' : '';

    return `
        <div class="inv-stock-box">
            <div class="inv-stock-nums">
                <span>${qty}</span>
                ${minT > 0 ? `<span style="font-size:0.71rem;color:var(--text-muted);font-weight:600;">/ min ${minT}</span>` : ''}
            </div>
            <div class="inv-stock-track">
                <div class="inv-stock-fill ${fillCls}" style="width:${pct}%;"></div>
            </div>
        </div>
    `;
}

function renderInvTableRow(item) {
    const id = Number(item.id);
    const meta = getInvCatMeta(item.category);
    const eff = getInvEffectiveStatus(item);
    const selected = invSelectedIds.has(id);
    const currVal = item.current_value !== null && item.current_value !== undefined
        ? Number(item.current_value) || 0
        : Number(item.purchase_price) || 0;
    const purchVal = Number(item.purchase_price) || 0;
    const locLabel = (item.location || '').trim() || 'Unassigned';

    const quickActionBtn = item.tracking_type === 'Bulk'
        ? `<button type="button" class="inv-ico-btn" onclick="openInvDetailModal(${id}, true)" title="Quick Restock"><i class="fas fa-plus"></i></button>`
        : `<button type="button" class="inv-ico-btn gold" onclick="openInvCheckoutModal(${id})" title="Check Out Asset" ${item.status === 'Retired' ? 'disabled style="opacity:0.45;"' : ''}><i class="fas fa-right-from-bracket"></i></button>`;

    const imgUrl = sanitizeInvImgUrl(item.image_url);
    const thumbInner = imgUrl
        ? `<img src="${escInv(imgUrl)}" alt="${escInv(item.name)}" onerror="handleInvThumbError(this, '${escInv(meta.icon)}')">`
        : `<i class="fas ${meta.icon}"></i>`;

    return `
        <tr class="${selected ? 'row-selected' : ''}">
            <td>
                <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleInvRowSelect(${id}, this.checked)" aria-label="Select ${escInv(item.name)}">
            </td>
            <td>
                <div class="inv-asset-cell">
                    <div class="inv-cat-glyph ${meta.isBook ? 'cat-books' : ''} ${imgUrl ? 'has-photo' : ''}">
                        ${thumbInner}
                    </div>
                    <div>
                        <button type="button" class="inv-asset-name-btn" onclick="openInvDetailModal(${id})">${escInv(item.name)}</button>
                        <div class="inv-submeta">${buildInvSubMetaHtml(item) || '<span>Standard Asset</span>'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div style="font-weight:700;font-size:0.81rem;">${escInv(item.category)}</div>
                <div style="font-size:0.71rem;color:var(--text-muted);">${escInv(item.tracking_type || 'Serialized')} &middot; ${escInv(item.condition || 'Good')}</div>
            </td>
            <td>
                <span style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.78rem;font-weight:600;color:${item.location ? 'var(--text-main)' : 'var(--text-muted)'};">
                    <i class="fas fa-location-dot" style="color:#10b981;font-size:0.74rem;"></i> ${escInv(locLabel)}
                </span>
            </td>
            <td>${buildInvStockMeter(item)}</td>
            <td>
                <span class="inv-status-pill ${eff.cls}">
                    <i class="fas ${eff.icon}"></i> ${escInv(eff.label)}
                </span>
            </td>
            <td>
                <div style="font-weight:800;font-variant-numeric:tabular-nums;">${invFmtCurrency(currVal)}</div>
                ${purchVal > 0 && purchVal !== currVal ? `<div style="font-size:0.7rem;color:var(--text-muted);">Cost ${invFmtCurrency(purchVal)}</div>` : ''}
            </td>
            <td>
                <div class="inv-row-actions">
                    <button type="button" class="inv-ico-btn" onclick="openInvDetailModal(${id})" title="Asset Dossier &amp; Print Tag"><i class="fas fa-qrcode"></i></button>
                    ${quickActionBtn}
                    <button type="button" class="inv-ico-btn" onclick="openInvMaintModal(${id})" title="Log Service"><i class="fas fa-wrench"></i></button>
                    <button type="button" class="inv-ico-btn" onclick="openInvItemModal('edit', ${id})" title="Edit Asset"><i class="fas fa-pen"></i></button>
                    <button type="button" class="inv-ico-btn danger" onclick="deleteInvItem(${id})" title="Delete Asset"><i class="fas fa-trash-can"></i></button>
                </div>
            </td>
        </tr>
    `;
}

function renderInvGridCard(item) {
    const id = Number(item.id);
    const meta = getInvCatMeta(item.category);
    const eff = getInvEffectiveStatus(item);
    const selected = invSelectedIds.has(id);
    const cardStateCls = eff.key === 'Overdue' ? 'is-overdue' : eff.key === 'Low Stock' ? 'is-low' : eff.key === 'Checked Out' ? 'is-out' : '';
    const currVal = item.current_value !== null && item.current_value !== undefined
        ? Number(item.current_value) || 0
        : Number(item.purchase_price) || 0;
    const imgUrl = sanitizeInvImgUrl(item.image_url);
    const cardGlyphInner = imgUrl
        ? `<img src="${escInv(imgUrl)}" alt="${escInv(item.name)}" onerror="handleInvThumbError(this, '${escInv(meta.icon)}')">`
        : `<i class="fas ${meta.icon}"></i>`;

    return `
        <div class="inv-asset-card ${cardStateCls}">
            ${imgUrl ? `<div class="inv-card-media" onclick="openInvDetailModal(${id})"><img src="${escInv(imgUrl)}" alt="${escInv(item.name)}" onerror="handleInvThumbError(this, '${escInv(meta.icon)}')"></div>` : ''}
            <div class="inv-card-top">
                <div style="display:flex;align-items:center;gap:0.65rem;">
                    <div class="inv-cat-glyph ${meta.isBook ? 'cat-books' : ''} ${imgUrl ? 'has-photo' : ''}">
                        ${cardGlyphInner}
                    </div>
                    <div>
                        <div class="inv-card-title" onclick="openInvDetailModal(${id})">${escInv(item.name)}</div>
                        <div style="font-size:0.73rem;color:var(--text-muted);">${escInv(item.category)}</div>
                    </div>
                </div>
                <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleInvRowSelect(${id}, this.checked)" aria-label="Select ${escInv(item.name)}">
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                <span class="inv-status-pill ${eff.cls}"><i class="fas ${eff.icon}"></i> ${escInv(eff.label)}</span>
                ${item.qr_code ? `<span class="inv-tag-chip"><i class="fas fa-qrcode"></i> ${escInv(item.qr_code)}</span>` : ''}
            </div>

            <div class="inv-card-specs">
                <div class="inv-spec-item">
                    <span>Location</span>
                    <strong>${escInv(item.location || 'Unassigned')}</strong>
                </div>
                <div class="inv-spec-item">
                    <span>Stock (${escInv(item.tracking_type || 'Serialized')})</span>
                    <strong>${Number(item.quantity) || 0}${Number(item.min_threshold) > 0 ? ` / min ${item.min_threshold}` : ''}</strong>
                </div>
                <div class="inv-spec-item">
                    <span>Condition</span>
                    <strong>${escInv(item.condition || 'Good')}</strong>
                </div>
                <div class="inv-spec-item">
                    <span>Book Value</span>
                    <strong>${invFmtCurrency(currVal)}</strong>
                </div>
            </div>

            <div class="inv-card-footer">
                <button type="button" class="inv-btn" style="padding:0.36rem 0.65rem;font-size:0.74rem;" onclick="openInvDetailModal(${id})">
                    <i class="fas fa-eye"></i> Dossier
                </button>
                <div style="display:flex;gap:0.3rem;">
                    ${item.tracking_type === 'Bulk'
                        ? `<button type="button" class="inv-ico-btn" onclick="openInvDetailModal(${id}, true)" title="Quick Restock"><i class="fas fa-plus"></i></button>`
                        : `<button type="button" class="inv-ico-btn gold" onclick="openInvCheckoutModal(${id})" title="Check Out"><i class="fas fa-right-from-bracket"></i></button>`}
                    <button type="button" class="inv-ico-btn" onclick="openInvMaintModal(${id})" title="Log Service"><i class="fas fa-wrench"></i></button>
                    <button type="button" class="inv-ico-btn" onclick="openInvItemModal('edit', ${id})" title="Edit"><i class="fas fa-pen"></i></button>
                    <button type="button" class="inv-ico-btn danger" onclick="deleteInvItem(${id})" title="Delete"><i class="fas fa-trash-can"></i></button>
                </div>
            </div>
        </div>
    `;
}

function renderInvPagination(totalItems, totalPages, startIdx) {
    const el = document.getElementById('invPagination');
    if (!el) return;
    if (totalItems === 0) {
        el.innerHTML = '';
        el.style.display = 'none';
        return;
    }
    el.style.display = 'flex';
    const endIdx = Math.min(totalItems, startIdx + invPageSize);
    let btns = `<button type="button" class="inv-page-btn" ${invPage <= 1 ? 'disabled' : ''} onclick="goInvPage(${invPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
    const startPage = Math.max(1, invPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    for (let p = startPage; p <= endPage; p++) {
        btns += `<button type="button" class="inv-page-btn ${p === invPage ? 'active' : ''}" onclick="goInvPage(${p})">${p}</button>`;
    }
    btns += `<button type="button" class="inv-page-btn" ${invPage >= totalPages ? 'disabled' : ''} onclick="goInvPage(${invPage + 1})"><i class="fas fa-chevron-right"></i></button>`;

    el.innerHTML = `
        <div>Showing <strong>${startIdx + 1}–${endIdx}</strong> of <strong>${totalItems}</strong> assets</div>
        <div class="inv-page-btns">${btns}</div>
    `;
}

function goInvPage(p) {
    invPage = Math.max(1, p);
    renderInventory();
}

// ── Bulk Selection & Export CSV ───────────────────────────────────────────────

function toggleInvRowSelect(id, checked) {
    const numId = Number(id);
    if (checked) invSelectedIds.add(numId);
    else invSelectedIds.delete(numId);
    updateBulkBarUI();
    renderInventory();
}

function toggleInvSelectAll(checked) {
    const filtered = getFilteredInvItems();
    const startIdx = (invPage - 1) * invPageSize;
    const pageRows = filtered.slice(startIdx, startIdx + invPageSize);
    pageRows.forEach((item) => {
        const id = Number(item.id);
        if (checked) invSelectedIds.add(id);
        else invSelectedIds.delete(id);
    });
    updateBulkBarUI();
    renderInventory();
}

function clearInvSelection() {
    invSelectedIds.clear();
    updateBulkBarUI();
    renderInventory();
}

function updateBulkBarUI() {
    const bar = document.getElementById('invBulkBar');
    const countEl = document.getElementById('invBulkCount');
    if (!bar) return;
    const count = invSelectedIds.size;
    bar.classList.toggle('visible', count > 0);
    if (countEl) countEl.textContent = `${count} asset${count === 1 ? '' : 's'} selected`;
}

async function bulkDeleteInvItems() {
    const ids = [...invSelectedIds];
    if (ids.length === 0) return;
    if (typeof confirm === 'function' && !confirm(`Permanently delete ${ids.length} selected asset(s) and their logs?`)) {
        return;
    }
    try {
        await invApi('/api/inventory/items/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
        invSelectedIds.clear();
        invNotify(`${ids.length} asset(s) deleted.`, 'success');
        await fetchInventory();
    } catch (err) {
        invNotify('Bulk delete failed: ' + err.message, 'error');
    }
}

function exportInventoryCSV(selectedOnly = false) {
    const sourceRows = selectedOnly && invSelectedIds.size > 0
        ? invData.filter((i) => invSelectedIds.has(Number(i.id)))
        : getFilteredInvItems();

    if (sourceRows.length === 0) {
        invNotify('No assets available to export.', 'error');
        return;
    }

    const headers = [
        'ID', 'Name', 'Category', 'Tracking Type', 'Location',
        'Serial Number', 'QR / Asset Tag', 'Quantity', 'Min Threshold',
        'Status', 'Condition', 'Purchase Price (LKR)', 'Current Value (LKR)', 'Warranty'
    ];
    const escCsv = (val) => '"' + String(val ?? '').replace(/"/g, '""') + '"';
    const lines = [headers.map(escCsv).join(',')];

    sourceRows.forEach((r) => {
        lines.push([
            r.id, r.name, r.category, r.tracking_type, r.location || '',
            r.serial_number || '', r.qr_code || '', r.quantity ?? 0, r.min_threshold ?? 0,
            r.status || 'Available', r.condition || 'Good',
            r.purchase_price ?? 0, r.current_value ?? r.purchase_price ?? 0, r.warranty_info || ''
        ].map(escCsv).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edf-inventory-${invTodayIso(0)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    invNotify(`Exported ${sourceRows.length} asset record(s) to CSV.`, 'success');
}

// ── Add / Edit Asset Modal ────────────────────────────────────────────────────

function selectInvModalCat(cat) {
    const sel = document.getElementById('invItemCat');
    if (sel) sel.value = cat;
    document.querySelectorAll('#invCatPickerGrid .inv-cat-tile').forEach((tile) => {
        tile.classList.toggle('selected', tile.dataset.catVal === cat);
    });
    onInvCategoryChange();
}

function onInvCategoryChange() {
    const cat = document.getElementById('invItemCat')?.value || 'Equipment';
    const libSec = document.getElementById('invLibrarySection');
    if (libSec) {
        libSec.style.display = cat === 'Books & Library' ? 'block' : 'none';
    }
    const modeEl = document.getElementById('invItemId');
    if (modeEl && !modeEl.value && (cat === 'Supplies')) {
        const trackEl = document.getElementById('invItemTrackType');
        if (trackEl) trackEl.value = 'Bulk';
    }
    document.querySelectorAll('#invCatPickerGrid .inv-cat-tile').forEach((tile) => {
        tile.classList.toggle('selected', tile.dataset.catVal === cat);
    });
}

function generateInvQrTag() {
    const yr = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const existing = new Set(invData.map((i) => (i.qr_code || '').toUpperCase()));
    let tag = `EDF-AST-${yr}-${rand}`;
    while (existing.has(tag)) {
        tag = `EDF-AST-${yr}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const input = document.getElementById('invItemQrCode');
    if (input) input.value = tag;
}

function updateInvDeprecPreview() {
    const badge = document.getElementById('invDeprecPreview');
    if (!badge) return;
    const purch = parseFloat(document.getElementById('invItemPurchPrice')?.value);
    const curr = parseFloat(document.getElementById('invItemCurrVal')?.value);
    if (!purch || purch <= 0) {
        badge.className = 'inv-status-pill inv-status-available';
        badge.textContent = 'Valuation: Enter purchase cost';
        return;
    }
    const effectiveCurr = Number.isNaN(curr) ? purch : curr;
    const pct = Math.max(0, Math.round((effectiveCurr / purch) * 100));
    badge.className = pct >= 70 ? 'inv-status-pill inv-status-available' : pct >= 35 ? 'inv-status-pill inv-status-out' : 'inv-status-pill inv-status-overdue';
    badge.textContent = `Book value retained: ${pct}%`;
}

function renderInvPhotoPreviewBox(url) {
    const box = document.getElementById('invItemPhotoPreview');
    const clearBtn = document.getElementById('invItemPhotoClearBtn');
    const hidden = document.getElementById('invItemImageUrl');
    const textInput = document.getElementById('invItemImageInput');
    const clean = sanitizeInvImgUrl(url);

    if (hidden) hidden.value = clean;
    if (textInput && textInput.value.trim() !== clean) textInput.value = clean;
    if (clearBtn) clearBtn.style.display = clean ? 'inline-flex' : 'none';
    if (!box) return;

    if (clean) {
        box.innerHTML = `<img src="${escInv(clean)}" alt="Asset preview" onerror="clearInvPhoto()">`;
    } else {
        box.innerHTML = '<i class="fas fa-camera"></i><span>No Image</span>';
    }
}

function syncInvPhotoPreviewFromUrl(val) {
    renderInvPhotoPreviewBox(val);
}

function clearInvPhoto() {
    const fileInput = document.getElementById('invItemPhotoFile');
    if (fileInput) fileInput.value = '';
    const textInput = document.getElementById('invItemImageInput');
    if (textInput) textInput.value = '';
    renderInvPhotoPreviewBox('');
}

async function handleInvPhotoFileChange(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        invNotify('Asset image must be under 5 MB.', 'error');
        input.value = '';
        return;
    }
    try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch('/api/inventory/upload-image', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.image_url) {
            throw new Error((data && (data.message || data.error)) || `Upload failed (${res.status})`);
        }
        renderInvPhotoPreviewBox(data.image_url);
        invNotify('Asset image uploaded.', 'success');
    } catch (err) {
        invNotify('Image upload failed: ' + err.message, 'error');
    } finally {
        input.value = '';
    }
}

function openInvItemModal(mode = 'add', itemId = null) {
    const form = document.getElementById('invItemForm');
    if (form) form.reset();

    document.getElementById('invItemId').value = '';
    document.getElementById('invItemModalTitle').textContent = mode === 'edit' ? 'Edit Asset Details' : 'Register Organization Asset';
    document.getElementById('invItemModalSub').textContent = mode === 'edit'
        ? 'Update specifications, custody tag, storage location, or valuation.'
        : 'Define tracking mode, custody tag, storage room, and valuation.';

    if (mode === 'edit' && itemId !== null) {
        const item = invData.find((i) => Number(i.id) === Number(itemId));
        if (!item) return;

        document.getElementById('invItemId').value = String(item.id);
        document.getElementById('invItemName').value = item.name || '';
        selectInvModalCat(item.category || 'Equipment');
        document.getElementById('invItemTrackType').value = item.tracking_type || 'Serialized';
        document.getElementById('invItemLocation').value = item.location || '';
        document.getElementById('invItemSerial').value = item.serial_number || '';
        document.getElementById('invItemQrCode').value = item.qr_code || '';
        document.getElementById('invItemQty').value = item.quantity ?? 1;
        document.getElementById('invItemMinThresh').value = item.min_threshold ?? 0;
        document.getElementById('invItemCond').value = item.condition || 'Good';
        document.getElementById('invItemStatus').value = item.status || 'Available';
        document.getElementById('invItemPurchPrice').value = item.purchase_price ?? '';
        document.getElementById('invItemCurrVal').value = item.current_value ?? '';
        document.getElementById('invItemWarranty').value = item.warranty_info || '';
        document.getElementById('invBookAuthor').value = item.book_author || '';
        document.getElementById('invBookLang').value = item.book_language || 'English';
        document.getElementById('invBookSubject').value = item.book_subject || '';
        document.getElementById('invLibraryType').value = item.library_type || 'Lending';
        renderInvPhotoPreviewBox(item.image_url || '');
    } else {
        selectInvModalCat('Equipment');
        document.getElementById('invItemTrackType').value = 'Serialized';
        document.getElementById('invItemQty').value = '1';
        document.getElementById('invItemMinThresh').value = '0';
        document.getElementById('invItemCond').value = 'Good';
        document.getElementById('invItemStatus').value = 'Available';
        renderInvPhotoPreviewBox('');
    }

    updateInvDeprecPreview();
    openInvModal('invItemModal');
}

async function saveInvItem(e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('invItemId')?.value;
    const purchRaw = document.getElementById('invItemPurchPrice')?.value;
    const currRaw = document.getElementById('invItemCurrVal')?.value;
    const purchase_price = purchRaw !== '' ? parseFloat(purchRaw) : 0;
    const current_value = currRaw !== '' ? parseFloat(currRaw) : purchase_price;

    const imageUrlRaw = document.getElementById('invItemImageUrl')?.value || document.getElementById('invItemImageInput')?.value || '';

    const payload = {
        name: (document.getElementById('invItemName')?.value || '').trim(),
        category: document.getElementById('invItemCat')?.value || 'Equipment',
        tracking_type: document.getElementById('invItemTrackType')?.value || 'Serialized',
        location: (document.getElementById('invItemLocation')?.value || '').trim(),
        serial_number: (document.getElementById('invItemSerial')?.value || '').trim(),
        qr_code: (document.getElementById('invItemQrCode')?.value || '').trim(),
        quantity: parseInt(document.getElementById('invItemQty')?.value, 10) || 0,
        min_threshold: parseInt(document.getElementById('invItemMinThresh')?.value, 10) || 0,
        condition: document.getElementById('invItemCond')?.value || 'Good',
        status: document.getElementById('invItemStatus')?.value || 'Available',
        purchase_price,
        current_value,
        warranty_info: (document.getElementById('invItemWarranty')?.value || '').trim(),
        book_author: (document.getElementById('invBookAuthor')?.value || '').trim(),
        book_language: document.getElementById('invBookLang')?.value || 'English',
        book_subject: (document.getElementById('invBookSubject')?.value || '').trim(),
        library_type: document.getElementById('invLibraryType')?.value || 'Lending',
        image_url: sanitizeInvImgUrl(imageUrlRaw)
    };

    try {
        if (id) {
            await invApi(`/api/inventory/items/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            invNotify(`Updated asset "${payload.name}".`, 'success');
        } else {
            await invApi('/api/inventory/items', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            invNotify(`Registered asset "${payload.name}".`, 'success');
        }
        closeInvModal('invItemModal');
        await fetchInventory();
    } catch (err) {
        invNotify('Could not save asset: ' + err.message, 'error');
    }
}

async function deleteInvItem(id) {
    const item = invData.find((i) => Number(i.id) === Number(id));
    const label = item ? item.name : `#${id}`;
    if (typeof confirm === 'function' && !confirm(`Delete "${label}" along with its custody and service logs?`)) {
        return;
    }
    try {
        await invApi(`/api/inventory/items/${id}`, { method: 'DELETE' });
        invSelectedIds.delete(Number(id));
        invNotify(`Deleted "${label}".`, 'success');
        await fetchInventory();
    } catch (err) {
        invNotify('Could not delete asset: ' + err.message, 'error');
    }
}

// ── Check-Out & Return Inspection Workflow ───────────────────────────────────

function setInvLoanDueOffset(days) {
    const input = document.getElementById('invLoanDueDate');
    if (input) input.value = invTodayIso(days);
}

function openInvCheckoutModal(preselectedId = null) {
    const form = document.getElementById('invLoanForm');
    if (form) form.reset();

    const sel = document.getElementById('invLoanItemId');
    if (sel) {
        const eligible = invData.filter((i) =>
            i.status !== 'Retired' &&
            i.status !== 'Maintenance' &&
            (Number(i.quantity) || 0) > 0 &&
            !(i.category === 'Books & Library' && i.library_type === 'Reference Only')
        );
        if (eligible.length === 0) {
            sel.innerHTML = '<option value="">No eligible assets available</option>';
        } else {
            sel.innerHTML = eligible.map((i) =>
                `<option value="${i.id}">${escInv(i.name)} (${escInv(i.category)}${i.location ? ' · ' + escInv(i.location) : ''})</option>`
            ).join('');
        }
        if (preselectedId !== null) sel.value = String(preselectedId);
    }

    setInvLoanDueOffset(7);
    openInvModal('invLoanModal');
}

async function saveInvLoan(e) {
    if (e && e.preventDefault) e.preventDefault();
    const payload = {
        item_id: parseInt(document.getElementById('invLoanItemId')?.value, 10),
        borrower_name: (document.getElementById('invLoanBorrower')?.value || '').trim(),
        borrower_type: document.getElementById('invLoanType')?.value || 'Member',
        expected_return_date: document.getElementById('invLoanDueDate')?.value || null,
        notes: (document.getElementById('invLoanNotes')?.value || '').trim()
    };

    if (!payload.item_id) {
        invNotify('Please select a valid asset to check out.', 'error');
        return;
    }

    try {
        await invApi('/api/inventory/loans', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        invNotify(`Checked out asset to ${payload.borrower_name}.`, 'success');
        closeInvModal('invLoanModal');
        await fetchInventory();
    } catch (err) {
        invNotify('Could not complete check-out: ' + err.message, 'error');
    }
}

function openInvLoansViewModal(initialTab = 'active') {
    invLoansTab = initialTab || 'active';
    setInvLoansTab(invLoansTab);
    openInvModal('invLoansViewModal');
}

function setInvLoansTab(tab) {
    invLoansTab = tab || 'active';
    document.querySelectorAll('#invLoansViewModal .inv-mtab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.loanTab === invLoansTab);
    });
    renderInvLoansTable();
}

function renderInvLoansTable() {
    const tbody = document.getElementById('invLoansTableBody');
    if (!tbody) return;
    const q = (document.getElementById('invLoansSearch')?.value || '').trim().toLowerCase();

    const rows = invLoansData.filter((l) => {
        const overdue = isLoanOverdue(l);
        if (invLoansTab === 'active' && l.status !== 'Out') return false;
        if (invLoansTab === 'overdue' && !overdue) return false;
        if (invLoansTab === 'returned' && l.status !== 'Returned') return false;
        if (q) {
            const hay = `${l.item_name || ''} ${l.borrower_name || ''} ${l.borrower_type || ''} ${l.notes || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No loan records in this view.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((l) => {
        const overdue = isLoanOverdue(l);
        const pillCls = l.status === 'Returned'
            ? 'inv-status-available'
            : overdue
                ? 'inv-status-overdue'
                : 'inv-status-out';
        const pillText = l.status === 'Returned'
            ? `Returned (${escInv(l.return_condition || 'Good')})`
            : overdue
                ? 'Overdue'
                : 'Out';
        const dateCol = l.status === 'Returned'
            ? `Returned: ${invFmtDate(l.actual_return_date)}`
            : `Due: ${invFmtDate(l.expected_return_date)}`;

        return `
            <tr>
                <td><strong>${escInv(l.item_name || `Item #${l.item_id}`)}</strong></td>
                <td>
                    <div>${escInv(l.borrower_name)}</div>
                    <div style="font-size:0.71rem;color:var(--text-muted);">${escInv(l.borrower_type || 'Member')}</div>
                </td>
                <td>${invFmtDate(l.checkout_date)}</td>
                <td>${dateCol}</td>
                <td><span class="inv-status-pill ${pillCls}">${pillText}</span></td>
                <td style="text-align:right;">
                    ${l.status === 'Out'
                        ? `<button type="button" class="inv-mbtn inv-mbtn-primary" style="padding:0.34rem 0.72rem;font-size:0.75rem;" onclick="openInvReturnModal(${l.id}, ${l.item_id})"><i class="fas fa-clipboard-check"></i> Check In</button>`
                        : `<span style="font-size:0.74rem;color:var(--text-muted);">Closed</span>`
                    }
                </td>
            </tr>
        `;
    }).join('');
}

function selectInvReturnCond(cond) {
    const sel = document.getElementById('invRetCondition');
    if (sel) sel.value = cond;
    document.querySelectorAll('#invReturnModal .inv-cond-card').forEach((card) => {
        card.classList.toggle('selected', card.dataset.cond === cond);
    });
}

function openInvReturnModal(loanId, itemId) {
    const loan = invLoansData.find((l) => Number(l.id) === Number(loanId));
    document.getElementById('invRetLoanId').value = String(loanId);
    document.getElementById('invRetItemId').value = String(itemId);
    const notesEl = document.getElementById('invRetNotes');
    if (notesEl) notesEl.value = '';
    selectInvReturnCond('Good');

    const summaryEl = document.getElementById('invRetItemSummary');
    if (summaryEl) {
        if (loan) {
            const overdue = isLoanOverdue(loan);
            summaryEl.innerHTML = `
                <div>
                    <div style="font-weight:800;font-size:0.95rem;color:var(--text-main);">${escInv(loan.item_name || `Asset #${itemId}`)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.15rem;">
                        Borrower: <strong>${escInv(loan.borrower_name)}</strong> &middot; Issued ${invFmtDate(loan.checkout_date)}
                    </div>
                </div>
                <span class="inv-status-pill ${overdue ? 'inv-status-overdue' : 'inv-status-out'}">
                    ${overdue ? 'Overdue Return' : 'Active Loan'}
                </span>
            `;
        } else {
            summaryEl.innerHTML = `<div><strong>Loan #${loanId}</strong> &middot; Asset #${itemId}</div>`;
        }
    }

    openInvModal('invReturnModal');
}

// Legacy alias kept so any external callers open the dedicated return inspection modal
function returnInvItem(loanId, itemId) {
    openInvReturnModal(loanId, itemId);
}

async function submitInvReturn(e) {
    if (e && e.preventDefault) e.preventDefault();
    const loanId = document.getElementById('invRetLoanId')?.value;
    const itemId = document.getElementById('invRetItemId')?.value;
    const return_condition = document.getElementById('invRetCondition')?.value || 'Good';
    const notes = (document.getElementById('invRetNotes')?.value || '').trim();

    try {
        await invApi(`/api/inventory/loans/${loanId}/return`, {
            method: 'PUT',
            body: JSON.stringify({
                return_condition,
                notes,
                item_id: parseInt(itemId, 10)
            })
        });
        invNotify('Asset checked in and returned to custody.', 'success');
        closeInvModal('invReturnModal');
        await fetchInventory();
        const loansModal = document.getElementById('invLoansViewModal');
        if (loansModal && loansModal.classList.contains('open')) {
            renderInvLoansTable();
        }
    } catch (err) {
        invNotify('Check-in failed: ' + err.message, 'error');
    }
}

// ── Maintenance & Consumables Usage ───────────────────────────────────────────

function openInvMaintModal(itemId = null) {
    const form = document.getElementById('invMaintForm');
    if (form) form.reset();

    const sel = document.getElementById('invMaintItemId');
    if (sel) {
        sel.innerHTML = invData.map((i) =>
            `<option value="${i.id}">${escInv(i.name)} (${escInv(i.category)})</option>`
        ).join('') || '<option value="">No assets registered</option>';
        if (itemId !== null) sel.value = String(itemId);
    }

    const svcDate = document.getElementById('invMaintDate');
    if (svcDate) svcDate.value = invTodayIso(0);

    openInvModal('invMaintModal');
}

async function saveInvMaint(e) {
    if (e && e.preventDefault) e.preventDefault();
    const payload = {
        item_id: parseInt(document.getElementById('invMaintItemId')?.value, 10),
        service_date: document.getElementById('invMaintDate')?.value || invTodayIso(0),
        next_service_date: document.getElementById('invMaintNextDate')?.value || null,
        cost: parseFloat(document.getElementById('invMaintCost')?.value) || 0,
        description: (document.getElementById('invMaintDesc')?.value || '').trim()
    };

    try {
        await invApi('/api/inventory/maintenance', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        invNotify('Maintenance log saved.', 'success');
        closeInvModal('invMaintModal');
        await fetchInventory();
    } catch (err) {
        invNotify('Could not log maintenance: ' + err.message, 'error');
    }
}

function openInvMaintViewModal(initialTab = 'maintenance') {
    invOpsTab = initialTab || 'maintenance';
    setInvOpsTab(invOpsTab);
    openInvModal('invMaintViewModal');
}

function setInvOpsTab(tab) {
    invOpsTab = tab === 'usage' ? 'usage' : 'maintenance';
    document.querySelectorAll('#invMaintViewModal .inv-mtab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.opsTab === invOpsTab);
    });
    const mPane = document.getElementById('invOpsMaintPane');
    const uPane = document.getElementById('invOpsUsagePane');
    if (mPane) mPane.style.display = invOpsTab === 'maintenance' ? 'block' : 'none';
    if (uPane) uPane.style.display = invOpsTab === 'usage' ? 'block' : 'none';
    renderInvOpsTables();
}

function renderInvOpsTables() {
    const maintBody = document.getElementById('invMaintViewBody');
    if (maintBody) {
        if (invMaintData.length === 0) {
            maintBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">No maintenance records logged yet.</td></tr>';
        } else {
            maintBody.innerHTML = invMaintData.map((m) => `
                <tr>
                    <td><strong>${escInv(m.item_name || `Asset #${m.item_id}`)}</strong></td>
                    <td>${invFmtDate(m.service_date)}</td>
                    <td>${escInv(m.description)}</td>
                    <td style="font-weight:700;">${invFmtCurrency(m.cost)}</td>
                    <td>${invFmtDate(m.next_service_date)}</td>
                </tr>
            `).join('');
        }
    }

    const usageBody = document.getElementById('invUsageViewBody');
    if (usageBody) {
        if (invUsageData.length === 0) {
            usageBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">No consumable stock usage logged yet.</td></tr>';
        } else {
            usageBody.innerHTML = invUsageData.map((u) => `
                <tr>
                    <td><strong>${escInv(u.item_name || `Item #${u.item_id}`)}</strong></td>
                    <td><span class="inv-status-pill inv-status-out">-${Number(u.quantity_used) || 0} units</span></td>
                    <td>${escInv(u.department || 'General')}</td>
                    <td>${invFmtDate(u.usage_date)}</td>
                </tr>
            `).join('');
        }
    }
}

function openInvUsageModal(preselectedId = null) {
    const form = document.getElementById('invUsageForm');
    if (form) form.reset();

    const sel = document.getElementById('invUsageItemId');
    if (sel) {
        const bulk = invData.filter((i) => i.tracking_type === 'Bulk' || i.category === 'Supplies');
        const list = bulk.length > 0 ? bulk : invData;
        sel.innerHTML = list.map((i) =>
            `<option value="${i.id}">${escInv(i.name)} (${Number(i.quantity) || 0} in stock)</option>`
        ).join('') || '<option value="">No items available</option>';
        if (preselectedId !== null) sel.value = String(preselectedId);
    }

    onInvUsageItemChange();
    openInvModal('invUsageModal');
}

function onInvUsageItemChange() {
    const id = parseInt(document.getElementById('invUsageItemId')?.value, 10);
    const hint = document.getElementById('invUsageStockHint');
    if (!hint) return;
    const item = invData.find((i) => Number(i.id) === id);
    if (!item) {
        hint.textContent = 'Select a consumable item.';
        return;
    }
    hint.textContent = `Available stock: ${Number(item.quantity) || 0} units (min alert at ${Number(item.min_threshold) || 0})`;
}

async function saveInvUsage(e) {
    if (e && e.preventDefault) e.preventDefault();
    const payload = {
        item_id: parseInt(document.getElementById('invUsageItemId')?.value, 10),
        quantity_used: parseInt(document.getElementById('invUsageQty')?.value, 10) || 1,
        department: (document.getElementById('invUsageDept')?.value || '').trim() || 'General'
    };

    try {
        await invApi('/api/inventory/usage', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        invNotify('Consumable usage deducted cleanly.', 'success');
        closeInvModal('invUsageModal');
        await fetchInventory();
    } catch (err) {
        invNotify('Could not log usage: ' + err.message, 'error');
    }
}

// ── Asset Detail Dossier, Inline Restock & Printable Tag ──────────────────────

function openInvDetailModal(itemId, focusRestock = false) {
    const item = invData.find((i) => Number(i.id) === Number(itemId));
    if (!item) return;

    const eff = getInvEffectiveStatus(item);
    const meta = getInvCatMeta(item.category);
    const imgUrl = sanitizeInvImgUrl(item.image_url);
    const currVal = item.current_value !== null && item.current_value !== undefined
        ? Number(item.current_value) || 0
        : Number(item.purchase_price) || 0;
    const purchVal = Number(item.purchase_price) || 0;
    const tagCode = item.qr_code || `EDF-AST-${String(item.id).padStart(4, '0')}`;
    const itemLoans = invLoansData.filter((l) => Number(l.item_id) === Number(item.id)).slice(0, 4);
    const itemMaint = invMaintData.filter((m) => Number(m.item_id) === Number(item.id)).slice(0, 4);

    document.getElementById('invDetailTitle').textContent = item.name;
    document.getElementById('invDetailSubtitle').textContent = `${item.category} · ${item.tracking_type || 'Serialized'} · ${item.location || 'Location Unassigned'}`;

    const bodyEl = document.getElementById('invDetailBody');
    const footerEl = document.getElementById('invDetailFooter');

    if (bodyEl) {
        const photoMarkup = imgUrl
            ? `<img src="${escInv(imgUrl)}" alt="${escInv(item.name)}" onerror="handleInvThumbError(this, '${escInv(meta.icon)}')">`
            : `<i class="fas ${meta.icon}"></i>`;
        bodyEl.innerHTML = `
            <div class="inv-dossier-banner">
                <div style="display:flex;align-items:center;gap:0.9rem;">
                    <div class="inv-dossier-photo ${imgUrl ? 'has-photo' : ''}">
                        ${photoMarkup}
                    </div>
                    <div>
                        <div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);">Custody Tag &amp; Status</div>
                        <div style="display:flex;align-items:center;gap:0.55rem;margin-top:0.25rem;flex-wrap:wrap;">
                            <span class="inv-status-pill ${eff.cls}"><i class="fas ${eff.icon}"></i> ${escInv(eff.label)}</span>
                            <span class="inv-tag-chip"><i class="fas fa-qrcode"></i> ${escInv(tagCode)}</span>
                        </div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);">Current Valuation</div>
                    <div style="font-size:1.2rem;font-weight:800;color:var(--text-main);">${invFmtCurrency(currVal)}</div>
                    ${purchVal > 0 ? `<div style="font-size:0.72rem;color:var(--text-muted);">Original cost: ${invFmtCurrency(purchVal)}</div>` : ''}
                </div>
            </div>

            <div class="inv-form-section">
                <div class="inv-sec-label"><i class="fas fa-circle-info"></i> Asset Specifications</div>
                <div class="inv-form-grid-3" style="font-size:0.81rem;">
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Facility Location</span><strong>${escInv(item.location || 'Unassigned')}</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Serial Number</span><strong>${escInv(item.serial_number || '—')}</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Condition</span><strong>${escInv(item.condition || 'Good')}</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Quantity On Hand</span><strong>${Number(item.quantity) || 0} units</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Low-Stock Threshold</span><strong>${Number(item.min_threshold) || 0} units</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Warranty / Vendor</span><strong>${escInv(item.warranty_info || '—')}</strong></div>
                </div>
                ${item.category === 'Books & Library' ? `
                <div class="inv-form-grid-3" style="font-size:0.81rem;margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-color);">
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Author</span><strong>${escInv(item.book_author || '—')}</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Language / Subject</span><strong>${escInv(item.book_language || 'English')}${item.book_subject ? ' · ' + escInv(item.book_subject) : ''}</strong></div>
                    <div><span style="color:var(--text-muted);display:block;font-size:0.71rem;">Circulation Policy</span><strong>${escInv(item.library_type || 'Lending')}</strong></div>
                </div>` : ''}
            </div>

            <div class="inv-form-section">
                <div class="inv-sec-label"><i class="fas fa-boxes-stacked"></i> Quick Restock Adjustment</div>
                <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
                    <input type="number" id="invQuickRestockQty" class="inv-input" style="max-width:160px;" min="1" value="5" placeholder="Add qty">
                    <button type="button" class="inv-mbtn inv-mbtn-primary" onclick="applyInvRestock(${item.id})">
                        <i class="fas fa-plus"></i> Add Stock to Asset
                    </button>
                    <span style="font-size:0.76rem;color:var(--text-muted);">Adds units atomically to existing stock.</span>
                </div>
            </div>

            <div class="inv-qr-label-card">
                <div style="display:flex;align-items:center;gap:0.85rem;">
                    <div id="invDossierQrBox" class="inv-qr-visual" title="Asset QR Tag"></div>
                    <div>
                        <div style="font-size:0.72rem;font-weight:800;color:#059669;text-transform:uppercase;">Printable EDF Asset Tag</div>
                        <div style="font-weight:800;font-size:0.9rem;color:var(--text-main);">${escInv(item.name)}</div>
                        <div style="font-family:monospace;font-size:0.76rem;color:var(--text-muted);">${escInv(tagCode)} ${item.location ? '· ' + escInv(item.location) : ''}</div>
                    </div>
                </div>
                <button type="button" class="inv-mbtn" onclick="printInvAssetLabel(${item.id})">
                    <i class="fas fa-print"></i> Print Tag
                </button>
            </div>

            <div class="inv-form-grid-2">
                <div class="inv-form-section">
                    <div class="inv-sec-label"><i class="fas fa-clock-rotate-left"></i> Recent Custody (${itemLoans.length})</div>
                    ${itemLoans.length === 0 ? '<div style="font-size:0.78rem;color:var(--text-muted);">No loans recorded.</div>' : itemLoans.map((l) => `
                        <div style="display:flex;justify-content:space-between;font-size:0.77rem;padding:0.3rem 0;border-bottom:1px solid var(--border-color);">
                            <span><strong>${escInv(l.borrower_name)}</strong> (${escInv(l.status)})</span>
                            <span style="color:var(--text-muted);">${invFmtDate(l.checkout_date)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="inv-form-section">
                    <div class="inv-sec-label"><i class="fas fa-wrench"></i> Service Logs (${itemMaint.length})</div>
                    ${itemMaint.length === 0 ? '<div style="font-size:0.78rem;color:var(--text-muted);">No maintenance logged.</div>' : itemMaint.map((m) => `
                        <div style="display:flex;justify-content:space-between;font-size:0.77rem;padding:0.3rem 0;border-bottom:1px solid var(--border-color);">
                            <span>${escInv(m.description)}</span>
                            <strong>${invFmtCurrency(m.cost)}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (footerEl) {
        footerEl.innerHTML = `
            <button type="button" class="inv-mbtn" onclick="closeInvModal('invDetailModal'); openInvMaintModal(${item.id});"><i class="fas fa-wrench"></i> Log Service</button>
            <button type="button" class="inv-mbtn inv-mbtn-gold" onclick="closeInvModal('invDetailModal'); openInvCheckoutModal(${item.id});"><i class="fas fa-right-from-bracket"></i> Check Out</button>
            <button type="button" class="inv-mbtn inv-mbtn-primary" onclick="closeInvModal('invDetailModal'); openInvItemModal('edit', ${item.id});"><i class="fas fa-pen"></i> Edit Asset</button>
        `;
    }

    openInvModal('invDetailModal');
    renderInvQrVisual(document.getElementById('invDossierQrBox'), tagCode, 64);
    if (focusRestock) {
        setTimeout(() => {
            const inp = document.getElementById('invQuickRestockQty');
            if (inp) {
                inp.focus();
                inp.select();
            }
        }, 60);
    }
}

async function applyInvRestock(itemId) {
    const inp = document.getElementById('invQuickRestockQty');
    const addQty = parseInt(inp?.value, 10);
    if (!addQty || addQty <= 0) {
        invNotify('Enter a positive restock quantity.', 'error');
        return;
    }
    try {
        await invApi(`/api/inventory/items/${itemId}/restock`, {
            method: 'PATCH',
            body: JSON.stringify({ add_quantity: addQty })
        });
        invNotify(`Added +${addQty} units to inventory.`, 'success');
        await fetchInventory();
        openInvDetailModal(itemId);
    } catch (err) {
        invNotify('Restock failed: ' + err.message, 'error');
    }
}

function printInvAssetLabel(itemId) {
    const item = invData.find((i) => Number(i.id) === Number(itemId));
    if (!item || typeof window === 'undefined' || !window.open) return;
    const tagCode = item.qr_code || `EDF-AST-${String(item.id).padStart(4, '0')}`;
    let qrDataUrl = '';
    const existingCanvas = document.querySelector('#invDossierQrBox canvas');
    const existingImg = document.querySelector('#invDossierQrBox img');
    if (existingCanvas && typeof existingCanvas.toDataURL === 'function') {
        qrDataUrl = existingCanvas.toDataURL('image/png');
    } else if (existingImg && existingImg.src) {
        qrDataUrl = existingImg.src;
    }
    const win = window.open('', '_blank', 'width=460,height=340');
    if (!win) {
        invNotify('Pop-up blocked — allow pop-ups to print asset label.', 'error');
        return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Asset Tag - ${escInv(item.name)}</title>
        <style>
            body{font-family:Inter,Arial,sans-serif;padding:24px;background:#fff;color:#0f172a;}
            .tag{border:2px solid #059669;border-radius:14px;padding:18px;max-width:360px;display:flex;align-items:center;gap:14px;}
            .hdr{font-size:10px;font-weight:800;letter-spacing:0.08em;color:#059669;text-transform:uppercase;}
            .name{font-size:17px;font-weight:800;margin:5px 0;}
            .meta{font-size:12px;color:#475569;margin-bottom:10px;}
            .code{font-family:monospace;font-size:13px;font-weight:700;padding:6px 9px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;text-align:center;}
            .qr{width:76px;height:76px;border:1px solid #e2e8f0;border-radius:8px;padding:3px;flex-shrink:0;}
        </style></head>
        <body><div class="tag">
            ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR">` : ''}
            <div style="flex:1;min-width:0;">
                <div class="hdr">EDF Galgamuwa &middot; Official Asset Tag</div>
                <div class="name">${escInv(item.name)}</div>
                <div class="meta">${escInv(item.category)}${item.location ? ' &middot; ' + escInv(item.location) : ''}</div>
                <div class="code">${escInv(tagCode)}</div>
            </div>
        </div>
        <script>window.onload=function(){window.print();};<\/script></body></html>`);
    win.document.close();
}

// ── Exports for Testing / Safe Global Attachment ─────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchInventory,
        filterInventory,
        updateInvStats,
        getFilteredInvItems,
        openInvItemModal,
        openInvCheckoutModal,
        openInvReturnModal,
        openInvDetailModal,
        openInvUsageModal,
        renderInventory
    };
}

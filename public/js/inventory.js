// ============================================================
//  Inventory & Asset Management Module  v2
// ============================================================

let invData       = [];
let invLoansData  = [];
let invMaintData  = [];

// Filters & Pagination
let _invCatFilter    = 'all';
let _invStatusFilter = 'all';
let _invSearch       = '';
let _invSort         = { key: 'name', dir: 'asc' };
let _invPage         = 1;
let _invPageSize     = 12;
let _invView         = 'table'; // 'table' | 'grid'

// ── Palette ──────────────────────────────────────────────────
const INV_CAT_COLORS = {
    it:          { color: '#6366f1', icon: 'monitor' },
    furniture:   { color: '#f59e0b', icon: 'armchair' },
    library:     { color: '#10b981', icon: 'book-open' },
    electronics: { color: '#3b82f6', icon: 'zap' },
    stationery:  { color: '#ec4899', icon: 'pen-tool' },
    other:       { color: '#9ca3af', icon: 'box' },
};
const INV_STATUS_COLORS = {
    available:   { bg: 'rgba(16,185,129,.12)',  color: '#059669', label: 'Available'   },
    in_use:      { bg: 'rgba(99,102,241,.12)',  color: '#6366f1', label: 'In Use'      },
    maintenance: { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Maintenance' },
    retired:     { bg: 'rgba(156,163,175,.15)', color: '#6b7280', label: 'Retired'     },
};
const INV_COND_COLORS = {
    working: { bg: '#dcfce7', color: '#16a34a' },
    damaged: { bg: '#fee2e2', color: '#dc2626' },
    repair:  { bg: '#fef3c7', color: '#d97706' },
};

// ── Fetch ─────────────────────────────────────────────────────
async function fetchInventory() {
    try {
        const [items, loans, maint] = await Promise.all([
            fetch('/api/inventory/items').then(r => r.json()),
            fetch('/api/inventory/loans').then(r => r.json()),
            fetch('/api/inventory/maintenance').then(r => r.json()),
        ]);
        invData      = Array.isArray(items) ? items : [];
        invLoansData = Array.isArray(loans) ? loans : [];
        invMaintData = Array.isArray(maint)  ? maint  : [];
        renderInventory();
        updateInvStats();
    } catch (err) { console.error('Inventory fetch error:', err); }
}

// ── Stats ─────────────────────────────────────────────────────
function updateInvStats() {
    const total    = invData.length;
    const out      = invData.filter(i => i.status === 'in_use').length;
    const lowStock = invData.filter(i => i.tracking_type === 'consumable' && i.quantity <= i.min_threshold).length;
    const value    = invData.reduce((s, i) => s + (parseFloat(i.current_value) || 0), 0);
    const overdue  = invLoansData.filter(l => !l.return_date && l.expected_return_date && new Date(l.expected_return_date) < new Date()).length;

    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('invStatTotal',    total);
    el('invStatOut',      out);
    el('invStatLowStock', lowStock);
    el('invStatValue',    `LKR ${value.toLocaleString()}`);
    el('invStatOverdue',  overdue);

    // Animate low stock badge
    const lowEl = document.getElementById('invStatLowStock');
    if (lowEl) {
        lowEl.closest('.stat-card')?.classList.toggle('inv-alert-pulse', lowStock > 0);
    }
}

// ── Filter + Sort + Paginate ──────────────────────────────────
function _invGetFiltered() {
    const q = _invSearch.toLowerCase();
    return invData
        .filter(i => {
            const matchCat    = _invCatFilter    === 'all' || i.category === _invCatFilter;
            const matchStatus = _invStatusFilter === 'all' || i.status   === _invStatusFilter;
            const matchQ      = !q ||
                i.name.toLowerCase().includes(q) ||
                (i.serial_number  || '').toLowerCase().includes(q) ||
                (i.book_author    || '').toLowerCase().includes(q) ||
                (i.book_subject   || '').toLowerCase().includes(q) ||
                (i.warranty_info  || '').toLowerCase().includes(q);
            return matchCat && matchStatus && matchQ;
        })
        .sort((a, b) => {
            const dir = _invSort.dir === 'asc' ? 1 : -1;
            const k   = _invSort.key;
            if (k === 'quantity' || k === 'current_value' || k === 'purchase_price') {
                return dir * ((parseFloat(a[k]) || 0) - (parseFloat(b[k]) || 0));
            }
            return dir * String(a[k] || '').localeCompare(String(b[k] || ''));
        });
}

// ── Render ────────────────────────────────────────────────────
function renderInventory() {
    const filtered   = _invGetFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / _invPageSize));
    if (_invPage > totalPages) _invPage = totalPages;

    const start    = (_invPage - 1) * _invPageSize;
    const pageData = filtered.slice(start, start + _invPageSize);

    // Count label
    const countEl = document.getElementById('invCount');
    if (countEl) {
        countEl.textContent = filtered.length < invData.length
            ? `Showing ${Math.min(start+1, filtered.length)}–${Math.min(start+_invPageSize, filtered.length)} of ${filtered.length} (filtered from ${invData.length})`
            : `${invData.length} item${invData.length !== 1 ? 's' : ''}`;
    }

    if (_invView === 'grid') {
        _renderGrid(pageData);
    } else {
        _renderTable(pageData);
    }

    _renderInvPagination(filtered.length, totalPages);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _catPill(cat) {
    const c      = INV_CAT_COLORS[cat] || INV_CAT_COLORS.other;
    const label  = cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '—';
    return `<span style="padding:0.15rem 0.55rem;border-radius:20px;font-size:0.7rem;font-weight:700;background:${c.color}22;color:${c.color};">${label}</span>`;
}
function _statusPill(status) {
    const s = INV_STATUS_COLORS[status] || INV_STATUS_COLORS.available;
    return `<span style="padding:0.15rem 0.55rem;border-radius:20px;font-size:0.7rem;font-weight:700;background:${s.bg};color:${s.color};">${s.label}</span>`;
}
function _condPill(cond) {
    const c = INV_COND_COLORS[cond] || INV_COND_COLORS.working;
    const l = cond ? cond.charAt(0).toUpperCase() + cond.slice(1).replace('_', ' ') : 'Working';
    return `<span style="padding:0.15rem 0.55rem;border-radius:20px;font-size:0.7rem;font-weight:700;background:${c.bg};color:${c.color};">${l}</span>`;
}
function _qtyDisplay(item) {
    if (item.tracking_type === 'serialized') {
        return `<span style="font-size:0.78rem;color:var(--text-muted);">S/N: <strong>${item.serial_number || '—'}</strong></span>`;
    }
    if (item.tracking_type === 'consumable') {
        const low = item.quantity <= item.min_threshold;
        return `
            <span style="font-weight:700;font-size:0.95rem;color:${low ? '#ef4444' : 'var(--text-main)'};">${item.quantity}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);"> / min ${item.min_threshold}</span>
            ${low ? '<span style="margin-left:4px;padding:1px 6px;border-radius:8px;background:#fee2e2;color:#ef4444;font-size:0.65rem;font-weight:800;letter-spacing:.03em;">⚠ LOW</span>' : ''}
        `;
    }
    return `<span style="font-weight:700;">×${item.quantity}</span>`;
}
function _actionBtns(itemId) {
    return `
        <button class="btn inv-action-btn" onclick="openInvCheckoutModal(${itemId})" title="Check Out"><i data-lucide="log-out" style="width:13px;"></i></button>
        <button class="btn inv-action-btn inv-maint-btn" onclick="openInvMaintModal(${itemId})" title="Maintenance"><i data-lucide="wrench" style="width:13px;"></i></button>
        <button class="btn inv-action-btn" onclick="openInvItemModal('edit',${itemId})" title="Edit"><i data-lucide="edit-2" style="width:13px;"></i></button>
        <button class="btn inv-action-btn inv-del-btn" onclick="deleteInvItem(${itemId})" title="Delete"><i data-lucide="trash-2" style="width:13px;"></i></button>
    `;
}

function _renderTable(data) {
    const container = document.getElementById('invViewContainer');
    if (!container) return;

    const sortArrow = (key) => {
        if (_invSort.key !== key) return '<i data-lucide="chevrons-up-down" style="width:11px;opacity:.35;vertical-align:middle;margin-left:2px;"></i>';
        return _invSort.dir === 'asc'
            ? '<i data-lucide="chevron-up" style="width:11px;color:var(--primary);vertical-align:middle;margin-left:2px;"></i>'
            : '<i data-lucide="chevron-down" style="width:11px;color:var(--primary);vertical-align:middle;margin-left:2px;"></i>';
    };

    container.innerHTML = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th style="cursor:pointer;" onclick="invSort('name')">Asset Name ${sortArrow('name')}</th>
            <th style="cursor:pointer;" onclick="invSort('category')">Category ${sortArrow('category')}</th>
            <th style="cursor:pointer;" onclick="invSort('status')">Status ${sortArrow('status')}</th>
            <th style="cursor:pointer;" onclick="invSort('condition')">Condition ${sortArrow('condition')}</th>
            <th style="cursor:pointer;text-align:center;" onclick="invSort('quantity')">Qty ${sortArrow('quantity')}</th>
            <th style="cursor:pointer;" onclick="invSort('current_value')">Value ${sortArrow('current_value')}</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.length ? data.map(item => {
            const cat = INV_CAT_COLORS[item.category] || INV_CAT_COLORS.other;
            return `<tr class="inv-row">
              <td>
                <div style="display:flex;align-items:center;gap:0.6rem;">
                  <div style="width:32px;height:32px;border-radius:8px;background:${cat.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="${cat.icon}" style="width:15px;color:${cat.color};"></i>
                  </div>
                  <div>
                    <div style="font-weight:600;line-height:1.3;">${item.name}</div>
                    ${item.book_author ? `<div style="font-size:0.71rem;color:var(--text-muted);">by ${item.book_author}</div>` : ''}
                    ${item.warranty_info ? `<div style="font-size:0.69rem;color:#f59e0b;"><i data-lucide="shield-check" style="width:9px;vertical-align:middle;"></i> ${item.warranty_info}</div>` : ''}
                  </div>
                </div>
              </td>
              <td>${_catPill(item.category)}</td>
              <td>${_statusPill(item.status)}</td>
              <td>${_condPill(item.condition)}</td>
              <td style="text-align:center;">${_qtyDisplay(item)}</td>
              <td style="font-size:0.85rem;color:var(--text-muted);">${item.current_value ? `<strong style="color:var(--text-main);">LKR ${Number(item.current_value).toLocaleString()}</strong>` : '—'}</td>
              <td style="text-align:right;white-space:nowrap;">${_actionBtns(item.id)}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--text-muted);"><i data-lucide="package" style="width:36px;height:36px;opacity:.25;display:block;margin:0 auto .75rem;"></i>No items found</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function _renderGrid(data) {
    const container = document.getElementById('invViewContainer');
    if (!container) return;

    container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1.1rem;padding:1rem 1.25rem;">
        ${data.length ? data.map(item => {
            const cat  = INV_CAT_COLORS[item.category]  || INV_CAT_COLORS.other;
            const stat = INV_STATUS_COLORS[item.status] || INV_STATUS_COLORS.available;
            const cond = INV_COND_COLORS[item.condition]|| INV_COND_COLORS.working;
            const low  = item.tracking_type === 'consumable' && item.quantity <= item.min_threshold;
            return `
            <div class="inv-card ${low ? 'inv-card-low' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.875rem;">
                <div style="width:42px;height:42px;border-radius:10px;background:${cat.color}18;display:flex;align-items:center;justify-content:center;">
                  <i data-lucide="${cat.icon}" style="width:20px;color:${cat.color};"></i>
                </div>
                <div style="display:flex;gap:.35rem;align-items:center;">
                  ${_statusPill(item.status)}
                  ${low ? '<span style="padding:.15rem .5rem;border-radius:20px;font-size:.65rem;font-weight:800;background:#fee2e2;color:#ef4444;letter-spacing:.03em;">LOW</span>' : ''}
                </div>
              </div>
              <div style="font-weight:700;font-size:.95rem;margin-bottom:.2rem;line-height:1.3;">${item.name}</div>
              ${item.book_author ? `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.2rem;">by ${item.book_author}</div>` : ''}
              <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.75rem;margin-top:.4rem;">
                ${_catPill(item.category)}
                ${_condPill(item.condition)}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border-color);padding-top:.6rem;margin-top:.2rem;">
                <div style="font-size:.8rem;">
                  ${item.tracking_type === 'serialized' ? `<span style="color:var(--text-muted);">S/N: <strong>${item.serial_number || '—'}</strong></span>` : `<span style="font-weight:700;color:${low ? '#ef4444':'var(--text-main)'};">${item.quantity}</span><span style="font-size:.72rem;color:var(--text-muted);"> units</span>`}
                </div>
                <div style="font-size:.78rem;font-weight:600;color:#10b981;">${item.current_value ? `LKR ${Number(item.current_value).toLocaleString()}` : ''}</div>
              </div>
              <div style="display:flex;gap:.35rem;margin-top:.65rem;">
                <button class="btn inv-action-btn" style="flex:1;justify-content:center;" onclick="openInvCheckoutModal(${item.id})" title="Check Out"><i data-lucide="log-out" style="width:13px;"></i></button>
                <button class="btn inv-action-btn inv-maint-btn" style="flex:1;justify-content:center;" onclick="openInvMaintModal(${item.id})" title="Maintenance"><i data-lucide="wrench" style="width:13px;"></i></button>
                <button class="btn inv-action-btn" style="flex:1;justify-content:center;" onclick="openInvItemModal('edit',${item.id})" title="Edit"><i data-lucide="edit-2" style="width:13px;"></i></button>
                <button class="btn inv-action-btn inv-del-btn" style="flex:1;justify-content:center;" onclick="deleteInvItem(${item.id})" title="Delete"><i data-lucide="trash-2" style="width:13px;"></i></button>
              </div>
            </div>`;
        }).join('') : `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
            <i data-lucide="package" style="width:40px;height:40px;opacity:.2;display:block;margin:0 auto 1rem;"></i>
            No inventory items found
        </div>`}
    </div>`;
}

function _renderInvPagination(total, totalPages) {
    const el = document.getElementById('invPagination');
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    const WINDOW = 2;
    const btnBase   = 'padding:.35rem .65rem;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-card);color:var(--text-main);cursor:pointer;font-size:.8rem;';
    const btnActive = 'padding:.35rem .65rem;border-radius:8px;border:1px solid var(--primary);background:var(--primary);color:#fff;cursor:pointer;font-size:.8rem;font-weight:700;';
    const btnDis    = 'padding:.35rem .65rem;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-card);color:var(--text-muted);cursor:not-allowed;font-size:.8rem;opacity:.4;';

    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= _invPage - WINDOW && p <= _invPage + WINDOW)) {
            pagesHtml += `<button style="${p === _invPage ? btnActive : btnBase}" onclick="_invGoPage(${p})">${p}</button>`;
        } else if ((p === _invPage - WINDOW - 1 && p > 1) || (p === _invPage + WINDOW + 1 && p < totalPages)) {
            pagesHtml += `<span style="color:var(--text-muted);font-size:.85rem;padding:0 .2rem;">…</span>`;
        }
    }

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;justify-content:center;">
            <button style="${_invPage <= 1 ? btnDis : btnBase}" ${_invPage <= 1 ? 'disabled' : ''} onclick="_invGoPage(${_invPage - 1})"><i data-lucide="chevron-left" style="width:13px;"></i></button>
            ${pagesHtml}
            <button style="${_invPage >= totalPages ? btnDis : btnBase}" ${_invPage >= totalPages ? 'disabled' : ''} onclick="_invGoPage(${_invPage + 1})"><i data-lucide="chevron-right" style="width:13px;"></i></button>
            <span style="font-size:.78rem;color:var(--text-muted);margin-left:.5rem;">Page ${_invPage} of ${totalPages}</span>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _invGoPage(p) { _invPage = p; renderInventory(); }

// ── Controls ──────────────────────────────────────────────────
function filterInventory() {
    _invSearch = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
    _invPage   = 1;
    renderInventory();
}

function setInvCategoryFilter(cat) {
    _invCatFilter = cat;
    _invPage      = 1;
    document.querySelectorAll('[id^="invCat-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`invCat-${cat}`);
    if (btn) btn.classList.add('active');
    renderInventory();
}

function setInvStatusFilter(status) {
    _invStatusFilter = status;
    _invPage         = 1;
    document.querySelectorAll('[id^="invStat-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`invStat-${status}`);
    if (btn) btn.classList.add('active');
    renderInventory();
}

function invSort(key) {
    if (_invSort.key === key) {
        _invSort.dir = _invSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        _invSort = { key, dir: 'asc' };
    }
    _invPage = 1;
    renderInventory();
}

function setInvView(view) {
    _invView = view;
    const tableBtn = document.getElementById('invViewTable');
    const gridBtn  = document.getElementById('invViewGrid');
    if (tableBtn) tableBtn.classList.toggle('active', view === 'table');
    if (gridBtn)  gridBtn.classList.toggle('active',  view === 'grid');
    renderInventory();
}

function setInvPageSize(val) {
    _invPageSize = parseInt(val, 10);
    _invPage     = 1;
    renderInventory();
}

// ── Add / Edit Item ───────────────────────────────────────────
function openInvItemModal(mode, itemId = null) {
    const item = itemId ? invData.find(i => i.id === itemId) : null;
    if (!document.getElementById('invItemModal')) return;

    document.getElementById('invItemModalTitle').textContent = mode === 'edit' ? 'Edit Asset / Item' : 'Add New Asset / Item';
    document.getElementById('invItemId').value            = item ? item.id : '';
    document.getElementById('invItemName').value          = item ? item.name : '';
    document.getElementById('invItemCategory').value      = item ? (item.category || '') : '';
    document.getElementById('invItemTrackType').value     = item ? (item.tracking_type || 'bulk') : 'bulk';
    document.getElementById('invItemSerial').value        = item ? (item.serial_number || '') : '';
    document.getElementById('invItemQty').value           = item ? item.quantity : 1;
    document.getElementById('invItemMinThreshold').value  = item ? item.min_threshold : 0;
    document.getElementById('invItemStatus').value        = item ? item.status : 'available';
    document.getElementById('invItemCondition').value     = item ? item.condition : 'working';
    document.getElementById('invItemPurchasePrice').value = item ? (item.purchase_price || '') : '';
    document.getElementById('invItemCurrentValue').value  = item ? (item.current_value || '') : '';
    document.getElementById('invItemWarranty').value      = item ? (item.warranty_info || '') : '';
    document.getElementById('invItemAuthor').value        = item ? (item.book_author || '') : '';
    document.getElementById('invItemLanguage').value      = item ? (item.book_language || '') : '';
    document.getElementById('invItemSubject').value       = item ? (item.book_subject || '') : '';
    document.getElementById('invItemLibraryType').value   = item ? (item.library_type || 'loan') : 'loan';

    onInvCategoryChange();
    openModal('invItemModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onInvCategoryChange() {
    const cat = document.getElementById('invItemCategory')?.value;
    document.getElementById('invBookFields').style.display  = cat === 'library'                       ? '' : 'none';
    document.getElementById('invSerialField').style.display = (cat === 'it' || cat === 'electronics') ? '' : 'none';
    document.getElementById('invStockFields').style.display = (cat === 'stationery' || cat === 'other' || cat === '') ? '' : 'none';
}

async function saveInvItem(e) {
    e.preventDefault();
    const id = document.getElementById('invItemId').value;
    const payload = {
        name:           document.getElementById('invItemName').value.trim(),
        category:       document.getElementById('invItemCategory').value,
        tracking_type:  document.getElementById('invItemTrackType').value,
        serial_number:  document.getElementById('invItemSerial').value.trim(),
        quantity:       document.getElementById('invItemQty').value,
        min_threshold:  document.getElementById('invItemMinThreshold').value,
        status:         document.getElementById('invItemStatus').value,
        condition:      document.getElementById('invItemCondition').value,
        purchase_price: document.getElementById('invItemPurchasePrice').value,
        current_value:  document.getElementById('invItemCurrentValue').value,
        warranty_info:  document.getElementById('invItemWarranty').value.trim(),
        book_author:    document.getElementById('invItemAuthor').value.trim(),
        book_language:  document.getElementById('invItemLanguage').value.trim(),
        book_subject:   document.getElementById('invItemSubject').value.trim(),
        library_type:   document.getElementById('invItemLibraryType').value,
    };
    const url = id ? `/api/inventory/items/${id}` : '/api/inventory/items';
    try {
        const res = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            closeModal('invItemModal');
            showToast(id ? 'Item updated' : 'Item added to registry', 'success');
            fetchInventory();
        } else {
            const r = await res.json();
            showToast(r.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function deleteInvItem(id) {
    if (!confirm('Permanently delete this item from the registry?')) return;
    try {
        const res = await fetch(`/api/inventory/items/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('Item removed', 'success'); fetchInventory(); }
        else showToast('Failed to delete', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Check-Out ─────────────────────────────────────────────────
function openInvCheckoutModal(itemId) {
    const item = invData.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('invLoanItemId').value        = itemId;
    document.getElementById('invLoanItemName').textContent = item.name;
    document.getElementById('invLoanBorrowerName').value  = '';
    document.getElementById('invLoanBorrowerType').value  = 'volunteer';
    document.getElementById('invLoanExpReturn').value     = '';
    document.getElementById('invLoanNotes').value         = '';
    openModal('invLoanModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveInvLoan(e) {
    e.preventDefault();
    const payload = {
        item_id:              document.getElementById('invLoanItemId').value,
        borrower_name:        document.getElementById('invLoanBorrowerName').value.trim(),
        borrower_type:        document.getElementById('invLoanBorrowerType').value,
        expected_return_date: document.getElementById('invLoanExpReturn').value,
        notes:                document.getElementById('invLoanNotes').value.trim(),
    };
    try {
        const res = await fetch('/api/inventory/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) { closeModal('invLoanModal'); showToast('Item checked out', 'success'); fetchInventory(); }
        else { const r = await res.json(); showToast(r.message || 'Failed', 'error'); }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Loans View ────────────────────────────────────────────────
function openInvLoansViewModal() {
    renderInvLoansTable();
    openModal('invLoansViewModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderInvLoansTable() {
    const tbody = document.getElementById('invLoansBody');
    if (!tbody) return;
    const active = invLoansData.filter(l => !l.return_date);

    // Overdue count
    const overdueCount = active.filter(l => l.expected_return_date && new Date(l.expected_return_date) < new Date()).length;
    const headerEl = document.getElementById('invLoansHeader');
    if (headerEl) {
        headerEl.innerHTML = overdueCount > 0
            ? `<span style="padding:.25rem .75rem;border-radius:20px;background:#fee2e2;color:#dc2626;font-size:.78rem;font-weight:700;">⚠ ${overdueCount} Overdue</span>`
            : `<span style="padding:.25rem .75rem;border-radius:20px;background:#dcfce7;color:#16a34a;font-size:.78rem;font-weight:700;">All on time</span>`;
    }

    tbody.innerHTML = active.length ? active.map(l => {
        const dueDate = l.expected_return_date ? new Date(l.expected_return_date) : null;
        const overdue = dueDate && dueDate < new Date();
        return `<tr>
            <td>
              <div style="font-weight:600;">${l.item_name}</div>
              ${l.serial_number ? `<div style="font-size:.71rem;color:var(--text-muted);">S/N: ${l.serial_number}</div>` : ''}
            </td>
            <td>
              <div>${l.borrower_name}</div>
              <div style="font-size:.72rem;color:var(--text-muted);text-transform:capitalize;">${l.borrower_type}</div>
            </td>
            <td style="font-size:.83rem;">${new Date(l.loan_date).toLocaleDateString()}</td>
            <td style="font-size:.83rem;color:${overdue ? '#dc2626' : 'inherit'};font-weight:${overdue ? '700' : '400'}">
              ${dueDate ? dueDate.toLocaleDateString() : '—'}
              ${overdue ? '<span style="margin-left:4px;">⚠️</span>' : ''}
            </td>
            <td style="text-align:right;">
              <button class="btn inv-action-btn" style="background:rgba(16,185,129,.1);color:#10b981;" onclick="returnInvItem(${l.id}, ${l.item_id})">
                <i data-lucide="check-circle" style="width:12px;"></i> Return
              </button>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">No items currently checked out</td></tr>`;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function returnInvItem(loanId, itemId) {
    // Use a modal-style prompt via a simple inline dialog
    const condition = prompt('Return condition:\n  working  |  damaged  |  repair', 'working');
    if (!condition) return;
    try {
        const res = await fetch(`/api/inventory/loans/${loanId}/return`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ return_condition: condition.trim(), notes: '', item_id: itemId }),
        });
        if (res.ok) {
            showToast('Item returned successfully', 'success');
            await fetchInventory();
            renderInvLoansTable();
        } else showToast('Failed to process return', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Maintenance ───────────────────────────────────────────────
function openInvMaintModal(itemId) {
    const item = invData.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('invMaintItemId').value         = itemId;
    document.getElementById('invMaintItemName').textContent  = item.name;
    document.getElementById('invMaintDate').value           = new Date().toISOString().split('T')[0];
    document.getElementById('invMaintDesc').value           = '';
    document.getElementById('invMaintCost').value           = '';
    document.getElementById('invMaintNextDate').value       = '';
    openModal('invMaintModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveInvMaint(e) {
    e.preventDefault();
    const payload = {
        item_id:           document.getElementById('invMaintItemId').value,
        service_date:      document.getElementById('invMaintDate').value,
        description:       document.getElementById('invMaintDesc').value.trim(),
        cost:              document.getElementById('invMaintCost').value,
        next_service_date: document.getElementById('invMaintNextDate').value,
    };
    try {
        const res = await fetch('/api/inventory/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) { closeModal('invMaintModal'); showToast('Maintenance logged', 'success'); fetchInventory(); }
        else showToast('Failed to save', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}

function openInvMaintViewModal() {
    const tbody = document.getElementById('invMaintBody');
    if (tbody) {
        tbody.innerHTML = invMaintData.length ? invMaintData.map(m => {
            const due = m.next_service_date ? new Date(m.next_service_date) : null;
            const overdue = due && due < new Date();
            return `<tr>
              <td style="font-weight:600;">${m.item_name}</td>
              <td style="font-size:.83rem;">${new Date(m.service_date).toLocaleDateString()}</td>
              <td style="font-size:.83rem;">${m.description || '—'}</td>
              <td style="font-size:.83rem;">${m.cost ? `LKR ${Number(m.cost).toLocaleString()}` : '—'}</td>
              <td style="font-size:.83rem;color:${overdue ? '#dc2626':'inherit'};font-weight:${overdue ? 700:400};">
                ${due ? due.toLocaleDateString() : '—'} ${overdue ? '⚠️' : ''}
              </td>
            </tr>`;
        }).join('') : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">No maintenance records</td></tr>`;
    }
    openModal('invMaintViewModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Consumable Usage ──────────────────────────────────────────
function openInvUsageModal() {
    const sel = document.getElementById('invUsageItemId');
    if (sel) {
        const consumables = invData.filter(i => i.tracking_type === 'consumable' || i.tracking_type === 'bulk');
        sel.innerHTML = '<option value="">Select item…</option>' +
            consumables.map(i => {
                const low = i.tracking_type === 'consumable' && i.quantity <= i.min_threshold;
                return `<option value="${i.id}" ${low ? 'style="color:#dc2626;"' : ''}>${i.name} — Qty: ${i.quantity}${low ? ' ⚠ LOW' : ''}</option>`;
            }).join('');
    }
    document.getElementById('invUsageQty').value  = 1;
    document.getElementById('invUsageDept').value = '';
    openModal('invUsageModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveInvUsage(e) {
    e.preventDefault();
    const payload = {
        item_id:       document.getElementById('invUsageItemId').value,
        quantity_used: document.getElementById('invUsageQty').value,
        department:    document.getElementById('invUsageDept').value.trim(),
    };
    if (!payload.item_id) return showToast('Please select an item', 'error');
    try {
        const res = await fetch('/api/inventory/usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) { closeModal('invUsageModal'); showToast('Consumable usage recorded', 'success'); fetchInventory(); }
        else showToast(data.message || 'Failed', 'error');
    } catch (err) { showToast('Network error', 'error'); }
}

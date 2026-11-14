/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *   EDF GALGAMUWA — Documents & Knowledge Vault + Upload Studio Controller
 * ═══════════════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  const DOC_FOLDERS = [
    'General',
    'Governance & Minutes',
    'Financial & Audit',
    'Beneficiary Cases',
    'Programs & Media',
    'Legal & Compliance'
  ];

  const CAT_META = {
    pdf:          { label: 'PDF',          bg: 'rgba(239, 68, 68, 0.12)',   color: '#dc2626', border: 'rgba(239, 68, 68, 0.28)',   icon: 'file-text' },
    word:         { label: 'Word',         bg: 'rgba(59, 130, 246, 0.12)',  color: '#2563eb', border: 'rgba(59, 130, 246, 0.28)',  icon: 'file-type-2' },
    excel:        { label: 'Excel',        bg: 'rgba(16, 185, 129, 0.12)',  color: '#059669', border: 'rgba(16, 185, 129, 0.28)',  icon: 'table-2' },
    presentation: { label: 'Presentation', bg: 'rgba(245, 158, 11, 0.14)',  color: '#d97706', border: 'rgba(245, 158, 11, 0.30)',  icon: 'presentation' },
    audio:        { label: 'Audio',        bg: 'rgba(139, 92, 246, 0.12)',  color: '#7c3aed', border: 'rgba(139, 92, 246, 0.28)',  icon: 'music' },
    video:        { label: 'Video',        bg: 'rgba(249, 115, 22, 0.13)',  color: '#ea580c', border: 'rgba(249, 115, 22, 0.28)',  icon: 'film' },
    image:        { label: 'Image',        bg: 'rgba(14, 165, 233, 0.12)',  color: '#0284c7', border: 'rgba(14, 165, 233, 0.28)',  icon: 'image' },
    other:        { label: 'Other',        bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: 'rgba(100, 116, 139, 0.26)', icon: 'folder' }
  };

  const VIS_META = {
    internal:   { label: 'Internal Staff', cls: 'doc-vis-internal' },
    board_only: { label: 'Board Only',     cls: 'doc-vis-board_only' },
    restricted: { label: 'Restricted',     cls: 'doc-vis-restricted' }
  };

  const _state = {
    list: [],
    stats: null,
    editId: null,
    loaded: false,
    viewMode: localStorage.getItem('edf-doc-view') || 'table',
    folderFilter: 'all',
    selectedIds: new Set(),
    queueFiles: [],
    previewObjectUrls: [],
    activeXhr: null,
    uploadCancelled: false
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtSize(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = n;
    while (val >= 1024 && i < u.length - 1) { val /= 1024; i++; }
    return val.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
  }

  function fmtDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return esc(str);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function catMeta(cat) {
    return CAT_META[cat] || CAT_META.other;
  }

  function detectClientCategory(file) {
    const mime = (file?.type || '').toLowerCase();
    const name = (file?.name || '').toLowerCase();
    if (mime === 'application/pdf' || /\.pdf$/.test(name)) return 'pdf';
    if (mime.includes('spreadsheet') || mime.includes('excel') || /\.xlsx?$|\.csv$/.test(name)) return 'excel';
    if (mime.includes('wordprocessing') || mime.includes('msword') || /\.docx?$/.test(name)) return 'word';
    if (mime.includes('presentation') || mime.includes('powerpoint') || /\.pptx?$/.test(name)) return 'presentation';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(name)) return 'audio';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/.test(name)) return 'video';
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
    return 'other';
  }

  function _toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  function _clearPreviewUrls() {
    while (_state.previewObjectUrls.length) {
      try { URL.revokeObjectURL(_state.previewObjectUrls.pop()); } catch (_) {}
    }
  }

  /* ── Hook into tab switching ── */
  const _origSwitch = window.switchTab;
  window.switchTab = function (tabId, clickedLink) {
    if (typeof _origSwitch === 'function') _origSwitch(tabId, clickedLink);
    if (tabId === 'documents') {
      if (!_state.loaded) {
        _state.loaded = true;
        docLoadStats();
        docLoad();
      }
      if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    }
  };

  /* ── Data Loading & Filtering ── */
  async function docLoad() {
    const searchEl = document.getElementById('doc-search-input');
    const clearBtn = document.getElementById('doc-search-clear');
    const search = searchEl?.value || '';
    if (clearBtn) clearBtn.style.display = search ? 'inline-flex' : 'none';

    const cat  = document.getElementById('doc-cat-select')?.value || 'all';
    const sort = document.getElementById('doc-sort-select')?.value || 'default';
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (cat !== 'all') params.set('category', cat);
    if (_state.folderFilter === '_pinned') {
      params.set('pinned', '1');
    } else if (_state.folderFilter && _state.folderFilter !== 'all') {
      params.set('folder', _state.folderFilter);
    }
    if (sort && sort !== 'default') params.set('sort', sort);

    const tbody = document.getElementById('doc-table-body');
    const gridEl = document.getElementById('doc-grid-wrap');
    if (tbody && _state.viewMode === 'table') {
      tbody.innerHTML = '<tr><td colspan="7" class="doc-empty">Loading vault records…</td></tr>';
    } else if (gridEl && _state.viewMode === 'grid') {
      gridEl.innerHTML = '<div class="doc-empty" style="grid-column:1/-1;">Loading vault records…</div>';
    }

    try {
      const r = await fetch('/api/documents?' + params.toString(), { credentials: 'include' });
      const data = await r.json();
      _state.list = Array.isArray(data) ? data : [];

      const validIds = new Set(_state.list.map(d => Number(d.id)));
      _state.selectedIds.forEach(id => { if (!validIds.has(Number(id))) _state.selectedIds.delete(id); });

      docRender();
    } catch (_) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="doc-empty" style="color:#ef4444;">Failed to load files from vault.</td></tr>';
    }
  }
  window.docLoad = docLoad;

  function _updateBulkBar() {
    const bar = document.getElementById('doc-bulk-bar');
    const cntEl = document.getElementById('doc-bulk-count');
    const cnt = _state.selectedIds.size;
    if (cntEl) cntEl.textContent = String(cnt);
    if (bar) bar.style.display = cnt > 0 ? 'flex' : 'none';
  }

  function docRender() {
    const tableWrap = document.getElementById('doc-table-wrap');
    const gridWrap  = document.getElementById('doc-grid-wrap');
    const countLbl  = document.getElementById('doc-result-count');
    if (countLbl) {
      countLbl.textContent = `${_state.list.length} ${_state.list.length === 1 ? 'file' : 'files'}`;
    }

    if (tableWrap) tableWrap.style.display = _state.viewMode === 'table' ? 'block' : 'none';
    if (gridWrap)  gridWrap.style.display  = _state.viewMode === 'grid'  ? 'grid'  : 'none';

    document.getElementById('docViewTableBtn')?.classList.toggle('active', _state.viewMode === 'table');
    document.getElementById('docViewGridBtn')?.classList.toggle('active', _state.viewMode === 'grid');

    const tbody = document.getElementById('doc-table-body');
    const emptyHtml = `
      <div class="doc-empty">
        <i data-lucide="folder-open" style="width:32px;height:32px;opacity:0.45;margin-bottom:0.5rem;"></i>
        <div style="font-weight:700;color:var(--text-main);font-size:0.92rem;">No matching files found</div>
        <div style="font-size:0.78rem;margin-top:0.2rem;">Try clearing filters or click "Upload Files" to add documents to the vault.</div>
      </div>`;

    if (_state.viewMode === 'table' && tbody) {
      tbody.innerHTML = _state.list.length
        ? _state.list.map(d => {
            const m = catMeta(d.category);
            const vis = VIS_META[d.visibility] || VIS_META.internal;
            const folder = d.folder || 'General';
            const pinned = Number(d.is_pinned) === 1;
            const checked = _state.selectedIds.has(Number(d.id));
            return `
            <tr>
              <td style="text-align:center; width:38px;">
                <input type="checkbox" class="doc-row-cb" ${checked ? 'checked' : ''} onchange="docToggleSelect(${d.id}, this.checked)" style="cursor:pointer;">
              </td>
              <td>
                <div class="doc-name-cell">
                  <div class="doc-icon-badge" style="background:${m.bg}; color:${m.color}; border-color:${m.border};">
                    <i data-lucide="${m.icon}" style="width:18px;height:18px;"></i>
                  </div>
                  <div style="min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.35rem;">
                      ${pinned ? `<i data-lucide="pin" style="width:12px;height:12px;color:#f59e0b;flex-shrink:0;" title="Pinned to Top"></i>` : ''}
                      <div class="doc-name" onclick="docOpenPreview(${d.id})" title="${esc(d.original_name)}">${esc(d.original_name)}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.15rem; flex-wrap:wrap;">
                      <span class="doc-vis-badge ${vis.cls}">${vis.label}</span>
                      ${d.description ? `<span class="doc-desc" title="${esc(d.description)}">· ${esc(d.description)}</span>` : ''}
                    </div>
                  </div>
                </div>
              </td>
              <td><span class="doc-cat-badge" style="background:${m.bg}; color:${m.color}; border:1px solid ${m.border};">${m.label}</span></td>
              <td><span class="doc-folder-tag"><i data-lucide="folder" style="width:11px;height:11px;"></i> ${esc(folder)}</span></td>
              <td style="white-space:nowrap; font-variant-numeric:tabular-nums; font-weight:600;">${fmtSize(d.file_size)}</td>
              <td style="white-space:nowrap;">
                <div style="font-size:0.8rem; font-weight:600;">${fmtDate(d.created_at)}</div>
                <div style="font-size:0.69rem; color:var(--text-muted);">${esc(d.uploader_name || 'Admin')}</div>
              </td>
              <td style="text-align:right; white-space:nowrap;">
                <div class="doc-actions">
                  <button type="button" class="doc-pin-btn ${pinned ? 'pinned' : ''}" onclick="docTogglePin(${d.id})" title="${pinned ? 'Unpin' : 'Pin to Top'}"><i data-lucide="pin" style="width:14px;height:14px;"></i></button>
                  <button type="button" class="doc-act-btn" onclick="docOpenPreview(${d.id})" title="Preview File"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
                  <button type="button" class="doc-act-btn btn-dl" onclick="docDownload(${d.id})" title="Download"><i data-lucide="download" style="width:14px;height:14px;"></i></button>
                  <button type="button" class="doc-act-btn" onclick="docOpenEditModal(${d.id})" title="Edit Metadata"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                  <button type="button" class="doc-act-btn btn-del" onclick="docDelete(${d.id})" title="Delete File"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
              </td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="7">${emptyHtml}</td></tr>`;
    }

    if (_state.viewMode === 'grid' && gridWrap) {
      gridWrap.innerHTML = _state.list.length
        ? _state.list.map(d => {
            const m = catMeta(d.category);
            const vis = VIS_META[d.visibility] || VIS_META.internal;
            const folder = d.folder || 'General';
            const pinned = Number(d.is_pinned) === 1;
            const checked = _state.selectedIds.has(Number(d.id));
            return `
            <div class="doc-file-card ${pinned ? 'is-pinned' : ''}">
              <div>
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem; margin-bottom:0.65rem;">
                  <div style="display:flex; align-items:center; gap:0.65rem; min-width:0;">
                    <input type="checkbox" class="doc-row-cb" ${checked ? 'checked' : ''} onchange="docToggleSelect(${d.id}, this.checked)" style="cursor:pointer;">
                    <div class="doc-icon-badge" style="background:${m.bg}; color:${m.color}; border-color:${m.border};">
                      <i data-lucide="${m.icon}" style="width:19px;height:19px;"></i>
                    </div>
                    <div style="min-width:0;">
                      <div class="doc-name" style="max-width:165px;" onclick="docOpenPreview(${d.id})" title="${esc(d.original_name)}">${esc(d.original_name)}</div>
                      <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.12rem;">${fmtSize(d.file_size)} · ${fmtDate(d.created_at)}</div>
                    </div>
                  </div>
                  <button type="button" class="doc-pin-btn ${pinned ? 'pinned' : ''}" onclick="docTogglePin(${d.id})" title="${pinned ? 'Unpin' : 'Pin'}">
                    <i data-lucide="pin" style="width:14px;height:14px;"></i>
                  </button>
                </div>

                <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap; margin-bottom:0.5rem;">
                  <span class="doc-cat-badge" style="background:${m.bg}; color:${m.color}; border:1px solid ${m.border};">${m.label}</span>
                  <span class="doc-folder-tag">${esc(folder)}</span>
                  <span class="doc-vis-badge ${vis.cls}">${vis.label}</span>
                </div>
                ${d.description ? `<div style="font-size:0.74rem; color:var(--text-muted); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(d.description)}</div>` : ''}
              </div>

              <div style="display:flex; align-items:center; justify-content:space-between; padding-top:0.65rem; border-top:1px dashed var(--border-color);">
                <span style="font-size:0.7rem; color:var(--text-muted);">By ${esc(d.uploader_name || 'Admin')}</span>
                <div class="doc-actions">
                  <button type="button" class="doc-act-btn" onclick="docOpenPreview(${d.id})" title="Preview"><i data-lucide="eye" style="width:13px;height:13px;"></i></button>
                  <button type="button" class="doc-act-btn btn-dl" onclick="docDownload(${d.id})" title="Download"><i data-lucide="download" style="width:13px;height:13px;"></i></button>
                  <button type="button" class="doc-act-btn" onclick="docOpenEditModal(${d.id})" title="Edit"><i data-lucide="edit-2" style="width:13px;height:13px;"></i></button>
                  <button type="button" class="doc-act-btn btn-del" onclick="docDelete(${d.id})" title="Delete"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
                </div>
              </div>
            </div>`;
          }).join('')
        : `<div style="grid-column:1/-1;">${emptyHtml}</div>`;
    }

    _updateBulkBar();
    if (window.lucide) lucide.createIcons();
  }

  /* ── Stats & Storage Telemetry ── */
  async function docLoadStats() {
    try {
      const r = await fetch('/api/documents/stats', { credentials: 'include' });
      const s = await r.json();
      _state.stats = s;
      const byCat = Array.isArray(s.byCategory) ? s.byCategory : [];
      const getCnt = (cat) => (byCat.find(x => x.category === cat)?.count || 0);
      const totalBytes = Number(s.total?.total_size || 0);
      const totalCount = Number(s.total?.count || 0);
      const mediaCnt = getCnt('audio') + getCnt('video') + getCnt('image');

      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
      setTxt('ds-total', totalCount);
      setTxt('ds-size', fmtSize(totalBytes));
      setTxt('ds-pdf', getCnt('pdf'));
      setTxt('ds-docs', getCnt('word') + getCnt('presentation'));
      setTxt('ds-sheets', getCnt('excel'));
      setTxt('ds-media', mediaCnt);
      setTxt('ds-pinned', Number(s.pinnedCount || 0));

      const softCapBytes = 1024 * 1024 * 1024; // 1 GB visual meter reference
      const pct = Math.min(100, Math.max(totalBytes > 0 ? 4 : 0, Math.round((totalBytes / softCapBytes) * 100)));
      const bar = document.getElementById('docStorageFill');
      const txt = document.getElementById('docStorageText');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = `${fmtSize(totalBytes)} archived`;
    } catch (_) {}
  }

  /* ── Interactive Filter & Bulk Actions ── */
  let _filterTimer;
  window.docFilterChange = function () {
    clearTimeout(_filterTimer);
    _filterTimer = setTimeout(docLoad, 260);
  };

  window.docSetViewMode = function (mode) {
    _state.viewMode = mode === 'grid' ? 'grid' : 'table';
    localStorage.setItem('edf-doc-view', _state.viewMode);
    docRender();
  };

  window.docSetFolderFilter = function (folder) {
    _state.folderFilter = folder || 'all';
    document.querySelectorAll('#doc-folder-strip .doc-folder-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.docFolder === _state.folderFilter);
    });
    docLoad();
  };

  window.docSetCategoryCardFilter = function (cat) {
    const sel = document.getElementById('doc-cat-select');
    if (cat === '_pinned') {
      docSetFolderFilter(_state.folderFilter === '_pinned' ? 'all' : '_pinned');
      return;
    }
    if (sel) {
      const next = (sel.value === cat) ? 'all' : cat;
      sel.value = next;
    }
    document.querySelectorAll('#doc-stats-bar .doc-stat-card').forEach(card => {
      card.classList.toggle('active', card.dataset.docKpiCat === (sel?.value || 'all'));
    });
    docLoad();
  };

  window.docToggleSelect = function (id, checked) {
    const numId = Number(id);
    if (checked) _state.selectedIds.add(numId);
    else _state.selectedIds.delete(numId);
    _updateBulkBar();
  };

  window.docToggleSelectAll = function (checked) {
    _state.selectedIds.clear();
    if (checked) _state.list.forEach(d => _state.selectedIds.add(Number(d.id)));
    docRender();
  };

  window.docClearSelection = function () {
    _state.selectedIds.clear();
    const cb = document.getElementById('docSelectAllCb');
    if (cb) cb.checked = false;
    docRender();
  };

  window.docBulkDelete = async function () {
    const ids = [..._state.selectedIds];
    if (!ids.length) return;
    if (!confirm(`Permanently delete ${ids.length} selected file(s)?`)) return;
    try {
      const r = await fetch('/api/documents/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Bulk delete failed');
      _state.selectedIds.clear();
      _toast(data.message || 'Files deleted', 'success');
      await docLoad();
      docLoadStats();
    } catch (e) {
      _toast(e.message || 'Bulk delete failed', 'error');
    }
  };

  window.docTogglePin = async function (id) {
    try {
      const r = await fetch(`/api/documents/${id}/pin`, { method: 'PATCH', credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || 'Pin failed');
      _toast(data.message, 'success');
      docLoad();
      docLoadStats();
    } catch (e) {
      _toast(e.message || 'Pin update failed', 'error');
    }
  };

  window.docDownload = function (id) {
    window.location.href = '/api/documents/' + id + '/download';
  };

  window.docDelete = async function (id) {
    if (!confirm('Permanently delete this file from the vault?')) return;
    try {
      const r = await fetch('/api/documents/' + id, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error();
      _state.list = _state.list.filter(d => Number(d.id) !== Number(id));
      _state.selectedIds.delete(Number(id));
      docRender();
      docLoadStats();
      _toast('File removed from vault', 'success');
    } catch (_) {
      _toast('Delete failed', 'error');
    }
  };

  window.docExportRegistryCSV = function () {
    if (!_state.list.length) {
      _toast('No files in current view to export', 'warning');
      return;
    }
    const headers = ['ID', 'Title', 'Category', 'Folder', 'Visibility', 'Pinned', 'Size (Bytes)', 'Uploaded Date', 'Uploaded By', 'Description'];
    const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = _state.list.map(d => [
      d.id, d.original_name, catMeta(d.category).label, d.folder || 'General',
      d.visibility || 'internal', Number(d.is_pinned) === 1 ? 'Yes' : 'No',
      d.file_size, d.created_at, d.uploader_name || '', d.description || ''
    ].map(csvCell).join(','));
    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `EDF-Documents-Registry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Quick Inline File Preview Overlay ── */
  window.docOpenPreview = function (id) {
    const doc = _state.list.find(x => Number(x.id) === Number(id));
    if (!doc) return;
    const overlay = document.getElementById('doc-preview-overlay');
    const titleEl = document.getElementById('doc-preview-title');
    const subEl   = document.getElementById('doc-preview-sub');
    const stage   = document.getElementById('doc-preview-stage');
    const dlBtn   = document.getElementById('doc-preview-dl-btn');
    if (!overlay || !stage) { docDownload(id); return; }

    if (titleEl) titleEl.textContent = doc.original_name;
    if (subEl) subEl.textContent = `${catMeta(doc.category).label} · ${doc.folder || 'General'} · ${fmtSize(doc.file_size)}`;
    if (dlBtn) dlBtn.onclick = () => docDownload(doc.id);

    const previewUrl = `/api/documents/${doc.id}/preview`;
    const mime = (doc.mime_type || '').toLowerCase();
    const cat = doc.category;

    if (cat === 'image' || mime.startsWith('image/')) {
      stage.innerHTML = `<img src="${previewUrl}" alt="${esc(doc.original_name)}" style="max-width:100%; max-height:100%; border-radius:12px; box-shadow:0 12px 32px rgba(0,0,0,0.28); object-fit:contain;">`;
    } else if (cat === 'pdf' || mime === 'application/pdf') {
      stage.innerHTML = `<iframe src="${previewUrl}" style="width:100%; height:100%; border:none; border-radius:12px; background:#ffffff;"></iframe>`;
    } else if (cat === 'video' || mime.startsWith('video/')) {
      stage.innerHTML = `<video controls autoplay style="max-width:100%; max-height:100%; border-radius:12px; background:#000;"><source src="${previewUrl}" type="${esc(doc.mime_type || 'video/mp4')}"></video>`;
    } else if (cat === 'audio' || mime.startsWith('audio/')) {
      stage.innerHTML = `
        <div style="text-align:center; padding:2rem; max-width:440px;">
          <div style="width:68px; height:68px; border-radius:18px; background:rgba(139,92,246,0.14); color:#7c3aed; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
            <i data-lucide="music" style="width:32px;height:32px;"></i>
          </div>
          <h4 style="margin:0 0 0.75rem; color:var(--text-main);">${esc(doc.original_name)}</h4>
          <audio controls style="width:100%;" src="${previewUrl}"></audio>
        </div>`;
    } else {
      const m = catMeta(cat);
      stage.innerHTML = `
        <div style="text-align:center; padding:2.2rem; max-width:420px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px;">
          <div style="width:64px; height:64px; border-radius:16px; background:${m.bg}; color:${m.color}; display:flex; align-items:center; justify-content:center; margin:0 auto 0.9rem;">
            <i data-lucide="${m.icon}" style="width:30px;height:30px;"></i>
          </div>
          <div style="font-weight:800; font-size:1rem; color:var(--text-main); margin-bottom:0.35rem;">${esc(doc.original_name)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.1rem;">${m.label} file (${fmtSize(doc.file_size)}) cannot be rendered inline in the browser previewer. Click Download to open it locally.</div>
          <button type="button" class="btn btn-primary" onclick="docDownload(${doc.id})"><i data-lucide="download"></i> Download ${m.label}</button>
        </div>`;
    }

    overlay.classList.add('open');
    if (window.lucide) lucide.createIcons();
  };

  window.docClosePreview = function () {
    const overlay = document.getElementById('doc-preview-overlay');
    const stage = document.getElementById('doc-preview-stage');
    if (overlay) overlay.classList.remove('open');
    if (stage) stage.innerHTML = '';
  };

  /* ── Modal Helpers ── */
  window.docCloseModal = function () {
    if (_state.activeXhr) {
      _state.uploadCancelled = true;
      try { _state.activeXhr.abort(); } catch (_) {}
      _state.activeXhr = null;
    }
    _clearPreviewUrls();
    _state.queueFiles = [];
    _state.editId = null;
    document.getElementById('doc-modal-overlay')?.classList.remove('open');
  };

  function _folderOptionsHtml(selected = 'General') {
    return DOC_FOLDERS.map(f => `<option value="${esc(f)}" ${f === selected ? 'selected' : ''}>${esc(f)}</option>`).join('');
  }

  function _catOptionsHtml(selected = 'auto', includeAuto = true) {
    const autoOpt = includeAuto ? `<option value="auto" ${selected === 'auto' ? 'selected' : ''}>Auto-Detect Format</option>` : '';
    const listOpts = Object.keys(CAT_META).map(k => `<option value="${k}" ${selected === k ? 'selected' : ''}>${CAT_META[k].label}</option>`).join('');
    return autoOpt + listOpts;
  }

  /* ── Redesigned Upload Studio Modal ── */
  window.docOpenUploadModal = function () {
    _state.editId = null;
    _state.queueFiles = [];
    _clearPreviewUrls();

    const titleEl = document.getElementById('doc-modal-title');
    const subEl   = document.getElementById('doc-modal-subtitle');
    const bodyEl  = document.getElementById('doc-modal-body');
    const footEl  = document.getElementById('doc-modal-foot');
    const slot    = document.getElementById('doc-modal-lottie-slot');

    if (titleEl) titleEl.textContent = 'Upload Files to Vault';
    if (subEl) subEl.textContent = 'Drag & drop single or multiple documents · Up to 200 MB per file';
    if (slot) {
      slot.setAttribute('data-lottie-icon', 'cloudupload');
      delete slot.dataset.lottieBound;
      slot.innerHTML = '';
    }

    bodyEl.innerHTML = `
      <div class="doc-upload-zone" id="doc-drop-zone" onclick="document.getElementById('doc-file-input').click()">
        <div style="width:52px; height:52px; margin:0 auto 0.5rem; border-radius:15px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center;">
          <span class="bh-lottie-inline" data-lottie-icon="cloudupload" data-lottie-size="30" data-lottie-trigger="loop"></span>
        </div>
        <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">Drop files here or <span style="color:#10b981;">Browse Device</span></div>
        <div style="font-size:0.76rem; color:var(--text-muted); margin-top:0.25rem;">PDF, Word, Excel, PowerPoint, Audio, Video &amp; High-Res Images · Multi-file queue supported</div>
        <input type="file" id="doc-file-input" multiple style="display:none;" onchange="docFileSelected(this)">
      </div>

      <div id="doc-selected-info" style="display:none;"></div>

      <div class="doc-progress-wrap" id="doc-progress">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-weight:700; color:var(--text-main);">
          <span id="doc-progress-label">Uploading…</span>
          <span id="doc-progress-pct" style="color:#10b981; font-variant-numeric:tabular-nums;">0%</span>
        </div>
        <div class="doc-progress"><div class="doc-progress-bar" id="doc-progress-bar"></div></div>
      </div>

      <div class="doc-meta-grid">
        <div class="doc-form-group" style="margin-bottom:0;">
          <label id="doc-upload-name-lbl">Display Title</label>
          <input type="text" id="doc-upload-name" placeholder="Auto-filled from selected file">
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>File Category</label>
          <select id="doc-upload-cat">${_catOptionsHtml('auto', true)}</select>
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Archive Folder</label>
          <select id="doc-upload-folder">${_folderOptionsHtml('General')}</select>
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Access Visibility</label>
          <select id="doc-upload-vis">
            <option value="internal">Internal Staff</option>
            <option value="board_only">Board Only</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
      </div>

      <div class="doc-form-group" style="margin-top:0.75rem;">
        <label>Description / Archive Context <span style="font-weight:400;">(optional)</span></label>
        <textarea id="doc-upload-desc" placeholder="Brief summary, meeting reference, beneficiary batch, or audit period…"></textarea>
      </div>

      <label style="display:inline-flex; align-items:center; gap:0.45rem; cursor:pointer; font-size:0.78rem; font-weight:700; color:var(--text-main);">
        <input type="checkbox" id="doc-upload-pin" style="width:16px; height:16px; accent-color:#f59e0b;">
        Pin uploaded document(s) to top of Vault
      </label>`;

    footEl.innerHTML = `
      <span id="doc-queue-foot-note" style="font-size:0.74rem; color:var(--text-muted);">No files queued yet</span>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button type="button" class="btn btn-outline" onclick="docCloseModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="docSubmitUpload()" id="doc-upload-btn">
          <i data-lucide="upload-cloud" style="width:15px;height:15px;"></i> Upload to Vault
        </button>
      </div>`;

    const zone = document.getElementById('doc-drop-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer?.files?.length) {
          docFileSelected({ files: e.dataTransfer.files }, true);
        }
      });
    }

    document.getElementById('doc-modal-overlay')?.classList.add('open');
    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    if (window.lucide) lucide.createIcons();
  };

  function _renderUploadQueue() {
    _clearPreviewUrls();
    const infoEl = document.getElementById('doc-selected-info');
    const footEl = document.getElementById('doc-queue-foot-note');
    const nameLbl = document.getElementById('doc-upload-name-lbl');
    const nameEl  = document.getElementById('doc-upload-name');
    const q = _state.queueFiles;

    if (!q.length) {
      if (infoEl) { infoEl.style.display = 'none'; infoEl.innerHTML = ''; }
      if (footEl) footEl.textContent = 'No files queued yet';
      if (nameLbl) nameLbl.textContent = 'Display Title';
      if (nameEl) nameEl.placeholder = 'Auto-filled from selected file';
      return;
    }

    const totalSize = q.reduce((s, f) => s + Number(f.size || 0), 0);
    if (footEl) footEl.textContent = `${q.length} ${q.length === 1 ? 'file' : 'files'} ready · ${fmtSize(totalSize)}`;

    if (q.length === 1) {
      if (nameLbl) nameLbl.textContent = 'Display Title';
      if (nameEl && !nameEl.value) nameEl.value = q[0].name;
    } else {
      if (nameLbl) nameLbl.textContent = 'Batch Title Prefix (optional)';
      if (nameEl) { nameEl.value = ''; nameEl.placeholder = 'Keep original filenames (optional prefix)'; }
    }

    if (infoEl) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `<div class="doc-queue-list">${q.map((file, idx) => {
        const cat = detectClientCategory(file);
        const m = catMeta(cat);
        let thumbHtml = `<div class="doc-icon-badge" style="width:36px;height:36px;background:${m.bg};color:${m.color};border-color:${m.border};"><i data-lucide="${m.icon}" style="width:16px;height:16px;"></i></div>`;
        if (cat === 'image' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          try {
            const objUrl = URL.createObjectURL(file);
            _state.previewObjectUrls.push(objUrl);
            thumbHtml = `<img class="doc-queue-thumb" src="${objUrl}" alt="">`;
          } catch (_) {}
        }
        const overLimit = Number(file.size || 0) > 200 * 1024 * 1024;
        return `
        <div class="doc-queue-item">
          <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1;">
            ${thumbHtml}
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:0.8rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(file.name)}</div>
              <div style="font-size:0.7rem; color:${overLimit ? '#ef4444' : 'var(--text-muted)'};">${m.label} · ${fmtSize(file.size)}${overLimit ? ' (Exceeds 200 MB)' : ''}</div>
            </div>
          </div>
          <button type="button" class="doc-act-btn btn-del" style="padding:0.25rem 0.45rem;" onclick="docRemoveQueuedFile(${idx})" title="Remove from queue">
            <i data-lucide="x" style="width:13px;height:13px;"></i>
          </button>
        </div>`;
      }).join('')}</div>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  window.docFileSelected = function (input, append = false) {
    const files = Array.from(input?.files || []);
    if (!files.length) return;
    if (append && _state.queueFiles.length) {
      const seen = new Set(_state.queueFiles.map(f => `${f.name}:${f.size}`));
      files.forEach(f => { if (!seen.has(`${f.name}:${f.size}`)) _state.queueFiles.push(f); });
    } else {
      _state.queueFiles = files;
    }
    _renderUploadQueue();
  };

  window.docRemoveQueuedFile = function (idx) {
    _state.queueFiles.splice(idx, 1);
    _renderUploadQueue();
  };

  function _xhrUploadSingle(file, meta, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('display_name', meta.display_name || '');
      fd.append('category', meta.category || 'auto');
      fd.append('folder', meta.folder || 'General');
      fd.append('visibility', meta.visibility || 'internal');
      fd.append('is_pinned', meta.is_pinned ? '1' : '0');
      fd.append('description', meta.description || '');

      const xhr = new XMLHttpRequest();
      _state.activeXhr = xhr;
      xhr.open('POST', '/api/documents');
      xhr.withCredentials = true;
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
      };
      xhr.onload = () => {
        _state.activeXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
        else {
          let msg = 'Upload failed';
          try { msg = JSON.parse(xhr.responseText).message || msg; } catch (_) {}
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => { _state.activeXhr = null; reject(new Error('Network error during upload')); };
      xhr.onabort = () => { _state.activeXhr = null; reject(new Error('Upload cancelled')); };
      xhr.send(fd);
    });
  }

  window.docSubmitUpload = async function () {
    if (!_state.queueFiles.length) {
      const inp = document.getElementById('doc-file-input');
      if (inp?.files?.length) _state.queueFiles = Array.from(inp.files);
    }
    if (!_state.queueFiles.length) {
      _toast('Please select at least one file to upload', 'error');
      return;
    }

    const btn      = document.getElementById('doc-upload-btn');
    const progWrap = document.getElementById('doc-progress');
    const progBar  = document.getElementById('doc-progress-bar');
    const progLbl  = document.getElementById('doc-progress-label');
    const progPct  = document.getElementById('doc-progress-pct');

    const titleVal = (document.getElementById('doc-upload-name')?.value || '').trim();
    const catVal   = document.getElementById('doc-upload-cat')?.value || 'auto';
    const folder   = document.getElementById('doc-upload-folder')?.value || 'General';
    const vis      = document.getElementById('doc-upload-vis')?.value || 'internal';
    const desc     = (document.getElementById('doc-upload-desc')?.value || '').trim();
    const isPinned = Boolean(document.getElementById('doc-upload-pin')?.checked);

    _state.uploadCancelled = false;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Uploading…'; }
    if (progWrap) progWrap.style.display = 'block';

    const files = [..._state.queueFiles];
    let uploadedCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        if (_state.uploadCancelled) break;
        const file = files[i];
        const displayName = files.length === 1
          ? (titleVal || file.name)
          : (titleVal ? `${titleVal} — ${file.name}` : file.name);

        if (progLbl) progLbl.textContent = `Uploading ${i + 1} of ${files.length}: ${file.name}`;
        await _xhrUploadSingle(
          file,
          { display_name: displayName, category: catVal, folder, visibility: vis, is_pinned: isPinned, description: desc },
          (loaded, total) => {
            const pct = Math.min(100, Math.round((((i + (loaded / (total || 1))) / files.length) * 100)));
            if (progBar) progBar.style.width = pct + '%';
            if (progPct) progPct.textContent = pct + '%';
          }
        );
        uploadedCount++;
      }

      if (!_state.uploadCancelled) {
        docCloseModal();
        await docLoad();
        docLoadStats();
        _toast(`Uploaded ${uploadedCount} ${uploadedCount === 1 ? 'file' : 'files'} to vault`, 'success');
      }
    } catch (err) {
      if (!_state.uploadCancelled) _toast(err.message || 'Upload failed', 'error');
      if (progWrap) progWrap.style.display = 'none';
      if (progBar) progBar.style.width = '0';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="upload-cloud" style="width:15px;height:15px;"></i> Upload to Vault'; }
      if (window.lucide) lucide.createIcons();
    }
  };

  /* ── Edit Metadata Studio Modal ── */
  window.docOpenEditModal = function (docOrId) {
    const doc = (typeof docOrId === 'object' && docOrId)
      ? docOrId
      : _state.list.find(x => Number(x.id) === Number(docOrId));
    if (!doc) return;

    _state.editId = doc.id;
    const m = catMeta(doc.category);
    const titleEl = document.getElementById('doc-modal-title');
    const subEl   = document.getElementById('doc-modal-subtitle');
    const bodyEl  = document.getElementById('doc-modal-body');
    const footEl  = document.getElementById('doc-modal-foot');
    const slot    = document.getElementById('doc-modal-lottie-slot');

    if (titleEl) titleEl.textContent = 'Edit Vault File Details';
    if (subEl) subEl.textContent = `${m.label} · ${fmtSize(doc.file_size)} · Stored ${fmtDate(doc.created_at)}`;
    if (slot) {
      slot.setAttribute('data-lottie-icon', 'docvault');
      delete slot.dataset.lottieBound;
      slot.innerHTML = '';
    }

    bodyEl.innerHTML = `
      <div class="doc-meta-grid" style="margin-top:0;">
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Display Title *</label>
          <input type="text" id="doc-edit-name" value="${esc(doc.original_name)}">
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Category</label>
          <select id="doc-edit-cat">${_catOptionsHtml(doc.category || 'other', false)}</select>
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Archive Folder</label>
          <select id="doc-edit-folder">${_folderOptionsHtml(doc.folder || 'General')}</select>
        </div>
        <div class="doc-form-group" style="margin-bottom:0;">
          <label>Access Visibility</label>
          <select id="doc-edit-vis">
            <option value="internal" ${(!doc.visibility || doc.visibility === 'internal') ? 'selected' : ''}>Internal Staff</option>
            <option value="board_only" ${doc.visibility === 'board_only' ? 'selected' : ''}>Board Only</option>
            <option value="restricted" ${doc.visibility === 'restricted' ? 'selected' : ''}>Restricted</option>
          </select>
        </div>
      </div>

      <div class="doc-form-group" style="margin-top:0.8rem;">
        <label>Description / Notes</label>
        <textarea id="doc-edit-desc">${esc(doc.description || '')}</textarea>
      </div>

      <label style="display:inline-flex; align-items:center; gap:0.45rem; cursor:pointer; font-size:0.78rem; font-weight:700; color:var(--text-main);">
        <input type="checkbox" id="doc-edit-pin" ${Number(doc.is_pinned) === 1 ? 'checked' : ''} style="width:16px; height:16px; accent-color:#f59e0b;">
        Pin to top of Vault
      </label>

      <div style="margin-top:0.75rem; padding:0.55rem 0.75rem; border-radius:9px; background:var(--input-bg); border:1px solid var(--border-color); font-size:0.72rem; color:var(--text-muted);">
        Storage ID: <strong>${esc(doc.filename)}</strong> · Uploaded by <strong>${esc(doc.uploader_name || 'Admin')}</strong>
      </div>`;

    footEl.innerHTML = `
      <span style="font-size:0.72rem; color:var(--text-muted);">Changes take effect immediately</span>
      <div style="display:flex; gap:0.5rem;">
        <button type="button" class="btn btn-outline" onclick="docCloseModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="docSubmitEdit()">Save Changes</button>
      </div>`;

    document.getElementById('doc-modal-overlay')?.classList.add('open');
    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    if (window.lucide) lucide.createIcons();
  };

  window.docSubmitEdit = async function () {
    const name = document.getElementById('doc-edit-name')?.value.trim();
    if (!name) {
      _toast('Display name is required', 'error');
      return;
    }
    const body = {
      original_name: name,
      category:      document.getElementById('doc-edit-cat')?.value || 'other',
      folder:        document.getElementById('doc-edit-folder')?.value || 'General',
      visibility:    document.getElementById('doc-edit-vis')?.value || 'internal',
      is_pinned:     document.getElementById('doc-edit-pin')?.checked ? 1 : 0,
      description:   document.getElementById('doc-edit-desc')?.value || ''
    };
    try {
      const r = await fetch('/api/documents/' + _state.editId, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error();
      docCloseModal();
      await docLoad();
      docLoadStats();
      _toast('Document metadata updated', 'success');
    } catch (_) {
      _toast('Save failed', 'error');
    }
  };
})();


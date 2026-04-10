/**
 * EDF Portal — Form Builder (App Customizer)
 * Fully functional drag-and-drop form builder.
 * Fields map to program_applications DB columns (std_*) or custom_data JSON (custom).
 */

const FB = (() => {
    /* ── STATE ───────────────────────────────────────────────── */
    let fields     = [];
    let selectedId = null;
    let templates  = [];

    // Drag: palette → canvas
    let paletteDragType  = null;
    // Drag: reorder within canvas
    let reorderDragId    = null;
    let reorderTargetId  = null;
    let reorderPos       = null; // 'before' | 'after' | null (end)

    /* ── FIELD SCHEMA ────────────────────────────────────────── */
    const STD_FIELDS = {
        std_program:        { label:'Program',            icon:'book-open',       dbCol:'course_id',         required:false },
        std_batch:          { label:'Batch',              icon:'layers',          dbCol:'batch_id',          required:false },
        std_name:           { label:'Applicant Name',     icon:'user',            dbCol:'applicant_name',    required:true  },
        std_phone:          { label:'Phone Number',       icon:'phone',           dbCol:'applicant_phone',   required:false },
        std_email:          { label:'Email Address',      icon:'mail',            dbCol:'applicant_email',   required:false },
        std_age:            { label:'Age',                icon:'calendar-days',   dbCol:'applicant_age',     required:false },
        std_gender:         { label:'Gender',             icon:'users-round',     dbCol:'applicant_gender',  required:false },
        std_nic:            { label:'NIC Number',         icon:'id-card',         dbCol:'nic_number',        required:false },
        std_education:      { label:'Education Level',    icon:'graduation-cap',  dbCol:'education_level',   required:false },
        std_address:        { label:'Residential Address',icon:'map-pin',         dbCol:'applicant_address', required:false },
        std_guardian_name:  { label:'Guardian Name',      icon:'user-check',      dbCol:'guardian_name',     required:false },
        std_guardian_phone: { label:'Guardian Phone',     icon:'phone-call',      dbCol:'guardian_phone',    required:false },
        std_notes:          { label:'Notes / Remarks',    icon:'notebook-pen',    dbCol:'notes',             required:false },
    };

    const CUSTOM_DEFAULTS = {
        text:        { label:'Text Field',           placeholder:'Enter text...',    },
        number:      { label:'Number Field',          placeholder:'Enter a number',  },
        date:        { label:'Date Field',            placeholder:'',                },
        textarea:    { label:'Description',           placeholder:'Enter details...', },
        select:      { label:'Dropdown',              options:['Option 1','Option 2','Option 3'] },
        radio:       { label:'Choose One',            options:['Option A','Option B','Option C'] },
        checkbox:    { label:'Select All That Apply', options:['Choice 1','Choice 2','Choice 3'] },
        toggle:      { label:'Yes / No',              placeholder:'' },
        rating:      { label:'Rating',                placeholder:'' },
        file:        { label:'Upload Document',       placeholder:'Accepted: PDF, JPG, PNG', accept:'.pdf,.jpg,.png' },
        section:     { label:'Section Title',         placeholder:'Section subtitle or description...' },
        divider:     { label:'',                      placeholder:'' },
        description: { label:'',                      placeholder:'Add your information text here...' },
    };

    const TYPE_ICONS = {
        text:'text-cursor-input', number:'hash', date:'calendar', textarea:'align-left',
        select:'chevron-down-square', radio:'circle-dot', checkbox:'check-square',
        toggle:'toggle-right', rating:'star', file:'paperclip',
        section:'minus-square', divider:'separator-horizontal', description:'info',
        std_program:'book-open', std_batch:'layers', std_name:'user', std_phone:'phone',
        std_email:'mail', std_age:'calendar-days', std_gender:'users-round', std_nic:'id-card',
        std_education:'graduation-cap', std_address:'map-pin', std_guardian_name:'user-check',
        std_guardian_phone:'phone-call', std_notes:'notebook-pen',
    };

    const TYPE_LABELS = {
        text:'Text', number:'Number', date:'Date', textarea:'Textarea',
        select:'Dropdown', radio:'Radio', checkbox:'Checkbox', toggle:'Toggle',
        rating:'Rating', file:'File Upload', section:'Section', divider:'Divider', description:'Info Text',
        std_program:'Program', std_batch:'Batch', std_name:'Full Name', std_phone:'Phone',
        std_email:'Email', std_age:'Age', std_gender:'Gender', std_nic:'NIC Number',
        std_education:'Education', std_address:'Address', std_guardian_name:'Guardian Name',
        std_guardian_phone:'Guardian Phone', std_notes:'Notes',
    };

    /* ── HELPERS ─────────────────────────────────────────────── */
    function uid() { return 'f_' + Date.now() + '_' + Math.floor(Math.random() * 10000); }
    function isStd(type) { return type && type.startsWith('std_'); }

    function makeField(type) {
        const base = { id: uid(), type, required: false, width: 'full', helpText: '' };
        if (isStd(type)) {
            const def = STD_FIELDS[type] || {};
            return { ...base, label: def.label || type, placeholder: '', required: def.required || false };
        }
        const def = CUSTOM_DEFAULTS[type] || {};
        return {
            ...base,
            label:       def.label       || 'Field',
            placeholder: def.placeholder || '',
            options:     def.options     ? [...def.options] : undefined,
            accept:      def.accept      || undefined,
            min: undefined, max: undefined,
        };
    }

    function toast(msg, type = 'info') {
        if (window.showToast) { window.showToast(msg, type); return; }
        const colors = { success:'#10b981', error:'#ef4444', info:'var(--primary)' };
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:var(--bg-card);border:1px solid var(--border-color);border-left:3px solid ${colors[type]||colors.info};padding:.75rem 1.25rem;border-radius:12px;font-size:.875rem;color:var(--text-main);z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.12);display:flex;align-items:center;gap:.625rem;animation:slideInRight .25s ease;`;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s ease'; setTimeout(() => el.remove(), 300); }, 3000);
    }

    function _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ── INIT ────────────────────────────────────────────────── */
    function init() {
        _setupPaletteDrag();
        _syncTitleInputs();
        _setupKeyboardShortcuts();
        fetchTemplates();
    }

    function _syncTitleInputs() {
        const titleIn = document.getElementById('fbFormTitle');
        const descIn  = document.getElementById('fbFormDesc');
        if (titleIn) titleIn.addEventListener('input', () => {
            const h = document.getElementById('fbCanvasTitle');
            const p = document.getElementById('fbPreviewTitle');
            if (h) h.textContent = titleIn.value || 'Application Form';
            if (p) p.textContent = titleIn.value || 'Application Form';
        });
        if (descIn) descIn.addEventListener('input', () => {
            const h = document.getElementById('fbCanvasDesc');
            const p = document.getElementById('fbPreviewDesc');
            if (h) h.textContent = descIn.value;
            if (p) p.textContent = descIn.value;
        });
    }

    function _setupKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            // Only fire when not typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            // Only when customizer tab is visible
            const tab = document.getElementById('customizerTab');
            if (!tab || !tab.classList.contains('active')) return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
                e.preventDefault();
                removeField(selectedId);
            }
            if (e.key === 'Escape') {
                selectedId = null;
                document.querySelectorAll('.fb-field-item').forEach(el => el.classList.remove('fb-selected'));
                renderProperties();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedId) {
                e.preventDefault();
                duplicateField(selectedId);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp' && selectedId) {
                e.preventDefault();
                moveField(selectedId, 'up');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown' && selectedId) {
                e.preventDefault();
                moveField(selectedId, 'down');
            }
        });
    }

    /* ── PALETTE SEARCH ──────────────────────────────────────── */
    function filterPalette(q) {
        const query = (q || '').toLowerCase().trim();
        document.querySelectorAll('.fb-comp').forEach(el => {
            const type  = el.getAttribute('data-type') || '';
            const label = (el.querySelector('span')?.textContent || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const match = !query || type.includes(query) || label.includes(query) || title.includes(query);
            el.style.display = match ? '' : 'none';
        });
        // Hide section headers that have no visible children
        document.querySelectorAll('.fb-palette-group').forEach(group => {
            const visibleComps = [...group.querySelectorAll('.fb-comp')].some(el => el.style.display !== 'none');
            group.style.display = visibleComps ? '' : 'none';
        });
    }

    /* ── PALETTE DRAG ────────────────────────────────────────── */
    function _setupPaletteDrag() {
        document.querySelectorAll('.fb-comp').forEach(el => {
            // CRITICAL: set draggable=true so the browser allows drag initiation
            el.draggable = true;

            el.addEventListener('dragstart', e => {
                paletteDragType = el.getAttribute('data-type');
                e.dataTransfer.setData('text/plain', paletteDragType);
                e.dataTransfer.effectAllowed = 'copy';
                // Ghost image: use the element itself
                setTimeout(() => el.classList.add('fb-comp-dragging'), 0);
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('fb-comp-dragging');
                paletteDragType = null;
                _clearDropState();
            });

            // Click to add at cursor position or bottom
            el.addEventListener('click', () => addField(el.getAttribute('data-type')));
        });
    }

    /* ── CANVAS DRAG EVENTS ──────────────────────────────────── */
    function onCanvasDragOver(e) {
        e.preventDefault();
        const canvas = document.getElementById('fbCanvas');

        if (paletteDragType) {
            canvas.classList.add('fb-drag-active');
            e.dataTransfer.dropEffect = 'copy';
            _trackDropPosition(e);
        } else if (reorderDragId) {
            canvas.classList.add('fb-drag-active');
            e.dataTransfer.dropEffect = 'move';
            _trackDropPosition(e);
        }
    }

    function onCanvasDragLeave(e) {
        const canvas = document.getElementById('fbCanvas');
        if (!canvas.contains(e.relatedTarget)) {
            canvas.classList.remove('fb-drag-active');
            _clearDropState();
        }
    }

    function onCanvasDrop(e) {
        e.preventDefault();
        const canvas = document.getElementById('fbCanvas');
        canvas.classList.remove('fb-drag-active');

        if (paletteDragType) {
            const type   = paletteDragType;
            const target = reorderTargetId;
            const pos    = reorderPos;
            paletteDragType = null;
            _clearDropState();
            _addFieldAtPosition(type, target, pos);
            return;
        }

        if (reorderDragId) {
            const dragId = reorderDragId;
            const target = reorderTargetId;
            const pos    = reorderPos;
            _clearDropState();
            _applyReorder(dragId, target, pos);
        }
    }

    function _trackDropPosition(e) {
        const items = [...document.querySelectorAll('.fb-field-item:not(.fb-dragging)')];
        _clearHighlight();

        const ind    = document.getElementById('fbDropIndicator');
        const canvas = document.getElementById('fbCanvas');
        const cRect  = canvas ? canvas.getBoundingClientRect() : { top: 0 };

        if (items.length === 0) {
            // No fields — drop indicator at top
            reorderTargetId = null;
            reorderPos = null;
            if (ind) { ind.style.display = 'block'; ind.style.top = '80px'; }
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const rect = item.getBoundingClientRect();
            const mid  = rect.top + rect.height / 2;

            if (e.clientY <= mid) {
                reorderTargetId = item.getAttribute('data-id');
                reorderPos = 'before';
                if (ind) {
                    ind.style.display = 'block';
                    ind.style.top = Math.max(4, rect.top - cRect.top - 2) + 'px';
                }
                return;
            }

            if (i === items.length - 1) {
                // After the last item
                reorderTargetId = item.getAttribute('data-id');
                reorderPos = 'after';
                if (ind) {
                    ind.style.display = 'block';
                    ind.style.top = (rect.bottom - cRect.top + 2) + 'px';
                }
                return;
            }
        }

        reorderTargetId = null;
        reorderPos = null;
    }

    function _clearDropState() {
        reorderTargetId = null;
        reorderPos      = null;
        _clearHighlight();
        const ind = document.getElementById('fbDropIndicator');
        if (ind) ind.style.display = 'none';
    }

    function _clearHighlight() {
        document.querySelectorAll('.fb-drag-over-top,.fb-drag-over-bottom').forEach(el => {
            el.classList.remove('fb-drag-over-top', 'fb-drag-over-bottom');
        });
    }

    function _applyReorder(dragId, targetId, pos) {
        _clearHighlight();
        if (!dragId || dragId === targetId) { reorderDragId = null; renderCanvas(); return; }

        const fromIdx = fields.findIndex(f => f.id === dragId);
        if (fromIdx === -1) { reorderDragId = null; return; }

        if (!targetId) {
            // Drop at end
            const [moved] = fields.splice(fromIdx, 1);
            fields.push(moved);
        } else {
            const toIdx = fields.findIndex(f => f.id === targetId);
            if (toIdx === -1) { reorderDragId = null; return; }
            const [moved] = fields.splice(fromIdx, 1);
            // Recalculate toIdx after splice
            const newToIdx = fields.findIndex(f => f.id === targetId);
            const insertAt = pos === 'before' ? newToIdx : newToIdx + 1;
            fields.splice(Math.max(0, Math.min(insertAt, fields.length)), 0, moved);
        }

        reorderDragId = null;
        renderCanvas();
        if (selectedId) {
            setTimeout(() => {
                const el = document.querySelector(`[data-id="${selectedId}"]`);
                if (el) el.classList.add('fb-selected');
            }, 30);
        }
    }

    /* ── FIELD CRUD ──────────────────────────────────────────── */
    function _addFieldAtPosition(type, targetId, pos) {
        const f = makeField(type);

        if (!targetId || fields.length === 0) {
            fields.push(f);
        } else {
            const toIdx = fields.findIndex(x => x.id === targetId);
            if (toIdx === -1) {
                fields.push(f);
            } else {
                const insertAt = pos === 'before' ? toIdx : toIdx + 1;
                fields.splice(insertAt, 0, f);
            }
        }

        renderCanvas();
        selectField(f.id);
        setTimeout(() => {
            const el = document.querySelector(`[data-id="${f.id}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 60);
    }

    function addField(type, targetId = null, pos = 'after') {
        _addFieldAtPosition(type, targetId, pos);
    }

    function removeField(id) {
        const idx = fields.findIndex(f => f.id === id);
        fields = fields.filter(f => f.id !== id);
        if (selectedId === id) {
            // Select adjacent field
            selectedId = fields[idx] ? fields[idx].id : (fields[idx - 1] ? fields[idx - 1].id : null);
        }
        renderCanvas();
        renderProperties();
    }

    function duplicateField(id) {
        const orig = fields.find(f => f.id === id);
        if (!orig) return;
        const copy = { ...orig, id: uid(), options: orig.options ? [...orig.options] : undefined };
        const idx  = fields.findIndex(f => f.id === id);
        fields.splice(idx + 1, 0, copy);
        renderCanvas();
        selectField(copy.id);
        toast('Field duplicated', 'success');
    }

    function moveField(id, dir) {
        const idx = fields.findIndex(f => f.id === id);
        if (idx === -1) return;
        const newIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= fields.length) return;
        [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
        renderCanvas();
        selectField(id);
    }

    function updateField(id, props) {
        const f = fields.find(x => x.id === id);
        if (!f) return;
        Object.assign(f, props);
        _rerenderFieldItem(id);
        _syncCanvasHeader();
    }

    function selectField(id) {
        selectedId = id;
        document.querySelectorAll('.fb-field-item').forEach(el => {
            el.classList.toggle('fb-selected', el.getAttribute('data-id') === id);
        });
        renderProperties();
    }

    function addDefaultFields() {
        const defaults = ['std_program','std_batch','std_name','std_phone','std_email','std_age','std_gender','std_nic','std_education','std_address','std_guardian_name','std_guardian_phone','std_notes'];
        defaults.forEach(t => {
            if (!fields.find(f => f.type === t)) fields.push(makeField(t));
        });
        renderCanvas();
        if (fields.length) selectField(fields[0].id);
        toast('Standard fields added', 'success');
    }

    /* ── RENDER CANVAS ───────────────────────────────────────── */
    function renderCanvas() {
        const empty  = document.getElementById('fbCanvasEmpty');
        const list   = document.getElementById('fbFieldList');
        const header = document.getElementById('fbCanvasHeader');
        const submit = document.getElementById('fbCanvasSubmit');
        if (!list) return;

        const hasFields = fields.length > 0;
        if (empty)  empty.style.display  = hasFields ? 'none' : '';
        if (header) header.style.display = hasFields ? '' : 'none';
        if (submit) submit.style.display = hasFields ? '' : 'none';
        _syncCanvasHeader();

        list.innerHTML = '';
        fields.forEach(f => list.appendChild(_buildFieldItem(f)));

        if (window.lucide) lucide.createIcons();

        if (selectedId) {
            const el = list.querySelector(`[data-id="${selectedId}"]`);
            if (el) el.classList.add('fb-selected');
        }
    }

    function _syncCanvasHeader() {
        const titleIn = document.getElementById('fbFormTitle');
        const descIn  = document.getElementById('fbFormDesc');
        const h = document.getElementById('fbCanvasTitle');
        const d = document.getElementById('fbCanvasDesc');
        if (h && titleIn) h.textContent = titleIn.value || 'Application Form';
        if (d && descIn)  d.textContent = descIn.value  || '';
    }

    function _buildFieldItem(f) {
        const el = document.createElement('div');
        el.className = 'fb-field-item';
        el.setAttribute('data-id', f.id);
        el.setAttribute('data-type', f.type);
        if (f.width === 'half') el.setAttribute('data-width', 'half');

        const std       = isStd(f.type);
        const chipClass = std ? 'fb-field-type-chip std' : 'fb-field-type-chip';
        const icon      = TYPE_ICONS[f.type] || 'type';
        const typeLabel = TYPE_LABELS[f.type] || f.type;

        el.innerHTML = `
            <div class="fb-field-handle" title="Drag to reorder">
                <i data-lucide="grip-vertical"></i>
            </div>
            <div class="fb-field-body">
                <div class="fb-field-meta">
                    <span class="${chipClass}">
                        <i data-lucide="${icon}"></i>${_esc(typeLabel)}
                    </span>
                    ${f.required ? '<span class="fb-req-badge">Required</span>' : ''}
                    ${f.width === 'half' ? '<span class="fb-half-badge">½ width</span>' : ''}
                </div>
                <div class="fb-field-body-preview"></div>
            </div>
            <div class="fb-field-actions">
                <button class="fb-field-act-btn" title="Move up (Ctrl+↑)"    onclick="event.stopPropagation();FB.moveField('${f.id}','up')"><i data-lucide="chevron-up"></i></button>
                <button class="fb-field-act-btn" title="Move down (Ctrl+↓)"  onclick="event.stopPropagation();FB.moveField('${f.id}','down')"><i data-lucide="chevron-down"></i></button>
                <button class="fb-field-act-btn" title="Duplicate (Ctrl+D)"  onclick="event.stopPropagation();FB.duplicateField('${f.id}')"><i data-lucide="copy"></i></button>
                <button class="fb-field-act-btn del" title="Remove (Delete)" onclick="event.stopPropagation();FB.removeField('${f.id}')"><i data-lucide="trash-2"></i></button>
            </div>`;

        el.querySelector('.fb-field-body-preview').appendChild(_buildPreviewInner(f));

        el.addEventListener('click', e => {
            if (!e.target.closest('.fb-field-act-btn') && !e.target.closest('.fb-field-handle')) {
                selectField(f.id);
            }
        });

        // Reorder drag via handle
        const handle = el.querySelector('.fb-field-handle');
        handle.draggable = true;
        handle.addEventListener('dragstart', e => {
            reorderDragId = f.id;
            e.dataTransfer.setData('text/plain', f.id);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => el.classList.add('fb-dragging'), 0);
        });
        handle.addEventListener('dragend', () => {
            el.classList.remove('fb-dragging');
            _clearDropState();
            reorderDragId = null;
        });

        return el;
    }

    function _rerenderFieldItem(id) {
        const old = document.querySelector(`[data-id="${id}"]`);
        if (!old) return;
        const f = fields.find(x => x.id === id);
        if (!f) return;
        const updated = _buildFieldItem(f);
        if (selectedId === id) updated.classList.add('fb-selected');
        old.replaceWith(updated);
        if (window.lucide) lucide.createIcons();
    }

    function _buildPreviewInner(f) {
        const wrap = document.createElement('div');
        const type = f.type;

        if (type === 'divider') {
            wrap.innerHTML = `<div class="fb-divider-prev"><div class="fb-divider-line"></div><span>Divider</span><div class="fb-divider-line"></div></div>`;
            return wrap;
        }
        if (type === 'section') {
            wrap.innerHTML = `<div class="fb-section-preview"><span class="fb-section-icon"><i data-lucide="minus-square"></i></span><div><h4>${_esc(f.label||'Section Title')}</h4>${f.placeholder ? `<p>${_esc(f.placeholder)}</p>` : ''}</div></div>`;
            return wrap;
        }
        if (type === 'description') {
            wrap.innerHTML = `<p class="fb-desc-preview">${_esc(f.placeholder||'Info text...')}</p>`;
            return wrap;
        }

        let html = `<div class="fb-field-label">${_esc(f.label||'Field')}${f.required ? ' <span style="color:#ef4444">*</span>' : ''}</div>`;

        if (type === 'radio' || type === 'checkbox') {
            const icon = type === 'radio' ? 'circle-dot' : 'check-square';
            const opts = (f.options || []).slice(0, 3);
            html += opts.map(o => `<div class="fb-opt-prev"><i data-lucide="${icon}"></i>${_esc(o)}</div>`).join('');
            if ((f.options||[]).length > 3) html += `<div class="fb-more-opts">+${f.options.length-3} more…</div>`;
        } else if (type === 'select') {
            html += `<div class="fb-ctrl-prev"><span>${_esc((f.options||['— Select —'])[0])}</span><i data-lucide="chevron-down"></i></div>`;
        } else if (type === 'rating') {
            html += `<div class="fb-stars">${'<i data-lucide="star"></i>'.repeat(5)}</div>`;
        } else if (type === 'toggle') {
            html += `<div class="fb-toggle-prev"><div class="fb-toggle-track"><div class="fb-toggle-thumb"></div></div><span>No</span></div>`;
        } else if (type === 'file') {
            html += `<div class="fb-ctrl-prev fb-file-prev"><i data-lucide="upload"></i><span>${f.accept ? f.accept : 'Choose file…'}</span></div>`;
        } else if (type === 'textarea' || type === 'std_notes' || type === 'std_address') {
            html += `<div class="fb-ctrl-prev" style="min-height:44px;align-items:flex-start;padding-top:0.5rem;">${f.placeholder ? _esc(f.placeholder) : ''}</div>`;
        } else {
            const ph = f.placeholder || _defaultPlaceholder(type);
            html += `<div class="fb-ctrl-prev">${_esc(ph)}</div>`;
        }

        if (f.helpText) html += `<div class="fb-field-help">${_esc(f.helpText)}</div>`;

        wrap.innerHTML = html;
        return wrap;
    }

    function _defaultPlaceholder(type) {
        const map = {
            std_name:'Full name', std_phone:'07X XXXXXXX', std_email:'email@example.com',
            std_age:'Age', std_nic:'NIC number', std_education:'Education level',
            std_guardian_name:'Guardian name', std_guardian_phone:'Guardian phone',
            std_program:'Select program', std_batch:'Select batch', std_gender:'Select gender',
            number:'0', text:'Type here…', email:'email@example.com', tel:'07X XXXXXXX',
        };
        return map[type] || '';
    }

    /* ── PROPERTIES PANEL ────────────────────────────────────── */
    function renderProperties() {
        const empty   = document.getElementById('fbPropsEmpty');
        const content = document.getElementById('fbPropsContent');
        if (!empty || !content) return;

        if (!selectedId) {
            empty.style.display   = '';
            content.style.display = 'none';
            return;
        }
        const f = fields.find(x => x.id === selectedId);
        if (!f) { selectedId = null; renderProperties(); return; }

        empty.style.display   = 'none';
        content.style.display = 'flex';

        const icon = document.getElementById('fbPropsTypeIcon');
        const name = document.getElementById('fbPropsTypeName');
        if (icon) icon.setAttribute('data-lucide', TYPE_ICONS[f.type] || 'type');
        if (name) name.textContent = TYPE_LABELS[f.type] || f.type;

        _buildPropsBody(f);
        if (window.lucide) lucide.createIcons();
    }

    function _buildPropsBody(f) {
        const body = document.getElementById('fbPropsBody');
        if (!body) return;
        body.innerHTML = '';

        const isLayout = ['section','divider','description'].includes(f.type);
        const std      = isStd(f.type);

        if (std) {
            const def = STD_FIELDS[f.type];
            body.appendChild(_propEl(`
                <div class="fb-std-info">
                    <i data-lucide="database"></i>
                    <div><strong>Standard field</strong> — maps to <code>${def?.dbCol || f.type}</code> in the applications table.</div>
                </div>`));
        }

        if (f.type !== 'divider') {
            body.appendChild(_propGroup('Label', `<input class="fb-prop-input" value="${_esc(f.label||'')}" placeholder="Field label…" oninput="FB.updateField('${f.id}',{label:this.value})">`));
        }

        if (!['radio','checkbox','rating','toggle','divider'].includes(f.type)) {
            const phLabel = f.type === 'section' ? 'Subtitle' : f.type === 'description' ? 'Content' : 'Placeholder';
            body.appendChild(_propGroup(phLabel, `<input class="fb-prop-input" value="${_esc(f.placeholder||'')}" placeholder="${phLabel}…" oninput="FB.updateField('${f.id}',{placeholder:this.value})">`));
        }

        if (['select','radio','checkbox'].includes(f.type)) {
            body.appendChild(_buildOptionsEditor(f));
        }

        if (f.type === 'file') {
            body.appendChild(_propGroup('Accepted Types', `<input class="fb-prop-input" value="${_esc(f.accept||'.pdf,.jpg,.png')}" placeholder=".pdf,.jpg,.png" oninput="FB.updateField('${f.id}',{accept:this.value})">`));
        }

        if (f.type === 'number') {
            body.appendChild(_propEl(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">
                ${_propGroupHTML('Min', `<input class="fb-prop-input" type="number" value="${f.min??''}" placeholder="—" oninput="FB.updateField('${f.id}',{min:this.value})">`)}
                ${_propGroupHTML('Max', `<input class="fb-prop-input" type="number" value="${f.max??''}" placeholder="—" oninput="FB.updateField('${f.id}',{max:this.value})">`)}
            </div>`));
        }

        if (!isLayout) {
            body.appendChild(_propGroup('Help Text', `<input class="fb-prop-input" value="${_esc(f.helpText||'')}" placeholder="Optional hint below the field…" oninput="FB.updateField('${f.id}',{helpText:this.value})">`));
        }

        body.appendChild(_propEl('<div class="fb-prop-divider"></div>'));

        if (!isLayout) {
            body.appendChild(_propEl(`
                <div class="fb-req-row">
                    <div>
                        <div style="font-size:0.845rem;font-weight:500;color:var(--text-main);">Required field</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Show asterisk and block submission if empty</div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${f.required?'checked':''} onchange="FB.updateField('${f.id}',{required:this.checked})">
                        <span class="toggle-track"></span>
                    </label>
                </div>`));
        }

        if (!['section','divider','description'].includes(f.type)) {
            body.appendChild(_propEl(`
                <div class="fb-prop-group">
                    <div class="fb-prop-label">Field Width</div>
                    <div class="fb-width-picker">
                        <button class="fb-width-btn ${f.width!=='half'?'selected':''}" onclick="FB.updateField('${f.id}',{width:'full'});FB.renderProperties()">
                            <i data-lucide="rectangle-horizontal"></i> Full width
                        </button>
                        <button class="fb-width-btn ${f.width==='half'?'selected':''}" onclick="FB.updateField('${f.id}',{width:'half'});FB.renderProperties()">
                            <i data-lucide="columns-2"></i> Half width
                        </button>
                    </div>
                </div>`));
        }

        if (window.lucide) lucide.createIcons();
    }

    function _buildOptionsEditor(f) {
        const wrap = document.createElement('div');
        wrap.className = 'fb-prop-group';

        const render = () => {
            wrap.innerHTML = `<div class="fb-prop-label">Options <span style="font-weight:400;font-size:0.72rem;color:var(--text-muted);">(${(f.options||[]).length})</span></div>
            <div class="fb-options-list" id="opts_${f.id}">
                ${(f.options||[]).map((opt, i) => `
                    <div class="fb-option-row">
                        <span class="fb-opt-drag-handle"><i data-lucide="grip-vertical"></i></span>
                        <input class="fb-prop-input" value="${_esc(opt)}" placeholder="Option ${i+1}"
                            oninput="FB._updateOption('${f.id}',${i},this.value)">
                        <button class="fb-option-del" onclick="FB._removeOption('${f.id}',${i})" title="Remove">
                            <i data-lucide="x"></i>
                        </button>
                    </div>`).join('')}
                <button class="fb-add-option" onclick="FB._addOption('${f.id}')">
                    <i data-lucide="plus"></i> Add option
                </button>
            </div>`;
            if (window.lucide) lucide.createIcons();
        };

        render();
        return wrap;
    }

    function _updateOption(id, idx, val) {
        const f = fields.find(x => x.id === id);
        if (f && f.options) { f.options[idx] = val; _rerenderFieldItem(id); }
    }

    function _removeOption(id, idx) {
        const f = fields.find(x => x.id === id);
        if (f && f.options && f.options.length > 1) {
            f.options.splice(idx, 1);
            _rerenderFieldItem(id);
            renderProperties();
        }
    }

    function _addOption(id) {
        const f = fields.find(x => x.id === id);
        if (f) {
            if (!f.options) f.options = [];
            f.options.push('Option ' + (f.options.length + 1));
            _rerenderFieldItem(id);
            renderProperties();
        }
    }

    function _propGroup(label, inputHTML) {
        const wrap = document.createElement('div');
        wrap.className = 'fb-prop-group';
        wrap.innerHTML = `<div class="fb-prop-label">${label}</div>${inputHTML}`;
        return wrap;
    }

    function _propGroupHTML(label, inputHTML) {
        return `<div class="fb-prop-group"><div class="fb-prop-label">${label}</div>${inputHTML}</div>`;
    }

    function _propEl(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.firstElementChild;
    }

    /* ── MODE ────────────────────────────────────────────────── */
    function setMode(m) {
        const ws = document.getElementById('fbWorkspace');
        const pv = document.getElementById('fbPreviewWrap');
        const bb = document.getElementById('fbBtnBuilder');
        const pb = document.getElementById('fbBtnPreview');

        if (m === 'preview') {
            if (ws) ws.style.display = 'none';
            if (pv) pv.style.display = '';
            bb?.classList.remove('fb-mode-active');
            pb?.classList.add('fb-mode-active');
            renderPreview();
        } else {
            if (ws) ws.style.display = '';
            if (pv) pv.style.display = 'none';
            bb?.classList.add('fb-mode-active');
            pb?.classList.remove('fb-mode-active');
        }
        if (window.lucide) lucide.createIcons();
    }

    function renderPreview() {
        const titleIn = document.getElementById('fbFormTitle');
        const descIn  = document.getElementById('fbFormDesc');
        const container = document.getElementById('fbPreviewFields');
        const titleEl   = document.getElementById('fbPreviewTitle');
        const descEl    = document.getElementById('fbPreviewDesc');

        if (titleEl) titleEl.textContent = titleIn?.value || 'Application Form';
        if (descEl)  descEl.textContent  = descIn?.value  || '';
        if (!container) return;

        container.innerHTML = '';

        let i = 0;
        while (i < fields.length) {
            const f = fields[i];
            if (f.width === 'half' && i + 1 < fields.length && fields[i+1].width === 'half') {
                const row = document.createElement('div');
                row.className = 'fb-pv-row-2';
                row.appendChild(_buildPreviewField(f));
                row.appendChild(_buildPreviewField(fields[i+1]));
                container.appendChild(row);
                i += 2;
            } else {
                container.appendChild(_buildPreviewField(f));
                i++;
            }
        }
        if (window.lucide) lucide.createIcons();
    }

    function _buildPreviewField(f) {
        const wrap = document.createElement('div');
        const type = f.type;
        const req  = f.required ? '<span class="req">*</span>' : '';
        const help = f.helpText ? `<div class="fb-pv-help">${_esc(f.helpText)}</div>` : '';

        if (type === 'divider')     { wrap.innerHTML = '<div class="fb-pv-divider"></div>'; return wrap; }
        if (type === 'description') { wrap.innerHTML = `<div class="fb-pv-description">${_esc(f.placeholder||f.label||'')}</div>`; return wrap; }
        if (type === 'section') {
            wrap.innerHTML = `<div class="fb-pv-section-header"><h3>${_esc(f.label||'')}</h3>${f.placeholder?`<p>${_esc(f.placeholder)}</p>`:''}</div>`;
            return wrap;
        }

        const labelHTML = `<div class="fb-pv-label">${_esc(f.label||'Field')}${req}</div>`;

        if (type === 'textarea' || type === 'std_notes' || type === 'std_address') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<textarea class="fb-pv-textarea" placeholder="${_esc(f.placeholder||'')}"></textarea>${help}</div>`;
        } else if (['select','std_program','std_batch','std_gender','std_education'].includes(type)) {
            const opts = type.startsWith('std_') ? _getStdOptions(type) : (f.options||[]);
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<select class="fb-pv-select"><option value="">— Select —</option>${opts.map(o=>`<option>${_esc(o)}</option>`).join('')}</select>${help}</div>`;
        } else if (type === 'radio') {
            const optsHTML = (f.options||[]).map(o=>`<label class="fb-pv-radio-opt"><input type="radio" name="pv_${f.id}"> ${_esc(o)}</label>`).join('');
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<div class="fb-pv-radio-group">${optsHTML}</div>${help}</div>`;
        } else if (type === 'checkbox') {
            const optsHTML = (f.options||[]).map(o=>`<label class="fb-pv-check-opt"><input type="checkbox"> ${_esc(o)}</label>`).join('');
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<div class="fb-pv-check-group">${optsHTML}</div>${help}</div>`;
        } else if (type === 'toggle') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<label class="fb-pv-toggle-row"><span>${_esc(f.label||'')}</span><label class="toggle-switch"><input type="checkbox"><span class="toggle-track"></span></label></label>${help}</div>`;
        } else if (type === 'rating') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<div class="fb-pv-stars">${'<i data-lucide="star"></i>'.repeat(5)}</div>${help}</div>`;
        } else if (type === 'file') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<input type="file" class="fb-pv-input" accept="${_esc(f.accept||'')}">${help}</div>`;
        } else if (type === 'date') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<input type="date" class="fb-pv-input">${help}</div>`;
        } else if (type === 'number' || type === 'std_age') {
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<input type="number" class="fb-pv-input" placeholder="${_esc(f.placeholder||'')}" ${f.min?`min="${f.min}"`:''} ${f.max?`max="${f.max}"`:''}>${help}</div>`;
        } else {
            const inputType = type === 'std_email' ? 'email' : (type === 'std_phone'||type==='std_guardian_phone' ? 'tel' : 'text');
            const ph = f.placeholder || _defaultPlaceholder(type);
            wrap.innerHTML = `<div class="fb-pv-group">${labelHTML}<input type="${inputType}" class="fb-pv-input" placeholder="${_esc(ph)}">${help}</div>`;
        }
        return wrap;
    }

    function _getStdOptions(type) {
        const map = {
            std_gender:    ['Male','Female','Other'],
            std_education: ['Primary','Secondary (O/L)','Advanced (A/L)','Diploma','Degree','Postgraduate','None'],
            std_program:   ['— Loading programs —'],
            std_batch:     ['— Loading batches —'],
        };
        return map[type] || [];
    }

    /* ── CLEAR ───────────────────────────────────────────────── */
    function clearCanvas() {
        if (fields.length === 0) { toast('Canvas is already empty', 'info'); return; }
        if (!confirm('Clear all fields? This cannot be undone.')) return;
        fields = [];
        selectedId = null;
        renderCanvas();
        renderProperties();
        toast('Canvas cleared', 'info');
    }

    /* ── SAVE TEMPLATE DIALOG ────────────────────────────────── */
    function openSaveDialog() {
        if (fields.length === 0) { toast('Add at least one field before saving', 'error'); return; }
        const overlay = document.getElementById('fbSaveOverlay');
        const nameEl  = document.getElementById('fbSaveName');
        if (overlay) overlay.style.display = 'flex';
        if (nameEl)  { nameEl.value = ''; setTimeout(() => nameEl.focus(), 100); }
    }

    function closeSaveDialog() {
        const overlay = document.getElementById('fbSaveOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    async function confirmSave() {
        const nameEl  = document.getElementById('fbSaveName');
        const defEl   = document.getElementById('fbSaveAsDefault');
        const titleIn = document.getElementById('fbFormTitle');
        const descIn  = document.getElementById('fbFormDesc');

        const name = nameEl?.value?.trim();
        if (!name) { nameEl?.focus(); toast('Please enter a template name', 'error'); return; }

        const structure = JSON.stringify({
            title:       titleIn?.value || 'Application Form',
            description: descIn?.value  || '',
            fields,
        });

        try {
            const res = await fetch('/api/forms/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, structure, is_default: defEl?.checked ? 1 : 0 })
            });
            if (res.ok) {
                toast('Template saved: ' + name, 'success');
                closeSaveDialog();
                fetchTemplates();
            } else {
                const d = await res.json();
                toast(d.message || 'Save failed', 'error');
            }
        } catch(e) { toast('Network error', 'error'); }
    }

    /* ── TEMPLATES ───────────────────────────────────────────── */
    async function fetchTemplates() {
        try {
            const res = await fetch('/api/forms/templates');
            if (!res.ok) return;
            templates = await res.json();
            renderTemplates();
        } catch(e) { console.error('Templates fetch failed', e); }
    }

    function renderTemplates() {
        const container = document.getElementById('fbTemplateList');
        if (!container) return;

        if (!templates.length) {
            container.innerHTML = `
                <div class="fb-no-tpl">
                    <i data-lucide="folder-open"></i>
                    <p>No templates saved yet.<br>Build a form and click <strong>Save Template</strong>.</p>
                </div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = templates.map(t => `
            <div class="fb-tpl-card ${t.is_default ? 'is-default' : ''}" title="Click to load">
                <div class="fb-tpl-card-body" onclick="FB.loadTemplate(${t.id})">
                    <div class="fb-tpl-card-icon">
                        <i data-lucide="file-text"></i>
                    </div>
                    <div class="fb-tpl-card-info">
                        <div class="fb-tpl-card-name">${_esc(t.name)}</div>
                        <div class="fb-tpl-card-meta">
                            ${_getTemplateFieldCount(t)} fields
                            ${t.is_default ? ' · <span style="color:#10b981;font-weight:600;">Default</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="fb-tpl-card-actions">
                    <button class="fb-tpl-btn ${t.is_default ? 'is-default' : ''}" title="${t.is_default ? 'Current default' : 'Set as default'}" onclick="FB.setDefaultTemplate(${t.id})">
                        <i data-lucide="star"></i>
                    </button>
                    <button class="fb-tpl-btn del" title="Delete template" onclick="FB.deleteTemplate(${t.id})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>`).join('');

        if (window.lucide) lucide.createIcons();
    }

    function _getTemplateFieldCount(t) {
        try {
            const data = JSON.parse(t.structure);
            return (data.fields || []).length;
        } catch { return '?'; }
    }

    async function loadTemplate(id) {
        const tpl = templates.find(t => t.id === id);
        if (!tpl) return;
        if (fields.length > 0 && !confirm('Load template? This will replace your current design.')) return;

        try {
            const data = JSON.parse(tpl.structure);
            fields = data.fields || [];
            selectedId = null;

            const titleIn = document.getElementById('fbFormTitle');
            const descIn  = document.getElementById('fbFormDesc');
            if (titleIn && data.title)       titleIn.value = data.title;
            if (descIn  && data.description) descIn.value  = data.description;
            _syncCanvasHeader();

            renderCanvas();
            renderProperties();
            toast('Template loaded: ' + tpl.name, 'success');
        } catch(e) { toast('Failed to load template', 'error'); }
    }

    async function setDefaultTemplate(id) {
        try {
            const res = await fetch(`/api/forms/templates/${id}/default`, { method:'PATCH' });
            if (res.ok) { toast('Default template set', 'success'); fetchTemplates(); }
        } catch(e) { toast('Failed', 'error'); }
    }

    async function deleteTemplate(id) {
        if (!confirm('Delete this template?')) return;
        try {
            const res = await fetch(`/api/forms/templates/${id}`, { method:'DELETE' });
            if (res.ok) { toast('Template deleted', 'info'); fetchTemplates(); }
        } catch(e) { toast('Failed', 'error'); }
    }

    /* ── PUBLIC API ──────────────────────────────────────────── */
    return {
        get selectedId() { return selectedId; },
        get fields()     { return fields; },

        init, addField, removeField, duplicateField, moveField, updateField,
        selectField, renderCanvas, renderProperties, renderPreview,
        setMode, clearCanvas, filterPalette,
        openSaveDialog, closeSaveDialog, confirmSave,
        fetchTemplates, loadTemplate, setDefaultTemplate, deleteTemplate,
        addDefaultFields,
        onCanvasDragOver, onCanvasDragLeave, onCanvasDrop,

        _updateOption, _removeOption, _addOption,
    };
})();

/* ── Global shims ── */
window.clearCanvas       = () => FB.clearCanvas();
window.saveCustomization = () => FB.openSaveDialog();

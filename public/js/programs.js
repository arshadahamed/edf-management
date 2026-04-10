/* ════════════════════════════════════════════════
   Educational Programs Management — programs.js
   Full CRUD: Programs + Batches + Applications
   ════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────
let programsState = {
    programs: [],
    batches: [],       // for current program
    applications: [],
    filter: { category: 'all', audience: 'all', status: 'all', search: '' },
    editingProgramId: null,
    editingBatchId: null,
    editingAppId: null,
    viewingProgramId: null,
};

// ─── Category / Audience helpers ────────────────────
const CATEGORIES = {
    quran:  { label: 'Quran Studies',    icon: 'book-open',          color: '#8b5cf6' },
    skills: { label: 'Vocational Skills', icon: 'wrench',             color: '#f59e0b' },
    bayan:  { label: 'Islamic Lectures', icon: 'mic-2',              color: '#3b82f6' },
    health: { label: 'Health & Wellness', icon: 'heart-pulse',        color: '#ef4444' },
    tech:   { label: 'Technology',       icon: 'cpu',                color: '#06b6d4' },
    other:  { label: 'Other',            icon: 'folder',             color: '#6b7280' },
};

const AUDIENCES = {
    men:      { label: 'Men',      color: '#3b82f6' },
    women:    { label: 'Women',    color: '#ec4899' },
    children: { label: 'Children', color: '#f59e0b' },
    all:      { label: 'All',      color: '#10b981' },
};

const STATUS_COLORS = {
    active:    { bg: '#d1fae5', text: '#065f46' },
    inactive:  { bg: '#f3f4f6', text: '#6b7280' },
    completed: { bg: '#dbeafe', text: '#1e40af' },
    pending:   { bg: '#fef3c7', text: '#92400e' },
    approved:  { bg: '#d1fae5', text: '#065f46' },
    rejected:  { bg: '#fee2e2', text: '#991b1b' },
    enrolled:  { bg: '#dbeafe', text: '#1e40af' },
};

function statusBadge(status) {
    const s = STATUS_COLORS[status] || { bg: '#f3f4f6', text: '#6b7280' };
    return `<span style="padding:0.25rem 0.6rem; border-radius:20px; font-size:0.7rem; font-weight:700;
            background:${s.bg}; color:${s.text}; text-transform:capitalize;">${status}</span>`;
}

function catBadge(cat) {
    const c = CATEGORIES[cat] || CATEGORIES.other;
    return `<span style="padding:0.2rem 0.55rem; border-radius:20px; font-size:0.68rem; font-weight:600;
            background:${c.color}22; color:${c.color}; border:1px solid ${c.color}44;">${c.label}</span>`;
}

function audBadge(aud) {
    const a = AUDIENCES[aud] || AUDIENCES.all;
    return `<span style="padding:0.2rem 0.55rem; border-radius:20px; font-size:0.68rem; font-weight:600;
            background:${a.color}18; color:${a.color}; border:1px solid ${a.color}44;">${a.label}</span>`;
}

// ─── Toast notification ──────────────────────────────
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
        background:var(--bg-main);border:1px solid var(--border-color);border-left:4px solid ${color};
        padding:0.875rem 1.25rem;border-radius:12px;box-shadow:var(--shadow-lg);
        font-size:0.85rem;font-weight:500;color:var(--text-main);
        animation:fadeIn 0.3s ease;max-width:320px;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ══════════════════════════════════════════════════════
//   FETCH & RENDER PROGRAMS
// ══════════════════════════════════════════════════════
async function fetchPrograms() {
    try {
        renderProgramsLoading();
        const [progRes, statsRes] = await Promise.all([
            fetch('/api/programs/programs'),
            fetch('/api/programs/programs-stats'),
        ]);
        programsState.programs = await progRes.json();
        const stats = await statsRes.json();
        renderProgramStats(stats);
        renderProgramCards();
    } catch (err) {
        console.error(err);
        document.getElementById('programsGrid').innerHTML =
            '<p style="color:var(--text-muted);text-align:center;padding:3rem">Failed to load programs.</p>';
    }
}

function renderProgramStats(stats) {
    document.getElementById('ps-total').textContent     = stats.totalPrograms;
    document.getElementById('ps-active').textContent    = stats.activePrograms;
    document.getElementById('ps-batches').textContent   = stats.totalBatches;
    document.getElementById('ps-applicants').textContent = stats.totalApplicants;
    document.getElementById('ps-pending').textContent   = stats.pendingApplications;
    document.getElementById('ps-approved').textContent  = stats.approvedApplications;
}

function renderProgramsLoading() {
    const grid = document.getElementById('programsGrid');
    grid.innerHTML = Array(4).fill(0).map(() => `
        <div style="background:var(--bg-card);border:1px solid var(--border-color);
             border-radius:20px;padding:1.5rem;animation:pulse 1.5s ease infinite;">
            <div style="height:14px;background:var(--border-color);border-radius:8px;width:60%;margin-bottom:1rem;"></div>
            <div style="height:10px;background:var(--border-color);border-radius:8px;width:40%;margin-bottom:0.5rem;"></div>
            <div style="height:10px;background:var(--border-color);border-radius:8px;width:80%;"></div>
        </div>
    `).join('');
}

function getFilteredPrograms() {
    const { category, audience, status, search } = programsState.filter;
    return programsState.programs.filter(p => {
        if (category !== 'all' && p.category !== category) return false;
        if (audience !== 'all' && p.target_audience !== audience) return false;
        if (status !== 'all' && p.status !== status) return false;
        if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });
}

function renderProgramCards() {
    const grid = document.getElementById('programsGrid');
    const programs = getFilteredPrograms();

    if (!programs.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-muted);">
                <i data-lucide="folder-open" style="width:48px;height:48px;margin-bottom:1rem;opacity:0.3;display:block;margin-inline:auto;"></i>
                <p style="font-size:1rem;font-weight:500;">No programs found</p>
                <p style="font-size:0.85rem;margin-top:0.25rem;">Try adjusting filters or create a new program.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = programs.map(p => {
        const cat = CATEGORIES[p.category] || CATEGORIES.other;
        const aud = AUDIENCES[p.target_audience] || AUDIENCES.all;
        const sc  = STATUS_COLORS[p.status] || { bg: '#f3f4f6', text: '#6b7280' };
        const fill = p.max_capacity > 0
            ? Math.min(100, Math.round((p.enrolled_count / p.max_capacity) * 100))
            : 0;
        const progressColor = fill > 80 ? '#ef4444' : fill > 50 ? '#f59e0b' : '#10b981';

        return `
        <div class="program-card" onclick="viewProgram(${p.id})" style="cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:0.5rem;">
                <div style="width:42px;height:42px;border-radius:12px;background:${cat.color}18;
                     display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid ${cat.color}33;">
                    <i data-lucide="${cat.icon}" style="width:20px;height:20px;color:${cat.color};"></i>
                </div>
                <span style="padding:0.2rem 0.6rem;border-radius:20px;font-size:0.68rem;font-weight:700;
                      background:${sc.bg};color:${sc.text};text-transform:capitalize;">${p.status}</span>
            </div>

            <h3 style="font-size:0.95rem;font-weight:700;color:var(--text-main);margin-bottom:0.375rem;
                       line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                       -webkit-line-clamp:2;-webkit-box-orient:vertical;">${p.title}</h3>

            <p style="font-size:0.775rem;color:var(--text-muted);margin-bottom:0.875rem;
                      overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                      -webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;">
                ${p.description || 'No description provided.'}
            </p>

            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.875rem;">
                ${catBadge(p.category)}
                ${audBadge(p.target_audience)}
                ${p.duration_weeks ? `<span style="padding:0.2rem 0.55rem;border-radius:20px;font-size:0.68rem;font-weight:600;background:var(--border-color);color:var(--text-muted);">${p.duration_weeks}w</span>` : ''}
                ${p.form_template_id ? `<span style="padding:0.2rem 0.55rem;border-radius:20px;font-size:0.68rem;font-weight:600;background:rgba(99,102,241,0.08);color:#6366f1;border:1px solid rgba(99,102,241,0.2);" title="Custom application form linked"><i data-lucide="file-text" style="width:10px;height:10px;vertical-align:middle;margin-right:2px;"></i>Form</span>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;
                        padding:0.75rem;background:var(--input-bg);border-radius:12px;">
                <div>
                    <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Batches</div>
                    <div style="font-size:1.1rem;font-weight:700;color:var(--text-main);">${p.batch_count || 0}</div>
                </div>
                <div>
                    <div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Applicants</div>
                    <div style="font-size:1.1rem;font-weight:700;color:var(--text-main);">${p.applicant_count || 0}</div>
                </div>
            </div>

            <div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-bottom:0.3rem;">
                    <span>Enrolled</span>
                    <span style="font-weight:600;">${p.enrolled_count || 0} / ${p.max_capacity || '∞'}</span>
                </div>
                <div style="height:5px;background:var(--border-color);border-radius:10px;overflow:hidden;">
                    <div style="height:100%;width:${fill}%;background:${progressColor};border-radius:10px;transition:width 0.5s ease;"></div>
                </div>
            </div>

            <div style="display:flex;gap:0.5rem;border-top:1px solid var(--border-color);padding-top:0.875rem;">
                <button class="prog-btn prog-btn-ghost" onclick="event.stopPropagation();viewProgram(${p.id})" title="View Details">
                    <i data-lucide="eye" style="width:14px;"></i> View
                </button>
                <button class="prog-btn prog-btn-ghost" onclick="event.stopPropagation();openEditProgramModal(${p.id})" title="Edit">
                    <i data-lucide="edit-2" style="width:14px;"></i> Edit
                </button>
                <button class="prog-btn prog-btn-danger" onclick="event.stopPropagation();deleteProgram(${p.id})" title="Delete">
                    <i data-lucide="trash-2" style="width:14px;"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

// ══════════════════════════════════════════════════════
//   VIEW PROGRAM (detail panel)
// ══════════════════════════════════════════════════════
async function viewProgram(id) {
    programsState.viewingProgramId = id;
    try {
        const res = await fetch(`/api/programs/programs/${id}`);
        const p = await res.json();
        renderProgramDetail(p);
        openModal('programDetailModal');
        lucide.createIcons();
    } catch (err) { console.error(err); toast('Failed to load program details', 'error'); }
}

function renderProgramDetail(p) {
    const cat = CATEGORIES[p.category] || CATEGORIES.other;
    const aud = AUDIENCES[p.target_audience] || AUDIENCES.all;

    document.getElementById('pdTitle').textContent = p.title;
    document.getElementById('pdMeta').innerHTML = `${catBadge(p.category)} ${audBadge(p.target_audience)} ${statusBadge(p.status)}`;
    document.getElementById('pdDescription').textContent = p.description || 'No description.';
    document.getElementById('pdLocation').textContent = p.location || '—';
    document.getElementById('pdDuration').textContent = p.duration_weeks ? `${p.duration_weeks} weeks` : '—';
    document.getElementById('pdFee').textContent = p.fee > 0 ? `LKR ${Number(p.fee).toLocaleString()}` : 'Free';
    document.getElementById('pdCapacity').textContent = p.max_capacity || '—';

    // Batches table
    const batchBody = document.getElementById('pdBatchesBody');
    batchBody.innerHTML = (p.batches || []).map(b => {
        const fill = b.max_seats > 0 ? Math.min(100, Math.round((b.applicant_count / b.max_seats) * 100)) : 0;
        const color = fill > 95 ? '#ef4444' : fill > 75 ? '#f59e0b' : '#10b981';
        return `
        <tr>
            <td style="font-weight:600">${b.batch_name}</td>
            <td>${b.instructor_name || '—'}</td>
            <td style="font-size:0.8rem;">${b.start_date || '—'}</td>
            <td>
                <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted); margin-bottom:0.2rem;">
                    <span>${b.applicant_count || 0} / ${b.max_seats || 30}</span>
                </div>
                <div style="height:4px; width:80px; background:var(--border-color); border-radius:10px; overflow:hidden;">
                    <div style="height:100%; width:${fill}%; background:${color};"></div>
                </div>
            </td>
            <td>${statusBadge(b.status)}</td>
            <td style="text-align:right;">
                <button class="prog-btn prog-btn-ghost" onclick="openEditBatchModal(${b.id}, ${p.id})" style="padding:0.25rem 0.55rem;">
                    <i data-lucide="edit-2" style="width:13px;"></i>
                </button>
                <button class="prog-btn prog-btn-danger" onclick="deleteBatch(${b.id}, ${p.id})" style="padding:0.25rem 0.55rem;">
                    <i data-lucide="trash-2" style="width:13px;"></i>
                </button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No batches yet</td></tr>`;

    // Load applications for this program
    loadProgramApplications(p.id, p.batches || []);
    lucide.createIcons();
}

async function loadProgramApplications(programId, batches) {
    try {
        const res = await fetch(`/api/programs/programs/${programId}/applications`);
        const apps = await res.json();
        const body = document.getElementById('pdAppsBody');
        body.innerHTML = apps.map(a => `
            <tr>
                <td style="font-weight:600;">${a.applicant_name}</td>
                <td>${a.applicant_phone || '—'}</td>
                <td>${a.applicant_gender || '—'}</td>
                <td>${a.batch_name || '<em style="color:var(--text-muted)">Not assigned</em>'}</td>
                <td>${a.education_level || '—'}</td>
                <td>${statusBadge(a.status)}</td>
                <td>
                    <div style="display:flex;gap:0.25rem;">
                        <button class="prog-btn prog-btn-ghost" style="padding:0.2rem 0.4rem;font-size:0.7rem;" onclick="changeAppStatus(${a.id}, 'approved', ${programId})">✓</button>
                        <button class="prog-btn" style="padding:0.2rem 0.4rem;font-size:0.7rem;background:#fef3c7;color:#92400e;" onclick="changeAppStatus(${a.id}, 'pending', ${programId})">⏳</button>
                        <button class="prog-btn prog-btn-danger" style="padding:0.2rem 0.4rem;font-size:0.7rem;" onclick="changeAppStatus(${a.id}, 'rejected', ${programId})">✗</button>
                        <button class="prog-btn prog-btn-ghost" style="padding:0.2rem 0.4rem;font-size:0.7rem;" onclick="openEditAppModal(${a.id})"><i data-lucide="edit-2" style="width:12px;"></i></button>
                        <button class="prog-btn prog-btn-danger" style="padding:0.2rem 0.4rem;font-size:0.7rem;" onclick="deleteApplication(${a.id}, ${programId})"><i data-lucide="trash-2" style="width:12px;"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No applications yet</td></tr>`;

        // Store apps state + populate batch select in app modal
        programsState.applications = apps;
        programsState.viewingProgramId = programId;
        populateAppBatchSelect(programId, batches);
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

async function changeAppStatus(appId, status, programId) {
    try {
        await fetch(`/api/programs/applications/${appId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        toast(`Application marked as ${status}`);
        loadProgramApplications(programId, []);
        fetchPrograms();
    } catch (err) { toast('Failed to update status', 'error'); }
}

// ══════════════════════════════════════════════════════
//   PROGRAM CRUD MODALS
// ══════════════════════════════════════════════════════
async function populateCourseTemplateSelect(selectedId = null) {
    const sel = document.getElementById('courseTemplateSelect');
    if (!sel) return;
    try {
        const res = await fetch('/api/forms/templates');
        const templates = await res.json();
        sel.innerHTML = '<option value="">— Use Default Form —</option>' +
            templates.map(t => `<option value="${t.id}" ${t.id == selectedId ? 'selected' : ''}>${t.name} ${t.is_default ? '(Default)' : ''}</option>`).join('');
    } catch (err) { console.error('Failed to load templates', err); }
}

function openCreateProgramModal() {
    programsState.editingProgramId = null;
    document.getElementById('programModalTitle').textContent = 'Create New Program';
    document.getElementById('programForm').reset();
    populateCourseTemplateSelect();
    openModal('programModal');
    lucide.createIcons();
}

async function openEditProgramModal(id) {
    try {
        const p = programsState.programs.find(x => x.id === id);
        if (!p) return;
        programsState.editingProgramId = id;
        document.getElementById('programModalTitle').textContent = 'Edit Program';
        const form = document.getElementById('programForm');
        form.reset();
        ['title','category','target_audience','description','status','max_capacity','fee','location','duration_weeks','form_template_id']
            .forEach(k => { if (form.elements[k]) form.elements[k].value = p[k] || ''; });
        populateCourseTemplateSelect(p.form_template_id);
        openModal('programModal');
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

document.getElementById('programForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = programsState.editingProgramId;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/programs/programs/${id}` : '/api/programs/programs';
    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw await res.json();
        closeModal('programModal');
        toast(id ? 'Program updated!' : 'Program created!');
        fetchPrograms();
    } catch (err) { toast(err.message || 'Failed to save', 'error'); }
});

async function deleteProgram(id) {
    if (!confirm('Are you sure you want to delete this PROGRAM? This will also delete all its batches and applications.')) return;
    try {
        console.log('Attempting to delete Program ID:', id);
        const res = await fetch(`/api/programs/programs/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned ${res.status}`);
        }
        toast('Program deleted');
        fetchPrograms();
        if (window.fetchStats) window.fetchStats();
    } catch (err) { 
        console.error('Delete Program Error:', err);
        toast('Delete failed: ' + err.message, 'error'); 
    }
}

// ══════════════════════════════════════════════════════
//   BATCH CRUD MODALS
// ══════════════════════════════════════════════════════
function openAddBatchModal(programId) {
    programsState.editingBatchId = null;
    programsState.viewingProgramId = programId;
    document.getElementById('batchModalTitle').textContent = 'Add Batch';
    document.getElementById('batchForm').reset();
    openModal('batchModal');
}

async function openEditBatchModal(batchId, programId) {
    try {
        const res = await fetch(`/api/programs/programs/${programId}/batches`);
        const batches = await res.json();
        const b = batches.find(x => x.id === batchId);
        if (!b) return;
        programsState.editingBatchId = batchId;
        programsState.viewingProgramId = programId;
        document.getElementById('batchModalTitle').textContent = 'Edit Batch';
        const form = document.getElementById('batchForm');
        form.reset();
        ['batch_name','start_date','end_date','instructor_name','status','max_seats','location']
            .forEach(k => { if (form.elements[k]) form.elements[k].value = b[k] || ''; });
        openModal('batchModal');
    } catch (err) { console.error(err); }
}

document.getElementById('batchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const batchId = programsState.editingBatchId;
    const programId = programsState.viewingProgramId;
    const method = batchId ? 'PUT' : 'POST';
    const url = batchId ? `/api/programs/batches/${batchId}` : `/api/programs/programs/${programId}/batches`;
    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw await res.json();
        closeModal('batchModal');
        toast(batchId ? 'Batch updated!' : 'Batch created!');
        viewProgram(programId);
    } catch (err) { toast(err.message || 'Failed', 'error'); }
});

async function deleteBatch(batchId, programId) {
    if (!confirm('Are you sure you want to delete this BATCH? Applicants will be unlinked.')) return;
    try {
        console.log('Attempting to delete Batch ID:', batchId);
        const res = await fetch(`/api/programs/batches/${batchId}`, { method: 'DELETE' });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned ${res.status}`);
        }
        toast('Batch deleted');
        viewProgram(programId);
        fetchPrograms();
        if (window.fetchStats) window.fetchStats();
    } catch (err) { 
        console.error('Delete Batch Error:', err);
        toast('Failed to delete batch: ' + err.message, 'error'); 
    }
}

// ══════════════════════════════════════════════════════
//   APPLICATION CRUD MODALS
// ══════════════════════════════════════════════════════
function populateAppBatchSelect(programId, batches) {
    const sel = document.getElementById('appBatchSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— No specific batch —</option>' +
        batches.map(b => `<option value="${b.id}">${b.batch_name}</option>`).join('');
}

function populateAppProgramSelect() {
    const sel = document.getElementById('appProgramSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Program *</option>' +
        programsState.programs.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
    sel.onchange = async function() {
        const pid = this.value;
        if (!pid) { 
            document.getElementById('appBatchSelect').innerHTML = '<option value="">— Select program first —</option>'; 
            document.getElementById('dynamicFormContainer').style.display = 'none';
            return; 
        }
        const res = await fetch(`/api/programs/programs/${pid}/batches`);
        const batches = await res.json();
        populateAppBatchSelect(pid, batches);
        renderDynamicForm(pid);
    };
}

async function renderDynamicForm(programId) {
    const container = document.getElementById('dynamicFormContainer');
    const content   = document.getElementById('customFormContent');
    if (!container || !content) return;

    container.style.display = 'none';
    content.innerHTML = '';

    try {
        const res = await fetch('/api/forms/templates');
        const templates = await res.json();
        if (!templates.length) return;

        const p = programsState.programs.find(x => x.id == programId);
        // Use program's assigned template, else the default, else the first
        const tpl = (p && p.form_template_id && templates.find(t => t.id == p.form_template_id))
                 || templates.find(t => t.is_default)
                 || templates[0];
        if (!tpl) return;

        const data = JSON.parse(tpl.structure);
        const fields = data.fields || [];

        // Only render CUSTOM fields — std_ fields are already in the static form
        const customFields = fields.filter(f => !f.type.startsWith('std_')
            && !['section','divider','description'].includes(f.type));
        const layoutFields = fields.filter(f => ['section','divider','description'].includes(f.type));

        // Merge layouts + custom fields in original order
        const toRender = fields.filter(f => !f.type.startsWith('std_'));
        if (!toRender.length) return;

        container.style.display = 'block';

        // Show which template is being used
        content.innerHTML = `
            <div style="margin-bottom:1rem;padding:0.5rem 0.75rem;background:var(--glow-bg);border:1px solid var(--border-color);
                 border-radius:8px;font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:0.5rem;">
                <i data-lucide="file-text" style="width:13px;height:13px;"></i>
                Custom fields from template: <strong style="color:var(--text-main);">${_escHtml(tpl.name)}</strong>
            </div>
            <div class="form-grid" id="customFieldsGrid"></div>`;

        const grid = content.querySelector('#customFieldsGrid');
        let i = 0;
        while (i < toRender.length) {
            const f = toRender[i];

            // Layout elements span full width
            if (f.type === 'section') {
                const el = document.createElement('div');
                el.style.cssText = 'grid-column:span 2;border-bottom:2px solid var(--border-color);padding-bottom:0.5rem;margin:0.5rem 0;';
                el.innerHTML = `<h4 style="font-size:0.925rem;font-weight:700;color:var(--text-main);margin:0;">${_escHtml(f.label||'')}</h4>
                    ${f.placeholder ? `<p style="font-size:0.8rem;color:var(--text-muted);margin:0.2rem 0 0;">${_escHtml(f.placeholder)}</p>` : ''}`;
                grid.appendChild(el);
                i++; continue;
            }
            if (f.type === 'divider') {
                const el = document.createElement('div');
                el.style.cssText = 'grid-column:span 2;height:1px;background:var(--border-color);margin:0.25rem 0;';
                grid.appendChild(el);
                i++; continue;
            }
            if (f.type === 'description') {
                const el = document.createElement('div');
                el.style.cssText = 'grid-column:span 2;';
                el.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted);background:var(--input-bg);
                    border-left:3px solid var(--border-color);padding:0.5rem 0.75rem;border-radius:0 8px 8px 0;margin:0;">
                    ${_escHtml(f.placeholder||f.label||'')}</p>`;
                grid.appendChild(el);
                i++; continue;
            }

            // Pair up half-width fields
            const isHalf  = f.width === 'half';
            const nextF   = toRender[i+1];
            const nextHalf = nextF && nextF.width === 'half' && !['section','divider','description'].includes(nextF.type);

            const span = (!isHalf || !nextHalf) ? 'span 2' : '';
            const wrap = document.createElement('div');
            wrap.className = 'form-group c-group';
            wrap.style.gridColumn = span;
            wrap.innerHTML = _buildCustomFieldHtml(f);
            grid.appendChild(wrap);
            i++;

            if (isHalf && nextHalf) {
                const wrap2 = document.createElement('div');
                wrap2.className = 'form-group c-group';
                wrap2.innerHTML = _buildCustomFieldHtml(nextF);
                grid.appendChild(wrap2);
                i++;
            }
        }

        if (window.lucide) lucide.createIcons();
    } catch (err) { console.error('renderDynamicForm error:', err); }
}

function _escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _buildCustomFieldHtml(f) {
    const req  = f.required ? '<span style="color:#ef4444;">*</span>' : '';
    const help = f.helpText ? `<small style="font-size:0.72rem;color:var(--text-muted);font-style:italic;">${_escHtml(f.helpText)}</small>` : '';
    const name = `custom_${f.id}`;
    const label = `<label class="form-label">${_escHtml(f.label||'Field')} ${req}</label>`;
    const reqAttr = f.required ? 'required' : '';
    const phAttr = f.placeholder ? `placeholder="${_escHtml(f.placeholder)}"` : '';

    if (f.type === 'textarea') {
        return `${label}<textarea name="${name}" class="form-input" rows="3" style="border-radius:12px;resize:vertical;" ${phAttr} ${reqAttr}></textarea>${help}`;
    }
    if (f.type === 'select') {
        const opts = (f.options||[]).map(o => `<option value="${_escHtml(o)}">${_escHtml(o)}</option>`).join('');
        return `${label}<select name="${name}" class="form-select" ${reqAttr}><option value="">— Select —</option>${opts}</select>${help}`;
    }
    if (f.type === 'radio') {
        const opts = (f.options||[]).map(o => `<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-bottom:0.25rem;"><input type="radio" name="${name}" value="${_escHtml(o)}" ${reqAttr}> ${_escHtml(o)}</label>`).join('');
        return `${label}<div>${opts}</div>${help}`;
    }
    if (f.type === 'checkbox') {
        const opts = (f.options||[]).map(o => `<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;cursor:pointer;margin-bottom:0.25rem;" class="c-check-group"><input type="checkbox" name="${name}_${_escHtml(o)}" value="${_escHtml(o)}"> ${_escHtml(o)}</label>`).join('');
        return `${label}<div>${opts}</div>${help}`;
    }
    if (f.type === 'toggle') {
        return `${label}<label style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;"><input type="checkbox" name="${name}" style="width:16px;height:16px;"> <span style="font-size:0.875rem;color:var(--text-main);">Yes</span></label>${help}`;
    }
    if (f.type === 'file') {
        return `${label}<input type="file" name="${name}" class="form-input" accept="${_escHtml(f.accept||'')}" style="padding:0.4rem;">${help}`;
    }
    if (f.type === 'date') {
        return `${label}<input type="date" name="${name}" class="form-input" ${reqAttr}>${help}`;
    }
    if (f.type === 'number') {
        return `${label}<input type="number" name="${name}" class="form-input" ${phAttr} ${f.min?`min="${f.min}"`:''} ${f.max?`max="${f.max}"`:''} ${reqAttr}>${help}`;
    }
    if (f.type === 'rating') {
        return `${label}<div style="display:flex;gap:4px;" id="rating_${name}">
            ${[1,2,3,4,5].map(n=>`<i data-lucide="star" style="width:22px;height:22px;cursor:pointer;color:var(--border-color);stroke-width:1.5;" onclick="setRating('${name}',${n})"></i>`).join('')}
            <input type="hidden" name="${name}" value="0">
        </div>${help}`;
    }
    // Default: text input
    const inputType = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text';
    return `${label}<input type="${inputType}" name="${name}" class="form-input" ${phAttr} ${reqAttr}>${help}`;
}

function setRating(name, value) {
    const container = document.getElementById('rating_' + name);
    if (!container) return;
    const stars = container.querySelectorAll('i[data-lucide="star"]');
    stars.forEach((star, i) => {
        star.style.color = i < value ? '#f59e0b' : 'var(--border-color)';
        star.style.fill  = i < value ? '#f59e0b' : 'none';
    });
    const hidden = container.querySelector('input[type="hidden"]');
    if (hidden) hidden.value = value;
}

function openNewAppModal(programId) {
    programsState.editingAppId = null;
    document.getElementById('appModalTitle').textContent = 'New Application';
    document.getElementById('appForm').reset();
    populateAppProgramSelect();
    if (programId) {
        const sel = document.getElementById('appProgramSelect');
        if (sel) { 
            sel.value = programId; 
            sel.dispatchEvent(new Event('change'));
            renderDynamicForm(programId);
        }
    } else {
        document.getElementById('dynamicFormContainer').style.display = 'none';
    }
    openModal('appModal');
    lucide.createIcons();
}

async function openEditAppModal(appId) {
    try {
        const res = await fetch('/api/programs/applications');
        const apps = await res.json();
        const a = apps.find(x => x.id === appId);
        if (!a) return;
        programsState.editingAppId = appId;
        document.getElementById('appModalTitle').textContent = 'Edit Application';
        populateAppProgramSelect();
        await new Promise(r => setTimeout(r, 50));
        const form = document.getElementById('appForm');
        form.reset();
        const sel = document.getElementById('appProgramSelect');
        if (sel) { sel.value = a.course_id; await sel.dispatchEvent(new Event('change')); }
        await new Promise(r => setTimeout(r, 100));
        ['applicant_name','applicant_phone','applicant_email','applicant_age','applicant_gender',
         'applicant_address','guardian_name','guardian_phone','nic_number','education_level','notes','status']
            .forEach(k => { if (form.elements[k]) form.elements[k].value = a[k] || ''; });
        const bSel = document.getElementById('appBatchSelect');
        if (bSel && a.batch_id) bSel.value = a.batch_id;

        // Populate Custom Data
        if (a.custom_data) {
            try {
                const customData = JSON.parse(a.custom_data);
                const content = document.getElementById('customFormContent');
                content.querySelectorAll('.c-group, .c-check-group').forEach(group => {
                    const label = group.querySelector('label')?.textContent.trim();
                    const input = group.querySelector('input, select, textarea');
                    if (label && input && customData[label] !== undefined) {
                        if (input.type === 'checkbox') input.checked = customData[label];
                        else input.value = customData[label];
                    }
                });
            } catch (e) { console.error('Error loading custom data', e); }
        }

        openModal('appModal');
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

document.getElementById('appForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.course_id = document.getElementById('appProgramSelect').value;
    data.batch_id  = document.getElementById('appBatchSelect').value;
    // Collect Custom Data
    const customData = {};
    const customContent = document.getElementById('customFormContent');
    customContent.querySelectorAll('.c-group, .c-check-group, .c-label, .c-btn').forEach(group => {
        const labelEl = group.tagName === 'LABEL' || group.tagName === 'BUTTON' ? group : group.querySelector('label');
        const label = labelEl?.textContent.trim();
        const input = group.querySelector('input, select, textarea');
        
        if (label && input) {
            if (input.type === 'checkbox') customData[label] = input.checked;
            else customData[label] = input.value;
        }
    });
    data.custom_data = JSON.stringify(customData);

    const appId = programsState.editingAppId;
    const method = appId ? 'PUT' : 'POST';
    const url = appId ? `/api/programs/applications/${appId}` : '/api/programs/applications';
    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw await res.json();
        closeModal('appModal');
        toast(appId ? 'Application updated!' : 'Application submitted!');
        if (programsState.viewingProgramId) viewProgram(programsState.viewingProgramId);
        fetchPrograms();
    } catch (err) { toast(err.message || 'Failed', 'error'); }
});

async function deleteApplication(appId, programId) {
    if (!confirm('Are you sure you want to delete this APPLICATION?')) return;
    try {
        console.log('Attempting to delete Application ID:', appId);
        const res = await fetch(`/api/programs/applications/${appId}`, { method: 'DELETE' });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned ${res.status}`);
        }
        toast('Application deleted');
        if (programId && document.getElementById('programDetailModal').style.display !== 'none') {
            loadProgramApplications(programId, []);
        }
        if (document.getElementById('pv-applications').style.display !== 'none') {
            fetchAllApplications();
        }
        fetchPrograms();
        if (window.fetchStats) window.fetchStats();
    } catch (err) { 
        console.error('Delete App Error:', err);
        toast('Failed to delete application: ' + err.message, 'error'); 
    }
}

// ══════════════════════════════════════════════════════
//   FILTER HANDLERS (called from inline HTML)
// ══════════════════════════════════════════════════════
function setProgramFilter(key, value) {
    programsState.filter[key] = value;
    // Update active pill
    document.querySelectorAll(`[data-filter="${key}"]`).forEach(el => {
        el.classList.toggle('filter-active', el.dataset.value === value);
    });
    renderProgramCards();
}

function setProgramSearch(value) {
    programsState.filter.search = value;
    renderProgramCards();
}

// ══════════════════════════════════════════════════════
//   ALL APPLICATIONS VIEW
// ══════════════════════════════════════════════════════
async function fetchAllApplications() {
    try {
        const res = await fetch('/api/programs/applications');
        programsState.applications = await res.json();
        
        // Populate program filter if empty
        const filter = document.getElementById('appProgramFilter');
        if (filter && filter.options.length <= 1) {
            const programsRes = await fetch('/api/programs');
            const progs = await programsRes.json();
            progs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                filter.appendChild(opt);
            });
        }
        
        filterAllApplications();
    } catch (err) { console.error(err); }
}

function filterAllApplications() {
    const search = document.getElementById('appSearchInput').value.toLowerCase();
    const progId = document.getElementById('appProgramFilter').value;
    const status = document.getElementById('appStatusFilter').value;
    
    let filtered = (programsState.applications || []);
    
    if (search) {
        filtered = filtered.filter(a => 
            a.applicant_name.toLowerCase().includes(search) || 
            (a.applicant_phone && a.applicant_phone.includes(search)) ||
            (a.nic_number && a.nic_number.toLowerCase().includes(search))
        );
    }
    
    if (progId !== 'all') {
        filtered = filtered.filter(a => a.course_id == progId);
    }
    
    if (status !== 'all') {
        filtered = filtered.filter(a => a.status === status);
    }
    
    renderAllApplications(filtered);
}

function renderAllApplications(apps) {
    const body = document.getElementById('allAppsBody');
    body.innerHTML = apps.map(a => `
        <tr>
            <td>
                <div style="font-weight:600; color:var(--text-main);">${a.applicant_name}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${a.applicant_email || ''}</div>
            </td>
            <td>${a.applicant_phone || '—'}</td>
            <td>
                <span style="font-size:0.8rem; font-weight:500;">${a.program_title || '—'}</span>
            </td>
            <td>
                <div style="font-size:0.8rem;">${a.batch_name || '<em style="color:var(--text-muted)">N/A</em>'}</div>
            </td>
            <td>${new Date(a.applied_date).toLocaleDateString()}</td>
            <td>${statusBadge(a.status)}</td>
            <td style="text-align:right;">
                <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                    <button class="prog-btn prog-btn-ghost" title="Edit" onclick="openEditAppModal(${a.id})">
                        <i data-lucide="edit-2" style="width:14px;"></i>
                    </button>
                    <button class="prog-btn prog-btn-danger" title="Delete" onclick="deleteApplication(${a.id}, ${a.course_id})">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">
        <i data-lucide="inbox" style="width:40px; height:40px; margin-bottom:1rem; opacity:0.2;"></i>
        <p>No applications found matching your criteria</p>
    </td></tr>`;
    lucide.createIcons();
}

function exportApplicationsToCSV() {
    const apps = programsState.applications || [];
    if (apps.length === 0) return toast('No data to export', 'error');
    
    const headers = ['Applicant Name', 'Phone', 'Email', 'Program', 'Batch', 'Applied Date', 'Status', 'NIC', 'Gender', 'Education', 'Notes'];
    const rows = apps.map(a => [
        a.applicant_name,
        a.applicant_phone || '',
        a.applicant_email || '',
        a.program_title || '',
        a.batch_name || '',
        new Date(a.applied_date).toLocaleDateString(),
        a.status,
        a.nic_number || '',
        a.applicant_gender || '',
        a.education_level || '',
        (a.notes || '').replace(/\n/g, ' ')
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EDF_Applications_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Programs tab sub-view switching
function showProgramsView(view) {
    document.querySelectorAll('.programs-view').forEach(v => v.style.display = 'none');
    document.getElementById('pv-' + view).style.display = 'block';
    document.querySelectorAll('.pv-tab').forEach(t => {
        t.classList.toggle('pv-tab-active', t.dataset.view === view);
    });
    if (view === 'applications') fetchAllApplications();
}

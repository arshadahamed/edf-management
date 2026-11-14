/*
 * ============================================================================
 * EDF GALGAMUWA — Volunteer Force & Field Registry Frontend Module
 * Powers #volunteersTab, #volunteerModal (3-step wizard + live identity),
 * #viewVolunteerModal, #volActivityModal, #volunteerIdCardModal, #volConfirmModal
 * ============================================================================
 */

let currentVolunteers = [];
let _volCurrentStep = 0;
let _volViewMode = 'table';
let _volWingFilter = 'all';
let _volTierFilter = 'all';
let _volPage = 1;
let _volLimit = 12;
let _volDossierActive = null;
let _volDossierTab = 'overview';
let _volDossierActivities = [];
let _volIdCardActive = null;
let _volPendingConfirmAction = null;

const VOLUNTEER_WINGS = [
    'Field Relief',
    'Education & Madrasa',
    'Ramadan & Food Aid',
    'Medical & Transport',
    'Media & Admin',
    'Youth & Events'
];

const VOL_STATUS_LABELS = {
    active: 'Active',
    standby: 'Standby',
    on_leave: 'On Leave',
    inactive: 'Inactive'
};

function escapeVolHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getVolInitials(name) {
    const parts = String(name || 'V').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'V';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatVolDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function refreshVolIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
    }
    if (typeof window.initEdfLottieIcons === 'function') {
        window.initEdfLottieIcons();
    }
}

/* ── 1. Data Loading & Live KPI Computation ───────────────────────────────── */
async function fetchVolunteers(forceToast = false) {
    try {
        const res = await fetch('/api/edf/volunteers');
        if (!res.ok) throw new Error('Failed to load volunteers registry');
        const rows = await res.json();
        currentVolunteers = Array.isArray(rows) ? rows : [];
        _volRenderKpis();
        _volRenderWingPills();
        _volRenderRegistry();
        if (forceToast && typeof showToast === 'function') {
            showToast(`Synced ${currentVolunteers.length} volunteer record(s)`, 'success');
        }
    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Unable to load volunteers', 'error');
        }
    }
}

function _volRenderKpis() {
    const list = currentVolunteers || [];
    const total = list.length;
    let active = 0, standbyLeave = 0, verified = 0, leads = 0, transportReady = 0, hours = 0, deployments = 0;

    for (const v of list) {
        const st = String(v.status || 'active').toLowerCase();
        if (st === 'active') active++;
        else if (st === 'standby' || st === 'on_leave') standbyLeave++;
        if (Number(v.verified_id) === 1) verified++;
        if (/lead|coordinator/i.test(v.role_tier || '')) leads++;
        if (v.transport_mode && v.transport_mode !== 'None') transportReady++;
        hours += Number(v.logged_hours_sum ?? v.total_hours ?? 0);
        deployments += Number(v.logged_activities_count ?? v.deployments_count ?? 0);
    }

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('vStatTotal', total.toLocaleString());
    setTxt('vStatVerifiedSub', `${verified} ID verified`);
    setTxt('vStatActive', active.toLocaleString());
    setTxt('vStatStandbySub', `${standbyLeave} standby / on leave`);
    setTxt('vStatLeads', leads.toLocaleString());
    setTxt('vStatTransportSub', `${transportReady} with vehicles`);
    setTxt('vStatHours', `${(Math.round(hours * 10) / 10).toLocaleString()}h`);
    setTxt('vStatDeployments', deployments.toLocaleString());

    const statusFilter = document.getElementById('volStatusFilter')?.value || 'all';
    document.getElementById('volKpiTotal')?.classList.toggle('is-filtered', statusFilter === 'all' && _volTierFilter === 'all' && _volWingFilter === 'all');
    document.getElementById('volKpiActive')?.classList.toggle('is-filtered', statusFilter === 'active');
    document.getElementById('volKpiLeads')?.classList.toggle('is-filtered', _volTierFilter === 'lead');
}

function _volRenderWingPills() {
    const container = document.getElementById('volWingPills');
    if (!container) return;

    const counts = { all: currentVolunteers.length };
    for (const w of VOLUNTEER_WINGS) counts[w] = 0;
    for (const v of currentVolunteers) {
        const w = v.wing || 'Field Relief';
        counts[w] = (counts[w] || 0) + 1;
    }

    const pills = [
        { key: 'all', label: 'All Wings', count: counts.all },
        ...VOLUNTEER_WINGS.map(w => ({ key: w, label: w, count: counts[w] || 0 }))
    ];

    container.innerHTML = pills.map(p => `
        <button type="button" class="vol-wing-pill ${_volWingFilter === p.key ? 'active' : ''}" onclick="setVolunteerWingFilter('${escapeVolHtml(p.key)}')">
            <span>${escapeVolHtml(p.label)}</span>
            <span class="vol-wing-pill-cnt">${p.count}</span>
        </button>
    `).join('');
}

function setVolunteerWingFilter(wing) {
    _volWingFilter = wing || 'all';
    _volPage = 1;
    _volRenderKpis();
    _volRenderWingPills();
    _volRenderRegistry();
}

function toggleVolunteerKpiFilter(kind, value) {
    if (kind === 'status') {
        const sel = document.getElementById('volStatusFilter');
        if (sel) sel.value = sel.value === value ? 'all' : value;
    } else if (kind === 'tier') {
        _volTierFilter = _volTierFilter === value ? 'all' : value;
    }
    _volPage = 1;
    _volRenderKpis();
    _volRenderRegistry();
}

function resetAllVolunteerFilters() {
    const search = document.getElementById('volSearchInput');
    const avail = document.getElementById('volAvailabilityFilter');
    const status = document.getElementById('volStatusFilter');
    if (search) search.value = '';
    if (avail) avail.value = 'all';
    if (status) status.value = 'all';
    _volWingFilter = 'all';
    _volTierFilter = 'all';
    _volPage = 1;
    _volRenderKpis();
    _volRenderWingPills();
    _volRenderRegistry();
}

function sortVolunteersBy(mode) {
    const sel = document.getElementById('volSortSelect');
    if (sel) sel.value = mode;
    _volPage = 1;
    _volRenderRegistry();
}

function volFilterChanged() {
    _volPage = 1;
    _volRenderKpis();
    _volRenderRegistry();
}

function setVolunteerViewMode(mode) {
    _volViewMode = mode === 'cards' ? 'cards' : 'table';
    document.getElementById('volViewBtnTable')?.classList.toggle('active', _volViewMode === 'table');
    document.getElementById('volViewBtnCards')?.classList.toggle('active', _volViewMode === 'cards');
    _volRenderRegistry();
}

function _volGetFiltered() {
    const q = (document.getElementById('volSearchInput')?.value || '').trim().toLowerCase();
    const avail = document.getElementById('volAvailabilityFilter')?.value || 'all';
    const status = document.getElementById('volStatusFilter')?.value || 'all';
    const sort = document.getElementById('volSortSelect')?.value || 'hours';

    const filtered = (currentVolunteers || []).filter(v => {
        if (_volWingFilter !== 'all' && (v.wing || 'Field Relief') !== _volWingFilter) return false;
        if (_volTierFilter === 'lead' && !/lead|coordinator/i.test(v.role_tier || '')) return false;
        if (avail !== 'all' && (v.availability || 'Weekends') !== avail) return false;
        if (status !== 'all' && String(v.status || 'active').toLowerCase() !== status) return false;
        if (q) {
            const hay = [
                v.full_name, v.volunteer_no, v.phone, v.whatsapp,
                v.email, v.city, v.skills, v.wing, v.role_tier
            ].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        if (sort === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''));
        if (sort === 'newest') return new Date(b.join_date || b.created_at || 0) - new Date(a.join_date || a.created_at || 0);
        if (sort === 'leads') {
            const aRank = /coordinator/i.test(a.role_tier || '') ? 2 : (/lead/i.test(a.role_tier || '') ? 1 : 0);
            const bRank = /coordinator/i.test(b.role_tier || '') ? 2 : (/lead/i.test(b.role_tier || '') ? 1 : 0);
            if (bRank !== aRank) return bRank - aRank;
        }
        const hrsDiff = Number(b.logged_hours_sum ?? b.total_hours ?? 0) - Number(a.logged_hours_sum ?? a.total_hours ?? 0);
        if (hrsDiff !== 0) return hrsDiff;
        return Number(b.id) - Number(a.id);
    });

    return filtered;
}

function _volRenderSkillChips(skillsStr, limit = 3) {
    const items = String(skillsStr || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (!items.length) return '<span style="color:var(--text-muted);font-size:0.74rem;">No skills listed</span>';
    const shown = items.slice(0, limit).map(s => `<span class="vol-skill-tag">${escapeVolHtml(s)}</span>`).join('');
    const extra = items.length > limit ? `<span class="vol-skill-tag">+${items.length - limit}</span>` : '';
    return shown + extra;
}

function _volRenderStatusPill(v) {
    const st = String(v.status || 'active').toLowerCase();
    const label = VOL_STATUS_LABELS[st] || st;
    return `<button type="button" class="vol-status-pill is-${escapeVolHtml(st)}" onclick="quickCycleVolunteerStatus(${v.id})" title="Click to cycle status (Active -> Standby -> On Leave)">${escapeVolHtml(label)}</button>`;
}

function _volRenderAvatar(v) {
    if (v.photo_url) {
        return `<div class="vol-avatar"><img src="${escapeVolHtml(v.photo_url)}" alt="${escapeVolHtml(v.full_name)}"></div>`;
    }
    return `<div class="vol-avatar">${escapeVolHtml(getVolInitials(v.full_name))}</div>`;
}

function _volRenderRegistry() {
    const filtered = _volGetFiltered();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / _volLimit));
    if (_volPage > totalPages) _volPage = totalPages;
    const start = (_volPage - 1) * _volLimit;
    const pageRows = filtered.slice(start, start + _volLimit);

    const tableCard = document.getElementById('volTableCard');
    const cardsWrap = document.getElementById('volCardsWrap');
    const tbody = document.getElementById('volunteersBody');
    const cardsGrid = document.getElementById('volCardsGrid');

    if (tableCard) tableCard.style.display = _volViewMode === 'table' ? 'block' : 'none';
    if (cardsWrap) cardsWrap.style.display = _volViewMode === 'cards' ? 'block' : 'none';

    const emptyBlock = `
        <div class="vol-empty-state">
            <div style="width:52px;height:52px;border-radius:16px;background:rgba(16,185,129,0.12);display:flex;align-items:center;justify-content:center;">
                <span class="edf-lottie-slot" style="width:34px;height:34px;" data-lottie-icon="volunteerbadge" data-lottie-trigger="loop"></span>
            </div>
            <div style="font-weight:800;font-size:0.95rem;color:var(--text-main);">
                ${currentVolunteers.length ? 'No volunteers match current filters' : 'No volunteers registered yet'}
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);max-width:360px;">
                ${currentVolunteers.length ? 'Adjust your search query, wing, or availability filter to view matching personnel.' : 'Register field relief volunteers, teachers, medical helpers & coordinators to track deployments and hours.'}
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:0.25rem;">
                ${currentVolunteers.length ? `<button type="button" class="vol-btn" onclick="resetAllVolunteerFilters()">Reset Filters</button>` : ''}
                <button type="button" class="vol-btn vol-btn-emerald" onclick="openAddVolunteerModal()">+ Register Volunteer</button>
            </div>
        </div>
    `;

    if (tbody) {
        if (!pageRows.length) {
            tbody.innerHTML = `<tr><td colspan="7">${emptyBlock}</td></tr>`;
        } else {
            tbody.innerHTML = pageRows.map(v => {
                const hrs = Number(v.logged_hours_sum ?? v.total_hours ?? 0);
                const deps = Number(v.logged_activities_count ?? v.deployments_count ?? 0);
                const code = v.volunteer_no || `VOL-${String(v.id).padStart(3, '0')}`;
                return `
                    <tr>
                        <td>
                            <div class="vol-avatar-cell">
                                ${_volRenderAvatar(v)}
                                <div style="min-width:0;">
                                    <div style="font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">
                                        <span style="cursor:pointer;" onclick="openViewVolunteerModal(${v.id})">${escapeVolHtml(v.full_name)}</span>
                                        ${Number(v.verified_id) === 1 ? '<span class="vol-verified-pill">✓ ID</span>' : ''}
                                    </div>
                                    <div style="display:flex;align-items:center;gap:0.35rem;margin-top:2px;">
                                        <span class="vol-code-pill">${escapeVolHtml(code)}</span>
                                        ${v.blood_group ? `<span style="font-size:0.68rem;font-weight:800;color:#ef4444;">${escapeVolHtml(v.blood_group)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="font-weight:700;font-size:0.79rem;">${escapeVolHtml(v.phone || '—')}</div>
                            <div class="vol-role-sub">${escapeVolHtml(v.city || v.email || 'Zone unset')}</div>
                        </td>
                        <td>
                            <span class="vol-wing-badge">${escapeVolHtml(v.wing || 'Field Relief')}</span>
                            <div class="vol-role-sub">${escapeVolHtml(v.role_tier || 'Field Volunteer')}${v.transport_mode && v.transport_mode !== 'None' ? ` · ${escapeVolHtml(v.transport_mode)}` : ''}</div>
                        </td>
                        <td>
                            <div style="font-size:0.74rem;font-weight:700;margin-bottom:3px;">${escapeVolHtml(v.availability || 'Weekends')}</div>
                            <div>${_volRenderSkillChips(v.skills, 2)}</div>
                        </td>
                        <td>
                            <div style="font-weight:800;color:#059669;">${hrs}h served</div>
                            <div class="vol-role-sub">${deps} mission${deps === 1 ? '' : 's'}</div>
                        </td>
                        <td>${_volRenderStatusPill(v)}</td>
                        <td style="text-align:right;white-space:nowrap;">
                            <div style="display:inline-flex;align-items:center;gap:0.25rem;">
                                <button type="button" class="vol-action-btn" onclick="openViewVolunteerModal(${v.id})" title="Inspect Field Dossier"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn is-hours" onclick="openLogVolunteerActivityModal(${v.id})" title="Log Service Hours"><i data-lucide="clock" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn" onclick="openVolunteerIdCardModal(${v.id})" title="Field ID Pass"><i data-lucide="id-card" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn" onclick="openEditVolunteerModal(${v.id})" title="Edit Profile"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn is-danger" onclick="deleteVolunteer(${v.id})" title="Remove Volunteer"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    if (cardsGrid) {
        if (!pageRows.length) {
            cardsGrid.innerHTML = `<div class="vol-surface-card" style="grid-column:1 / -1;">${emptyBlock}</div>`;
        } else {
            cardsGrid.innerHTML = pageRows.map(v => {
                const hrs = Number(v.logged_hours_sum ?? v.total_hours ?? 0);
                const deps = Number(v.logged_activities_count ?? v.deployments_count ?? 0);
                const code = v.volunteer_no || `VOL-${String(v.id).padStart(3, '0')}`;
                return `
                    <div class="vol-card">
                        <div class="vol-card-top">
                            <div class="vol-avatar-cell" style="min-width:0;">
                                ${_volRenderAvatar(v)}
                                <div style="min-width:0;">
                                    <div style="font-weight:800;font-size:0.9rem;color:var(--text-main);cursor:pointer;" onclick="openViewVolunteerModal(${v.id})">${escapeVolHtml(v.full_name)}</div>
                                    <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;margin-top:2px;">
                                        <span class="vol-code-pill">${escapeVolHtml(code)}</span>
                                        ${Number(v.verified_id) === 1 ? '<span class="vol-verified-pill">✓ ID</span>' : ''}
                                    </div>
                                </div>
                            </div>
                            ${_volRenderStatusPill(v)}
                        </div>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                            <span class="vol-wing-badge">${escapeVolHtml(v.wing || 'Field Relief')}</span>
                            <span class="vol-code-pill">${escapeVolHtml(v.role_tier || 'Field Volunteer')}</span>
                        </div>
                        <div class="vol-card-stats">
                            <div><div class="vol-card-stat-lbl">Hours</div><div class="vol-card-stat-val" style="color:#059669;">${hrs}h</div></div>
                            <div><div class="vol-card-stat-lbl">Missions</div><div class="vol-card-stat-val">${deps}</div></div>
                            <div><div class="vol-card-stat-lbl">Shift</div><div class="vol-card-stat-val">${escapeVolHtml(v.availability || 'Weekends')}</div></div>
                        </div>
                        <div>${_volRenderSkillChips(v.skills, 3)}</div>
                        <div class="vol-card-ftr">
                            <span style="font-size:0.73rem;color:var(--text-muted);">${escapeVolHtml(v.phone || v.city || 'No phone')}</span>
                            <div style="display:inline-flex;gap:0.25rem;">
                                <button type="button" class="vol-action-btn" onclick="openViewVolunteerModal(${v.id})" title="Dossier"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn is-hours" onclick="openLogVolunteerActivityModal(${v.id})" title="Log Hours"><i data-lucide="clock" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn" onclick="openVolunteerIdCardModal(${v.id})" title="ID Pass"><i data-lucide="id-card" style="width:14px;height:14px;"></i></button>
                                <button type="button" class="vol-action-btn" onclick="openEditVolunteerModal(${v.id})" title="Edit"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    const pgHtml = _volBuildPaginationHtml(total, start, pageRows.length, totalPages);
    const bar1 = document.getElementById('volPaginationBar');
    const bar2 = document.getElementById('volCardsPaginationBar');
    if (bar1) bar1.innerHTML = total ? pgHtml : '';
    if (bar2) bar2.innerHTML = total ? pgHtml : '';

    refreshVolIcons();
}

function _volBuildPaginationHtml(total, start, count, totalPages) {
    if (!total) return '';
    let btns = `<button type="button" class="vol-btn" style="padding:0.28rem 0.62rem;font-size:0.74rem;" ${_volPage <= 1 ? 'disabled' : ''} onclick="volGoPage(${_volPage - 1})">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || Math.abs(p - _volPage) <= 1) {
            btns += `<button type="button" class="vol-btn ${p === _volPage ? 'vol-btn-emerald' : ''}" style="padding:0.28rem 0.65rem;font-size:0.74rem;" onclick="volGoPage(${p})">${p}</button>`;
        }
    }
    btns += `<button type="button" class="vol-btn" style="padding:0.28rem 0.62rem;font-size:0.74rem;" ${_volPage >= totalPages ? 'disabled' : ''} onclick="volGoPage(${_volPage + 1})">›</button>`;

    return `
        <span>Showing <strong>${start + 1}–${start + count}</strong> of <strong>${total}</strong> volunteer${total === 1 ? '' : 's'}</span>
        <div style="display:flex;align-items:center;gap:0.45rem;">
            <select class="vol-select" style="width:auto;padding:0.25rem 0.55rem;font-size:0.74rem;" onchange="_volLimit = Number(this.value); _volPage = 1; _volRenderRegistry();">
                <option value="12" ${_volLimit === 12 ? 'selected' : ''}>12 / page</option>
                <option value="24" ${_volLimit === 24 ? 'selected' : ''}>24 / page</option>
                <option value="48" ${_volLimit === 48 ? 'selected' : ''}>48 / page</option>
            </select>
            <div style="display:flex;gap:0.25rem;">${btns}</div>
        </div>
    `;
}

function volGoPage(p) {
    _volPage = Math.max(1, Number(p) || 1);
    _volRenderRegistry();
}

/* ── 2. 3-Step Registration / Edit Wizard (#volunteerModal) ───────────────── */
function openAddVolunteerModal() {
    const form = document.getElementById('volunteerForm');
    if (form) form.reset();
    document.getElementById('volFormId').value = '';
    document.getElementById('volFormPhotoUrl').value = '';
    document.getElementById('volJoinDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('volStatus').value = 'active';
    document.getElementById('volRoleTier').value = 'Field Volunteer';
    document.getElementById('volTransport').value = 'None';
    document.getElementById('volVerifiedId').checked = false;
    document.getElementById('volModalTitle').textContent = 'Register Field Volunteer';
    document.getElementById('volModalSub').textContent = 'Assign service wing, availability schedule, transport capability & verified ID credentials';

    selectVolunteerWing('Field Relief');
    selectVolunteerAvail('Weekends');
    document.getElementById('volSkillsInput').value = '';
    syncSkillChipsFromInput();
    goToVolunteerStep(0);
    updateVolunteerLivePreview();
    openModal('volunteerModal');
    refreshVolIcons();
}

function openEditVolunteerModal(id) {
    const v = currentVolunteers.find(x => Number(x.id) === Number(id));
    if (!v) return;

    document.getElementById('volFormId').value = String(v.id);
    document.getElementById('volFormPhotoUrl').value = v.photo_url || '';
    document.getElementById('volFullName').value = v.full_name || '';
    document.getElementById('volNo').value = v.volunteer_no || '';
    document.getElementById('volNic').value = v.nic_number || '';
    document.getElementById('volJoinDate').value = (v.join_date || v.created_at || '').slice(0, 10);
    document.getElementById('volGender').value = v.gender || '';
    document.getElementById('volBlood').value = v.blood_group || '';
    document.getElementById('volStatus').value = v.status || 'active';
    document.getElementById('volRoleTier').value = v.role_tier || 'Field Volunteer';
    document.getElementById('volVerifiedId').checked = Number(v.verified_id) === 1;
    document.getElementById('volPhone').value = v.phone || '';
    document.getElementById('volWhatsapp').value = v.whatsapp || '';
    document.getElementById('volEmail').value = v.email || '';
    document.getElementById('volAddress').value = v.address || '';
    document.getElementById('volCity').value = v.city || '';
    document.getElementById('volEmName').value = v.emergency_contact_name || '';
    document.getElementById('volEmPhone').value = v.emergency_contact_phone || '';
    document.getElementById('volTransport').value = v.transport_mode || 'None';
    document.getElementById('volSkillsInput').value = v.skills || '';
    document.getElementById('volNotes').value = v.notes || '';

    document.getElementById('volModalTitle').textContent = `Edit Volunteer: ${v.full_name}`;
    document.getElementById('volModalSub').textContent = `${v.volunteer_no || 'Volunteer'} · Update readiness, wing assignment & skills`;

    selectVolunteerWing(v.wing || 'Field Relief');
    selectVolunteerAvail(v.availability || 'Weekends');
    syncSkillChipsFromInput();
    goToVolunteerStep(0);
    updateVolunteerLivePreview();
    openModal('volunteerModal');
    refreshVolIcons();
}

function goToVolunteerStep(step) {
    _volCurrentStep = Math.max(0, Math.min(2, Number(step) || 0));
    document.querySelectorAll('#volunteerModal .vol-step-tab').forEach(btn => {
        btn.classList.toggle('active', Number(btn.getAttribute('data-vol-step')) === _volCurrentStep);
    });
    for (let i = 0; i < 3; i++) {
        document.getElementById(`volStepPanel${i}`)?.classList.toggle('active', i === _volCurrentStep);
    }
    const prevBtn = document.getElementById('volPrevStepBtn');
    const nextBtn = document.getElementById('volNextStepBtn');
    const subBtn = document.getElementById('volSubmitBtn');
    if (prevBtn) prevBtn.style.display = _volCurrentStep > 0 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = _volCurrentStep < 2 ? 'inline-flex' : 'none';
    if (subBtn) subBtn.style.display = _volCurrentStep === 2 ? 'inline-flex' : 'none';
    refreshVolIcons();
}

function selectVolunteerWing(wing) {
    const inp = document.getElementById('volWingInput');
    if (inp) inp.value = wing;
    document.querySelectorAll('#volWingTiles .vol-wing-tile').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-wing') === wing);
    });
    updateVolunteerLivePreview();
}

function selectVolunteerAvail(avail) {
    const inp = document.getElementById('volAvailInput');
    if (inp) inp.value = avail;
    document.querySelectorAll('#volAvailChips .vol-pick-chip').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-avail') === avail);
    });
    updateVolunteerLivePreview();
}

function toggleVolunteerSkillChip(skill, btn) {
    const inp = document.getElementById('volSkillsInput');
    if (!inp) return;
    const list = inp.value.split(',').map(s => s.trim()).filter(Boolean);
    const idx = list.findIndex(s => s.toLowerCase() === skill.toLowerCase());
    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        list.push(skill);
    }
    inp.value = list.join(', ');
    if (btn) btn.classList.toggle('active', idx < 0);
    updateVolunteerLivePreview();
}

function syncSkillChipsFromInput() {
    const raw = (document.getElementById('volSkillsInput')?.value || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    const set = new Set(raw);
    document.querySelectorAll('#volSkillChipPicker .vol-pick-chip').forEach(btn => {
        const label = (btn.textContent || '').trim().toLowerCase();
        btn.classList.toggle('active', set.has(label));
    });
}

function copyVolPhoneToWhatsapp() {
    const p = document.getElementById('volPhone')?.value || '';
    const wa = document.getElementById('volWhatsapp');
    if (wa && p) {
        wa.value = p;
        if (typeof showToast === 'function') showToast('Copied phone number to WhatsApp', 'info');
    }
}

async function handleVolunteerPhotoUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
        const res = await fetch('/api/edf/volunteers/upload-photo', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        document.getElementById('volFormPhotoUrl').value = data.photo_url || '';
        updateVolunteerLivePreview();
        if (typeof showToast === 'function') showToast('Volunteer badge photo uploaded', 'success');
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Photo upload failed', 'error');
    }
}

function updateVolunteerLivePreview() {
    const name = (document.getElementById('volFullName')?.value || '').trim();
    const code = (document.getElementById('volNo')?.value || '').trim();
    const wing = document.getElementById('volWingInput')?.value || 'Field Relief';
    const role = document.getElementById('volRoleTier')?.value || 'Field Volunteer';
    const avail = document.getElementById('volAvailInput')?.value || 'Weekends';
    const phone = (document.getElementById('volPhone')?.value || '').trim();
    const city = (document.getElementById('volCity')?.value || '').trim();
    const status = document.getElementById('volStatus')?.value || 'active';
    const verified = !!document.getElementById('volVerifiedId')?.checked;
    const photoUrl = (document.getElementById('volFormPhotoUrl')?.value || '').trim();

    document.getElementById('volLiveName').textContent = name || 'New Volunteer';
    document.getElementById('volLiveCode').textContent = code || 'ID: Auto';
    document.getElementById('volLiveWing').textContent = wing;
    document.getElementById('volLiveRole').textContent = role;
    document.getElementById('volLiveAvail').textContent = avail;
    document.getElementById('volLivePhone').textContent = phone ? `Phone: ${phone}` : 'Phone: Not set';
    document.getElementById('volLiveCity').textContent = city ? `Zone: ${city}` : 'Zone: —';

    const verEl = document.getElementById('volLiveVerified');
    if (verEl) verEl.style.display = verified ? 'inline-flex' : 'none';

    const stEl = document.getElementById('volLiveStatusBadge');
    if (stEl) {
        stEl.className = `vol-status-pill is-${status}`;
        stEl.textContent = VOL_STATUS_LABELS[status] || status;
    }

    const imgEl = document.getElementById('volLiveAvatarImg');
    const initEl = document.getElementById('volLiveAvatarInitials');
    if (photoUrl && imgEl && initEl) {
        imgEl.src = photoUrl;
        imgEl.style.display = 'block';
        initEl.style.display = 'none';
    } else if (imgEl && initEl) {
        imgEl.style.display = 'none';
        initEl.style.display = 'block';
        initEl.textContent = getVolInitials(name || 'V');
    }

    // Completeness calculation
    const checks = [
        !!name,
        !!phone,
        !!(document.getElementById('volNic')?.value || '').trim(),
        !!city,
        !!(document.getElementById('volSkillsInput')?.value || '').trim(),
        !!(document.getElementById('volEmPhone')?.value || '').trim()
    ];
    const pct = Math.max(15, Math.round((checks.filter(Boolean).length / checks.length) * 100));
    const fill = document.getElementById('volCompletionFill');
    const lbl = document.getElementById('volCompletionLabel');
    if (fill) fill.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${pct}% Ready`;
}

async function submitVolunteerForm(e) {
    if (e) e.preventDefault();
    const fullName = (document.getElementById('volFullName')?.value || '').trim();
    if (!fullName) {
        goToVolunteerStep(0);
        document.getElementById('volFullName')?.focus();
        if (typeof showToast === 'function') showToast('Please enter Volunteer Full Name', 'warning');
        return;
    }

    const id = (document.getElementById('volFormId')?.value || '').trim();
    const payload = {
        full_name: fullName,
        volunteer_no: (document.getElementById('volNo')?.value || '').trim(),
        nic_number: (document.getElementById('volNic')?.value || '').trim(),
        join_date: document.getElementById('volJoinDate')?.value || '',
        gender: document.getElementById('volGender')?.value || '',
        blood_group: document.getElementById('volBlood')?.value || '',
        status: document.getElementById('volStatus')?.value || 'active',
        wing: document.getElementById('volWingInput')?.value || 'Field Relief',
        role_tier: document.getElementById('volRoleTier')?.value || 'Field Volunteer',
        verified_id: !!document.getElementById('volVerifiedId')?.checked,
        phone: (document.getElementById('volPhone')?.value || '').trim(),
        whatsapp: (document.getElementById('volWhatsapp')?.value || '').trim(),
        email: (document.getElementById('volEmail')?.value || '').trim(),
        address: (document.getElementById('volAddress')?.value || '').trim(),
        city: (document.getElementById('volCity')?.value || '').trim(),
        emergency_contact_name: (document.getElementById('volEmName')?.value || '').trim(),
        emergency_contact_phone: (document.getElementById('volEmPhone')?.value || '').trim(),
        availability: document.getElementById('volAvailInput')?.value || 'Weekends',
        transport_mode: document.getElementById('volTransport')?.value || 'None',
        skills: (document.getElementById('volSkillsInput')?.value || '').trim(),
        notes: (document.getElementById('volNotes')?.value || '').trim(),
        photo_url: (document.getElementById('volFormPhotoUrl')?.value || '').trim()
    };

    const btn = document.getElementById('volSubmitBtn');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(id ? `/api/edf/volunteers/${id}` : '/api/edf/volunteers', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Save failed');
        closeModal('volunteerModal');
        if (typeof showToast === 'function') showToast(data.message || 'Volunteer saved', 'success');
        await fetchVolunteers();
        if (typeof fetchStats === 'function') fetchStats();
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Failed to save volunteer', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ── 3. Quick Status Switcher ─────────────────────────────────────────────── */
async function quickCycleVolunteerStatus(id) {
    const v = currentVolunteers.find(x => Number(x.id) === Number(id));
    if (!v) return;
    const order = ['active', 'standby', 'on_leave'];
    const cur = String(v.status || 'active').toLowerCase();
    const next = order[(order.indexOf(cur) + 1) % order.length];
    try {
        const res = await fetch(`/api/edf/volunteers/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next })
        });
        if (!res.ok) throw new Error('Failed to update status');
        if (typeof showToast === 'function') showToast(`${v.full_name} marked ${VOL_STATUS_LABELS[next] || next}`, 'info');
        await fetchVolunteers();
        if (typeof fetchStats === 'function') fetchStats();
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
    }
}

/* ── 4. Volunteer Field Dossier & Activities Log (#viewVolunteerModal) ────── */
async function openViewVolunteerModal(id, initialTab = 'overview') {
    const v = currentVolunteers.find(x => Number(x.id) === Number(id));
    if (!v) return;
    _volDossierActive = v;
    _volDossierTab = initialTab;

    const avEl = document.getElementById('vvAvatar');
    if (avEl) {
        avEl.innerHTML = v.photo_url
            ? `<img src="${escapeVolHtml(v.photo_url)}" alt="${escapeVolHtml(v.full_name)}">`
            : escapeVolHtml(getVolInitials(v.full_name));
    }
    document.getElementById('vvName').textContent = v.full_name;
    document.getElementById('vvCode').textContent = v.volunteer_no || `VOL-${String(v.id).padStart(3, '0')}`;
    document.getElementById('vvWing').textContent = v.wing || 'Field Relief';
    document.getElementById('vvSub').textContent = `${v.role_tier || 'Field Volunteer'} · Joined ${formatVolDate(v.join_date || v.created_at)}`;

    const waDigits = String(v.whatsapp || v.phone || '').replace(/[^0-9]/g, '');
    const ftr = document.getElementById('vvFooter');
    if (ftr) {
        ftr.innerHTML = `
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                ${waDigits ? `<a href="https://wa.me/${waDigits}" target="_blank" class="vol-btn" style="text-decoration:none;"><i data-lucide="message-circle" style="width:14px;height:14px;color:#10b981;"></i> WhatsApp</a>` : ''}
                <button type="button" class="vol-btn" onclick="closeModal('viewVolunteerModal'); openVolunteerIdCardModal(${v.id});"><i data-lucide="id-card" style="width:14px;height:14px;"></i> Field Pass</button>
            </div>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                <button type="button" class="vol-btn vol-btn-gold" onclick="openLogVolunteerActivityModal(${v.id})"><i data-lucide="clock" style="width:14px;height:14px;"></i> Log Hours</button>
                <button type="button" class="vol-btn vol-btn-emerald" onclick="closeModal('viewVolunteerModal'); openEditVolunteerModal(${v.id});"><i data-lucide="pencil" style="width:14px;height:14px;"></i> Edit Profile</button>
            </div>
        `;
    }

    openModal('viewVolunteerModal');
    await _loadVolunteerActivitiesForDossier(v.id);
    switchVolunteerDossierTab(_volDossierTab);
}

async function _loadVolunteerActivitiesForDossier(volId) {
    try {
        const res = await fetch(`/api/edf/volunteers/${volId}/activities`);
        _volDossierActivities = res.ok ? await res.json() : [];
    } catch (_) {
        _volDossierActivities = [];
    }
}

function switchVolunteerDossierTab(tab) {
    _volDossierTab = tab === 'activities' ? 'activities' : 'overview';
    document.getElementById('vvTabBtnOverview')?.classList.toggle('active', _volDossierTab === 'overview');
    document.getElementById('vvTabBtnActivities')?.classList.toggle('active', _volDossierTab === 'activities');

    const v = _volDossierActive;
    const body = document.getElementById('vvBody');
    if (!v || !body) return;

    if (_volDossierTab === 'overview') {
        const hrs = Number(v.logged_hours_sum ?? v.total_hours ?? 0);
        const deps = Number(v.logged_activities_count ?? v.deployments_count ?? 0);
        body.innerHTML = `
            <div class="vv-info-grid">
                <div class="vv-bento-card">
                    <h4 class="vol-sec-title"><i data-lucide="id-card" style="width:14px;height:14px;"></i> Field Assignment</h4>
                    <div class="vv-bento-kv"><span>Status</span><strong>${escapeVolHtml(VOL_STATUS_LABELS[v.status] || v.status || 'Active')}</strong></div>
                    <div class="vv-bento-kv"><span>Role Tier</span><strong>${escapeVolHtml(v.role_tier || 'Field Volunteer')}</strong></div>
                    <div class="vv-bento-kv"><span>Availability</span><strong>${escapeVolHtml(v.availability || 'Weekends')}</strong></div>
                    <div class="vv-bento-kv"><span>Transport</span><strong>${escapeVolHtml(v.transport_mode || 'None')}</strong></div>
                    <div class="vv-bento-kv"><span>ID Verified</span><strong>${Number(v.verified_id) === 1 ? 'Yes (Verified)' : 'Pending'}</strong></div>
                    <div class="vv-bento-kv"><span>Service Total</span><strong style="color:#059669;">${hrs}h (${deps} missions)</strong></div>
                </div>
                <div class="vv-bento-card">
                    <h4 class="vol-sec-title"><i data-lucide="phone" style="width:14px;height:14px;"></i> Contact &amp; Emergency</h4>
                    <div class="vv-bento-kv"><span>Phone</span><strong>${escapeVolHtml(v.phone || '—')}</strong></div>
                    <div class="vv-bento-kv"><span>WhatsApp</span><strong>${escapeVolHtml(v.whatsapp || '—')}</strong></div>
                    <div class="vv-bento-kv"><span>Email</span><strong>${escapeVolHtml(v.email || '—')}</strong></div>
                    <div class="vv-bento-kv"><span>Zone / City</span><strong>${escapeVolHtml(v.city || '—')}</strong></div>
                    <div class="vv-bento-kv"><span>Address</span><strong>${escapeVolHtml(v.address || '—')}</strong></div>
                    <div class="vv-bento-kv"><span>Emergency Next-of-Kin</span><strong>${escapeVolHtml(v.emergency_contact_name || '—')} ${v.emergency_contact_phone ? `(${escapeVolHtml(v.emergency_contact_phone)})` : ''}</strong></div>
                </div>
            </div>
            <div class="vv-bento-card" style="margin-top:0.85rem;">
                <h4 class="vol-sec-title"><i data-lucide="award" style="width:14px;height:14px;"></i> Skills &amp; Coordinator Remarks</h4>
                <div style="margin-bottom:0.55rem;">${_volRenderSkillChips(v.skills, 12)}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;">${escapeVolHtml(v.notes || 'No coordinator remarks recorded.')}</div>
            </div>
        `;
    } else {
        const logs = _volDossierActivities || [];
        const totalHrs = logs.reduce((s, a) => s + Number(a.hours_served || 0), 0);
        body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.85rem;">
                <div>
                    <strong style="font-size:0.9rem;">Logged Missions (${logs.length})</strong>
                    <span class="vol-wing-badge" style="margin-left:0.45rem;">${Math.round(totalHrs * 100) / 100}h cumulative</span>
                </div>
                <button type="button" class="vol-btn vol-btn-emerald" style="padding:0.36rem 0.78rem;font-size:0.75rem;" onclick="openLogVolunteerActivityModal(${v.id})">
                    + Log Service Hours
                </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.6rem;">
                ${logs.length ? logs.map(a => `
                    <div class="vv-act-item">
                        <div style="min-width:0;">
                            <div style="font-weight:800;font-size:0.84rem;color:var(--text-main);">${escapeVolHtml(a.activity_title)}</div>
                            <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;">
                                <span class="vol-code-pill">${escapeVolHtml(a.activity_type || 'Field Relief')}</span>
                                · ${escapeVolHtml(formatVolDate(a.activity_date))}
                                ${a.location ? ` · 📍 ${escapeVolHtml(a.location)}` : ''}
                                ${a.coordinator ? ` · Verified: ${escapeVolHtml(a.coordinator)}` : ''}
                            </div>
                            ${a.notes ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:4px;">${escapeVolHtml(a.notes)}</div>` : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:0.45rem;flex-shrink:0;">
                            <strong style="color:#059669;font-size:0.84rem;">${Number(a.hours_served || 0)}h</strong>
                            <button type="button" class="vol-action-btn is-danger" onclick="deleteVolunteerActivity(${a.id}, ${v.id})" title="Delete Log">
                                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="vv-bento-card" style="text-align:center;padding:1.8rem;">
                        <p style="margin:0;font-size:0.82rem;color:var(--text-muted);">No field hours logged for this volunteer yet.</p>
                    </div>
                `}
            </div>
        `;
    }
    refreshVolIcons();
}

/* ── 5. Log Field Service Hours Modal (#volActivityModal) ─────────────────── */
function openLogVolunteerActivityModal(volId = null) {
    const sel = document.getElementById('vaVolunteerId');
    if (sel) {
        if (!currentVolunteers.length) {
            if (typeof showToast === 'function') showToast('Register at least one volunteer first', 'warning');
            return;
        }
        sel.innerHTML = currentVolunteers.map(v =>
            `<option value="${v.id}">${escapeVolHtml(v.full_name)} (${escapeVolHtml(v.volunteer_no || 'VOL-' + v.id)})</option>`
        ).join('');
        if (volId) sel.value = String(volId);
    }
    document.getElementById('vaTitle').value = '';
    document.getElementById('vaType').value = 'Field Relief';
    document.getElementById('vaDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('vaHours').value = '4';
    document.getElementById('vaLocation').value = '';
    document.getElementById('vaCoordinator').value = '';
    document.getElementById('vaNotes').value = '';
    openModal('volActivityModal');
    refreshVolIcons();
}

async function submitVolunteerActivity(e) {
    if (e) e.preventDefault();
    const volId = document.getElementById('vaVolunteerId')?.value;
    const title = (document.getElementById('vaTitle')?.value || '').trim();
    if (!volId || !title) {
        if (typeof showToast === 'function') showToast('Select volunteer and mission title', 'warning');
        return;
    }

    const payload = {
        activity_title: title,
        activity_type: document.getElementById('vaType')?.value || 'Field Relief',
        activity_date: document.getElementById('vaDate')?.value || new Date().toISOString().slice(0, 10),
        hours_served: Number(document.getElementById('vaHours')?.value || 0),
        location: (document.getElementById('vaLocation')?.value || '').trim(),
        coordinator: (document.getElementById('vaCoordinator')?.value || '').trim(),
        notes: (document.getElementById('vaNotes')?.value || '').trim()
    };

    const btn = document.getElementById('vaSubmitBtn');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`/api/edf/volunteers/${volId}/activities`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to log service hours');
        closeModal('volActivityModal');
        if (typeof showToast === 'function') showToast(data.message || 'Service hours logged', 'success');
        await fetchVolunteers();

        const viewModal = document.getElementById('viewVolunteerModal');
        if (viewModal && viewModal.style.display !== 'none' && _volDossierActive && Number(_volDossierActive.id) === Number(volId)) {
            _volDossierActive = currentVolunteers.find(x => Number(x.id) === Number(volId)) || _volDossierActive;
            await _loadVolunteerActivitiesForDossier(volId);
            switchVolunteerDossierTab('activities');
        }
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Save failed', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function deleteVolunteerActivity(actId, volId) {
    _volPendingConfirmAction = async () => {
        const res = await fetch(`/api/edf/volunteers/activities/${actId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove activity entry');
        if (typeof showToast === 'function') showToast('Service log entry removed', 'info');
        await fetchVolunteers();
        if (_volDossierActive && Number(_volDossierActive.id) === Number(volId)) {
            _volDossierActive = currentVolunteers.find(x => Number(x.id) === Number(volId)) || _volDossierActive;
            await _loadVolunteerActivitiesForDossier(volId);
            switchVolunteerDossierTab('activities');
        }
    };
    document.getElementById('volConfirmTitle').textContent = 'Remove Service Log Entry';
    document.getElementById('volConfirmMsg').textContent = 'Remove this logged mission entry and recalculate total hours for the volunteer?';
    openModal('volConfirmModal');
    refreshVolIcons();
}

/* ── 6. Official Field Volunteer Pass & QR Modal (#volunteerIdCardModal) ─── */
function openVolunteerIdCardModal(id) {
    const v = currentVolunteers.find(x => Number(x.id) === Number(id));
    if (!v) return;
    _volIdCardActive = v;

    const code = v.volunteer_no || `VOL-${String(v.id).padStart(3, '0')}`;
    const box = document.getElementById('volIdCardContainer');
    if (box) {
        box.innerHTML = `
            <div class="vol-id-preview-card" id="volIdPrintableNode">
                <div class="vol-id-top">
                    <div>
                        <div style="font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:#fde68a;font-weight:800;">EDF GALGAMUWA · FIELD CORPS</div>
                        <div style="font-size:0.96rem;font-weight:800;">OFFICIAL VOLUNTEER PASS</div>
                    </div>
                    <span style="padding:0.2rem 0.6rem;border-radius:999px;background:rgba(255,255,255,0.16);border:1px solid rgba(253,230,138,0.4);font-size:0.7rem;font-weight:800;font-family:monospace;">
                        ${escapeVolHtml(code)}
                    </span>
                </div>
                <div class="vol-id-body">
                    <div class="vol-id-photo">
                        ${v.photo_url ? `<img src="${escapeVolHtml(v.photo_url)}" alt="${escapeVolHtml(v.full_name)}">` : escapeVolHtml(getVolInitials(v.full_name))}
                    </div>
                    <div style="flex:1;min-width:140px;">
                        <div style="font-size:1.08rem;font-weight:800;">${escapeVolHtml(v.full_name)}</div>
                        <div style="font-size:0.78rem;color:#a7f3d0;font-weight:700;margin-top:2px;">${escapeVolHtml(v.wing || 'Field Relief')} · ${escapeVolHtml(v.role_tier || 'Field Volunteer')}</div>
                        <div style="font-size:0.72rem;color:rgba(255,255,255,0.86);margin-top:6px;">
                            <div>Phone: ${escapeVolHtml(v.phone || '—')}${v.blood_group ? ` · Blood: <strong style="color:#fde68a;">${escapeVolHtml(v.blood_group)}</strong>` : ''}</div>
                            <div>NIC: ${escapeVolHtml(v.nic_number || '—')} · ${Number(v.verified_id) === 1 ? '✓ ID Verified' : 'Field Pass'}</div>
                            ${v.emergency_contact_phone ? `<div>Emergency: ${escapeVolHtml(v.emergency_contact_phone)}</div>` : ''}
                        </div>
                    </div>
                    <div class="vol-id-qr-wrap" id="volIdQrMount"></div>
                </div>
            </div>
        `;
        const qrMount = document.getElementById('volIdQrMount');
        if (qrMount && typeof QRCode !== 'undefined') {
            new QRCode(qrMount, {
                text: `EDF-VOLUNTEER|${code}|${v.full_name}|${v.wing || 'Field Relief'}`,
                width: 72,
                height: 72,
                colorDark: '#064e3b',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }
    openModal('volunteerIdCardModal');
    refreshVolIcons();
}

async function downloadVolunteerIdPng() {
    const node = document.getElementById('volIdPrintableNode');
    if (!node || typeof window.html2canvas !== 'function') {
        if (typeof showToast === 'function') showToast('PNG export requires html2canvas library', 'warning');
        return;
    }
    try {
        const canvas = await window.html2canvas(node, { scale: 2, useCORS: true, backgroundColor: null });
        const link = document.createElement('a');
        const code = (_volIdCardActive?.volunteer_no || 'EDF-Volunteer').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `${code}-Field-Pass.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'PNG export failed', 'error');
    }
}

function printVolunteerIdPass() {
    const node = document.getElementById('volIdPrintableNode');
    if (!node) return;
    const w = window.open('', '_blank', 'width=560,height=420');
    if (!w) return;
    w.document.write(`<html><head><title>Volunteer Field Pass</title></head><body style="font-family:sans-serif;padding:24px;">${node.outerHTML}<script>setTimeout(()=>window.print(),200);</script></body></html>`);
    w.document.close();
}

/* ── 7. Delete / Confirm & Roster Export ──────────────────────────────────── */
function deleteVolunteer(id) {
    const v = currentVolunteers.find(x => Number(x.id) === Number(id));
    _volPendingConfirmAction = async () => {
        const res = await fetch(`/api/edf/volunteers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove volunteer');
        if (typeof showToast === 'function') showToast(`Removed ${v?.full_name || 'volunteer'} from registry`, 'info');
        await fetchVolunteers();
        if (typeof fetchStats === 'function') fetchStats();
    };
    document.getElementById('volConfirmTitle').textContent = 'Remove Volunteer Record';
    document.getElementById('volConfirmMsg').textContent = `Permanently remove "${v?.full_name || 'this volunteer'}" and their service hour logs from the EDF Volunteer Registry?`;
    openModal('volConfirmModal');
    refreshVolIcons();
}

async function executeVolunteerConfirmedAction() {
    if (typeof _volPendingConfirmAction !== 'function') {
        closeModal('volConfirmModal');
        return;
    }
    const btn = document.getElementById('volConfirmExecBtn');
    if (btn) btn.disabled = true;
    try {
        await _volPendingConfirmAction();
        _volPendingConfirmAction = null;
        closeModal('volConfirmModal');
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Action failed', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function exportVolunteersCsv() {
    const rows = _volGetFiltered();
    if (!rows.length) {
        if (typeof showToast === 'function') showToast('No volunteer rows to export', 'warning');
        return;
    }
    const headers = ['Badge ID', 'Full Name', 'Wing', 'Role Tier', 'Phone', 'WhatsApp', 'Email', 'Zone/City', 'Availability', 'Transport', 'Skills', 'Hours Served', 'Missions', 'Status', 'Verified ID'];
    const csvLines = [headers.map(h => `"${h}"`).join(',')];
    for (const v of rows) {
        const vals = [
            v.volunteer_no || `VOL-${v.id}`,
            v.full_name,
            v.wing || 'Field Relief',
            v.role_tier || 'Field Volunteer',
            v.phone || '',
            v.whatsapp || '',
            v.email || '',
            v.city || '',
            v.availability || '',
            v.transport_mode || 'None',
            v.skills || '',
            v.logged_hours_sum ?? v.total_hours ?? 0,
            v.logged_activities_count ?? v.deployments_count ?? 0,
            v.status || 'active',
            Number(v.verified_id) === 1 ? 'Yes' : 'No'
        ];
        csvLines.push(vals.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EDF-Volunteers-Roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function printVolunteersRoster() {
    const rows = _volGetFiltered();
    const w = window.open('', '_blank', 'width=960,height=680');
    if (!w) return;
    const trs = rows.map(v => `
        <tr>
            <td>${escapeVolHtml(v.volunteer_no || `VOL-${v.id}`)}</td>
            <td><strong>${escapeVolHtml(v.full_name)}</strong></td>
            <td>${escapeVolHtml(v.wing || 'Field Relief')}</td>
            <td>${escapeVolHtml(v.role_tier || 'Field Volunteer')}</td>
            <td>${escapeVolHtml(v.phone || '—')}</td>
            <td>${escapeVolHtml(v.availability || 'Weekends')}</td>
            <td>${escapeVolHtml(v.skills || '—')}</td>
            <td>${Number(v.logged_hours_sum ?? v.total_hours ?? 0)}h</td>
            <td>${escapeVolHtml(v.status || 'active')}</td>
        </tr>
    `).join('');
    w.document.write(`
        <html><head><title>EDF Volunteer Force Roster</title>
        <style>body{font-family:system-ui,sans-serif;padding:24px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;} th{background:#f1f5f9;}</style>
        </head><body>
        <h2>EDF Galgamuwa — Field Volunteer Force Roster (${rows.length})</h2>
        <table><thead><tr><th>Badge ID</th><th>Full Name</th><th>Wing</th><th>Role</th><th>Phone</th><th>Availability</th><th>Skills</th><th>Hours</th><th>Status</th></tr></thead><tbody>${trs}</tbody></table>
        <script>setTimeout(()=>window.print(),250);</script>
        </body></html>
    `);
    w.document.close();
}

// Keep Register Volunteer button accessible if triggered via legacy openModal('volunteerModal')
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('volunteersTab')) {
        _volRenderWingPills();
    }
});


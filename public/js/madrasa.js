/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *   EDF GALGAMUWA — Madrasa Class, Student, Muallimah & Attendance Controller
 *   Handles all CRUD operations, daily roll call batch save, filtering, CSV export
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let mdrMuallimahs = [];
let mdrClasses = [];
let mdrStudents = [];
let mdrAttendanceHistory = [];
let mdrStats = {};
let mdrRollSheet = null;
let mdrRollDraft = new Map();
let mdrActiveSubTab = 'students';
let mdrConfirmResolver = null;

const MDR_SECTION_META = {
    students: {
        title: 'Madrasa · Student Management',
        navLabel: 'Student Management',
        badge: 'Admissions · Juz & Progress',
        sub: 'Enroll Madrasa scholars, assign Halqahs, track Juz/Kitab milestones, guardian contacts, fee status, and export rosters.'
    },
    attendance: {
        title: 'Madrasa · Attendance Management',
        navLabel: 'Attendance Management',
        badge: 'Daily Roll Call · History',
        sub: 'Take daily class roll calls with one-click batch markers, record Sabaq/lesson notes, and manage historical attendance entries.'
    },
    muallimahs: {
        title: 'Madrasa · Muallimah Management',
        navLabel: 'Muallimah Management',
        badge: 'Faculty · Specializations',
        sub: 'Maintain Muallimah educator profiles, Ijazah qualifications, class assignments, monthly stipends, and duty statuses.'
    },
    classes: {
        title: 'Madrasa · Class Management',
        navLabel: 'Class Management',
        badge: 'Halqahs · Schedules · Capacity',
        sub: 'Create and organize Halqahs & class levels, assign Muallimahs, manage room capacity, timetables, and monthly fee tiers.'
    }
};

function mdrEsc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function mdrTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

function mdrNotify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position:fixed;right:20px;bottom:20px;z-index:99999;padding:0.75rem 1.05rem;border-radius:12px;
        font-size:0.84rem;font-weight:700;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,0.28);
        background:${type === 'error' ? '#ef4444' : (type === 'success' ? '#059669' : '#0f172a')};
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
}

async function mdrApi(path, options = {}) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const headers = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };
    const res = await fetch(`/api/madrasa${path}`, { ...options, headers });
    let data = null;
    try {
        data = await res.json();
    } catch (_err) {
        data = null;
    }
    if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data;
}

function mdrInitials(name) {
    const parts = String(name || 'M').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function mdrFormatLkr(val) {
    const num = Number(val) || 0;
    return num > 0 ? `LKR ${num.toLocaleString()}` : 'Free / Waived';
}

function mdrBadge(label, tone = '') {
    return `<span class="mdr-badge ${tone}">${mdrEsc(label)}</span>`;
}

function mdrStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    const map = {
        active: ['Active', 'emerald'],
        present: ['Present', 'emerald'],
        paid: ['Paid', 'emerald'],
        sponsored: ['Sponsored', 'gold'],
        on_leave: ['On Leave', 'gold'],
        paused: ['Paused', 'gold'],
        late: ['Late', 'gold'],
        pending: ['Pending', 'gold'],
        exempt: ['Exempt', 'blue'],
        excused: ['Excused', 'blue'],
        graduated: ['Graduated', 'blue'],
        suspended: ['Suspended', 'gold'],
        absent: ['Absent', 'red'],
        withdrawn: ['Withdrawn', 'red'],
        inactive: ['Inactive', 'red'],
        archived: ['Archived', '']
    };
    const [text, tone] = map[s] || [status || 'Unknown', ''];
    return mdrBadge(text, tone);
}

/* ── Modal Helpers & Branded Confirmation ───────────────────────────────────── */
function openMdrModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    if (typeof window.initEdfLottieIcons === 'function') {
        window.initEdfLottieIcons(el);
    }
}

function closeMdrModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    if (id === 'mdrConfirmModal' && mdrConfirmResolver) {
        const resolve = mdrConfirmResolver;
        mdrConfirmResolver = null;
        resolve(false);
    }
}

function closeMdrModalByBackdrop(event, id) {
    if (event.target && event.target.id === id) {
        closeMdrModal(id);
    }
}

function mdrAskConfirm(title, message, proceedLabel = 'Delete Record') {
    const titleEl = document.getElementById('mdrConfirmTitle');
    const msgEl = document.getElementById('mdrConfirmMsg');
    const btn = document.getElementById('mdrConfirmProceedBtn');
    if (!titleEl || !msgEl || !btn) return Promise.resolve(false);

    titleEl.textContent = title;
    msgEl.textContent = message;
    btn.textContent = proceedLabel;

    return new Promise((resolve) => {
        mdrConfirmResolver = resolve;
        btn.onclick = () => {
            const fn = mdrConfirmResolver;
            mdrConfirmResolver = null;
            closeMdrModal('mdrConfirmModal');
            if (fn) fn(true);
        };
        openMdrModal('mdrConfirmModal');
    });
}

/* ── Workspace Loader & KPIs ────────────────────────────────────────────────── */
async function fetchMadrasaWorkspace(showToastOnDone = false) {
    try {
        const [statsRes, mlmRes, clsRes, stuRes, attRes] = await Promise.all([
            mdrApi('/stats'),
            mdrApi('/muallimahs'),
            mdrApi('/classes'),
            mdrApi('/students'),
            mdrApi('/attendance?limit=200')
        ]);

        mdrStats = statsRes || {};
        mdrMuallimahs = Array.isArray(mlmRes) ? mlmRes : [];
        mdrClasses = Array.isArray(clsRes) ? clsRes : [];
        mdrStudents = Array.isArray(stuRes) ? stuRes : [];
        mdrAttendanceHistory = Array.isArray(attRes) ? attRes : [];

        mdrPopulateDropdowns();
        mdrUpdateKpis();
        renderMdrClasses();
        renderMdrStudents();
        renderMdrMuallimahs();
        renderMdrAttendanceHistory();

        const rollDateInput = document.getElementById('mdrRollDateInput');
        if (rollDateInput && !rollDateInput.value) {
            rollDateInput.value = mdrTodayStr();
        }
        const rollClassSelect = document.getElementById('mdrRollClassSelect');
        if (rollClassSelect && !rollClassSelect.value && mdrClasses.length > 0) {
            const firstActive = mdrClasses.find((c) => c.status === 'active') || mdrClasses[0];
            rollClassSelect.value = String(firstActive.id);
        }
        if (rollClassSelect && rollClassSelect.value) {
            await mdrLoadRollCallSheet(true);
        } else {
            renderMdrRollCallSheet();
        }

        if (typeof window.initEdfLottieIcons === 'function') {
            window.initEdfLottieIcons(document.getElementById('madrasaTab'));
        }
        if (showToastOnDone) mdrNotify('Madrasa workspace synchronized.', 'success');
    } catch (err) {
        console.error('[Madrasa workspace]', err);
        mdrNotify(err.message || 'Could not load Madrasa data', 'error');
    }
}

function mdrUpdateKpis() {
    const activeCls = mdrStats.active_classes ?? mdrClasses.filter((c) => c.status === 'active').length;
    const totalCls = mdrStats.total_classes ?? mdrClasses.length;
    const activeStu = mdrStats.active_students ?? mdrStudents.filter((s) => s.status === 'active').length;
    const totalStu = mdrStats.total_students ?? mdrStudents.length;
    const activeMlm = mdrStats.active_muallimahs ?? mdrMuallimahs.filter((m) => m.status === 'active').length;
    const totalMlm = mdrStats.total_muallimahs ?? mdrMuallimahs.length;
    const markedToday = mdrStats.today_marked ?? 0;
    const presentToday = mdrStats.today_present ?? 0;
    const ratePct = mdrStats.today_rate_pct ?? 0;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set('mdrKpiClassesVal', activeCls);
    set('mdrKpiClassesSub', `${totalCls} total registered Halqah${totalCls === 1 ? '' : 's'}`);
    set('mdrKpiStudentsVal', activeStu);
    set('mdrKpiStudentsSub', `${totalStu} total student profile${totalStu === 1 ? '' : 's'}`);
    set('mdrKpiMuallimahsVal', activeMlm);
    set('mdrKpiMuallimahsSub', `${totalMlm} faculty on roster`);
    set('mdrKpiAttendanceVal', markedToday > 0 ? `${ratePct}%` : '—');
    set('mdrKpiAttendanceSub', markedToday > 0 ? `${presentToday} / ${markedToday} present or late today` : 'No roll call marked today');

    set('mdrTabClassesCount', mdrClasses.length);
    set('mdrTabStudentsCount', mdrStudents.length);
    set('mdrTabMuallimahsCount', mdrMuallimahs.length);
    set('mdrTabAttendanceCount', mdrAttendanceHistory.length);

    set('sbMdrStudentsBadge', mdrStudents.length);
    set('sbMdrAttendanceBadge', mdrAttendanceHistory.length);
    set('sbMdrMuallimahsBadge', mdrMuallimahs.length);
    set('sbMdrClassesBadge', mdrClasses.length);

    const sbBadge = document.getElementById('sbMadrasaBadge');
    if (sbBadge) sbBadge.textContent = activeStu > 0 ? `${activeStu} Scholars` : 'Maktab';
}

function mdrPopulateDropdowns() {
    const syncSelect = (id, placeholder, list, labelFn) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = `<option value="">${mdrEsc(placeholder)}</option>` +
            list.map((item) => `<option value="${item.id}">${mdrEsc(labelFn(item))}</option>`).join('');
        if (prev && list.some((x) => String(x.id) === String(prev))) {
            sel.value = prev;
        }
    };

    const classLabel = (c) => `${c.class_code || ''} · ${c.class_name}${c.muallimah_name ? ` (${c.muallimah_name})` : ''}`;
    const teacherLabel = (m) => `${m.staff_code ? `${m.staff_code} · ` : ''}${m.full_name}`;

    syncSelect('mdrRollClassSelect', 'Select Class / Halqah...', mdrClasses, classLabel);
    syncSelect('mdrAttHistClassFilter', 'All Classes', mdrClasses, classLabel);
    syncSelect('mdrStudentClassFilter', 'All Classes', mdrClasses, classLabel);
    syncSelect('mdrStudentClass', 'Unassigned', mdrClasses, classLabel);
    syncSelect('mdrAttClassId', 'Select class...', mdrClasses, classLabel);

    syncSelect('mdrClassMuallimahFilter', 'All Muallimahs', mdrMuallimahs, teacherLabel);
    syncSelect('mdrClassMuallimah', 'Unassigned', mdrMuallimahs, teacherLabel);
}

function syncMadrasaSidebarState(opts = {}) {
    const { expandSubmenu = true } = opts;
    const subLinks = document.querySelectorAll('#madrasaSubmenu .nav-submenu-link[data-madrasa-section]');
    let matchedLink = null;
    subLinks.forEach((link) => {
        const isMatch = link.getAttribute('data-madrasa-section') === mdrActiveSubTab;
        link.classList.toggle('active', isMatch);
        if (isMatch) matchedLink = link;
    });

    const parentMenu = document.getElementById('madrasaMenu');
    const submenu = document.getElementById('madrasaSubmenu');
    if (parentMenu && document.getElementById('madrasaTab')?.classList.contains('active')) {
        parentMenu.classList.add('active');
    }
    if (expandSubmenu && submenu) {
        submenu.style.display = 'block';
        const arrow = parentMenu?.querySelector('.menu-arrow');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }

    const meta = MDR_SECTION_META[mdrActiveSubTab];
    const titleEl = document.getElementById('currentTabTitle');
    if (titleEl && document.getElementById('madrasaTab')?.classList.contains('active') && meta) {
        titleEl.textContent = meta.navLabel;
    }
    if (matchedLink && typeof window.refreshEdfLottieState === 'function') {
        window.refreshEdfLottieState();
    }
}

function mdrUpdateHeroBanner(subTab) {
    const meta = MDR_SECTION_META[subTab] || MDR_SECTION_META.students;
    const heroTitle = document.getElementById('mdrHeroTitle');
    const heroBadge = document.getElementById('mdrHeroBadge');
    const heroSub = document.getElementById('mdrHeroSub');
    if (heroTitle) heroTitle.textContent = meta.title;
    if (heroBadge) heroBadge.textContent = meta.badge;
    if (heroSub) heroSub.textContent = meta.sub;
}

function switchMadrasaSubTab(subTab, opts = {}) {
    if (!MDR_SECTION_META[subTab]) subTab = 'students';
    mdrActiveSubTab = subTab;
    document.querySelectorAll('#madrasaTab .mdr-subtab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === subTab);
    });
    document.querySelectorAll('#madrasaTab .mdr-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `mdrPanel-${subTab}`);
    });
    mdrUpdateHeroBanner(subTab);
    if (!opts.skipSidebarSync) {
        syncMadrasaSidebarState({ expandSubmenu: true });
    }
}

/* ── Attendance Roll Call Sheet & Batch Save ────────────────────────────────── */
async function mdrLoadRollCallSheet(silent = false) {
    const classId = document.getElementById('mdrRollClassSelect')?.value;
    const dateVal = document.getElementById('mdrRollDateInput')?.value || mdrTodayStr();
    if (!classId) {
        mdrRollSheet = null;
        mdrRollDraft = new Map();
        renderMdrRollCallSheet();
        if (!silent) mdrNotify('Please select a class to load its roll call sheet.', 'info');
        return;
    }

    try {
        const data = await mdrApi(`/attendance/sheet?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(dateVal)}`);
        mdrRollSheet = data;
        mdrRollDraft = new Map();
        (data.students || []).forEach((row) => {
            mdrRollDraft.set(Number(row.student_id), {
                status: row.attendance_status || 'present',
                lesson_note: row.lesson_note || '',
                remarks: row.remarks || ''
            });
        });
        renderMdrRollCallSheet();
    } catch (err) {
        mdrNotify(err.message || 'Failed to load roll call sheet', 'error');
    }
}

function mdrUpdateRollDraftField(studentId, field, value) {
    const id = Number(studentId);
    const cur = mdrRollDraft.get(id) || { status: 'present', lesson_note: '', remarks: '' };
    cur[field] = value;
    mdrRollDraft.set(id, cur);
    if (field === 'status') {
        const rowEl = document.querySelector(`tr[data-mdr-roll-student="${id}"]`);
        if (rowEl) {
            rowEl.querySelectorAll('.mdr-att-pill').forEach((btn) => {
                btn.classList.toggle('active', btn.getAttribute('data-status') === value);
            });
        }
        mdrRenderRollSummaryBar();
    }
}

function mdrBatchMarkStatus(status) {
    if (!mdrRollSheet || !(mdrRollSheet.students || []).length) {
        mdrNotify('Load a class with enrolled students first.', 'info');
        return;
    }
    mdrRollSheet.students.forEach((stu) => {
        const id = Number(stu.student_id);
        const cur = mdrRollDraft.get(id) || { status: 'present', lesson_note: '', remarks: '' };
        cur.status = status;
        mdrRollDraft.set(id, cur);
    });
    renderMdrRollCallSheet();
}

function mdrRenderRollSummaryBar() {
    const bar = document.getElementById('mdrRollSummaryBar');
    if (!bar) return;
    if (!mdrRollSheet || !mdrRollSheet.classInfo) {
        bar.innerHTML = `<span style="font-size:0.8rem;color:var(--text-muted);">Select a class to inspect or record daily roll call.</span>`;
        return;
    }

    const students = mdrRollSheet.students || [];
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    students.forEach((s) => {
        const st = mdrRollDraft.get(Number(s.student_id))?.status || 'present';
        if (counts[st] !== undefined) counts[st]++;
    });
    const cls = mdrRollSheet.classInfo;
    const savedAlready = students.filter((s) => !!s.attendance_id).length;

    bar.innerHTML = `
        <div style="font-size:0.81rem;font-weight:700;color:var(--text-main);">
            ${mdrEsc(cls.class_name)} · <span style="color:var(--text-muted);font-weight:600;">${mdrEsc(cls.muallimah_name || 'Unassigned Muallimah')} · ${mdrEsc(mdrRollSheet.date)}</span>
        </div>
        <div class="mdr-roll-badges">
            <span class="mdr-stat-chip">Scholars: ${students.length}</span>
            <span class="mdr-stat-chip present">Present: ${counts.present}</span>
            <span class="mdr-stat-chip absent">Absent: ${counts.absent}</span>
            <span class="mdr-stat-chip late">Late: ${counts.late}</span>
            <span class="mdr-stat-chip excused">Excused: ${counts.excused}</span>
            <span class="mdr-stat-chip">${savedAlready > 0 ? `${savedAlready} Saved` : 'Draft Ready'}</span>
        </div>
    `;
}

function renderMdrRollCallSheet() {
    const tbody = document.getElementById('mdrRollSheetBody');
    mdrRenderRollSummaryBar();
    if (!tbody) return;

    if (!mdrRollSheet) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="mdr-empty-box">Choose a Halqah / class and date above to load the attendance register.</div></td></tr>`;
        return;
    }

    const students = mdrRollSheet.students || [];
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="mdr-empty-box">No active students are currently assigned to this class. Enroll or assign students to begin roll call.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = students.map((stu) => {
        const id = Number(stu.student_id);
        const draft = mdrRollDraft.get(id) || { status: 'present', lesson_note: '', remarks: '' };
        const pill = (key, label) => `<button type="button" class="mdr-att-pill ${draft.status === key ? 'active' : ''}" data-status="${key}" onclick="mdrUpdateRollDraftField(${id}, 'status', '${key}')">${label}</button>`;
        return `
            <tr data-mdr-roll-student="${id}">
                <td>
                    <div class="mdr-avatar-cell">
                        <div class="mdr-avatar">${mdrEsc(mdrInitials(stu.full_name))}</div>
                        <div>
                            <div class="mdr-primary-text">${mdrEsc(stu.full_name)}</div>
                            <div class="mdr-sub-text">${mdrEsc(stu.admission_no || '')}${stu.attendance_id ? ' · Recorded' : ' · Pending Save'}</div>
                        </div>
                    </div>
                </td>
                <td>${mdrBadge(stu.current_juz_or_level || 'General', 'gold')}</td>
                <td>
                    <div class="mdr-att-pill-group">
                        ${pill('present', 'P · Present')}
                        ${pill('absent', 'A · Absent')}
                        ${pill('late', 'L · Late')}
                        ${pill('excused', 'E · Excused')}
                    </div>
                </td>
                <td>
                    <input type="text" class="mdr-input" style="width:100%;min-width:170px;" value="${mdrEsc(draft.lesson_note)}" placeholder="Sabaq / Ayah / Lesson..." oninput="mdrUpdateRollDraftField(${id}, 'lesson_note', this.value)">
                </td>
                <td>
                    <input type="text" class="mdr-input" style="width:100%;min-width:140px;" value="${mdrEsc(draft.remarks)}" placeholder="Optional remarks..." oninput="mdrUpdateRollDraftField(${id}, 'remarks', this.value)">
                </td>
            </tr>
        `;
    }).join('');
}

async function mdrSaveRollCallSheet() {
    if (!mdrRollSheet || !(mdrRollSheet.students || []).length) {
        mdrNotify('No students loaded in the roll call sheet.', 'error');
        return;
    }
    const classId = Number(mdrRollSheet.classInfo?.id || document.getElementById('mdrRollClassSelect')?.value);
    const dateVal = document.getElementById('mdrRollDateInput')?.value || mdrRollSheet.date || mdrTodayStr();
    const records = (mdrRollSheet.students || []).map((stu) => {
        const draft = mdrRollDraft.get(Number(stu.student_id)) || { status: 'present', lesson_note: '', remarks: '' };
        return {
            student_id: stu.student_id,
            status: draft.status,
            lesson_note: draft.lesson_note,
            remarks: draft.remarks
        };
    });

    const btn = document.getElementById('mdrSaveRollBtn');
    if (btn) btn.disabled = true;
    try {
        const res = await mdrApi('/attendance/batch', {
            method: 'POST',
            body: JSON.stringify({ class_id: classId, attendance_date: dateVal, records })
        });
        mdrNotify(res?.message || 'Roll call saved successfully.', 'success');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to save roll call', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ── Attendance History Ledger & Single Entry Modal CRUD ────────────────────── */
function mdrResetAttHistoryFilters() {
    ['mdrAttHistSearch', 'mdrAttHistClassFilter', 'mdrAttHistStatusFilter', 'mdrAttHistDateFilter'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderMdrAttendanceHistory();
}

function renderMdrAttendanceHistory() {
    const tbody = document.getElementById('mdrAttHistBody');
    if (!tbody) return;
    const q = (document.getElementById('mdrAttHistSearch')?.value || '').trim().toLowerCase();
    const clsFilter = document.getElementById('mdrAttHistClassFilter')?.value || '';
    const stFilter = document.getElementById('mdrAttHistStatusFilter')?.value || '';
    const dateFilter = document.getElementById('mdrAttHistDateFilter')?.value || '';

    const filtered = mdrAttendanceHistory.filter((row) => {
        if (clsFilter && String(row.class_id) !== String(clsFilter)) return false;
        if (stFilter && row.status !== stFilter) return false;
        if (dateFilter && String(row.attendance_date || '').slice(0, 10) !== dateFilter) return false;
        if (q) {
            const hay = `${row.student_name || ''} ${row.admission_no || ''} ${row.class_name || ''} ${row.lesson_note || ''} ${row.remarks || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="mdr-empty-box">No attendance records match your filters yet.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((row) => `
        <tr>
            <td><strong>${mdrEsc(String(row.attendance_date || '').slice(0, 10))}</strong><div class="mdr-sub-text">By ${mdrEsc(row.marked_by || 'admin')}</div></td>
            <td><div class="mdr-primary-text">${mdrEsc(row.student_name)}</div><div class="mdr-sub-text">${mdrEsc(row.admission_no || '')}</div></td>
            <td><div class="mdr-primary-text">${mdrEsc(row.class_name)}</div><div class="mdr-sub-text">${mdrEsc(row.muallimah_name || 'Unassigned')}</div></td>
            <td>${mdrStatusBadge(row.status)}</td>
            <td><div>${mdrEsc(row.lesson_note || '—')}</div>${row.remarks ? `<div class="mdr-sub-text">${mdrEsc(row.remarks)}</div>` : ''}</td>
            <td style="text-align:right;white-space:nowrap;">
                <button type="button" class="mdr-icon-btn emerald" onclick="openMdrAttendanceModal('edit', ${row.id})">Edit</button>
                <button type="button" class="mdr-icon-btn danger" onclick="deleteMdrAttendance(${row.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function mdrSyncAttModalStudents(preselectStudentId = null) {
    const classSel = document.getElementById('mdrAttClassId');
    const stuSel = document.getElementById('mdrAttStudentId');
    if (!classSel || !stuSel) return;
    const classId = classSel.value;
    const matching = classId
        ? mdrStudents.filter((s) => String(s.class_id || '') === String(classId))
        : mdrStudents;
    const list = matching.length > 0 ? matching : mdrStudents;
    stuSel.innerHTML = `<option value="">Select student...</option>` +
        list.map((s) => `<option value="${s.id}">${mdrEsc(`${s.admission_no || ''} · ${s.full_name}`)}</option>`).join('');
    if (preselectStudentId) {
        stuSel.value = String(preselectStudentId);
    }
}

function openMdrAttendanceModal(mode = 'add', attId = null) {
    const form = document.getElementById('mdrAttendanceForm');
    if (form) form.reset();
    document.getElementById('mdrAttId').value = '';

    if (mode === 'edit' && attId) {
        const rec = mdrAttendanceHistory.find((a) => Number(a.id) === Number(attId));
        if (!rec) {
            mdrNotify('Attendance record not found.', 'error');
            return;
        }
        document.getElementById('mdrAttModalTitle').textContent = 'Edit Attendance Record';
        document.getElementById('mdrAttId').value = String(rec.id);
        document.getElementById('mdrAttClassId').value = String(rec.class_id || '');
        mdrSyncAttModalStudents(rec.student_id);
        document.getElementById('mdrAttDate').value = String(rec.attendance_date || mdrTodayStr()).slice(0, 10);
        document.getElementById('mdrAttStatus').value = rec.status || 'present';
        document.getElementById('mdrAttLessonNote').value = rec.lesson_note || '';
        document.getElementById('mdrAttRemarks').value = rec.remarks || '';
    } else {
        document.getElementById('mdrAttModalTitle').textContent = 'Log Attendance Entry';
        const defaultCls = document.getElementById('mdrRollClassSelect')?.value || (mdrClasses[0]?.id ? String(mdrClasses[0].id) : '');
        document.getElementById('mdrAttClassId').value = defaultCls;
        mdrSyncAttModalStudents();
        document.getElementById('mdrAttDate').value = document.getElementById('mdrRollDateInput')?.value || mdrTodayStr();
        document.getElementById('mdrAttStatus').value = 'present';
    }
    openMdrModal('mdrAttendanceModal');
}

async function saveMdrAttendance(e) {
    e.preventDefault();
    const editId = document.getElementById('mdrAttId').value;
    const payload = {
        class_id: document.getElementById('mdrAttClassId').value,
        student_id: document.getElementById('mdrAttStudentId').value,
        attendance_date: document.getElementById('mdrAttDate').value,
        status: document.getElementById('mdrAttStatus').value,
        lesson_note: document.getElementById('mdrAttLessonNote').value.trim(),
        remarks: document.getElementById('mdrAttRemarks').value.trim()
    };

    try {
        if (editId) {
            await mdrApi(`/attendance/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            mdrNotify('Attendance record updated.', 'success');
        } else {
            await mdrApi('/attendance', { method: 'POST', body: JSON.stringify(payload) });
            mdrNotify('Attendance record saved.', 'success');
        }
        closeMdrModal('mdrAttendanceModal');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to save attendance entry', 'error');
    }
}

async function deleteMdrAttendance(attId) {
    const rec = mdrAttendanceHistory.find((a) => Number(a.id) === Number(attId));
    const label = rec ? `${rec.student_name} (${String(rec.attendance_date || '').slice(0, 10)})` : `#${attId}`;
    const confirmed = await mdrAskConfirm('Delete Attendance Entry', `Remove attendance record for ${label}? This action cannot be undone.`, 'Delete Entry');
    if (!confirmed) return;

    try {
        await mdrApi(`/attendance/${attId}`, { method: 'DELETE' });
        mdrNotify('Attendance entry deleted.', 'success');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to delete attendance entry', 'error');
    }
}

/* ── Classes & Halqahs CRUD ─────────────────────────────────────────────────── */
function renderMdrClasses() {
    const grid = document.getElementById('mdrClassesGrid');
    if (!grid) return;

    const q = (document.getElementById('mdrClassSearch')?.value || '').trim().toLowerCase();
    const levelFilter = document.getElementById('mdrClassLevelFilter')?.value || '';
    const mlmFilter = document.getElementById('mdrClassMuallimahFilter')?.value || '';
    const stFilter = document.getElementById('mdrClassStatusFilter')?.value || '';

    const filtered = mdrClasses.filter((cls) => {
        if (levelFilter && cls.level !== levelFilter) return false;
        if (mlmFilter && String(cls.muallimah_id || '') !== String(mlmFilter)) return false;
        if (stFilter && cls.status !== stFilter) return false;
        if (q) {
            const hay = `${cls.class_code || ''} ${cls.class_name || ''} ${cls.level || ''} ${cls.room_name || ''} ${cls.schedule_days || ''} ${cls.muallimah_name || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="mdr-empty-box" style="grid-column:1/-1;">No Madrasa classes match your search. Click <strong>+ Create Class</strong> to add a new Halqah.</div>`;
        return;
    }

    grid.innerHTML = filtered.map((cls) => {
        const cap = Math.max(1, Number(cls.capacity) || 25);
        const enrolled = Number(cls.student_count) || 0;
        const pct = Math.min(100, Math.round((enrolled / cap) * 100));
        const fillClass = pct >= 100 ? 'full' : (pct >= 80 ? 'warn' : '');
        const todayPresent = Number(cls.today_present_count) || 0;
        const todayMarked = Number(cls.today_marked_count) || 0;

        return `
            <div class="mdr-class-card">
                <div class="mdr-class-top">
                    <div>
                        <span class="mdr-class-code">${mdrEsc(cls.class_code || 'CLS')}</span>
                        <h4 class="mdr-class-name">${mdrEsc(cls.class_name)}</h4>
                    </div>
                    ${mdrStatusBadge(cls.status)}
                </div>

                <div class="mdr-class-chips">
                    ${mdrBadge(cls.level || 'Nazirah', 'emerald')}
                    ${mdrBadge(cls.muallimah_name || 'Unassigned Muallimah', 'gold')}
                    ${mdrBadge(cls.room_name || 'Hall A')}
                    ${mdrBadge(`${cls.schedule_days || 'Mon - Fri'} · ${cls.schedule_time || 'TBD'}`)}
                    ${mdrBadge(mdrFormatLkr(cls.monthly_fee), Number(cls.monthly_fee) > 0 ? '' : 'blue')}
                </div>

                ${cls.description ? `<p class="mdr-sub-text" style="margin:0;line-height:1.45;">${mdrEsc(cls.description)}</p>` : ''}

                <div class="mdr-capacity-box">
                    <div class="mdr-capacity-row">
                        <span>Enrollment Capacity (${enrolled} / ${cap})</span>
                        <span>${todayMarked > 0 ? `Today: ${todayPresent}/${todayMarked} present` : `${pct}% full`}</span>
                    </div>
                    <div class="mdr-capacity-track">
                        <div class="mdr-capacity-fill ${fillClass}" style="width:${pct}%;"></div>
                    </div>
                </div>

                <div class="mdr-class-footer">
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        <button type="button" class="mdr-icon-btn emerald" onclick="mdrJumpToClassRollCall(${cls.id})">Roll Call</button>
                        <button type="button" class="mdr-icon-btn" onclick="mdrJumpToClassStudents(${cls.id})">Scholars</button>
                    </div>
                    <div style="display:flex;gap:0.35rem;">
                        <button type="button" class="mdr-icon-btn emerald" onclick="openMdrClassModal('edit', ${cls.id})">Edit</button>
                        <button type="button" class="mdr-icon-btn danger" onclick="deleteMdrClass(${cls.id})">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function mdrJumpToClassRollCall(classId) {
    const sel = document.getElementById('mdrRollClassSelect');
    if (sel) sel.value = String(classId);
    switchMadrasaSubTab('attendance');
    mdrLoadRollCallSheet();
}

function mdrJumpToClassStudents(classId) {
    const sel = document.getElementById('mdrStudentClassFilter');
    if (sel) sel.value = String(classId);
    switchMadrasaSubTab('students');
    renderMdrStudents();
}

function openMdrClassModal(mode = 'add', classId = null) {
    const form = document.getElementById('mdrClassForm');
    if (form) form.reset();
    document.getElementById('mdrClassId').value = '';

    if (mode === 'edit' && classId) {
        const cls = mdrClasses.find((c) => Number(c.id) === Number(classId));
        if (!cls) {
            mdrNotify('Class record not found.', 'error');
            return;
        }
        document.getElementById('mdrClassModalTitle').textContent = 'Edit Madrasa Class';
        document.getElementById('mdrClassId').value = String(cls.id);
        document.getElementById('mdrClassCode').value = cls.class_code || '';
        document.getElementById('mdrClassName').value = cls.class_name || '';
        document.getElementById('mdrClassLevel').value = cls.level || 'Nazirah';
        document.getElementById('mdrClassMuallimah').value = cls.muallimah_id ? String(cls.muallimah_id) : '';
        document.getElementById('mdrClassDays').value = cls.schedule_days || '';
        document.getElementById('mdrClassTime').value = cls.schedule_time || '';
        document.getElementById('mdrClassRoom').value = cls.room_name || '';
        document.getElementById('mdrClassCapacity').value = cls.capacity ?? 25;
        document.getElementById('mdrClassFee').value = cls.monthly_fee ?? 0;
        document.getElementById('mdrClassStatus').value = cls.status || 'active';
        document.getElementById('mdrClassDesc').value = cls.description || '';
    } else {
        document.getElementById('mdrClassModalTitle').textContent = 'Create Madrasa Class';
        document.getElementById('mdrClassCapacity').value = 25;
        document.getElementById('mdrClassFee').value = 0;
        document.getElementById('mdrClassStatus').value = 'active';
    }
    openMdrModal('mdrClassModal');
}

async function saveMdrClass(e) {
    e.preventDefault();
    const editId = document.getElementById('mdrClassId').value;
    const payload = {
        class_code: document.getElementById('mdrClassCode').value.trim(),
        class_name: document.getElementById('mdrClassName').value.trim(),
        level: document.getElementById('mdrClassLevel').value,
        muallimah_id: document.getElementById('mdrClassMuallimah').value || null,
        schedule_days: document.getElementById('mdrClassDays').value.trim(),
        schedule_time: document.getElementById('mdrClassTime').value.trim(),
        room_name: document.getElementById('mdrClassRoom').value.trim(),
        capacity: parseInt(document.getElementById('mdrClassCapacity').value, 10) || 25,
        monthly_fee: Number(document.getElementById('mdrClassFee').value) || 0,
        status: document.getElementById('mdrClassStatus').value,
        description: document.getElementById('mdrClassDesc').value.trim()
    };

    try {
        if (editId) {
            await mdrApi(`/classes/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            mdrNotify(`Updated class "${payload.class_name}".`, 'success');
        } else {
            await mdrApi('/classes', { method: 'POST', body: JSON.stringify(payload) });
            mdrNotify(`Created class "${payload.class_name}".`, 'success');
        }
        closeMdrModal('mdrClassModal');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to save class', 'error');
    }
}

async function deleteMdrClass(classId) {
    const cls = mdrClasses.find((c) => Number(c.id) === Number(classId));
    const confirmed = await mdrAskConfirm(
        'Delete Madrasa Class',
        `Delete class "${cls?.class_name || classId}"? Enrolled students will become unassigned and this class's attendance logs will be deleted.`,
        'Delete Class'
    );
    if (!confirmed) return;

    try {
        await mdrApi(`/classes/${classId}`, { method: 'DELETE' });
        mdrNotify('Class deleted successfully.', 'success');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to delete class', 'error');
    }
}

/* ── Students Directory CRUD & CSV Export ───────────────────────────────────── */
function renderMdrStudents() {
    const tbody = document.getElementById('mdrStudentsBody');
    if (!tbody) return;

    const q = (document.getElementById('mdrStudentSearch')?.value || '').trim().toLowerCase();
    const clsFilter = document.getElementById('mdrStudentClassFilter')?.value || '';
    const feeFilter = document.getElementById('mdrStudentFeeFilter')?.value || '';
    const stFilter = document.getElementById('mdrStudentStatusFilter')?.value || '';

    const filtered = mdrStudents.filter((stu) => {
        if (clsFilter && String(stu.class_id || '') !== String(clsFilter)) return false;
        if (feeFilter && stu.fee_status !== feeFilter) return false;
        if (stFilter && stu.status !== stFilter) return false;
        if (q) {
            const hay = `${stu.admission_no || ''} ${stu.full_name || ''} ${stu.guardian_name || ''} ${stu.guardian_phone || ''} ${stu.current_juz_or_level || ''} ${stu.class_name || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="mdr-empty-box">No students match your current filter. Click <strong>+ Enroll Student</strong> to register a scholar.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((stu) => {
        const attText = stu.attendance_pct !== null && stu.attendance_pct !== undefined ? `${stu.attendance_pct}%` : '—';
        const attTone = stu.attendance_pct >= 80 ? 'emerald' : (stu.attendance_pct >= 60 ? 'gold' : (stu.attendance_pct !== null && stu.attendance_pct !== undefined ? 'red' : ''));
        return `
            <tr>
                <td>
                    <div class="mdr-avatar-cell">
                        <div class="mdr-avatar">${mdrEsc(mdrInitials(stu.full_name))}</div>
                        <div>
                            <div class="mdr-primary-text">${mdrEsc(stu.full_name)}</div>
                            <div class="mdr-sub-text">${mdrEsc(stu.admission_no || '')} · ${mdrEsc(stu.gender === 'male' ? 'Boy' : 'Girl')}${stu.age ? ` · ${stu.age} yrs` : ''}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="mdr-primary-text">${mdrEsc(stu.class_name || 'Unassigned')}</div>
                    <div class="mdr-sub-text">${mdrEsc(stu.muallimah_name || 'No Muallimah assigned')}</div>
                </td>
                <td>${mdrBadge(stu.current_juz_or_level || 'Noorani Qaida', 'gold')}</td>
                <td>
                    <div class="mdr-primary-text">${mdrEsc(stu.guardian_name || '—')} <span class="mdr-sub-text">(${mdrEsc(stu.guardian_relation || 'Parent')})</span></div>
                    <div class="mdr-sub-text">${mdrEsc(stu.guardian_phone || 'No phone')}</div>
                </td>
                <td>${mdrBadge(attText === '—' ? 'No logs (30d)' : `${attText} (30d)`, attTone)}</td>
                <td>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                        ${mdrStatusBadge(stu.fee_status)}
                        ${mdrStatusBadge(stu.status)}
                    </div>
                </td>
                <td style="text-align:right;white-space:nowrap;">
                    <button type="button" class="mdr-icon-btn emerald" onclick="openMdrStudentModal('edit', ${stu.id})">Edit</button>
                    <button type="button" class="mdr-icon-btn danger" onclick="deleteMdrStudent(${stu.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function mdrSyncStudentModalAge() {
    const dob = document.getElementById('mdrStudentDob')?.value;
    const ageEl = document.getElementById('mdrStudentAge');
    if (!dob || !ageEl) return;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const mDiff = now.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--;
    if (age >= 2 && age <= 99) ageEl.value = age;
}

function openMdrStudentModal(mode = 'add', studentId = null) {
    const form = document.getElementById('mdrStudentForm');
    if (form) form.reset();
    document.getElementById('mdrStudentId').value = '';

    if (mode === 'edit' && studentId) {
        const stu = mdrStudents.find((s) => Number(s.id) === Number(studentId));
        if (!stu) {
            mdrNotify('Student profile not found.', 'error');
            return;
        }
        document.getElementById('mdrStudentModalTitle').textContent = 'Edit Madrasa Student';
        document.getElementById('mdrStudentId').value = String(stu.id);
        document.getElementById('mdrStudentAdmNo').value = stu.admission_no || '';
        document.getElementById('mdrStudentName').value = stu.full_name || '';
        document.getElementById('mdrStudentGender').value = stu.gender === 'male' ? 'male' : 'female';
        document.getElementById('mdrStudentDob').value = stu.dob ? String(stu.dob).slice(0, 10) : '';
        document.getElementById('mdrStudentAge').value = stu.age || '';
        document.getElementById('mdrStudentClass').value = stu.class_id ? String(stu.class_id) : '';
        document.getElementById('mdrStudentEnrollDate').value = stu.enrollment_date ? String(stu.enrollment_date).slice(0, 10) : '';
        document.getElementById('mdrStudentJuz').value = stu.current_juz_or_level || '';
        document.getElementById('mdrStudentGuardian').value = stu.guardian_name || '';
        document.getElementById('mdrStudentPhone').value = stu.guardian_phone || '';
        document.getElementById('mdrStudentRelation').value = stu.guardian_relation || '';
        document.getElementById('mdrStudentFeeStatus').value = stu.fee_status || 'sponsored';
        document.getElementById('mdrStudentStatus').value = stu.status || 'active';
        document.getElementById('mdrStudentAddress').value = stu.address || '';
        document.getElementById('mdrStudentNotes').value = stu.notes || '';
    } else {
        document.getElementById('mdrStudentModalTitle').textContent = 'Enroll Madrasa Student';
        document.getElementById('mdrStudentGender').value = 'female';
        document.getElementById('mdrStudentEnrollDate').value = mdrTodayStr();
        document.getElementById('mdrStudentFeeStatus').value = 'sponsored';
        document.getElementById('mdrStudentStatus').value = 'active';
    }
    openMdrModal('mdrStudentModal');
}

async function saveMdrStudent(e) {
    e.preventDefault();
    const editId = document.getElementById('mdrStudentId').value;
    const payload = {
        admission_no: document.getElementById('mdrStudentAdmNo').value.trim(),
        full_name: document.getElementById('mdrStudentName').value.trim(),
        gender: document.getElementById('mdrStudentGender').value,
        dob: document.getElementById('mdrStudentDob').value || null,
        age: document.getElementById('mdrStudentAge').value ? parseInt(document.getElementById('mdrStudentAge').value, 10) : null,
        class_id: document.getElementById('mdrStudentClass').value || null,
        enrollment_date: document.getElementById('mdrStudentEnrollDate').value || mdrTodayStr(),
        current_juz_or_level: document.getElementById('mdrStudentJuz').value.trim(),
        guardian_name: document.getElementById('mdrStudentGuardian').value.trim(),
        guardian_phone: document.getElementById('mdrStudentPhone').value.trim(),
        guardian_relation: document.getElementById('mdrStudentRelation').value.trim() || 'Parent',
        fee_status: document.getElementById('mdrStudentFeeStatus').value,
        status: document.getElementById('mdrStudentStatus').value,
        address: document.getElementById('mdrStudentAddress').value.trim(),
        notes: document.getElementById('mdrStudentNotes').value.trim()
    };

    try {
        if (editId) {
            await mdrApi(`/students/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            mdrNotify(`Updated student "${payload.full_name}".`, 'success');
        } else {
            await mdrApi('/students', { method: 'POST', body: JSON.stringify(payload) });
            mdrNotify(`Enrolled student "${payload.full_name}".`, 'success');
        }
        closeMdrModal('mdrStudentModal');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to save student record', 'error');
    }
}

async function deleteMdrStudent(studentId) {
    const stu = mdrStudents.find((s) => Number(s.id) === Number(studentId));
    const confirmed = await mdrAskConfirm(
        'Remove Student Record',
        `Delete student "${stu?.full_name || studentId}" (${stu?.admission_no || ''}) and their attendance history?`,
        'Remove Student'
    );
    if (!confirmed) return;

    try {
        await mdrApi(`/students/${studentId}`, { method: 'DELETE' });
        mdrNotify('Student removed successfully.', 'success');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to remove student', 'error');
    }
}

function mdrExportStudentsCsv() {
    if (!mdrStudents.length) {
        mdrNotify('No student records to export.', 'info');
        return;
    }
    const headers = ['Admission No', 'Full Name', 'Gender', 'Age', 'Class', 'Muallimah', 'Juz / Level', 'Guardian', 'Phone', 'Fee Status', 'Status'];
    const csvCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = mdrStudents.map((s) => [
        s.admission_no, s.full_name, s.gender, s.age ?? '', s.class_name || '',
        s.muallimah_name || '', s.current_juz_or_level || '', s.guardian_name || '',
        s.guardian_phone || '', s.fee_status, s.status
    ].map(csvCell).join(','));

    const csv = [headers.map(csvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `madrasa-students-${mdrTodayStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    mdrNotify(`Exported ${mdrStudents.length} student records.`, 'success');
}

/* ── Muallimahs Faculty CRUD ────────────────────────────────────────────────── */
function renderMdrMuallimahs() {
    const tbody = document.getElementById('mdrMuallimahsBody');
    if (!tbody) return;

    const q = (document.getElementById('mdrMuallimahSearch')?.value || '').trim().toLowerCase();
    const stFilter = document.getElementById('mdrMuallimahStatusFilter')?.value || '';

    const filtered = mdrMuallimahs.filter((m) => {
        if (stFilter && m.status !== stFilter) return false;
        if (q) {
            const hay = `${m.staff_code || ''} ${m.full_name || ''} ${m.phone || ''} ${m.qualification || ''} ${m.specialization || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="mdr-empty-box">No Muallimah profiles found. Click <strong>+ Add Muallimah</strong> to add an educator.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((m) => {
        const classesList = String(m.assigned_classes || '').split(',').map((s) => s.trim()).filter(Boolean);
        const classPills = classesList.length
            ? classesList.map((name) => mdrBadge(name, 'emerald')).join(' ')
            : mdrBadge('No class assigned');
        return `
            <tr>
                <td>
                    <div class="mdr-avatar-cell">
                        <div class="mdr-avatar">${mdrEsc(mdrInitials(m.full_name))}</div>
                        <div>
                            <div class="mdr-primary-text">${mdrEsc(m.full_name)}</div>
                            <div class="mdr-sub-text">${mdrEsc(m.staff_code || '')} · Joined ${mdrEsc(m.join_date || '—')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="mdr-primary-text">${mdrEsc(m.specialization || 'Quran & Tajweed')}</div>
                    <div class="mdr-sub-text">${mdrEsc(m.qualification || '—')}</div>
                </td>
                <td>
                    <div class="mdr-primary-text">${mdrEsc(m.phone || '—')}</div>
                    <div class="mdr-sub-text">${mdrEsc(m.email || m.nic_number || '—')}</div>
                </td>
                <td><div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${classPills}</div></td>
                <td>
                    <div class="mdr-primary-text">${Number(m.monthly_stipend) > 0 ? mdrFormatLkr(m.monthly_stipend) : 'Volunteer / Honorary'}</div>
                    <div style="margin-top:0.2rem;">${mdrStatusBadge(m.status)}</div>
                </td>
                <td style="text-align:right;white-space:nowrap;">
                    <button type="button" class="mdr-icon-btn emerald" onclick="openMdrMuallimahModal('edit', ${m.id})">Edit</button>
                    <button type="button" class="mdr-icon-btn danger" onclick="deleteMdrMuallimah(${m.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openMdrMuallimahModal(mode = 'add', mlmId = null) {
    const form = document.getElementById('mdrMuallimahForm');
    if (form) form.reset();
    document.getElementById('mdrMuallimahId').value = '';

    if (mode === 'edit' && mlmId) {
        const m = mdrMuallimahs.find((x) => Number(x.id) === Number(mlmId));
        if (!m) {
            mdrNotify('Muallimah profile not found.', 'error');
            return;
        }
        document.getElementById('mdrMuallimahModalTitle').textContent = 'Edit Muallimah Profile';
        document.getElementById('mdrMuallimahId').value = String(m.id);
        document.getElementById('mdrMuallimahCode').value = m.staff_code || '';
        document.getElementById('mdrMuallimahName').value = m.full_name || '';
        document.getElementById('mdrMuallimahPhone').value = m.phone || '';
        document.getElementById('mdrMuallimahEmail').value = m.email || '';
        document.getElementById('mdrMuallimahNic').value = m.nic_number || '';
        document.getElementById('mdrMuallimahJoinDate').value = m.join_date ? String(m.join_date).slice(0, 10) : '';
        document.getElementById('mdrMuallimahQualification').value = m.qualification || '';
        document.getElementById('mdrMuallimahSpec').value = m.specialization || '';
        document.getElementById('mdrMuallimahStipend').value = m.monthly_stipend ?? 0;
        document.getElementById('mdrMuallimahStatus').value = m.status || 'active';
        document.getElementById('mdrMuallimahAddress').value = m.address || '';
        document.getElementById('mdrMuallimahNotes').value = m.notes || '';
    } else {
        document.getElementById('mdrMuallimahModalTitle').textContent = 'Add Muallimah';
        document.getElementById('mdrMuallimahJoinDate').value = mdrTodayStr();
        document.getElementById('mdrMuallimahStipend').value = 0;
        document.getElementById('mdrMuallimahStatus').value = 'active';
    }
    openMdrModal('mdrMuallimahModal');
}

async function saveMdrMuallimah(e) {
    e.preventDefault();
    const editId = document.getElementById('mdrMuallimahId').value;
    const payload = {
        staff_code: document.getElementById('mdrMuallimahCode').value.trim(),
        full_name: document.getElementById('mdrMuallimahName').value.trim(),
        phone: document.getElementById('mdrMuallimahPhone').value.trim(),
        email: document.getElementById('mdrMuallimahEmail').value.trim(),
        nic_number: document.getElementById('mdrMuallimahNic').value.trim(),
        join_date: document.getElementById('mdrMuallimahJoinDate').value || mdrTodayStr(),
        qualification: document.getElementById('mdrMuallimahQualification').value.trim(),
        specialization: document.getElementById('mdrMuallimahSpec').value.trim() || 'Quran & Tajweed',
        monthly_stipend: Number(document.getElementById('mdrMuallimahStipend').value) || 0,
        status: document.getElementById('mdrMuallimahStatus').value,
        address: document.getElementById('mdrMuallimahAddress').value.trim(),
        notes: document.getElementById('mdrMuallimahNotes').value.trim()
    };

    try {
        if (editId) {
            await mdrApi(`/muallimahs/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
            mdrNotify(`Updated "${payload.full_name}".`, 'success');
        } else {
            await mdrApi('/muallimahs', { method: 'POST', body: JSON.stringify(payload) });
            mdrNotify(`Added Muallimah "${payload.full_name}".`, 'success');
        }
        closeMdrModal('mdrMuallimahModal');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to save Muallimah profile', 'error');
    }
}

async function deleteMdrMuallimah(mlmId) {
    const m = mdrMuallimahs.find((x) => Number(x.id) === Number(mlmId));
    const confirmed = await mdrAskConfirm(
        'Remove Muallimah',
        `Remove Muallimah "${m?.full_name || mlmId}" (${m?.staff_code || ''})? Classes she teaches will become unassigned.`,
        'Remove Muallimah'
    );
    if (!confirmed) return;

    try {
        await mdrApi(`/muallimahs/${mlmId}`, { method: 'DELETE' });
        mdrNotify('Muallimah removed successfully.', 'success');
        await fetchMadrasaWorkspace();
    } catch (err) {
        mdrNotify(err.message || 'Failed to delete Muallimah', 'error');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.mdr-modal-overlay.open').forEach((modal) => {
            closeMdrModal(modal.id);
        });
    }
});

Object.assign(window, {
    fetchMadrasaWorkspace,
    switchMadrasaSubTab,
    syncMadrasaSidebarState,
    mdrLoadRollCallSheet,
    mdrUpdateRollDraftField,
    mdrBatchMarkStatus,
    mdrSaveRollCallSheet,
    mdrResetAttHistoryFilters,
    renderMdrAttendanceHistory,
    mdrSyncAttModalStudents,
    openMdrAttendanceModal,
    saveMdrAttendance,
    deleteMdrAttendance,
    renderMdrClasses,
    mdrJumpToClassRollCall,
    mdrJumpToClassStudents,
    openMdrClassModal,
    saveMdrClass,
    deleteMdrClass,
    renderMdrStudents,
    mdrSyncStudentModalAge,
    openMdrStudentModal,
    saveMdrStudent,
    deleteMdrStudent,
    mdrExportStudentsCsv,
    renderMdrMuallimahs,
    openMdrMuallimahModal,
    saveMdrMuallimah,
    deleteMdrMuallimah,
    openMdrModal,
    closeMdrModal,
    closeMdrModalByBackdrop
});


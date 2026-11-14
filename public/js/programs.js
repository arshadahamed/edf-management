/* ═══════════════════════════════════════════════════════════════════════════
   EDUCATIONAL & VOCATIONAL PROGRAMS MANAGEMENT — programs.js
   Full CRUD Suite: Programs, Cohort Batches & Student Applications
   Depends on: openModal, closeModal, showToast (or toast fallback), lucide, XLSX
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── State Store ─────────────────────────────────────────────────────────────
let programsState = {
    programs: [],
    batches: [],
    applications: [],
    stats: {},
    directoryRecords: [],
    filter: {
        category: 'all',
        audience: 'all',
        status: 'all',
        delivery_mode: 'all',
        fee_type: 'all',
        search: '',
        sort: 'newest'
    },
    appFilter: {
        search: '',
        program: 'all',
        batch: 'all',
        status: 'all',
        gender: 'all',
        fee: 'all',
        sort: 'newest'
    },
    currentView: 'programs',    // 'programs' | 'batches' | 'applications'
    progViewMode: 'grid',       // 'grid' | 'table'
    selectedPrograms: new Set(),
    selectedApps: new Set(),
    editingProgramId: null,
    editingBatchId: null,
    editingAppId: null,
    viewingProgramId: null,
    viewingAppId: null,
    progPage: 1,
    progPageSize: 9,
    appPage: 1,
    appPageSize: 10,
    programDetailTab: 'overview'
};

// ─── Constants & Metadata ────────────────────────────────────────────────────
const CATEGORIES = {
    quran:    { label: 'Quran Studies',     icon: 'book-open',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    skills:   { label: 'Vocational Skills', icon: 'wrench',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    tech:     { label: 'Technology & IT',   icon: 'cpu',         color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    language: { label: 'Languages',         icon: 'languages',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    bayan:    { label: 'Islamic Lectures',  icon: 'mic-2',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    health:   { label: 'Health & Wellness', icon: 'heart-pulse', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    other:    { label: 'Other Pillar',      icon: 'folder',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
};

const AUDIENCES = {
    all:       { label: 'All Audiences', color: '#10b981' },
    all_mixed: { label: 'General / Mixed', color: '#10b981' },
    men:       { label: 'Men Only',      color: '#3b82f6' },
    women:     { label: 'Women Only',    color: '#ec4899' },
    children:  { label: 'Children (<16)', color: '#f59e0b' },
    youth:     { label: 'Youth',         color: '#8b5cf6' }
};

const STATUS_CONFIG = {
    active:     { bg: '#d1fae5', text: '#065f46', border: 'rgba(16,185,129,0.3)', label: 'Active' },
    upcoming:   { bg: '#ede9fe', text: '#5b21b6', border: 'rgba(139,92,246,0.3)', label: 'Upcoming' },
    completed:  { bg: '#e0f2fe', text: '#0369a1', border: 'rgba(2,132,199,0.3)', label: 'Completed' },
    inactive:   { bg: '#f3f4f6', text: '#4b5563', border: 'rgba(156,163,175,0.3)', label: 'Inactive' },
    pending:    { bg: '#fef3c7', text: '#92400e', border: 'rgba(245,158,11,0.3)', label: 'Pending' },
    approved:   { bg: '#d1fae5', text: '#065f46', border: 'rgba(16,185,129,0.3)', label: 'Approved' },
    enrolled:   { bg: '#dbeafe', text: '#1e40af', border: 'rgba(59,130,246,0.3)', label: 'Enrolled' },
    waitlisted: { bg: '#ffedd5', text: '#c2410c', border: 'rgba(249,115,22,0.3)', label: 'Waitlisted' },
    rejected:   { bg: '#fee2e2', text: '#991b1b', border: 'rgba(239,68,68,0.3)', label: 'Rejected' }
};

const PROGRAM_PRESETS = {
    quran: {
        title: 'Quran Recitation & Tajweed Fundamentals',
        category: 'quran',
        target_audience: 'children',
        level: 'beginner',
        delivery_mode: 'in_person',
        language: 'Arabic & Tamil',
        duration_weeks: 12,
        duration_type: 'weeks',
        fee: 0,
        scholarship_available: 1,
        certification: 'certificate',
        max_capacity: 30,
        location: 'Grand Jummah Masjid Madrasa Hall, Galgamuwa',
        schedule_days: 'Weekends (Sat & Sun)',
        schedule_time: '08:30 AM – 11:30 AM',
        coordinator_name: 'Maulavi M. Rizwan (Tajweed Master)',
        coordinator_phone: '077 1234567',
        description: 'Comprehensive Tajweed training for children & beginners. Master proper articulation points (Makhaarij), Sifaat, Noon/Meem Sakinah rules, and confident recitation of Juz Amma.',
        syllabus_topics: 'Makhaarij & Articulation, Ahkam al-Tajweed Rules, Juz Amma Recitation, Daily Sunnah Duas, Final Oral Examination',
        prerequisites: 'Basic knowledge of Arabic alphabet',
        materials_provided: 'Tajweed Mushaf, Color-Coded Workbook, Certificate',
        initial_batch_name: 'Batch 2026-A (Morning Junior)'
    },
    it_skills: {
        title: 'Certificate in Computer Applications & Digital Skills',
        category: 'tech',
        target_audience: 'youth',
        level: 'beginner',
        delivery_mode: 'in_person',
        language: 'Tamil & Sinhala',
        duration_weeks: 8,
        duration_type: 'weeks',
        fee: 3000,
        scholarship_available: 1,
        certification: 'certificate',
        max_capacity: 25,
        location: 'EDF Computer & IT Lab, Galgamuwa',
        schedule_days: 'Saturdays Only',
        schedule_time: '09:00 AM – 01:00 PM',
        coordinator_name: 'Eng. Ahmed Nazeer (Lead IT Instructor)',
        coordinator_phone: '071 8899221',
        description: 'Hands-on practical training covering Windows OS, Microsoft Office (Word, Excel, PowerPoint), Google Cloud Workspace, Email Etiquette, Graphic Design basics with Canva, and an introduction to online digital freelancing.',
        syllabus_topics: 'Computer Hardware & Windows 11, MS Word Documentation, MS Excel Data & Calculations, PowerPoint Presentations, Canva Design, Internet Safety & Freelance Basics',
        prerequisites: 'Age 15+, O/L or A/L students and school leavers',
        materials_provided: 'Individual Lab PC, Practice Files, Printed Handbook, Certificate',
        initial_batch_name: 'Cohort 2026-B1 (Weekend)'
    },
    tailoring: {
        title: 'Professional Dressmaking & Tailoring for Women',
        category: 'skills',
        target_audience: 'women',
        level: 'all_levels',
        delivery_mode: 'in_person',
        language: 'Tamil',
        duration_weeks: 16,
        duration_type: 'weeks',
        fee: 0,
        scholarship_available: 1,
        certification: 'diploma',
        max_capacity: 20,
        location: 'EDF Vocational Training Centre (Skills Wing)',
        schedule_days: 'Mon, Wed & Fri',
        schedule_time: '01:30 PM – 04:30 PM',
        coordinator_name: 'Fathima Haseena (Head of Livelihood Skills)',
        coordinator_phone: '076 5544332',
        description: 'Empowering women with market-ready tailoring and dressmaking skills to launch home-based businesses or garment manufacturing careers. From machine maintenance to pattern making, cutting, and stitching designer wear.',
        syllabus_topics: 'Sewing Machine Operation & Safety, Body Measurement & Drafting, Blouse & Frock Cutting, Abaya & Salwar Tailoring, Quality Finishing & Pricing Your Work',
        prerequisites: 'Women aged 18–45 seeking sustainable livelihood',
        materials_provided: 'Sewing Machine Access, Fabric Kits, Scissors & Measuring Set, Vocational Diploma',
        initial_batch_name: 'Cohort 2026-T1 (Afternoon)'
    },
    english: {
        title: 'Conversational English & Workplace Communication',
        category: 'language',
        target_audience: 'all_mixed',
        level: 'intermediate',
        delivery_mode: 'hybrid',
        language: 'English & Tamil',
        duration_weeks: 10,
        duration_type: 'weeks',
        fee: 1500,
        scholarship_available: 1,
        certification: 'certificate',
        max_capacity: 35,
        location: 'EDF Main Conference Hall & Zoom Online',
        schedule_days: 'Sundays Only',
        schedule_time: '02:00 PM – 05:00 PM',
        coordinator_name: 'Mr. S. M. Farhan (Language Trainer)',
        coordinator_phone: '075 9988776',
        description: 'Overcome fear and build speaking confidence in real-life English. Focuses on daily spoken dialogues, pronunciation, listening skills, writing formal emails, public speaking presentations, and job interview preparation.',
        syllabus_topics: 'Everyday Speaking Fluency, Functional Grammar, Pronunciation & Accent, Workplace Email Writing, Presentation Skills, Mock Job Interviews',
        prerequisites: 'Basic reading comprehension of English',
        materials_provided: 'Audio CD/Drive access, Conversation Handbook, Certificate',
        initial_batch_name: 'Intake 2026-E1'
    },
    cctv: {
        title: 'CCTV Installation, Network Security & Basic Electricals',
        category: 'tech',
        target_audience: 'men',
        level: 'beginner',
        delivery_mode: 'in_person',
        language: 'Tamil & Sinhala',
        duration_weeks: 6,
        duration_type: 'weeks',
        fee: 4500,
        scholarship_available: 1,
        certification: 'certificate',
        max_capacity: 20,
        location: 'EDF Technical Workshop, Galgamuwa',
        schedule_days: 'Weekends (Sat & Sun)',
        schedule_time: '09:00 AM – 03:00 PM (Practical Lab)',
        coordinator_name: 'Mohamed Aslam (Security Systems Specialist)',
        coordinator_phone: '077 4455667',
        description: 'High-demand vocational training for young men. Learn end-to-end IP and Analog CCTV camera setup, cabling, crimping, DVR/NVR configuration, remote smartphone viewing, fault diagnosis, and basic electrical safety.',
        syllabus_topics: 'CCTV Camera Types & Lens Optics, Coaxial & CAT6 Cabling, Connector Crimping (BNC & RJ45), DVR/NVR Setup & Hard Drives, Network Router & Mobile App Config, Commercial Site Estimation',
        prerequisites: 'Men aged 16–35 with technical interest',
        materials_provided: 'Hands-on hardware rig, Crimping Tool Kit, Multi-meter training, Technician Certificate',
        initial_batch_name: 'Batch 2026-C1 (Intensive)'
    }
};

// ─── Utility & Formatting Helpers ───────────────────────────────────────────
function _epEl(id) { return document.getElementById(id); }
function _epSet(id, val) { const el = _epEl(id); if (el) el.textContent = val ?? ''; }
function _epEsc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _epFmtMoney(n) {
    const num = Number(n || 0);
    return num > 0 ? 'LKR ' + num.toLocaleString() : 'Free / Sponsored';
}
function _epFmtDate(d) {
    if (!d) return '—';
    try {
        const dt = new Date(String(d).split('T')[0] + 'T00:00:00');
        return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return String(d); }
}

function statusBadge(status) {
    const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return `<span class="status-badge" style="background:${s.bg}; color:${s.text}; border:1px solid ${s.border}; font-size:0.68rem; padding:0.12rem 0.55rem; text-transform:capitalize; font-weight:700;">${_epEsc(s.label || status)}</span>`;
}

function catBadge(cat) {
    const c = CATEGORIES[cat] || CATEGORIES.other;
    return `<span style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.18rem 0.55rem; border-radius:20px; font-size:0.68rem; font-weight:700; background:${c.bg}; color:${c.color}; border:1px solid ${c.color}33;">
        <i data-lucide="${c.icon}" style="width:11px;height:11px;"></i> ${_epEsc(c.label)}</span>`;
}

function audBadge(aud) {
    const a = AUDIENCES[aud] || AUDIENCES.all;
    return `<span style="padding:0.18rem 0.55rem; border-radius:20px; font-size:0.68rem; font-weight:700; background:${a.color}14; color:${a.color}; border:1px solid ${a.color}33;">${_epEsc(a.label)}</span>`;
}

function modeBadge(mode) {
    const map = {
        in_person: { label: 'In-Person', icon: 'map-pin', color: '#0284c7' },
        online: { label: 'Online Live', icon: 'video', color: '#8b5cf6' },
        hybrid: { label: 'Hybrid', icon: 'cast', color: '#10b981' },
        field_workshop: { label: 'Field Workshop', icon: 'wrench', color: '#f59e0b' }
    };
    const m = map[mode] || map.in_person;
    return `<span style="display:inline-flex; align-items:center; gap:0.25rem; font-size:0.7rem; color:${m.color}; font-weight:600;">
        <i data-lucide="${m.icon}" style="width:11px;height:11px;"></i> ${m.label}</span>`;
}

function toast(msg, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        const t = document.createElement('div');
        const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
        t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;
            background:var(--bg-main,#fff);border:1px solid var(--border-color,#e5e7eb);border-left:4px solid ${color};
            padding:0.875rem 1.25rem;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.15);
            font-size:0.85rem;font-weight:600;color:var(--text-main,#111);animation:fadeIn 0.25s ease;`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
}

function _epDownloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

function _epExportData(rows, filenameBase, format, sheetName = 'Sheet1') {
    if (!rows || !rows.length) {
        toast('No records to export', 'error');
        return;
    }
    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
        XLSX.writeFile(wb, `${filenameBase}.xlsx`);
    } else {
        const headers = Object.keys(rows[0]);
        const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(q).join(','),
            ...rows.map(r => headers.map(h => q(r[h])).join(','))
        ].join('\r\n');
        _epDownloadBlob(`${filenameBase}.csv`, new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    }
    toast(`Exported ${rows.length} record(s)`, 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 1 — FETCH & RENDER PROGRAMS & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchPrograms() {
    try {
        renderProgramsLoading();
        const [progRes, statsRes, batchesRes] = await Promise.all([
            fetch('/api/programs/programs'),
            fetch('/api/programs/programs-stats'),
            fetch('/api/programs/batches').catch(() => ({ ok: false }))
        ]);

        if (progRes.ok) programsState.programs = await progRes.json();
        if (statsRes.ok) programsState.stats = await statsRes.json();
        if (batchesRes.ok && batchesRes.json) programsState.batches = await batchesRes.json();

        // Sync selection set with current program IDs
        const validIds = new Set(programsState.programs.map(p => p.id));
        programsState.selectedPrograms.forEach(id => {
            if (!validIds.has(id)) programsState.selectedPrograms.delete(id);
        });

        renderProgramStats();
        populateProgramFilterOptions();
        renderProgramView();

        // Preload directory records in background for fast autocomplete
        loadDirectoryLookupRecords();
    } catch (err) {
        console.error('fetchPrograms error:', err);
        const grid = _epEl('programsGrid');
        if (grid) grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:3rem">Failed to load educational programs.</p>';
    }
}

function renderProgramStats() {
    const s = programsState.stats || {};
    const progs = programsState.programs || [];

    const totalProgs = s.totalPrograms ?? progs.length;
    const activeProgs = s.activePrograms ?? progs.filter(p => p.status === 'active').length;
    const completedProgs = s.completedPrograms ?? progs.filter(p => p.status === 'completed').length;
    const totalBatches = s.totalBatches ?? programsState.batches.length;
    const activeBatches = s.activeBatches ?? programsState.batches.filter(b => b.status === 'active').length;
    const totalBatchSeats = s.totalBatchSeats ?? programsState.batches.reduce((sum, b) => sum + (b.max_seats || 0), 0);

    const totalApplicants = s.totalApplicants ?? 0;
    const pendingApps = s.pendingApplications ?? 0;
    const approvedApps = s.approvedApplications ?? 0;
    const enrolledApps = s.enrolledApplications ?? 0;
    const waitlistedApps = s.waitlistedApplications ?? 0;
    const rejectedApps = s.rejectedApplications ?? 0;
    const totalEnrolled = s.totalEnrolledOrApproved ?? (approvedApps + enrolledApps);
    const certsIssued = s.certificatesIssued ?? 0;
    const feeCollected = s.totalFeeCollected ?? 0;
    const scholarships = s.scholarshipCount ?? 0;

    _epSet('ps-total', totalProgs);
    _epSet('ps-active', activeProgs);
    _epSet('ps-completed-progs', `${completedProgs} Completed`);

    _epSet('ps-batches', totalBatches);
    _epSet('ps-active-batches', `${activeBatches} Active`);
    _epSet('ps-total-seats', `${totalBatchSeats} Seats`);

    _epSet('ps-applicants', totalApplicants);
    const acceptRate = totalApplicants > 0 ? Math.round((totalEnrolled / totalApplicants) * 100) : 0;
    _epSet('ps-accept-rate', `${acceptRate}% Rate`);
    _epSet('ps-scholarships', `${scholarships} Sponsored`);

    _epSet('ps-pending', pendingApps);
    _epSet('ps-waitlisted', `${waitlistedApps} Waitlisted`);
    _epSet('ps-rejected', `${rejectedApps} Rejected`);

    _epSet('ps-approved', totalEnrolled);
    _epSet('ps-enrolled-only', `${enrolledApps} In Classes`);
    const totalCap = s.totalCapacity || progs.reduce((acc, p) => acc + (p.max_capacity || 30), 0);
    const capPct = totalCap > 0 ? Math.min(100, Math.round((totalEnrolled / totalCap) * 100)) : 0;
    _epSet('ps-cap-pct', `${capPct}% Cap`);
    const capBar = _epEl('ps-capacity-bar');
    if (capBar) capBar.style.width = capPct + '%';

    _epSet('ps-graduates', s.completedApplications ?? 0);
    _epSet('ps-certs-issued', `${certsIssued} Certs`);
    _epSet('ps-fee-collected', _epFmtMoney(feeCollected));

    // Sub-tab pills
    _epSet('epTabCountPrograms', totalProgs);
    _epSet('epTabCountBatches', totalBatches);
    _epSet('epTabCountApps', totalApplicants);
    const pendingAlert = _epEl('epTabPendingAlert');
    if (pendingAlert) {
        pendingAlert.style.display = pendingApps > 0 ? 'inline-flex' : 'none';
        pendingAlert.textContent = `${pendingApps} Pending`;
    }

    // Status pill counts on Programs toolbar
    _epSet('epProgStatCount-all', totalProgs);
    _epSet('epProgStatCount-active', progs.filter(p => p.status === 'active').length);
    _epSet('epProgStatCount-upcoming', progs.filter(p => p.status === 'upcoming').length);
    _epSet('epProgStatCount-completed', progs.filter(p => p.status === 'completed').length);
    _epSet('epProgStatCount-inactive', progs.filter(p => p.status === 'inactive').length);
}

function populateProgramFilterOptions() {
    const sel1 = _epEl('appProgramFilter');
    const sel2 = _epEl('batchCourseSelect');
    const sel3 = _epEl('appProgramSelect');
    const sel4 = _epEl('epBatchProgramFilter');

    const optsHtml = programsState.programs.map(p =>
        `<option value="${p.id}">${_epEsc(p.title)} (${_epEsc(p.program_code || 'EDF')})</option>`
    ).join('');

    if (sel1 && sel1.options.length <= 1) {
        sel1.innerHTML = '<option value="all">All Programs</option>' + optsHtml;
    }
    if (sel4 && sel4.options.length <= 1) {
        sel4.innerHTML = '<option value="all">All Programs</option>' + optsHtml;
    }
    if (sel2) {
        sel2.innerHTML = '<option value="">Select Program *</option>' + optsHtml;
    }
    if (sel3) {
        sel3.innerHTML = '<option value="">Select Program *</option>' + optsHtml;
        sel3.onchange = onAppModalProgramSelect;
    }
}

function renderProgramsLoading() {
    const grid = _epEl('programsGrid');
    if (!grid) return;
    grid.innerHTML = Array(4).fill(0).map(() => `
        <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px; padding:1.25rem; animation:pulse 1.4s ease infinite;">
            <div style="height:16px; background:var(--border-color); border-radius:8px; width:65%; margin-bottom:1rem;"></div>
            <div style="height:12px; background:var(--border-color); border-radius:8px; width:40%; margin-bottom:0.75rem;"></div>
            <div style="height:10px; background:var(--border-color); border-radius:8px; width:85%; margin-bottom:1.5rem;"></div>
            <div style="height:32px; background:var(--border-color); border-radius:8px; width:100%;"></div>
        </div>
    `).join('');
}

function getFilteredPrograms() {
    const { category, audience, status, delivery_mode, fee_type, search, sort } = programsState.filter;
    const q = (search || '').trim().toLowerCase();

    let list = programsState.programs.filter(p => {
        if (category !== 'all' && p.category !== category) return false;
        if (audience !== 'all' && p.target_audience !== audience) return false;
        if (status !== 'all' && p.status !== status) return false;
        if (delivery_mode !== 'all' && p.delivery_mode !== delivery_mode) return false;
        if (fee_type === 'free' && Number(p.fee || 0) > 0) return false;
        if (fee_type === 'paid' && Number(p.fee || 0) <= 0) return false;

        if (q) {
            const hay = [
                p.title, p.program_code, p.category, p.target_audience, p.description,
                p.location, p.coordinator_name, p.coordinator_phone, p.syllabus_topics
            ].map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    list.sort((a, b) => {
        switch (sort) {
            case 'title_asc': return a.title.localeCompare(b.title);
            case 'applicants_desc': return (b.applicant_count || 0) - (a.applicant_count || 0);
            case 'enrolled_desc': return (b.enrolled_count || 0) - (a.enrolled_count || 0);
            case 'batches_desc': return (b.batch_count || 0) - (a.batch_count || 0);
            case 'fee_desc': return (b.fee || 0) - (a.fee || 0);
            case 'newest':
            default:
                return (b.id || 0) - (a.id || 0);
        }
    });

    return list;
}

function renderProgramView() {
    const filtered = getFilteredPrograms();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / programsState.progPageSize));
    if (programsState.progPage > totalPages) programsState.progPage = totalPages;
    const start = (programsState.progPage - 1) * programsState.progPageSize;
    const paged = filtered.slice(start, start + programsState.progPageSize);

    // Sync search clear & reset buttons
    const clearBtn = _epEl('epProgSearchClearBtn');
    if (clearBtn) clearBtn.style.display = programsState.filter.search ? 'inline-flex' : 'none';
    const resetBtn = _epEl('epProgResetBtn');
    if (resetBtn) resetBtn.style.display = hasActiveProgramFilters() ? 'inline-flex' : 'none';
    _epSet('epProgFilterCount', `Showing ${total} of ${programsState.programs.length}`);

    // Switch view wraps
    const gridWrap = _epEl('programsGrid');
    const tableWrap = _epEl('programsTableWrap');
    if (gridWrap) gridWrap.style.display = programsState.progViewMode === 'grid' ? 'grid' : 'none';
    if (tableWrap) tableWrap.style.display = programsState.progViewMode === 'table' ? 'block' : 'none';

    _epEl('epViewGridBtn')?.classList.toggle('active', programsState.progViewMode === 'grid');
    _epEl('epViewTableBtn')?.classList.toggle('active', programsState.progViewMode === 'table');

    if (programsState.progViewMode === 'grid') {
        renderProgramCardsGrid(paged);
    } else {
        renderProgramTableRows(paged, start);
    }

    renderProgramPagination(total, totalPages);
    syncProgramBulkBar(paged);
    if (window.lucide) lucide.createIcons();
}

function renderProgramCardsGrid(paged) {
    const grid = _epEl('programsGrid');
    if (!grid) return;

    if (!paged.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:4rem 1.5rem; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border-color); border-radius:18px;">
                <div style="width:52px;height:52px;border-radius:14px;background:var(--glow-bg);color:var(--text-muted);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                    <i data-lucide="book-open" style="width:26px;height:26px;opacity:0.4;"></i>
                </div>
                <h4 style="font-size:1rem; font-weight:700; color:var(--text-main); margin:0 0 0.35rem;">No programs match your filters</h4>
                <p style="font-size:0.8rem; margin:0 0 1.25rem;">Try adjusting search keywords, category pills, or clear your filters.</p>
                <button type="button" class="btn btn-outline" onclick="resetProgramFilters()"><i data-lucide="rotate-ccw"></i> Reset Filters</button>
            </div>`;
        return;
    }

    grid.innerHTML = paged.map(p => {
        const cat = CATEGORIES[p.category] || CATEGORIES.other;
        const cap = Number(p.max_capacity) || 30;
        const enrolled = Number(p.enrolled_count) || 0;
        const applicants = Number(p.applicant_count) || 0;
        const fill = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
        const progressColor = fill >= 95 ? '#ef4444' : fill >= 75 ? '#f59e0b' : '#10b981';
        const isSelected = programsState.selectedPrograms.has(p.id);

        return `
        <div class="ep-prog-card" style="${isSelected ? 'border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,0.25);' : ''}">
            <!-- Top Badges & Actions Header -->
            <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleProgramSelect(${p.id}, this.checked)" style="cursor:pointer; width:15px; height:15px; accent-color:#6366f1;">
                        <div style="width:38px; height:38px; border-radius:11px; background:${cat.bg}; color:${cat.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i data-lucide="${cat.icon}" style="width:18px;height:18px;"></i>
                        </div>
                        <div>
                            <span class="rd-mini-chip" style="font-family:monospace; font-size:0.65rem; color:#6366f1;">${_epEsc(p.program_code || `EDF-PRG-${p.id}`)}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.35rem;">
                        ${statusBadge(p.status)}
                    </div>
                </div>

                <!-- Program Title & Description -->
                <h3 onclick="viewProgram(${p.id})" style="font-size:0.95rem; font-weight:800; color:var(--text-main); margin:0 0 0.4rem; line-height:1.35; cursor:pointer;" title="${_epEsc(p.title)}">
                    ${_epEsc(p.title)}
                </h3>
                <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.45; margin:0 0 0.85rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${_epEsc(p.description || 'No course overview provided.')}
                </p>

                <!-- Tags / Attributes -->
                <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-bottom:0.85rem; align-items:center;">
                    ${catBadge(p.category)}
                    ${audBadge(p.target_audience)}
                    ${modeBadge(p.delivery_mode)}
                    <span class="rd-mini-chip">${p.duration_weeks || 8} ${p.duration_type || 'weeks'}</span>
                    ${p.form_template_id ? `<span class="rd-mini-chip" style="color:#6366f1;" title="Linked Form Template"><i data-lucide="file-text" style="width:10px;height:10px;"></i> Form</span>` : ''}
                </div>
            </div>

            <!-- Stats & Progress Strip -->
            <div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.5rem; padding:0.65rem 0.75rem; background:var(--input-bg); border:1px solid var(--border-color); border-radius:12px; margin-bottom:0.85rem; text-align:center;">
                    <div>
                        <div style="font-size:0.62rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Batches</div>
                        <div style="font-size:1.05rem; font-weight:800; color:var(--text-main);">${p.batch_count || 0}</div>
                    </div>
                    <div>
                        <div style="font-size:0.62rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Applicants</div>
                        <div style="font-size:1.05rem; font-weight:800; color:#3b82f6;">${applicants}</div>
                    </div>
                    <div>
                        <div style="font-size:0.62rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Fee</div>
                        <div style="font-size:0.8rem; font-weight:800; color:#10b981; line-height:1.4;">${_epFmtMoney(p.fee)}</div>
                    </div>
                </div>

                <!-- Capacity Utilization Bar -->
                <div style="margin-bottom:0.9rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:0.3rem;">
                        <span>Enrolled / Capacity</span>
                        <strong style="color:var(--text-main);">${enrolled} / ${cap} seats (${fill}%)</strong>
                    </div>
                    <div style="height:6px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                        <div style="width:${fill}%; height:100%; background:${progressColor}; border-radius:99px; transition:width 0.4s ease;"></div>
                    </div>
                </div>

                <!-- Card Bottom Actions -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem; padding-top:0.75rem; border-top:1px solid var(--border-color);">
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="viewProgram(${p.id})" style="flex:1; justify-content:center; font-weight:700;">
                        <i data-lucide="eye" style="width:13px;"></i> Console
                    </button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openNewAppModal(${p.id})" title="Submit New Application for this program" style="padding:0.38rem 0.55rem; color:#6366f1;">
                        <i data-lucide="user-plus" style="width:14px;"></i>
                    </button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openAddBatchModal(${p.id})" title="Add Intake Batch" style="padding:0.38rem 0.55rem;">
                        <i data-lucide="layers" style="width:14px;"></i>
                    </button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditProgramModal(${p.id})" title="Edit Program Details" style="padding:0.38rem 0.55rem;">
                        <i data-lucide="edit-2" style="width:14px;"></i>
                    </button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="duplicateProgram(${p.id})" title="Duplicate Program" style="padding:0.38rem 0.55rem;">
                        <i data-lucide="copy" style="width:14px;"></i>
                    </button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="deleteProgram(${p.id})" title="Delete Program" style="padding:0.38rem 0.55rem;">
                        <i data-lucide="trash-2" style="width:14px;"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderProgramTableRows(paged, start) {
    const tbody = _epEl('programsTableBody');
    if (!tbody) return;

    if (!paged.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:3rem; color:var(--text-muted);">No programs found matching criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = paged.map((p, i) => {
        const isSelected = programsState.selectedPrograms.has(p.id);
        const cap = Number(p.max_capacity) || 30;
        const enrolled = Number(p.enrolled_count) || 0;
        const fill = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
        const progressColor = fill >= 95 ? '#ef4444' : fill >= 75 ? '#f59e0b' : '#10b981';

        return `
        <tr style="${isSelected ? 'background:rgba(99,102,241,0.05);' : ''}">
            <td style="text-align:center;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleProgramSelect(${p.id}, this.checked)" style="cursor:pointer; width:15px; height:15px; accent-color:#6366f1;">
            </td>
            <td style="text-align:center; color:var(--text-muted); font-size:0.75rem;">${start + i + 1}</td>
            <td>
                <div style="font-weight:800; color:var(--text-main); cursor:pointer;" onclick="viewProgram(${p.id})">${_epEsc(p.title)}</div>
                <div style="display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
                    <span class="rd-mini-chip" style="font-family:monospace; font-size:0.65rem; color:#6366f1;">${_epEsc(p.program_code || `EDF-PRG-${p.id}`)}</span>
                    <span style="font-size:0.72rem; color:var(--text-muted);">${p.duration_weeks || 8} ${p.duration_type || 'weeks'}</span>
                </div>
            </td>
            <td>
                <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
                    ${catBadge(p.category)}
                    ${audBadge(p.target_audience)}
                </div>
            </td>
            <td>
                <div style="font-size:0.8rem; font-weight:600; color:var(--text-main);">${_epEsc(p.location || 'EDF Centre')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${modeBadge(p.delivery_mode)}</div>
            </td>
            <td>
                <div style="font-size:0.8rem; font-weight:600;">${_epEsc(p.coordinator_name || '—')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${_epEsc(p.coordinator_phone || '')}</div>
            </td>
            <td style="white-space:nowrap;">
                <div style="font-weight:700;">${p.batch_count || 0} cohort(s)</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${p.applicant_count || 0} applicants</div>
            </td>
            <td style="min-width:140px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; margin-bottom:0.25rem;">
                    <span>${enrolled} / ${cap}</span>
                    <strong style="color:${progressColor};">${fill}%</strong>
                </div>
                <div style="height:5px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                    <div style="width:${fill}%; height:100%; background:${progressColor};"></div>
                </div>
            </td>
            <td style="white-space:nowrap; font-weight:700; color:#10b981;">
                ${_epFmtMoney(p.fee)}
            </td>
            <td>${statusBadge(p.status)}</td>
            <td style="text-align:right; white-space:nowrap;">
                <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="viewProgram(${p.id})" title="View Console" style="padding:0.32rem 0.55rem;"><i data-lucide="eye" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openNewAppModal(${p.id})" title="New Application" style="padding:0.32rem 0.55rem; color:#6366f1;"><i data-lucide="user-plus" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditProgramModal(${p.id})" title="Edit" style="padding:0.32rem 0.55rem;"><i data-lucide="edit-2" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="duplicateProgram(${p.id})" title="Duplicate" style="padding:0.32rem 0.55rem;"><i data-lucide="copy" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="deleteProgram(${p.id})" title="Delete" style="padding:0.32rem 0.55rem;"><i data-lucide="trash-2" style="width:13px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderProgramPagination(total, totalPages) {
    const bar = _epEl('epProgPaginationBar');
    if (!bar) return;
    const start = total ? (programsState.progPage - 1) * programsState.progPageSize + 1 : 0;
    const end = Math.min(programsState.progPage * programsState.progPageSize, total);

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
            <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">
                ${total ? `Showing ${start}–${end} of ${total} programs` : 'No results'}
            </span>
            <select class="fam-filter-select" onchange="setProgramPageSize(this.value)" title="Programs per page">
                ${[6, 9, 15, 30].map(n => `<option value="${n}" ${n === programsState.progPageSize ? 'selected' : ''}>${n} / page</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; gap:0.25rem; align-items:center;">
            <button type="button" class="fam-page-btn" ${programsState.progPage === 1 ? 'disabled' : ''} onclick="setProgramPage(${programsState.progPage - 1})">←</button>
            <span style="font-size:0.8rem; font-weight:700; padding:0 0.5rem; color:var(--text-main);">Page ${programsState.progPage} of ${totalPages}</span>
            <button type="button" class="fam-page-btn" ${programsState.progPage >= totalPages ? 'disabled' : ''} onclick="setProgramPage(${programsState.progPage + 1})">→</button>
        </div>`;
}

function setProgramPage(p) {
    programsState.progPage = Math.max(1, p);
    renderProgramView();
}

function setProgramPageSize(size) {
    programsState.progPageSize = parseInt(size, 10) || 9;
    programsState.progPage = 1;
    renderProgramView();
}

function setProgramViewMode(mode) {
    programsState.progViewMode = mode;
    renderProgramView();
}

function setProgramFilter(key, value) {
    programsState.filter[key] = value;
    programsState.progPage = 1;

    // Update pill buttons
    if (key === 'category') {
        document.querySelectorAll('#pv-programs [data-filter="category"]').forEach(b => {
            b.classList.toggle('filter-active', b.dataset.value === value);
        });
    }
    if (key === 'status') {
        document.querySelectorAll('#pv-programs [data-filter="status"]').forEach(b => {
            b.classList.toggle('active', b.dataset.value === value);
        });
    }

    renderProgramView();
}

function setProgramSearch(val) {
    programsState.filter.search = val;
    programsState.progPage = 1;
    const input = _epEl('epProgramSearchInput');
    if (input && input.value !== val) input.value = val;
    renderProgramView();
}

function setProgramSort(val) {
    programsState.filter.sort = val;
    programsState.progPage = 1;
    renderProgramView();
}

function hasActiveProgramFilters() {
    const f = programsState.filter;
    return f.category !== 'all' || f.audience !== 'all' || f.status !== 'all' ||
           f.delivery_mode !== 'all' || f.fee_type !== 'all' || !!f.search.trim();
}

function resetProgramFilters() {
    programsState.filter = {
        category: 'all',
        audience: 'all',
        status: 'all',
        delivery_mode: 'all',
        fee_type: 'all',
        search: '',
        sort: 'newest'
    };
    programsState.progPage = 1;

    const sIn = _epEl('epProgramSearchInput');
    if (sIn) sIn.value = '';
    const aud = _epEl('epProgAudienceFilter');
    if (aud) aud.value = 'all';
    const mode = _epEl('epProgModeFilter');
    if (mode) mode.value = 'all';
    const fee = _epEl('epProgFeeFilter');
    if (fee) fee.value = 'all';
    const sort = _epEl('epProgSortSelect');
    if (sort) sort.value = 'newest';

    document.querySelectorAll('#pv-programs [data-filter="category"]').forEach(b => {
        b.classList.toggle('filter-active', b.dataset.value === 'all');
    });
    document.querySelectorAll('#pv-programs [data-filter="status"]').forEach(b => {
        b.classList.toggle('active', b.dataset.value === 'all');
    });

    renderProgramView();
}

// ── Bulk Program Actions ───────────────────────────────────────────────────
function syncProgramBulkBar(paged) {
    const bar = _epEl('epProgBulkBar');
    const count = programsState.selectedPrograms.size;
    if (bar) bar.classList.toggle('visible', count > 0);
    _epSet('epProgBulkCount', count);

    const cb = _epEl('epProgSelectAllCb');
    if (cb && paged) {
        const all = paged.length > 0 && paged.every(p => programsState.selectedPrograms.has(p.id));
        cb.checked = all;
        cb.indeterminate = !all && paged.some(p => programsState.selectedPrograms.has(p.id));
    }
}

function toggleProgramSelect(id, checked) {
    checked ? programsState.selectedPrograms.add(id) : programsState.selectedPrograms.delete(id);
    renderProgramView();
}

function toggleSelectAllPrograms(checked) {
    const filtered = getFilteredPrograms();
    const start = (programsState.progPage - 1) * programsState.progPageSize;
    const paged = filtered.slice(start, start + programsState.progPageSize);
    paged.forEach(p => {
        checked ? programsState.selectedPrograms.add(p.id) : programsState.selectedPrograms.delete(p.id);
    });
    renderProgramView();
}

function clearProgramSelection() {
    programsState.selectedPrograms.clear();
    renderProgramView();
}

async function executeProgramBulkAction(action, value) {
    const ids = Array.from(programsState.selectedPrograms);
    if (!ids.length) return;

    try {
        let res;
        if (action === 'delete') {
            if (!confirm(`Delete ${ids.length} selected program(s)? All batches and student applications will also be permanently deleted.`)) return;
            res = await fetch('/api/programs/programs-bulk/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
        } else {
            res = await fetch('/api/programs/programs-bulk/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, status: value })
            });
        }

        const data = await res.json();
        if (res.ok) {
            toast(data.message || 'Bulk operation completed', 'success');
            programsState.selectedPrograms.clear();
            fetchPrograms();
        } else {
            toast(data.message || 'Operation failed', 'error');
        }
    } catch (e) {
        toast('Network error during bulk operation', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 2 — BATCHES & COHORTS SUB-VIEW (#pv-batches)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchBatches() {
    try {
        const res = await fetch('/api/programs/batches');
        if (res.ok) {
            programsState.batches = await res.json();
            renderAllBatchesView();
        }
    } catch (e) { console.error('fetchBatches error:', e); }
}

function renderAllBatchesView() {
    const tbody = _epEl('allBatchesBody');
    if (!tbody) return;

    const q = (_epEl('epBatchSearchInput')?.value || '').trim().toLowerCase();
    const progId = _epEl('epBatchProgramFilter')?.value || 'all';
    const status = _epEl('epBatchStatusFilter')?.value || 'all';

    let list = (programsState.batches || []).filter(b => {
        if (progId !== 'all' && String(b.course_id) !== String(progId)) return false;
        if (status !== 'all' && b.status !== status) return false;
        if (q) {
            const hay = [b.batch_name, b.batch_code, b.instructor_name, b.program_title, b.location]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="font-size:0.9rem; font-weight:700; margin-bottom:0.3rem;">No batches found</div>
            <p style="font-size:0.8rem; margin:0 0 1rem;">Create a cohort batch to begin enrolling students.</p>
            <button type="button" class="btn btn-primary" onclick="openAddBatchModal(null)"><i data-lucide="plus"></i> Add Batch</button>
        </td></tr>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    tbody.innerHTML = list.map((b, idx) => {
        const seats = Number(b.max_seats) || 30;
        const enrolled = Number(b.enrolled_count) || 0;
        const fill = seats > 0 ? Math.min(100, Math.round((enrolled / seats) * 100)) : 0;
        const color = fill >= 95 ? '#ef4444' : fill >= 75 ? '#f59e0b' : '#10b981';

        return `
        <tr>
            <td style="text-align:center; color:var(--text-muted); font-size:0.75rem;">${idx + 1}</td>
            <td>
                <div style="font-weight:800; color:var(--text-main);">${_epEsc(b.batch_name)}</div>
                <div style="font-family:monospace; font-size:0.68rem; color:#6366f1;">${_epEsc(b.batch_code || `B-${b.id}`)}</div>
            </td>
            <td>
                <div style="font-weight:700; color:var(--text-main); cursor:pointer;" onclick="viewProgram(${b.course_id})">${_epEsc(b.program_title || 'Educational Program')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${catBadge(b.program_category)}</div>
            </td>
            <td>
                <div style="font-weight:600;">${_epEsc(b.instructor_name || '—')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${_epEsc(b.instructor_phone || '')}</div>
            </td>
            <td style="white-space:nowrap;">
                <div style="font-size:0.8rem; font-weight:600;">${_epFmtDate(b.start_date)} ${b.end_date ? '→ ' + _epFmtDate(b.end_date) : ''}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${_epEsc(b.schedule_days || '')} ${_epEsc(b.schedule_time || '')}</div>
            </td>
            <td>
                <div style="font-size:0.8rem; font-weight:600;">${_epEsc(b.location || 'Classroom TBD')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${modeBadge(b.delivery_mode)}</div>
            </td>
            <td style="min-width:130px;">
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; margin-bottom:0.25rem;">
                    <span>${enrolled} / ${seats}</span>
                    <strong style="color:${color};">${fill}%</strong>
                </div>
                <div style="height:5px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                    <div style="width:${fill}%; height:100%; background:${color};"></div>
                </div>
            </td>
            <td>${statusBadge(b.status)}</td>
            <td style="text-align:right; white-space:nowrap;">
                <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="viewProgram(${b.course_id})" title="View Program Console" style="padding:0.32rem 0.55rem;"><i data-lucide="eye" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditBatchModal(${b.id}, ${b.course_id})" title="Edit Batch" style="padding:0.32rem 0.55rem;"><i data-lucide="edit-2" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="deleteBatch(${b.id}, ${b.course_id})" title="Delete Batch" style="padding:0.32rem 0.55rem;"><i data-lucide="trash-2" style="width:13px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 3 — STUDENT APPLICATIONS SUB-VIEW (#pv-applications)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchAllApplications() {
    try {
        const res = await fetch('/api/programs/applications');
        if (res.ok) {
            programsState.applications = await res.json();
            filterAllApplications();
        }
    } catch (e) { console.error('fetchAllApplications error:', e); }
}

function onAppProgramFilterChange() {
    const pid = _epEl('appProgramFilter')?.value || 'all';
    const batchSel = _epEl('appBatchFilter');
    if (batchSel) {
        batchSel.innerHTML = '<option value="all">All Batches</option>';
        if (pid !== 'all') {
            const relevant = programsState.batches.filter(b => String(b.course_id) === String(pid));
            relevant.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.batch_name} (${b.batch_code || 'B-' + b.id})`;
                batchSel.appendChild(opt);
            });
        }
    }
    filterAllApplications();
}

function setAppStatusFilter(status) {
    programsState.appFilter.status = status;
    programsState.appPage = 1;

    document.querySelectorAll('#pv-applications [id^="epAppPill-"]').forEach(b => b.classList.remove('active'));
    _epEl(`epAppPill-${status}`)?.classList.add('active');

    const sel = _epEl('appStatusFilter');
    if (sel && sel.value !== status) sel.value = status;

    filterAllApplications();
}

function resetAppFilters() {
    programsState.appFilter = {
        search: '',
        program: 'all',
        batch: 'all',
        status: 'all',
        gender: 'all',
        fee: 'all',
        sort: 'newest'
    };
    programsState.appPage = 1;

    const sIn = _epEl('appSearchInput'); if (sIn) sIn.value = '';
    const pSel = _epEl('appProgramFilter'); if (pSel) pSel.value = 'all';
    const bSel = _epEl('appBatchFilter'); if (bSel) bSel.value = 'all';
    const gSel = _epEl('appGenderFilter'); if (gSel) gSel.value = 'all';
    const fSel = _epEl('appFeeFilter'); if (fSel) fSel.value = 'all';
    const sort = _epEl('appSortSelect'); if (sort) sort.value = 'newest';

    document.querySelectorAll('#pv-applications [id^="epAppPill-"]').forEach(b => b.classList.remove('active'));
    _epEl('epAppPill-all')?.classList.add('active');

    filterAllApplications();
}

function getFilteredApplications() {
    const q = (_epEl('appSearchInput')?.value || '').trim().toLowerCase();
    const progId = _epEl('appProgramFilter')?.value || 'all';
    const batchId = _epEl('appBatchFilter')?.value || 'all';
    const status = programsState.appFilter.status;
    const gender = _epEl('appGenderFilter')?.value || 'all';
    const fee = _epEl('appFeeFilter')?.value || 'all';
    const sort = _epEl('appSortSelect')?.value || 'newest';

    let list = (programsState.applications || []).filter(a => {
        if (progId !== 'all' && String(a.course_id) !== String(progId)) return false;
        if (batchId !== 'all' && String(a.batch_id) !== String(batchId)) return false;
        if (status !== 'all' && a.status !== status) return false;
        if (gender !== 'all' && (a.applicant_gender || '').toLowerCase() !== gender.toLowerCase()) return false;

        if (fee !== 'all') {
            const fStatus = (a.fee_status || 'free').toLowerCase();
            if (fee === 'free' && fStatus !== 'free') return false;
            if (fee === 'scholarship' && fStatus !== 'scholarship') return false;
            if (fee === 'paid' && fStatus !== 'paid' && Number(a.fee_paid || 0) <= 0) return false;
            if (fee === 'unpaid' && (fStatus === 'paid' || fStatus === 'free' || fStatus === 'scholarship')) return false;
        }

        if (q) {
            const hay = [
                a.application_no, a.applicant_name, a.applicant_phone, a.whatsapp_number,
                a.applicant_email, a.nic_number, a.city, a.applicant_address,
                a.program_title, a.batch_name
            ].map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    list.sort((a, b) => {
        switch (sort) {
            case 'oldest': return (a.id || 0) - (b.id || 0);
            case 'name_asc': return (a.applicant_name || '').localeCompare(b.applicant_name || '');
            case 'attendance_desc': return (b.attendance_pct || 0) - (a.attendance_pct || 0);
            case 'newest':
            default:
                return (b.id || 0) - (a.id || 0);
        }
    });

    return list;
}

function filterAllApplications() {
    const filtered = getFilteredApplications();
    const total = filtered.length;
    const allApps = programsState.applications || [];

    // Sync status pill counts
    _epSet('epAppCount-all', allApps.length);
    _epSet('epAppCount-pending', allApps.filter(a => a.status === 'pending').length);
    _epSet('epAppCount-approved', allApps.filter(a => a.status === 'approved').length);
    _epSet('epAppCount-enrolled', allApps.filter(a => a.status === 'enrolled').length);
    _epSet('epAppCount-completed', allApps.filter(a => a.status === 'completed').length);
    _epSet('epAppCount-waitlisted', allApps.filter(a => a.status === 'waitlisted').length);
    _epSet('epAppCount-rejected', allApps.filter(a => a.status === 'rejected').length);

    _epSet('epAppFilterCount', `Showing ${total} of ${allApps.length}`);
    const clearBtn = _epEl('epAppSearchClearBtn');
    if (clearBtn) clearBtn.style.display = _epEl('appSearchInput')?.value ? 'inline-flex' : 'none';

    const hasFilters = programsState.appFilter.status !== 'all' ||
                       (_epEl('appProgramFilter')?.value || 'all') !== 'all' ||
                       (_epEl('appBatchFilter')?.value || 'all') !== 'all' ||
                       (_epEl('appGenderFilter')?.value || 'all') !== 'all' ||
                       (_epEl('appFeeFilter')?.value || 'all') !== 'all' ||
                       !!(_epEl('appSearchInput')?.value || '').trim();

    const resetBtn = _epEl('epAppResetBtn');
    if (resetBtn) resetBtn.style.display = hasFilters ? 'inline-flex' : 'none';

    const totalPages = Math.max(1, Math.ceil(total / programsState.appPageSize));
    if (programsState.appPage > totalPages) programsState.appPage = totalPages;
    const start = (programsState.appPage - 1) * programsState.appPageSize;
    const paged = filtered.slice(start, start + programsState.appPageSize);

    renderAllApplicationsTable(paged, start);
    renderAppPagination(total, totalPages);
    syncAppBulkBar(paged);
    if (window.lucide) lucide.createIcons();
}

function renderAllApplicationsTable(paged, start) {
    const tbody = _epEl('allAppsBody');
    if (!tbody) return;

    if (!paged.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:3.5rem 1.5rem; color:var(--text-muted);">
            <div style="width:48px;height:48px;border-radius:12px;background:var(--glow-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;">
                <i data-lucide="inbox" style="width:24px;height:24px;opacity:0.4;"></i>
            </div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-main); margin-bottom:0.25rem;">No student applications found</div>
            <p style="font-size:0.8rem; margin:0 0 1rem;">Try adjusting filters or register a new applicant.</p>
            <button type="button" class="btn btn-primary" onclick="openNewAppModal(null)"><i data-lucide="user-plus"></i> New Application</button>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = paged.map((a, i) => {
        const isSelected = programsState.selectedApps.has(a.id);
        const appNo = a.application_no || `APP-${new Date().getFullYear()}-${String(a.id).padStart(4, '0')}`;
        const att = Number(a.attendance_pct) || 0;
        const certIssued = Number(a.certificate_issued) === 1;

        return `
        <tr style="${isSelected ? 'background:rgba(99,102,241,0.05);' : ''}">
            <td style="text-align:center;">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleAppSelect(${a.id}, this.checked)" style="cursor:pointer; width:15px; height:15px; accent-color:#6366f1;">
            </td>
            <td>
                <div style="font-family:monospace; font-size:0.75rem; font-weight:800; color:#6366f1; cursor:pointer;" onclick="viewApplicationDossier(${a.id})">${_epEsc(appNo)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${_epFmtDate(a.applied_date)}</div>
            </td>
            <td>
                <div style="font-weight:800; color:var(--text-main); cursor:pointer;" onclick="viewApplicationDossier(${a.id})">${_epEsc(a.applicant_name)}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); display:flex; gap:0.35rem; align-items:center; margin-top:2px;">
                    ${a.applicant_gender ? `<span style="text-transform:capitalize;">${_epEsc(a.applicant_gender)}</span>` : ''}
                    ${a.applicant_age ? `<span>• Age ${a.applicant_age}</span>` : ''}
                    ${a.nic_number ? `<span style="font-family:monospace;">• ${_epEsc(a.nic_number)}</span>` : ''}
                </div>
            </td>
            <td>
                <div style="font-weight:700; color:var(--text-main);">${_epEsc(a.applicant_phone || '—')}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:1px;">
                    ${_epEsc(a.city || a.applicant_address || '')}
                </div>
            </td>
            <td>
                <div style="font-weight:700; color:var(--text-main); cursor:pointer;" onclick="viewProgram(${a.course_id})">${_epEsc(a.program_title || 'Educational Program')}</div>
                <div style="font-size:0.72rem; color:#6366f1; margin-top:1px;">
                    ${a.batch_name ? `<i data-lucide="layers" style="width:10px;height:10px;vertical-align:middle;"></i> ${_epEsc(a.batch_name)}` : '<em style="color:var(--text-muted);">Unassigned</em>'}
                </div>
            </td>
            <td>
                <div style="font-size:0.78rem; font-weight:600; text-transform:capitalize;">${_epEsc(a.education_level || 'General')}</div>
                <div style="font-size:0.72rem; color:#10b981; font-weight:700;">
                    ${a.fee_status === 'scholarship' ? 'Zakat Sponsored' : (a.fee_status === 'free' ? 'Free Course' : `Paid: ${_epFmtMoney(a.fee_paid)}`)}
                </div>
            </td>
            <td>
                <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem;">
                    <div style="flex:1; max-width:60px; height:5px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                        <div style="width:${att}%; height:100%; background:${att >= 80 ? '#10b981' : (att >= 50 ? '#f59e0b' : '#ef4444')};"></div>
                    </div>
                    <span style="font-weight:700;">${att}%</span>
                </div>
                <div style="margin-top:2px;">
                    ${certIssued ? `<span class="rd-mini-chip" style="color:#8b5cf6; font-size:0.65rem;" title="Cert No: ${_epEsc(a.certificate_no || '')}"><i data-lucide="award" style="width:10px;height:10px;"></i> Certified</span>` : ''}
                </div>
            </td>
            <td>${statusBadge(a.status)}</td>
            <td style="text-align:right; white-space:nowrap;">
                <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="viewApplicationDossier(${a.id})" title="View Student Dossier" style="padding:0.3rem 0.5rem;"><i data-lucide="eye" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-success" onclick="quickApproveApp(${a.id}, ${a.course_id})" title="Approve Student" style="padding:0.3rem 0.5rem;"><i data-lucide="check" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditAppModal(${a.id})" title="Edit Application" style="padding:0.3rem 0.5rem;"><i data-lucide="edit-2" style="width:13px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="deleteApplication(${a.id}, ${a.course_id})" title="Delete Application" style="padding:0.3rem 0.5rem;"><i data-lucide="trash-2" style="width:13px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderAppPagination(total, totalPages) {
    const bar = _epEl('epAppPaginationBar');
    if (!bar) return;
    const start = total ? (programsState.appPage - 1) * programsState.appPageSize + 1 : 0;
    const end = Math.min(programsState.appPage * programsState.appPageSize, total);

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
            <span style="font-size:0.78rem; color:var(--text-muted); font-weight:600;">
                ${total ? `Showing ${start}–${end} of ${total} applications` : 'No results'}
            </span>
            <select class="fam-filter-select" onchange="setAppPageSize(this.value)" title="Applicants per page">
                ${[10, 20, 50, 100].map(n => `<option value="${n}" ${n === programsState.appPageSize ? 'selected' : ''}>${n} / page</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; gap:0.25rem; align-items:center;">
            <button type="button" class="fam-page-btn" ${programsState.appPage === 1 ? 'disabled' : ''} onclick="setAppPage(${programsState.appPage - 1})">←</button>
            <span style="font-size:0.8rem; font-weight:700; padding:0 0.5rem; color:var(--text-main);">Page ${programsState.appPage} of ${totalPages}</span>
            <button type="button" class="fam-page-btn" ${programsState.appPage >= totalPages ? 'disabled' : ''} onclick="setAppPage(${programsState.appPage + 1})">→</button>
        </div>`;
}

function setAppPage(p) {
    programsState.appPage = Math.max(1, p);
    filterAllApplications();
}

function setAppPageSize(size) {
    programsState.appPageSize = parseInt(size, 10) || 10;
    programsState.appPage = 1;
    filterAllApplications();
}

// ── Bulk Application Actions ───────────────────────────────────────────────
function syncAppBulkBar(paged) {
    const bar = _epEl('epAppBulkBar');
    const count = programsState.selectedApps.size;
    if (bar) bar.classList.toggle('visible', count > 0);
    _epSet('epAppBulkCount', count);

    const cb = _epEl('epAppSelectAllCb');
    if (cb && paged) {
        const all = paged.length > 0 && paged.every(a => programsState.selectedApps.has(a.id));
        cb.checked = all;
        cb.indeterminate = !all && paged.some(a => programsState.selectedApps.has(a.id));
    }
}

function toggleAppSelect(id, checked) {
    checked ? programsState.selectedApps.add(id) : programsState.selectedApps.delete(id);
    filterAllApplications();
}

function toggleSelectAllApps(checked) {
    const filtered = getFilteredApplications();
    const start = (programsState.appPage - 1) * programsState.appPageSize;
    const paged = filtered.slice(start, start + programsState.appPageSize);
    paged.forEach(a => {
        checked ? programsState.selectedApps.add(a.id) : programsState.selectedApps.delete(a.id);
    });
    filterAllApplications();
}

function clearAppSelection() {
    programsState.selectedApps.clear();
    filterAllApplications();
}

async function executeAppBulkAction(action, value) {
    const ids = Array.from(programsState.selectedApps);
    if (!ids.length) return;

    try {
        let res;
        if (action === 'delete') {
            if (!confirm(`Permanently delete ${ids.length} selected student application(s)?`)) return;
            res = await fetch('/api/programs/applications-bulk/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
        } else if (action === 'certificate') {
            res = await fetch('/api/programs/applications-bulk/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, certificate_issued: value })
            });
        } else {
            res = await fetch('/api/programs/applications-bulk/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, status: value })
            });
        }

        const data = await res.json();
        if (res.ok) {
            toast(data.message || 'Bulk update completed', 'success');
            programsState.selectedApps.clear();
            fetchAllApplications();
            fetchPrograms();
        } else {
            toast(data.message || 'Operation failed', 'error');
        }
    } catch (e) {
        toast('Network error during bulk action', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 4 — PROGRAM CONSOLE MODAL (#programDetailModal)
// ═══════════════════════════════════════════════════════════════════════════

async function viewProgram(id) {
    programsState.viewingProgramId = id;
    try {
        const res = await fetch(`/api/programs/programs/${id}`);
        if (!res.ok) throw new Error('Failed to load program');
        const p = await res.json();
        renderProgramDetailConsole(p);
        openModal('programDetailModal');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error(err);
        toast('Failed to load program details', 'error');
    }
}

function renderProgramDetailConsole(p) {
    const cat = CATEGORIES[p.category] || CATEGORIES.other;

    _epSet('pdTitle', p.title);
    _epSet('pdCodeBadge', p.program_code || `EDF-PRG-${p.id}`);
    _epSet('pdLocation', p.location || 'Classroom / Venue TBD');
    _epSet('pdDuration', `${p.duration_weeks || 8} ${p.duration_type || 'weeks'}${p.schedule_days ? ' • ' + p.schedule_days : ''}`);
    _epSet('pdFee', _epFmtMoney(p.fee));
    _epSet('pdCapacity', `${p.enrolled_count || 0} / ${p.max_capacity || 30}`);
    _epSet('pdCoordinator', p.coordinator_name || 'Staff In-Charge');
    _epSet('pdCertType', p.certification || 'Certificate');

    const metaWrap = _epEl('pdMeta');
    if (metaWrap) {
        metaWrap.innerHTML = `
            ${catBadge(p.category)}
            ${audBadge(p.target_audience)}
            ${modeBadge(p.delivery_mode)}
            ${statusBadge(p.status)}
            ${p.scholarship_available ? `<span class="rd-mini-chip" style="color:#10b981;">Zakat Sponsored</span>` : ''}
        `;
    }

    _epSet('pdDescription', p.description || 'No detailed overview has been documented for this program yet.');
    _epSet('pdPrerequisites', p.prerequisites || 'Open to all eligible applicants.');
    _epSet('pdMaterials', p.materials_provided || 'Course materials & formal certificate provided.');

    // Syllabus chips
    const chipsWrap = _epEl('pdSyllabusChips');
    if (chipsWrap) {
        const topics = (p.syllabus_topics || 'Fundamentals, Practical Training, Final Project')
            .split(',').map(s => s.trim()).filter(Boolean);
        chipsWrap.innerHTML = topics.map(t =>
            `<span class="rd-item-chip" style="cursor:default;"><i data-lucide="check-circle" style="width:11px;height:11px;color:#10b981;"></i> ${_epEsc(t)}</span>`
        ).join('');
    }

    // Enrollment metrics breakdown
    const bdWrap = _epEl('pdEnrollmentBreakdown');
    if (bdWrap) {
        const cap = Number(p.max_capacity) || 30;
        const enrolled = Number(p.enrolled_count) || 0;
        const pending = Number(p.pending_count) || 0;
        const totalApps = Number(p.applicant_count) || 0;
        const graduates = Number(p.completed_count) || 0;
        const fill = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;

        bdWrap.innerHTML = `
            <div style="margin-bottom:0.85rem;">
                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:0.35rem;">
                    <span style="color:var(--text-muted);">Intake Capacity Fill</span>
                    <strong>${enrolled} / ${cap} seats (${fill}%)</strong>
                </div>
                <div style="height:7px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                    <div style="width:${fill}%; height:100%; background:${fill >= 95 ? '#ef4444' : (fill >= 75 ? '#f59e0b' : '#10b981')};"></div>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.4rem; text-align:center;">
                <div class="rd-mini-chip" style="flex-direction:column; padding:0.4rem; border-radius:10px;"><b style="font-size:0.95rem;">${totalApps}</b>Applied</div>
                <div class="rd-mini-chip" style="flex-direction:column; padding:0.4rem; border-radius:10px; color:#10b981;"><b style="font-size:0.95rem;">${enrolled}</b>Enrolled</div>
                <div class="rd-mini-chip" style="flex-direction:column; padding:0.4rem; border-radius:10px; color:#f59e0b;"><b style="font-size:0.95rem;">${pending}</b>Pending</div>
                <div class="rd-mini-chip" style="flex-direction:column; padding:0.4rem; border-radius:10px; color:#8b5cf6;"><b style="font-size:0.95rem;">${graduates}</b>Grads</div>
            </div>`;
    }

    // Schedule & admin details
    const admWrap = _epEl('pdAdminDetails');
    if (admWrap) {
        admWrap.innerHTML = `
            <div><strong>Next Intake:</strong> ${_epFmtDate(p.start_date)}</div>
            <div><strong>Application Deadline:</strong> ${_epFmtDate(p.application_deadline)}</div>
            <div><strong>Class Timing:</strong> ${_epEsc(p.schedule_time || 'TBD')}</div>
            <div><strong>Language:</strong> ${_epEsc(p.language || 'Tamil & Sinhala')}</div>
            <div><strong>Coordinator Contact:</strong> ${_epEsc(p.coordinator_phone || '—')}</div>
        `;
    }

    // Render batches table
    const batchBody = _epEl('pdBatchesBody');
    const batches = p.batches || [];
    _epSet('pdTabCountBatches', batches.length);

    if (batchBody) {
        if (!batches.length) {
            batchBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">
                No batches created yet. <a href="javascript:void(0)" onclick="openAddBatchModal(${p.id})" style="color:#6366f1; font-weight:700;">Create First Batch</a>
            </td></tr>`;
        } else {
            batchBody.innerHTML = batches.map(b => {
                const seats = Number(b.max_seats) || 30;
                const enr = Number(b.enrolled_count) || 0;
                const pct = seats > 0 ? Math.min(100, Math.round((enr / seats) * 100)) : 0;
                return `
                <tr>
                    <td>
                        <div style="font-weight:800; color:var(--text-main);">${_epEsc(b.batch_name)}</div>
                        <div style="font-family:monospace; font-size:0.68rem; color:#6366f1;">${_epEsc(b.batch_code || `B-${b.id}`)}</div>
                    </td>
                    <td>${_epEsc(b.instructor_name || '—')}</td>
                    <td>${_epFmtDate(b.start_date)}</td>
                    <td>${_epFmtDate(b.end_date)}</td>
                    <td>${_epEsc(b.schedule_days || '')} ${_epEsc(b.location || '')}</td>
                    <td style="min-width:110px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-bottom:2px;">
                            <span>${enr} / ${seats}</span>
                            <strong>${pct}%</strong>
                        </div>
                        <div style="height:4px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                            <div style="width:${pct}%; height:100%; background:#10b981;"></div>
                        </div>
                    </td>
                    <td>${statusBadge(b.status)}</td>
                    <td style="text-align:right;">
                        <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                            <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditBatchModal(${b.id}, ${p.id})" style="padding:0.25rem 0.5rem;"><i data-lucide="edit-2" style="width:12px;"></i></button>
                            <button type="button" class="prog-btn prog-btn-danger" onclick="deleteBatch(${b.id}, ${p.id})" style="padding:0.25rem 0.5rem;"><i data-lucide="trash-2" style="width:12px;"></i></button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    // Load applications for this program into console
    loadProgramConsoleApplications(p.id, batches);

    // Switch to Overview tab by default
    switchProgramDetailTab('overview');
}

function switchProgramDetailTab(tab) {
    programsState.programDetailTab = tab;
    ['overview', 'batches', 'apps'].forEach(t => {
        const view = _epEl(`pdView-${t}`);
        const btn = _epEl(`pdTabBtn-${t}`);
        if (view) view.style.display = t === tab ? 'block' : 'none';
        if (btn) btn.classList.toggle('pv-tab-active', t === tab);
    });
    if (window.lucide) lucide.createIcons();
}

let _currentConsoleApps = [];
async function loadProgramConsoleApplications(programId, batches) {
    try {
        const res = await fetch(`/api/programs/programs/${programId}/applications`);
        if (!res.ok) return;
        _currentConsoleApps = await res.json();
        _epSet('pdTabCountApps', _currentConsoleApps.length);

        // Populate console batch filter
        const sel = _epEl('pdAppBatchFilter');
        if (sel) {
            sel.innerHTML = '<option value="all">All Batches</option>' +
                (batches || []).map(b => `<option value="${b.id}">${_epEsc(b.batch_name)}</option>`).join('');
        }

        filterProgramConsoleApps();
    } catch (err) { console.error('loadProgramConsoleApplications error:', err); }
}

function filterProgramConsoleApps() {
    const q = (_epEl('pdAppSearchInput')?.value || '').trim().toLowerCase();
    const batchId = _epEl('pdAppBatchFilter')?.value || 'all';
    const status = _epEl('pdAppStatusFilter')?.value || 'all';

    const filtered = _currentConsoleApps.filter(a => {
        if (batchId !== 'all' && String(a.batch_id) !== String(batchId)) return false;
        if (status !== 'all' && a.status !== status) return false;
        if (q) {
            const hay = [a.application_no, a.applicant_name, a.applicant_phone, a.nic_number, a.city]
                .map(x => String(x ?? '').toLowerCase()).join(' | ');
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    const tbody = _epEl('pdAppsBody');
    if (!tbody) return;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No student applications found for this program view.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(a => {
        const appNo = a.application_no || `APP-${new Date().getFullYear()}-${String(a.id).padStart(4, '0')}`;
        return `
        <tr>
            <td style="font-family:monospace; font-weight:700; font-size:0.75rem; color:#6366f1; cursor:pointer;" onclick="viewApplicationDossier(${a.id})">${_epEsc(appNo)}</td>
            <td>
                <div style="font-weight:700; color:var(--text-main); cursor:pointer;" onclick="viewApplicationDossier(${a.id})">${_epEsc(a.applicant_name)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${_epEsc(a.applicant_gender || '')} ${a.applicant_age ? '• Age ' + a.applicant_age : ''}</div>
            </td>
            <td>${_epEsc(a.applicant_phone || '—')}</td>
            <td>${_epEsc(a.batch_name || 'Unassigned')}</td>
            <td>
                <div style="font-size:0.75rem; font-weight:600; text-transform:capitalize;">${_epEsc(a.education_level || 'General')}</div>
                <div style="font-size:0.7rem; color:#10b981;">${a.fee_status === 'free' ? 'Free' : (a.fee_status === 'scholarship' ? 'Scholarship' : _epFmtMoney(a.fee_paid))}</div>
            </td>
            <td>
                <div style="font-size:0.75rem; font-weight:700;">${a.attendance_pct || 0}% Att</div>
                ${Number(a.certificate_issued) === 1 ? `<span class="rd-mini-chip" style="color:#8b5cf6; font-size:0.62rem;">Cert Issued</span>` : ''}
            </td>
            <td>${statusBadge(a.status)}</td>
            <td style="text-align:right; white-space:nowrap;">
                <div style="display:flex; gap:0.25rem; justify-content:flex-end;">
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="viewApplicationDossier(${a.id})" title="View Dossier" style="padding:0.22rem 0.45rem;"><i data-lucide="eye" style="width:12px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-ghost" style="padding:0.22rem 0.45rem; color:#10b981;" onclick="changeAppStatus(${a.id}, 'approved', ${a.course_id})" title="Approve">✓</button>
                    <button type="button" class="prog-btn prog-btn-ghost" style="padding:0.22rem 0.45rem; color:#3b82f6;" onclick="changeAppStatus(${a.id}, 'enrolled', ${a.course_id})" title="Enroll">🎓</button>
                    <button type="button" class="prog-btn prog-btn-ghost" style="padding:0.22rem 0.45rem; color:#8b5cf6;" onclick="changeAppStatus(${a.id}, 'completed', ${a.course_id})" title="Graduate">🏆</button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="openEditAppModal(${a.id})" title="Edit" style="padding:0.22rem 0.45rem;"><i data-lucide="edit-2" style="width:12px;"></i></button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="deleteApplication(${a.id}, ${a.course_id})" title="Delete" style="padding:0.22rem 0.45rem;"><i data-lucide="trash-2" style="width:12px;"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function exportProgramRoster(format) {
    if (!_currentConsoleApps.length) {
        toast('No students in this roster to export', 'error');
        return;
    }
    const prog = programsState.programs.find(p => p.id === programsState.viewingProgramId);
    const rows = _currentConsoleApps.map(a => ({
        'App Ref': a.application_no || `APP-${a.id}`,
        'Student Name': a.applicant_name,
        'Phone': a.applicant_phone || '',
        'WhatsApp': a.whatsapp_number || '',
        'NIC': a.nic_number || '',
        'Gender': a.applicant_gender || '',
        'Age': a.applicant_age || '',
        'City': a.city || '',
        'Batch': a.batch_name || 'Unassigned',
        'Status': a.status,
        'Education': a.education_level || '',
        'Fee Status': a.fee_status || '',
        'Fee Paid (LKR)': a.fee_paid || 0,
        'Attendance %': a.attendance_pct || 0,
        'Grade': a.grade_result || '',
        'Certificate Issued': Number(a.certificate_issued) === 1 ? 'Yes' : 'No',
        'Certificate No': a.certificate_no || '',
        'Applied Date': a.applied_date ? String(a.applied_date).split('T')[0] : ''
    }));
    _epExportData(rows, `EDF_${(prog?.title || 'Program').replace(/\s+/g, '_')}_Roster`, format, 'Roster');
}

function printProgramSummary() {
    const prog = programsState.programs.find(p => p.id === programsState.viewingProgramId);
    if (!prog) return;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { toast('Please allow pop-ups to print roster', 'error'); return; }

    const rowsHtml = _currentConsoleApps.map((a, i) => `
        <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td><strong>${_epEsc(a.applicant_name)}</strong><br><small>${_epEsc(a.application_no || '')}</small></td>
            <td>${_epEsc(a.applicant_phone || '')}</td>
            <td>${_epEsc(a.nic_number || '—')}</td>
            <td>${_epEsc(a.batch_name || 'Unassigned')}</td>
            <td style="text-transform:capitalize;">${_epEsc(a.status)}</td>
            <td>${a.attendance_pct || 0}%</td>
            <td>${Number(a.certificate_issued) === 1 ? 'Issued' : '—'}</td>
        </tr>
    `).join('');

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EDF Student Roster — ${_epEsc(prog.title)}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; color: #111; }
                .hdr { border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-end; }
                h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
                table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 1rem; }
                th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
                th { background: #f4f4f4; font-weight: 700; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div class="hdr">
                <div>
                    <h1>Education & Development Foundation (EDF)</h1>
                    <div style="font-size:0.95rem; font-weight:700;">Program Student Roster: ${_epEsc(prog.title)} (${_epEsc(prog.program_code || '')})</div>
                    <div style="font-size:0.8rem; color:#555;">Venue: ${_epEsc(prog.location || 'EDF Centre')} • Duration: ${prog.duration_weeks || 8} weeks • Total Students: ${_currentConsoleApps.length}</div>
                </div>
                <button onclick="window.print()" style="padding:0.4rem 1rem; cursor:pointer;">Print / Save PDF</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">#</th>
                        <th>Student Name & Ref</th>
                        <th>Phone</th>
                        <th>NIC</th>
                        <th>Batch</th>
                        <th>Status</th>
                        <th>Attendance</th>
                        <th>Certificate</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
    `);
    printWin.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 5 — PROGRAM CREATE / EDIT MODAL (#programModal)
// ═══════════════════════════════════════════════════════════════════════════

async function populateCourseTemplateSelect(selectedId = null) {
    const sel = _epEl('courseTemplateSelect');
    if (!sel) return;
    try {
        const res = await fetch('/api/forms/templates');
        if (!res.ok) return;
        const templates = await res.json();
        sel.innerHTML = '<option value="">— Use Standard Form —</option>' +
            templates.map(t => `<option value="${t.id}" ${t.id == selectedId ? 'selected' : ''}>${_epEsc(t.name)} ${t.is_default ? '(Default)' : ''}</option>`).join('');
    } catch (e) { console.error('populateCourseTemplateSelect error:', e); }
}

function selectProgramCategoryCard(cat) {
    const hidden = _epEl('epFormCategoryInput');
    if (hidden) hidden.value = cat;

    document.querySelectorAll('#epCategoryCardGrid .ep-cat-card').forEach(c => {
        c.classList.toggle('active', c.dataset.cat === cat);
    });
    updateProgramModalPreview();
}

function autoGenerateProgramCode() {
    const prefix = 'EDF-PRG';
    const num = Math.floor(100 + Math.random() * 900);
    const input = _epEl('epProgCodeInput');
    if (input) input.value = `${prefix}-${num}`;
    updateProgramModalPreview();
}

function toggleProgramSyllabusTopic(topic) {
    const input = _epEl('epProgSyllabusInput');
    if (!input) return;
    const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
    const idx = current.findIndex(s => s.toLowerCase() === topic.toLowerCase());
    if (idx >= 0) current.splice(idx, 1);
    else current.push(topic);
    input.value = current.join(', ');
}

function updateProgramModalPreview() {
    const form = _epEl('programForm');
    if (!form) return;

    const title = _epEl('epProgTitleInput')?.value || 'Untitled Educational Program';
    const code = _epEl('epProgCodeInput')?.value || 'EDF-PRG';
    const cat = _epEl('epFormCategoryInput')?.value || 'skills';
    const status = _epEl('epProgStatusInput')?.value || 'active';
    const cap = _epEl('epProgCapInput')?.value || '30';
    const duration = _epEl('epProgDurationInput')?.value || '8';
    const durType = _epEl('epProgDurationTypeInput')?.value || 'weeks';
    const fee = Number(_epEl('epProgFeeInput')?.value || 0);
    const mode = _epEl('epProgModeInput')?.value || 'in_person';
    const loc = _epEl('epProgLocationInput')?.value || 'Venue TBD';

    _epSet('epProgPreviewCode', code);
    _epSet('epProgPreviewTitle', title);

    const cBadge = _epEl('epProgPreviewCatBadge');
    if (cBadge) cBadge.innerHTML = catBadge(cat);

    const sBadge = _epEl('epProgPreviewStatusBadge');
    if (sBadge) sBadge.innerHTML = statusBadge(status);

    _epSet('epProgPreviewSub', `${duration} ${durType} • ${mode.replace('_', ' ')} • ${loc}`);
    _epSet('epProgPreviewCap', `${cap} Seats`);
    _epSet('epProgPreviewFee', _epFmtMoney(fee));
}

function applyProgramPreset(type) {
    const p = PROGRAM_PRESETS[type];
    if (!p) return;

    const form = _epEl('programForm');
    if (!form) return;

    _epEl('epProgTitleInput').value = p.title;
    selectProgramCategoryCard(p.category);
    _epEl('epProgAudienceInput').value = p.target_audience;
    if (form.elements['level']) form.elements['level'].value = p.level;
    _epEl('epProgModeInput').value = p.delivery_mode;
    if (form.elements['language']) form.elements['language'].value = p.language;
    _epEl('epProgDurationInput').value = p.duration_weeks;
    _epEl('epProgDurationTypeInput').value = p.duration_type;
    _epEl('epProgFeeInput').value = p.fee;
    _epEl('epProgCapInput').value = p.max_capacity;
    _epEl('epProgLocationInput').value = p.location;
    if (form.elements['schedule_days']) form.elements['schedule_days'].value = p.schedule_days;
    if (form.elements['schedule_time']) form.elements['schedule_time'].value = p.schedule_time;
    if (form.elements['coordinator_name']) form.elements['coordinator_name'].value = p.coordinator_name;
    if (form.elements['coordinator_phone']) form.elements['coordinator_phone'].value = p.coordinator_phone;
    if (form.elements['description']) form.elements['description'].value = p.description;
    _epEl('epProgSyllabusInput').value = p.syllabus_topics;
    if (form.elements['prerequisites']) form.elements['prerequisites'].value = p.prerequisites;
    if (form.elements['materials_provided']) form.elements['materials_provided'].value = p.materials_provided;
    if (form.elements['certification']) form.elements['certification'].value = p.certification;
    const initName = _epEl('epInitBatchName');
    if (initName) initName.value = p.initial_batch_name;

    autoGenerateProgramCode();
    updateProgramModalPreview();
    toast(`Preset applied: ${p.title}`, 'info');
}

function openCreateProgramModal() {
    programsState.editingProgramId = null;
    _epSet('programModalTitle', 'Create Educational Program');
    _epSet('epProgModalModeBadge', 'New Course');

    const form = _epEl('programForm');
    if (form) form.reset();

    const initSection = _epEl('epInitialBatchSection');
    if (initSection) initSection.style.display = 'block';

    selectProgramCategoryCard('skills');
    autoGenerateProgramCode();
    populateCourseTemplateSelect();
    updateProgramModalPreview();

    openModal('programModal');
    if (window.lucide) lucide.createIcons();
}

async function openEditProgramModal(id) {
    try {
        const p = programsState.programs.find(x => x.id === id);
        if (!p) return;

        programsState.editingProgramId = id;
        _epSet('programModalTitle', 'Edit Educational Program');
        _epSet('epProgModalModeBadge', `Edit ID: #${id}`);

        const form = _epEl('programForm');
        if (form) {
            form.reset();
            const fields = [
                'title', 'program_code', 'target_audience', 'level', 'delivery_mode', 'language',
                'description', 'status', 'max_capacity', 'fee', 'certification', 'location',
                'duration_weeks', 'duration_type', 'schedule_days', 'schedule_time',
                'coordinator_name', 'coordinator_phone', 'prerequisites', 'syllabus_topics',
                'materials_provided', 'start_date', 'application_deadline', 'form_template_id'
            ];
            fields.forEach(k => {
                if (form.elements[k]) form.elements[k].value = p[k] ?? '';
            });

            if (_epEl('epProgScholarshipCb')) {
                _epEl('epProgScholarshipCb').checked = p.scholarship_available !== 0;
            }
        }

        const initSection = _epEl('epInitialBatchSection');
        if (initSection) initSection.style.display = 'none';

        selectProgramCategoryCard(p.category || 'skills');
        populateCourseTemplateSelect(p.form_template_id);
        updateProgramModalPreview();

        openModal('programModal');
        if (window.lucide) lucide.createIcons();
    } catch (err) { console.error('openEditProgramModal error:', err); }
}

async function submitProgramForm(openConsoleAfter = false) {
    const form = _epEl('programForm');
    if (!form || !form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const id = programsState.editingProgramId;
    const isEdit = !!id;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `/api/programs/programs/${id}` : '/api/programs/programs';

    // Parse checkboxes
    data.scholarship_available = _epEl('epProgScholarshipCb')?.checked ? 1 : 0;
    data.create_initial_batch = _epEl('epCreateInitialBatchCb')?.checked ? true : false;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Failed to save program');

        closeModal('programModal');
        toast(isEdit ? 'Program updated successfully!' : 'Program created successfully!', 'success');
        await fetchPrograms();

        const targetId = isEdit ? id : result.id;
        if (openConsoleAfter && targetId) {
            viewProgram(targetId);
        }
    } catch (err) {
        toast(err.message || 'Failed to save program', 'error');
    }
}

document.getElementById('programForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitProgramForm(false);
});

async function duplicateProgram(id) {
    const p = programsState.programs.find(x => x.id === id);
    if (!p) return;
    const title = prompt(`Duplicate "${p.title}"\nEnter new title:`, `${p.title} (Cohort 2)`);
    if (title === null) return;

    const copyBatches = confirm('Also duplicate existing cohort batches for this new program?');
    try {
        const res = await fetch(`/api/programs/programs/${id}/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, copy_batches: copyBatches })
        });
        const r = await res.json();
        if (res.ok) {
            toast(r.message || 'Program duplicated', 'success');
            fetchPrograms();
        } else {
            toast(r.message || 'Duplicate failed', 'error');
        }
    } catch (e) { toast('Network error while duplicating', 'error'); }
}

async function deleteProgram(id) {
    const p = programsState.programs.find(x => x.id === id);
    const title = p ? `"${p.title}"` : 'this program';
    if (!confirm(`Are you sure you want to permanently delete ${title}?\n\nWARNING: All associated batches and participant applications will also be deleted. This cannot be undone.`)) {
        return;
    }
    try {
        const res = await fetch(`/api/programs/programs/${id}`, { method: 'DELETE' });
        const r = await res.json();
        if (res.ok) {
            toast('Program deleted successfully', 'success');
            programsState.selectedPrograms.delete(id);
            if (programsState.viewingProgramId === id) closeModal('programDetailModal');
            fetchPrograms();
        } else {
            toast(r.message || 'Failed to delete program', 'error');
        }
    } catch (err) { toast('Network error while deleting', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 6 — BATCH CREATE / EDIT MODAL (#batchModal)
// ═══════════════════════════════════════════════════════════════════════════

function openAddBatchModal(courseId = null) {
    programsState.editingBatchId = null;
    _epSet('batchModalTitle', 'Add Program Batch');

    const form = _epEl('batchForm');
    if (form) form.reset();

    const courseSel = _epEl('batchCourseSelect');
    if (courseSel && courseId) {
        courseSel.value = courseId;
    }

    const nameInput = _epEl('batchNameInput');
    if (nameInput) {
        const yr = new Date().getFullYear();
        nameInput.value = `Batch ${yr}-A`;
    }

    openModal('batchModal');
    if (window.lucide) lucide.createIcons();
}

async function openEditBatchModal(batchId, courseId) {
    try {
        programsState.editingBatchId = batchId;
        _epSet('batchModalTitle', 'Edit Batch Intake');

        const b = (programsState.batches || []).find(x => x.id === batchId);
        const form = _epEl('batchForm');
        if (form && b) {
            form.reset();
            const fields = [
                'batch_name', 'batch_code', 'start_date', 'end_date', 'instructor_name',
                'instructor_phone', 'schedule_days', 'schedule_time', 'delivery_mode',
                'status', 'max_seats', 'location', 'notes'
            ];
            fields.forEach(k => {
                if (form.elements[k]) form.elements[k].value = b[k] ?? '';
            });
            if (_epEl('batchCourseSelect')) _epEl('batchCourseSelect').value = b.course_id || courseId;
        }

        openModal('batchModal');
        if (window.lucide) lucide.createIcons();
    } catch (e) { console.error('openEditBatchModal error:', e); }
}

document.getElementById('batchForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const batchId = programsState.editingBatchId;
    const isEdit = !!batchId;
    const courseId = data.course_id || programsState.viewingProgramId;

    if (!courseId) {
        toast('Please select an Educational Program', 'error');
        return;
    }

    const url = isEdit ? `/api/programs/batches/${batchId}` : `/api/programs/programs/${courseId}/batches`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.message || 'Failed to save batch');

        closeModal('batchModal');
        toast(isEdit ? 'Batch updated successfully!' : 'Batch created successfully!', 'success');

        await fetchBatches();
        await fetchPrograms();

        if (programsState.viewingProgramId === Number(courseId)) {
            viewProgram(courseId);
        }
    } catch (err) { toast(err.message || 'Failed to save batch', 'error'); }
});

async function deleteBatch(batchId, courseId) {
    if (!confirm('Are you sure you want to delete this batch cohort?\nStudents enrolled in this batch will be unassigned.')) return;
    try {
        const res = await fetch(`/api/programs/batches/${batchId}`, { method: 'DELETE' });
        const r = await res.json();
        if (res.ok) {
            toast('Batch deleted', 'success');
            await fetchBatches();
            await fetchPrograms();
            if (programsState.viewingProgramId) viewProgram(programsState.viewingProgramId);
        } else {
            toast(r.message || 'Failed to delete batch', 'error');
        }
    } catch (e) { toast('Network error while deleting batch', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 7 — STUDENT APPLICATION MODAL (#appModal)
// ═══════════════════════════════════════════════════════════════════════════

async function loadDirectoryLookupRecords() {
    try {
        const res = await fetch('/api/programs/directory-lookup');
        if (res.ok) {
            programsState.directoryRecords = await res.json();
        }
    } catch (_) {}
}

function onDirectoryLookupInput(q) {
    const listWrap = _epEl('epDirectoryLookupResults');
    if (!listWrap) return;
    const query = (q || '').trim().toLowerCase();

    if (!query) {
        listWrap.classList.remove('open');
        listWrap.innerHTML = '';
        return;
    }

    const matches = (programsState.directoryRecords || []).filter(r =>
        r.name.toLowerCase().includes(query) ||
        (r.phone && r.phone.includes(query)) ||
        (r.nic && r.nic.toLowerCase().includes(query))
    ).slice(0, 8);

    if (!matches.length) {
        listWrap.innerHTML = `<div style="padding:0.6rem 0.85rem; font-size:0.78rem; color:var(--text-muted);">No matching directory records found</div>`;
        listWrap.classList.add('open');
        return;
    }

    listWrap.innerHTML = matches.map((r, i) => `
        <div class="ep-lookup-item" onclick="selectDirectoryItem(${i})">
            <div>
                <div style="font-weight:700; color:var(--text-main);">${_epEsc(r.name)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">
                    ${r.phone ? _epEsc(r.phone) + ' • ' : ''}
                    ${r.city ? _epEsc(r.city) + ' • ' : ''}
                    ${r.nic ? 'NIC: ' + _epEsc(r.nic) : ''}
                </div>
            </div>
            <span class="rd-mini-chip" style="font-size:0.65rem;">${_epEsc(r.source_label)}</span>
        </div>
    `).join('');
    listWrap.classList.add('open');

    // Attach click-outside close
    document.addEventListener('click', function closeLookup(e) {
        if (!e.target.closest('.ep-lookup-wrap')) {
            listWrap.classList.remove('open');
            document.removeEventListener('click', closeLookup);
        }
    });
}

function selectDirectoryItem(idx) {
    const q = (_epEl('epDirectoryLookupInput')?.value || '').trim().toLowerCase();
    const matches = (programsState.directoryRecords || []).filter(r =>
        r.name.toLowerCase().includes(query) ||
        (r.phone && r.phone.includes(query)) ||
        (r.nic && r.nic.toLowerCase().includes(query))
    );
    const r = matches[idx] || programsState.directoryRecords[idx];
    if (!r) return;

    _epEl('appNameInput').value = r.name || '';
    if (_epEl('appPhoneInput')) _epEl('appPhoneInput').value = r.phone || '';
    if (_epEl('appWhatsappInput')) _epEl('appWhatsappInput').value = r.whatsapp || r.phone || '';
    if (_epEl('appEmailInput')) _epEl('appEmailInput').value = r.email || '';
    if (_epEl('appNicInput')) _epEl('appNicInput').value = r.nic || '';
    if (_epEl('appDobInput')) _epEl('appDobInput').value = r.dob || '';
    if (_epEl('appAgeInput')) _epEl('appAgeInput').value = r.age || '';
    if (_epEl('appGenderInput') && r.gender) _epEl('appGenderInput').value = r.gender;
    if (_epEl('appAddressInput')) _epEl('appAddressInput').value = r.address || '';
    if (_epEl('appCityInput')) _epEl('appCityInput').value = r.city || '';
    if (_epEl('appIncomeInput')) _epEl('appIncomeInput').value = r.income || 0;
    if (_epEl('appGuardianNameInput')) _epEl('appGuardianNameInput').value = r.guardian_name || '';
    if (_epEl('appBeneficiaryIdInput')) _epEl('appBeneficiaryIdInput').value = r.beneficiary_id || '';

    const badge = _epEl('appLinkedBeneficiaryBadge');
    if (badge) {
        badge.style.display = 'inline-flex';
        badge.textContent = `Auto-Filled from: ${r.source_label}`;
    }

    _epEl('epDirectoryLookupResults')?.classList.remove('open');
    _epEl('epDirectoryLookupInput').value = '';
    toast(`Populated details for "${r.name}"`, 'success');
}

function onAppDobChange(val) {
    if (!val) return;
    try {
        const birthDate = new Date(val);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        if (age >= 0 && _epEl('appAgeInput')) {
            _epEl('appAgeInput').value = age;
        }
    } catch (_) {}
}

async function onAppModalProgramSelect() {
    const sel = _epEl('appProgramSelect');
    const pid = sel ? sel.value : null;
    const batchSel = _epEl('appBatchSelect');

    if (!pid) {
        _epSet('appCtxProgramTitle', 'Select a Program to view details');
        _epSet('appCtxProgramMeta', 'Duration, venue, available seats, and tuition fee will appear here');
        _epSet('appCtxSeats', '—');
        _epSet('appCtxFee', '—');
        if (batchSel) batchSel.innerHTML = '<option value="">— Select program first —</option>';
        const dynContainer = _epEl('dynamicFormContainer');
        if (dynContainer) dynContainer.style.display = 'none';
        return;
    }

    const prog = programsState.programs.find(p => String(p.id) === String(pid));
    if (prog) {
        _epSet('appCtxProgramTitle', `${prog.title} (${prog.program_code || 'EDF'})`);
        _epSet('appCtxProgramMeta', `${prog.duration_weeks || 8} ${prog.duration_type || 'weeks'} • ${prog.location || 'EDF Centre'} • Lead: ${prog.coordinator_name || 'Staff'}`);
        const cap = Number(prog.max_capacity) || 30;
        const enr = Number(prog.enrolled_count) || 0;
        _epSet('appCtxSeats', `${Math.max(0, cap - enr)} of ${cap} remaining`);
        _epSet('appCtxFee', _epFmtMoney(prog.fee));

        if (Number(prog.fee) === 0 && _epEl('appFeeStatusInput')) {
            _epEl('appFeeStatusInput').value = 'free';
        }
    }

    // Populate batches for this course
    if (batchSel) {
        try {
            const res = await fetch(`/api/programs/programs/${pid}/batches`);
            const batches = await res.json();
            batchSel.innerHTML = '<option value="">— No specific batch / Assign later —</option>' +
                batches.map(b => `<option value="${b.id}">${_epEsc(b.batch_name)} (${_epEsc(b.batch_code || 'B-' + b.id)})</option>`).join('');
        } catch (_) {
            batchSel.innerHTML = '<option value="">— No specific batch —</option>';
        }
    }

    // Render dynamic fields from form template if any
    renderDynamicForm(pid);
}

function openNewAppModal(courseId = null) {
    programsState.editingAppId = null;
    _epSet('appModalTitle', 'New Student Application');
    _epSet('appModalNoBadge', 'Auto App #');

    const form = _epEl('appForm');
    if (form) form.reset();

    const badge = _epEl('appLinkedBeneficiaryBadge');
    if (badge) badge.style.display = 'none';

    // Auto-generate temporary reference code
    const yr = new Date().getFullYear();
    const num = Math.floor(1000 + Math.random() * 9000);
    if (_epEl('appNoInput')) _epEl('appNoInput').value = `APP-${yr}-${num}`;

    populateProgramFilterOptions();

    if (courseId && _epEl('appProgramSelect')) {
        _epEl('appProgramSelect').value = courseId;
        onAppModalProgramSelect();
    } else {
        onAppModalProgramSelect();
    }

    openModal('appModal');
    if (window.lucide) lucide.createIcons();
}

async function openEditAppModal(appId) {
    try {
        const res = await fetch(`/api/programs/applications/${appId}`);
        if (!res.ok) throw new Error('Failed to load application');
        const a = await res.json();

        programsState.editingAppId = appId;
        _epSet('appModalTitle', 'Edit Student Application');
        _epSet('appModalNoBadge', a.application_no || `APP-${a.id}`);

        populateProgramFilterOptions();

        const form = _epEl('appForm');
        if (form) {
            form.reset();
            const fields = [
                'course_id', 'applicant_name', 'application_no', 'applicant_phone', 'whatsapp_number',
                'applicant_email', 'applicant_dob', 'applicant_age', 'applicant_gender', 'applicant_address',
                'city', 'guardian_name', 'guardian_phone', 'emergency_contact', 'nic_number',
                'education_level', 'occupation', 'monthly_family_income', 'beneficiary_id',
                'fee_status', 'fee_paid', 'attendance_pct', 'grade_result', 'motivation', 'notes', 'status'
            ];
            fields.forEach(k => {
                if (form.elements[k]) form.elements[k].value = a[k] ?? '';
            });

            if (_epEl('appCertIssuedCb')) {
                _epEl('appCertIssuedCb').checked = Number(a.certificate_issued) === 1;
            }
        }

        // Trigger program select to update context & batches
        await onAppModalProgramSelect();
        if (_epEl('appBatchSelect') && a.batch_id) {
            _epEl('appBatchSelect').value = a.batch_id;
        }

        // Rehydrate custom dynamic fields
        if (a.custom_data) {
            try {
                const customObj = typeof a.custom_data === 'string' ? JSON.parse(a.custom_data) : a.custom_data;
                setTimeout(() => {
                    const content = _epEl('customFormContent');
                    if (content) {
                        content.querySelectorAll('.c-group, .c-check-group').forEach(group => {
                            const label = group.querySelector('label')?.textContent.replace('*', '').trim();
                            const input = group.querySelector('input, select, textarea');
                            if (label && input && customObj[label] !== undefined) {
                                if (input.type === 'checkbox') input.checked = customObj[label];
                                else input.value = customObj[label];
                            }
                        });
                    }
                }, 200);
            } catch (_) {}
        }

        openModal('appModal');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error(err);
        toast('Failed to load application data', 'error');
    }
}

async function submitApplicationForm(desiredStatus = null) {
    const form = _epEl('appForm');
    if (!form || !form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    if (desiredStatus) data.status = desiredStatus;
    data.certificate_issued = _epEl('appCertIssuedCb')?.checked ? 1 : 0;

    // Collect Dynamic Custom Form Data
    const customData = {};
    const customContent = _epEl('customFormContent');
    if (customContent) {
        customContent.querySelectorAll('.c-group, .c-check-group').forEach(group => {
            const labelEl = group.querySelector('label');
            const label = labelEl ? labelEl.textContent.replace('*', '').trim() : '';
            const input = group.querySelector('input, select, textarea');
            if (label && input) {
                if (input.type === 'checkbox') customData[label] = input.checked;
                else customData[label] = input.value;
            }
        });
    }
    data.custom_data = JSON.stringify(customData);

    const appId = programsState.editingAppId;
    const isEdit = !!appId;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `/api/programs/applications/${appId}` : '/api/programs/applications';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.message || 'Failed to submit application');

        closeModal('appModal');
        toast(isEdit ? 'Application updated successfully!' : 'Application registered successfully!', 'success');

        await fetchAllApplications();
        await fetchPrograms();

        if (programsState.viewingProgramId) {
            viewProgram(programsState.viewingProgramId);
        }
    } catch (err) { toast(err.message || 'Failed to submit application', 'error'); }
}

document.getElementById('appForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitApplicationForm();
});

// Dynamic form builder integration
async function renderDynamicForm(programId) {
    const container = _epEl('dynamicFormContainer');
    const content = _epEl('customFormContent');
    if (!container || !content) return;

    container.style.display = 'none';
    content.innerHTML = '';

    try {
        const res = await fetch('/api/forms/templates');
        if (!res.ok) return;
        const templates = await res.json();
        if (!templates.length) return;

        const p = programsState.programs.find(x => String(x.id) === String(programId));
        const tpl = (p && p.form_template_id && templates.find(t => t.id == p.form_template_id))
                 || templates.find(t => t.is_default)
                 || null;

        if (!tpl) return;
        const parsed = JSON.parse(tpl.structure);
        const fields = parsed.fields || [];

        // Exclude standard fields already in static form
        const toRender = fields.filter(f => !f.type.startsWith('std_'));
        if (!toRender.length) return;

        container.style.display = 'block';
        content.innerHTML = `
            <div style="margin-bottom:0.85rem; padding:0.45rem 0.75rem; background:var(--glow-bg); border:1px solid var(--border-color); border-radius:9px; font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem;">
                <i data-lucide="layout-template" style="width:13px;height:13px;color:#6366f1;"></i>
                Form Template: <strong style="color:var(--text-main);">${_epEsc(tpl.name)}</strong>
            </div>
            <div class="form-grid" id="customFieldsGrid"></div>`;

        const grid = content.querySelector('#customFieldsGrid');
        toRender.forEach(f => {
            const wrap = document.createElement('div');
            wrap.className = 'form-group c-group';
            if (f.width !== 'half') wrap.style.gridColumn = 'span 2';
            wrap.innerHTML = _buildCustomFieldHtml(f);
            grid.appendChild(wrap);
        });

        if (window.lucide) lucide.createIcons();
    } catch (e) { console.error('renderDynamicForm error:', e); }
}

function _buildCustomFieldHtml(f) {
    const req = f.required ? '<span style="color:#ef4444;">*</span>' : '';
    const name = `custom_${f.id}`;
    const label = `<label class="form-label">${_epEsc(f.label || 'Field')} ${req}</label>`;
    const reqAttr = f.required ? 'required' : '';
    const phAttr = f.placeholder ? `placeholder="${_epEsc(f.placeholder)}"` : '';

    if (f.type === 'textarea') {
        return `${label}<textarea name="${name}" class="form-input" rows="2" style="border-radius:12px;resize:vertical;" ${phAttr} ${reqAttr}></textarea>`;
    }
    if (f.type === 'select') {
        const opts = (f.options || []).map(o => `<option value="${_epEsc(o)}">${_epEsc(o)}</option>`).join('');
        return `${label}<select name="${name}" class="form-select" ${reqAttr}><option value="">— Select —</option>${opts}</select>`;
    }
    if (f.type === 'checkbox') {
        const opts = (f.options || []).map(o => `<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.82rem;margin-bottom:0.25rem;"><input type="checkbox" name="${name}_${_epEsc(o)}" value="${_epEsc(o)}"> ${_epEsc(o)}</label>`).join('');
        return `${label}<div>${opts}</div>`;
    }
    if (f.type === 'toggle') {
        return `${label}<label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;"><input type="checkbox" name="${name}" style="width:16px;height:16px;"> <span style="font-size:0.82rem;">Yes</span></label>`;
    }
    const inputType = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text');
    return `${label}<input type="${inputType}" name="${name}" class="form-input" ${phAttr} ${reqAttr}>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 8 — APPLICATION DOSSIER & QUICK ACTIONS (#appDetailModal)
// ═══════════════════════════════════════════════════════════════════════════

async function viewApplicationDossier(id) {
    try {
        const res = await fetch(`/api/programs/applications/${id}`);
        if (!res.ok) throw new Error('Application not found');
        const a = await res.json();
        programsState.viewingAppId = id;

        _epSet('adName', a.applicant_name);
        _epSet('adAppNo', a.application_no || `APP-${a.id}`);
        _epSet('adProgramSub', `${a.program_title || 'Educational Program'}${a.batch_name ? ' • ' + a.batch_name : ''}`);

        const avatar = _epEl('adAvatar');
        if (avatar) avatar.textContent = (a.applicant_name || 'S').trim().charAt(0).toUpperCase();

        const badge = _epEl('adStatusBadge');
        if (badge) badge.innerHTML = statusBadge(a.status);

        const printBtn = _epEl('adPrintSlipBtn');
        if (printBtn) printBtn.onclick = () => printAdmissionSlip(id);

        const editBtn = _epEl('adEditBtn');
        if (editBtn) editBtn.onclick = () => { closeModal('appDetailModal'); openEditAppModal(id); };

        // Parse custom data if any
        let customHtml = '';
        if (a.custom_data) {
            try {
                const cObj = typeof a.custom_data === 'string' ? JSON.parse(a.custom_data) : a.custom_data;
                const entries = Object.entries(cObj);
                if (entries.length) {
                    customHtml = `
                    <div class="ep-section" style="margin-top:0.85rem;">
                        <h4 style="font-size:0.84rem; font-weight:800; margin:0 0 0.5rem; color:var(--text-main);">Custom Questionnaire Answers</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; font-size:0.8rem;">
                            ${entries.map(([k, v]) => `<div><span style="color:var(--text-muted);">${_epEsc(k)}:</span> <strong>${_epEsc(String(v))}</strong></div>`).join('')}
                        </div>
                    </div>`;
                }
            } catch (_) {}
        }

        const body = _epEl('adBodyContent');
        if (body) {
            body.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem;">
                    <!-- Personal info -->
                    <div class="ep-section">
                        <h4 style="font-size:0.84rem; font-weight:800; margin:0 0 0.65rem; color:var(--text-main);">Personal &amp; Demographics</h4>
                        <div style="display:grid; gap:0.4rem; font-size:0.8rem;">
                            <div><span style="color:var(--text-muted);">NIC / ID:</span> <strong>${_epEsc(a.nic_number || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Gender / Age:</span> <strong>${_epEsc(a.applicant_gender || '—')} • ${a.applicant_age ? a.applicant_age + ' yrs' : '—'}</strong></div>
                            <div><span style="color:var(--text-muted);">Date of Birth:</span> <strong>${_epFmtDate(a.applicant_dob)}</strong></div>
                            <div><span style="color:var(--text-muted);">Education:</span> <strong style="text-transform:capitalize;">${_epEsc(a.education_level || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Occupation:</span> <strong>${_epEsc(a.occupation || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Family Income:</span> <strong>${_epFmtMoney(a.monthly_family_income)} / month</strong></div>
                        </div>
                    </div>

                    <!-- Contact & Guardian -->
                    <div class="ep-section">
                        <h4 style="font-size:0.84rem; font-weight:800; margin:0 0 0.65rem; color:var(--text-main);">Contact &amp; Guardian Info</h4>
                        <div style="display:grid; gap:0.4rem; font-size:0.8rem;">
                            <div><span style="color:var(--text-muted);">Phone:</span> <strong>${_epEsc(a.applicant_phone || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">WhatsApp:</span> <strong>${_epEsc(a.whatsapp_number || a.applicant_phone || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Email:</span> <strong>${_epEsc(a.applicant_email || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Home Town:</span> <strong>${_epEsc(a.city || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Address:</span> <strong>${_epEsc(a.applicant_address || '—')}</strong></div>
                            <div><span style="color:var(--text-muted);">Parent/Guardian:</span> <strong>${_epEsc(a.guardian_name || '—')} (${_epEsc(a.guardian_phone || '—')})</strong></div>
                        </div>
                    </div>
                </div>

                <!-- Academic progress & fees -->
                <div class="ep-section" style="margin-top:0.85rem;">
                    <h4 style="font-size:0.84rem; font-weight:800; margin:0 0 0.65rem; color:var(--text-main);">Academic Progress, Sponsorship &amp; Certification</h4>
                    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.6rem; text-align:center; margin-bottom:0.75rem;">
                        <div class="rd-mini-chip" style="flex-direction:column; padding:0.45rem; border-radius:10px;">
                            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Attendance</span>
                            <b style="font-size:1.05rem; color:#10b981;">${a.attendance_pct || 0}%</b>
                        </div>
                        <div class="rd-mini-chip" style="flex-direction:column; padding:0.45rem; border-radius:10px;">
                            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Grade / Result</span>
                            <b style="font-size:0.9rem; text-transform:capitalize;">${_epEsc(a.grade_result || 'Pending')}</b>
                        </div>
                        <div class="rd-mini-chip" style="flex-direction:column; padding:0.45rem; border-radius:10px;">
                            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Fee Status</span>
                            <b style="font-size:0.82rem; color:#10b981; text-transform:capitalize;">${_epEsc(a.fee_status || 'Free')}</b>
                        </div>
                        <div class="rd-mini-chip" style="flex-direction:column; padding:0.45rem; border-radius:10px;">
                            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">Certificate</span>
                            <b style="font-size:0.82rem; color:${Number(a.certificate_issued) === 1 ? '#8b5cf6' : 'var(--text-muted)'};">${Number(a.certificate_issued) === 1 ? 'Issued' : 'Not Issued'}</b>
                        </div>
                    </div>
                    ${a.certificate_no ? `<div style="font-size:0.78rem; color:#8b5cf6;"><strong>Certificate Ref:</strong> <code style="font-family:monospace;">${_epEsc(a.certificate_no)}</code></div>` : ''}
                    ${a.motivation ? `<div style="font-size:0.8rem; margin-top:0.5rem; background:var(--input-bg); padding:0.55rem 0.75rem; border-radius:9px;"><strong>Motivation / Goals:</strong> ${_epEsc(a.motivation)}</div>` : ''}
                    ${a.notes ? `<div style="font-size:0.8rem; margin-top:0.4rem; background:var(--input-bg); padding:0.55rem 0.75rem; border-radius:9px;"><strong>Admin Remarks:</strong> ${_epEsc(a.notes)}</div>` : ''}
                </div>

                ${customHtml}`;
        }

        // Quick footer action buttons
        const foot = _epEl('adFooterActions');
        if (foot) {
            foot.innerHTML = `
                <div style="font-size:0.75rem; color:var(--text-muted);">
                    Applied on ${_epFmtDate(a.applied_date)} ${a.reviewed_by ? '• Reviewed by ' + _epEsc(a.reviewed_by) : ''}
                </div>
                <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                    <button type="button" class="prog-btn prog-btn-success" onclick="changeAppStatus(${a.id}, 'approved', ${a.course_id}); closeModal('appDetailModal');"><i data-lucide="check"></i> Approve</button>
                    <button type="button" class="prog-btn prog-btn-primary" onclick="changeAppStatus(${a.id}, 'enrolled', ${a.course_id}); closeModal('appDetailModal');"><i data-lucide="user-check"></i> Enroll</button>
                    <button type="button" class="prog-btn prog-btn-ghost" onclick="changeAppStatus(${a.id}, 'completed', ${a.course_id}); closeModal('appDetailModal');" style="color:#8b5cf6;"><i data-lucide="award"></i> Graduate</button>
                    <button type="button" class="prog-btn prog-btn-danger" onclick="changeAppStatus(${a.id}, 'rejected', ${a.course_id}); closeModal('appDetailModal');"><i data-lucide="x"></i> Reject</button>
                </div>`;
        }

        openModal('appDetailModal');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        toast('Failed to load student dossier', 'error');
    }
}

async function changeAppStatus(appId, status, courseId) {
    try {
        const res = await fetch(`/api/programs/applications/${appId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const r = await res.json();
        if (res.ok) {
            toast(`Application marked as ${status}`);
            await fetchAllApplications();
            await fetchPrograms();
            if (programsState.viewingProgramId) {
                viewProgram(programsState.viewingProgramId);
            }
        } else {
            toast(r.message || 'Status update failed', 'error');
        }
    } catch (e) { toast('Network error updating status', 'error'); }
}

async function quickApproveApp(appId, courseId) {
    changeAppStatus(appId, 'approved', courseId);
}

async function deleteApplication(appId, courseId) {
    if (!confirm('Permanently delete this student application? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/programs/applications/${appId}`, { method: 'DELETE' });
        const r = await res.json();
        if (res.ok) {
            toast('Application deleted', 'success');
            programsState.selectedApps.delete(appId);
            await fetchAllApplications();
            await fetchPrograms();
            if (programsState.viewingProgramId) {
                viewProgram(programsState.viewingProgramId);
            }
        } else {
            toast(r.message || 'Failed to delete application', 'error');
        }
    } catch (e) { toast('Network error while deleting', 'error'); }
}

function printAdmissionSlip(appId) {
    const a = (programsState.applications || []).find(x => x.id === appId);
    if (!a) { toast('Application data not loaded', 'error'); return; }

    const printWin = window.open('', '_blank', 'width=800,height=650');
    if (!printWin) { toast('Please allow pop-ups to print slip', 'error'); return; }

    const appNo = a.application_no || `APP-${new Date().getFullYear()}-${String(a.id).padStart(4, '0')}`;

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admission Card — ${appNo}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; color: #111; }
                .slip { border: 2px solid #000; border-radius: 12px; padding: 1.5rem; max-width: 650px; margin: 0 auto; position: relative; }
                .hdr { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.25rem; }
                .logo-text { font-size: 1.25rem; font-weight: 800; letter-spacing: 0.5px; }
                .badge { padding: 4px 10px; border: 1px solid #000; border-radius: 99px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; font-size: 0.88rem; }
                .row { border-bottom: 1px dashed #ccc; padding-bottom: 0.4rem; }
                .label { font-size: 0.72rem; color: #666; font-weight: 600; text-transform: uppercase; }
                .val { font-weight: 700; margin-top: 2px; }
                .foot { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #000; display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.75rem; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div style="text-align:right; margin-bottom:1rem;">
                <button onclick="window.print()" style="padding:0.4rem 1.2rem; font-weight:700; cursor:pointer;">Print Admission Card</button>
            </div>
            <div class="slip">
                <div class="hdr">
                    <div>
                        <div class="logo-text">EDUCATION &amp; DEVELOPMENT FOUNDATION</div>
                        <div style="font-size:0.8rem; color:#555;">Student Admission &amp; Enrollment Card</div>
                    </div>
                    <div class="badge">${_epEsc(a.status)}</div>
                </div>

                <div class="grid">
                    <div class="row">
                        <div class="label">Application Reference #</div>
                        <div class="val" style="font-family:monospace; font-size:1.05rem; color:#000;">${_epEsc(appNo)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Date Registered</div>
                        <div class="val">${_epFmtDate(a.applied_date)}</div>
                    </div>
                    <div class="row" style="grid-column:span 2;">
                        <div class="label">Student Name</div>
                        <div class="val" style="font-size:1.1rem;">${_epEsc(a.applicant_name)}</div>
                    </div>
                    <div class="row">
                        <div class="label">Program Enrolled</div>
                        <div class="val">${_epEsc(a.program_title || 'Educational Course')}</div>
                    </div>
                    <div class="row">
                        <div class="label">Assigned Cohort Batch</div>
                        <div class="val">${_epEsc(a.batch_name || 'General Batch')}</div>
                    </div>
                    <div class="row">
                        <div class="label">Contact Number</div>
                        <div class="val">${_epEsc(a.applicant_phone || '—')}</div>
                    </div>
                    <div class="row">
                        <div class="label">NIC / Student ID</div>
                        <div class="val">${_epEsc(a.nic_number || '—')}</div>
                    </div>
                    <div class="row">
                        <div class="label">Tuition / Sponsorship</div>
                        <div class="val">${a.fee_status === 'scholarship' ? '100% Zakat Scholarship' : (a.fee_status === 'free' ? 'Free / Sponsored' : _epFmtMoney(a.fee_paid))}</div>
                    </div>
                    <div class="row">
                        <div class="label">Residential Area</div>
                        <div class="val">${_epEsc(a.city || a.applicant_address || 'Galgamuwa')}</div>
                    </div>
                </div>

                <div class="foot">
                    <div>
                        <div>Authorized By: _____________________</div>
                        <div style="color:#777; margin-top:3px;">EDF Academic Coordinator</div>
                    </div>
                    <div style="text-align:right;">
                        <div>Student Signature: _____________________</div>
                        <div style="color:#777; margin-top:3px;">Please carry this card to all class sessions</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
//   PART 9 — NAVIGATION, EXPORTS & INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

function showProgramsView(view) {
    programsState.currentView = view;

    document.querySelectorAll('.programs-view').forEach(v => v.style.display = 'none');
    const target = _epEl('pv-' + view);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#coursesTab .pv-tab').forEach(t => {
        t.classList.toggle('pv-tab-active', t.dataset.view === view);
    });

    const switcher = _epEl('epViewSwitcherWrap');
    if (switcher) switcher.style.display = view === 'programs' ? 'inline-flex' : 'none';

    if (view === 'programs') {
        renderProgramView();
    } else if (view === 'batches') {
        fetchBatches();
    } else if (view === 'applications') {
        fetchAllApplications();
    }
}

function exportCurrentProgramView(format = 'csv') {
    if (programsState.currentView === 'applications') {
        exportApplicationsToCSV(format);
    } else if (programsState.currentView === 'batches') {
        const rows = (programsState.batches || []).map(b => ({
            'Batch Name': b.batch_name,
            'Batch Code': b.batch_code || '',
            'Program': b.program_title || '',
            'Instructor': b.instructor_name || '',
            'Instructor Phone': b.instructor_phone || '',
            'Start Date': b.start_date || '',
            'End Date': b.end_date || '',
            'Schedule Days': b.schedule_days || '',
            'Schedule Time': b.schedule_time || '',
            'Venue': b.location || '',
            'Max Seats': b.max_seats || 30,
            'Enrolled Students': b.enrolled_count || 0,
            'Status': b.status
        }));
        _epExportData(rows, `EDF_Batches_${new Date().toISOString().slice(0, 10)}`, format, 'Batches');
    } else {
        const list = getFilteredPrograms();
        const rows = list.map(p => ({
            'Program Title': p.title,
            'Code': p.program_code || '',
            'Category': (CATEGORIES[p.category] || CATEGORIES.other).label,
            'Target Audience': (AUDIENCES[p.target_audience] || AUDIENCES.all).label,
            'Delivery Mode': p.delivery_mode || 'in_person',
            'Duration': `${p.duration_weeks || 8} ${p.duration_type || 'weeks'}`,
            'Course Fee (LKR)': p.fee || 0,
            'Capacity': p.max_capacity || 30,
            'Enrolled Students': p.enrolled_count || 0,
            'Total Batches': p.batch_count || 0,
            'Total Applicants': p.applicant_count || 0,
            'Venue': p.location || '',
            'Coordinator': p.coordinator_name || '',
            'Phone': p.coordinator_phone || '',
            'Certification': p.certification || '',
            'Status': p.status
        }));
        _epExportData(rows, `EDF_Programs_${new Date().toISOString().slice(0, 10)}`, format, 'Programs');
    }
}

function exportApplicationsToCSV(format = 'csv') {
    const list = getFilteredApplications();
    if (!list.length) { toast('No applications to export', 'error'); return; }

    const rows = list.map(a => ({
        'App Ref': a.application_no || `APP-${a.id}`,
        'Student Name': a.applicant_name,
        'Phone': a.applicant_phone || '',
        'WhatsApp': a.whatsapp_number || '',
        'Email': a.applicant_email || '',
        'NIC': a.nic_number || '',
        'Gender': a.applicant_gender || '',
        'Age': a.applicant_age || '',
        'DOB': a.applicant_dob || '',
        'Address': a.applicant_address || '',
        'Town': a.city || '',
        'Program': a.program_title || '',
        'Batch': a.batch_name || '',
        'Education Level': a.education_level || '',
        'Current Occupation': a.occupation || '',
        'Family Income': a.monthly_family_income || 0,
        'Guardian Name': a.guardian_name || '',
        'Guardian Phone': a.guardian_phone || '',
        'Emergency Contact': a.emergency_contact || '',
        'Fee Status': a.fee_status || '',
        'Fee Paid': a.fee_paid || 0,
        'Attendance %': a.attendance_pct || 0,
        'Grade Result': a.grade_result || '',
        'Certificate Issued': Number(a.certificate_issued) === 1 ? 'Yes' : 'No',
        'Certificate No': a.certificate_no || '',
        'Status': a.status,
        'Applied Date': a.applied_date ? String(a.applied_date).split('T')[0] : '',
        'Notes': a.notes || ''
    }));

    _epExportData(rows, `EDF_Student_Applications_${new Date().toISOString().slice(0, 10)}`, format, 'Applications');
}

function openAppCustomizerTab() {
    if (typeof showTab === 'function') {
        showTab('customizer');
    } else {
        const link = document.querySelector('[data-tab="customizer"]');
        if (link) link.click();
    }
}

// ── DOM Initialization ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // If programs tab is active on page load
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'coursesTab') {
        fetchPrograms();
    }
});

"""
Patch dashboard.html with the full Programs tab + modals.
Run: python tools/patch_programs.py
"""
import re, sys

FILE = r'd:\Freelance\EDF\public\dashboard.html'

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('\r\n', '\n')  # normalise line endings

changed = []

# ══════════════════ 1. Add programs.js ══════════════════
if 'programs.js' not in html:
    html = html.replace(
        '<script src="js/dashboard.js"></script>',
        '<script src="js/dashboard.js"></script>\n    <script src="js/programs.js"></script>'
    )
    changed.append('scripts')

# ══════════════════ 2. Replace courses tab ══════════════════
COURSES_START = '                <!-- TAB: COURSES -->'
COURSES_END   = '                </div>\n\n                <!-- TAB: DONATIONS -->'

if COURSES_START in html and COURSES_END in html:
    start_idx = html.index(COURSES_START)
    end_idx   = html.index('<!-- TAB: DONATIONS -->')
    
    NEW_TAB = '''                <!-- TAB: COURSES / PROGRAMS -->
                <div id="coursesTab" class="tab-content">
                    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
                        <div>
                            <h2 style="font-size:1.5rem;font-weight:700;color:var(--text-main);">Educational Programs</h2>
                            <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.2rem;">Manage programs, batches and participant applications.</p>
                        </div>
                        <div style="display:flex;gap:0.625rem;">
                            <button class="btn btn-outline" onclick="openNewAppModal(null)" style="font-size:0.85rem;">
                                <i data-lucide="file-plus"></i> New Application
                            </button>
                            <button class="btn btn-primary" onclick="openCreateProgramModal()" style="font-size:0.85rem;">
                                <i data-lucide="plus"></i> New Program
                            </button>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:1.5rem;">
                        <div class="prog-stat-card"><div class="psc-val" id="ps-total">—</div><div class="psc-lbl">Total</div></div>
                        <div class="prog-stat-card"><div class="psc-val" id="ps-active" style="color:#10b981">—</div><div class="psc-lbl">Active</div></div>
                        <div class="prog-stat-card"><div class="psc-val" id="ps-batches">—</div><div class="psc-lbl">Batches</div></div>
                        <div class="prog-stat-card"><div class="psc-val" id="ps-applicants">—</div><div class="psc-lbl">Applicants</div></div>
                        <div class="prog-stat-card"><div class="psc-val" id="ps-pending" style="color:#f59e0b">—</div><div class="psc-lbl">Pending</div></div>
                        <div class="prog-stat-card"><div class="psc-val" id="ps-approved" style="color:#10b981">—</div><div class="psc-lbl">Approved</div></div>
                    </div>

                    <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;border-bottom:1px solid var(--border-color);">
                        <button class="pv-tab pv-tab-active" data-view="programs" onclick="showProgramsView('programs')">Programs</button>
                        <button class="pv-tab" data-view="applications" onclick="showProgramsView('applications')">All Applications</button>
                    </div>

                    <div class="programs-view" id="pv-programs">
                        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:center;">
                            <div class="search-wrapper" style="flex:1;min-width:200px;">
                                <i data-lucide="search" class="search-icon"></i>
                                <input type="text" class="search-input" style="width:100%;" placeholder="Search programs..." oninput="setProgramSearch(this.value)">
                            </div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap;">
                                <button class="filter-pill filter-active" data-filter="category" data-value="all" onclick="setProgramFilter('category','all')">All</button>
                                <button class="filter-pill" data-filter="category" data-value="quran" onclick="setProgramFilter('category','quran')">Quran</button>
                                <button class="filter-pill" data-filter="category" data-value="skills" onclick="setProgramFilter('category','skills')">Skills</button>
                                <button class="filter-pill" data-filter="category" data-value="bayan" onclick="setProgramFilter('category','bayan')">Bayan</button>
                                <button class="filter-pill" data-filter="category" data-value="tech" onclick="setProgramFilter('category','tech')">Tech</button>
                                <button class="filter-pill" data-filter="category" data-value="health" onclick="setProgramFilter('category','health')">Health</button>
                                <button class="filter-pill" data-filter="category" data-value="other" onclick="setProgramFilter('category','other')">Other</button>
                            </div>
                            <select class="form-select" style="width:auto;padding:0.45rem 1rem;border-radius:50px;font-size:0.8rem;" onchange="setProgramFilter('audience',this.value)">
                                <option value="all">All Audiences</option>
                                <option value="men">Men</option>
                                <option value="women">Women</option>
                                <option value="children">Children</option>
                            </select>
                            <select class="form-select" style="width:auto;padding:0.45rem 1rem;border-radius:50px;font-size:0.8rem;" onchange="setProgramFilter('status',this.value)">
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div id="programsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem;"></div>
                    </div>

                    <div class="programs-view" id="pv-applications" style="display:none;">
                        <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
                            <button class="btn btn-primary" onclick="openNewAppModal(null)" style="font-size:0.85rem;">
                                <i data-lucide="user-plus"></i> Add Application
                            </button>
                        </div>
                        <div class="card">
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr><th>Applicant</th><th>Phone</th><th>Program</th><th>Batch</th><th>Applied</th><th>Status</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody id="allAppsBody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TAB: DONATIONS -->
'''
    html = html[:start_idx] + NEW_TAB + html[end_idx + len('<!-- TAB: DONATIONS -->'):]
    changed.append('courses tab')
    print('Courses tab replaced successfully')
else:
    print(f'WARNING: Could not find courses tab markers in file')
    print(f'  COURSES_START found: {COURSES_START in html}')
    print(f'  COURSES_END found: {"<!-- TAB: DONATIONS -->" in html}')

# ══════════════════ 3. Add programs CSS ══════════════════
PROG_CSS = '''
    <style id="programs-css">
    /* Programs Module Styles */
    .program-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 1.25rem;
        transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    }
    .program-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
        border-color: var(--text-muted);
    }
    .prog-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.4rem 0.75rem;
        border-radius: 10px;
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-main);
        font-family: inherit;
        transition: background 0.15s ease, border-color 0.15s ease;
    }
    .prog-btn-ghost { background: var(--input-bg); }
    .prog-btn-ghost:hover { background: var(--border-color); }
    .prog-btn-danger { background: rgba(239,68,68,0.08); color: #ef4444; border-color: rgba(239,68,68,0.2); }
    .prog-btn-danger:hover { background: rgba(239,68,68,0.15); }
    .prog-stat-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        padding: 1rem 1.25rem;
    }
    .psc-val { font-size: 1.6rem; font-weight: 700; color: var(--text-main); }
    .psc-lbl { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.1rem; }
    .filter-pill {
        padding: 0.35rem 0.875rem;
        border-radius: 50px;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-muted);
        font-size: 0.78rem;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .filter-pill:hover { background: var(--input-bg); color: var(--text-main); }
    .filter-active { background: var(--text-main) !important; color: var(--bg-main) !important; border-color: var(--text-main) !important; }
    .pv-tab {
        padding: 0.625rem 1.125rem;
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        font-family: inherit;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color 0.15s ease, border-color 0.15s ease;
    }
    .pv-tab:hover { color: var(--text-main); }
    .pv-tab-active { color: var(--text-main) !important; border-bottom-color: var(--text-main) !important; font-weight: 600 !important; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    </style>
'''

if 'programs-css' not in html:
    html = html.replace('</head>', PROG_CSS + '</head>')
    changed.append('css')

# ══════════════════ 4. Add modals ══════════════════
MODALS = '''
    <!-- ══════════════════ PROGRAMS MODALS ══════════════════ -->

    <!-- Program Detail Modal -->
    <div id="programDetailModal" class="modal">
        <div class="modal-content" style="max-width:900px;">
            <div class="modal-header">
                <div>
                    <h3 id="pdTitle" style="font-size:1.2rem;margin-bottom:0.375rem;">Program</h3>
                    <div id="pdMeta" style="display:flex;gap:0.4rem;flex-wrap:wrap;"></div>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <button class="btn btn-primary" style="font-size:0.8rem;" onclick="openNewAppModal(programsState.viewingProgramId)">
                        <i data-lucide="user-plus"></i> Apply
                    </button>
                    <button class="btn btn-outline" style="font-size:0.8rem;" onclick="openAddBatchModal(programsState.viewingProgramId)">
                        <i data-lucide="plus"></i> Batch
                    </button>
                    <button class="btn-close" onclick="closeModal('programDetailModal')"><i data-lucide="x" style="width:18px;"></i></button>
                </div>
            </div>
            <div class="modal-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.75rem;margin-bottom:1.25rem;">
                    <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value" id="pdLocation">—</div></div>
                    <div class="detail-item"><div class="detail-label">Duration</div><div class="detail-value" id="pdDuration">—</div></div>
                    <div class="detail-item"><div class="detail-label">Fee</div><div class="detail-value" id="pdFee">—</div></div>
                    <div class="detail-item"><div class="detail-label">Capacity</div><div class="detail-value" id="pdCapacity">—</div></div>
                </div>
                <p id="pdDescription" style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;line-height:1.6;"></p>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <h4 style="font-size:0.95rem;font-weight:700;">Batches</h4>
                    <button class="prog-btn prog-btn-ghost" style="font-size:0.78rem;" onclick="openAddBatchModal(programsState.viewingProgramId)">
                        <i data-lucide="plus"></i> Add Batch
                    </button>
                </div>
                <div class="table-container" style="margin-bottom:1.75rem;">
                    <table>
                        <thead><tr><th>Batch</th><th>Instructor</th><th>Start</th><th>End</th><th>Seats</th><th>Status</th><th></th></tr></thead>
                        <tbody id="pdBatchesBody"></tbody>
                    </table>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <h4 style="font-size:0.95rem;font-weight:700;">Applications</h4>
                    <button class="prog-btn prog-btn-ghost" style="font-size:0.78rem;" onclick="openNewAppModal(programsState.viewingProgramId)">
                        <i data-lucide="user-plus"></i> New Application
                    </button>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Name</th><th>Phone</th><th>Gender</th><th>Batch</th><th>Education</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="pdAppsBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Create / Edit Program Modal -->
    <div id="programModal" class="modal">
        <div class="modal-content" style="max-width:640px;">
            <div class="modal-header">
                <h3 id="programModalTitle">Create Program</h3>
                <button class="btn-close" onclick="closeModal('programModal')"><i data-lucide="x" style="width:18px;"></i></button>
            </div>
            <div class="modal-body">
                <form id="programForm">
                    <div class="form-grid">
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Program Title *</label>
                            <input type="text" name="title" class="form-input" placeholder="e.g. Quran Recitation Course" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select name="category" class="form-select">
                                <option value="quran">Quran Studies</option>
                                <option value="skills">Vocational Skills</option>
                                <option value="bayan">Islamic Lectures</option>
                                <option value="tech">Technology</option>
                                <option value="health">Health &amp; Wellness</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Target Audience</label>
                            <select name="target_audience" class="form-select">
                                <option value="all">All</option>
                                <option value="men">Men</option>
                                <option value="women">Women</option>
                                <option value="children">Children</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select name="status" class="form-select">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Capacity</label>
                            <input type="number" name="max_capacity" class="form-input" placeholder="30" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duration (weeks)</label>
                            <input type="number" name="duration_weeks" class="form-input" placeholder="8" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Fee (LKR) — 0 for free</label>
                            <input type="number" name="fee" class="form-input" placeholder="0" min="0">
                        </div>
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Location / Venue</label>
                            <input type="text" name="location" class="form-input" placeholder="e.g. Main Hall, Mosque">
                        </div>
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Description</label>
                            <textarea name="description" class="form-input" rows="3" style="border-radius:16px;resize:vertical;" placeholder="Brief description..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal('programModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save Program</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Batch Modal -->
    <div id="batchModal" class="modal">
        <div class="modal-content" style="max-width:560px;">
            <div class="modal-header">
                <h3 id="batchModalTitle">Add Batch</h3>
                <button class="btn-close" onclick="closeModal('batchModal')"><i data-lucide="x" style="width:18px;"></i></button>
            </div>
            <div class="modal-body">
                <form id="batchForm">
                    <div class="form-grid">
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Batch Name *</label>
                            <input type="text" name="batch_name" class="form-input" placeholder="e.g. Batch 2026-A" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Start Date</label>
                            <input type="date" name="start_date" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">End Date</label>
                            <input type="date" name="end_date" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Instructor</label>
                            <input type="text" name="instructor_name" class="form-input" placeholder="Name">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Seats</label>
                            <input type="number" name="max_seats" class="form-input" placeholder="30">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select name="status" class="form-select">
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Location</label>
                            <input type="text" name="location" class="form-input" placeholder="Venue">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal('batchModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save Batch</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Application Modal -->
    <div id="appModal" class="modal">
        <div class="modal-content" style="max-width:680px;">
            <div class="modal-header">
                <h3 id="appModalTitle">New Application</h3>
                <button class="btn-close" onclick="closeModal('appModal')"><i data-lucide="x" style="width:18px;"></i></button>
            </div>
            <div class="modal-body">
                <form id="appForm">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Program *</label>
                            <select id="appProgramSelect" class="form-select" required>
                                <option value="">Select Program</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Batch</label>
                            <select id="appBatchSelect" class="form-select" name="batch_id">
                                <option value="">— No specific batch —</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Applicant Name *</label>
                            <input type="text" name="applicant_name" class="form-input" placeholder="Full Name" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phone</label>
                            <input type="text" name="applicant_phone" class="form-input" placeholder="07X XXXXXXX">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" name="applicant_email" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Age</label>
                            <input type="number" name="applicant_age" class="form-input" placeholder="Age" min="5">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gender</label>
                            <select name="applicant_gender" class="form-select">
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">NIC Number</label>
                            <input type="text" name="nic_number" class="form-input" placeholder="NIC">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Education Level</label>
                            <select name="education_level" class="form-select">
                                <option value="">Select</option>
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                                <option value="al">A/L</option>
                                <option value="diploma">Diploma</option>
                                <option value="degree">Degree</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select name="status" class="form-select">
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="enrolled">Enrolled</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Address</label>
                            <input type="text" name="applicant_address" class="form-input" placeholder="Residential address">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Guardian Name</label>
                            <input type="text" name="guardian_name" class="form-input" placeholder="Parent / Guardian">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Guardian Phone</label>
                            <input type="text" name="guardian_phone" class="form-input">
                        </div>
                        <div class="form-group" style="grid-column:span 2;">
                            <label class="form-label">Notes</label>
                            <textarea name="notes" class="form-input" rows="2" style="border-radius:16px;resize:vertical;"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal('appModal')">Cancel</button>
                        <button type="submit" class="btn btn-primary"><i data-lucide="send"></i> Submit Application</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
'''

if 'programDetailModal' not in html:
    html = html.replace('    <!-- MODALS -->', MODALS + '\n    <!-- MODALS -->')
    changed.append('modals')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)

print('Done. Changed:', ', '.join(changed) if changed else 'nothing new')

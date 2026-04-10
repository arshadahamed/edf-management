const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const htmlPath = path.join(__dirname, '..', 'public', 'dashboard.html');

let html = fs.readFileSync(htmlPath, 'utf8');

// The new redesigned modal structure
const newModal = `    <div id="beneficiaryModal" class="modal">
        <div class="modal-content large-xl beneficiary-modern-modal">
            <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 2rem;">
                <div>
                    <h3 style="font-size: 1.5rem; font-weight: 600;"><i data-lucide="heart-handshake" style="color: var(--primary); margin-right: 12px;"></i> <span id="beneficiaryModalTitle">Beneficiary Profile</span></h3>
                    <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 4px;">Complete the registration parameters for humanitarian assistance tracking.</p>
                </div>
                <button class="btn-close" onclick="closeModal('beneficiaryModal')" style="width: 40px; height: 40px;">
                    <i data-lucide="x" style="width: 24px;"></i>
                </button>
            </div>
            
            <form id="beneficiaryForm" class="modern-split-form">
                <input type="hidden" name="id">

                <!-- Left Sidebar Navigation -->
                <div class="stepper-vertical">
                    <div class="stepper-item active" data-modal-tab="ben-male">
                        <div class="step-icon"><i data-lucide="user"></i></div>
                        <div class="step-content">
                            <span class="step-title">Primary Leader</span>
                            <span class="step-desc">Male applicant details</span>
                        </div>
                    </div>
                    <div class="stepper-item" data-modal-tab="ben-female">
                        <div class="step-icon"><i data-lucide="users"></i></div>
                        <div class="step-content">
                            <span class="step-title">Secondary Leader</span>
                            <span class="step-desc">Female applicant details</span>
                        </div>
                    </div>
                    <div class="stepper-item" data-modal-tab="ben-children">
                        <div class="step-icon"><i data-lucide="baby"></i></div>
                        <div class="step-content">
                            <span class="step-title">Dependents</span>
                            <span class="step-desc">Children & education</span>
                        </div>
                    </div>
                    <div class="stepper-item" data-modal-tab="ben-family">
                        <div class="step-icon"><i data-lucide="home"></i></div>
                        <div class="step-content">
                            <span class="step-title">Living standard</span>
                            <span class="step-desc">Housing & income</span>
                        </div>
                    </div>
                    <div class="stepper-item" data-modal-tab="ben-status">
                        <div class="step-icon"><i data-lucide="clipboard-check"></i></div>
                        <div class="step-content">
                            <span class="step-title">Assessment</span>
                            <span class="step-desc">Final evaluation specs</span>
                        </div>
                    </div>
                </div>

                <!-- Right Side Content Area -->
                <div class="beneficiary-modal-body custom-scroll">

                    <!-- MALE LEADER -->
                    <div class="modal-tab-content active" id="ben-male">
                        <h4 class="modern-section-title">Primary Information (Male Leader)</h4>
                        <div class="modern-form-grid">
                            <div class="form-group span-full">
                                <label class="modern-label">Application Number</label>
                                <div class="input-with-icon">
                                    <i data-lucide="hash"></i>
                                    <input type="text" name="application_number" class="form-input" placeholder="e.g. EDF-2024-001">
                                </div>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Full Name *</label>
                                <input type="text" name="male_head_name" class="form-input" placeholder="Enter full name" required>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">NIC Number</label>
                                <input type="text" name="nic_number" class="form-input" placeholder="National ID card">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Gender</label>
                                <select name="male_head_gender" class="form-select">
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Date of Birth</label>
                                <input type="date" name="male_head_dob" class="form-input">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Occupation</label>
                                <input type="text" name="male_head_occupation" class="form-input" placeholder="Current job">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Contact Number</label>
                                <div class="input-with-icon">
                                    <i data-lucide="phone"></i>
                                    <input type="text" name="contact_number" class="form-input" placeholder="+94 xxxxxxxxx">
                                </div>
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Residential Address</label>
                                <input type="text" name="male_head_address" class="form-input" placeholder="Complete Street Address">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">City/Town</label>
                                <input type="text" name="home_town" class="form-input" placeholder="Home Town">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Special Qualifications</label>
                                <input type="text" name="male_head_special_qualifications" class="form-input" placeholder="Other skills">
                            </div>
                        </div>
                    </div>

                    <!-- FEMALE LEADER -->
                    <div class="modal-tab-content" id="ben-female">
                        <h4 class="modern-section-title">Secondary Information (Female Leader)</h4>
                        <div class="modern-form-grid">
                            <div class="form-group span-half">
                                <label class="modern-label">Full Name</label>
                                <input type="text" name="female_head_name" class="form-input" placeholder="Enter full name">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">NIC Number</label>
                                <input type="text" name="female_head_nic" class="form-input" placeholder="National ID card">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Date of Birth</label>
                                <input type="date" name="female_head_dob" class="form-input">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Occupation</label>
                                <input type="text" name="female_head_occupation" class="form-input" placeholder="Current job">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Residential Address</label>
                                <input type="text" name="female_head_address" class="form-input" placeholder="Complete Street Address">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">City/Town</label>
                                <input type="text" name="female_head_home_town" class="form-input" placeholder="Home Town">
                            </div>
                        </div>
                    </div>

                    <!-- CHILDREN -->
                    <div class="modal-tab-content" id="ben-children">
                        <h4 class="modern-section-title">Children Overview</h4>
                        <div class="modern-form-grid" style="grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                            <div class="form-group">
                                <label class="modern-label">Male</label>
                                <input type="number" name="children_count_male" class="form-input" value="0">
                            </div>
                            <div class="form-group">
                                <label class="modern-label">Female</label>
                                <input type="number" name="children_count_female" class="form-input" value="0">
                            </div>
                            <div class="form-group">
                                <label class="modern-label">Total</label>
                                <input type="number" name="children_total_count" class="form-input" value="0">
                            </div>
                        </div>

                        <div class="modern-sub-section">
                            <div class="section-flex-header">
                                <h5><i data-lucide="book-open"></i> Education (Schooling)</h5>
                                <button type="button" class="btn btn-outline btn-sm" id="addStudyRowBtn"><i data-lucide="plus"></i> Add</button>
                            </div>
                            <div id="studyContainer" class="dynamic-entries-grid"></div>
                        </div>

                        <div class="modern-sub-section">
                            <div class="section-flex-header">
                                <h5><i data-lucide="user-minus"></i> School Dropouts</h5>
                                <button type="button" class="btn btn-outline btn-sm" id="addDropoutRowBtn"><i data-lucide="plus"></i> Add</button>
                            </div>
                            <div id="dropoutContainer" class="dynamic-entries-grid"></div>
                        </div>

                        <div class="modern-sub-section">
                            <div class="section-flex-header">
                                <h5><i data-lucide="graduation-cap"></i> University Selected</h5>
                                <button type="button" class="btn btn-outline btn-sm" id="addUniRowBtn"><i data-lucide="plus"></i> Add</button>
                            </div>
                            <div id="uniContainer" class="dynamic-entries-grid"></div>
                        </div>

                        <div class="modern-sub-section">
                            <div class="section-flex-header">
                                <h5><i data-lucide="plane"></i> Working Abroad</h5>
                                <button type="button" class="btn btn-outline btn-sm" id="addAbroadRowBtn"><i data-lucide="plus"></i> Add</button>
                            </div>
                            <div id="abroadContainer" class="dynamic-entries-grid"></div>
                        </div>
                    </div>

                    <!-- FAMILY & LIVING -->
                    <div class="modal-tab-content" id="ben-family">
                        <h4 class="modern-section-title">Living Conditions</h4>
                        <div class="modern-form-grid">
                            <div class="form-group span-half">
                                <label class="modern-label">Category Classification</label>
                                <select name="category" id="beneficiaryCategorySelect" class="form-select">
                                    <option value="">Select Category</option>
                                </select>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Monthly Income (LKR)</label>
                                <input type="number" name="monthly_income" class="form-input" placeholder="0.00">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Home Ownership</label>
                                <select name="living_home_details" class="form-select">
                                    <option value="own house">Own House</option>
                                    <option value="rent house">Rent House</option>
                                    <option value="joint Family">Joint Family</option>
                                </select>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Family Status</label>
                                <select name="family_status" class="form-select">
                                    <option value="">General</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="widow">Widow / Widower</option>
                                    <option value="sicker">Health Issues</option>
                                </select>
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Vehicles in Use</label>
                                <input type="text" name="vehicles_in_use" class="form-input" placeholder="e.g. Motor Cycle (WP-ABC-1234)">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Family Abroad Details</label>
                                <input type="text" name="abroad_details" class="form-input" placeholder="Who and where?">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">General Special Needs</label>
                                <input type="text" name="special_needs" class="form-input" placeholder="Any specific requirements">
                            </div>
                        </div>
                    </div>

                    <!-- STATUS & MISC -->
                    <div class="modal-tab-content" id="ben-status">
                        <h4 class="modern-section-title">Assessment Evaluation</h4>
                        
                        <div class="modern-form-grid">
                            <!-- Switches Map -->
                            <div class="modern-switch-card">
                                <div>
                                    <h5>Parents live with head?</h5>
                                    <p>Are elderly parents supported?</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="parents_live_with_head_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="parents_live_with_head" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Special Needs at Home?</h5>
                                    <p>Patients or disabilities</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="special_needs_at_home_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="special_needs_at_home" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Seeking Job?</h5>
                                    <p>Children searching for work</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_seeking_job_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_seeking_job" value="no">
                            </div>
                            <div class="form-group">
                                <input type="text" name="children_seeking_job_details" class="form-input" placeholder="Elaborate details if yes">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Marriageable Age?</h5>
                                    <p>Children pending marriage</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_marriageable_age_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_marriageable_age" value="no">
                            </div>
                            <div class="form-group">
                                <input type="text" name="children_marriageable_age_details" class="form-input" placeholder="Elaborate details if yes">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Drug Usage History?</h5>
                                    <p>Substance abuse in family</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_drugs_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_drugs" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Severe Family Problems?</h5>
                                    <p>Internal disputes</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="family_problems_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="family_problems" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Applied Before?</h5>
                                    <p>Previous EDF interactions</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="applied_before_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="applied_before" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div>
                                    <h5>Assistance Received?</h5>
                                    <p>Prior aid from any org</p>
                                </div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="received_assistance_before_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="received_assistance_before" value="no">
                            </div>
                        </div>

                        <div class="modern-form-grid" style="margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 2rem;">
                            <div class="form-group span-half">
                                <label class="modern-label">Assistance Details Needed</label>
                                <select name="assistance_details" class="form-select">
                                    <option value="">None</option>
                                    <option value="dry ration">Dry Ration</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Application Status</label>
                                <select name="status" class="form-select" style="font-weight: 600;">
                                    <option value="pending">Pending</option>
                                    <option value="Active">Active / Approved</option>
                                    <option value="deactivate">Deactivate / Hold</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer area fixed to the bottom -->
                <div class="modern-modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal('beneficiaryModal')">Discard Changes</button>
                    <button type="submit" class="btn btn-primary" style="padding: 14px 40px; font-weight: 600;">
                        <i data-lucide="check-circle"></i> Complete Registration
                    </button>
                </div>
            </form>
        </div>
    </div>`;

// Regex replacement
html = html.replace(/<div id="beneficiaryModal" class="modal">[\s\S]*?<!-- Beneficiary Category Management Modal -->/, newModal + '\n\n    <!-- Beneficiary Category Management Modal -->');
fs.writeFileSync(htmlPath, html);

// 2. Add custom CSS specifically for this new ultra-modern clear view modal layout
let css = fs.readFileSync(cssPath, 'utf8');

const modernModalCSS = `

/* --- MODERN CLEAR VIEW BENEFICIARY MODAL STYLES --- */
.beneficiary-modern-modal {
    max-width: 1100px !important;
    height: 90vh !important;
    max-height: 90vh !important;
    padding: 0;
}
.modern-split-form {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: calc(100% - 90px); /* header minus */
}
.stepper-vertical {
    width: 280px;
    background: var(--bg-card);
    border-right: 1px solid var(--border-color);
    padding: 2rem 0;
    overflow-y: auto;
}
.stepper-vertical .stepper-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 2rem;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: var(--transition);
    opacity: 0.6;
}
.stepper-vertical .stepper-item:hover {
    background: rgba(255, 255, 255, 0.02);
    opacity: 0.8;
}
.stepper-vertical .stepper-item.active {
    background: rgba(255, 255, 255, 0.04);
    border-left-color: var(--primary);
    opacity: 1;
}
.stepper-vertical .step-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--bg-main);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
}
.stepper-vertical .stepper-item.active .step-icon {
    background: var(--primary);
    color: var(--bg-main);
    border-color: var(--primary);
}
.stepper-vertical .step-content {
    display: flex;
    flex-direction: column;
}
.stepper-vertical .step-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-main);
}
.stepper-vertical .step-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.beneficiary-modal-body.custom-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 3rem 4rem;
    height: calc(100% - 80px); /* Leave room for absolute footer */
}
.modern-modal-footer {
    position: absolute;
    bottom: 0;
    left: 280px;
    right: 0;
    height: 80px;
    background: var(--modal-bg);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4rem;
    box-shadow: 0 -10px 30px rgba(0,0,0,0.1);
}

.modern-section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 2rem;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 10px;
}
.modern-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
}
.form-group.span-full {
    grid-column: span 2;
}
.form-group.span-half {
    grid-column: span 1;
}
.modern-label {
    display: block;
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.input-with-icon {
    position: relative;
}
.input-with-icon i {
    position: absolute;
    left: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    color: var(--text-muted);
    pointer-events: none;
}
.input-with-icon .form-input {
    padding-left: 3rem;
}

/* Modern Switch cards */
.modern-switch-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: var(--transition);
}
.modern-switch-card:hover {
    border-color: var(--primary);
}
.modern-switch-card h5 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 4px;
}
.modern-switch-card p {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
}
.modern-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
}
.modern-switch input { opacity: 0; width: 0; height: 0; }
.modern-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--bg-card); border: 1px solid var(--border-color);
    transition: .4s; border-radius: 24px;
}
.modern-slider:before {
    position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
    background-color: var(--text-muted); transition: .4s; border-radius: 50%;
}
.modern-switch input:checked + .modern-slider { background-color: var(--primary); border-color: var(--primary); }
.modern-switch input:checked + .modern-slider:before { transform: translateX(24px); background-color: var(--bg-main); }

/* Sub sections for children dynamic entries */
.modern-sub-section {
    background: var(--bg-card);
    border-radius: 20px;
    border: 1px solid var(--border-color);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}
.section-flex-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}
.section-flex-header h5 {
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    gap: 10px;
}
.dynamic-entries-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}
.dynamic-card {
    border-radius: 12px !important;
    padding: 1rem !important;
}

@media (max-width: 768px) {
    .modern-split-form {
        flex-direction: column;
        overflow-y: auto;
    }
    .stepper-vertical {
        width: 100%;
        display: flex;
        overflow-x: auto;
        padding: 1rem;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
    }
    .stepper-vertical .stepper-item {
        padding: 0.5rem 1rem;
        border-left: none;
        border-bottom: 2px solid transparent;
        flex-shrink: 0;
    }
    .stepper-vertical .stepper-item.active {
        border-bottom-color: var(--primary);
    }
    .stepper-vertical .step-content { display: none; }
    .beneficiary-modal-body.custom-scroll {
        padding: 1.5rem;
        overflow: visible;
    }
    .modern-modal-footer {
        position: relative;
        left: 0;
        padding: 0 1.5rem;
    }
    .modern-form-grid {
        grid-template-columns: 1fr;
    }
    .form-group.span-half {
        grid-column: span 1;
    }
}
`;

css += modernModalCSS;
fs.writeFileSync(cssPath, css);

console.log('Complete rewrite of the Beneficiary Modal for absolute UI/UX quality deployed natively.');

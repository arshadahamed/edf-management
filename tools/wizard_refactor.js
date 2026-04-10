const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const htmlPath = path.join(__dirname, '..', 'public', 'dashboard.html');

let html = fs.readFileSync(htmlPath, 'utf8');

// Extract the Beneficiary Modal part to rewrite it
const newModal = `    <div id="beneficiaryModal" class="modal">
        <div class="modal-content large-xl crm-wizard-modal">
            
            <form id="beneficiaryForm" class="crm-wizard-form">
                <input type="hidden" name="id">

                <!-- Header & Horizontal Stepper -->
                <div class="wizard-header-container">
                    <div class="wizard-header-top">
                        <div>
                            <h3 class="wizard-title"><i data-lucide="heart-handshake"></i> <span id="beneficiaryModalTitle">Beneficiary Profile</span></h3>
                            <p class="wizard-subtitle">Complete the registration parameters for humanitarian assistance tracking.</p>
                        </div>
                        <button type="button" class="btn-close" onclick="closeModal('beneficiaryModal')">
                            <i data-lucide="x"></i>
                        </button>
                    </div>

                    <div class="stepper-horizontal">
                        <div class="stepper-item active" data-step="1" data-modal-tab="ben-male">
                            <div class="step-circle"><i data-lucide="user"></i></div>
                            <div class="step-label">Primary</div>
                            <div class="step-line"></div>
                        </div>
                        <div class="stepper-item" data-step="2" data-modal-tab="ben-female">
                            <div class="step-circle"><i data-lucide="users"></i></div>
                            <div class="step-label">Secondary</div>
                            <div class="step-line"></div>
                        </div>
                        <div class="stepper-item" data-step="3" data-modal-tab="ben-children">
                            <div class="step-circle"><i data-lucide="baby"></i></div>
                            <div class="step-label">Dependents</div>
                            <div class="step-line"></div>
                        </div>
                        <div class="stepper-item" data-step="4" data-modal-tab="ben-family">
                            <div class="step-circle"><i data-lucide="home"></i></div>
                            <div class="step-label">Living</div>
                            <div class="step-line"></div>
                        </div>
                        <div class="stepper-item" data-step="5" data-modal-tab="ben-status">
                            <div class="step-circle"><i data-lucide="clipboard-check"></i></div>
                            <div class="step-label">Assessment</div>
                        </div>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="beneficiary-modal-body custom-scroll">
                    <!-- Step 1: MALE LEADER -->
                    <div class="modal-tab-content active" id="ben-male">
                        <h4 class="modern-section-title">Primary Information (Male Leader)</h4>
                        <div class="modern-form-grid">
                            <div class="form-group span-half">
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
                            <div class="form-group span-half">
                                <label class="modern-label">City/Town</label>
                                <input type="text" name="home_town" class="form-input" placeholder="Home Town">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Residential Address</label>
                                <input type="text" name="male_head_address" class="form-input" placeholder="Complete Street Address">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Special Qualifications</label>
                                <input type="text" name="male_head_special_qualifications" class="form-input" placeholder="Other skills">
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: FEMALE LEADER -->
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
                            <div class="form-group span-half">
                                <label class="modern-label">City/Town</label>
                                <input type="text" name="female_head_home_town" class="form-input" placeholder="Home Town">
                            </div>
                            <div class="form-group span-full">
                                <label class="modern-label">Residential Address</label>
                                <input type="text" name="female_head_address" class="form-input" placeholder="Complete Street Address">
                            </div>
                        </div>
                    </div>

                    <!-- Step 3: CHILDREN -->
                    <div class="modal-tab-content" id="ben-children">
                        <h4 class="modern-section-title">Children Overview</h4>
                        <div class="modern-form-grid" style="grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                            <div class="form-group span-half">
                                <label class="modern-label">Male</label>
                                <input type="number" name="children_count_male" class="form-input" value="0">
                            </div>
                            <div class="form-group span-half">
                                <label class="modern-label">Female</label>
                                <input type="number" name="children_count_female" class="form-input" value="0">
                            </div>
                            <div class="form-group span-half">
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

                    <!-- Step 4: FAMILY & LIVING -->
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

                    <!-- Step 5: STATUS & MISC -->
                    <div class="modal-tab-content" id="ben-status">
                        <h4 class="modern-section-title">Assessment Evaluation</h4>
                        
                        <div class="modern-form-grid">
                            <div class="modern-switch-card">
                                <div><h5>Parents live with head?</h5><p>Are elderly parents supported?</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="parents_live_with_head_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="parents_live_with_head" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Special Needs at Home?</h5><p>Patients or disabilities</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="special_needs_at_home_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="special_needs_at_home" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Seeking Job?</h5><p>Children searching for work</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_seeking_job_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_seeking_job" value="no">
                            </div>
                            <div class="form-group span-half">
                                <input type="text" name="children_seeking_job_details" class="form-input" placeholder="Elaborate details if yes">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Marriageable Age?</h5><p>Children pending marriage</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_marriageable_age_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_marriageable_age" value="no">
                            </div>
                            <div class="form-group span-half">
                                <input type="text" name="children_marriageable_age_details" class="form-input" placeholder="Elaborate details if yes">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Drug Usage History?</h5><p>Substance abuse in family</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="children_drugs_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="children_drugs" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Severe Family Problems?</h5><p>Internal disputes</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="family_problems_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="family_problems" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Applied Before?</h5><p>Previous EDF interactions</p></div>
                                <label class="modern-switch">
                                    <input type="checkbox" name="applied_before_toggle">
                                    <span class="modern-slider"></span>
                                </label>
                                <input type="hidden" name="applied_before" value="no">
                            </div>

                            <div class="modern-switch-card">
                                <div><h5>Assistance Received?</h5><p>Prior aid from any org</p></div>
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

                <!-- Footer area fixed to the bottom (Wizard controls) -->
                <div class="modern-modal-footer">
                    <button type="button" class="btn btn-outline btn-wizard-prev" style="display: none; padding: 12px 24px;">
                        <i data-lucide="chevron-left"></i> Previous Step
                    </button>
                    <div class="spacer" style="flex: 1;"></div>
                    <button type="button" class="btn btn-primary btn-wizard-next" style="padding: 12px 32px; font-weight: 600;">
                        Next Step <i data-lucide="chevron-right"></i>
                    </button>
                    <button type="submit" class="btn btn-primary btn-wizard-submit" style="display: none; padding: 12px 32px; font-weight: 600; background: var(--success); border-color: var(--success); color: white;">
                        <i data-lucide="check-circle"></i> Complete Registration
                    </button>
                </div>
            </form>
        </div>
    </div>`;

// Regex replacement for Beneficiary Modal
html = html.replace(/<div id="beneficiaryModal" class="modal">[\s\S]*?<!-- Beneficiary Category Management Modal -->/, newModal + '\n\n    <!-- Beneficiary Category Management Modal -->');

// We need to inject the step-by-step wizard logic script at the end of body
const wizardLogic = `
<script>
    // Wizard Logic for Beneficiary Modal
    document.addEventListener('DOMContentLoaded', () => {
        const wizardModal = document.getElementById('beneficiaryModal');
        if(!wizardModal) return;

        let currentStep = 1;
        const totalSteps = 5;

        const tabs = wizardModal.querySelectorAll('.modal-tab-content');
        const steppers = wizardModal.querySelectorAll('.stepper-item');
        const nextBtn = wizardModal.querySelector('.btn-wizard-next');
        const prevBtn = wizardModal.querySelector('.btn-wizard-prev');
        const submitBtn = wizardModal.querySelector('.btn-wizard-submit');

        function updateWizardUI() {
            // Update steppers
            steppers.forEach((step, idx) => {
                const stepNum = parseInt(step.getAttribute('data-step'));
                if (stepNum < currentStep) {
                    step.className = 'stepper-item completed';
                } else if (stepNum === currentStep) {
                    step.className = 'stepper-item active';
                } else {
                    step.className = 'stepper-item';
                }
            });

            // Update content tabs
            tabs.forEach((tab, idx) => {
                if (idx + 1 === currentStep) {
                    tab.classList.add('active');
                    tab.style.display = 'block';
                } else {
                    tab.classList.remove('active');
                    tab.style.display = 'none';
                }
            });

            // Update Buttons
            if (currentStep === 1) {
                prevBtn.style.display = 'none';
            } else {
                prevBtn.style.display = 'inline-flex';
            }

            if (currentStep === totalSteps) {
                nextBtn.style.display = 'none';
                submitBtn.style.display = 'inline-flex';
            } else {
                nextBtn.style.display = 'inline-flex';
                submitBtn.style.display = 'none';
            }
            
            // Re-render lucide icons
            if(window.lucide) {
                window.lucide.createIcons();
            }
        }

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentStep < totalSteps) {
                currentStep++;
                updateWizardUI();
            }
        });

        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentStep > 1) {
                currentStep--;
                updateWizardUI();
            }
        });

        // Allow clicking on stepper items directly to navigate tabs
        steppers.forEach(step => {
            step.addEventListener('click', () => {
                const targetStep = parseInt(step.getAttribute('data-step'));
                currentStep = targetStep;
                updateWizardUI();
            });
        });

        // Reset wizard on open modal (Optional globally intercept logic, but good practice here)
        const ogOpenModal = window.openModal;
        if(typeof ogOpenModal === 'function') {
            window.openModal = function(id) {
                if (id === 'beneficiaryModal') {
                    currentStep = 1;
                    updateWizardUI();
                }
                ogOpenModal(id);
            }
        } else {
             window.openModal = function(id) {
                const targetNode = document.getElementById(id);
                if (targetNode) {
                    targetNode.style.display = "flex";
                     if (id === 'beneficiaryModal') {
                        currentStep = 1;
                        updateWizardUI();
                    }
                }
            }
        }
        
        // ensure default UI on load
        tabs.forEach(t => t.style.display = 'none');
        if(tabs[0]) tabs[0].style.display = 'block';
    });
</script>
`;

html = html.replace(/<\/body>/, wizardLogic + '\n</body>');
fs.writeFileSync(htmlPath, html);

// Update CSS
let css = fs.readFileSync(cssPath, 'utf8');

// Strip old "clear view modal overrides" & "modern split form" to inject new CRM Wizard styling.
const newCssRegex = /\/\* --- MODERN CLEAR VIEW BENEFICIARY MODAL STYLES --- \*\/[\s\S]*/;
css = css.replace(newCssRegex, '');

// Strip the immediate first iteration of overrides
const preOverrideRegex = /\/\* Clear View Beneficiary Modal Overrides \*\/[\s\S]*?\/\* --- MODERN/;
css = css.replace(preOverrideRegex, '/* --- MODERN');

if (css.includes('/* Clear View Beneficiary Modal Overrides */')) {
    css = css.split('/* Clear View Beneficiary Modal Overrides */')[0];
}

const crmStyles = `
/* --- CRM WIZARD UI FOR BENEFICIARY MODAL --- */
.crm-wizard-modal {
    max-width: 900px !important;
    height: auto !important;
    max-height: 90vh !important;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.crm-wizard-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden; /* Avoids unwanted parent scrolling */
}

/* Header & Horizontal Stepper Container */
.wizard-header-container {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

.wizard-header-top {
    padding: 2rem 2.5rem 1rem 2.5rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.wizard-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 12px;
}

.wizard-title i {
    color: var(--primary);
    width: 28px;
    height: 28px;
}

.wizard-subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 6px;
    line-height: 1.4;
}

.btn-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: var(--transition);
}

.btn-close:hover {
    background: var(--bg-main);
    border-color: var(--border-color);
    color: var(--text-main);
}

/* Horizontal Stepper */
.stepper-horizontal {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2.5rem 2rem 2.5rem;
}

.stepper-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    flex: 1;
    cursor: pointer;
}

.step-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--bg-main);
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-weight: 600;
    z-index: 2;
    transition: var(--transition);
}

.step-label {
    margin-top: 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: var(--transition);
}

.step-line {
    position: absolute;
    top: 24px;
    left: calc(50% + 30px);
    width: calc(100% - 60px);
    height: 2px;
    background: var(--border-color);
    z-index: 1;
    transition: var(--transition);
}

.stepper-item.active .step-circle {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--bg-main);
    box-shadow: 0 0 0 6px var(--glow-bg);
}

.stepper-item.active .step-label {
    color: var(--primary);
}

.stepper-item.completed .step-circle {
    background: var(--text-main);
    border-color: var(--text-main);
    color: var(--bg-main);
}

.stepper-item.completed .step-line {
    background: var(--text-main);
}

.stepper-item.completed .step-label {
    color: var(--text-main);
}


/* Content Area */
.beneficiary-modal-body.custom-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 2.5rem;
    background: var(--bg-main);
    /* Removes horizontal scroll by preventing content from artificially expanding */
    overflow-x: hidden; 
}

/* Modals inputs & grid */
.modern-section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 10px;
}

.modern-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    width: 100%;
}

.form-group.span-full { grid-column: span 2; }
.form-group.span-half { grid-column: span 1; }

.modern-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.input-with-icon { position: relative; }
.input-with-icon i {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    color: var(--text-muted);
    pointer-events: none;
}
.input-with-icon .form-input { padding-left: 2.75rem; }

/* Sub sections for children dynamic entries */
.modern-sub-section {
    background: var(--bg-card);
    border-radius: 16px;
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
    font-weight: 600;
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
    border-radius: 12px;
    padding: 1rem;
    background: var(--bg-main);
    border: 1px solid var(--border-color);
}

/* Switches */
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

.modern-switch-card:hover { border-color: var(--primary); }
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


/* Footer (Wizard Next/Back) */
.modern-modal-footer {
    background: var(--bg-card);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    padding: 1.25rem 2.5rem;
    flex-shrink: 0;
}

@media (max-width: 768px) {
    .modern-form-grid {
        grid-template-columns: 1fr;
    }
    .form-group.span-half {
        grid-column: span 1;
    }
    .step-label {
        display: none; /* Hide labels on mobile to save space */
    }
    .stepper-horizontal {
        padding: 1rem 1.5rem;
    }
    .step-circle {
        width: 36px;
        height: 36px;
    }
    .step-circle i {
        width: 16px;
        height: 16px;
    }
    .step-line {
        top: 18px;
        left: calc(50% + 20px);
        width: calc(100% - 40px);
    }
}
`;

css += crmStyles;
fs.writeFileSync(cssPath, css);

console.log("CRM Wizard Modal Update completely applied!");

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *   EDF GALGAMUWA — SMS Gateway (Text.lk & REST) & Beneficiary Messaging Client
 *   Full CRUD for API Gateways, Templates, Beneficiary Bulk/Individual SMS & Logs
 * ═══════════════════════════════════════════════════════════════════════════════
 */

let smsGateways = [];
let smsTemplates = [];
let smsRecipients = [];
let smsLogs = [];
let smsStats = {};

let smsSubTab = 'dispatch';
let smsComposeMode = 'individual';
let smsSelectedBenIds = new Set();
let smsSelectedLogIds = new Set();

const SMS_PROVIDER_PRESETS = {
    textlk:      { label: 'Text.lk API v3',  url: 'https://app.text.lk/api/v3/sms/send' },
    textlk_http: { label: 'Text.lk HTTP',    url: 'https://app.text.lk/api/http/sms/send' },
    notify_lk:   { label: 'Notify.lk',       url: 'https://app.notify.lk/api/v1/send' },
    custom_json: { label: 'Custom JSON API', url: '' }
};

// ── Shared Helpers ─────────────────────────────────────────────────────────────

function escSms(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function smsNotify(msg, type = 'success') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(msg, type);
    } else if (type === 'error') {
        console.error('[SMS]', msg);
    }
}

function smsFmtDateTime(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return escSms(val);
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calcClientSmsSegments(text = '') {
    const str = String(text || '');
    if (!str.length) return { chars: 0, segments: 0, encoding: 'GSM-7' };
    const isUnicode = /[^\u0000-\u007F]/.test(str);
    const single = isUnicode ? 70 : 160;
    const multi = isUnicode ? 67 : 153;
    const segments = str.length <= single ? 1 : Math.ceil(str.length / multi);
    return { chars: str.length, segments, encoding: isUnicode ? 'Unicode' : 'GSM-7' };
}

function resolveClientMergeTags(body, ben = null) {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const sample = ben || {
        display_name: 'Fathima Zeena',
        application_number: 'EDF-BEN-0142',
        home_town: 'Galgamuwa',
        category: 'General Welfare'
    };
    const reps = {
        '{name}': sample.display_name || sample.male_head_name || 'Beneficiary',
        '{app_no}': sample.application_number || 'EDF-BEN-0001',
        '{town}': sample.home_town || 'Galgamuwa',
        '{category}': sample.category || 'Welfare',
        '{date}': today
    };
    let out = String(body || '');
    for (const [k, v] of Object.entries(reps)) {
        out = out.split(k).join(v);
    }
    return out;
}

async function smsApi(url, options = {}) {
    const cfg = {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    };
    const res = await fetch(url, cfg);
    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        data = null;
    }
    if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
        const err = new Error(msg);
        err.payload = data;
        throw err;
    }
    return data;
}

function openSmsModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    el.style.display = 'flex';
    if (typeof window !== 'undefined' && typeof window.initEdfLottieIcons === 'function') {
        window.initEdfLottieIcons();
    }
}

function closeSmsModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open', 'active');
    el.style.display = 'none';
}

if (typeof document !== 'undefined' && !window._smsEscBound) {
    window._smsEscBound = true;
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        for (const id of ['smsLogDetailModal', 'smsTestModal', 'smsTemplateModal', 'smsGatewayModal']) {
            const el = document.getElementById(id);
            if (el && (el.classList.contains('open') || el.style.display === 'flex')) {
                closeSmsModal(id);
                break;
            }
        }
    });
}

// ── Workspace Hydration ───────────────────────────────────────────────────────

async function fetchSmsWorkspace() {
    try {
        const [statsRes, gwRes, tplRes, recRes, logsRes] = await Promise.allSettled([
            smsApi('/api/sms/stats'),
            smsApi('/api/sms/gateways'),
            smsApi('/api/sms/templates'),
            smsApi('/api/sms/recipients'),
            smsApi('/api/sms/logs')
        ]);

        smsStats = statsRes.status === 'fulfilled' && statsRes.value ? statsRes.value : {};
        smsGateways = gwRes.status === 'fulfilled' && Array.isArray(gwRes.value) ? gwRes.value : [];
        smsTemplates = tplRes.status === 'fulfilled' && Array.isArray(tplRes.value) ? tplRes.value : [];
        smsRecipients = recRes.status === 'fulfilled' && Array.isArray(recRes.value) ? recRes.value : [];
        smsLogs = logsRes.status === 'fulfilled' && Array.isArray(logsRes.value) ? logsRes.value : [];

        renderSmsTelemetry();
        populateSmsSelectors();
        renderSmsRecipientList();
        renderSmsGatewaysGrid();
        renderSmsTemplatesGrid();
        renderSmsLogsTable();
        updateSmsSelectionSummary();
        updateSmsComposerPreview();

        if (typeof window !== 'undefined' && typeof window.initEdfLottieIcons === 'function') {
            window.initEdfLottieIcons();
        }
    } catch (err) {
        console.error('SMS workspace fetch failed:', err);
        smsNotify('Could not load SMS Gateway workspace.', 'error');
    }
}

function renderSmsTelemetry() {
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const gwCount = smsGateways.length;
    const defGw = smsGateways.find((g) => g.is_default === 1) || smsGateways[0] || null;
    const reachableCount = smsRecipients.filter((r) => r.has_valid_phone).length;
    const failedCount = Number(smsStats.failed_count || 0);

    setTxt('smsKpiGateways', String(gwCount));
    setTxt('smsKpiDefaultGw', defGw ? `Default: ${defGw.name}` : 'No gateway configured');
    setTxt('smsKpiReachable', String(reachableCount));
    setTxt('smsKpiTotalBen', `Of ${smsRecipients.length} beneficiaries`);
    setTxt('smsKpiSent30', String(smsStats.sent_30d || 0));
    setTxt('smsKpiReminders', String(smsStats.reminders_count || 0));
    setTxt('smsKpiFailed', String(failedCount));

    setTxt('smsHeroGwName', defGw ? `${defGw.name} (${(SMS_PROVIDER_PRESETS[defGw.provider]?.label) || defGw.provider})` : 'Configure Text.lk / REST API');
    setTxt('smsMetaSender', defGw ? `Sender ID: ${defGw.sender_id}` : 'Sender ID: Not set');
    setTxt('smsMetaReachable', `${reachableCount} Reachable Phones`);

    setTxt('smsTabGwCount', String(gwCount));
    setTxt('smsTabTplCount', String(smsTemplates.length));
    setTxt('smsTabLogCount', String(smsLogs.length));

    const sbBadge = document.getElementById('sbSmsGatewayBadge');
    if (sbBadge) {
        sbBadge.textContent = defGw ? defGw.sender_id : 'SMS';
    }

    const failCard = document.getElementById('smsKpiFailedCard');
    if (failCard) failCard.classList.toggle('kpi-alert', failedCount > 0);
}

function populateSmsSelectors() {
    const gwSel = document.getElementById('smsDispatchGateway');
    if (gwSel) {
        const prev = gwSel.value;
        if (smsGateways.length === 0) {
            gwSel.innerHTML = '<option value="">No gateway configured — Add SMS API</option>';
        } else {
            gwSel.innerHTML = smsGateways.map((g) =>
                `<option value="${g.id}" ${g.is_default ? 'selected' : ''}>${escSms(g.name)} (${escSms(g.sender_id)}${g.is_default ? ' · Default' : ''})</option>`
            ).join('');
            if (prev && smsGateways.some((g) => String(g.id) === String(prev))) {
                gwSel.value = prev;
            }
        }
    }

    const tplSel = document.getElementById('smsTemplateSelect');
    if (tplSel) {
        const prev = tplSel.value;
        tplSel.innerHTML = '<option value="">— Write Custom Message —</option>' +
            smsTemplates.map((t) => `<option value="${t.id}">[${escSms(t.category)}] ${escSms(t.title)}</option>`).join('');
        if (prev) tplSel.value = prev;
    }

    const catSel = document.getElementById('smsBenCatFilter');
    if (catSel) {
        const prev = catSel.value || 'all';
        const cats = [...new Set(smsRecipients.map((r) => (r.category || '').trim()).filter(Boolean))].sort();
        catSel.innerHTML = '<option value="all">All Categories</option>' +
            cats.map((c) => `<option value="${escSms(c)}">${escSms(c)}</option>`).join('');
        if (cats.includes(prev)) catSel.value = prev;
    }

    const townSel = document.getElementById('smsBenTownFilter');
    if (townSel) {
        const prev = townSel.value || 'all';
        const towns = [...new Set(smsRecipients.map((r) => (r.home_town || '').trim()).filter(Boolean))].sort();
        townSel.innerHTML = '<option value="all">All Towns</option>' +
            towns.map((t) => `<option value="${escSms(t)}">${escSms(t)}</option>`).join('');
        if (towns.includes(prev)) townSel.value = prev;
    }
}

// ── Sub-Tab Navigation & Compose Mode ─────────────────────────────────────────

function setSmsSubTab(tab) {
    smsSubTab = ['dispatch', 'gateways', 'templates', 'logs'].includes(tab) ? tab : 'dispatch';
    document.querySelectorAll('#smsgatewayTab .sms-subnav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.smsTab === smsSubTab);
    });
    const panes = {
        dispatch: 'smsPaneDispatch',
        gateways: 'smsPaneGateways',
        templates: 'smsPaneTemplates',
        logs: 'smsPaneLogs'
    };
    Object.entries(panes).forEach(([key, elId]) => {
        const el = document.getElementById(elId);
        if (el) el.style.display = key === smsSubTab ? 'block' : 'none';
    });
}

function setSmsComposeMode(mode) {
    smsComposeMode = mode === 'bulk' ? 'bulk' : 'individual';
    document.getElementById('smsModeIndBtn')?.classList.toggle('active', smsComposeMode === 'individual');
    document.getElementById('smsModeBulkBtn')?.classList.toggle('active', smsComposeMode === 'bulk');

    const selAllBtn = document.getElementById('smsSelectAllValidBtn');
    if (selAllBtn) selAllBtn.style.display = smsComposeMode === 'bulk' ? 'inline-flex' : 'none';

    if (smsComposeMode === 'individual' && smsSelectedBenIds.size > 1) {
        const firstId = [...smsSelectedBenIds][0];
        smsSelectedBenIds = new Set([firstId]);
    }

    const pill = document.getElementById('smsSelectedModePill');
    if (pill) pill.textContent = smsComposeMode === 'bulk' ? 'Bulk Broadcast Mode' : 'Individual Mode';

    renderSmsRecipientList();
    updateSmsSelectionSummary();
}

// ── Beneficiary Recipient Picker ──────────────────────────────────────────────

function getFilteredSmsRecipients() {
    const q = (document.getElementById('smsBenSearch')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('smsBenCatFilter')?.value || 'all';
    const town = document.getElementById('smsBenTownFilter')?.value || 'all';

    return smsRecipients.filter((r) => {
        if (cat !== 'all' && r.category !== cat) return false;
        if (town !== 'all' && r.home_town !== town) return false;
        if (q) {
            const hay = [r.display_name, r.male_head_name, r.female_head_name, r.application_number, r.contact_number, r.home_town]
                .filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function renderSmsRecipientList() {
    const listEl = document.getElementById('smsRecipientList');
    const countEl = document.getElementById('smsDirectoryCount');
    if (!listEl) return;

    const rows = getFilteredSmsRecipients();
    if (countEl) countEl.textContent = `${rows.length} beneficiary record${rows.length === 1 ? '' : 's'}`;

    if (rows.length === 0) {
        listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.82rem;">No beneficiaries match your filter.</div>';
        return;
    }

    listEl.innerHTML = rows.map((r) => {
        const id = Number(r.id);
        const isSelected = smsSelectedBenIds.has(id);
        const initials = (r.display_name || 'B').slice(0, 2).toUpperCase();
        const inputType = smsComposeMode === 'bulk' ? 'checkbox' : 'radio';

        return `
            <div class="sms-recipient-item ${isSelected ? 'selected' : ''}" onclick="toggleSmsRecipient(${id})">
                <div class="sms-recipient-main">
                    <input type="${inputType}" name="smsIndBenRadio" ${isSelected ? 'checked' : ''} ${!r.has_valid_phone ? 'disabled' : ''} onclick="event.stopPropagation(); toggleSmsRecipient(${id});" aria-label="Select ${escSms(r.display_name)}">
                    <div class="sms-avatar">${escSms(initials)}</div>
                    <div style="min-width:0;">
                        <div style="font-weight:700;font-size:0.83rem;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escSms(r.display_name)}</div>
                        <div style="font-size:0.71rem;color:var(--text-muted);">${escSms(r.application_number || '#' + id)} &middot; ${escSms(r.home_town || 'Galgamuwa')}</div>
                    </div>
                </div>
                <span class="sms-phone-pill ${r.has_valid_phone ? '' : 'invalid'}">
                    ${r.has_valid_phone ? escSms(r.contact_number) : 'No Phone'}
                </span>
            </div>
        `;
    }).join('');
}

function toggleSmsRecipient(id) {
    const numId = Number(id);
    const rec = smsRecipients.find((r) => Number(r.id) === numId);
    if (rec && !rec.has_valid_phone) {
        smsNotify(`${rec.display_name} does not have a valid mobile number.`, 'error');
        return;
    }
    if (smsComposeMode === 'individual') {
        if (smsSelectedBenIds.has(numId)) smsSelectedBenIds.clear();
        else smsSelectedBenIds = new Set([numId]);
    } else {
        if (smsSelectedBenIds.has(numId)) smsSelectedBenIds.delete(numId);
        else smsSelectedBenIds.add(numId);
    }
    renderSmsRecipientList();
    updateSmsSelectionSummary();
    updateSmsComposerPreview();
}

function selectAllValidSmsRecipients() {
    if (smsComposeMode !== 'bulk') setSmsComposeMode('bulk');
    const filtered = getFilteredSmsRecipients().filter((r) => r.has_valid_phone);
    filtered.forEach((r) => smsSelectedBenIds.add(Number(r.id)));
    renderSmsRecipientList();
    updateSmsSelectionSummary();
    updateSmsComposerPreview();
}

function clearSmsRecipients() {
    smsSelectedBenIds.clear();
    const customInp = document.getElementById('smsCustomPhones');
    if (customInp) customInp.value = '';
    renderSmsRecipientList();
    updateSmsSelectionSummary();
    updateSmsComposerPreview();
}

function parseCustomPhoneInput() {
    const raw = (document.getElementById('smsCustomPhones')?.value || '').trim();
    if (!raw) return [];
    return raw.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
}

function updateSmsSelectionSummary() {
    const customNums = parseCustomPhoneInput();
    const totalCount = smsSelectedBenIds.size + customNums.length;

    const sumEl = document.getElementById('smsSelectionSummary');
    if (sumEl) {
        sumEl.textContent = `${totalCount} recipient${totalCount === 1 ? '' : 's'} ready (${smsSelectedBenIds.size} beneficiaries, ${customNums.length} custom)`;
    }

    const sendBtn = document.getElementById('smsSendActionBtn');
    if (sendBtn) {
        sendBtn.innerHTML = totalCount > 1 || smsComposeMode === 'bulk'
            ? `<i class="fas fa-paper-plane"></i> Send Bulk SMS (${totalCount})`
            : '<i class="fas fa-paper-plane"></i> Send SMS Now';
    }
}

async function openSmsForBeneficiary(benId) {
    if (typeof window.switchTab === 'function') {
        window.switchTab('smsgateway');
    }
    if (smsRecipients.length === 0) {
        await fetchSmsWorkspace();
    }
    setSmsSubTab('dispatch');
    setSmsComposeMode('individual');
    smsSelectedBenIds = new Set([Number(benId)]);
    renderSmsRecipientList();
    updateSmsSelectionSummary();
    updateSmsComposerPreview();
    const msgBox = document.getElementById('smsMessageBody');
    if (msgBox) msgBox.focus();
}

// ── Message Composer, Templates & Dispatch ────────────────────────────────────

function insertSmsMergeTag(tag) {
    const box = document.getElementById('smsMessageBody');
    if (!box) return;
    const start = box.selectionStart ?? box.value.length;
    const end = box.selectionEnd ?? box.value.length;
    box.value = box.value.slice(0, start) + tag + box.value.slice(end);
    box.selectionStart = box.selectionEnd = start + tag.length;
    box.focus();
    updateSmsComposerPreview();
}

function applySmsTemplateSelection() {
    const tplId = document.getElementById('smsTemplateSelect')?.value;
    if (!tplId) return;
    const tpl = smsTemplates.find((t) => String(t.id) === String(tplId));
    if (!tpl) return;
    const box = document.getElementById('smsMessageBody');
    if (box) box.value = tpl.body;
    const tagInp = document.getElementById('smsReminderTag');
    if (tagInp && !tagInp.value.trim()) tagInp.value = tpl.category || tpl.title;
    updateSmsComposerPreview();
}

function updateSmsComposerPreview() {
    const text = document.getElementById('smsMessageBody')?.value || '';
    const metrics = calcClientSmsSegments(text);

    const charEl = document.getElementById('smsCharCounter');
    const segEl = document.getElementById('smsSegmentCounter');
    if (charEl) charEl.textContent = `${metrics.chars} characters · ${metrics.encoding}`;
    if (segEl) segEl.textContent = `${metrics.segments} SMS segment(s)`;

    const previewEl = document.getElementById('smsLivePreview');
    if (previewEl) {
        if (!text.trim()) {
            previewEl.textContent = 'Type a message to preview how merge tags resolve for your selected beneficiary.';
        } else {
            const firstId = [...smsSelectedBenIds][0];
            const firstBen = firstId ? smsRecipients.find((r) => Number(r.id) === Number(firstId)) : null;
            previewEl.textContent = resolveClientMergeTags(text, firstBen);
        }
    }
}

async function dispatchSmsMessage() {
    const gatewayId = document.getElementById('smsDispatchGateway')?.value || null;
    const message = (document.getElementById('smsMessageBody')?.value || '').trim();
    const reminderTag = (document.getElementById('smsReminderTag')?.value || '').trim();
    const scheduleTime = document.getElementById('smsScheduleTime')?.value || null;
    const dryRun = Boolean(document.getElementById('smsDryRunToggle')?.checked);

    if (!gatewayId) {
        smsNotify('Add and select an SMS API Gateway first (e.g., Text.lk).', 'error');
        setSmsSubTab('gateways');
        return;
    }
    if (!message) {
        smsNotify('Please type a message or reminder before sending.', 'error');
        return;
    }

    const benIds = [...smsSelectedBenIds];
    const customPhones = parseCustomPhoneInput();
    if (benIds.length === 0 && customPhones.length === 0) {
        smsNotify('Select at least one beneficiary or enter a mobile number.', 'error');
        return;
    }

    const isSingle = smsComposeMode === 'individual' && benIds.length + customPhones.length === 1;

    try {
        if (isSingle) {
            const res = await smsApi('/api/sms/send/individual', {
                method: 'POST',
                body: JSON.stringify({
                    gateway_id: parseInt(gatewayId, 10),
                    beneficiary_id: benIds[0] || null,
                    phone: customPhones[0] || '',
                    message,
                    reminder_tag: reminderTag,
                    schedule_time: scheduleTime,
                    dry_run: dryRun
                })
            });
            smsNotify(`SMS ${res.status} to ${res.phone_normalized}.`, 'success');
        } else {
            const res = await smsApi('/api/sms/send/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    gateway_id: parseInt(gatewayId, 10),
                    beneficiary_ids: benIds,
                    custom_numbers: customPhones,
                    message,
                    reminder_tag: reminderTag,
                    schedule_time: scheduleTime,
                    dry_run: dryRun
                })
            });
            smsNotify(`Bulk SMS complete: ${res.sent_count} succeeded, ${res.failed_count} failed (${res.total_targets} total).`, res.failed_count > 0 ? 'error' : 'success');
        }
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('SMS dispatch error: ' + err.message, 'error');
        await fetchSmsWorkspace();
    }
}

// ── Gateways CRUD ─────────────────────────────────────────────────────────────

function renderSmsGatewaysGrid() {
    const grid = document.getElementById('smsGatewaysGrid');
    if (!grid) return;

    if (smsGateways.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;padding:2.8rem;text-align:center;border:1px dashed var(--border-color);border-radius:20px;background:var(--bg-card);">
                <i class="fas fa-tower-broadcast" style="font-size:2rem;color:#10b981;margin-bottom:0.6rem;"></i>
                <h4 style="margin:0 0 0.3rem;font-weight:800;color:var(--text-main);">No SMS API Gateways Configured</h4>
                <p style="margin:0 0 1rem;font-size:0.83rem;color:var(--text-muted);">Connect your Text.lk (texts.lk) Bearer token or another REST gateway to enable individual &amp; bulk SMS.</p>
                <button type="button" class="sms-btn sms-btn-primary" onclick="openSmsGatewayModal('add')"><i class="fas fa-plus"></i> Configure Text.lk Gateway</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = smsGateways.map((g) => {
        const provLabel = SMS_PROVIDER_PRESETS[g.provider]?.label || g.provider;
        return `
            <div class="sms-gw-card ${g.is_default ? 'is-default' : ''}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;">
                    <div>
                        <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                            <strong style="font-size:1rem;color:var(--text-main);">${escSms(g.name)}</strong>
                            ${g.is_default ? '<span class="sms-status-pill sms-st-sent">Default</span>' : ''}
                            ${!g.is_active ? '<span class="sms-status-pill sms-st-cancelled">Disabled</span>' : ''}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.15rem;">${escSms(provLabel)} &middot; ${escSms(g.last_status || 'Configured')}</div>
                    </div>
                </div>

                <div class="sms-gw-specs">
                    <div><span>Sender ID</span><strong>${escSms(g.sender_id)}</strong></div>
                    <div><span>Token</span><strong style="font-family:monospace;">${escSms(g.api_token_masked || '••••')}</strong></div>
                    <div><span>Country Prefix</span><strong>+${escSms(g.default_country_code || '94')}</strong></div>
                    <div><span>Encoding</span><strong>${escSms(g.message_type || 'plain')}</strong></div>
                    <div style="grid-column:1/-1;"><span>Endpoint URL</span><strong style="font-size:0.72rem;">${escSms(g.api_url)}</strong></div>
                </div>

                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;flex-wrap:wrap;margin-top:auto;">
                    <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                        ${!g.is_default ? `<button type="button" class="sms-btn" style="padding:0.36rem 0.65rem;font-size:0.74rem;" onclick="setDefaultSmsGateway(${g.id})">Set Default</button>` : ''}
                        <button type="button" class="sms-btn sms-btn-gold" style="padding:0.36rem 0.72rem;font-size:0.74rem;" onclick="openSmsTestModal(${g.id})"><i class="fas fa-vial"></i> Test</button>
                    </div>
                    <div style="display:flex;gap:0.3rem;">
                        <button type="button" class="sms-ico-btn" onclick="openSmsGatewayModal('edit', ${g.id})" title="Edit Gateway"><i class="fas fa-pen"></i></button>
                        <button type="button" class="sms-ico-btn danger" onclick="deleteSmsGateway(${g.id})" title="Delete Gateway"><i class="fas fa-trash-can"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectSmsProviderPreset(prov) {
    const sel = document.getElementById('smsGwProvider');
    if (sel) sel.value = prov;
    document.querySelectorAll('#smsProviderPills .sms-preset-pill').forEach((btn) => {
        btn.classList.toggle('selected', btn.dataset.prov === prov);
    });
    const urlInp = document.getElementById('smsGwUrl');
    const preset = SMS_PROVIDER_PRESETS[prov];
    if (urlInp && preset && preset.url) {
        urlInp.value = preset.url;
    }
}

function onSmsProviderChange() {
    const prov = document.getElementById('smsGwProvider')?.value || 'textlk';
    selectSmsProviderPreset(prov);
}

function toggleSmsTokenVis() {
    const inp = document.getElementById('smsGwToken');
    const ico = document.getElementById('smsTokenEyeIcon');
    if (!inp) return;
    const isPwd = inp.type === 'password';
    inp.type = isPwd ? 'text' : 'password';
    if (ico) ico.className = isPwd ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function openSmsGatewayModal(mode = 'add', gwId = null) {
    const form = document.getElementById('smsGatewayForm');
    if (form) form.reset();
    document.getElementById('smsGwId').value = '';
    const tokInp = document.getElementById('smsGwToken');
    if (tokInp) tokInp.type = 'password';

    if (mode === 'edit' && gwId !== null) {
        const g = smsGateways.find((x) => Number(x.id) === Number(gwId));
        if (!g) return;
        document.getElementById('smsGwModalTitle').textContent = `Edit Gateway: ${g.name}`;
        document.getElementById('smsGwId').value = String(g.id);
        selectSmsProviderPreset(g.provider || 'textlk');
        document.getElementById('smsGwName').value = g.name || '';
        document.getElementById('smsGwSenderId').value = g.sender_id || '';
        document.getElementById('smsGwUrl').value = g.api_url || '';
        document.getElementById('smsGwToken').value = g.api_token_masked || '';
        document.getElementById('smsGwCountryCode').value = g.default_country_code || '94';
        document.getElementById('smsGwMsgType').value = g.message_type || 'plain';
        document.getElementById('smsGwHeaders').value = g.custom_headers || '{}';
        document.getElementById('smsGwIsDefault').checked = g.is_default === 1;
        document.getElementById('smsGwIsActive').checked = g.is_active !== 0;
    } else {
        document.getElementById('smsGwModalTitle').textContent = 'Configure SMS API Gateway';
        selectSmsProviderPreset('textlk');
        document.getElementById('smsGwName').value = 'Text.lk Primary';
        document.getElementById('smsGwCountryCode').value = '94';
        document.getElementById('smsGwHeaders').value = '{}';
        document.getElementById('smsGwIsDefault').checked = smsGateways.length === 0;
        document.getElementById('smsGwIsActive').checked = true;
    }

    openSmsModal('smsGatewayModal');
}

async function saveSmsGateway(e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('smsGwId')?.value;
    const tokenVal = (document.getElementById('smsGwToken')?.value || '').trim();
    if (!id && !tokenVal) {
        smsNotify('API Token is required when adding a new gateway.', 'error');
        return;
    }

    const payload = {
        name: (document.getElementById('smsGwName')?.value || '').trim(),
        provider: document.getElementById('smsGwProvider')?.value || 'textlk',
        sender_id: (document.getElementById('smsGwSenderId')?.value || '').trim(),
        api_url: (document.getElementById('smsGwUrl')?.value || '').trim(),
        api_token: tokenVal,
        default_country_code: (document.getElementById('smsGwCountryCode')?.value || '94').trim(),
        message_type: document.getElementById('smsGwMsgType')?.value || 'plain',
        custom_headers: (document.getElementById('smsGwHeaders')?.value || '{}').trim() || '{}',
        is_default: document.getElementById('smsGwIsDefault')?.checked ? 1 : 0,
        is_active: document.getElementById('smsGwIsActive')?.checked ? 1 : 0
    };

    try {
        if (id) {
            await smsApi(`/api/sms/gateways/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            smsNotify(`Updated SMS gateway "${payload.name}".`, 'success');
        } else {
            await smsApi('/api/sms/gateways', { method: 'POST', body: JSON.stringify(payload) });
            smsNotify(`Added SMS gateway "${payload.name}".`, 'success');
        }
        closeSmsModal('smsGatewayModal');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Could not save gateway: ' + err.message, 'error');
    }
}

async function setDefaultSmsGateway(id) {
    try {
        await smsApi(`/api/sms/gateways/${id}/default`, { method: 'PATCH' });
        smsNotify('Default SMS gateway updated.', 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Failed to update default gateway: ' + err.message, 'error');
    }
}

async function deleteSmsGateway(id) {
    if (typeof confirm === 'function' && !confirm('Delete this SMS gateway configuration?')) return;
    try {
        await smsApi(`/api/sms/gateways/${id}`, { method: 'DELETE' });
        smsNotify('Gateway deleted.', 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Delete failed: ' + err.message, 'error');
    }
}

function openSmsTestModal(gwId) {
    const g = smsGateways.find((x) => Number(x.id) === Number(gwId));
    document.getElementById('smsTestGwId').value = String(gwId);
    document.getElementById('smsTestGwSubtitle').textContent = g ? `Testing ${g.name} (${g.sender_id})` : 'Verify gateway connection';
    const box = document.getElementById('smsTestResultBox');
    if (box) {
        box.style.display = 'none';
        box.textContent = '';
    }
    openSmsModal('smsTestModal');
}

async function runSmsGatewayTest(e) {
    if (e && e.preventDefault) e.preventDefault();
    const gwId = document.getElementById('smsTestGwId')?.value;
    const phone = (document.getElementById('smsTestPhone')?.value || '').trim();
    const message = (document.getElementById('smsTestMessage')?.value || '').trim();
    const dry_run = Boolean(document.getElementById('smsTestDryRun')?.checked);
    const box = document.getElementById('smsTestResultBox');

    try {
        const res = await smsApi(`/api/sms/gateways/${gwId}/test`, {
            method: 'POST',
            body: JSON.stringify({ phone, message, dry_run })
        });
        if (box) {
            box.style.display = 'block';
            box.textContent = JSON.stringify(res, null, 2);
        }
        smsNotify(`Test ${res.status} (${res.phone_normalized}).`, 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        if (box) {
            box.style.display = 'block';
            box.textContent = JSON.stringify(err.payload || { error: err.message }, null, 2);
        }
        smsNotify('Gateway test failed: ' + err.message, 'error');
    }
}

// ── Templates CRUD ────────────────────────────────────────────────────────────

function renderSmsTemplatesGrid() {
    const grid = document.getElementById('smsTemplatesGrid');
    if (!grid) return;
    if (smsTemplates.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--text-muted);">No SMS templates yet. Click Create Template above.</div>';
        return;
    }

    grid.innerHTML = smsTemplates.map((t) => `
        <div class="sms-gw-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                <strong style="font-size:0.95rem;color:var(--text-main);">${escSms(t.title)}</strong>
                <span class="sms-status-pill sms-st-scheduled">${escSms(t.category || 'Reminder')}</span>
            </div>
            <div style="font-size:0.81rem;line-height:1.5;color:var(--text-muted);background:var(--input-bg);padding:0.72rem;border-radius:12px;border:1px solid var(--border-color);">
                ${escSms(t.body)}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.4rem;margin-top:auto;">
                <button type="button" class="sms-btn sms-btn-primary" style="padding:0.38rem 0.72rem;font-size:0.75rem;" onclick="useSmsTemplate(${t.id})">
                    <i class="fas fa-arrow-up-right-from-square"></i> Use in Composer
                </button>
                <div style="display:flex;gap:0.3rem;">
                    <button type="button" class="sms-ico-btn" onclick="openSmsTemplateModal('edit', ${t.id})" title="Edit Template"><i class="fas fa-pen"></i></button>
                    <button type="button" class="sms-ico-btn danger" onclick="deleteSmsTemplate(${t.id})" title="Delete Template"><i class="fas fa-trash-can"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function openSmsTemplateModal(mode = 'add', id = null) {
    const form = document.getElementById('smsTemplateForm');
    if (form) form.reset();
    document.getElementById('smsTplId').value = '';

    if (mode === 'edit' && id !== null) {
        const t = smsTemplates.find((x) => Number(x.id) === Number(id));
        if (!t) return;
        document.getElementById('smsTplModalTitle').textContent = 'Edit SMS Template';
        document.getElementById('smsTplId').value = String(t.id);
        document.getElementById('smsTplTitle').value = t.title || '';
        document.getElementById('smsTplCategory').value = t.category || 'Reminder';
        document.getElementById('smsTplBody').value = t.body || '';
    } else if (mode === 'saveCurrent') {
        document.getElementById('smsTplModalTitle').textContent = 'Save Message as Template';
        document.getElementById('smsTplBody').value = document.getElementById('smsMessageBody')?.value || '';
        document.getElementById('smsTplTitle').value = document.getElementById('smsReminderTag')?.value || '';
    } else {
        document.getElementById('smsTplModalTitle').textContent = 'Create SMS Template';
    }
    openSmsModal('smsTemplateModal');
}

function useSmsTemplate(id) {
    const t = smsTemplates.find((x) => Number(x.id) === Number(id));
    if (!t) return;
    setSmsSubTab('dispatch');
    const sel = document.getElementById('smsTemplateSelect');
    if (sel) sel.value = String(t.id);
    const box = document.getElementById('smsMessageBody');
    if (box) box.value = t.body;
    const tagInp = document.getElementById('smsReminderTag');
    if (tagInp) tagInp.value = t.category || t.title;
    updateSmsComposerPreview();
}

async function saveSmsTemplate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('smsTplId')?.value;
    const payload = {
        title: (document.getElementById('smsTplTitle')?.value || '').trim(),
        category: document.getElementById('smsTplCategory')?.value || 'Reminder',
        body: (document.getElementById('smsTplBody')?.value || '').trim()
    };

    try {
        if (id) {
            await smsApi(`/api/sms/templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            smsNotify('Template updated.', 'success');
        } else {
            await smsApi('/api/sms/templates', { method: 'POST', body: JSON.stringify(payload) });
            smsNotify('Template created.', 'success');
        }
        closeSmsModal('smsTemplateModal');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Failed to save template: ' + err.message, 'error');
    }
}

async function deleteSmsTemplate(id) {
    if (typeof confirm === 'function' && !confirm('Delete this SMS template?')) return;
    try {
        await smsApi(`/api/sms/templates/${id}`, { method: 'DELETE' });
        smsNotify('Template deleted.', 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Could not delete template: ' + err.message, 'error');
    }
}

// ── Dispatch Logs & Reminders Audit CRUD ──────────────────────────────────────

async function loadSmsLogs() {
    const q = encodeURIComponent((document.getElementById('smsLogSearch')?.value || '').trim());
    const st = encodeURIComponent(document.getElementById('smsLogStatusFilter')?.value || 'all');
    const mode = encodeURIComponent(document.getElementById('smsLogModeFilter')?.value || 'all');
    try {
        smsLogs = await smsApi(`/api/sms/logs?status=${st}&mode=${mode}&search=${q}`);
        renderSmsLogsTable();
    } catch (err) {
        smsNotify('Could not filter SMS logs: ' + err.message, 'error');
    }
}

function filterSmsLogsByStatus(status) {
    const sel = document.getElementById('smsLogStatusFilter');
    if (sel) sel.value = status || 'all';
    loadSmsLogs();
}

function renderSmsLogsTable() {
    const tbody = document.getElementById('smsLogsTableBody');
    if (!tbody) return;
    updateBulkLogBtn();

    if (smsLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2.2rem;color:var(--text-muted);">No SMS dispatch records found.</td></tr>';
        return;
    }

    const stClsMap = {
        sent: 'sms-st-sent',
        scheduled: 'sms-st-scheduled',
        simulated: 'sms-st-simulated',
        failed: 'sms-st-failed',
        cancelled: 'sms-st-cancelled'
    };

    tbody.innerHTML = smsLogs.map((l) => {
        const id = Number(l.id);
        const checked = smsSelectedLogIds.has(id);
        const stCls = stClsMap[l.status] || 'sms-st-simulated';

        return `
            <tr>
                <td><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleSmsLogSelect(${id}, this.checked)"></td>
                <td>
                    <strong style="display:block;">${escSms(l.beneficiary_name || l.phone_raw || 'Recipient')}</strong>
                    <span style="font-family:monospace;font-size:0.73rem;color:var(--text-muted);">${escSms(l.phone_normalized)}</span>
                </td>
                <td>
                    <div style="max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escSms(l.message)}</div>
                    <div style="display:flex;gap:0.35rem;align-items:center;margin-top:0.2rem;flex-wrap:wrap;">
                        ${l.reminder_tag ? `<span class="sms-status-pill sms-st-scheduled">${escSms(l.reminder_tag)}</span>` : ''}
                        <span style="font-size:0.71rem;color:var(--text-muted);">${Number(l.segments) || 1} seg</span>
                    </div>
                </td>
                <td>
                    <div style="font-weight:700;font-size:0.79rem;">${escSms(l.gateway_name || 'Gateway')}</div>
                    <div style="font-size:0.71rem;color:var(--text-muted);text-transform:capitalize;">${escSms(l.dispatch_mode || 'individual')} &middot; ${escSms(l.sender_id || '')}</div>
                </td>
                <td>
                    <span class="sms-status-pill ${stCls}">${escSms(l.status)}</span>
                    ${l.error_message ? `<div style="font-size:0.7rem;color:#ef4444;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escSms(l.error_message)}</div>` : ''}
                </td>
                <td style="font-size:0.76rem;color:var(--text-muted);">
                    ${smsFmtDateTime(l.created_at)}
                    ${l.scheduled_for ? `<div style="color:#d97706;">Due: ${smsFmtDateTime(l.scheduled_for)}</div>` : ''}
                </td>
                <td>
                    <div style="display:flex;justify-content:flex-end;gap:0.3rem;">
                        <button type="button" class="sms-ico-btn" onclick="openSmsLogDetailModal(${id})" title="Inspect / Edit"><i class="fas fa-eye"></i></button>
                        <button type="button" class="sms-ico-btn" onclick="resendSmsLog(${id})" title="Resend SMS"><i class="fas fa-rotate-right"></i></button>
                        <button type="button" class="sms-ico-btn danger" onclick="deleteSmsLog(${id})" title="Delete Log"><i class="fas fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleSmsLogSelect(id, checked) {
    if (checked) smsSelectedLogIds.add(Number(id));
    else smsSelectedLogIds.delete(Number(id));
    updateBulkLogBtn();
}

function toggleAllSmsLogSelect(checked) {
    smsLogs.forEach((l) => {
        if (checked) smsSelectedLogIds.add(Number(l.id));
        else smsSelectedLogIds.delete(Number(l.id));
    });
    updateBulkLogBtn();
    renderSmsLogsTable();
}

function updateBulkLogBtn() {
    const btn = document.getElementById('smsBulkDelLogsBtn');
    const cnt = document.getElementById('smsBulkLogCount');
    if (cnt) cnt.textContent = String(smsSelectedLogIds.size);
    if (btn) btn.style.display = smsSelectedLogIds.size > 0 ? 'inline-flex' : 'none';
}

function openSmsLogDetailModal(id) {
    const log = smsLogs.find((x) => Number(x.id) === Number(id));
    if (!log) return;

    document.getElementById('smsLogEditId').value = String(log.id);
    document.getElementById('smsLogDetailMeta').textContent = `Log #${log.id} · Sent by ${log.sent_by || 'staff'} · ${smsFmtDateTime(log.created_at)}`;

    const bodyEl = document.getElementById('smsLogDetailBody');
    const ftrEl = document.getElementById('smsLogDetailFooter');

    if (bodyEl) {
        bodyEl.innerHTML = `
            <div class="sms-form-section">
                <div class="sms-form-grid-2">
                    <div><span style="font-size:0.7rem;color:var(--text-muted);display:block;">Recipient</span><strong>${escSms(log.beneficiary_name || 'Recipient')} (${escSms(log.phone_normalized)})</strong></div>
                    <div><span style="font-size:0.7rem;color:var(--text-muted);display:block;">Gateway &amp; Sender ID</span><strong>${escSms(log.gateway_name || '—')} · ${escSms(log.sender_id || '')}</strong></div>
                </div>
                <div style="padding:0.75rem;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-color);font-size:0.82rem;white-space:pre-wrap;">${escSms(log.message)}</div>
                <div class="sms-form-grid-2">
                    <div class="sms-field">
                        <label for="smsLogEditTag">Reminder Tag</label>
                        <input type="text" id="smsLogEditTag" class="sms-input" value="${escSms(log.reminder_tag || '')}">
                    </div>
                    <div class="sms-field">
                        <label for="smsLogEditStatus">Status</label>
                        <select id="smsLogEditStatus" class="sms-select">
                            <option value="sent" ${log.status === 'sent' ? 'selected' : ''}>Sent</option>
                            <option value="scheduled" ${log.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                            <option value="simulated" ${log.status === 'simulated' ? 'selected' : ''}>Simulated</option>
                            <option value="failed" ${log.status === 'failed' ? 'selected' : ''}>Failed</option>
                            <option value="cancelled" ${log.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </div>
                ${log.provider_response ? `
                <div>
                    <span style="font-size:0.7rem;color:var(--text-muted);display:block;margin-bottom:0.25rem;">Gateway Response</span>
                    <pre style="margin:0;padding:0.65rem;border-radius:10px;background:var(--bg-card);border:1px solid var(--border-color);font-size:0.73rem;overflow:auto;max-height:130px;">${escSms(log.provider_response)}</pre>
                </div>` : ''}
            </div>
        `;
    }

    if (ftrEl) {
        ftrEl.innerHTML = `
            <button type="button" class="sms-mbtn sms-mbtn-gold" onclick="closeSmsModal('smsLogDetailModal'); resendSmsLog(${log.id});"><i class="fas fa-rotate-right"></i> Resend</button>
            <button type="button" class="sms-mbtn" onclick="closeSmsModal('smsLogDetailModal')">Close</button>
            <button type="submit" class="sms-mbtn sms-mbtn-primary"><i class="fas fa-check"></i> Save Log</button>
        `;
    }

    openSmsModal('smsLogDetailModal');
}

async function saveSmsLogChanges(e) {
    if (e && e.preventDefault) e.preventDefault();
    const id = document.getElementById('smsLogEditId')?.value;
    try {
        await smsApi(`/api/sms/logs/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                reminder_tag: (document.getElementById('smsLogEditTag')?.value || '').trim(),
                status: document.getElementById('smsLogEditStatus')?.value || 'sent'
            })
        });
        smsNotify('Log updated cleanly.', 'success');
        closeSmsModal('smsLogDetailModal');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Could not update log: ' + err.message, 'error');
    }
}

async function resendSmsLog(id) {
    const dryRun = Boolean(document.getElementById('smsDryRunToggle')?.checked);
    try {
        const res = await smsApi(`/api/sms/logs/${id}/resend`, {
            method: 'POST',
            body: JSON.stringify({ dry_run: dryRun })
        });
        smsNotify(`Message re-dispatched (${res.status}).`, 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Resend failed: ' + err.message, 'error');
        await fetchSmsWorkspace();
    }
}

async function deleteSmsLog(id) {
    if (typeof confirm === 'function' && !confirm('Delete this SMS log entry?')) return;
    try {
        await smsApi(`/api/sms/logs/${id}`, { method: 'DELETE' });
        smsSelectedLogIds.delete(Number(id));
        smsNotify('Log deleted.', 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Delete failed: ' + err.message, 'error');
    }
}

async function bulkDeleteSmsLogs() {
    const ids = [...smsSelectedLogIds];
    if (!ids.length) return;
    if (typeof confirm === 'function' && !confirm(`Delete ${ids.length} selected SMS log entries?`)) return;
    try {
        await smsApi('/api/sms/logs/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids })
        });
        smsSelectedLogIds.clear();
        smsNotify(`Deleted ${ids.length} log entries.`, 'success');
        await fetchSmsWorkspace();
    } catch (err) {
        smsNotify('Bulk delete failed: ' + err.message, 'error');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchSmsWorkspace,
        setSmsSubTab,
        setSmsComposeMode,
        toggleSmsRecipient,
        calcClientSmsSegments,
        resolveClientMergeTags,
        openSmsGatewayModal,
        openSmsTemplateModal,
        openSmsLogDetailModal,
        renderSmsGatewaysGrid,
        renderSmsTemplatesGrid,
        renderSmsLogsTable
    };
}


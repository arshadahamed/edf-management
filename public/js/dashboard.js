// Navigation and Tab Switching Logic
function switchTab(tabId, clickedLink = null) {
    if (!tabId) return;

    // Get the link element to highlight (either passed in or found by tabId)
    const link = clickedLink || document.querySelector(`#mainNav [data-tab="${tabId}"]`);
    if (!link) return;

    // Handle Active State for main links and submenu links
    document.querySelectorAll('#mainNav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // If it's a submenu link, also highlight the parent
    const parentSubmenu = link.closest('.nav-submenu');
    if (parentSubmenu) {
        const parentLink = parentSubmenu.previousElementSibling;
        if (parentLink) parentLink.classList.add('active');
        // Ensure submenu stays visible when one of its items is active
        parentSubmenu.style.display = 'block';
        const arrow = parentLink.querySelector('.menu-arrow');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }

    const navText = link.querySelector('.nav-text') || link;
    const tabTitle = navText.textContent.trim();
    document.getElementById('currentTabTitle').textContent = tabTitle;

    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
        t.style.opacity = '0';
    });

    const targetTab = document.getElementById(`${tabId}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
        setTimeout(() => targetTab.style.opacity = '1', 50);
    }

    if (tabId === 'members') fetchMembers();
    if (tabId === 'subscriptions') fetchSubscriptions();
    if (tabId === 'families') fetchFamilies();
    if (tabId === 'beneficiaries') { fetchBeneficiaries(); populateBenCategoryFilter(); }
    if (tabId === 'courses') fetchPrograms();
    if (tabId === 'overview') { fetchStats(); if (_currentUser && (_currentUser.role === 'admin' || _currentUser.role === 'super_user')) fetchOvActiveUsers(); }
    if (tabId === 'donations') fetchDonations();
    if (tabId === 'ramadan') fetchRamadanDistributions();
    if (tabId === 'users') {
        fetchAdminUsers();
        if (_umOnlinePollTimer) clearInterval(_umOnlinePollTimer);
        _umOnlinePollTimer = setInterval(fetchAdminUsers, 5000);
    } else {
        if (_umOnlinePollTimer) { clearInterval(_umOnlinePollTimer); _umOnlinePollTimer = null; }
    }
    if (tabId === 'volunteers') fetchVolunteers();
    if (tabId === 'notifications') renderNotificationsPage();
    if (tabId === 'customizer') FB.init();
    if (tabId === 'frontdesk') { if (typeof fdLoadAll === 'function') fdLoadAll(); lucide.createIcons(); }
    if (tabId === 'logs') {
        fetchLogStats(); fetchSystemLogs(true); loadLogUserFilter();
    } else {
        // Stop log auto-refresh when leaving the logs tab
        if (_logAutoRefreshTimer) { clearInterval(_logAutoRefreshTimer); _logAutoRefreshTimer = null; }
        const arCb = document.getElementById('logAutoRefresh');
        if (arCb) arCb.checked = false;
        const badge = document.getElementById('logAutoRefreshBadge');
        if (badge) badge.style.display = 'none';
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.querySelector('.sidebar').classList.remove('active');
    }

    lucide.createIcons();
}

// Global Navigation Click Handler
document.addEventListener('click', (e) => {
    const link = e.target.closest('#mainNav a');
    if (!link) return;

    const tabId = link.getAttribute('data-tab');

    // Toggle Submenu if it exists
    const submenu = link.nextElementSibling;
    const isSubmenuTrigger = submenu && submenu.classList.contains('nav-submenu');

    if (tabId) {
        e.preventDefault();
        switchTab(tabId, link);
    }

    if (isSubmenuTrigger) {
        // Toggle submenu visibility manually
        const isCurrentlyVisible = window.getComputedStyle(submenu).display !== 'none';
        submenu.style.display = isCurrentlyVisible ? 'none' : 'block';

        const arrow = link.querySelector('.menu-arrow');
        if (arrow) {
            arrow.style.transform = isCurrentlyVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
});

// Sidebar Toggle for Mobile
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
});

// Close mobile sidebar when a nav link is clicked
document.querySelectorAll('.nav-link, .nav-submenu-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
            document.querySelector('.sidebar')?.classList.remove('active');
        }
    });
});

// Sidebar Toggle for Desktop
document.getElementById('desktopToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('expanded');
});

// Modal Tab switching (Event Delegation version)
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.modal-tab');
    if (!tab) return;

    const targetId = tab.getAttribute('data-modal-tab');
    const modal = tab.closest('.modal');
    if (!modal || !targetId) return;

    // Remove active from sibling tabs and contents
    modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

    // Set active
    tab.classList.add('active');
    const targetContent = modal.querySelector(`#${targetId}`);
    if (targetContent) targetContent.classList.add('active');
});

let _currentUser = null; // populated on load

async function fetchUser() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) { window.location.href = '/login'; return; }
        const user = await response.json();
        _currentUser = user;

        let displayRole = user.role;
        if (user.role === 'super_user') displayRole = 'System Administrator';
        else if (user.role === 'admin') displayRole = 'Admin';
        else displayRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);

        // Populate left sidebar or old generic elements
        const welcomeUserEl = document.getElementById('welcomeUser');
        if (welcomeUserEl) welcomeUserEl.textContent = `Welcome, ${user.full_name.split(' ')[0]}`;
        
        // Populate Topbar
        const userFullNameEl = document.getElementById('userFullName');
        if (userFullNameEl) userFullNameEl.textContent = user.full_name;
        
        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl) userRoleEl.textContent = displayRole;

        const avatarUrl = user.avatar_url ? user.avatar_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=4f46e5&color=fff`;

        // Handle old userAvatar ID if it exists
        const oldAvatarEl = document.getElementById('userAvatar');
        if (oldAvatarEl) oldAvatarEl.src = avatarUrl;
        
        // Handle new topbar avatar
        const topUserAvatar = document.getElementById('topUserAvatar');
        const topUserInitials = document.getElementById('topUserInitials');
        if (topUserAvatar && topUserInitials) {
            if (user.avatar_url) {
                topUserAvatar.src = user.avatar_url;
                topUserAvatar.style.display = 'block';
                topUserInitials.style.display = 'none';
            } else {
                topUserAvatar.style.display = 'none';
                topUserInitials.style.display = 'flex';
                const names = user.full_name.split(' ');
                topUserInitials.textContent = (names[0][0] + (names.length>1?names[names.length-1][0]:'')).toUpperCase();
                topUserInitials.style.background = 'var(--primary)';
            }
        }

        // Populate Profile Tab Hero Card
        const profName = document.getElementById('profileHeroName');
        const profRole = document.getElementById('profileHeroRole');
        const profEmail = document.getElementById('profileHeroEmail');
        const profImg = document.getElementById('profileAvatarImg');
        
        if (profName) profName.textContent = user.full_name;
        if (profRole) profRole.textContent = displayRole;
        if (profEmail) profEmail.textContent = user.email;
        if (profImg) profImg.src = avatarUrl;

        // Show admin-only nav items (User Accounts + Front Desk) for admin / super_user
        if (user.role === 'admin' || user.role === 'super_user') {
            const navItem = document.getElementById('usersNavItem');
            if (navItem) navItem.style.display = '';
            const fdNav = document.getElementById('frontdeskNavItem');
            if (fdNav) fdNav.style.display = '';
            // Show the Active Users widget on overview
            const auCard = document.getElementById('ovActiveUsersCard');
            if (auCard) auCard.style.display = '';
            // Load the active users widget immediately
            fetchOvActiveUsers();
            // Auto-refresh the widget every 30 s
            if (_ovAuPollTimer) clearInterval(_ovAuPollTimer);
            _ovAuPollTimer = setInterval(fetchOvActiveUsers, 30000);
            // Start login-event notification polling for admins
            _startLoginEventPolling();
        }

        // Apply permission-based sidebar visibility for non-admin roles
        _applyNavPermissions(user);
    } catch (err) { console.error('Failed to fetch user:', err); window.location.href = '/login'; }
}

// Map permission key → sidebar tab names that require it
const _PERM_TAB_MAP = {
    members:       ['members'],
    beneficiaries: ['beneficiaries', 'families'],
    finance:       ['subscriptions', 'donations'],
    volunteers:    ['volunteers'],
    courses:       ['courses', 'customizer'],
    ramadan:       ['ramadan'],
    settings:      ['settings'],
};

function _applyNavPermissions(user) {
    // Admins and super_users see everything
    if (user.role === 'admin' || user.role === 'super_user') return;

    const userPerms = new Set(user.permissions || []);

    Object.entries(_PERM_TAB_MAP).forEach(([perm, tabs]) => {
        const hasPerm = userPerms.has(perm);
        tabs.forEach(tab => {
            const link = document.querySelector(`[data-tab="${tab}"]`);
            if (link) {
                const li = link.closest('li');
                if (li) li.style.display = hasPerm ? '' : 'none';
            }
        });
    });
}

async function fetchStats() {
    try {
        const res  = await fetch('/api/stats/stats');
        const data = await res.json();
        if (!res.ok) return;

        const s  = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        const lkr = v => `LKR ${Number(v).toLocaleString()}`;

        // Financial
        s('totalDonations', lkr(data.totalDonations));
        s('totalExpenses',  lkr(data.totalExpenses));
        const net    = data.netBalance ?? (data.totalDonations - data.totalExpenses);
        const netEl  = document.getElementById('netFunds');
        if (netEl) {
            netEl.textContent = lkr(net);
            netEl.style.color = net >= 0 ? '#10b981' : '#ef4444';
        }

        // People
        s('memberCount',       data.memberCount);
        s('memberActive',      data.memberActive);
        s('beneficiaryCount',  data.beneficiaryCount);
        s('beneficiaryActive', data.beneficiaryActive);
        s('beneficiaryPending',data.beneficiaryPending);
        s('familyCount',       data.familyCount);
        s('volunteerCount',    data.volunteerCount);

        // Programs
        s('courseCount',  data.courseCount);
        s('courseActive', data.courseActive);

        // Ramadan
        const rdTotal   = data.ramadanTokensTotal || 0;
        const rdCollect = data.ramadanCollected   || 0;
        const rdPct     = rdTotal ? Math.round((rdCollect / rdTotal) * 100) : 0;
        s('ramadanActive',      data.ramadanActive);
        s('ramadanTokensTotal', rdTotal);
        s('ramadanCollected',   rdCollect);
        s('ramadanPending',     data.ramadanPending || 0);
        s('ramadanPct',         rdPct + '%');
        const rdBar = document.getElementById('ramadanProgressBar');
        if (rdBar) rdBar.style.width = rdPct + '%';

        renderRecentTransactions(data.recentTransactions);
    } catch (err) { console.error(err); }
}

function renderRecentTransactions(transactions) {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    tbody.innerHTML = transactions.map(tx => `
        <tr>
            <td style="color:var(--text-muted); font-size:0.85rem;">${tx.description || '—'}</td>
            <td><span style="text-transform:capitalize; font-size:0.85rem;">${tx.category.replace(/_/g, ' ')}</span></td>
            <td style="font-weight:600">LKR ${Number(tx.amount).toLocaleString()}</td>
            <td style="font-size:0.85rem;">${new Date(tx.date).toLocaleDateString()}</td>
            <td><span class="status-badge" style="background:${tx.type === 'income' ? '#d1fae5' : '#fee2e2'}; color:${tx.type === 'income' ? '#065f46' : '#991b1b'};">${tx.type.toUpperCase()}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No transactions found</td></tr>';
    lucide.createIcons();
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction? This only removes the transaction log entry.')) return;
    try {
        const res = await fetch(`/api/stats/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Transaction deleted', 'success');
            fetchStats();
        } else {
            showToast('Failed to delete transaction', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

let currentMembers = []; // Global store for siblings logic
let _memberTypeFilter = 'all';
let _memberStatusFilter = 'all';

async function fetchMembers() {
    try {
        const response = await fetch('/api/edf/members');
        currentMembers = await response.json();

        // Update Sibling Dropdowns
        ['memberSiblingSelect', 'editMemberSiblingSelect'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">None</option>' +
                    currentMembers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('');
            }
        });

        // Update stats cards
        const founders = currentMembers.filter(m => m.member_type === 'founder');
        const executives = currentMembers.filter(m => m.member_type === 'executive');
        const active = currentMembers.filter(m => m.status === 'active');
        document.getElementById('mStatTotal').textContent = currentMembers.length;
        document.getElementById('mStatFounders').textContent = founders.length;
        document.getElementById('mStatExecutives').textContent = executives.length;
        document.getElementById('mStatActive').textContent = active.length;

        filterMembers();
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

function setMemberTypeFilter(type, btn) {
    _memberTypeFilter = type;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMembers();
}

function setMemberStatusFilter(status, btn) {
    _memberStatusFilter = status;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMembers();
}

function filterMembers() {
    const q = (document.getElementById('memberSearchInput')?.value || '').toLowerCase();
    let filtered = currentMembers.filter(m => {
        if (_memberTypeFilter !== 'all' && m.member_type !== _memberTypeFilter) return false;
        if (_memberStatusFilter !== 'all' && m.status !== _memberStatusFilter) return false;
        if (q && !(
            m.full_name.toLowerCase().includes(q) ||
            (m.phone || '').toLowerCase().includes(q) ||
            (m.city || '').toLowerCase().includes(q) ||
            (m.nic_number || '').toLowerCase().includes(q)
        )) return false;
        return true;
    });

    const countEl = document.getElementById('membersFilterCount');
    if (countEl) countEl.textContent = filtered.length < currentMembers.length
        ? `Showing ${filtered.length} of ${currentMembers.length}`
        : `${currentMembers.length} member${currentMembers.length !== 1 ? 's' : ''}`;

    const memberTypeBadge = (type) => type === 'founder'
        ? `<span class="status-badge" style="background:#fef3c7;color:#92400e;">Founder</span>`
        : `<span class="status-badge" style="background:#e0e7ff;color:#3730a3;">Executive</span>`;

    const formatJoinDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

    const tbody = document.getElementById('membersBody');
    tbody.innerHTML = filtered.map(m => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div class="logo" style="width:34px; height:34px; margin:0; font-size:0.85rem; border-radius:10px; flex-shrink:0;">${m.full_name.charAt(0)}</div>
                    <div>
                        <div style="font-weight:600; line-height:1.3;">${m.full_name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${m.email || ''}</div>
                    </div>
                </div>
            </td>
            <td>${memberTypeBadge(m.member_type)}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${m.phone || '—'}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${m.city || '—'}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${formatJoinDate(m.join_date)}</td>
            <td style="font-weight:600;">LKR ${(m.monthly_subscription || 0).toLocaleString()}</td>
            <td><span class="status-badge status-${m.status}">${m.status === 'deactivate' ? 'Inactive' : 'Active'}</span></td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openMemberHistory(${m.id})" title="Payment History"><i data-lucide="history" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="viewMember(${m.id})" title="View"><i data-lucide="eye" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="editMember(${m.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteMember(${m.id})" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No members found</td></tr>`;
    lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER PAYMENT HISTORY
// ═══════════════════════════════════════════════════════════════════════════

let _pmhData = null; // { member, subscriptions, summary }

async function openMemberHistory(memberId) {
    _pmhData = null;
    openModal('memberHistoryModal');
    document.getElementById('pmhLoading').style.display = 'flex';
    document.getElementById('pmhContent').style.display = 'none';

    try {
        const res = await fetch(`/api/edf/members/${memberId}/payment-history`);
        if (!res.ok) { showToast('Failed to load payment history', 'error'); closeModal('memberHistoryModal'); return; }
        _pmhData = await res.json();

        // Reset controls
        document.getElementById('pmhSearch').value   = '';
        document.getElementById('pmhYearFilter').value = '';
        document.getElementById('pmhSort').value      = 'newest';

        _pmhRenderHeader();
        _pmhRenderStats();
        _pmhPopulateYears();
        _pmhRenderTable();

        document.getElementById('pmhLoading').style.display = 'none';
        document.getElementById('pmhContent').style.display = 'block';
    } catch (err) {
        showToast('Network error loading history', 'error');
        closeModal('memberHistoryModal');
    }
}

function _pmhFmt(n) {
    return `LKR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function _pmhFmtDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _pmhMonthLabel(m) {
    // m = "YYYY-MM"
    if (!m) return '—';
    const [y, mo] = m.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(mo) - 1]} ${y}`;
}

function _pmhRenderHeader() {
    const { member } = _pmhData;
    const initials = (member.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const typeColor = member.member_type === 'founder' ? '#92400e' : '#3730a3';
    const typeBg    = member.member_type === 'founder' ? '#fef3c7' : '#e0e7ff';
    const typeLabel = member.member_type === 'founder' ? 'Founder' : 'Executive';
    const statusColor = member.status === 'active' ? '#059669' : '#dc2626';

    document.getElementById('pmhAvatar').textContent   = initials;
    document.getElementById('pmhMemberName').textContent = member.full_name;
    document.getElementById('pmhTypeBadge').textContent = typeLabel;
    document.getElementById('pmhTypeBadge').style.cssText = `background:${typeBg};color:${typeColor};padding:0.2rem 0.75rem;border-radius:99px;font-size:0.72rem;font-weight:700;letter-spacing:0.05em;`;
    document.getElementById('pmhStatusDot').style.background = statusColor;
    document.getElementById('pmhStatusText').textContent = member.status === 'active' ? 'Active' : 'Inactive';
    document.getElementById('pmhJoinDate').textContent   = _pmhFmtDate(member.join_date);
    document.getElementById('pmhMonthlyAmt').textContent = _pmhFmt(member.monthly_subscription);
    document.getElementById('pmhEmail').textContent      = member.email || '—';
}

function _pmhRenderStats() {
    const { summary } = _pmhData;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('pmhStatTotal',   _pmhFmt(summary.total_paid));
    s('pmhStatCount',   `${summary.months_count} payment${summary.months_count !== 1 ? 's' : ''}`);
    s('pmhStatAvg',     _pmhFmt(summary.avg_payment));
    s('pmhStatLast',    summary.latest_payment ? _pmhFmtDate(summary.latest_payment) : 'Never');
    s('pmhStatFirst',   summary.first_payment  ? _pmhFmtDate(summary.first_payment)  : '—');
}

function _pmhPopulateYears() {
    const years = [...new Set((_pmhData.subscriptions || []).map(s => s.month.split('-')[0]))].sort().reverse();
    const sel = document.getElementById('pmhYearFilter');
    const cur = sel.value;
    sel.innerHTML = `<option value="">All Years</option>` +
        years.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}</option>`).join('');
}

function _pmhGetFiltered() {
    const q    = (document.getElementById('pmhSearch')?.value || '').toLowerCase().trim();
    const year = document.getElementById('pmhYearFilter')?.value || '';
    const sort = document.getElementById('pmhSort')?.value || 'newest';

    let rows = [...(_pmhData?.subscriptions || [])];

    if (q)    rows = rows.filter(s => s.month.includes(q) || _pmhMonthLabel(s.month).toLowerCase().includes(q));
    if (year) rows = rows.filter(s => s.month.startsWith(year));

    if (sort === 'newest')      rows.sort((a, b) => b.month.localeCompare(a.month));
    else if (sort === 'oldest') rows.sort((a, b) => a.month.localeCompare(b.month));
    else if (sort === 'high')   rows.sort((a, b) => b.amount - a.amount);
    else if (sort === 'low')    rows.sort((a, b) => a.amount - b.amount);

    return rows;
}

function _pmhRenderTable() {
    if (!_pmhData) return;
    const rows   = _pmhGetFiltered();
    const tbody  = document.getElementById('pmhTableBody');
    const counter = document.getElementById('pmhRowCount');
    if (counter) counter.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="pmh-empty-row"><i data-lucide="inbox" style="width:32px;height:32px;opacity:0.3;"></i><div>No payments found</div></td></tr>`;
        lucide.createIcons();
        return;
    }

    const expected = _pmhData.member.monthly_subscription || 0;

    tbody.innerHTML = rows.map((s, i) => {
        const diff      = s.amount - expected;
        const diffLabel = expected > 0
            ? (diff > 0 ? `<span class="pmh-diff pos">+${_pmhFmt(diff)}</span>` :
               diff < 0 ? `<span class="pmh-diff neg">${_pmhFmt(diff)}</span>` :
               `<span class="pmh-diff eq">Exact</span>`)
            : '';
        const payDate = _pmhFmtDate(s.payment_date);

        return `<tr class="pmh-tr" style="animation-delay:${i * 0.03}s">
            <td class="pmh-td pmh-td-month">
                <span class="pmh-month-pill">${_pmhMonthLabel(s.month)}</span>
            </td>
            <td class="pmh-td pmh-td-amount">
                <span class="pmh-amount">${_pmhFmt(s.amount)}</span>
                ${diffLabel}
            </td>
            <td class="pmh-td pmh-td-date">
                <i data-lucide="calendar-check" style="width:13px;height:13px;opacity:0.5;flex-shrink:0;"></i>
                <span>${payDate}</span>
            </td>
            <td class="pmh-td pmh-td-status">
                <span class="pmh-paid-badge"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Paid</span>
            </td>
        </tr>`;
    }).join('');

    lucide.createIcons();
}

function pmhFilterChanged() { _pmhRenderTable(); }

function pmhExportCSV() {
    if (!_pmhData) return;
    const rows = _pmhGetFiltered();
    const { member } = _pmhData;
    const headers = ['Month', 'Amount (LKR)', 'Payment Date', 'Expected (LKR)', 'Variance (LKR)'];
    const exp = member.monthly_subscription || 0;
    const csvRows = rows.map(s => [
        _pmhMonthLabel(s.month),
        s.amount.toFixed(2),
        _pmhFmtDate(s.payment_date),
        exp.toFixed(2),
        (s.amount - exp).toFixed(2),
    ]);
    const bom = '\uFEFF';
    const csv = bom + [headers, ...csvRows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${member.full_name.replace(/\s+/g, '_')}_payments.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function viewMember(id) {
    const m = currentMembers.find(mem => mem.id === id);
    if (!m) return;

    document.getElementById('viewMemberName').textContent = m.full_name;
    document.getElementById('viewMemberInitial').textContent = m.full_name.charAt(0);
    const badge = document.getElementById('viewMemberBadge');
    badge.textContent = m.status === 'deactivate' ? 'Inactive' : 'Active';
    badge.className = `status-badge status-${m.status}`;
    const typeEl = document.getElementById('viewMemberType');
    if (typeEl) typeEl.textContent = m.member_type === 'founder' ? '· Founder' : '· Executive Member';

    const sibling = currentMembers.find(s => s.id === m.sibling_id);
    const fmt = v => v != null && v !== '' ? v : 'N/A';
    const fmtLKR = v => v != null ? `LKR ${Number(v).toLocaleString()}` : 'N/A';
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';

    const detailItem = (label, value) => `
        <div class="detail-item">
            <div class="detail-label">${label}</div>
            <div class="detail-value">${value}</div>
        </div>`;

    document.getElementById('memberDetailsDisplay').innerHTML = [
        detailItem('NIC Number', fmt(m.nic_number)),
        detailItem('Gender', fmt(m.gender)),
        detailItem('Age', fmt(m.age)),
        detailItem('Marital Status', fmt(m.marital_status)),
        detailItem('Blood Group', fmt(m.blood_group)),
        detailItem('Phone', fmt(m.phone)),
        detailItem('Email', fmt(m.email)),
        detailItem('City', fmt(m.city)),
        detailItem('Occupation', fmt(m.occupation)),
        detailItem('Address', fmt(m.address)),
        detailItem('Join Date', fmtDate(m.join_date)),
    ].join('');

    document.getElementById('memberFinancialDisplay').innerHTML = [
        detailItem('Member Type', m.member_type === 'founder' ? 'Founder' : 'Executive'),
        detailItem('Monthly Subscription', fmtLKR(m.monthly_subscription)),
        detailItem('Monthly Income', fmtLKR(m.monthly_income)),
        detailItem('Previous Balance', fmtLKR(m.previous_balance)),
        detailItem('Bank Name', fmt(m.bank_name)),
        detailItem('Bank Branch', fmt(m.bank_branch)),
        detailItem('Account Number', fmt(m.account_number)),
        detailItem('Linked Member', sibling ? sibling.full_name : 'None'),
    ].join('');

    // Reset to first view tab
    const viewModal = document.getElementById('viewMemberModal');
    viewModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    viewModal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    viewModal.querySelector('[data-modal-tab="view-tab-info"]').classList.add('active');
    document.getElementById('view-tab-info').classList.add('active');

    document.querySelector('#relativeForm [name="member_id"]').value = id;
    fetchRelatives(id);

    document.getElementById('editFromViewBtn').onclick = () => {
        closeModal('viewMemberModal');
        editMember(id);
    };

    openModal('viewMemberModal');
    lucide.createIcons();
}

async function deleteMember(id) {
    const m = currentMembers.find(mem => mem.id === id);
    const name = m ? m.full_name : 'this member';
    if (!confirm(`Delete ${name}? This will also remove all associated family records.`)) return;
    try {
        const res = await fetch(`/api/edf/members/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`${name} removed successfully`, 'success');
            fetchMembers();
        } else {
            showToast('Failed to delete member', 'error');
        }
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Network error while deleting', 'error');
    }
}

async function fetchRelatives(memberId) {
    const res = await fetch(`/api/edf/members/${memberId}/relatives`);
    const data = await res.json();
    const list = document.getElementById('relativesList');

    list.innerHTML = data.map(r => `
        <div class="relative-card">
            <div class="relative-info">
                <div class="relative-name">${r.full_name}</div>
                <div class="relative-meta">
                    <span style="text-transform:capitalize">${r.relationship}</span> • 
                    Age: ${r.age || 'N/A'} • 
                    NIC: ${r.nic_number || 'N/A'} • 
                    ${r.occupation || 'No Job info'}
                </div>
            </div>
            <button class="btn" onclick="deleteRelative(${r.id}, ${memberId})" style="color:#ef4444; padding:0.25rem;"><i data-lucide="trash-2" style="width:16px;"></i></button>
        </div>
    `).join('') || '<div style="color:var(--text-muted); font-size:0.875rem;">No family details added yet.</div>';
    lucide.createIcons();
}

async function deleteRelative(id, memberId) {
    if (!confirm('Remove this dependent?')) return;
    const res = await fetch(`/api/edf/relatives/${id}`, { method: 'DELETE' });
    if (res.ok) {
        fetchRelatives(memberId);
        showToast('Dependent removed', 'success');
    }
}

// Relative Form — Add dependent from View Modal
document.getElementById('relativeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const memberId = form.elements['member_id'].value;
    if (!memberId) return;
    const data = {
        full_name: form.elements['full_name'].value.trim(),
        relationship: form.elements['relationship'].value,
        age: form.elements['age'].value || null
    };
    if (!data.full_name) return;
    try {
        const res = await fetch(`/api/edf/members/${memberId}/relatives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            form.elements['full_name'].value = '';
            form.elements['age'].value = '';
            fetchRelatives(memberId);
            showToast('Dependent added', 'success');
        } else {
            showToast('Failed to add dependent', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error', 'error');
    }
});

// Dynamic Relative Rows for Member Modal
function addRelativeRow(data = {}) {
    const container = document.getElementById('relativesContainer');
    const rowId = `row-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const div = document.createElement('div');
    div.className = 'relative-entry';
    div.id = rowId;
    div.innerHTML = `
        <div class="form-group" style="margin:0;">
            <label class="form-label">Full Name</label>
            <input type="text" name="rel_name" class="form-input" value="${data.full_name || ''}" placeholder="Name">
        </div>
        <div class="form-group" style="margin:0;">
            <label class="form-label">Relation</label>
            <select name="rel_type" class="form-select">
                <option value="wife" ${data.relationship === 'wife' ? 'selected' : ''}>Wife</option>
                <option value="son" ${data.relationship === 'son' ? 'selected' : ''}>Son</option>
                <option value="daughter" ${data.relationship === 'daughter' ? 'selected' : ''}>Daughter</option>
                <option value="other" ${data.relationship === 'other' ? 'selected' : ''}>Other</option>
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label class="form-label">Occupation</label>
            <input type="text" name="rel_occupation" class="form-input" value="${data.occupation || ''}" placeholder="Occupation">
        </div>
        <div class="form-group" style="margin:0;">
            <label class="form-label">Age</label>
            <input type="number" name="rel_age" class="form-input" value="${data.age || ''}" placeholder="Age">
        </div>
        <div class="form-group" style="margin:0;">
            <label class="form-label">NIC / ID</label>
            <input type="text" name="rel_nic" class="form-input" value="${data.nic_number || ''}" placeholder="ID">
        </div>
        <button type="button" class="btn" onclick="document.getElementById('${rowId}').remove()" style="background:#fee2e2; color:#ef4444; padding:0.6rem; border-radius:12px; align-self:end;">
            <i data-lucide="minus-circle" style="width:18px;"></i>
        </button>
    `;
    container.appendChild(div);
    lucide.createIcons();
}

document.getElementById('addRelativeRowBtn').addEventListener('click', () => addRelativeRow());

function openAddMemberModal() {
    const form = document.getElementById('memberForm');
    if (form) form.elements['id'].value = '';
    openModal('memberModal');
}

async function editMember(id) {
    const m = currentMembers.find(mem => mem.id === id);
    if (!m) return;

    document.getElementById('memberModalTitle').textContent = 'Edit Member Profile';
    const form = document.getElementById('memberForm');
    form.reset();
    form.elements['id'].value = id;

    // Reset Tabs
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-modal-tab="tab-general"]').classList.add('active');
    document.getElementById('tab-general').classList.add('active');

    // Reset Relatives
    document.getElementById('relativesContainer').innerHTML = '';

    // Auto-fill inputs
    Object.keys(m).forEach(key => {
        const input = form.elements[key];
        if (input) input.value = m[key] || '';
    });

    // Load Relatives from API for editing
    const res = await fetch(`/api/edf/members/${id}/relatives`);
    const relatives = await res.json();
    relatives.forEach(r => addRelativeRow(r));

    // Bypass the openModal override (which would reset the form for "Add New")
    originalOpenModal('memberModal');
    lucide.createIcons();
}

// Override original openModal to reset form for ADD
const originalOpenModal = openModal;
window.openModal = function (id) {
    if (id === 'memberModal') {
        document.getElementById('memberModalTitle').textContent = 'Add New Member';
        const form = document.getElementById('memberForm');
        form.reset();
        form.elements['id'].value = '';
        document.getElementById('relativesContainer').innerHTML = '';

        // Reset Tabs
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-modal-tab="tab-general"]').classList.add('active');
        document.getElementById('tab-general').classList.add('active');

        // Add one empty relative row by default
        addRelativeRow();
    }
    if (id === 'beneficiaryModal') {
        // goToWizardStep is called by openAddBeneficiaryModal / editBeneficiary before reaching here
        // just ensure we're always on step 1 if opened via override without explicit call
        const form = document.getElementById('beneficiaryForm');
        if (!form.elements['id'].value) goToWizardStep(0);
    }
    originalOpenModal(id);
    lucide.createIcons();
};

async function populateBeneficiaryCategorySelect() {
    try {
        const res = await fetch('/api/edf/beneficiary-categories');
        const categories = await res.json();
        const select = document.getElementById('beneficiaryCategorySelect');
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Category</option>' +
            categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (currentValue) select.value = currentValue;
    } catch (err) { console.error(err); }
}

// Handle Member Form Submit
document.getElementById('memberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const memberId = data.id;

    // Collect Relatives
    const relatives = [];
    document.getElementById('relativesContainer').querySelectorAll('.relative-entry').forEach(row => {
        const name = (row.querySelector('[name="rel_name"]')?.value || '').trim();
        if (name) {
            relatives.push({
                full_name: name,
                relationship: row.querySelector('[name="rel_type"]')?.value || 'other',
                occupation: row.querySelector('[name="rel_occupation"]')?.value || '',
                age: row.querySelector('[name="rel_age"]')?.value || null,
                nic_number: row.querySelector('[name="rel_nic"]')?.value || ''
            });
        }
    });
    data.relatives = relatives;

    const method = memberId ? 'PUT' : 'POST';
    const url = memberId ? `/api/edf/members/${memberId}` : '/api/edf/members';
    const saveBtn = document.getElementById('saveMemberBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal('memberModal');
            fetchMembers();
            fetchStats();
            showToast(memberId ? 'Member updated successfully' : 'New member added', 'success');
        } else {
            const err = await res.json();
            showToast(`Error: ${err.message || 'Save failed'}`, 'error');
        }
    } catch (err) {
        console.error('Save failed:', err);
        showToast('Network error — please try again', 'error');
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i data-lucide="check-circle"></i> Save Member Profile'; lucide.createIcons(); }
    }
});

// ────────────────────────────────────────────────────────
// SUBSCRIPTIONS MANAGEMENT
// ────────────────────────────────────────────────────────
let subMembersData = [];     // all members for the selected month
let subData = [];            // merged view rows (member + subscription status)
let _subStatusFilter = 'all';
let _subTypeFilter   = 'all';
let _currentEditSubId = null; // tracks which subscription we're editing

function _currentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchSubscriptions() {
    const picker = document.getElementById('subMonthPicker');
    if (!picker.value) picker.value = _currentYearMonth();
    const month = picker.value;

    try {
        const res = await fetch(`/api/edf/subscriptions/monthly-status?month=${month}`);
        const json = await res.json();
        subMembersData = json.members || [];

        // Build merged rows
        subData = subMembersData.map(m => {
            const hasSubscription = m.monthly_subscription > 0;
            const rec = m.subscription_record;
            let payStatus = 'exempt';
            if (hasSubscription) {
                if (!rec) {
                    payStatus = 'pending';
                } else {
                    const paidAmt = rec.paid_amount != null ? rec.paid_amount : rec.amount;
                    payStatus = paidAmt >= rec.amount ? 'paid' : 'partial';
                }
            }
            return { ...m, payStatus, rec };
        });

        updateSubStats();
        filterSubscriptions();
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

function updateSubStats() {
    const subscribing = subData.filter(r => r.payStatus !== 'exempt');
    const paid        = subData.filter(r => r.payStatus === 'paid');
    const partial     = subData.filter(r => r.payStatus === 'partial');
    const pending     = subData.filter(r => r.payStatus === 'pending');
    const exempt      = subData.filter(r => r.payStatus === 'exempt');
    const collected   = [...paid, ...partial].reduce((sum, r) => sum + (r.rec?.paid_amount || r.rec?.amount || 0), 0);

    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('sStatTotal',     subscribing.length);
    s('sStatCollected', `LKR ${collected.toLocaleString()}`);
    s('sStatPending',   pending.length + partial.length);
    s('sStatExempt',    exempt.length);
}

function setSubStatusFilter(status, btn) {
    _subStatusFilter = status;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterSubscriptions();
}

function setSubTypeFilter(type, btn) {
    _subTypeFilter = type;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterSubscriptions();
}

function filterSubscriptions() {
    const q    = (document.getElementById('subSearchInput')?.value || '').toLowerCase();
    const sort = document.getElementById('subSortSelect')?.value || 'name';

    let filtered = subData.filter(r => {
        if (_subStatusFilter !== 'all' && r.payStatus !== _subStatusFilter) return false;
        if (_subTypeFilter !== 'all' && r.member_type !== _subTypeFilter) return false;
        if (q && !r.full_name.toLowerCase().includes(q)) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        if (sort === 'name')        return a.full_name.localeCompare(b.full_name);
        if (sort === 'amount_desc') return (b.monthly_subscription || 0) - (a.monthly_subscription || 0);
        if (sort === 'amount_asc')  return (a.monthly_subscription || 0) - (b.monthly_subscription || 0);
        if (sort === 'date_desc') {
            const da = a.rec?.payment_date || '';
            const db2 = b.rec?.payment_date || '';
            return db2.localeCompare(da);
        }
        return 0;
    });

    const countEl = document.getElementById('subFilterCount');
    if (countEl) countEl.textContent = filtered.length < subData.length
        ? `Showing ${filtered.length} of ${subData.length}`
        : `${subData.length} member${subData.length !== 1 ? 's' : ''}`;

    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const fmtMonth = m => {
        if (!m) return '—';
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-GB', { month:'short', year:'numeric' });
    };
    const typeBadge = t => t === 'founder'
        ? `<span class="status-badge" style="background:#fef3c7;color:#92400e;">Founder</span>`
        : `<span class="status-badge" style="background:#e0e7ff;color:#3730a3;">Executive</span>`;

    const payMethodLabel = m => {
        const map = { cash:'Cash', cheque:'Cheque', bank_transfer:'Bank Transfer', online:'Online', other:'Other' };
        return map[m] || (m || '—');
    };
    const payMethodBadge = m => {
        const colors = {
            cash: 'background:#dcfce7;color:#166534;',
            cheque: 'background:#e0f2fe;color:#075985;',
            bank_transfer: 'background:#ede9fe;color:#5b21b6;',
            online: 'background:#fef9c3;color:#854d0e;',
            other: 'background:#f3f4f6;color:#374151;'
        };
        return `<span class="status-badge" style="${colors[m] || colors.other}">${payMethodLabel(m)}</span>`;
    };

    const statusBadge = (s, rec) => {
        if (s === 'paid')    return `<span class="status-badge status-active">Paid</span>`;
        if (s === 'partial') {
            const paid = rec?.paid_amount || 0;
            const due = rec?.amount || 0;
            const pct = due > 0 ? Math.round((paid/due)*100) : 0;
            return `<span class="status-badge" style="background:#fef3c7;color:#92400e;">Partial (${pct}%)</span>`;
        }
        if (s === 'pending') return `<span class="status-badge" style="background:#fef3c7;color:#92400e;">Pending</span>`;
        return `<span class="status-badge" style="background:#f3f4f6;color:#6b7280;">Exempt</span>`;
    };

    const picker = document.getElementById('subMonthPicker');
    const selectedMonth = picker?.value || _currentYearMonth();

    const tbody = document.getElementById('subBody');
    tbody.innerHTML = filtered.map(r => {
        const amountDisplay = r.monthly_subscription > 0
            ? `LKR ${Number(r.monthly_subscription).toLocaleString()}`
            : '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>';

        const paidDisplay = r.rec
            ? `LKR ${Number(r.rec.paid_amount != null ? r.rec.paid_amount : r.rec.amount).toLocaleString()}`
            : '—';

        let actions;
        if (r.payStatus === 'exempt') {
            actions = `<span style="color:var(--text-muted); font-size:0.8rem;">No subscription</span>`;
        } else if (r.payStatus === 'paid' || r.payStatus === 'partial') {
            actions = `
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openSubModal('edit',${r.rec.id})" title="Edit">
                    <i data-lucide="edit-2" style="width:15px;"></i>
                </button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#e0f2fe; color:#0369a1;" onclick="openAddPaymentModalForSub(${r.rec.id})" title="Add Instalment">
                    <i data-lucide="plus-circle" style="width:15px;"></i>
                </button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteSubscription(${r.rec.id})" title="Delete">
                    <i data-lucide="trash-2" style="width:15px;"></i>
                </button>`;
        } else {
            actions = `<button class="btn btn-primary" style="padding:0.4rem 0.75rem; font-size:0.8rem;" onclick="openSubModal('add',null,${r.id},'${selectedMonth}')"><i data-lucide="plus" style="width:14px;"></i> Pay</button>`;
        }

        return `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div class="logo" style="width:32px;height:32px;margin:0;font-size:0.8rem;border-radius:9px;flex-shrink:0;">${r.full_name.charAt(0)}</div>
                    <span style="font-weight:600;">${r.full_name}</span>
                </div>
            </td>
            <td>${typeBadge(r.member_type)}</td>
            <td style="font-weight:600;">${amountDisplay}</td>
            <td style="font-weight:600; color:var(--text-main);">${paidDisplay}</td>
            <td>${r.rec ? payMethodBadge(r.rec.payment_method) : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td>${statusBadge(r.payStatus, r.rec)}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${r.rec ? fmtDate(r.rec.payment_date) : '—'}</td>
            <td style="text-align:right; white-space:nowrap;">${actions}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No records found</td></tr>`;
    lucide.createIcons();
}

// Payment method pill selection
function setSubPayMethod(method, btn) {
    btn.closest('div').querySelectorAll('.sub-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('subPayMethodInput').value = method;
}

function setAddPayMethod(method, btn) {
    btn.closest('div').querySelectorAll('.sub-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('addPayMethodInput').value = method;
}

function onSubAdvanceToggle(cb) {
    // Visual hint when advance is checked
    const monthEl = document.getElementById('subMonthInput');
    if (cb.checked) {
        monthEl.style.borderColor = 'var(--primary)';
    } else {
        monthEl.style.borderColor = '';
    }
}

function _renderSubPayHistory(payments) {
    const list = document.getElementById('subPayHistoryList');
    if (!payments || payments.length === 0) {
        list.innerHTML = '<div style="font-size:0.82rem; color:var(--text-muted);">No instalments recorded.</div>';
        return;
    }
    const methodLabel = { cash:'Cash', cheque:'Cheque', bank_transfer:'Bank Transfer', online:'Online', other:'Other' };
    list.innerHTML = payments.map(p => {
        const dt = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; font-size:0.82rem;">
            <span style="font-weight:600;">LKR ${Number(p.amount).toLocaleString()}</span>
            <span style="color:var(--text-muted);">${methodLabel[p.payment_method] || p.payment_method || 'Cash'}</span>
            ${p.reference_number ? `<span style="color:var(--text-muted); font-family:monospace;">#${p.reference_number}</span>` : ''}
            <span style="color:var(--text-muted);">${dt}</span>
            <button type="button" onclick="deleteSubPayment(${p.id})" style="border:none;background:none;color:#ef4444;cursor:pointer;padding:0 4px;">
                <i data-lucide="x" style="width:13px;"></i>
            </button>
        </div>`;
    }).join('');
    lucide.createIcons();
}

async function deleteSubPayment(payId) {
    if (!confirm('Remove this payment instalment?')) return;
    try {
        const res = await fetch(`/api/edf/subscriptions/${_currentEditSubId}/payments/${payId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Payment removed', 'success');
            // Reload history
            const hRes = await fetch(`/api/edf/subscriptions/${_currentEditSubId}/payments`);
            const hData = await hRes.json();
            _renderSubPayHistory(hData);
            fetchSubscriptions();
        } else {
            showToast('Delete failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

function openSubModal(mode, subId = null, memberId = null, month = null) {
    const form = document.getElementById('subForm');
    form.reset();
    document.getElementById('subRecordId').value = '';
    document.getElementById('subModalTitle').textContent = mode === 'edit' ? 'Edit Payment' : 'Record Payment';
    document.getElementById('subSaveBtn').innerHTML = '<i data-lucide="check-circle"></i> Save Payment';
    document.getElementById('subMemberNote').style.display = 'none';
    document.getElementById('subPayHistorySection').style.display = 'none';
    document.getElementById('subPayHistoryList').innerHTML = '';
    document.getElementById('subAdvanceToggle').checked = false;
    document.getElementById('subMonthInput').style.borderColor = '';
    _currentEditSubId = null;

    // Reset method buttons
    document.querySelectorAll('#subForm .sub-method-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#subForm .sub-method-btn[data-method="cash"]')?.classList.add('active');
    document.getElementById('subPayMethodInput').value = 'cash';

    // Populate member dropdown
    const sel = document.getElementById('subMemberSelect');
    const memberList = mode === 'add'
        ? subMembersData.filter(m => m.monthly_subscription > 0)
        : subMembersData;
    sel.innerHTML = '<option value="">Select member…</option>' +
        memberList.map(m => `<option value="${m.id}" data-amount="${m.monthly_subscription}">${m.full_name}</option>`).join('');

    const picker = document.getElementById('subMonthPicker');
    const defaultMonth = month || picker?.value || _currentYearMonth();

    if (mode === 'edit' && subId) {
        const row = subData.find(r => r.rec && r.rec.id === subId);
        if (!row) return;
        _currentEditSubId = subId;
        sel.value = row.id;
        sel.disabled = true;
        document.getElementById('subMonthInput').value = row.rec.month;
        document.getElementById('subAmountInput').value = row.rec.amount;
        document.getElementById('subPaidAmountInput').value = row.rec.paid_amount != null ? row.rec.paid_amount : row.rec.amount;
        document.getElementById('subRefInput').value = row.rec.reference_number || '';
        document.getElementById('subNotesInput').value = row.rec.notes || '';
        document.getElementById('subRecordId').value = subId;
        if (row.rec.is_advance) document.getElementById('subAdvanceToggle').checked = true;
        // Set method button
        const method = row.rec.payment_method || 'cash';
        document.querySelectorAll('#subForm .sub-method-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#subForm .sub-method-btn[data-method="${method}"]`)?.classList.add('active');
        document.getElementById('subPayMethodInput').value = method;
        _showSubMemberNote(row);
        // Show payment history
        if (row.rec.payments && row.rec.payments.length > 0) {
            document.getElementById('subPayHistorySection').style.display = 'block';
            _renderSubPayHistory(row.rec.payments);
        }
    } else {
        sel.disabled = false;
        document.getElementById('subMonthInput').value = defaultMonth;
        if (memberId) {
            sel.value = memberId;
            const m = subMembersData.find(x => x.id === memberId);
            if (m) {
                document.getElementById('subAmountInput').value = m.monthly_subscription || '';
                _showSubMemberNote(m);
            }
        }
    }

    openModal('subModal');
    lucide.createIcons();
}

function openAddPaymentModalForSub(subId) {
    _currentEditSubId = subId;
    openAddPaymentModal();
}

function openAddPaymentModal() {
    if (!_currentEditSubId) { showToast('No subscription selected', 'error'); return; }
    document.getElementById('addPaySubId').value = _currentEditSubId;
    document.getElementById('addPaymentForm').reset();
    // Default today for payment date
    const todayInput = document.querySelector('#addPaymentForm [name="payment_date"]');
    if (todayInput) todayInput.value = new Date().toISOString().slice(0,10);
    // Reset method buttons
    document.querySelectorAll('#addPaymentForm .sub-method-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#addPaymentForm .sub-method-btn[data-method="cash"]')?.classList.add('active');
    document.getElementById('addPayMethodInput').value = 'cash';
    openModal('addPaymentModal');
    lucide.createIcons();
}

async function saveExtraPayment(e) {
    e.preventDefault();
    const form = e.target;
    const subId = document.getElementById('addPaySubId').value;
    const payload = {
        amount: parseFloat(form.amount.value),
        payment_method: document.getElementById('addPayMethodInput').value,
        reference_number: form.reference_number.value || null,
        notes: form.notes.value || null,
        payment_date: form.payment_date.value || null,
    };
    try {
        const res = await fetch(`/api/edf/subscriptions/${subId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok) {
            closeModal('addPaymentModal');
            showToast('Instalment added', 'success');
            // Refresh history in parent modal if open
            const hRes = await fetch(`/api/edf/subscriptions/${subId}/payments`);
            const hData = await hRes.json();
            document.getElementById('subPayHistorySection').style.display = 'block';
            _renderSubPayHistory(hData);
            fetchSubscriptions();
            fetchStats();
        } else {
            showToast(json.message || 'Failed to add payment', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

function onSubMemberChange(sel) {
    const opt = sel.selectedOptions[0];
    const amount = opt?.getAttribute('data-amount') || '';
    document.getElementById('subAmountInput').value = amount || '';
    const memberId = parseInt(sel.value);
    const m = subMembersData.find(x => x.id === memberId);
    if (m) _showSubMemberNote(m); else document.getElementById('subMemberNote').style.display = 'none';
}

function _showSubMemberNote(m) {
    const note = document.getElementById('subMemberNote');
    const noteText = document.getElementById('subMemberNoteText');
    if (!m) { note.style.display = 'none'; return; }
    const sub = m.monthly_subscription || (m.rec?.amount);
    noteText.textContent = sub > 0
        ? `Standard monthly subscription: LKR ${Number(sub).toLocaleString()}`
        : 'This member has no monthly subscription amount set.';
    note.style.display = 'flex';
    note.style.gap = '0.5rem';
    note.style.alignItems = 'center';
}

async function saveSubscription(e) {
    e.preventDefault();
    const form = e.target;
    const subId = document.getElementById('subRecordId').value;
    const paidAmountVal = document.getElementById('subPaidAmountInput').value;
    const payload = {
        member_id: parseInt(form.member_id.value),
        month: form.month.value,
        amount: parseFloat(form.amount.value),
        paid_amount: paidAmountVal ? parseFloat(paidAmountVal) : null,
        payment_method: document.getElementById('subPayMethodInput').value || 'cash',
        notes: document.getElementById('subNotesInput').value || null,
        is_advance: document.getElementById('subAdvanceToggle').checked ? 1 : 0,
        reference_number: document.getElementById('subRefInput').value || null,
    };

    const method = subId ? 'PUT' : 'POST';
    const url = subId ? `/api/edf/subscriptions/${subId}` : '/api/edf/subscriptions';
    const btn = document.getElementById('subSaveBtn');
    btn.disabled = true;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok) {
            closeModal('subModal');
            fetchSubscriptions();
            fetchStats();
            showToast(subId ? 'Payment updated' : 'Payment recorded', 'success');
        } else {
            showToast(json.message || 'Save failed', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle"></i> Save Payment';
        lucide.createIcons();
    }
}

async function deleteSubscription(id) {
    if (!confirm('Delete this subscription payment? The linked transaction will also be removed.')) return;
    try {
        const res = await fetch(`/api/edf/subscriptions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Payment deleted', 'success');
            fetchSubscriptions();
            fetchStats();
        } else {
            const json = await res.json();
            showToast(json.message || 'Delete failed', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error', 'error');
    }
}

// ────────────────────────────────────────────────────────

// BENEFICIARIES LOGIC
let currentBeneficiaries = [];
let _benStatusFilter = 'all';

async function fetchBeneficiaries() {
    try {
        const res = await fetch('/api/edf/beneficiaries');
        currentBeneficiaries = await res.json();

        // Update stats
        const active   = currentBeneficiaries.filter(b => b.status === 'Active').length;
        const pending  = currentBeneficiaries.filter(b => b.status === 'pending').length;
        const rejected = currentBeneficiaries.filter(b => b.status === 'rejected').length;
        document.getElementById('bStatTotal').textContent   = currentBeneficiaries.length;
        document.getElementById('bStatActive').textContent  = active;
        document.getElementById('bStatPending').textContent = pending;
        document.getElementById('bStatRejected').textContent = rejected;

        filterBeneficiaries();
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

let _benCategoryFilter = 'all';
let _benSortKey = 'created_at';
let _benSortDir = 'desc';
let _benPage     = 1;
let _benPageSize = 15;

function setBenStatusFilter(status, btn) {
    _benStatusFilter = status;
    _benPage = 1;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterBeneficiaries();
}

function setBenCategoryFilter(val) {
    _benCategoryFilter = val;
    _benPage = 1;
    filterBeneficiaries();
}

function sortBeneficiaries(key) {
    if (_benSortKey === key) {
        _benSortDir = _benSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _benSortKey = key;
        _benSortDir = 'asc';
    }
    _benPage = 1;
    filterBeneficiaries();
}

async function populateBenCategoryFilter() {
    try {
        const cats = await (await fetch('/api/edf/beneficiary-categories')).json();
        const sel = document.getElementById('benCategoryFilter');
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="all">All Categories</option>' +
            cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (cur) sel.value = cur;
    } catch (_) {}
}

function filterBeneficiaries() {
    const q = (document.getElementById('benSearchInput')?.value || '').toLowerCase();

    let filtered = currentBeneficiaries.filter(b => {
        if (_benStatusFilter !== 'all' && b.status !== _benStatusFilter) return false;
        if (_benCategoryFilter !== 'all' && (b.category || '') !== _benCategoryFilter) return false;
        if (q && !(
            (b.male_head_name || '').toLowerCase().includes(q) ||
            (b.application_number || '').toLowerCase().includes(q) ||
            (b.home_town || '').toLowerCase().includes(q) ||
            (b.contact_number || '').toLowerCase().includes(q) ||
            (b.nic_number || '').toLowerCase().includes(q)
        )) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        let va = a[_benSortKey] ?? '', vb = b[_benSortKey] ?? '';
        if (_benSortKey === 'monthly_income') { va = Number(va); vb = Number(vb); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return _benSortDir === 'asc' ? cmp : -cmp;
    });

    const totalFiltered = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalFiltered / _benPageSize));
    if (_benPage > totalPages) _benPage = totalPages;

    // Paginate
    const start = (_benPage - 1) * _benPageSize;
    const pageItems = filtered.slice(start, start + _benPageSize);

    // Filter count label
    const countEl = document.getElementById('benFilterCount');
    if (countEl) {
        const showing = pageItems.length;
        countEl.textContent = totalFiltered < currentBeneficiaries.length
            ? `Showing ${start + 1}–${start + showing} of ${totalFiltered} (filtered from ${currentBeneficiaries.length})`
            : `${start + 1}–${start + showing} of ${totalFiltered} record${totalFiltered !== 1 ? 's' : ''}`;
    }

    const statusLabel = { Active: 'Active', pending: 'Pending', deactivate: 'On Hold', rejected: 'Rejected' };

    const tbody = document.getElementById('beneficiariesBody');
    tbody.innerHTML = pageItems.map((b, i) => `
        <tr>
            <td style="text-align:center; font-size:0.78rem; color:var(--text-muted); font-weight:600;">${start + i + 1}</td>
            <td style="font-family:monospace; font-size:0.82rem; color:var(--text-muted);">${b.application_number || '—'}</td>
            <td>
                <div style="font-weight:600;">${b.male_head_name || '—'}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${b.nic_number || ''}</div>
            </td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${b.contact_number || '—'}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${b.home_town || '—'}</td>
            <td style="font-size:0.82rem;">${b.category || '—'}</td>
            <td style="font-weight:600; font-size:0.875rem;">${b.monthly_income ? 'LKR ' + Number(b.monthly_income).toLocaleString() : '—'}</td>
            <td><span class="status-badge status-${b.status}">${statusLabel[b.status] || b.status}</span></td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="viewBeneficiary(${b.id})" title="View"><i data-lucide="eye" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="editBeneficiary(${b.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#e0f2fe; color:#0369a1;" onclick="printBeneficiaryReport(${b.id})" title="Print Report"><i data-lucide="printer" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteBeneficiary(${b.id})" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No beneficiaries found</td></tr>`;

    // Render pagination bar
    _renderBenPagination(totalFiltered, totalPages);
    lucide.createIcons();
}

function _renderBenPagination(total, totalPages) {
    const bar = document.getElementById('benPaginationBar');
    if (!bar) return;
    if (total === 0) { bar.innerHTML = ''; return; }

    const btnBase = `font-family:inherit; cursor:pointer; border:1px solid var(--border-color); border-radius:8px; padding:0.35rem 0.7rem; font-size:0.8rem; font-weight:500; transition:background 0.15s, color 0.15s;`;
    const btnActive = `${btnBase} background:var(--text-main); color:var(--bg-main); border-color:var(--text-main);`;
    const btnNormal = `${btnBase} background:var(--bg-card); color:var(--text-main);`;
    const btnDisabled = `${btnBase} background:var(--bg-card); color:var(--text-muted); cursor:default; opacity:0.5;`;

    // Page number buttons (show up to 7, with ellipsis)
    let pageButtons = '';
    const WINDOW = 2;
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= _benPage - WINDOW && p <= _benPage + WINDOW)) {
            pageButtons += `<button style="${p === _benPage ? btnActive : btnNormal}" onclick="_benGoPage(${p})">${p}</button>`;
        } else if (
            (p === _benPage - WINDOW - 1 && p > 1) ||
            (p === _benPage + WINDOW + 1 && p < totalPages)
        ) {
            pageButtons += `<span style="padding:0.35rem 0.3rem; color:var(--text-muted); font-size:0.85rem;">…</span>`;
        }
    }

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.8rem; color:var(--text-muted);">
            <span>Rows per page:</span>
            <select onchange="_benChangePageSize(this.value)" style="font-family:inherit; font-size:0.8rem; border:1px solid var(--border-color); border-radius:6px; padding:0.2rem 0.5rem; background:var(--bg-card); color:var(--text-main); cursor:pointer;">
                ${[10,15,25,50].map(n => `<option value="${n}" ${n === _benPageSize ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
            <button style="${_benPage <= 1 ? btnDisabled : btnNormal}" ${_benPage <= 1 ? 'disabled' : ''} onclick="_benGoPage(${_benPage - 1})">
                <i data-lucide="chevron-left" style="width:14px; vertical-align:middle;"></i>
            </button>
            ${pageButtons}
            <button style="${_benPage >= totalPages ? btnDisabled : btnNormal}" ${_benPage >= totalPages ? 'disabled' : ''} onclick="_benGoPage(${_benPage + 1})">
                <i data-lucide="chevron-right" style="width:14px; vertical-align:middle;"></i>
            </button>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted);">
            Page ${_benPage} of ${totalPages}
        </div>
    `;
    lucide.createIcons();
}

function _benGoPage(p) {
    _benPage = p;
    filterBeneficiaries();
}

function _benChangePageSize(val) {
    _benPageSize = parseInt(val, 10);
    _benPage = 1;
    filterBeneficiaries();
}

async function viewBeneficiary(id) {
    try {
        const res = await fetch(`/api/edf/beneficiaries/${id}`);
        const b = await res.json();

        const fmt = v => (v != null && v !== '') ? v : 'N/A';
        const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';
        const fmtLKR = v => v != null ? `LKR ${Number(v).toLocaleString()}` : 'N/A';
        const di = (label, value) => `<div class="detail-item"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></div>`;

        document.getElementById('viewBenInitial').textContent = (b.male_head_name || '?').charAt(0);
        document.getElementById('viewBenName').textContent = b.male_head_name || 'N/A';
        const badge = document.getElementById('viewBenStatusBadge');
        const statusLabel = { Active:'Active', pending:'Pending', deactivate:'On Hold', rejected:'Rejected' };
        badge.className = `status-badge status-${b.status}`;
        badge.textContent = statusLabel[b.status] || b.status;
        document.getElementById('viewBenAppNum').textContent = b.application_number ? `· ${b.application_number}` : '';

        // Photo or initials avatar
        const photoEl     = document.getElementById('viewBenPhoto');
        const initialEl   = document.getElementById('viewBenInitial');
        if (b.photo_url) {
            photoEl.src           = b.photo_url;
            photoEl.style.display = 'block';
            initialEl.style.display = 'none';
        } else {
            photoEl.style.display   = 'none';
            initialEl.style.display = 'flex';
            initialEl.textContent   = (b.male_head_name || '?').charAt(0).toUpperCase();
        }

        document.getElementById('vbenPrimaryGrid').innerHTML = [
            di('Full Name', fmt(b.male_head_name)),
            di('NIC Number', fmt(b.nic_number)),
            di('Gender', fmt(b.male_head_gender)),
            di('Age', fmt(b.male_head_age)),
            di('Date of Birth', fmtDate(b.male_head_dob)),
            di('Occupation', fmt(b.male_head_occupation)),
            di('Contact Number', fmt(b.contact_number)),
            di('Home Town', fmt(b.home_town)),
            di('Address', fmt(b.male_head_address)),
            di('Qualifications', fmt(b.male_head_special_qualifications)),
        ].join('');

        // Tab 2: Secondary
        document.getElementById('vbenSecondaryGrid').innerHTML = [
            di('Full Name', fmt(b.female_head_name)),
            di('NIC Number', fmt(b.female_head_nic)),
            di('Date of Birth', fmtDate(b.female_head_dob)),
            di('Occupation', fmt(b.female_head_occupation)),
            di('Home Town', fmt(b.female_head_home_town)),
            di('Address', fmt(b.female_head_address)),
            di('Qualifications', fmt(b.female_head_special_qualifications)),
        ].join('');

        // Tab 3: Children — derive counts live from sub-table arrays
        const _allKids = [
            ...(b.study      || []),
            ...(b.dropout    || []),
            ...(b.university || []),
            ...(b.abroad     || []),
            ...(b.other      || [])
        ];
        const _maleCnt   = _allKids.filter(c => c.gender === 'male').length;
        const _femaleCnt = _allKids.filter(c => c.gender === 'female').length;
        const _totalCnt  = _allKids.length;
        document.getElementById('vbenChildrenCount').innerHTML = [
            di('Male Children',   _maleCnt   || fmt(b.children_count_male)),
            di('Female Children', _femaleCnt || fmt(b.children_count_female)),
            di('Total Children',  _totalCnt  || fmt(b.children_total_count)),
        ].join('');

        const childSection = (title, items, cols) => {
            if (!items || items.length === 0) return '';
            const rows = items.map(it => cols.map(c => `<div style="font-size:0.8rem; color:var(--text-muted);">${c.label}: <strong style="color:var(--text-main);">${it[c.key] || '—'}</strong></div>`).join('')).map(row => `<div class="relative-card" style="display:grid; grid-template-columns:repeat(${cols.length},1fr); gap:0.5rem;">${row}</div>`).join('');
            return `<div style="margin-bottom:1.25rem;"><div style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:0.5rem;">${title}</div>${rows}</div>`;
        };

        document.getElementById('vbenChildrenDetail').innerHTML = [
            childSection('Education (Schooling)', b.study, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'grade',label:'Grade'},{key:'dob',label:'DOB'}]),
            childSection('School Dropouts', b.dropout, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'grade',label:'Last Grade'},{key:'dob',label:'DOB'}]),
            childSection('University Selected', b.university, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'university_name',label:'University'},{key:'year',label:'Year'}]),
            childSection('Working Abroad', b.abroad, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'dob',label:'DOB'}]),
            childSection('Other (Kindergarten / Nursery / Babies)', b.other, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'category',label:'Type'},{key:'dob',label:'DOB'}]),
        ].join('') || '<p style="color:var(--text-muted); font-size:0.875rem;">No children details recorded.</p>';

        // Tab 4: Living
        document.getElementById('vbenLivingGrid').innerHTML = [
            di('Category', fmt(b.category)),
            di('Monthly Income', fmtLKR(b.monthly_income)),
            di('Home Ownership', fmt(b.living_home_details)),
            di('Family Status', fmt(b.family_status)),
            di('Guardian (if Divorced)', fmt(b.guardian_if_divorced)),
            di('Vehicles in Use', fmt(b.vehicles_in_use)),
            di('Abroad Details', fmt(b.abroad_details)),
            di('Special Needs', fmt(b.special_needs)),
        ].join('');

        // Tab 5: Assessment
        const yesNo = v => v === 'yes'
            ? `<span class="status-badge status-Active">Yes</span>`
            : `<span class="status-badge status-deactivate">No</span>`;
        const assessCard = (title, desc, val) => `
            <div class="detail-item" style="display:flex; justify-content:space-between; align-items:center;">
                <div><div class="detail-label">${title}</div><div style="font-size:0.75rem; color:var(--text-muted);">${desc}</div></div>
                <div>${yesNo(val)}</div>
            </div>`;
        document.getElementById('vbenAssessmentGrid').innerHTML = [
            assessCard('Parents with Head', 'Elderly parents supported', b.parents_live_with_head),
            assessCard('Special Needs at Home', 'Disabilities / patients', b.special_needs_at_home),
            assessCard('Children Seeking Job', 'Job search in progress', b.children_seeking_job),
            assessCard('Marriageable Age', 'Pending marriage', b.children_marriageable_age),
            assessCard('Drug History', 'Substance abuse in family', b.children_drugs),
            assessCard('Family Problems', 'Internal disputes', b.family_problems),
            assessCard('Applied Before', 'Previous EDF interactions', b.applied_before),
            assessCard('Aid Received Before', 'Prior org assistance', b.received_assistance_before),
            di('Assistance Needed', fmt(b.assistance_details)),
        ].join('');

        // Reset to first tab
        const vm = document.getElementById('viewBeneficiaryModal');
        vm.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        vm.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        vm.querySelector('[data-modal-tab="vben-primary"]').classList.add('active');
        document.getElementById('vben-primary').classList.add('active');

        document.getElementById('editFromViewBenBtn').onclick = () => {
            closeModal('viewBeneficiaryModal');
            editBeneficiary(id);
        };
        document.getElementById('idCardFromViewBenBtn').onclick = () => generateBenIdCard(b);

        openModal('viewBeneficiaryModal');
        lucide.createIcons();
    } catch (err) { console.error('viewBeneficiary error:', err); showToast('Failed to load beneficiary details', 'error'); }
}
// ── Beneficiary Identity Card Generator ───────────────────────────────────────
function generateBenIdCard(b) {
    const fmt     = v  => (v != null && v !== '') ? v : '—';
    const fmtDate = d  => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const appNum  = b.application_number || ('EDF-' + String(b.id).padStart(5, '0'));
    const issueDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

    // QR data
    const qrData  = encodeURIComponent(`EDF Beneficiary\nID: ${appNum}\nName: ${b.male_head_name || ''}\nNIC: ${b.nic_number || ''}\nStatus: ${b.status || 'pending'}`);
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}&bgcolor=ffffff&color=1e1b4b&margin=6`;

    // Photo block
    const photoHtml = b.photo_url
        ? `<img src="${b.photo_url}" alt="Photo" style="width:88px;height:108px;object-fit:cover;border-radius:8px;border:3px solid rgba(255,255,255,0.4);">`
        : `<div style="width:88px;height:108px;border-radius:8px;background:rgba(255,255,255,0.15);border:3px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:700;color:rgba(255,255,255,0.6);">${(b.male_head_name||'?').charAt(0).toUpperCase()}</div>`;

    const statusColor = { Active:'#10b981', pending:'#f59e0b', deactivate:'#6b7280', rejected:'#ef4444' };
    const sColor = statusColor[b.status] || '#f59e0b';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EDF Beneficiary ID Card – ${appNum}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f1f5f9; font-family:'Segoe UI',system-ui,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; gap:2rem; padding:2rem; }
  .card-page { display:flex; gap:2rem; flex-wrap:wrap; justify-content:center; }

  /* CARD SHELL */
  .id-card { width:340px; height:210px; border-radius:18px; position:relative; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.25); flex-shrink:0; }

  /* ── FRONT ── */
  .front { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4f46e5 100%); }
  .front .card-shine { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 60%); pointer-events:none; }

  /* Header strip */
  .card-header { display:flex; align-items:center; gap:8px; padding:10px 14px 8px; border-bottom:1px solid rgba(255,255,255,0.15); }
  .card-logo-circle { width:28px; height:28px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:11px; color:#312e81; flex-shrink:0; }
  .card-org { color:#fff; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; line-height:1.2; }
  .card-org span { display:block; font-weight:400; font-size:8.5px; opacity:0.7; letter-spacing:0.04em; }
  .card-type-badge { margin-left:auto; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:20px; color:#e0e7ff; font-size:7.5px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; padding:2px 7px; }

  /* Body */
  .card-body { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; }
  .card-name { color:#fff; font-size:13px; font-weight:700; line-height:1.2; margin-bottom:4px; }
  .card-field { display:flex; flex-direction:column; gap:1px; margin-bottom:5px; }
  .card-field-label { font-size:7px; text-transform:uppercase; letter-spacing:0.07em; color:rgba(255,255,255,0.5); font-weight:600; }
  .card-field-value { font-size:9.5px; color:rgba(255,255,255,0.9); font-weight:500; }

  /* Status dot */
  .card-status { display:inline-flex; align-items:center; gap:4px; background:rgba(0,0,0,0.25); border-radius:20px; padding:2px 7px; margin-top:2px; }
  .card-status-dot { width:6px; height:6px; border-radius:50%; background:${sColor}; flex-shrink:0; }
  .card-status-label { font-size:8px; color:#fff; font-weight:600; text-transform:capitalize; }

  /* Bottom bar */
  .card-footer { position:absolute; bottom:0; left:0; right:0; padding:6px 14px; background:rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:space-between; }
  .card-id { font-size:8px; font-family:'Courier New',monospace; color:rgba(255,255,255,0.7); letter-spacing:0.05em; }
  .card-issue { font-size:7.5px; color:rgba(255,255,255,0.5); }

  /* Corner decoration */
  .card-corner-circle { position:absolute; width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,0.05); bottom:-20px; right:80px; }
  .card-corner-circle2 { position:absolute; width:50px; height:50px; border-radius:50%; background:rgba(255,255,255,0.07); top:-15px; right:20px; }

  /* ── BACK ── */
  .back { background:linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); }
  .back-header { padding:10px 14px 6px; border-bottom:1px solid rgba(255,255,255,0.12); }
  .back-title { color:rgba(255,255,255,0.5); font-size:8px; text-transform:uppercase; letter-spacing:0.1em; font-weight:700; }
  .back-body { display:flex; gap:14px; padding:10px 14px; align-items:flex-start; }
  .back-qr { width:80px; height:80px; border-radius:8px; overflow:hidden; background:#fff; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .back-qr img { width:100%; height:100%; object-fit:cover; }
  .back-fields { flex:1; display:flex; flex-direction:column; gap:6px; }
  .back-field { border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px; }
  .back-field-label { font-size:7px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; }
  .back-field-value { font-size:9.5px; color:rgba(255,255,255,0.9); font-weight:500; margin-top:1px; }
  .back-footer { position:absolute; bottom:0; left:0; right:0; padding:7px 14px; background:rgba(0,0,0,0.25); text-align:center; }
  .back-footer p { font-size:7px; color:rgba(255,255,255,0.4); line-height:1.5; }

  .print-hint { font-size:12px; color:#64748b; text-align:center; margin-top:0.5rem; }
  @media print {
    body { background:#fff; padding:0; min-height:unset; gap:10mm; }
    .print-hint { display:none; }
    .card-page { gap:8mm; }
    .id-card { box-shadow:none; break-inside:avoid; }
  }
</style>
</head>
<body>

<div class="card-page">

  <!-- FRONT -->
  <div class="id-card front">
    <div class="card-shine"></div>
    <div class="card-corner-circle"></div>
    <div class="card-corner-circle2"></div>

    <div class="card-header">
      <div class="card-logo-circle">EDF</div>
      <div class="card-org">
        Educational Development Foundation
        <span>Beneficiary Identity Card</span>
      </div>
      <div class="card-type-badge">Official</div>
    </div>

    <div class="card-body">
      ${photoHtml}
      <div style="flex:1; min-width:0;">
        <div class="card-name">${fmt(b.male_head_name)}</div>
        <div class="card-field">
          <div class="card-field-label">NIC Number</div>
          <div class="card-field-value">${fmt(b.nic_number)}</div>
        </div>
        <div class="card-field">
          <div class="card-field-label">Category</div>
          <div class="card-field-value">${fmt(b.category)}</div>
        </div>
        <div class="card-field">
          <div class="card-field-label">Home Town</div>
          <div class="card-field-value">${fmt(b.home_town)}</div>
        </div>
        <div class="card-status">
          <div class="card-status-dot"></div>
          <div class="card-status-label">${b.status || 'pending'}</div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="card-id">${appNum}</div>
      <div class="card-issue">Issued: ${issueDate}</div>
    </div>
  </div>

  <!-- BACK -->
  <div class="id-card back">
    <div class="back-header">
      <div class="back-title">Beneficiary Details &amp; Verification</div>
    </div>
    <div class="back-body">
      <div class="back-qr">
        <img src="${qrUrl}" alt="QR Code">
      </div>
      <div class="back-fields">
        <div class="back-field">
          <div class="back-field-label">Contact</div>
          <div class="back-field-value">${fmt(b.contact_number)}</div>
        </div>
        <div class="back-field">
          <div class="back-field-label">Date of Birth</div>
          <div class="back-field-value">${fmtDate(b.male_head_dob)}</div>
        </div>
        <div class="back-field">
          <div class="back-field-label">Occupation</div>
          <div class="back-field-value">${fmt(b.male_head_occupation)}</div>
        </div>
        <div class="back-field">
          <div class="back-field-label">Address</div>
          <div class="back-field-value" style="font-size:8.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${fmt(b.male_head_address)}</div>
        </div>
      </div>
    </div>
    <div class="back-footer">
      <p>Scan QR code to verify this beneficiary &bull; This card is issued by EDF and remains the property of the Foundation.<br>For queries contact: info@edf.org</p>
    </div>
  </div>

</div>

<p class="print-hint">Press <strong>Ctrl + P</strong> to print the ID card &bull; Use "Fit to page" for best results.</p>

<script>
  // Auto-print when page loads (after QR image loads)
  const qrImg = document.querySelector('.back-qr img');
  if (qrImg) {
    qrImg.onload  = () => setTimeout(() => { window.focus(); window.print(); }, 300);
    qrImg.onerror = () => setTimeout(() => { window.focus(); window.print(); }, 300);
  } else {
    setTimeout(() => { window.focus(); window.print(); }, 600);
  }
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=860,height=600');
    if (!win) { showToast('Please allow pop-ups to generate the ID card', 'error'); return; }
    win.document.write(html);
    win.document.close();
}

async function printBeneficiaryReport(id) {
    try {
        const res = await fetch(`/api/edf/beneficiaries/${id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const b = await res.json();

        const fmt    = v  => (v != null && v !== '') ? v : 'N/A';
        const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';
        const fmtLKR  = v => v != null ? `LKR ${Number(v).toLocaleString()}` : 'N/A';
        const yesNo   = v => v === 'yes' ? 'Yes' : 'No';
        const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'N/A';

        // Compute children counts from sub-arrays
        const allKids   = [...(b.study||[]),...(b.dropout||[]),...(b.university||[]),...(b.abroad||[]),...(b.other||[])];
        const maleKids  = allKids.filter(c => c.gender === 'male').length;
        const femaleKids= allKids.filter(c => c.gender === 'female').length;

        // QR data — encode beneficiary id + app number
        const qrData = encodeURIComponent(`EDF-BEN-${b.id}|${b.application_number || ''}|${b.male_head_name || ''}`);
        const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&color=1e1b4b&margin=0`;

        const childTable = (title, items, cols) => {
            if (!items || !items.length) return '';
            const header = cols.map(c => `<th>${c.label}</th>`).join('');
            const rows   = items.map(it => `<tr>${cols.map(c => `<td>${it[c.key] || '—'}</td>`).join('')}</tr>`).join('');
            return `<div class="section"><div class="section-title"><span class="section-icon"></span>${title}</div>
                <table class="data-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
        };

        const row = (l, v, w = '50%') => `<div class="field" style="width:${w};"><span class="label">${l}</span><span class="value">${v}</span></div>`;
        const yesNoPill = v => {
            const isYes = v === 'yes';
            return `<span class="yn-pill ${isYes ? 'yn-yes' : 'yn-no'}">${isYes ? 'Yes' : 'No'}</span>`;
        };

        const statusColors = { Active:'#059669;background:#d1fae5;border-color:#34d399', pending:'#d97706;background:#fef3c7;border-color:#fbbf24', deactivate:'#4b5563;background:#f3f4f6;border-color:#d1d5db', rejected:'#dc2626;background:#fee2e2;border-color:#f87171' };
        const sc = statusColors[b.status] || '#4b5563;background:#f3f4f6;border-color:#d1d5db';

        const photoHtml = b.photo_url
            ? `<img src="${b.photo_url}" class="profile-photo" alt="Photo">`
            : `<div class="profile-initial">${(b.male_head_name||'?').charAt(0).toUpperCase()}</div>`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Beneficiary Report — ${b.male_head_name || 'N/A'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size:10.5pt; color:#1e293b; background:#f8fafc; line-height:1.4; padding:2rem; }
  .report-container { max-width: 210mm; margin: 0 auto; background: #fff; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01); }
  
  @page { size: A4; margin: 15mm; }
  @media print { 
    body { background:#fff; padding:0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-container { box-shadow: none; padding: 0; max-width: none; border-radius: 0; }
    .section { page-break-inside: avoid; }
    .no-print { display: none !important; }
  }

  /* Header */
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 2rem; border-bottom: 3px solid #1e1b4b; padding-bottom: 1.5rem; }
  .org-block { display:flex; align-items:center; gap: 1rem; }
  .org-logo { width:64px; height:64px; background:linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%); border-radius:14px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:800; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .org-name { font-size:22px; font-weight:800; color:#1e1b4b; line-height:1.1; letter-spacing: -0.02em; }
  .org-sub  { font-size:10pt; color:#64748b; margin-top:4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
  .qr-block img { width:85px; height:85px; mix-blend-mode: multiply; }

  /* Summary Card */
  .summary-card { display: flex; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; align-items: stretch; gap: 1.5rem; }
  .profile-photo-wrap { flex-shrink: 0; width: 100px; height: 120px; border-radius: 8px; overflow: hidden; background: #e2e8f0; border: 3px solid #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .profile-photo { width: 100px; height: 120px; object-fit: cover; }
  .profile-initial { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 800; color: #94a3b8; background: #f1f5f9; }
  
  .summary-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .summary-name { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 12px; }
  .status-pill { font-size: 9pt; font-weight: 600; padding: 4px 14px; border-radius: 20px; color:${sc.split(';')[0]}; background:${sc.split(';')[1].replace('background:','')}; border: 1px solid ${sc.split(';')[2].replace('border-color:','')}; text-transform: capitalize; letter-spacing: 0.02em; }
  
  .summary-meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #cbd5e1; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 2px; }
  .meta-value { font-size: 10.5pt; font-weight: 600; color: #334155; }
  .highlight-value { font-family: monospace; color: #4f46e5; font-size: 11pt; letter-spacing: 0.05em; }

  /* Sections & Layout */
  .section { margin-bottom: 2rem; }
  .section-title { display: flex; align-items: center; gap: 8px; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 1rem; }
  .section-icon { width: 6px; height: 16px; background: #4f46e5; border-radius: 4px; display: inline-block; }
  
  .grid-container { display: flex; flex-wrap: wrap; gap: 1rem; background: #fff; }
  .field { display: flex; flex-direction: column; gap: 3px; padding-bottom: 0.5rem; }
  .label { font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .value { font-size: 10.5pt; color: #0f172a; font-weight: 500; }
  .value-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 10pt; color: #334155; margin-top: 4px; min-height: 2.2rem; display: flex; align-items: center; }

  .yn-pill { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .yn-yes { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .yn-no { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

  /* Tables */
  .data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9.5pt; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .data-table th { background: #f8fafc; color: #475569; padding: 8px 12px; text-align: left; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
  .data-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500; }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:nth-child(even) td { background: #fafafa; }

  /* Footer */
  .footer { border-top: 2px solid #e2e8f0; padding-top: 1.5rem; margin-top: 3rem; display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; font-weight: 500; }
  
  .print-btn-wrap { text-align: right; margin-bottom: 1rem; }
  .print-btn { background: #1e1b4b; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; font-family: inherit; transition: background 0.2s; }
  .print-btn:hover { background: #312e81; }
  .print-btn svg { width: 16px; height: 16px; }
  
  /* Additional notes area */
  .notes-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; color: #92400e; font-size: 10pt; border-radius: 6px; margin-top: 0.5rem; white-space: pre-wrap; font-style: italic; }
  .reject-box { background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; padding: 1rem; color: #991b1b; font-size: 10pt; border-radius: 6px; margin-top: 0.5rem; white-space: pre-wrap; font-weight: 500; }
</style>
</head>
<body>

<div class="print-btn-wrap no-print">
    <button class="print-btn" onclick="window.print()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
        Print Report
    </button>
</div>

<div class="report-container">
    <!-- HEADER -->
    <div class="header">
      <div class="org-block">
        <div class="org-logo">E</div>
        <div>
          <div class="org-name">Educational Development Foundation</div>
          <div class="org-sub">Comprehensive Beneficiary Profile Report</div>
        </div>
      </div>
      <div class="qr-block">
        <img src="${qrUrl}" alt="QR Code">
      </div>
    </div>

    <!-- SUMMARY CARD -->
    <div class="summary-card">
      <div class="profile-photo-wrap">
        ${photoHtml}
      </div>
      <div class="summary-info">
        <div class="summary-name">${fmt(b.male_head_name)} <span class="status-pill">${b.status || 'pending'}</span></div>
        <div class="summary-meta-grid">
            <div class="meta-item"><span class="meta-label">Application Number</span><span class="meta-value highlight-value">${b.application_number || ('EDF-BEN-' + String(b.id).padStart(5, '0'))}</span></div>
            <div class="meta-item"><span class="meta-label">NIC Number</span><span class="meta-value">${fmt(b.nic_number)}</span></div>
            <div class="meta-item"><span class="meta-label">Category</span><span class="meta-value">${fmt(b.category)}</span></div>
        </div>
      </div>
    </div>

    <!-- PRIMARY (MALE HEAD) -->
    <div class="section">
      <div class="section-title"><span class="section-icon"></span>Primary Information (Head of Family)</div>
      <div class="grid-container">
        ${row('Gender', cap(b.male_head_gender), 'calc(33.3% - 1rem)')}
        ${row('Date of Birth & Age', `${fmtDate(b.male_head_dob)}${b.male_head_age ? ` (${b.male_head_age} yrs)` : ''}`, 'calc(33.3% - 1rem)')}
        ${row('Contact Number', fmt(b.contact_number), 'calc(33.3% - 1rem)')}
        ${row('Occupation', `<div class="value-box">${fmt(b.male_head_occupation)}</div>`, 'calc(50% - 1rem)')}
        ${row('Special Qualifications', `<div class="value-box">${fmt(b.male_head_special_qualifications)}</div>`, 'calc(50% - 1rem)')}
        ${row('Home Town', fmt(b.home_town), 'calc(33.3% - 1rem)')}
        ${row('Residential Address', fmt(b.male_head_address), 'calc(66.6% - 1rem)')}
      </div>
    </div>

    <!-- SECONDARY (FEMALE HEAD) -->
    <div class="section">
      <div class="section-title"><span class="section-icon" style="background:#0ea5e9;"></span>Secondary Information (Spouse / Guardian)</div>
      <div class="grid-container">
        ${row('Full Name', fmt(b.female_head_name), 'calc(50% - 1rem)')}
        ${row('NIC Number', fmt(b.female_head_nic), 'calc(25% - 1rem)')}
        ${row('Date of Birth', fmtDate(b.female_head_dob), 'calc(25% - 1rem)')}
        ${row('Occupation', `<div class="value-box">${fmt(b.female_head_occupation)}</div>`, 'calc(50% - 1rem)')}
        ${row('Special Qualifications', `<div class="value-box">${fmt(b.female_head_special_qualifications)}</div>`, 'calc(50% - 1rem)')}
      </div>
    </div>

    <!-- LIVING CONDITIONS -->
    <div class="section">
      <div class="section-title"><span class="section-icon" style="background:#10b981;"></span>Living & Social Conditions</div>
      <div class="grid-container">
        ${row('Monthly Income', fmtLKR(b.monthly_income), 'calc(33.3% - 1rem)')}
        ${row('Family Status', cap(b.family_status), 'calc(33.3% - 1rem)')}
        ${row('Home Ownership', cap(b.living_home_details), 'calc(33.3% - 1rem)')}
        ${row('Vehicles in Use', `<div class="value-box">${fmt(b.vehicles_in_use)}</div>`, 'calc(50% - 1rem)')}
        ${row('Abroad Details', `<div class="value-box">${fmt(b.abroad_details)}</div>`, 'calc(50% - 1rem)')}
      </div>
    </div>

    <!-- CHILDREN OVERVIEW -->
    <div class="section">
      <div class="section-title"><span class="section-icon" style="background:#f59e0b;"></span>Children Detail (${allKids.length} Total: ${maleKids} Male, ${femaleKids} Female)</div>
      ${childTable('Schooling', b.study, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'grade',label:'Grade'},{key:'dob',label:'DOB'}])}
      ${childTable('Dropouts', b.dropout, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'grade',label:'Last Grade'},{key:'dob',label:'DOB'}])}
      ${childTable('University', b.university, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'university_name',label:'University'},{key:'year',label:'Year'}])}
      ${childTable('Abroad', b.abroad, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'dob',label:'DOB'}])}
      ${childTable('Other (Infant/Nursery)', b.other, [{key:'name',label:'Name'},{key:'gender',label:'Gender'},{key:'category',label:'Type'},{key:'dob',label:'DOB'}])}
    </div>

    <!-- ASSESSMENT -->
    <div class="section">
      <div class="section-title"><span class="section-icon" style="background:#8b5cf6;"></span>Assessment & Eligibility Evaluation</div>
      <div class="grid-container" style="align-items: center;">
        ${row('Parents Live w/ Head', yesNoPill(b.parents_live_with_head), 'calc(25% - 1rem)')}
        ${row('Special Needs at Home', yesNoPill(b.special_needs_at_home), 'calc(25% - 1rem)')}
        ${row('Drug Usage History', yesNoPill(b.children_drugs), 'calc(25% - 1rem)')}
        ${row('Severe Family Problems', yesNoPill(b.family_problems), 'calc(25% - 1rem)')}
        
        ${row('Applied Before', yesNoPill(b.applied_before), 'calc(25% - 1rem)')}
        ${row('Received Prior Aid', yesNoPill(b.received_assistance_before), 'calc(25% - 1rem)')}
        ${row('Children Seeking Job', yesNoPill(b.children_seeking_job), 'calc(25% - 1rem)')}
        ${row('Marriageable Age', yesNoPill(b.children_marriageable_age), 'calc(25% - 1rem)')}
        
        ${row('Assistance Type Needed', `<div class="value-box">${cap(b.assistance_details)}</div>`, 'calc(50% - 1rem)')}
        ${row('Special Needs Detail', `<div class="value-box">${fmt(b.special_needs)}</div>`, 'calc(50% - 1rem)')}
      </div>
      
      ${b.assessment_notes ? `<div style="margin-top:1.5rem;"><span class="label" style="margin-bottom:4px; display:block;">Assessment Notes / Findings</span><div class="notes-box">${b.assessment_notes}</div></div>` : ''}
      ${(b.status === 'rejected' && b.rejection_reason) ? `<div style="margin-top:1rem;"><span class="label" style="margin-bottom:4px; display:block; color:#991b1b;">Rejection Reason</span><div class="reject-box">${b.rejection_reason}</div></div>` : ''}
    </div>

    <!-- FOOTER -->
    <div class="footer no-print">
      <span>EDF Foundation Management System</span>
      <span>Printed on: ${new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})} at ${new Date().toLocaleTimeString('en-GB')}</span>
      <span style="font-family:monospace;">REF: ${b.application_number || ('EDF-BEN-' + String(b.id).padStart(5, '0'))}</span>
    </div>
</div>

<script>
  window.onload = () => {
    // Optionally trigger print automatically
    // setTimeout(() => { window.focus(); window.print(); }, 500);
  };
</script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=900,height=800');
        if (!win) { showToast('Please allow pop-ups to generate the report', 'error'); return; }
        win.document.write(html);
        win.document.close();
    } catch (err) { console.error('printBeneficiaryReport error:', err); showToast('Failed to generate report', 'error'); }
}

async function deleteBeneficiary(id) {
    const b = currentBeneficiaries.find(x => x.id === id);
    const name = b ? b.male_head_name : 'this record';
    if (!confirm(`Permanently delete beneficiary record for "${name}"?`)) return;
    try {
        const res = await fetch(`/api/edf/beneficiaries/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`"${name}" removed`, 'success');
            fetchBeneficiaries();
        } else {
            showToast('Failed to delete record', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error', 'error');
    }
}

let _depRowCounter = 0;

// ── Children Overview auto-counter ──────────────────────────────────────────
// Counts gender selects across all 5 child containers and writes Male/Female/Total
const CHILD_CONTAINERS = ['studyContainer','dropoutContainer','uniContainer','abroadContainer','otherContainer'];
const GENDER_SELECT_NAMES = ['study_gender','dropout_gender','uni_gender','abroad_gender','other_gender'];

function updateChildrenCounts() {
    let male = 0, female = 0;
    CHILD_CONTAINERS.forEach(cid => {
        const c = document.getElementById(cid);
        if (!c) return;
        c.querySelectorAll('.dynamic-card').forEach(card => {
            const sel = card.querySelector('select[name$="_gender"]');
            if (sel) {
                if (sel.value === 'male')   male++;
                if (sel.value === 'female') female++;
            }
        });
    });
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const mEl = form.querySelector('[name="children_count_male"]');
    const fEl = form.querySelector('[name="children_count_female"]');
    const tEl = form.querySelector('[name="children_total_count"]');
    if (mEl) mEl.value = male;
    if (fEl) fEl.value = female;
    if (tEl) tEl.value = male + female;
}

function _makeRemoveBtn(rowId) {
    return `<button type="button" class="remove-btn" onclick="document.getElementById('${rowId}').remove(); updateChildrenCounts()">×</button>`;
}

function addStudyRow(data = {}) {
    const container = document.getElementById('studyContainer');
    const rowId = 'study-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        ${_makeRemoveBtn(rowId)}
        <div class="premium-input-group">
            <label>Child Full Name</label>
            <input type="text" name="study_name" placeholder="Full Name" value="${data.name || ''}" class="premium-input">
        </div>
        <div class="form-row">
            <div class="premium-input-group">
                <label>Gender</label>
                <select name="study_gender" class="premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="premium-input-group">
                <label>Date of Birth</label>
                <input type="date" name="study_dob" value="${data.dob || ''}" class="premium-input">
            </div>
            <div class="premium-input-group">
                <label>Current Grade</label>
                <input type="text" name="study_grade" placeholder="Grade e.g. 10" value="${data.grade || ''}" class="premium-input">
            </div>
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
}

function addDropoutRow(data = {}) {
    const container = document.getElementById('dropoutContainer');
    const rowId = 'dropout-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        ${_makeRemoveBtn(rowId)}
        <div class="premium-input-group">
            <label>Child Full Name</label>
            <input type="text" name="dropout_name" placeholder="Full Name" value="${data.name || ''}" class="premium-input">
        </div>
        <div class="form-row">
            <div class="premium-input-group">
                <label>Gender</label>
                <select name="dropout_gender" class="premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="premium-input-group">
                <label>Date of Birth</label>
                <input type="date" name="dropout_dob" value="${data.dob || ''}" class="premium-input">
            </div>
            <div class="premium-input-group">
                <label>Last Grade</label>
                <input type="text" name="dropout_grade" placeholder="Grade e.g. 8" value="${data.grade || ''}" class="premium-input">
            </div>
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
}

function addUniRow(data = {}) {
    const container = document.getElementById('uniContainer');
    const rowId = 'uni-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        ${_makeRemoveBtn(rowId)}
        <div class="premium-input-group">
            <label>Child Full Name</label>
            <input type="text" name="uni_name" placeholder="Full Name" value="${data.name || ''}" class="premium-input">
        </div>
        <div class="form-row">
            <div class="premium-input-group">
                <label>Gender</label>
                <select name="uni_gender" class="premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="premium-input-group">
                <label>University / College</label>
                <input type="text" name="uni_college" placeholder="Name" value="${data.university_name || ''}" class="premium-input">
            </div>
            <div class="premium-input-group">
                <label>Current Year</label>
                <input type="text" name="uni_year" placeholder="Year" value="${data.year || ''}" class="premium-input">
            </div>
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
}

function addAbroadRow(data = {}) {
    const container = document.getElementById('abroadContainer');
    const rowId = 'abroad-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        ${_makeRemoveBtn(rowId)}
        <div class="premium-input-group">
            <label>Full Name</label>
            <input type="text" name="abroad_name" placeholder="Name" value="${data.name || ''}" class="premium-input">
        </div>
        <div class="form-row">
            <div class="premium-input-group">
                <label>Gender</label>
                <select name="abroad_gender" class="premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="premium-input-group">
                <label>Date of Birth</label>
                <input type="date" name="abroad_dob" value="${data.dob || ''}" class="premium-input">
            </div>
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
}

function addOtherRow(data = {}) {
    const container = document.getElementById('otherContainer');
    const rowId = 'other-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        ${_makeRemoveBtn(rowId)}
        <div class="premium-input-group">
            <label>Child Full Name</label>
            <input type="text" name="other_name" placeholder="Full Name" value="${data.name || ''}" class="premium-input">
        </div>
        <div class="form-row">
            <div class="premium-input-group">
                <label>Gender</label>
                <select name="other_gender" class="premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="premium-input-group">
                <label>Date of Birth</label>
                <input type="date" name="other_dob" value="${data.dob || ''}" class="premium-input">
            </div>
            <div class="premium-input-group">
                <label>Category</label>
                <select name="other_category" class="premium-input">
                    <option value="kindergarten" ${data.category === 'kindergarten' ? 'selected' : ''}>Kindergarten</option>
                    <option value="nursery" ${data.category === 'nursery' ? 'selected' : ''}>Nursery</option>
                    <option value="baby" ${data.category === 'baby' ? 'selected' : ''}>Baby / Infant</option>
                    <option value="other" ${data.category === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
}

// Global UI handlers for Beneficiary Modal
// Wizard step IDs in order
const WIZARD_STEPS = ['ben-male', 'ben-female', 'ben-children', 'ben-family', 'ben-status'];

function goToWizardStep(stepIdx) {
    const modal = document.getElementById('beneficiaryModal');
    if (!modal) return;
    const stepId = WIZARD_STEPS[stepIdx];

    // Update stepper circles
    modal.querySelectorAll('.stepper-item').forEach((item, i) => {
        item.classList.remove('active', 'completed');
        if (i < stepIdx) item.classList.add('completed');
        if (i === stepIdx) item.classList.add('active');
    });

    // Update content panels
    modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    const panel = document.getElementById(stepId);
    if (panel) panel.classList.add('active');

    // Show / hide nav buttons
    const prevBtn = modal.querySelector('.btn-wizard-prev');
    const nextBtn = modal.querySelector('.btn-wizard-next');
    const submitBtn = modal.querySelector('.btn-wizard-submit');
    if (prevBtn) prevBtn.style.display = stepIdx === 0 ? 'none' : '';
    if (nextBtn) nextBtn.style.display = stepIdx === WIZARD_STEPS.length - 1 ? 'none' : '';
    if (submitBtn) submitBtn.style.display = stepIdx === WIZARD_STEPS.length - 1 ? '' : 'none';
}

function toggleGuardianField(familyStatus) {
    const wrap = document.getElementById('guardianFieldWrap');
    if (wrap) wrap.style.display = familyStatus === 'Divorced' ? '' : 'none';
}

// Delegated click handler — ONLY for add-row buttons inside the beneficiary modal.
// Wizard Next / Prev / Stepper navigation is handled exclusively by the inline
// <script> at the bottom of dashboard.html to avoid double-advancing the wizard.
document.addEventListener('click', (e) => {
    if (e.target.closest('#addStudyRowBtn'))   { addStudyRow();   return; }
    if (e.target.closest('#addDropoutRowBtn')) { addDropoutRow(); return; }
    if (e.target.closest('#addUniRowBtn'))     { addUniRow();     return; }
    if (e.target.closest('#addAbroadRowBtn'))  { addAbroadRow();  return; }
    if (e.target.closest('#addOtherRowBtn'))   { addOtherRow();   return; }
});

// Toggle switch logic for yes/no hidden inputs
document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.name.endsWith('_toggle')) {
        const baseName = e.target.name.replace('_toggle', '');
        const hiddenInput = e.target.closest('form').querySelector(`input[name="${baseName}"]`);
        if (hiddenInput) {
            hiddenInput.value = e.target.checked ? 'yes' : 'no';
        }
    }
    // Re-tally gender counts whenever any gender select changes inside a child container
    if (e.target.tagName === 'SELECT' && e.target.name && e.target.name.endsWith('_gender') &&
        CHILD_CONTAINERS.some(cid => { const c = document.getElementById(cid); return c && c.contains(e.target); })) {
        updateChildrenCounts();
    }
});

function openAddBeneficiaryModal() {
    document.getElementById('beneficiaryModalTitle').textContent = 'Register New Beneficiary';
    const form = document.getElementById('beneficiaryForm');
    form.reset();
    // Explicitly clear hidden ID so Add never becomes a PUT
    const hiddenId = form.querySelector('input[name="id"]');
    if (hiddenId) hiddenId.value = '';

    // Clear dynamic rows
    ['studyContainer', 'dropoutContainer', 'uniContainer', 'abroadContainer', 'otherContainer'].forEach(cid => {
        document.getElementById(cid).innerHTML = '';
    });

    // Reset modern-switch toggles & hidden values
    const toggleFields = ['parents_live_with_head','special_needs_at_home','children_seeking_job',
        'children_marriageable_age','children_drugs','family_problems','applied_before','received_assistance_before'];
    toggleFields.forEach(field => {
        const cb = form.querySelector(`input[name="${field}_toggle"]`);
        if (cb) cb.checked = false;
        const hi = form.querySelector(`input[name="${field}"]`);
        if (hi) hi.value = 'no';
    });

    // Hide guardian field
    toggleGuardianField('');

    // Reset photo widget
    resetBenPhotoWidget();

    // openModal interceptor in the page script resets the wizard to step 1
    openModal('beneficiaryModal');
    populateBeneficiaryCategorySelect();
    lucide.createIcons();
}

// ── Beneficiary Photo Upload Helpers ──────────────────────────────────────────
function resetBenPhotoWidget() {
    const inp = document.getElementById('benPhotoInput');
    const url = document.getElementById('benPhotoUrl');
    const preview = document.getElementById('benPhotoPreview');
    const previewWrap = document.getElementById('benPhotoPreviewWrap');
    const placeholder = document.getElementById('benPhotoPlaceholder');
    const status = document.getElementById('benPhotoStatus');
    if (inp) inp.value = '';
    if (url) url.value = '';
    if (preview) { preview.src = ''; }
    if (previewWrap) previewWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    if (status) { status.style.display = 'none'; status.textContent = ''; }
}

function setBenPhotoPreview(src) {
    const preview = document.getElementById('benPhotoPreview');
    const previewWrap = document.getElementById('benPhotoPreviewWrap');
    const placeholder = document.getElementById('benPhotoPlaceholder');
    if (preview) preview.src = src;
    if (previewWrap) previewWrap.style.display = 'flex';
    if (placeholder) placeholder.style.display = 'none';
}

function setPhotoStatus(msg, type) {
    const status = document.getElementById('benPhotoStatus');
    if (!status) return;
    status.style.display = 'block';
    status.style.color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : 'var(--text-muted)';
    status.textContent = msg;
}

async function handleBenPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        setPhotoStatus('File too large. Max 5 MB.', 'error');
        return;
    }
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = e => setBenPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
    setPhotoStatus('Uploading…', 'info');
    try {
        const fd = new FormData();
        fd.append('photo', file);
        const res = await fetch('/api/edf/beneficiaries/upload-photo', { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json()).message || 'Upload failed');
        const { photo_url } = await res.json();
        document.getElementById('benPhotoUrl').value = photo_url;
        setPhotoStatus('✓ Photo uploaded', 'success');
    } catch (err) {
        setPhotoStatus('Upload failed: ' + err.message, 'error');
        // Keep local preview but clear saved URL
        document.getElementById('benPhotoUrl').value = '';
    }
}

function removeBenPhoto(event) {
    event.stopPropagation();
    resetBenPhotoWidget();
}

async function editBeneficiary(id) {
    try {
        const res = await fetch(`/api/edf/beneficiaries/${id}`);
        if (!res.ok) throw new Error('Failed to fetch beneficiary');
        const b = await res.json();

        document.getElementById('beneficiaryModalTitle').textContent = 'Edit Beneficiary Profile';
        const form = document.getElementById('beneficiaryForm');
        form.reset();

        // Populate category select first so value can be set when we fill fields
        await populateBeneficiaryCategorySelect();

        // Clear dynamic rows
        ['studyContainer', 'dropoutContainer', 'uniContainer', 'abroadContainer', 'otherContainer'].forEach(cid => {
            document.getElementById(cid).innerHTML = '';
        });

        // Fill all main scalar fields.
        // Skip nested arrays and the auto-managed created_at so the backend UPDATE is clean.
        const skipKeys = new Set(['study', 'dropout', 'university', 'abroad', 'created_at']);
        Object.keys(b).forEach(key => {
            if (skipKeys.has(key)) return;
            // Use querySelector(name) to avoid 'id' colliding with form.id attribute
            const el = form.querySelector(`[name="${key}"]`);
            if (el && el.type !== 'checkbox') el.value = b[key] ?? '';
        });

        // Populate dependent rows
        if (b.study)      b.study.forEach(s => addStudyRow(s));
        if (b.dropout)    b.dropout.forEach(d => addDropoutRow(d));
        if (b.university) b.university.forEach(u => addUniRow(u));
        if (b.abroad)     b.abroad.forEach(a => addAbroadRow(a));
        if (b.other)      b.other.forEach(o => addOtherRow(o));

        // Sync toggle checkboxes AND their paired hidden yes/no inputs.
        // Setting .checked programmatically does NOT fire 'change', so we must
        // manually update the hidden value as well.
        const toggleFields = ['parents_live_with_head','special_needs_at_home','children_seeking_job',
            'children_marriageable_age','children_drugs','family_problems','applied_before','received_assistance_before'];
        toggleFields.forEach(field => {
            const isYes = b[field] === 'yes';
            const cb = form.querySelector(`input[name="${field}_toggle"]`);
            const hi = form.querySelector(`input[name="${field}"]`);
            if (cb) cb.checked = isYes;
            if (hi) hi.value = isYes ? 'yes' : 'no';
        });

        // Show/hide guardian conditional field
        toggleGuardianField(b.family_status || '');

        // Populate photo widget if a saved photo exists
        resetBenPhotoWidget();
        if (b.photo_url) {
            setBenPhotoPreview(b.photo_url);
            document.getElementById('benPhotoUrl').value = b.photo_url;
            setPhotoStatus('Existing photo loaded', 'success');
        }

        // openModal interceptor resets wizard to step 1 automatically
        openModal('beneficiaryModal');
        lucide.createIcons();
    } catch (err) {
        console.error(err);
        showToast('Failed to load beneficiary for editing', 'error');
    }
}

// Beneficiary Form Submit
document.getElementById('beneficiaryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const id = data.id;

    // Strip UI-only toggle fields (not DB columns) and empty id for new records
    Object.keys(data).filter(k => k.endsWith('_toggle')).forEach(k => delete data[k]);
    if (!id) delete data.id;

    const collectRows = (containerId, keys) => {
        const rows = [];
        const container = document.getElementById(containerId);
        container.querySelectorAll('.dynamic-card').forEach(entry => {
            const rowData = {};
            keys.forEach(k => {
                const input = entry.querySelector(`[name="${k.field}"]`);
                if (input) rowData[k.key] = input.value;
            });
            if (Object.values(rowData).some(v => v)) rows.push(rowData);
        });
        return rows;
    };

    data.study = collectRows('studyContainer', [
        { field: 'study_name', key: 'name' },
        { field: 'study_gender', key: 'gender' },
        { field: 'study_dob', key: 'dob' },
        { field: 'study_grade', key: 'grade' }
    ]);
    data.dropout = collectRows('dropoutContainer', [
        { field: 'dropout_name', key: 'name' },
        { field: 'dropout_gender', key: 'gender' },
        { field: 'dropout_dob', key: 'dob' },
        { field: 'dropout_grade', key: 'grade' }
    ]);
    data.university = collectRows('uniContainer', [
        { field: 'uni_name', key: 'name' },
        { field: 'uni_gender', key: 'gender' },
        { field: 'uni_college', key: 'university_name' },
        { field: 'uni_year', key: 'year' }
    ]);
    data.abroad = collectRows('abroadContainer', [
        { field: 'abroad_name', key: 'name' },
        { field: 'abroad_gender', key: 'gender' },
        { field: 'abroad_dob', key: 'dob' }
    ]);
    data.other = collectRows('otherContainer', [
        { field: 'other_name', key: 'name' },
        { field: 'other_gender', key: 'gender' },
        { field: 'other_dob', key: 'dob' },
        { field: 'other_category', key: 'category' }
    ]);

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/edf/beneficiaries/${id}` : '/api/edf/beneficiaries';
    const submitBtn = document.querySelector('.btn-wizard-submit');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('beneficiaryModal');
            fetchBeneficiaries();
            showToast(id ? 'Beneficiary profile updated' : 'Beneficiary registered successfully', 'success');
        } else {
            const err = await res.json();
            showToast(`Error: ${err.message || 'Save failed'}`, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error — please try again', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check-circle"></i> Complete Registration';
            lucide.createIcons();
        }
    }
});

// ---- Beneficiary Categories CRUD ----
let categoryData = [];

async function fetchBeneficiaryCategories() {
    try {
        const res = await fetch('/api/edf/beneficiary-categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const categories = await res.json();
        categoryData = categories;
        const tbody = document.getElementById('beneficiaryCategoriesBody');
        if (!tbody) return;

        tbody.innerHTML = categories.map(c => `
            <tr>
                <td style="font-weight:600">${c.name}</td>
                <td>${c.description || '—'}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-sm" style="padding:0.3rem 0.5rem; background:var(--glow-bg);"
                        onclick="openCategoryForm('edit',${c.id})" title="Edit">
                        <i data-lucide="edit-2" style="width:14px;"></i></button>
                    <button class="btn btn-sm" style="padding:0.3rem 0.5rem; background:#fee2e2; color:#ef4444;"
                        onclick="deleteCategory(${c.id})" title="Delete">
                        <i data-lucide="trash-2" style="width:14px;"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No categories found</td></tr>';
        lucide.createIcons();
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function openBeneficiaryCategories() {
    cancelCategoryForm();
    fetchBeneficiaryCategories();
    openModal('beneficiaryCategoryModal');
}

function openCategoryForm(mode, catId = null) {
    const panel = document.getElementById('categoryFormPanel');
    const title = document.getElementById('categoryFormTitle');
    const submitBtn = document.getElementById('categorySubmitBtn');
    const cat = catId ? categoryData.find(c => c.id === catId) : null;

    document.getElementById('categoryRecordId').value = cat ? cat.id : '';
    document.getElementById('categoryName').value = cat ? cat.name : '';
    document.getElementById('categoryDescription').value = cat ? (cat.description || '') : '';

    title.textContent = mode === 'edit' ? 'Edit Category' : 'Add New Category';
    submitBtn.innerHTML = mode === 'edit'
        ? '<i data-lucide="save" style="width:14px;"></i> Update Category'
        : '<i data-lucide="save" style="width:14px;"></i> Save Category';
    panel.style.display = 'block';
    lucide.createIcons();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelCategoryForm() {
    const panel = document.getElementById('categoryFormPanel');
    if (panel) panel.style.display = 'none';
    const form = document.getElementById('beneficiaryCategoryForm');
    if (form) form.reset();
    const rid = document.getElementById('categoryRecordId');
    if (rid) rid.value = '';
}

async function saveCategoryRecord(e) {
    e.preventDefault();
    const id = document.getElementById('categoryRecordId').value;
    const payload = {
        name: document.getElementById('categoryName').value.trim(),
        description: document.getElementById('categoryDescription').value.trim(),
    };
    const isEdit = !!id;
    const url = isEdit ? `/api/edf/beneficiary-categories/${id}` : '/api/edf/beneficiary-categories';
    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            cancelCategoryForm();
            showToast(isEdit ? 'Category updated' : 'Category added', 'success');
            fetchBeneficiaryCategories();
            populateBeneficiaryCategorySelect();
            populateBenCategoryFilter();
        } else {
            showToast(result.message || 'Operation failed', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/edf/beneficiary-categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Category deleted', 'success');
            fetchBeneficiaryCategories();
            populateBeneficiaryCategorySelect();
            populateBenCategoryFilter();
        } else {
            showToast('Failed to delete category', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function fetchCourses() {
    try {
        const response = await fetch('/api/edf/courses');
        const data = await response.json();
        const tbody = document.getElementById('coursesBody');
        tbody.innerHTML = data.map(c => `
            <tr>
                <td style="font-weight:500">${c.title}</td>
                <td style="text-transform:capitalize">${c.category}</td>
                <td style="text-transform:capitalize">${c.target_audience}</td>
                <td><span style="background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:10px;font-size:12px">${c.status}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center">No programs found</td></tr>';
    } catch (err) { console.error(err); }
}

// ── Family Registry ──────────────────────────────────────────────
let currentFamilies = [];
let _familyPovertyFilter = 'all';
let _familyStatusFilter  = 'all';
let _familySortKey       = 'created_at';
let _familySortDir       = 'desc';

async function fetchFamilyStats() {
    try {
        const s = await (await fetch('/api/edf/families/stats')).json();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('fStatTotal',   s.total ?? '—');
        set('fStatActive',  s.active ?? '—');
        set('fStatHighNeed', s.highNeed ?? '—');
        set('fStatAid',     s.totalAid != null ? 'LKR ' + Number(s.totalAid).toLocaleString() : '—');
    } catch (err) { console.error(err); }
}

async function fetchFamilies() {
    try {
        const res = await fetch('/api/edf/families');
        currentFamilies = await res.json();
        fetchFamilyStats();
        renderFamilies();
    } catch (err) { console.error(err); }
}

function filterFamilies() {
    renderFamilies();
}

function setFamilyPovertyFilter(val) {
    _familyPovertyFilter = val;
    document.querySelectorAll('[id^="fPov-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fPov-' + val)?.classList.add('active');
    renderFamilies();
}

function setFamilyStatusFilter(val) {
    _familyStatusFilter = val;
    document.querySelectorAll('[id^="fStat-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fStat-' + val)?.classList.add('active');
    renderFamilies();
}

function sortFamilies(key) {
    if (_familySortKey === key) {
        _familySortDir = _familySortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _familySortKey = key;
        _familySortDir = 'asc';
    }
    renderFamilies();
}

function renderFamilies() {
    const search = (document.getElementById('familySearchInput')?.value || '').toLowerCase();
    const povertyOrder = { low: 1, medium: 2, high: 3 };

    let list = currentFamilies.filter(f => {
        if (_familyPovertyFilter !== 'all' && f.poverty_level !== _familyPovertyFilter) return false;
        if (_familyStatusFilter !== 'all' && (f.status || 'active') !== _familyStatusFilter) return false;
        if (search && !`${f.head_name} ${f.address || ''}`.toLowerCase().includes(search)) return false;
        return true;
    });

    list.sort((a, b) => {
        let va = a[_familySortKey] ?? '', vb = b[_familySortKey] ?? '';
        if (_familySortKey === 'poverty_level') { va = povertyOrder[va] || 0; vb = povertyOrder[vb] || 0; }
        if (_familySortKey === 'member_count')  { va = Number(va); vb = Number(vb); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return _familySortDir === 'asc' ? cmp : -cmp;
    });

    const povBadge = { low: 'background:#dcfce7;color:#166534;', medium: 'background:#fef9c3;color:#854d0e;', high: 'background:#fee2e2;color:#991b1b;' };
    const tbody = document.getElementById('familiesBody');
    tbody.innerHTML = list.map(f => {
        const pov = f.poverty_level || 'low';
        const status = f.status || 'active';
        const safeName = f.head_name.replace(/'/g, "\\'");
        return `<tr>
            <td style="font-weight:600;">${f.head_name}</td>
            <td style="color:var(--text-muted); font-size:0.875rem;">${f.phone || '—'}</td>
            <td style="font-size:0.875rem;">${f.address || '—'}</td>
            <td style="text-align:center;"><span class="status-badge">${f.member_count || 0}</span></td>
            <td><span class="status-badge" style="${povBadge[pov] || ''} text-transform:capitalize;">${pov}</span></td>
            <td><span class="status-badge ${status === 'active' ? 'status-active' : 'status-deactivate'}">${status === 'active' ? 'Active' : 'Inactive'}</span></td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn" style="padding:0.4rem 0.5rem; background:#e0f2fe; color:#0369a1;" onclick="openAidModal(${f.id},'${safeName}')" title="Distribute Aid"><i data-lucide="gift" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="viewAidHistory(${f.id},'${safeName}')" title="Aid History"><i data-lucide="history" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="editFamily(${f.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteFamily(${f.id},'${safeName}')" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No families found</td></tr>`;
    lucide.createIcons();
}

function openRegisterFamilyModal() {
    document.getElementById('familyModalTitle').innerHTML = '<i data-lucide="home" style="color:var(--primary);"></i> Register Family';
    document.getElementById('familyForm').reset();
    document.getElementById('familyId').value = '';
    document.getElementById('familySubmitBtn').innerHTML = '<i data-lucide="check"></i> Register Family';
    openModal('familyModal');
}

function editFamily(id) {
    const f = currentFamilies.find(x => x.id === id);
    if (!f) return;
    document.getElementById('familyModalTitle').innerHTML = '<i data-lucide="edit-2" style="color:var(--primary);"></i> Edit Family';
    const form = document.getElementById('familyForm');
    form.reset();
    form.elements['id'].value        = f.id;
    form.elements['head_name'].value = f.head_name || '';
    form.elements['phone'].value     = f.phone || '';
    form.elements['address'].value   = f.address || '';
    form.elements['member_count'].value = f.member_count || 1;
    form.elements['poverty_level'].value = f.poverty_level || 'low';
    form.elements['status'].value    = f.status || 'active';
    document.getElementById('familySubmitBtn').innerHTML = '<i data-lucide="save"></i> Save Changes';
    openModal('familyModal');
}

async function deleteFamily(id, name) {
    if (!confirm(`Delete "${name}" and all their aid records?`)) return;
    try {
        const res = await fetch(`/api/edf/families/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`"${name}" removed`, 'success');
            fetchFamilies();
            fetchStats();
        } else {
            showToast('Delete failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

document.getElementById('familyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const isEdit = !!data.id;
    const url    = isEdit ? `/api/edf/families/${data.id}` : '/api/edf/families';
    const method = isEdit ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) {
            closeModal('familyModal');
            showToast(isEdit ? 'Family updated' : 'Family registered', 'success');
            fetchFamilies();
            fetchStats();
        } else {
            const err = await res.json();
            showToast(err.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
});

function openAidModal(id, name) {
    document.getElementById('aidFamilyId').value = id;
    document.getElementById('targetFamilyNameAid').textContent = name;
    openModal('aidDistributionModal');
}

// ---- Aid History CRUD ----
let currentAidFamilyId = null;
let aidHistoryData = [];

async function viewAidHistory(id, name) {
    currentAidFamilyId = id;
    document.getElementById('targetFamilyNameHistory').textContent = name;
    cancelAidHistoryForm();
    await refreshAidHistory();
    openModal('aidHistoryModal');
}

async function refreshAidHistory() {
    try {
        const data = await (await fetch(`/api/edf/families/${currentAidFamilyId}/aid`)).json();
        aidHistoryData = data;
        const tbody = document.getElementById('aidHistoryBody');
        tbody.innerHTML = data.map(h => `
            <tr>
                <td>${new Date(h.date).toLocaleDateString()}</td>
                <td style="text-transform:capitalize">${h.donation_type.replace('_', ' ')}</td>
                <td style="font-weight:600">LKR ${Number(h.amount).toLocaleString()}</td>
                <td>${h.description || '—'}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openAidHistoryForm('edit',${h.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                    <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteAidHistoryRecord(${h.id})" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No aid history recorded</td></tr>';
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

function openAidHistoryForm(mode, aidId = null) {
    const panel = document.getElementById('aidHistoryFormPanel');
    const title = document.getElementById('aidHistoryFormTitle');
    const submitBtn = document.getElementById('aidHistorySubmitBtn');
    const aidData = aidId ? aidHistoryData.find(h => h.id === aidId) : null;

    document.getElementById('aidHistoryRecordId').value = aidData ? aidData.id : '';
    document.getElementById('aidHistoryType').value = aidData ? aidData.donation_type : 'cash';
    document.getElementById('aidHistoryAmount').value = aidData ? aidData.amount : '';
    document.getElementById('aidHistoryDescription').value = aidData ? (aidData.description || '') : '';
    document.getElementById('aidHistoryDate').value = aidData
        ? new Date(aidData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    title.textContent = mode === 'edit' ? 'Edit Aid Record' : 'Add New Aid Record';
    submitBtn.innerHTML = mode === 'edit'
        ? '<i data-lucide="save" style="width:14px;"></i> Update Record'
        : '<i data-lucide="save" style="width:14px;"></i> Save Record';
    panel.style.display = 'block';
    lucide.createIcons();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelAidHistoryForm() {
    const panel = document.getElementById('aidHistoryFormPanel');
    if (panel) panel.style.display = 'none';
    const form = document.getElementById('aidHistoryRecordForm');
    if (form) form.reset();
    const rid = document.getElementById('aidHistoryRecordId');
    if (rid) rid.value = '';
}

async function saveAidHistoryRecord(e) {
    e.preventDefault();
    const recordId = document.getElementById('aidHistoryRecordId').value;
    const payload = {
        donation_type: document.getElementById('aidHistoryType').value,
        amount: document.getElementById('aidHistoryAmount').value,
        description: document.getElementById('aidHistoryDescription').value,
        date: document.getElementById('aidHistoryDate').value,
    };
    const isEdit = !!recordId;
    const url = isEdit
        ? `/api/edf/families/${currentAidFamilyId}/aid/${recordId}`
        : `/api/edf/families/${currentAidFamilyId}/aid`;
    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            cancelAidHistoryForm();
            showToast(isEdit ? 'Aid record updated' : 'Aid record added', 'success');
            await refreshAidHistory();
            fetchFamilies();
            fetchStats();
        } else {
            showToast('Failed to save record', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function deleteAidHistoryRecord(aidId) {
    if (!confirm('Delete this aid record? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/edf/families/${currentAidFamilyId}/aid/${aidId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            showToast('Aid record deleted', 'success');
            await refreshAidHistory();
            fetchFamilies();
            fetchStats();
        } else {
            showToast('Failed to delete record', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

document.getElementById('aidForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
        const res = await fetch(`/api/edf/families/${data.family_id}/aid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('aidDistributionModal');
            e.target.reset();
            showToast('Aid distributed successfully', 'success');
            fetchFamilies();
            fetchStats();
        } else {
            showToast('Failed to process aid', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
});

// ---- Donations Management CRUD ----
let donationData = [];
let _donationTypeFilter = 'all';

async function fetchDonations() {
    try {
        const data = await (await fetch('/api/edf/external-donations')).json();
        donationData = data;
        renderDonations();
        updateDonationStats();
    } catch (err) { console.error(err); }
}

function updateDonationStats() {
    const total = donationData.reduce((s, d) => s + d.amount, 0);
    const zakat = donationData.filter(d => d.donation_type === 'zakat').reduce((s, d) => s + d.amount, 0);
    const sadaqah = donationData.filter(d => d.donation_type === 'sadaqah').reduce((s, d) => s + d.amount, 0);
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('dStatTotal', `LKR ${total.toLocaleString()}`);
    el('dStatZakat', `LKR ${zakat.toLocaleString()}`);
    el('dStatSadaqah', `LKR ${sadaqah.toLocaleString()}`);
    el('dStatCount', donationData.length);
}

function renderDonations() {
    const search = (document.getElementById('donationSearchInput')?.value || '').toLowerCase();
    const typeBadgeColors = {
        zakat:   'background:#d1fae5; color:#065f46;',
        sadaqah: 'background:#fef3c7; color:#92400e;',
        fitrana: 'background:#e0f2fe; color:#0369a1;',
        lillah:  'background:#ede9fe; color:#5b21b6;',
        other:   'background:#f3f4f6; color:#374151;',
    };
    const filtered = donationData.filter(d => {
        const matchType = _donationTypeFilter === 'all' || d.donation_type === _donationTypeFilter;
        const matchSearch = !search ||
            (d.donor_name||'').toLowerCase().includes(search) ||
            (d.recipient_name||'').toLowerCase().includes(search) ||
            d.donation_type.toLowerCase().includes(search) ||
            (d.description || '').toLowerCase().includes(search);
        return matchType && matchSearch;
    });

    const tbody = document.getElementById('donationsBody');
    tbody.innerHTML = filtered.map(d => {
        let nameStr = '', typeStr = '';
        if (d.direction === 'expense') {
            typeStr = '<span style="color:#ef4444;font-weight:600;font-size:0.75rem;"><i data-lucide="arrow-up-right" style="width:12px;vertical-align:middle;"></i> EXPENSE</span>';
            if (d.recipient_type === 'beneficiary') nameStr = `Beneficiary: ${d.beneficiary_name || '#' + d.beneficiary_id} <div style="font-size:0.7rem;color:var(--text-muted);">${d.beneficiary_number||''}</div>`;
            else if (d.recipient_type === 'family') nameStr = `Family: ${d.family_name || '#' + d.family_id}`;
            else nameStr = `${d.recipient_name || 'External Organization'}`;
        } else {
            typeStr = '<span style="color:#10b981;font-weight:600;font-size:0.75rem;"><i data-lucide="arrow-down-left" style="width:12px;vertical-align:middle;"></i> INCOME</span>';
            if (d.donor_type === 'member') nameStr = `Member: ${d.member_name || '#' + d.member_id}`;
            else nameStr = `${d.donor_name || 'External Donor'}`;
        }
        
        return `
        <tr>
            <td>${typeStr}</td>
            <td style="font-weight:500;line-height:1.2;">${nameStr}</td>
            <td><span class="status-badge" style="${typeBadgeColors[d.donation_type] || typeBadgeColors.other} text-transform:capitalize;">${d.donation_type}</span></td>
            <td style="font-weight:600">LKR ${Number(d.amount).toLocaleString()}</td>
            <td style="text-transform:capitalize;color:var(--text-muted);font-size:0.8rem;">${d.payment_method}</td>
            <td style="font-size:0.85rem;">${new Date(d.date).toLocaleDateString()}</td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openDonationModal('edit',${d.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteDonation(${d.id})" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
            </td>
        </tr>
    `}).join('') || `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No donations/transactions found</td></tr>`;
    lucide.createIcons();
}

function filterDonations() { renderDonations(); }

function setDonationTypeFilter(type) {
    _donationTypeFilter = type;
    document.querySelectorAll('[id^="dType-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`dType-${type}`);
    if (btn) btn.classList.add('active');
    renderDonations();
}

window.onDonationDirectionChange = function() {
    const dir = document.getElementById('donationDirection').value;
    document.querySelectorAll('.income-field').forEach(el => el.style.display = dir === 'income' ? 'block' : 'none');
    document.querySelectorAll('.expense-field').forEach(el => el.style.display = dir === 'expense' ? 'block' : 'none');
    if(dir === 'income') onDonorTypeChange();
    if(dir === 'expense') onRecipientTypeChange();
};
window.onDonorTypeChange = function() {
    const dType = document.getElementById('donationDonorType').value;
    const dir = document.getElementById('donationDirection').value;
    if(dir !== 'income') return;
    document.getElementById('donorMemberContainer').style.display = dType === 'member' ? 'block' : 'none';
    document.getElementById('donorNameContainer').style.display = dType === 'external' ? 'block' : 'none';
};
window.onRecipientTypeChange = function() {
    const rType = document.getElementById('donationRecipientType').value;
    const dir = document.getElementById('donationDirection').value;
    if(dir !== 'expense') return;
    document.getElementById('recipientBenContainer').style.display = rType === 'beneficiary' ? 'block' : 'none';
    document.getElementById('recipientFamContainer').style.display = rType === 'family' ? 'block' : 'none';
    document.getElementById('recipientNameContainer').style.display = rType === 'external' ? 'block' : 'none';
};

function openDonationModal(mode, donId = null) {
    const don = donId ? donationData.find(d => d.id === donId) : null;
    
    // Populate Selects
    document.getElementById('donationMemberId').innerHTML = '<option value="">Select Member...</option>' + 
        (typeof currentMembers !== 'undefined' ? currentMembers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('') : '');
    document.getElementById('donationBeneficiaryId').innerHTML = '<option value="">Select Beneficiary...</option>' + 
        (typeof currentBeneficiaries !== 'undefined' ? currentBeneficiaries.map(b => `<option value="${b.id}">${b.male_head_name} (${b.application_number})</option>`).join('') : '');
    document.getElementById('donationFamilyId').innerHTML = '<option value="">Select Family...</option>' + 
        (typeof currentFamilies !== 'undefined' ? currentFamilies.map(f => `<option value="${f.id}">${f.head_name}</option>`).join('') : '');

    document.getElementById('donationRecordId').value = don ? don.id : '';
    document.getElementById('donationDirection').value = don ? (don.direction || 'income') : 'income';
    
    // Income
    document.getElementById('donationDonorType').value = don ? (don.donor_type || 'external') : 'external';
    document.getElementById('donationMemberId').value = don ? (don.member_id || '') : '';
    document.getElementById('donationDonorName').value = don ? (don.donor_name || '') : '';
    document.getElementById('donationDonorPhone').value = don ? (don.donor_phone || '') : '';
    
    // Expense
    document.getElementById('donationRecipientType').value = don ? (don.recipient_type || 'beneficiary') : 'beneficiary';
    document.getElementById('donationBeneficiaryId').value = don ? (don.beneficiary_id || '') : '';
    document.getElementById('donationFamilyId').value = don ? (don.family_id || '') : '';
    document.getElementById('donationRecipientName').value = don ? (don.recipient_name || '') : '';

    // Shared
    document.getElementById('donationAmount').value = don ? don.amount : '';
    document.getElementById('donationDonationType').value = don ? don.donation_type : 'zakat';
    document.getElementById('donationPaymentMethod').value = don ? don.payment_method : 'cash';
    document.getElementById('donationDescription').value = don ? (don.description || '') : '';
    document.getElementById('donationDate').value = don
        ? new Date(don.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    onDonationDirectionChange(); // Setup Visibility

    document.getElementById('donationModalTitle').textContent = mode === 'edit' ? 'Edit Transaction' : 'Record Transaction';
    document.getElementById('donationSubmitBtn').innerHTML = mode === 'edit'
        ? '<i data-lucide="save"></i> Update'
        : '<i data-lucide="save"></i> Save';
    lucide.createIcons();
    openModal('donationModal');
}

async function saveDonation(e) {
    e.preventDefault();
    const id = document.getElementById('donationRecordId').value;
    const payload = {
        direction:      document.getElementById('donationDirection').value,
        donor_type:     document.getElementById('donationDonorType').value,
        member_id:      document.getElementById('donationMemberId').value,
        donor_name:     document.getElementById('donationDonorName').value.trim(),
        donor_phone:    document.getElementById('donationDonorPhone').value.trim(),
        
        recipient_type: document.getElementById('donationRecipientType').value,
        beneficiary_id: document.getElementById('donationBeneficiaryId').value,
        family_id:      document.getElementById('donationFamilyId').value,
        recipient_name: document.getElementById('donationRecipientName').value.trim(),

        amount:         document.getElementById('donationAmount').value,
        donation_type:  document.getElementById('donationDonationType').value,
        payment_method: document.getElementById('donationPaymentMethod').value,
        description:    document.getElementById('donationDescription').value.trim(),
        date:           document.getElementById('donationDate').value,
    };
    const isEdit = !!id;
    const url = isEdit ? `/api/edf/external-donations/${id}` : '/api/edf/external-donations';
    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('donationModal');
            showToast(isEdit ? 'Donation updated' : 'Donation recorded', 'success');
            fetchDonations();
            fetchStats();
        } else {
            const r = await res.json();
            showToast(r.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function deleteDonation(id) {
    if (!confirm('Delete this donation record? The linked transaction will also be removed.')) return;
    try {
        const res = await fetch(`/api/edf/external-donations/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Donation deleted', 'success');
            fetchDonations();
            fetchStats();
        } else {
            showToast('Failed to delete donation', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// BENEFICIARY IMPORT / EXPORT MODULE
// ═══════════════════════════════════════════════════════════════════════════

// ── Column definition ─────────────────────────────────────────────────────
const BEN_EXPORT_COLS = [
    { key: 'application_number',           label: 'Application #'               },
    { key: 'male_head_name',               label: 'Head of Family (Male)'        },
    { key: 'male_head_gender',             label: 'Gender'                       },
    { key: 'male_head_age',                label: 'Age'                          },
    { key: 'male_head_dob',                label: 'Date of Birth'                },
    { key: 'male_head_occupation',         label: 'Occupation'                   },
    { key: 'male_head_address',            label: 'Address'                      },
    { key: 'nic_number',                   label: 'NIC Number'                   },
    { key: 'contact_number',               label: 'Contact Number'               },
    { key: 'home_town',                    label: 'Home Town'                    },
    { key: 'category',                     label: 'Category'                     },
    { key: 'monthly_income',               label: 'Monthly Income (LKR)'         },
    { key: 'living_home_details',          label: 'Living Arrangement'           },
    { key: 'family_status',               label: 'Family Status'                },
    { key: 'special_needs',               label: 'Special Needs'               },
    { key: 'female_head_name',             label: 'Head of Family (Female)'      },
    { key: 'female_head_dob',              label: 'Female DOB'                   },
    { key: 'female_head_occupation',       label: 'Female Occupation'            },
    { key: 'female_head_home_town',        label: 'Female Home Town'             },
    { key: 'female_head_nic',              label: 'Female NIC'                   },
    { key: 'children_count_male',          label: 'Male Children'                },
    { key: 'children_count_female',        label: 'Female Children'              },
    { key: 'children_total_count',         label: 'Total Children'               },
    { key: 'status',                       label: 'Status'                       },
];

// ── Export ────────────────────────────────────────────────────────────────
async function exportBeneficiaries(format) {
    document.getElementById('benExportMenu').style.display = 'none';
    showToast('Preparing export…', 'info');
    try {
        const data = await (await fetch('/api/edf/beneficiaries')).json();
        if (!data.length) { showToast('No beneficiaries to export', 'error'); return; }

        // Map to export shape
        const rows = data.map(b => {
            const row = {};
            BEN_EXPORT_COLS.forEach(c => { row[c.label] = b[c.key] ?? ''; });
            return row;
        });

        if (format === 'csv') {
            const ws   = XLSX.utils.json_to_sheet(rows);
            const csv  = XLSX.utils.sheet_to_csv(ws);
            _benDownloadBlob(csv, `EDF-Beneficiaries-${_dateStamp()}.csv`, 'text/csv');
            showToast(`Exported ${rows.length} records as CSV`, 'success');
        } else {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(rows);
            // Auto column widths
            ws['!cols'] = BEN_EXPORT_COLS.map(c => ({ wch: Math.max(c.label.length + 2, 14) }));
            XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
            XLSX.writeFile(wb, `EDF-Beneficiaries-${_dateStamp()}.xlsx`);
            showToast(`Exported ${rows.length} records as Excel`, 'success');
        }
    } catch (err) { showToast('Export failed', 'error'); console.error(err); }
}

function downloadBenTemplate() {
    document.getElementById('benExportMenu').style.display = 'none';
    const templateRow = {};
    BEN_EXPORT_COLS.forEach(c => {
        const examples = {
            'Application #': 'EDF-0001',
            'Head of Family (Male)': 'Mohamed Ali',
            'Gender': 'male',
            'Age': '45',
            'Date of Birth': '1980-01-15',
            'Occupation': 'Farmer',
            'Address': '12 Main Street, Galgamuwa',
            'NIC Number': '800123456V',
            'Contact Number': '+94711234567',
            'Home Town': 'Galgamuwa',
            'Category': '',
            'Monthly Income (LKR)': '25000',
            'Living Arrangement': 'own house',
            'Family Status': '',
            'Special Needs': '',
            'Status': 'pending',
        };
        templateRow[c.label] = examples[c.label] ?? '';
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([templateRow]);
    ws['!cols'] = BEN_EXPORT_COLS.map(c => ({ wch: Math.max(c.label.length + 2, 16) }));

    // Style header row note (xlsx comment not supported in all viewers — add instructions sheet)
    const wsInfo = XLSX.utils.aoa_to_sheet([
        ['EDF Beneficiary Import Template — Instructions'],
        [''],
        ['Required columns:', 'Head of Family (Male)', 'NIC Number'],
        ['Optional columns:', 'All others are optional'],
        ['Status values:', 'pending (default), Active, deactivate, rejected'],
        ['Gender values:', 'male, female'],
        ['Date format:', 'YYYY-MM-DD  e.g. 1985-06-20'],
        ['Duplicates:', 'Rows with an existing NIC are automatically skipped'],
        [''],
        ['Fill the "Beneficiaries" sheet and upload via the Import button.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaries');
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');
    XLSX.writeFile(wb, `EDF-Beneficiary-Import-Template.xlsx`);
    showToast('Template downloaded', 'success');
}

function toggleBenExportMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('benExportMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close export menu when clicking elsewhere
document.addEventListener('click', () => {
    const m = document.getElementById('benExportMenu');
    if (m) m.style.display = 'none';
});

// ── Import state ──────────────────────────────────────────────────────────
let _benImportRows = [];   // parsed, validated rows ready to submit

function openBenImportModal() {
    resetBenImport();
    openModal('benImportModal');
}

function resetBenImport() {
    _benImportRows = [];
    const fi = document.getElementById('benFileInput');
    if (fi) fi.value = '';
    _benShowImportStep(1);
    const fileInfo = document.getElementById('benImportFileInfo');
    if (fileInfo) fileInfo.style.display = 'none';
    const resultMsg = document.getElementById('benImportResultMsg');
    if (resultMsg) resultMsg.innerHTML = '';
    _benSetSubmitBtn(false, 'Import Records');
}

function _benShowImportStep(step) {
    document.getElementById('benImportStep1').style.display = step === 1 ? 'flex' : 'none';
    const s2 = document.getElementById('benImportStep2');
    s2.style.display       = step === 2 ? 'flex' : 'none';
    s2.style.flexDirection = 'column';
}

function _benSetSubmitBtn(enabled, label) {
    const btn = document.getElementById('benImportSubmitBtn');
    const lbl = document.getElementById('benImportSubmitLabel');
    if (!btn) return;
    btn.disabled       = !enabled;
    btn.style.opacity  = enabled ? '1' : '0.4';
    btn.style.cursor   = enabled ? 'pointer' : 'not-allowed';
    if (lbl) lbl.textContent = label;
}

// ── File handling ─────────────────────────────────────────────────────────
function handleBenImportFile(file) {
    if (!file) return;
    const allowed = ['csv','xlsx','xls'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
        showToast('Please upload a CSV or Excel file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
            _processBenImportData(raw, file.name);
        } catch (err) {
            showToast('Could not parse file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Normalise a header string → db column key
function _normKey(h) {
    // Try direct match against export labels
    const byLabel = BEN_EXPORT_COLS.find(c => c.label.toLowerCase() === h.toLowerCase());
    if (byLabel) return byLabel.key;
    // Fall back to snake_case normalisation
    return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function _processBenImportData(raw, filename) {
    if (!raw.length) { showToast('File is empty', 'error'); return; }

    // Build mapped rows
    const originalHeaders = Object.keys(raw[0]);
    const mapped = raw.map(row => {
        const out = {};
        for (const [h, v] of Object.entries(row)) {
            const key = _normKey(h);
            out[key] = (v === null || v === undefined) ? '' : String(v).trim();
        }
        return out;
    });

    // Validate
    let valid = 0, invalid = 0;
    const preview = mapped.slice(0, 10);
    mapped.forEach(r => {
        if (r.male_head_name && r.nic_number) valid++;
        else invalid++;
    });

    _benImportRows = mapped;

    // Update file info banner
    const fileInfo = document.getElementById('benImportFileInfo');
    fileInfo.style.display = 'flex';
    document.getElementById('benImportFileName').textContent  = filename;
    document.getElementById('benImportRowCount').textContent  = `${raw.length} rows`;

    // Update summary bar
    document.getElementById('benImportTotalRows').textContent   = raw.length;
    document.getElementById('benImportValidRows').textContent   = valid;
    document.getElementById('benImportInvalidRows').textContent = invalid;
    document.getElementById('benImportColCount').textContent    = originalHeaders.length;

    // Build preview table
    const previewCols = BEN_EXPORT_COLS.map(c => c.key).filter(k => mapped[0]?.[k] !== undefined);
    const displayCols = previewCols.length ? previewCols : Object.keys(mapped[0] || {}).slice(0, 10);

    const thead = document.getElementById('benPreviewHead');
    const tbody = document.getElementById('benPreviewBody');
    const thStyle = 'padding:.5rem .75rem; text-align:left; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); border-bottom:1px solid var(--border-color); white-space:nowrap;';
    const tdStyle = 'padding:.45rem .75rem; font-size:.78rem; border-bottom:1px solid var(--border-color); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    const tdErrStyle = tdStyle + ' background:rgba(239,68,68,.06);';

    thead.innerHTML = `<tr><th style="${thStyle}">#</th>${displayCols.map(k => `<th style="${thStyle}">${k.replace(/_/g,' ')}</th>`).join('')}<th style="${thStyle}">Valid?</th></tr>`;
    tbody.innerHTML = preview.map((r, i) => {
        const isValid = r.male_head_name && r.nic_number;
        const badge   = isValid
            ? `<span style="font-size:.7rem; background:#d1fae5; color:#065f46; padding:2px 7px; border-radius:5px;">✓</span>`
            : `<span style="font-size:.7rem; background:#fee2e2; color:#991b1b; padding:2px 7px; border-radius:5px;">✗ Missing required</span>`;
        const rowStyle = isValid ? '' : 'background:rgba(239,68,68,.03);';
        return `<tr style="${rowStyle}">
            <td style="${tdStyle} color:var(--text-muted);">${i + 1}</td>
            ${displayCols.map(k => {
                const v = r[k] || '';
                const err = (k === 'male_head_name' || k === 'nic_number') && !v;
                return `<td style="${err ? tdErrStyle : tdStyle}" title="${v}">${v || '<span style="color:var(--text-muted);">—</span>'}</td>`;
            }).join('')}
            <td style="${tdStyle}">${badge}</td>
        </tr>`;
    }).join('');

    _benShowImportStep(2);
    _benSetSubmitBtn(valid > 0, `Import ${valid} Record${valid !== 1 ? 's' : ''}`);
    lucide.createIcons();
}

// ── Submit ────────────────────────────────────────────────────────────────
async function submitBenImport() {
    const valid = _benImportRows.filter(r => r.male_head_name && r.nic_number);
    if (!valid.length) { showToast('No valid rows to import', 'error'); return; }

    _benSetSubmitBtn(false, 'Importing…');
    const resultMsg = document.getElementById('benImportResultMsg');
    if (resultMsg) resultMsg.innerHTML = '<span style="color:var(--text-muted);">Processing…</span>';

    try {
        const res  = await fetch('/api/edf/beneficiaries/bulk-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(valid),
        });
        const data = await res.json();

        if (res.ok) {
            const parts = [
                `<span style="color:#10b981; font-weight:600;">✓ ${data.inserted} inserted</span>`,
                data.skipped  ? `<span style="color:#f59e0b; font-weight:600;">${data.skipped} skipped (duplicates)</span>` : '',
                data.errors   ? `<span style="color:#ef4444; font-weight:600;">${data.errors} failed</span>` : '',
            ].filter(Boolean).join(' &nbsp;·&nbsp; ');
            if (resultMsg) resultMsg.innerHTML = parts;

            showToast(data.message, 'success');
            fetchBeneficiaries();   // refresh list
            if (data.inserted > 0) {
                setTimeout(() => { closeModal('benImportModal'); resetBenImport(); }, 2200);
            } else {
                _benSetSubmitBtn(false, 'Import Records');
            }
        } else {
            showToast(data.message || 'Import failed', 'error');
            if (resultMsg) resultMsg.innerHTML = `<span style="color:#ef4444;">${data.message}</span>`;
            _benSetSubmitBtn(true, `Retry Import`);
        }
    } catch (err) {
        showToast('Network error', 'error');
        _benSetSubmitBtn(true, 'Retry Import');
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _dateStamp() {
    return new Date().toISOString().slice(0, 10);
}
function _benDownloadBlob(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT MODULE  (admin / super_user only)
// ═══════════════════════════════════════════════════════════════════════════

let _umAllUsers       = [];
let _umOnlinePollTimer = null;

const UM_ALL_PERMISSIONS = [
    { key: 'members',        label: 'Members',        icon: 'users' },
    { key: 'beneficiaries',  label: 'Beneficiaries',  icon: 'hand-heart' },
    { key: 'finance',        label: 'Finance',         icon: 'banknote' },
    { key: 'volunteers',     label: 'Volunteers',      icon: 'heart-handshake' },
    { key: 'courses',        label: 'Programs',        icon: 'graduation-cap' },
    { key: 'ramadan',        label: 'Ramadan',         icon: 'moon' },
    { key: 'reports',        label: 'Reports',         icon: 'bar-chart-2' },
    { key: 'settings',       label: 'Settings',        icon: 'settings-2' },
    { key: 'users',          label: 'User Mgmt',       icon: 'shield-check' },
];

const UM_ROLE_DEFAULTS = {
    admin:      ['members','beneficiaries','finance','volunteers','courses','ramadan','reports','settings','users'],
    super_user: ['members','beneficiaries','finance','volunteers','courses','ramadan','reports','settings','users'],
    manager:    ['members','beneficiaries','finance','volunteers','courses','ramadan','reports'],
    editor:     ['members','beneficiaries','volunteers','courses','ramadan'],
    viewer:     ['members','beneficiaries','finance','volunteers','courses','ramadan','reports'],
    user:       [],
};

// ── Fetch all users ────────────────────────────────────────────────────────
async function fetchAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) return;
        _umAllUsers = await res.json();
        umFilterUsers();
        umRenderOnlineBar();
        umUpdateStats();
        const el = document.getElementById('umLastSynced');
        if (el) el.textContent = 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (err) { console.error('fetchAdminUsers:', err); }
}

// ── Filter + render table ──────────────────────────────────────────────────
function umFilterUsers() {
    const q      = (document.getElementById('umSearch')?.value      || '').toLowerCase();
    const role   = document.getElementById('umRoleFilter')?.value   || '';
    const status = document.getElementById('umStatusFilter')?.value || '';

    const filtered = _umAllUsers.filter(u => {
        const matchQ = !q ||
            (u.full_name  || '').toLowerCase().includes(q) ||
            (u.username   || '').toLowerCase().includes(q) ||
            (u.email      || '').toLowerCase().includes(q);
        const matchR = !role   || u.role   === role;
        const matchS = !status || u.status === status;
        return matchQ && matchR && matchS;
    });

    umRenderTable(filtered);
}

function umRenderTable(users) {
    const tbody = document.getElementById('umTableBody');
    if (!tbody) return;
    const me = _currentUser;

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="um-empty">No users found</td></tr>`;
        lucide.createIcons();
        return;
    }

    tbody.innerHTML = users.map(u => {
        const isMe      = me && u.username === me.username;
        const isOnline  = u.is_online === 1;
        const avatarUrl = u.avatar_url
            ? `<img class="um-avatar-img" src="${u.avatar_url}" alt="${_esc(u.full_name || u.username)}">`
            : `<span style="color:#fff;font-weight:700;font-size:0.8rem;">${(u.full_name || u.username || '?')[0].toUpperCase()}</span>`;

        const lastLogin = u.last_login ? _umRelTime(u.last_login) : 'Never';
        const permCount = (u.permissions || []).length;
        const onlineBadge = isOnline
            ? `<span class="um-status-online"><span class="um-status-dot online"></span>Online</span>`
            : `<span class="um-status-offline"><span class="um-status-dot offline"></span>Offline</span>`;

        const blockBtn = u.status === 'active'
            ? `<button class="um-btn warn" onclick="umBlockUser(${u.id})" title="Block user"><i data-lucide="ban" style="width:13px;"></i> Block</button>`
            : `<button class="um-btn success" onclick="umUnblockUser(${u.id})" title="Unblock user"><i data-lucide="check-circle" style="width:13px;"></i> Unblock</button>`;

        const forceBtn = (isMe || !isOnline) ? '' :
            `<button class="um-btn warn um-signout-live" onclick="umForceLogout(${u.id})" title="Force sign out — user is online now"><i data-lucide="log-out" style="width:13px;"></i> Sign Out</button>`;

        const chPassBtn = isMe ? '' :
            `<button class="um-btn" onclick="umOpenChangePassword(${u.id}, '${_esc(u.full_name || u.username)}')" title="Change password"><i data-lucide="key" style="width:13px;"></i> Password</button>`;

        const delBtn = isMe ? '' :
            `<button class="um-btn danger" onclick="umDeleteUser(${u.id}, '${_esc(u.full_name || u.username)}')" title="Delete user"><i data-lucide="trash-2" style="width:13px;"></i></button>`;

        return `<tr>
            <td>
                <div class="um-user-cell">
                    <div class="um-avatar" style="background:${umRoleColor(u.role)};">
                        ${avatarUrl}
                        <span class="${isOnline ? 'um-online-dot' : 'um-offline-dot'}"></span>
                    </div>
                    <div>
                        <div class="um-user-name">${_esc(u.full_name || u.username)}${isMe ? ' <span style="font-size:0.68rem;color:var(--text-muted);">(you)</span>' : ''}</div>
                        <div class="um-user-sub">@${_esc(u.username)} &bull; ${_esc(u.email)}</div>
                    </div>
                </div>
            </td>
            <td><span class="role-badge role-${u.role}">${u.role.replace('_', ' ')}</span></td>
            <td><span class="${u.status === 'active' ? 'status-active' : 'status-blocked'}">${u.status === 'active' ? 'Active' : 'Blocked'}</span></td>
            <td>${onlineBadge}</td>
            <td class="um-last-seen">${lastLogin}</td>
            <td style="font-size:0.78rem;color:var(--text-muted);">${permCount} module${permCount !== 1 ? 's' : ''}</td>
            <td>
                <div class="um-actions">
                    <button class="um-btn" onclick="openUserModal(${u.id})" title="Edit user"><i data-lucide="edit-2" style="width:13px;"></i> Edit</button>
                    ${blockBtn}
                    ${forceBtn}
                    ${chPassBtn}
                    ${delBtn}
                </div>
            </td>
        </tr>`;
    }).join('');

    lucide.createIcons();
}

function umRoleColor(role) {
    const map = { admin:'#ef4444', super_user:'#d97706', manager:'#6366f1', editor:'#059669', viewer:'#64748b', user:'#94a3b8' };
    return map[role] || '#94a3b8';
}

function umUpdateStats() {
    const total   = _umAllUsers.length;
    const online  = _umAllUsers.filter(u => u.is_online === 1).length;
    const blocked = _umAllUsers.filter(u => u.status === 'blocked').length;
    const admins  = _umAllUsers.filter(u => u.role === 'admin' || u.role === 'super_user').length;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('umTotalCount',   total);
    s('umOnlineCount',  online);
    s('umBlockedCount', blocked);
    s('umAdminCount',   admins);
}

function umRenderOnlineBar() {
    const onlineUsers = _umAllUsers.filter(u => u.is_online === 1);
    const el = document.getElementById('umOnlineChips');
    if (!el) return;
    if (!onlineUsers.length) {
        el.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">No users currently online</span>`;
        return;
    }
    el.innerHTML = onlineUsers.map(u => `
        <span class="um-online-chip" onclick="document.getElementById('umSearch').value='${_esc(u.username)}';umFilterUsers();" title="Click to locate in table">
            <span class="pulse-dot"></span>
            ${_esc(u.full_name || u.username)}
            <span style="opacity:0.6;font-size:0.68rem;">${u.role.replace('_',' ')}</span>
        </span>`).join('');
}

// Relative time helper
function _umRelTime(dt) {
    if (!dt) return '—';
    // SQLite returns UTC without 'Z'; append it so JS parses correctly
    const raw = String(dt).endsWith('Z') ? dt : dt + 'Z';
    const diff = Date.now() - new Date(raw).getTime();
    if (diff < 0)    return 'Just now';
    const s = Math.floor(diff / 1000);
    if (s < 10)  return 'Just now';
    if (s < 60)  return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)  return `${d}d ago`;
    return new Date(raw).toLocaleDateString();
}

function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Modal: Open (create or edit) ───────────────────────────────────────────
function openUserModal(userId) {
    const isEdit = !!userId;
    document.getElementById('userModalTitle').textContent = isEdit ? 'Edit User' : 'Add User';
    document.getElementById('umSaveBtnText').textContent  = isEdit ? 'Save Changes' : 'Create User';
    document.getElementById('umEditId').value = userId || '';
    document.getElementById('umPasswordHint').style.display = isEdit ? 'block' : 'none';
    document.getElementById('umPasswordLabel').innerHTML = isEdit
        ? 'Password'
        : 'Password <span style="color:#ef4444;">*</span>';
    document.getElementById('umPassword').value = '';

    // Build permissions grid
    _umBuildPermGrid();

    if (isEdit) {
        const u = _umAllUsers.find(x => x.id === userId);
        if (!u) return;
        document.getElementById('umFullName').value = u.full_name  || '';
        document.getElementById('umUsername').value = u.username   || '';
        document.getElementById('umEmail').value    = u.email      || '';
        document.getElementById('umRole').value     = u.role       || 'user';

        // Set permissions from user data
        const userPerms = new Set(u.permissions || []);
        document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => {
            cb.checked = userPerms.has(cb.value);
        });
    } else {
        document.getElementById('umFullName').value = '';
        document.getElementById('umUsername').value = '';
        document.getElementById('umEmail').value    = '';
        document.getElementById('umRole').value     = 'user';
        umApplyRoleDefaults(); // pre-check defaults
    }

    openModal('userModal');
    lucide.createIcons();
}

function _umBuildPermGrid() {
    const grid = document.getElementById('umPermGrid');
    if (!grid) return;
    grid.innerHTML = UM_ALL_PERMISSIONS.map(p => `
        <label class="perm-chip">
            <input type="checkbox" value="${p.key}">
            <i data-lucide="${p.icon}" style="width:14px;height:14px;flex-shrink:0;"></i>
            ${p.label}
        </label>`).join('');
    lucide.createIcons();
}

function umApplyRoleDefaults() {
    const role = document.getElementById('umRole')?.value || 'user';
    const defaults = new Set(UM_ROLE_DEFAULTS[role] || []);
    document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => {
        cb.checked = defaults.has(cb.value);
    });
}

function umSelectAllPerms(checked) {
    document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => { cb.checked = checked; });
}

// ── Save user (create or update) ───────────────────────────────────────────
async function saveUser() {
    const id       = document.getElementById('umEditId').value;
    const isEdit   = !!id;
    const username = document.getElementById('umUsername').value.trim();
    const email    = document.getElementById('umEmail').value.trim();
    const fullName = document.getElementById('umFullName').value.trim();
    const role     = document.getElementById('umRole').value;
    const password = document.getElementById('umPassword').value;
    const permissions = Array.from(
        document.querySelectorAll('#umPermGrid input[type=checkbox]:checked')
    ).map(cb => cb.value);

    if (!username || !email) { showToast('Username and email are required', 'error'); return; }
    if (!isEdit && !password) { showToast('Password is required', 'error'); return; }
    if (password && password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }

    const body = { username, email, full_name: fullName, role, permissions };
    if (password) body.password = password;

    try {
        const res = await fetch(
            isEdit ? `/api/admin/users/${id}` : '/api/admin/users',
            { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        );
        const r = await res.json();
        if (res.ok) {
            showToast(r.message, 'success');
            closeModal('userModal');
            fetchAdminUsers();
        } else {
            showToast(r.message || 'Failed to save user', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Block / Unblock ────────────────────────────────────────────────────────
async function umBlockUser(id) {
    const u = _umAllUsers.find(x => x.id === id);
    if (!u) return;
    if (!confirm(`Block account for "${u.full_name || u.username}"? They will be signed out immediately.`)) return;
    try {
        const res = await fetch(`/api/admin/users/${id}/block`, { method: 'POST' });
        const r   = await res.json();
        showToast(r.message, res.ok ? 'success' : 'error');
        if (res.ok) fetchAdminUsers();
    } catch { showToast('Network error', 'error'); }
}

async function umUnblockUser(id) {
    const u = _umAllUsers.find(x => x.id === id);
    if (!u) return;
    try {
        const res = await fetch(`/api/admin/users/${id}/unblock`, { method: 'POST' });
        const r   = await res.json();
        showToast(r.message, res.ok ? 'success' : 'error');
        if (res.ok) fetchAdminUsers();
    } catch { showToast('Network error', 'error'); }
}

// ── Force logout ───────────────────────────────────────────────────────────
async function umForceLogout(id) {
    const u = _umAllUsers.find(x => x.id === id);
    if (!u) return;
    if (!confirm(`Force sign out "${u.full_name || u.username}"? Their current session will be terminated.`)) return;
    try {
        const res = await fetch(`/api/admin/users/${id}/force-logout`, { method: 'POST' });
        const r   = await res.json();
        showToast(r.message, res.ok ? 'success' : 'error');
        if (res.ok) fetchAdminUsers();
    } catch { showToast('Network error', 'error'); }
}

// ── Change password (admin resets another user's password) ────────────────
function umOpenChangePassword(id, name) {
    document.getElementById('cpUserId').value   = id;
    document.getElementById('cpUserName').textContent = name;
    document.getElementById('cpNewPassword').value    = '';
    document.getElementById('cpConfirmPassword').value = '';
    openModal('changePasswordModal');
}

async function saveChangePassword() {
    const id      = parseInt(document.getElementById('cpUserId').value);
    const pass    = document.getElementById('cpNewPassword').value.trim();
    const confirm = document.getElementById('cpConfirmPassword').value.trim();

    if (!pass || pass.length < 8) {
        showToast('Password must be at least 8 characters', 'error'); return;
    }
    if (pass !== confirm) {
        showToast('Passwords do not match', 'error'); return;
    }

    try {
        const res = await fetch(`/api/admin/users/${id}/change-password`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ new_password: pass }),
        });
        const r = await res.json();
        showToast(r.message, res.ok ? 'success' : 'error');
        if (res.ok) { closeModal('changePasswordModal'); fetchAdminUsers(); }
    } catch { showToast('Network error', 'error'); }
}

// ── Delete ─────────────────────────────────────────────────────────────────
async function umDeleteUser(id, name) {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    try {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const r   = await res.json();
        showToast(r.message, res.ok ? 'success' : 'error');
        if (res.ok) fetchAdminUsers();
    } catch { showToast('Network error', 'error'); }
}

async function fetchVolunteers() {
    try {
        const response = await fetch('/api/edf/volunteers');
        const data = await response.json();
        const tbody = document.getElementById('volunteersBody');
        tbody.innerHTML = data.map(v => `
            <tr>
                <td style="font-weight:500">${v.full_name}</td>
                <td>${v.phone || 'N/A'}</td>
                <td>${v.skills || 'N/A'}</td>
                <td><span class="status-badge status-${v.status}">${v.status}</span></td>
                <td>
                    <button class="btn" style="padding:0.4rem; background:#fee2e2; color:#ef4444;" onclick="deleteVolunteer(${v.id})" title="Remove"><i data-lucide="trash-2" style="width:16px;"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center">No volunteers registered yet</td></tr>';
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

async function deleteVolunteer(id) {
    if (!confirm('Remove this volunteer?')) return;
    try {
        const res = await fetch(`/api/edf/volunteers/${id}`, { method: 'DELETE' });
        if (res.ok) fetchVolunteers();
    } catch (err) { console.error(err); }
}

// Volunteer Form Handler
document.getElementById('volunteerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
        const res = await fetch('/api/edf/volunteers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('volunteerModal');
            fetchVolunteers();
            e.target.reset();
        }
    } catch (err) { console.error(err); }
});

// Zakat Calculator Logic
function calculateZakat() {
    const cash = parseFloat(document.getElementById('zakatCash').value) || 0;
    const gold = parseFloat(document.getElementById('zakatGold').value) || 0;
    const invest = parseFloat(document.getElementById('zakatInvest').value) || 0;
    const debts = parseFloat(document.getElementById('zakatDebts').value) || 0;

    const netAssets = (cash + gold + invest) - debts;
    const zakatPayable = netAssets > 0 ? netAssets * 0.025 : 0;

    document.getElementById('zakatResult').textContent = `LKR ${zakatPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Modal Handlers
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Close any open modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.modal[style*="flex"]');
    if (open) closeModal(open.id);
});

// Logout Handler
async function doLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* ignore network errors — still redirect */ }
    window.location.href = '/login';
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN / LOGOUT  NOTIFICATIONS  (admin & super_user only)
// ═══════════════════════════════════════════════════════════════════════════

let _loginEventPollTimer = null;
let _loginEventLastSince = null;   // ISO timestamp of newest event seen

/**
 * Begin polling /api/admin/login-events every 8 seconds.
 * On first call we anchor "since" to now so we don't flood old events.
 */
function _startLoginEventPolling() {
    // Anchor: ignore events before the page loaded
    _loginEventLastSince = new Date().toISOString();

    _loginEventPollTimer = setInterval(_pollLoginEvents, 8000);
}

async function _pollLoginEvents() {
    try {
        const since = _loginEventLastSince
            ? `?since=${encodeURIComponent(_loginEventLastSince)}`
            : '';
        const res = await fetch(`/api/admin/login-events${since}`);
        if (!res.ok) return;

        const events = await res.json();
        if (!Array.isArray(events) || events.length === 0) return;

        // Update anchor to the newest event we just received
        const newest = events[events.length - 1];
        _loginEventLastSince = newest.created_at
            ? (String(newest.created_at).endsWith('Z')
                ? newest.created_at
                : newest.created_at + 'Z')
            : new Date().toISOString();

        // Process each event
        events.forEach(ev => _handleLoginEvent(ev));

        // Refresh the overview active-users widget too
        fetchOvActiveUsers();

    } catch (err) {
        console.warn('Login event poll error:', err);
    }
}

/**
 * Show a toast + add a notification bell entry for a login/logout event.
 */
function _handleLoginEvent(ev) {
    const displayName = ev.full_name || ev.username || 'Unknown';
    const roleLabel   = (ev.role || 'user').replace('_', ' ');

    let icon, title, desc, toastType, bgStyle, iconName;

    switch (ev.event_type) {
        case 'login':
            icon      = 'log-in';
            iconName  = 'log-in';
            title     = `${displayName} signed in`;
            desc      = `${roleLabel} · just now`;
            toastType = 'info';
            bgStyle   = 'background:rgba(99,102,241,0.12); color:#6366f1;';
            break;
        case 'logout':
            icon      = 'log-out';
            iconName  = 'log-out';
            title     = `${displayName} signed out`;
            desc      = `${roleLabel} · just now`;
            toastType = 'warning';
            bgStyle   = 'background:rgba(245,158,11,0.12); color:#d97706;';
            break;
        case 'force_logout':
            icon      = 'shield-off';
            iconName  = 'shield-off';
            title     = `${displayName} was force signed out`;
            desc      = `${roleLabel} · admin action`;
            toastType = 'error';
            bgStyle   = 'background:rgba(239,68,68,0.12); color:#ef4444;';
            break;
        default:
            return;
    }

    // ── Toast notification ────────────────────────────────────────────────
    _showLoginToast(title, `${desc}`, ev.event_type);

    // ── Add to bell dropdown list ─────────────────────────────────────────
    const notif = {
        id:    Date.now() + Math.random(),
        icon:  iconName,
        title,
        desc:  `${roleLabel} account`,
        time:  'Just now',
        style: bgStyle,
        eventType: ev.event_type,
    };
    dummyNotifications.unshift(notif);
    // Keep list bounded
    if (dummyNotifications.length > 20) dummyNotifications.length = 20;

    // Show the red dot on the bell
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = '';

    // If the dropdown is already open, re-render it
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        _renderNotifDropdown();
    }
}

/** Render the current dummyNotifications into the bell dropdown */
function _renderNotifDropdown() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;
    if (!dummyNotifications.length) {
        notifList.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">No new notifications</div>`;
        return;
    }
    notifList.innerHTML = dummyNotifications.map(n => `
        <div class="notif-item">
            <div class="notif-icon" style="${n.style}"><i data-lucide="${n.icon}" style="width:18px;height:18px;"></i></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-desc">${n.desc}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

/**
 * A dedicated quiet toast for login/logout events — smaller and dismisses quickly.
 */
function _showLoginToast(title, subtitle, type) {
    const colors = {
        info:    { bg: 'rgba(99,102,241,0.95)',  icon: '🔵' },
        warning: { bg: 'rgba(245,158,11,0.95)',  icon: '🟡' },
        error:   { bg: 'rgba(239,68,68,0.95)',   icon: '🔴' },
    };
    const c = colors[type] || colors.info;

    // Reuse the existing showToast if available
    if (typeof showToast === 'function') {
        showToast(`${title} — ${subtitle}`, type === 'info' ? 'info' : (type === 'warning' ? 'warning' : 'error'));
        return;
    }

    // Fallback inline toast
    const el = document.createElement('div');
    el.style.cssText = `
        position:fixed; bottom:1.5rem; right:1.5rem; z-index:99999;
        background:${c.bg}; color:#fff;
        padding:0.75rem 1.25rem; border-radius:12px;
        font-size:0.85rem; font-weight:600;
        box-shadow:0 8px 24px rgba(0,0,0,0.25);
        display:flex; align-items:center; gap:0.5rem;
        animation:slideInRight 0.3s ease;
    `;
    el.innerHTML = `<span>${c.icon}</span><span>${title}<br><span style="font-weight:400;opacity:0.85;">${subtitle}</span></span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW — ACTIVE USERS WIDGET
// ═══════════════════════════════════════════════════════════════════════════

let _ovAuPollTimer = null;

/**
 * Fetch the user online-summary and render the Overview Active Users widget.
 */
async function fetchOvActiveUsers() {
    try {
        const res = await fetch('/api/admin/users/online-summary');
        if (!res.ok) return;
        const users = await res.json();
        _renderOvActiveUsers(users);
    } catch (err) {
        console.warn('fetchOvActiveUsers error:', err);
    }
}

function _renderOvActiveUsers(users) {
    const list = document.getElementById('ovAuList');
    const countEl = document.getElementById('ovAuOnlineCount');
    if (!list) return;

    const online = users.filter(u => u.is_online === 1);

    if (countEl) {
        countEl.textContent = online.length
            ? `${online.length} online now`
            : 'No one online';
    }

    if (!users.length) {
        list.innerHTML = `<div class="ov-au-empty">No users to display</div>`;
        return;
    }

    list.innerHTML = users.map(u => {
        const isOnline   = u.is_online === 1;
        const initials   = (u.full_name || u.username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const avatarColors = { admin:'#ef4444', super_user:'#d97706', manager:'#6366f1', editor:'#059669', viewer:'#64748b', user:'#94a3b8' };
        const bgColor    = avatarColors[u.role] || '#6366f1';

        const avatarContent = u.avatar_url
            ? `<img src="${_esc(u.avatar_url)}" alt="${_esc(u.full_name || u.username)}">`
            : `<span style="font-size:0.75rem;font-weight:700;color:#fff;">${initials}</span>`;

        const lastSeenStr = u.last_login ? _umRelTime(u.last_login) : 'Never';
        const roleLabel   = (u.role || 'user').replace('_', ' ');

        return `
        <div class="ov-au-row">
            <div class="ov-au-avatar" style="background:${bgColor};">
                ${avatarContent}
                <span class="ov-au-dot ${isOnline ? 'online' : 'offline'}"></span>
            </div>
            <div class="ov-au-info">
                <div class="ov-au-name">${_esc(u.full_name || u.username)}</div>
                <div class="ov-au-meta">${roleLabel} · ${isOnline ? '<span style="color:#10b981;font-weight:600;">Online</span>' : `Last seen ${lastSeenStr}`}</div>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

// Member Live Search
document.getElementById('memberSearchInput')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#membersBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

// ═══════════════════════════════════════════════════════
//  ACTIVITY LOG & MONITORING
// ═══════════════════════════════════════════════════════

let _logTypeFilter    = 'all';
let _logOffset        = 0;
const LOG_PAGE_SIZE   = 100;
let _logSearchTimer   = null;
let _logAutoRefreshTimer = null;

// ── Map raw action strings to display metadata ─────────────────────────────
function logActionMeta(action) {
    if (!action) return { label: 'Unknown', cls: 'log-badge-read', rowCls: '' };
    const a = action.toUpperCase();
    if (a === 'POST')        return { label: 'Create',  cls: 'log-badge-create',  rowCls: 'lr-create' };
    if (a === 'PUT' || a === 'PATCH') return { label: 'Update', cls: 'log-badge-update', rowCls: 'lr-update' };
    if (a === 'DELETE')           return { label: 'Delete',      cls: 'log-badge-delete',  rowCls: 'lr-delete' };
    if (a === 'LOGIN')            return { label: 'Login',       cls: 'log-badge-login',   rowCls: 'lr-auth'   };
    if (a === 'LOGOUT')           return { label: 'Logout',      cls: 'log-badge-logout',  rowCls: 'lr-auth'   };
    if (a === 'BLOCK_USER')       return { label: 'Block',       cls: 'log-badge-admin',   rowCls: 'lr-admin'  };
    if (a === 'UNBLOCK_USER')     return { label: 'Unblock',     cls: 'log-badge-admin',   rowCls: 'lr-admin'  };
    if (a === 'FORCE_LOGOUT')     return { label: 'Force Out',   cls: 'log-badge-admin',   rowCls: 'lr-admin'  };
    if (a === 'BULK_IMPORT')      return { label: 'Import',      cls: 'log-badge-create',  rowCls: 'lr-create' };
    if (a === 'ASSIGN_ALL_TOKENS')return { label: 'Assign All',  cls: 'log-badge-ramadan', rowCls: 'lr-create' };
    if (a === 'ASSIGN_TOKEN')     return { label: 'Assign',      cls: 'log-badge-ramadan', rowCls: 'lr-create' };
    if (a === 'COLLECT_TOKEN')    return { label: 'Collect',     cls: 'log-badge-ramadan', rowCls: 'lr-update' };
    if (a === 'MARK_ABSENT')      return { label: 'Absent',      cls: 'log-badge-ramadan', rowCls: 'lr-update' };
    if (a === 'MARK_PENDING')     return { label: 'Pending',     cls: 'log-badge-ramadan', rowCls: 'lr-update' };
    if (a === 'VERIFY_TOKEN')     return { label: 'Verify',      cls: 'log-badge-ramadan', rowCls: 'lr-update' };
    if (a.startsWith('ERROR'))    return { label: 'Error',       cls: 'log-badge-error',   rowCls: 'lr-error'  };
    return { label: action.replace(/_/g,' '), cls: 'log-badge-read', rowCls: '' };
}

// ── Relative time (e.g. "3 min ago") ──────────────────────────────────────
function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
}

// ── Format absolute timestamp ──────────────────────────────────────────────
function fmtLogTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) +
           '\n' + d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

// ── Fetch stats cards ──────────────────────────────────────────────────────
async function fetchLogStats() {
    try {
        const res = await fetch('/api/logs/stats');
        if (!res.ok) return;
        const s = await res.json();
        if (!s || typeof s !== 'object') return;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val ?? 0).toLocaleString(); };
        set('logStatTotal',  s.total);
        set('logStatToday',  s.todayCount);
        set('logStatErrors', s.errorsToday);
        set('logStatUsers',  s.activeUsers);
    } catch (err) { console.error('fetchLogStats:', err); }
}

// ── Populate user filter dropdown ──────────────────────────────────────────
async function loadLogUserFilter() {
    try {
        const res   = await fetch('/api/logs/users');
        if (!res.ok) return;
        const users = await res.json();
        const sel   = document.getElementById('logUserFilter');
        if (!sel) return;
        const existing = new Set(Array.from(sel.options).map(o => o.value));
        users.forEach(u => {
            if (!existing.has(String(u.id))) {
                const opt = document.createElement('option');
                opt.value       = u.id;
                opt.textContent = u.full_name || u.username;
                sel.appendChild(opt);
            }
        });
    } catch (_) {}
}

// ── Main fetch & render ────────────────────────────────────────────────────
async function fetchSystemLogs(reset = false) {
    if (reset) _logOffset = 0;

    const type    = _logTypeFilter !== 'all' ? _logTypeFilter : '';
    const entity  = document.getElementById('logEntityFilter')?.value  || 'all';
    const userId  = document.getElementById('logUserFilter')?.value    || 'all';
    const from    = document.getElementById('logDateFrom')?.value      || '';
    const to      = document.getElementById('logDateTo')?.value        || '';
    const search  = document.getElementById('logSearchInput')?.value?.trim() || '';

    const params = new URLSearchParams({
        limit:  LOG_PAGE_SIZE,
        offset: _logOffset,
        ...(type             && { type }),
        ...(entity !== 'all' && { entity }),
        ...(userId !== 'all' && { user_id: userId }),
        ...(from             && { from }),
        ...(to               && { to }),
        ...(search           && { search }),
    });

    const body = document.getElementById('systemLogsBody');
    if (_logOffset === 0) body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.875rem;">Loading…</div>';

    try {
        const res = await fetch(`/api/logs/system-logs?${params}`);
        if (!res.ok) throw new Error('Failed to fetch logs');
        const result = await res.json();
        const logs  = Array.isArray(result) ? result : (Array.isArray(result.logs) ? result.logs : []);
        const total = Array.isArray(result) ? result.length : (result.total ?? logs.length);

        // Update count labels
        const countEl = document.getElementById('logFilterCount');
        if (countEl) countEl.textContent = `${total.toLocaleString()} event${total !== 1 ? 's' : ''}`;
        const shownEl = document.getElementById('logStatShown');
        if (shownEl) shownEl.textContent = total.toLocaleString();

        if (_logOffset === 0) body.innerHTML = '';

        if (logs.length === 0 && _logOffset === 0) {
            body.innerHTML = `<div class="log-empty">
                <i data-lucide="inbox" style="width:36px;height:36px;display:block;margin:0 auto 0.75rem;opacity:0.4;"></i>
                <p>No activity found matching your filters.</p>
            </div>`;
            lucide.createIcons();
            document.getElementById('logLoadMoreBtn').style.display = 'none';
            return;
        }

        const fragment = document.createDocumentFragment();

        logs.forEach(log => {
            const meta    = logActionMeta(log.action);
            const details = safeParseLogDetails(log.details);
            const desc    = details.description || `${log.action} on ${log.entity}`;
            const errMsg  = details.error || '';
            const userName = log.full_name || log.username || 'System';
            const initial  = userName.charAt(0).toUpperCase();
            const [timeLine, dateLine] = fmtLogTime(log.created_at).split('\n');
            const ip = (log.ip_address || '').replace(/^::ffff:/, '').replace(/^::1$/, 'localhost');
            const avatarColor = _logAvatarColor(log.user_role || 'user');

            // Build expandable detail JSON (hide large arrays)
            const detailDisplay = { ...details };
            delete detailDisplay.description;
            const detailJson = Object.keys(detailDisplay).length
                ? JSON.stringify(detailDisplay, null, 2)
                : null;

            const wrapper = document.createElement('div');

            // Main row
            const row = document.createElement('div');
            row.className = `log-row ${meta.rowCls}`;
            row.title = 'Click to expand details';
            row.innerHTML = `
                <div>
                    <div class="log-time-abs">${timeLine}</div>
                    <div class="log-time-rel">${dateLine} &middot; ${timeAgo(log.created_at)}</div>
                </div>
                <div class="log-user-cell">
                    <div class="log-avatar" style="background:${avatarColor};">${initial}</div>
                    <div>
                        <div class="log-username">${escapeHtml(userName)}</div>
                        <div class="log-role">${log.username ? '@' + escapeHtml(log.username) : 'system'}</div>
                    </div>
                </div>
                <div><span class="log-badge ${meta.cls}">${meta.label}</span></div>
                <div><span class="log-entity-chip">${escapeHtml((log.entity || 'SYSTEM').toLowerCase())}</span>
                    ${log.entity_id ? `<span style="font-size:0.68rem;color:var(--text-muted);margin-left:0.25rem;">#${log.entity_id}</span>` : ''}
                </div>
                <div>
                    <div class="log-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>
                    ${errMsg ? `<div class="log-desc-sub" style="color:#ef4444;">&excl; ${escapeHtml(errMsg)}</div>` : ''}
                </div>
                <div class="log-ip" title="${ip}">${ip || '—'}</div>
            `;

            // Expandable detail panel
            const detail = document.createElement('div');
            detail.className = 'log-detail-panel';
            detail.innerHTML = `
                <div class="log-detail-grid">
                    <div class="log-detail-item">
                        <span class="ldi-label">Log ID</span>
                        <span class="ldi-val">#${log.id}</span>
                    </div>
                    <div class="log-detail-item">
                        <span class="ldi-label">Timestamp</span>
                        <span class="ldi-val">${new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div class="log-detail-item">
                        <span class="ldi-label">Action</span>
                        <span class="ldi-val">${escapeHtml(log.action)}</span>
                    </div>
                    <div class="log-detail-item">
                        <span class="ldi-label">Module / Entity</span>
                        <span class="ldi-val">${escapeHtml(log.entity)}${log.entity_id ? ' #' + log.entity_id : ''}</span>
                    </div>
                    <div class="log-detail-item">
                        <span class="ldi-label">User</span>
                        <span class="ldi-val">${escapeHtml(log.full_name || log.username || 'System')}</span>
                    </div>
                    <div class="log-detail-item">
                        <span class="ldi-label">IP Address</span>
                        <span class="ldi-val">${ip || '—'}</span>
                    </div>
                    <div class="log-detail-item" style="grid-column:1/-1;">
                        <span class="ldi-label">Description</span>
                        <span class="ldi-val">${escapeHtml(desc)}</span>
                    </div>
                    ${errMsg ? `<div class="log-detail-item" style="grid-column:1/-1;">
                        <span class="ldi-label" style="color:#ef4444;">Error</span>
                        <span class="ldi-val" style="color:#ef4444;">${escapeHtml(errMsg)}</span>
                    </div>` : ''}
                </div>
                ${detailJson ? `<div class="log-detail-json">${escapeHtml(detailJson)}</div>` : ''}
            `;

            row.addEventListener('click', () => {
                detail.classList.toggle('open');
                row.style.background = detail.classList.contains('open') ? 'var(--glow-bg)' : '';
            });

            wrapper.appendChild(row);
            wrapper.appendChild(detail);
            fragment.appendChild(wrapper);
        });

        body.appendChild(fragment);

        _logOffset += logs.length;
        const loadMoreBtn = document.getElementById('logLoadMoreBtn');
        loadMoreBtn.style.display = _logOffset < total ? '' : 'none';
        if (_logOffset < total) {
            loadMoreBtn.innerHTML = `<i data-lucide="chevrons-down" style="width:15px;"></i> Load more (${(total - _logOffset).toLocaleString()} remaining)`;
        }

        lucide.createIcons();
    } catch (err) {
        console.error('fetchSystemLogs:', err);
        body.innerHTML = '<div class="log-empty"><p>Failed to load logs. Check server connection.</p></div>';
    }
}

function _logAvatarColor(role) {
    const m = { admin:'#ef4444', super_user:'#d97706', manager:'#6366f1', editor:'#059669', viewer:'#64748b' };
    return m[role] || '#6366f1';
}

function loadMoreLogs() { fetchSystemLogs(false); }

function setLogTypeFilter(type, btn) {
    _logTypeFilter = type;
    btn.closest('div').querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fetchSystemLogs(true);
}

function debounceLogSearch() {
    clearTimeout(_logSearchTimer);
    _logSearchTimer = setTimeout(() => fetchSystemLogs(true), 350);
}

function clearLogFilters() {
    _logTypeFilter = 'all';
    document.querySelectorAll('.log-type-pills .filter-pill').forEach((b, i) => {
        b.classList.toggle('active', i === 0);
    });
    const ids = ['logEntityFilter','logUserFilter','logDateFrom','logDateTo','logSearchInput'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = el.tagName === 'SELECT' ? (el.options[0]?.value || 'all') : '';
    });
    fetchSystemLogs(true);
}

function toggleLogAutoRefresh(enabled) {
    clearInterval(_logAutoRefreshTimer);
    const badge = document.getElementById('logAutoRefreshBadge');
    if (badge) badge.style.display = enabled ? 'inline-flex' : 'none';
    if (enabled) {
        _logAutoRefreshTimer = setInterval(() => {
            fetchLogStats();
            fetchSystemLogs(true);
        }, 30000); // every 30 seconds
    }
}

function exportLogs() {
    const type   = _logTypeFilter !== 'all' ? _logTypeFilter : '';
    const entity = document.getElementById('logEntityFilter')?.value  || 'all';
    const userId = document.getElementById('logUserFilter')?.value    || 'all';
    const from   = document.getElementById('logDateFrom')?.value      || '';
    const to     = document.getElementById('logDateTo')?.value        || '';
    const search = document.getElementById('logSearchInput')?.value?.trim() || '';

    const params = new URLSearchParams({
        ...(type             && { type }),
        ...(entity !== 'all' && { entity }),
        ...(userId !== 'all' && { user_id: userId }),
        ...(from             && { from }),
        ...(to               && { to }),
        ...(search           && { search }),
    });

    const a = document.createElement('a');
    a.href = `/api/logs/export?${params}`;
    a.download = `edf-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

async function clearAllSystemLogs() {
    if (!confirm('Permanently delete ALL system logs? This cannot be undone.')) return;
    try {
        const res = await fetch('/api/logs/system-logs', { method: 'DELETE' });
        if (res.ok) {
            showToast('All logs cleared', 'success');
            fetchLogStats();
            fetchSystemLogs(true);
        } else {
            showToast('Failed to clear logs', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error', 'error');
    }
}

function safeParseLogDetails(raw) {
    if (!raw) return {};
    try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (_) { return { description: raw }; }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let dummyNotifications = [];

function markAllNotificationsAsRead() {
    dummyNotifications = [];
    
    // Clear top bar dot
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';

    // Clear top bar list
    const notifList = document.getElementById('notifList');
    if (notifList) notifList.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">No new notifications</div>`;

    // Clear full page list if active
    const fullList = document.getElementById('fullNotificationList');
    if (fullList) {
        fullList.innerHTML = `
            <div style="padding:4rem;text-align:center;color:var(--text-muted);">
                <i data-lucide="bell-off" style="width:48px;height:48px;margin-bottom:1rem;color:#cbd5e1;opacity:0.5;"></i>
                <div style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;color:var(--text-main);">You're all caught up!</div>
                <div>There are no active notifications to show right now.</div>
            </div>`;
        lucide.createIcons();
    }
}

function renderNotificationsPage() {
    const fullList = document.getElementById('fullNotificationList');
    if (!fullList) return;
    
    if (dummyNotifications.length === 0) {
        markAllNotificationsAsRead();
        return;
    }

    let html = '';
    dummyNotifications.forEach(n => {
        html += `
            <div style="display:flex; gap:1.5rem; padding:1.5rem 2.5rem; border-bottom:1px solid var(--border-color); align-items:flex-start; background:var(--bg-main); transition:var(--transition); cursor:pointer;" onmouseover="this.style.background='var(--bg-card)'" onmouseout="this.style.background='var(--bg-main)'">
                <div class="notif-icon" style="${n.style} width:54px; height:54px; flex-shrink:0;"><i data-lucide="${n.icon}" style="width:26px;height:26px;"></i></div>
                <div style="flex:1;">
                    <div style="font-size:1.1rem; font-weight:600; color:var(--text-main); margin-bottom:0.25rem;">${n.title}</div>
                    <div style="font-size:0.95rem; color:var(--text-muted); margin-bottom:0.4rem;">${n.desc}</div>
                    <div style="font-size:0.8rem; color:#94a3b8; font-weight:600;">${n.time}</div>
                </div>
            </div>
        `;
    });
    fullList.innerHTML = html;
    lucide.createIcons();
}

// Top Bar Interactivity
function initTopBar() {
    const userBtn = document.getElementById('userProfileBtn');
    const userDropdown = document.getElementById('userDropdown');
    const notifBtn = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const searchWrapper = document.getElementById('topSearchWrapper');
    const searchInput = document.getElementById('topSearchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');

    // Bind Mark All Read handlers
    document.getElementById('markAllReadBtn')?.addEventListener('click', (e) => { e.stopPropagation(); markAllNotificationsAsRead(); });
    document.getElementById('markAllReadPageBtn')?.addEventListener('click', markAllNotificationsAsRead);

    // Theme Toggle
    if (themeToggleBtn && themeIcon) {
        // We sync with the customizer settings 'edf-theme'
        const currentTheme = localStorage.getItem('edf-theme') || 'light';
        const actualTheme = currentTheme === 'system' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
            : currentTheme;
            
        themeIcon.setAttribute('data-lucide', actualTheme === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();

        // Make window.updateIcon explicitly available to the customizer if it switches themes via Settings tab
        window.updateIcon = (resolved) => {
            if (themeIcon) {
                themeIcon.setAttribute('data-lucide', resolved === 'dark' ? 'sun' : 'moon');
                lucide.createIcons();
            }
        };

        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            
            if (typeof applyThemePick === 'function') {
                applyThemePick(newTheme);
            } else {
                if (newTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
                else document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('edf-theme', newTheme);
                window.updateIcon(newTheme);
            }
        });
    }

    // Toggle User Profile
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown?.classList.remove('show');
            searchDropdown?.classList.remove('show');
            userDropdown.classList.toggle('show');
        });
    }

    // Toggle Notifications
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown?.classList.remove('show');
            searchDropdown?.classList.remove('show');
            notifDropdown.classList.toggle('show');
            // Always re-render from the live array
            _renderNotifDropdown();
        });
    }

    // Handle Search Focus / Input
    if (searchInput && searchDropdown) {
        searchInput.addEventListener('focus', () => {
            userDropdown?.classList.remove('show');
            notifDropdown?.classList.remove('show');
            if (searchInput.value.trim().length > 0) searchDropdown.classList.add('show');
        });

        searchInput.addEventListener('keyup', (e) => {
            const val = e.target.value.trim();
            if (val.length > 0) {
                searchDropdown.classList.add('show');
                searchDropdown.innerHTML = `<div style="padding:1rem;color:var(--text-main);font-size:0.85rem;"><i data-lucide="search" style="width:14px;vertical-align:middle;margin-right:8px;color:var(--text-muted);"></i>Searching "${escapeHtml(val)}" across database...</div>`;
                lucide.createIcons();
                // Simulated search result delay
                clearTimeout(window.searchTimeout);
                window.searchTimeout = setTimeout(() => {
                    searchDropdown.innerHTML = `
                        <div style="padding:0.75rem 1rem;font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border-color);">Results for "${escapeHtml(val)}"</div>
                        <a href="#" class="dropdown-item" onclick="switchTab('members')" style="border-radius:0;border-bottom:1px solid var(--border-color);">
                            <div style="width:28px;height:28px;border-radius:6px;background:var(--glow-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;"><i data-lucide="users" style="width:14px;height:14px;"></i></div>
                            <div><div style="font-weight:600;font-size:0.85rem;line-height:1.2;">Jump to Members</div><div style="font-size:0.75rem;color:var(--text-muted);line-height:1;">Search in members list</div></div>
                        </a>
                        <a href="#" class="dropdown-item" onclick="switchTab('beneficiaries')" style="border-radius:0;">
                            <div style="width:28px;height:28px;border-radius:6px;background:var(--glow-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;"><i data-lucide="heart" style="width:14px;height:14px;"></i></div>
                            <div><div style="font-weight:600;font-size:0.85rem;line-height:1.2;">Jump to Beneficiaries</div><div style="font-size:0.75rem;color:var(--text-muted);line-height:1;">Search in beneficiary records</div></div>
                        </a>
                    `;
                    lucide.createIcons();
                }, 600);
            } else {
                searchDropdown.classList.remove('show');
                searchDropdown.innerHTML = `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Type to search across EDF...</div>`;
            }
        });
        
        searchWrapper.addEventListener('click', e => e.stopPropagation());
    }

    // Close all dropdowns on outside document click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#userProfileBtn')) userDropdown?.classList.remove('show');
        if (!e.target.closest('#notifBellBtn') && !e.target.closest('#notifDropdown')) notifDropdown?.classList.remove('show');
        if (!e.target.closest('#topSearchWrapper')) searchDropdown?.classList.remove('show');
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchUser();
    fetchStats();
    initTopBar();
    updateSidebarBranding();
    // Heartbeat: ping every 10 s to keep last_seen accurate AND detect force-logout / block.
    setInterval(async () => {
        try {
            const r = await fetch('/api/auth/heartbeat', { method: 'POST' });
            if (r.status === 401) {
                // Session terminated (force-logout) — go to login
                window.location.href = '/login';
            } else if (r.status === 403) {
                // Account blocked — go to login
                window.location.href = '/login';
            }
        } catch {}
    }, 10000);
});

// Extra protection for back-button navigation
window.addEventListener('pageshow', (event) => {
    // If the page is being loaded from the browser cache (BFCache)
    if (event.persisted) {
        // Redo user check to ensure session is still valid
        fetchUser();
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// RAMADAN TOKEN DISTRIBUTION MODULE
// ═══════════════════════════════════════════════════════════════════════════

let ramadanDistData = [];
let _rdCurrentDistId = null;
let _rdTokenData    = [];
let _rdTokFilter    = 'all';
let _rdTokSortCol   = 'token_number';
let _rdTokSortDir   = 'asc';
let _rdTokPage      = 1;
let _rdTokPageSize  = 20;

// ── Distributions ──────────────────────────────────────────────────────────

async function fetchRamadanDistributions() {
    try {
        const data = await (await fetch('/api/ramadan/distributions')).json();
        ramadanDistData = data;
        renderRamadanDistributions();
        updateRamadanStats();
    } catch (err) { console.error(err); }
}

function updateRamadanStats() {
    const totalDists   = ramadanDistData.length;
    const totalTokens  = ramadanDistData.reduce((s, d) => s + (d.total_tokens   || 0), 0);
    const totalCollect = ramadanDistData.reduce((s, d) => s + (d.collected_count || 0), 0);
    const totalPending = ramadanDistData.reduce((s, d) => s + (d.pending_count   || 0), 0);
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('rdStatTotal',     totalDists);
    el('rdStatTokens',    totalTokens);
    el('rdStatCollected', totalCollect);
    el('rdStatPending',   totalPending);
}

function renderRamadanDistributions() {
    const search = (document.getElementById('ramadanSearchInput')?.value || '').toLowerCase();
    const statusColors = {
        active:    'background:#d1fae5; color:#065f46;',
        completed: 'background:#e0f2fe; color:#0369a1;',
        cancelled: 'background:#fee2e2; color:#991b1b;',
    };
    const filtered = ramadanDistData.filter(d =>
        !search ||
        d.title.toLowerCase().includes(search) ||
        String(d.year).includes(search) ||
        (d.collection_location || '').toLowerCase().includes(search)
    );

    const tbody = document.getElementById('ramadanDistBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(d => {
        const total     = d.total_tokens    || 0;
        const collected = d.collected_count || 0;
        const pct       = total ? Math.round((collected / total) * 100) : 0;
        const collDate  = d.collection_date ? new Date(d.collection_date).toLocaleDateString() : '—';
        return `
        <tr>
            <td style="font-weight:500">${d.title}</td>
            <td>${d.year}</td>
            <td>${collDate}</td>
            <td style="color:var(--text-muted)">${d.collection_location || '—'}</td>
            <td style="font-weight:600">${d.voucher_value ? 'LKR ' + Number(d.voucher_value).toLocaleString() : '—'}</td>
            <td>${total}</td>
            <td style="min-width:120px;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div style="flex:1; height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:#10b981; border-radius:3px;"></div>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">${collected}/${total}</span>
                </div>
            </td>
            <td><span class="status-badge" style="${statusColors[d.status] || statusColors.active} text-transform:capitalize;">${d.status}</span></td>
            <td style="text-align:right; white-space:nowrap;">
                <button class="btn" style="padding:0.4rem 0.75rem; background:var(--glow-bg); font-size:0.8rem;" onclick="openRdTokensModal(${d.id})" title="Manage Tokens"><i data-lucide="ticket" style="width:14px;"></i> Manage</button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openRamadanDistModal('edit',${d.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;"></i></button>
                <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteRamadanDist(${d.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No distributions found. Create one to get started.</td></tr>`;
    lucide.createIcons();
}

function filterRamadanDistributions() { renderRamadanDistributions(); }

function openRamadanDistModal(mode, distId = null) {
    const dist = distId ? ramadanDistData.find(d => d.id === distId) : null;
    document.getElementById('ramadanDistId').value       = dist ? dist.id : '';
    document.getElementById('ramadanDistTitle').value    = dist ? dist.title : '';
    document.getElementById('ramadanDistYear').value     = dist ? dist.year : new Date().getFullYear();
    document.getElementById('ramadanDistDate').value     = dist && dist.collection_date ? dist.collection_date.split('T')[0] : '';
    document.getElementById('ramadanDistLocation').value = dist ? (dist.collection_location || '') : '';
    document.getElementById('ramadanDistVoucher').value  = dist ? (dist.voucher_value || '') : '';
    document.getElementById('ramadanDistNotes').value    = dist ? (dist.notes || '') : '';
    document.getElementById('ramadanDistStatus').value   = dist ? dist.status : 'active';
    document.getElementById('ramadanDistModalTitle').textContent = mode === 'edit' ? 'Edit Distribution' : 'New Distribution';
    document.getElementById('ramadanDistSubmitBtn').innerHTML = mode === 'edit'
        ? '<i data-lucide="save"></i> Update Distribution'
        : '<i data-lucide="save"></i> Save Distribution';
    lucide.createIcons();
    openModal('ramadanDistModal');
}

async function saveRamadanDist(e) {
    e.preventDefault();
    const id = document.getElementById('ramadanDistId').value;
    const payload = {
        title:               document.getElementById('ramadanDistTitle').value.trim(),
        year:                document.getElementById('ramadanDistYear').value,
        collection_date:     document.getElementById('ramadanDistDate').value || null,
        collection_location: document.getElementById('ramadanDistLocation').value.trim(),
        voucher_value:       document.getElementById('ramadanDistVoucher').value || 0,
        notes:               document.getElementById('ramadanDistNotes').value.trim(),
        status:              document.getElementById('ramadanDistStatus').value,
    };
    const isEdit = !!id;
    try {
        const res = await fetch(isEdit ? `/api/ramadan/distributions/${id}` : '/api/ramadan/distributions', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('ramadanDistModal');
            showToast(isEdit ? 'Distribution updated' : 'Distribution created', 'success');
            fetchRamadanDistributions();
        } else {
            const r = await res.json();
            showToast(r.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function deleteRamadanDist(id) {
    if (!confirm('Delete this distribution? All associated tokens will also be deleted.')) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Distribution deleted', 'success');
            fetchRamadanDistributions();
        } else {
            showToast('Failed to delete', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── Tokens modal ────────────────────────────────────────────────────────────

async function openRdTokensModal(distId) {
    _rdCurrentDistId = distId;
    _rdTokenData     = [];
    _rdTokFilter     = 'all';
    _rdTokSortCol    = 'token_number';
    _rdTokSortDir    = 'asc';
    _rdTokPage       = 1;
    _rdTokPageSize   = 20;

    // Reset filter buttons
    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    const allBtn = document.getElementById('rdTokFilter-all');
    if (allBtn) allBtn.classList.add('active');

    // Reset sort arrows
    _rdUpdateSortArrows();

    // Reset toolbar controls
    const sortSel = document.getElementById('rdTokSortSel');
    if (sortSel) sortSel.value = 'token_number|asc';
    const pageSel = document.getElementById('rdTokPageSizeSel');
    if (pageSel) pageSel.value = '20';

    // Set title / subtitle
    const dist = ramadanDistData.find(d => d.id === distId);
    const titleEl = document.getElementById('rdTokModalTitle');
    const subEl   = document.getElementById('rdTokModalSub');
    if (titleEl) titleEl.textContent = dist ? dist.title : 'Distribution Tokens';
    if (subEl)   subEl.textContent   = dist
        ? `${dist.year}${dist.collection_date ? ' · ' + new Date(dist.collection_date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : ''}${dist.collection_location ? ' · ' + dist.collection_location : ''}`
        : '';

    // Clear verify + search
    const verifyInput  = document.getElementById('rdVerifyNic');
    const verifyResult = document.getElementById('rdVerifyResult');
    const searchInput  = document.getElementById('rdTokSearch');
    if (verifyInput)  verifyInput.value = '';
    if (verifyResult) { verifyResult.style.display = 'none'; verifyResult.style.paddingBottom = '0'; verifyResult.innerHTML = ''; }
    if (searchInput)  searchInput.value = '';

    openModal('ramadanTokensModal');
    await fetchRdTokens();
}

async function fetchRdTokens() {
    if (!_rdCurrentDistId) return;
    try {
        const data = await (await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/tokens`)).json();
        _rdTokenData = data;
        renderRdTokens();
        updateRdTokenStats();
    } catch (err) { console.error(err); }
}

function updateRdTokenStats() {
    const total     = _rdTokenData.length;
    const collected = _rdTokenData.filter(t => t.status === 'collected').length;
    const pending   = _rdTokenData.filter(t => t.status === 'pending').length;
    const absent    = _rdTokenData.filter(t => t.status === 'absent').length;
    const pct       = total ? Math.round((collected / total) * 100) : 0;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('rdTokTotal', total); s('rdTokCollected', collected);
    s('rdTokPending', pending); s('rdTokAbsent', absent);
    const bar = document.getElementById('rdProgressBar');
    if (bar) bar.style.width = pct + '%';
    s('rdProgressPct', pct + '%');
}

function setRdTokFilter(f) {
    _rdTokFilter = f;
    _rdTokPage   = 1;
    document.querySelectorAll('[id^="rdTokFilter-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`rdTokFilter-${f}`);
    if (btn) btn.classList.add('active');
    renderRdTokens();
}

// ── Sort helpers ─────────────────────────────────────────────────────────────
function rdToggleSort(col) {
    if (_rdTokSortCol === col) {
        _rdTokSortDir = _rdTokSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _rdTokSortCol = col;
        _rdTokSortDir = 'asc';
    }
    _rdTokPage = 1;
    // Sync the select dropdown
    const sel = document.getElementById('rdTokSortSel');
    if (sel) sel.value = `${col}|${_rdTokSortDir}`;
    _rdUpdateSortArrows();
    renderRdTokens();
}

function rdTokSortChange() {
    const val = document.getElementById('rdTokSortSel')?.value || 'token_number|asc';
    [_rdTokSortCol, _rdTokSortDir] = val.split('|');
    _rdTokPage = 1;
    _rdUpdateSortArrows();
    renderRdTokens();
}

function rdTokSearchChange() {
    _rdTokPage = 1;
    renderRdTokens();
}

function rdTokPageSizeChange() {
    _rdTokPageSize = parseInt(document.getElementById('rdTokPageSizeSel')?.value || '20');
    _rdTokPage = 1;
    renderRdTokens();
}

function setRdTokPage(p) {
    _rdTokPage = p;
    renderRdTokens();
}

function _rdUpdateSortArrows() {
    ['token_number','beneficiary_name','status','collected_at'].forEach(col => {
        const el = document.getElementById(`rdSort-${col}`);
        if (!el) return;
        if (col !== _rdTokSortCol) {
            el.textContent = '';
            el.classList.remove('on');
        } else {
            el.textContent = _rdTokSortDir === 'asc' ? '↑' : '↓';
            el.classList.add('on');
        }
    });
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderRdTokens() {
    const search = (document.getElementById('rdTokSearch')?.value || '').toLowerCase();
    const statusCfg = {
        collected: { badge: 'background:#d1fae5; color:#065f46;', label: 'Collected' },
        pending:   { badge: 'background:#fef3c7; color:#92400e;', label: 'Pending'   },
        absent:    { badge: 'background:#fee2e2; color:#991b1b;', label: 'Absent'    },
    };

    // 1 — filter
    let filtered = _rdTokenData.filter(t => {
        const matchStatus = _rdTokFilter === 'all' || t.status === _rdTokFilter;
        const matchSearch = !search ||
            (t.beneficiary_name    || '').toLowerCase().includes(search) ||
            (t.nic_number          || '').toLowerCase().includes(search) ||
            (t.token_number        || '').toLowerCase().includes(search) ||
            (t.application_number  || '').toLowerCase().includes(search);
        return matchStatus && matchSearch;
    });

    // 2 — sort
    filtered.sort((a, b) => {
        let va = a[_rdTokSortCol] ?? '';
        let vb = b[_rdTokSortCol] ?? '';
        if (_rdTokSortCol === 'collected_at') {
            va = va ? new Date(va).getTime() : 0;
            vb = vb ? new Date(vb).getTime() : 0;
            return _rdTokSortDir === 'asc' ? va - vb : vb - va;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        const cmp = va.localeCompare(vb);
        return _rdTokSortDir === 'asc' ? cmp : -cmp;
    });

    // 3 — paginate
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / _rdTokPageSize));
    if (_rdTokPage > totalPages) _rdTokPage = totalPages;
    const start  = (_rdTokPage - 1) * _rdTokPageSize;
    const paged  = filtered.slice(start, start + _rdTokPageSize);

    // 4 — render rows
    const tbody = document.getElementById('rdTokensBody');
    if (!tbody) return;

    if (paged.length === 0) {
        const msg = _rdTokFilter !== 'all'
            ? `No <strong>${_rdTokFilter}</strong> tokens found.`
            : search
                ? 'No tokens match your search.'
                : 'No tokens assigned yet. Click <strong>Assign All Active</strong> to get started.';
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="rd-empty">
                    <div class="rd-empty-icon">🎫</div>
                    <div style="font-size:.9rem; font-weight:600; color:var(--text-main); margin-bottom:.35rem;">${msg}</div>
                </div>
            </td></tr>`;
    } else {
        tbody.innerHTML = paged.map(t => {
            const st     = statusCfg[t.status] || statusCfg.pending;
            const collAt = t.collected_at ? new Date(t.collected_at).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
            const isCollected = t.status === 'collected';

            const actionBtns = isCollected
                ? `<button class="rd-act-btn rd-act-reset"  onclick="markRdTokenPending(${t.id})"   title="Reset to Pending"><i data-lucide="rotate-ccw" style="width:13px;"></i></button>`
                : `<button class="rd-act-btn rd-act-collect" onclick="markRdTokenCollected(${t.id})" title="Mark Collected"><i data-lucide="check"     style="width:13px;"></i></button>
                   <button class="rd-act-btn rd-act-absent"  onclick="markRdTokenAbsent(${t.id})"   title="Mark Absent"><i   data-lucide="user-x"   style="width:13px;"></i></button>`;

            return `
            <tr>
                <td class="rd-td-mono">${t.token_number}</td>
                <td>
                    <div style="font-weight:600; font-size:.85rem; color:var(--text-main);">${t.beneficiary_name || '—'}</div>
                    ${t.contact_number ? `<div class="rd-td-sub">${t.contact_number}</div>` : ''}
                </td>
                <td class="rd-td-sub" style="font-family:'Courier New',monospace; font-size:.8rem;">${t.application_number || '—'}</td>
                <td class="rd-td-sub" style="font-family:'Courier New',monospace; font-size:.8rem;">${t.nic_number || '—'}</td>
                <td><span class="status-badge" style="${st.badge} border-radius:6px;">${st.label}</span></td>
                <td class="rd-td-sub">${collAt}${isCollected && t.collected_by_name ? `<div style="font-size:.7rem; margin-top:1px;">by ${t.collected_by_name}</div>` : ''}</td>
                <td class="rd-td-actions">
                    ${actionBtns}
                    <button class="rd-act-btn rd-act-print"  onclick="printRamadanTokens([${t.id}])" title="Print Token"><i data-lucide="printer"  style="width:13px;"></i></button>
                    <button class="rd-act-btn rd-act-danger" onclick="removeRdToken(${t.id})"         title="Remove"><i      data-lucide="trash-2"  style="width:13px;"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    // 5 — pagination bar
    _rdRenderPagination(total, totalPages);
    lucide.createIcons();
}

function _rdRenderPagination(total, totalPages) {
    const pg = document.getElementById('rdPagination');
    if (!pg) return;

    const start = (_rdTokPage - 1) * _rdTokPageSize + 1;
    const end   = Math.min(_rdTokPage * _rdTokPageSize, total);
    const info  = total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`;

    const pageBtn = (p, label, disabled = false, active = false) =>
        `<button class="rd-page-btn${active ? ' active' : ''}" ${disabled ? 'disabled' : ''} onclick="setRdTokPage(${p})">${label}</button>`;

    let btns = '';
    btns += pageBtn(_rdTokPage - 1, '←', _rdTokPage === 1);

    // window of page numbers
    const delta = 2;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= _rdTokPage - delta && i <= _rdTokPage + delta)) pages.push(i);
    }
    let prev = 0;
    for (const p of pages) {
        if (p - prev > 1) btns += `<span class="rd-page-ellipsis">…</span>`;
        btns += pageBtn(p, p, false, p === _rdTokPage);
        prev = p;
    }

    btns += pageBtn(_rdTokPage + 1, '→', _rdTokPage === totalPages);

    pg.innerHTML = `<span class="rd-page-info">${info}</span><div class="rd-page-btns">${btns}</div>`;
}

async function markRdTokenCollected(tokenId) {
    try {
        const res = await fetch(`/api/ramadan/tokens/${tokenId}/collect`, { method: 'PUT' });
        if (res.ok) {
            showToast('Token marked as collected', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            const r = await res.json();
            showToast(r.message || 'Failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function markRdTokenAbsent(tokenId) {
    try {
        const res = await fetch(`/api/ramadan/tokens/${tokenId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'absent' })
        });
        if (res.ok) {
            showToast('Marked as absent', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else { showToast('Failed', 'error'); }
    } catch (err) { showToast('Network error', 'error'); }
}

async function markRdTokenPending(tokenId) {
    try {
        const res = await fetch(`/api/ramadan/tokens/${tokenId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending' })
        });
        if (res.ok) {
            showToast('Reset to pending', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else { showToast('Failed', 'error'); }
    } catch (err) { showToast('Network error', 'error'); }
}

async function removeRdToken(tokenId) {
    if (!confirm('Remove this beneficiary from the distribution?')) return;
    try {
        const res = await fetch(`/api/ramadan/tokens/${tokenId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Token removed', 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else { showToast('Failed to remove', 'error'); }
    } catch (err) { showToast('Network error', 'error'); }
}

async function assignAllBeneficiaries() {
    if (!_rdCurrentDistId) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-all`, { method: 'POST' });
        const r = await res.json();
        if (res.ok) {
            showToast(r.message, 'success');
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            showToast(r.message || 'Failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ── NIC Verification ────────────────────────────────────────────────────────

async function verifyBeneficiaryNic() {
    const nic = (document.getElementById('rdVerifyNic')?.value || '').trim();
    const resultEl = document.getElementById('rdVerifyResult');
    if (!nic) { showToast('Enter a NIC, ID, application number, or name', 'error'); return; }
    if (!_rdCurrentDistId) return;

    resultEl.style.display = 'block';
    resultEl.style.paddingBottom = '0.625rem';
    resultEl.innerHTML = `<div style="padding:0.75rem 1rem; background:var(--input-bg); border:1px solid var(--border-color); border-radius:10px; color:var(--text-muted); font-size:0.875rem;">Searching…</div>`;

    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/verify/${encodeURIComponent(nic)}`);
        const data = await res.json();

        if (!res.ok) {
            // Beneficiary found but ineligible (not Active/Approved)
            if (data.ineligible) {
                resultEl.innerHTML = `
                    <div style="padding:0.875rem 1rem; background:#fee2e2; border:1px solid rgba(239,68,68,0.3); border-radius:12px;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <i data-lucide="shield-x" style="width:18px; color:#ef4444; flex-shrink:0;"></i>
                            <div>
                                <div style="font-weight:700; font-size:0.9rem; color:#991b1b;">${data.beneficiary.male_head_name || 'Beneficiary'}</div>
                                <div style="font-size:0.82rem; color:#991b1b; margin-top:0.15rem;">${data.message}</div>
                            </div>
                        </div>
                    </div>`;
                lucide.createIcons();
                return;
            }
            // Beneficiary exists and is Active but not yet assigned — offer to add & collect
            if (data.beneficiary && data.beneficiary.id) {
                const ben = data.beneficiary;
                resultEl.innerHTML = `
                    <div style="padding:0.875rem 1rem; background:#fefce8; border:1px solid rgba(245,158,11,0.35); border-radius:12px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                            <div>
                                <div style="font-weight:700; font-size:1rem; color:var(--text-main);">${ben.male_head_name || '—'}</div>
                                <div style="font-size:0.8rem; color:#92400e; margin-top:0.25rem;">
                                    <i data-lucide="info" style="width:13px; vertical-align:middle;"></i>
                                    Not yet assigned to this distribution
                                </div>
                            </div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                <button class="btn" style="background:#fef3c7; color:#92400e; border:1px solid rgba(245,158,11,0.4); font-size:0.82rem; padding:0.45rem 0.9rem;"
                                    onclick="addAndCollectBeneficiary(${ben.id}, false)">
                                    <i data-lucide="plus-circle"></i> Add to Distribution
                                </button>
                                <button class="btn btn-primary" style="font-size:0.82rem; padding:0.45rem 0.9rem;"
                                    onclick="addAndCollectBeneficiary(${ben.id}, true)">
                                    <i data-lucide="check-circle"></i> Add &amp; Collect
                                </button>
                            </div>
                        </div>
                    </div>`;
                lucide.createIcons();
                return;
            }
            // Beneficiary not found at all
            resultEl.innerHTML = `
                <div style="padding:0.875rem 1rem; background:#fee2e2; border:1px solid rgba(239,68,68,0.3); border-radius:12px; display:flex; align-items:center; gap:0.75rem;">
                    <i data-lucide="alert-circle" style="width:18px; color:#ef4444; flex-shrink:0;"></i>
                    <span style="font-size:0.875rem; color:#991b1b;">${data.message}</span>
                </div>`;
            lucide.createIcons();
            return;
        }

        const statusColors = { collected: '#10b981', pending: '#f59e0b', absent: '#ef4444' };
        const color = statusColors[data.status] || '#f59e0b';
        const isCollected = data.status === 'collected';
        const collectedAt = data.collected_at ? new Date(data.collected_at).toLocaleString() : null;

        resultEl.innerHTML = `
            <div style="padding:0.875rem 1rem; background:var(--input-bg); border:1px solid var(--border-color); border-radius:12px;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="font-weight:700; font-size:1rem; color:var(--text-main);">${data.beneficiary_name || '—'}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.1rem;">
                            Token: <span style="font-family:monospace; font-weight:600;">${data.token_number}</span>
                            ${data.application_number ? ' · App# ' + data.application_number : ''}
                        </div>
                        ${isCollected && collectedAt ? `<div style="font-size:0.75rem; color:#10b981; margin-top:0.2rem;">Collected: ${collectedAt}${data.collected_by_name ? ' by ' + data.collected_by_name : ''}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <span class="status-badge" style="background:${color}22; color:${color}; border:1px solid ${color}44; text-transform:capitalize;">${data.status}</span>
                        ${!isCollected
                            ? `<button class="btn btn-primary" onclick="markRdTokenCollected(${data.id}).then(()=>{ document.getElementById('rdVerifyNic').value=''; document.getElementById('rdVerifyResult').style.display='none'; })" style="font-size:0.85rem; padding:0.5rem 1rem;">
                                    <i data-lucide="check-circle"></i> Mark Collected
                               </button>`
                            : `<span style="font-size:0.82rem; color:#10b981; font-weight:600;"><i data-lucide="check-circle" style="width:14px;"></i> Already Collected</span>`
                        }
                    </div>
                </div>
            </div>`;
        lucide.createIcons();
    } catch (err) {
        resultEl.innerHTML = `<div style="padding:0.75rem 1rem; background:#fee2e2; border:1px solid rgba(239,68,68,0.3); border-radius:12px; font-size:0.875rem; color:#991b1b;">Network error. Please try again.</div>`;
    }
}

// ── Print Tokens ────────────────────────────────────────────────────────────

function printRamadanTokens(tokenIds = null) {
    // If tokenIds supplied, filter to those; otherwise print all loaded tokens
    const tokens = tokenIds
        ? _rdTokenData.filter(t => tokenIds.includes(t.id))
        : _rdTokenData;

    if (tokens.length === 0) {
        showToast('No tokens to print', 'error');
        return;
    }

    const dist = ramadanDistData.find(d => d.id === _rdCurrentDistId) || {};
    const org  = JSON.parse(localStorage.getItem('edf-org-settings') || '{}');
    const orgName = org.name || 'EDF Galgamuwa';
    const collDate = dist.collection_date
        ? new Date(dist.collection_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const tokenCards = tokens.map(t => `
        <div class="token-card">
            <!-- Header -->
            <div class="tk-header">
                <div class="tk-logo">
                    <span>EDF</span>
                </div>
                <div class="tk-org">
                    <div class="tk-org-name">${orgName}</div>
                    <div class="tk-org-sub">Ramadan Dry Ration Distribution</div>
                </div>
                <div class="tk-year">${dist.year || ''}</div>
            </div>

            <!-- Token Number -->
            <div class="tk-body">
                <div class="tk-label-sm">TOKEN NUMBER</div>
                <div class="tk-token-no">${t.token_number}</div>
                <div class="tk-dist-title">${dist.title || 'Ramadan Distribution'}</div>
            </div>

            <!-- Details row -->
            <div class="tk-details">
                <div class="tk-detail-cell">
                    <div class="tk-detail-label">BENEFICIARY</div>
                    <div class="tk-detail-value">${t.beneficiary_name || '—'}</div>
                </div>
                <div class="tk-detail-cell">
                    <div class="tk-detail-label">APPLICATION #</div>
                    <div class="tk-detail-value mono">${t.application_number || '—'}</div>
                </div>
                <div class="tk-detail-cell">
                    <div class="tk-detail-label">COLLECTION DATE</div>
                    <div class="tk-detail-value">${collDate}</div>
                </div>
                ${dist.collection_location ? `
                <div class="tk-detail-cell">
                    <div class="tk-detail-label">LOCATION</div>
                    <div class="tk-detail-value">${dist.collection_location}</div>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div class="tk-footer">
                <span>Present this token at the collection point with your NIC.</span>
                <span class="tk-footer-right">Non-transferable &bull; Valid for one collection only</span>
            </div>
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ramadan Tokens – ${dist.title || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f0f0;
    padding: 16mm;
    color: #111;
  }
  h1.print-heading {
    text-align: center;
    font-size: 13px;
    color: #555;
    margin-bottom: 8mm;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tokens-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6mm;
  }

  /* ── Token Card ── */
  .token-card {
    background: #fff;
    border: 1.5px solid #d1d5db;
    border-radius: 10px;
    overflow: hidden;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  /* Header */
  .tk-header {
    background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tk-logo {
    width: 32px; height: 32px;
    background: #fff;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 900;
    color: #3730a3;
    flex-shrink: 0;
    letter-spacing: -0.03em;
  }
  .tk-org { flex: 1; }
  .tk-org-name { color: #fff; font-size: 11px; font-weight: 700; line-height: 1.2; }
  .tk-org-sub  { color: rgba(255,255,255,0.65); font-size: 8.5px; margin-top: 1px; letter-spacing: 0.02em; }
  .tk-year {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px;
    color: #e0e7ff;
    font-size: 10px; font-weight: 700;
    padding: 2px 9px;
    letter-spacing: 0.04em;
  }

  /* Body – token number */
  .tk-body {
    padding: 10px 14px 6px;
    text-align: center;
    background: #fafafa;
    border-bottom: 1px dashed #e5e7eb;
  }
  .tk-label-sm {
    font-size: 7px; font-weight: 700;
    color: #6b7280; letter-spacing: 0.12em;
    text-transform: uppercase; margin-bottom: 3px;
  }
  .tk-token-no {
    font-size: 26px; font-weight: 800;
    color: #1e1b4b;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.06em;
    line-height: 1;
  }
  .tk-dist-title {
    font-size: 9px; color: #6b7280;
    margin-top: 4px;
    letter-spacing: 0.02em;
  }

  /* Details row */
  .tk-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    padding: 8px 12px;
    gap: 6px 10px;
  }
  .tk-detail-cell { min-width: 0; }
  .tk-detail-label {
    font-size: 6.5px; font-weight: 700;
    color: #9ca3af; letter-spacing: 0.1em;
    text-transform: uppercase; margin-bottom: 2px;
  }
  .tk-detail-value {
    font-size: 9px; font-weight: 600; color: #111;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .mono { font-family: 'Courier New', monospace; font-size: 9.5px; }

  /* Footer */
  .tk-footer {
    padding: 5px 12px;
    background: #f3f4f6;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 6.5px;
    color: #9ca3af;
  }
  .tk-footer-right { text-align: right; flex-shrink: 0; }

  /* Print overrides */
  @media print {
    body { background: #fff; padding: 8mm; }
    h1.print-heading { margin-bottom: 5mm; }
    .tokens-grid { gap: 4mm; }
    .token-card { box-shadow: none; border-color: #ccc; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<p class="print-heading no-print">${tokens.length} token(s) ready to print &mdash; <button onclick="window.print()" style="font-size:12px;padding:4px 12px;cursor:pointer;border:1px solid #999;border-radius:4px;background:#fff;">Print</button></p>

<div class="tokens-grid">
${tokenCards}
</div>

<script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

async function addAndCollectBeneficiary(beneficiaryId, collect) {
    if (!_rdCurrentDistId) return;
    try {
        const res = await fetch(`/api/ramadan/distributions/${_rdCurrentDistId}/assign-one`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beneficiary_id: beneficiaryId, collect })
        });
        const r = await res.json();
        if (res.ok) {
            showToast(r.message, 'success');
            document.getElementById('rdVerifyNic').value = '';
            document.getElementById('rdVerifyResult').style.display = 'none';
            await fetchRdTokens();
            fetchRamadanDistributions();
        } else {
            showToast(r.message || 'Failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANDING & SETTINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function saveBrandSetting(key, value) {
    try {
        const formData = new FormData();
        formData.append(key, value);
        const res = await fetch('/api/settings', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            showToast('Branding updated', 'success');
            if (key === 'brand_text' || key === 'brand_subtitle') {
                updateSidebarBranding();
            }
        } else {
            const data = await res.json();
            showToast(data.message || 'Failed to update branding', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to save branding', 'error');
    }
}

async function handleBrandAssetUpload(input, type) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    
    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const containerId = type === 'logo' ? 'logoPreviewContainer' : 'faviconPreviewContainer';
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:contain;">`;
        }
    };
    reader.readAsDataURL(file);

    try {
        const formData = new FormData();
        formData.append(type, file);
        const res = await fetch('/api/settings', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`, 'success');
            updateSidebarBranding();
            
            // Apply favicon immediately to the document head
            if (type === 'favicon' && data.settings?.favicon_url) {
                let link = document.querySelector("link[rel*='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'shortcut icon';
                    document.head.appendChild(link);
                }
                link.href = data.settings.favicon_url + '?v=' + Date.now();
            }
        } else {
            showToast(data.message || 'Upload failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Network error during upload', 'error');
    }
}

async function updateSidebarBranding() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const config = await res.json();
        
        if (config.brand_text) {
            const el = document.getElementById('sidebarBrandText');
            if (el) el.textContent = config.brand_text;
            const brandTextInp = document.getElementById('settingBrandText');
            if (brandTextInp) brandTextInp.value = config.brand_text;
        }
        if (config.brand_subtitle) {
            const el = document.getElementById('sidebarBrandSubtitle');
            if (el) el.textContent = config.brand_subtitle;
            const brandSubInp = document.getElementById('settingBrandSubtitle');
            if (brandSubInp) brandSubInp.value = config.brand_subtitle;
        }
        if (config.logo_url) {
            const logoContainer = document.getElementById('sidebarLogoContainer');
            if (logoContainer) {
                logoContainer.innerHTML = `<img src="${config.logo_url}" style="width:100%; height:100%; object-fit:contain;">`;
            }
            const previewContainer = document.getElementById('logoPreviewContainer');
            if (previewContainer) {
                previewContainer.innerHTML = `<img src="${config.logo_url}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
        if (config.favicon_url) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'shortcut icon';
                document.head.appendChild(link);
            }
            link.href = config.favicon_url + '?v=' + Date.now();
            
            const favPreview = document.getElementById('faviconPreviewContainer');
            if (favPreview) {
                favPreview.innerHTML = `<img src="${config.favicon_url}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
    } catch (e) {
        console.error('Failed to load branding:', e);
    }
}

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
    if (tabId === 'subscriptions') { if (_subViewMode === 'yearly') fetchYearlySubscriptions(); else fetchSubscriptions(); }
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
        document.querySelector('.sidebar')?.classList.remove('active');
        document.getElementById('sidebarBackdrop')?.classList.remove('show');
    }

    if (typeof window.refreshEdfLottieState === 'function') {
        window.refreshEdfLottieState();
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

// Sidebar Toggle for Mobile + Backdrop Sync
function setMobileSidebarOpen(open) {
    const sb = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.toggle('active', open);
    if (backdrop) backdrop.classList.toggle('show', open);
}

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const isOpen = !document.querySelector('.sidebar')?.classList.contains('active');
    setMobileSidebarOpen(isOpen);
});

document.getElementById('sidebarBackdrop')?.addEventListener('click', () => {
    setMobileSidebarOpen(false);
});

// Close mobile sidebar when a nav link is clicked
document.querySelectorAll('.nav-link, .nav-submenu-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
            setMobileSidebarOpen(false);
        }
    });
});

// Sidebar Toggle for Desktop + Pin Icon Sync
document.getElementById('desktopToggle')?.addEventListener('click', () => {
    const sb = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    const collapsed = sb ? sb.classList.toggle('collapsed') : false;
    if (main) main.classList.toggle('expanded', collapsed);
    const pinIcon = document.querySelector('#sidebarPinToggle i');
    if (pinIcon) {
        pinIcon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
        if (window.lucide) lucide.createIcons();
    }
    const tip = document.getElementById('sbRailTooltip');
    if (tip) tip.classList.remove('show');
});

// Sidebar Quick Tab Filter
function filterSidebarNav(rawQuery) {
    const query = String(rawQuery || '').trim().toLowerCase();
    const input = document.getElementById('sidebarNavSearch');
    const clearBtn = document.getElementById('sbSearchClearBtn');
    if (input && rawQuery === '' && input.value !== '') input.value = '';
    if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

    const navList = document.getElementById('mainNav');
    if (!navList) return;

    const children = Array.from(navList.children);
    let currentLabel = null;
    let visibleInSection = 0;

    children.forEach(node => {
        if (node.classList.contains('nav-section-label')) {
            if (currentLabel) {
                currentLabel.style.display = (query && visibleInSection === 0) ? 'none' : '';
            }
            currentLabel = node;
            visibleInSection = 0;
            return;
        }
        if (node.classList.contains('nav-item')) {
            const text = (node.textContent || '').toLowerCase();
            const match = !query || text.includes(query);
            node.style.display = match ? '' : 'none';
            if (match) visibleInSection++;
            const sub = node.querySelector('.nav-submenu');
            if (sub) {
                if (query && match) {
                    sub.style.display = 'block';
                } else if (!query) {
                    sub.style.display = node.querySelector('.nav-link.active') ? 'block' : '';
                }
            }
        }
    });
    if (currentLabel) {
        currentLabel.style.display = (query && visibleInSection === 0) ? 'none' : '';
    }
}
window.filterSidebarNav = filterSidebarNav;

// Floating Tooltip Pill in Collapsed Rail Mode
(function initSidebarRailTooltips() {
    let tip = document.getElementById('sbRailTooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'sbRailTooltip';
        tip.className = 'sb-rail-tooltip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
    }

    const showTip = (el) => {
        const sb = document.querySelector('.sidebar');
        if (!sb || !sb.classList.contains('collapsed') || window.innerWidth <= 1024) return;
        const label = el.getAttribute('data-tooltip');
        if (!label) return;
        const rect = el.getBoundingClientRect();
        tip.textContent = label;
        tip.style.left = `${rect.right + 12}px`;
        tip.style.top = `${rect.top + rect.height / 2}px`;
        tip.classList.add('show');
    };

    const hideTip = () => tip.classList.remove('show');

    document.querySelectorAll('.sidebar .nav-link[data-tooltip]').forEach(link => {
        link.addEventListener('mouseenter', () => showTip(link));
        link.addEventListener('focus', () => showTip(link));
        link.addEventListener('mouseleave', hideTip);
        link.addEventListener('blur', hideTip);
    });
})();

// Modal Tab switching (Event Delegation version)
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.modal-tab');
    if (!tab || tab.hasAttribute('data-mem-step') || tab.hasAttribute('data-fam-step')) return;
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
    window.refreshEdfLottieState?.();
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

        const avatarUrl = user.avatar_url ? user.avatar_url : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=059669&color=fff`;

        // Populate Sidebar Operator Card
        const sbNameEl = document.getElementById('sbUserName');
        if (sbNameEl) sbNameEl.textContent = user.full_name;
        const sbRoleEl = document.getElementById('sbUserRole');
        if (sbRoleEl) sbRoleEl.textContent = displayRole;
        const sbInitialsEl = document.getElementById('sbUserInitials');
        const sbAvatarEl = document.getElementById('sbUserAvatar');
        const initials = (user.full_name || 'ED').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
        if (sbInitialsEl) sbInitialsEl.textContent = initials || 'ED';
        if (sbAvatarEl) {
            if (user.avatar_url) {
                sbAvatarEl.src = user.avatar_url;
                sbAvatarEl.style.display = 'block';
                if (sbInitialsEl) sbInitialsEl.style.display = 'none';
            } else {
                sbAvatarEl.style.display = 'none';
                if (sbInitialsEl) sbInitialsEl.style.display = '';
            }
        }

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
    courses:       ['courses', 'customizer', 'madrasa'],
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

let _ovCachedStats = null;
let _ovAllTransactions = [];
let _ovTxTypeFilter = 'all';

function _ovUpdateHijriHeader() {
    const el = document.getElementById('ovHijriDate');
    if (!el) return;
    const now = new Date();
    const greg = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    let hijri = '';
    try {
        hijri = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    } catch (_) {}
    el.textContent = hijri ? `${greg} · ${hijri}` : greg;
}

function ovSwitchChartMode(mode) {
    const cfView = document.getElementById('ovChartCashflowView');
    const spView = document.getElementById('ovChartAllocationView');
    const cfBtn = document.getElementById('ovTabCashflow');
    const spBtn = document.getElementById('ovTabSplit');
    if (!cfView || !spView) return;
    const isCashflow = mode !== 'split';
    cfView.style.display = isCashflow ? '' : 'none';
    spView.style.display = isCashflow ? 'none' : '';
    if (cfBtn) cfBtn.classList.toggle('active', isCashflow);
    if (spBtn) spBtn.classList.toggle('active', !isCashflow);
}

window._ovHoverCashflowBar = function(idx) {
    const readout = document.getElementById('ovChartHoverReadout');
    const list = _ovCachedStats?.monthlyCashflow || [];
    const item = list[idx];
    if (!readout || !item) return;
    const net = item.income - item.expense;
    const netColor = net >= 0 ? '#10b981' : '#ef4444';
    readout.innerHTML = `
        <span><strong>${_esc(item.label)} (${_esc(item.month)}):</strong> Inflow <strong style="color:#10b981;">LKR ${Number(item.income).toLocaleString()}</strong> · Spend <strong style="color:#ef4444;">LKR ${Number(item.expense).toLocaleString()}</strong></span>
        <span style="font-weight:800; color:${netColor};">Net ${net >= 0 ? '+' : ''}LKR ${Number(net).toLocaleString()}</span>
    `;
};

function _renderOvCashflowChart(buckets) {
    const host = document.getElementById('ovCashflowChart');
    const totalEl = document.getElementById('ovChartPeriodTotal');
    if (!host) return;
    if (!Array.isArray(buckets) || buckets.length === 0) {
        host.innerHTML = `<div style="padding:2.5rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">No monthly cashflow history yet.</div>`;
        return;
    }

    const totIn = buckets.reduce((a, b) => a + (Number(b.income) || 0), 0);
    const totOut = buckets.reduce((a, b) => a + (Number(b.expense) || 0), 0);
    if (totalEl) totalEl.textContent = `6M Net: LKR ${Number(totIn - totOut).toLocaleString()}`;

    const maxVal = Math.max(1000, ...buckets.map(b => Math.max(b.income || 0, b.expense || 0)));
    const W = 560, H = 200, padL = 50, padR = 16, padT = 18, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const groupW = plotW / buckets.length;
    const barW = Math.min(20, Math.max(10, groupW * 0.28));

    const fmtShort = (n) => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${Math.round(n / 1000)}k`;
        return String(n);
    };

    const gridLines = [0, 0.5, 1].map(f => {
        const y = padT + plotH * (1 - f);
        const val = Math.round(maxVal * f);
        return `
            <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.11" stroke-dasharray="3 3" />
            <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.55">${fmtShort(val)}</text>
        `;
    }).join('');

    const bars = buckets.map((b, idx) => {
        const cx = padL + idx * groupW + groupW / 2;
        const inH = Math.max(b.income > 0 ? 4 : 1, (b.income / maxVal) * plotH);
        const outH = Math.max(b.expense > 0 ? 4 : 1, (b.expense / maxVal) * plotH);
        const inY = padT + plotH - inH;
        const outY = padT + plotH - outH;
        return `
            <g class="ov-bar-group" onmouseenter="_ovHoverCashflowBar(${idx})">
                <rect x="${(cx - barW - 2).toFixed(1)}" y="${inY.toFixed(1)}" width="${barW}" height="${inH.toFixed(1)}" rx="5" fill="#10b981">
                    <title>${_esc(b.label)} Inflow: LKR ${Number(b.income).toLocaleString()}</title>
                </rect>
                <rect x="${(cx + 2).toFixed(1)}" y="${outY.toFixed(1)}" width="${barW}" height="${outH.toFixed(1)}" rx="5" fill="#ef4444" fill-opacity="0.88">
                    <title>${_esc(b.label)} Expense: LKR ${Number(b.expense).toLocaleString()}</title>
                </rect>
                <text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" fill-opacity="0.72">${_esc(b.label)}</text>
            </g>
        `;
    }).join('');

    host.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:205px; display:block; color:var(--text-main);">
            ${gridLines}
            ${bars}
        </svg>
    `;
}

function _renderOvAllocationChart(expenseRows, incomeRows) {
    const host = document.getElementById('ovAllocationChart');
    if (!host) return;
    const rows = (expenseRows && expenseRows.length > 0) ? expenseRows : (incomeRows || []);
    const modeLabel = (expenseRows && expenseRows.length > 0) ? 'Expense Allocation' : 'Inflow Composition';
    const total = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
    if (!rows.length || total <= 0) {
        host.innerHTML = `<div style="padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.82rem;">No categorized transactions recorded yet.</div>`;
        return;
    }

    const palette = ['#10b981', '#f59e0b', '#6366f1', '#ef4444', '#0ea5e9', '#8b5cf6'];
    const radius = 56, circumference = 2 * Math.PI * radius;
    let offset = 0;

    const segments = rows.map((r, i) => {
        const val = Number(r.total) || 0;
        const pct = val / total;
        const len = pct * circumference;
        const color = palette[i % palette.length];
        const seg = `<circle cx="75" cy="75" r="${radius}" fill="transparent" stroke="${color}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(circumference - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${_esc(r.category)}: LKR ${val.toLocaleString()}</title></circle>`;
        offset += len;
        return seg;
    }).join('');

    const listHtml = rows.map((r, i) => {
        const val = Number(r.total) || 0;
        const pct = Math.round((val / total) * 100);
        const color = palette[i % palette.length];
        const cat = String(r.category || 'other').replace(/_/g, ' ');
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.42rem 0.55rem; border-radius:8px; background:var(--input-bg); border:1px solid var(--border-color); font-size:0.76rem;">
                <span style="display:flex; align-items:center; gap:0.45rem; text-transform:capitalize; font-weight:600; color:var(--text-main);">
                    <span style="width:9px; height:9px; border-radius:3px; background:${color};"></span>
                    ${_esc(cat)}
                </span>
                <span style="font-weight:700; color:var(--text-main);">LKR ${val.toLocaleString()} <span style="color:var(--text-muted); font-weight:600;">(${pct}%)</span></span>
            </div>
        `;
    }).join('');

    host.innerHTML = `
        <div style="display:grid; grid-template-columns:160px minmax(0,1fr); gap:1rem; align-items:center;">
            <div style="position:relative; width:150px; height:150px; margin:0 auto;">
                <svg viewBox="0 0 150 150" style="width:150px; height:150px; transform:rotate(-90deg);">
                    <circle cx="75" cy="75" r="${radius}" fill="transparent" stroke="var(--border-color)" stroke-width="18" />
                    ${segments}
                </svg>
                <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none;">
                    <span style="font-size:0.62rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">${_esc(modeLabel)}</span>
                    <span style="font-size:0.85rem; font-weight:800; color:var(--text-main);">LKR ${Number(total).toLocaleString()}</span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
                ${listHtml}
            </div>
        </div>
    `;
}

function _renderOvActionQueue(queue) {
    const listEl = document.getElementById('ovActionQueueList');
    const badgeEl = document.getElementById('ovQueueTotalBadge');
    const previewEl = document.getElementById('ovPendingBenPreview');
    if (!listEl) return;

    const q = queue || {};
    const items = [
        {
            title: 'Beneficiary Verifications',
            sub: q.pendingBeneficiaries > 0 ? 'Cases awaiting committee review' : 'All submitted cases reviewed',
            count: q.pendingBeneficiaries || 0,
            tab: 'beneficiaries',
            icon: 'heart-handshake',
            tone: q.pendingBeneficiaries > 0 ? 'warn' : 'ok'
        },
        {
            title: 'Unpaid Member Dues (This Month)',
            sub: q.unpaidSubMembersThisMonth > 0 ? 'Active members pending monthly remittance' : 'All contributing members up to date',
            count: q.unpaidSubMembersThisMonth || 0,
            tab: 'subscriptions',
            icon: 'wallet',
            tone: q.unpaidSubMembersThisMonth > 0 ? 'warn' : 'ok'
        },
        {
            title: 'Program Enrollment Review',
            sub: q.pendingProgramApps > 0 ? 'Student applications awaiting placement' : 'No backlog in training intake',
            count: q.pendingProgramApps || 0,
            tab: 'courses',
            icon: 'graduation-cap',
            tone: q.pendingProgramApps > 0 ? 'warn' : 'ok'
        },
        {
            title: 'Ramadan Tokens Pending Collection',
            sub: q.pendingRamadanTokens > 0 ? 'Unredeemed vouchers in active drive' : 'All active drive tokens cleared',
            count: q.pendingRamadanTokens || 0,
            tab: 'ramadan',
            icon: 'moon',
            tone: q.pendingRamadanTokens > 0 ? 'info' : 'ok'
        },
        {
            title: 'Inventory Low-Stock & Overdue Loans',
            sub: (q.lowStockInventory || 0) + (q.overdueLoans || 0) > 0 ? `${q.lowStockInventory || 0} low stock · ${q.overdueLoans || 0} overdue loans` : 'Assets, rations & loans healthy',
            count: (q.lowStockInventory || 0) + (q.overdueLoans || 0),
            tab: 'inventory',
            icon: 'package',
            tone: ((q.lowStockInventory || 0) + (q.overdueLoans || 0)) > 0 ? 'urgent' : 'ok'
        }
    ];

    const totalOpen = items.reduce((a, i) => a + i.count, 0);
    if (badgeEl) {
        badgeEl.textContent = totalOpen > 0 ? `${totalOpen} pending` : 'All clear';
        badgeEl.style.background = totalOpen > 0 ? 'rgba(245,158,11,0.16)' : 'rgba(16,185,129,0.14)';
        badgeEl.style.color = totalOpen > 0 ? '#d97706' : '#059669';
    }

    const toneColors = {
        urgent: { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444' },
        warn:   { bg: 'rgba(245,158,11,0.14)', fg: '#d97706' },
        info:   { bg: 'rgba(99,102,241,0.14)', fg: '#6366f1' },
        ok:     { bg: 'rgba(16,185,129,0.14)', fg: '#059669' }
    };

    listEl.innerHTML = items.map(it => {
        const tc = toneColors[it.tone] || toneColors.ok;
        return `
            <button type="button" class="ov-queue-item" onclick="switchTab('${it.tab}')">
                <div style="display:flex; align-items:center; gap:0.65rem; min-width:0;">
                    <div style="width:30px; height:30px; border-radius:9px; background:${tc.bg}; color:${tc.fg}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="${it.icon}" style="width:15px; height:15px;"></i>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-size:0.8rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(it.title)}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(it.sub)}</div>
                    </div>
                </div>
                <span class="ov-queue-count" style="background:${tc.bg}; color:${tc.fg};">${it.count}</span>
            </button>
        `;
    }).join('');

    if (previewEl) {
        const samples = q.pendingBeneficiarySamples || [];
        previewEl.innerHTML = samples.length
            ? `<div style="font-size:0.69rem; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:0.35rem; align-items:center;">
                 <span style="font-weight:700;">Latest pending:</span>
                 ${samples.map(s => `<span class="ov-pill-badge" style="background:var(--input-bg); border:1px solid var(--border-color); color:var(--text-main); cursor:pointer;" onclick="switchTab('beneficiaries')">${_esc(s.name)}</span>`).join('')}
               </div>`
            : '';
    }
}

function _renderOvActivityFeed(items) {
    const feedEl = document.getElementById('ovActivityFeed');
    if (!feedEl) return;
    if (!Array.isArray(items) || !items.length) {
        feedEl.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.78rem; color:var(--text-muted);">No recent audit events recorded.</div>`;
        return;
    }

    feedEl.innerHTML = items.map(log => {
        const meta = typeof logActionMeta === 'function' ? logActionMeta(log.action) : { label: log.action || 'Event' };
        const rel = typeof timeAgo === 'function' ? timeAgo(log.created_at) : '';
        const a = String(log.action || '').toUpperCase();
        const dotColor = a.includes('DELETE') || a.includes('ERROR') || a.includes('BLOCK')
            ? '#ef4444'
            : (a.includes('POST') || a.includes('LOGIN') || a.includes('COLLECT') ? '#10b981' : '#f59e0b');
        const summary = log.details ? String(log.details).slice(0, 68) : `${log.entity || 'system'}`;
        return `
            <div class="ov-feed-row">
                <span class="ov-feed-dot" style="background:${dotColor};"></span>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem;">
                        <span style="font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(log.actorName || 'System')} · ${_esc(meta.label)}</span>
                        <span style="font-size:0.67rem; color:var(--text-muted); flex-shrink:0;">${_esc(rel)}</span>
                    </div>
                    <div style="font-size:0.71rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_esc(summary)}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function ovQuickRecordDues() {
    try {
        if (typeof subMembersData !== 'undefined' && subMembersData.length === 0 && typeof fetchSubscriptions === 'function') {
            await fetchSubscriptions();
        }
        if (typeof openSubModal === 'function') {
            openSubModal('add');
        } else {
            switchTab('subscriptions');
        }
    } catch (_) {
        switchTab('subscriptions');
    }
}

function ovExportSnapshot() {
    const d = _ovCachedStats;
    if (!d) {
        if (typeof showToast === 'function') showToast('Statistics are still loading', 'info');
        return;
    }
    const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
        ['EDF Galgamuwa — Executive Overview Snapshot', new Date().toISOString()],
        [],
        ['Metric', 'Value'],
        ['Total Member Treasury Inflow (LKR)', d.totalDonations || 0],
        ['Total Welfare & Program Spend (LKR)', d.totalExpenses || 0],
        ['Net Stewardship Reserve (LKR)', d.netBalance || 0],
        ['External / Outsider Cash (Policy Rs. 0)', d.externalDonations || 0],
        ['Organization Members (Total / Active)', `${d.memberCount || 0} / ${d.memberActive || 0}`],
        ['Beneficiaries (Total / Active / Pending)', `${d.beneficiaryCount || 0} / ${d.beneficiaryActive || 0} / ${d.beneficiaryPending || 0}`],
        ['Registered Families', d.familyCount || 0],
        ['Active Volunteers', d.volunteerCount || 0],
        ['Monthly Dues Collection (%)', `${d.subscriptionPulse?.collectionPct ?? 0}% (${d.subscriptionPulse?.currentMonth || ''})`],
        ['Ramadan Tokens (Collected / Total)', `${d.ramadanCollected || 0} / ${d.ramadanTokensTotal || 0}`],
        [],
        ['Recent Transactions'],
        ['Description', 'Category', 'Amount (LKR)', 'Date', 'Type'],
        ...(_ovAllTransactions || []).map(tx => [
            tx.description || '',
            tx.category || '',
            tx.amount || 0,
            tx.date || '',
            tx.type || ''
        ])
    ];
    const csv = rows.map(r => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edf-overview-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('Overview CSV snapshot downloaded', 'success');
}

function ovSetTxTypeFilter(type, btnEl) {
    _ovTxTypeFilter = type || 'all';
    document.querySelectorAll('#overviewTab .ov-tx-pill[data-tx-filter]').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    ovFilterTransactions();
}

function ovFilterTransactions() {
    const q = (document.getElementById('ovTxSearch')?.value || '').trim().toLowerCase();
    const filtered = (_ovAllTransactions || []).filter(tx => {
        if (_ovTxTypeFilter !== 'all' && tx.type !== _ovTxTypeFilter) return false;
        if (!q) return true;
        return String(tx.description || '').toLowerCase().includes(q)
            || String(tx.category || '').toLowerCase().includes(q)
            || String(tx.amount || '').includes(q);
    });
    renderRecentTransactions(filtered, false);
}

async function fetchStats(manualRefresh = false) {
    const refreshIcon = document.getElementById('ovRefreshIcon');
    if (manualRefresh && refreshIcon) refreshIcon.classList.add('ov-spin');
    _ovUpdateHijriHeader();

    try {
        const res  = await fetch('/api/stats/stats');
        const data = await res.json();
        if (!res.ok) return;

        _ovCachedStats = data;
        const s  = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        const lkr = v => `LKR ${Number(v || 0).toLocaleString()}`;

        // Financial Treasury KPIs
        const inflow = Number(data.totalDonations) || 0;
        const spend = Number(data.totalExpenses) || 0;
        const net = data.netBalance ?? (inflow - spend);
        s('totalDonations', lkr(inflow));
        s('totalExpenses',  lkr(spend));
        const netEl  = document.getElementById('netFunds');
        if (netEl) {
            netEl.textContent = lkr(net);
            netEl.style.color = net >= 0 ? '#10b981' : '#ef4444';
        }

        const burnPct = inflow > 0 ? Math.min(999, Math.round((spend / inflow) * 100)) : 0;
        s('ovBurnRateBadge', inflow > 0 ? `${burnPct}% of inflow` : 'No inflow logged');

        const retainPct = inflow > 0 ? Math.max(0, Math.min(100, Math.round((net / inflow) * 100))) : 0;
        const resBar = document.getElementById('ovReserveBar');
        if (resBar) resBar.style.width = `${retainPct}%`;
        const resStatus = document.getElementById('ovReserveStatus');
        if (resStatus) {
            resStatus.textContent = net >= 0 ? `${retainPct}% retained` : 'Deficit Watch';
            resStatus.style.background = net >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.14)';
            resStatus.style.color = net >= 0 ? '#059669' : '#ef4444';
        }

        // Current Month Subscription Pulse
        const sp = data.subscriptionPulse || {};
        s('ovSubMonthLabel', sp.currentMonth || 'This Month');
        s('ovSubPct', `${sp.collectionPct ?? 0}%`);
        s('ovSubAmountRatio', `${lkr(sp.collectedThisMonth)} / ${lkr(sp.expectedMonthly)}`);
        s('ovSubMembersRatio', `${sp.paidMembersCount ?? 0} / ${sp.expectedMembersCount ?? 0} paid`);
        const spBar = document.getElementById('ovSubProgressBar');
        if (spBar) spBar.style.width = `${Math.min(100, sp.collectionPct ?? 0)}%`;

        // People KPIs
        s('memberCount',       data.memberCount);
        s('memberActive',      data.memberActive);
        s('ovMemberTierPill',  `${data.memberFounders ?? 0}F · ${data.memberExecutives ?? 0}E`);
        s('beneficiaryCount',  data.beneficiaryCount);
        s('beneficiaryActive', data.beneficiaryActive);
        s('beneficiaryPending',data.beneficiaryPending);
        s('familyCount',       data.familyCount);
        s('volunteerCount',    data.volunteerCount);

        // Programs & Inventory
        const ps = data.programsSummary || {};
        s('courseCount',  data.courseCount);
        s('courseActive', data.courseActive);
        s('ovProgBatches', ps.activeBatches ?? 0);
        s('ovProgApps',    ps.totalApplications ?? 0);
        s('ovProgPending', ps.pendingApplications ?? 0);

        const inv = data.inventorySummary || {};
        s('ovInvItems', inv.totalItems ?? 0);
        s('ovInvBooks', inv.bookCount ?? 0);
        s('ovInvLoans', inv.activeLoans ?? 0);
        const invPill = document.getElementById('ovInvAlertPill');
        if (invPill) {
            const issues = (inv.lowStockCount || 0) + (inv.overdueLoans || 0);
            invPill.textContent = issues > 0 ? `${issues} Alerts` : 'Healthy';
            invPill.style.background = issues > 0 ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.12)';
            invPill.style.color = issues > 0 ? '#ef4444' : '#059669';
        }

        // Ramadan Token Readiness
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

        const rdCamp = data.ramadanSummary;
        if (rdCamp) {
            s('ovRdCampaignTitle', `${rdCamp.title} (${rdCamp.hijri_year ? rdCamp.hijri_year + 'H · ' : ''}${rdCamp.year})`);
            const parts = [];
            if (rdCamp.collection_date) parts.push(`Date: ${rdCamp.collection_date}`);
            if (rdCamp.collection_location) parts.push(rdCamp.collection_location);
            if (rdCamp.voucher_value) parts.push(`Voucher: LKR ${Number(rdCamp.voucher_value).toLocaleString()}`);
            s('ovRdCampaignMeta', parts.join(' · ') || 'Active Ramadan campaign');
        } else {
            s('ovRdCampaignTitle', 'No active Ramadan drive scheduled');
            s('ovRdCampaignMeta', 'Create or activate a distribution inside Ramadan Tokens');
        }

        // Analytics Charts, Priority Queue, Live Audit Feed & Transactions
        _renderOvCashflowChart(data.monthlyCashflow || []);
        _renderOvAllocationChart(data.expenseBreakdown || [], data.incomeBreakdown || []);
        _renderOvActionQueue(data.actionQueue || {});
        _renderOvActivityFeed(data.recentActivity || []);
        _ovAllTransactions = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];
        ovFilterTransactions();

        const syncEl = document.getElementById('ovLastSynced');
        if (syncEl) {
            const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            syncEl.innerHTML = `<i data-lucide="activity" style="width:12px; height:12px; color:#10b981;"></i><span>Synced ${t}</span>`;
        }
        if (window.lucide) lucide.createIcons();
        if (manualRefresh && typeof showToast === 'function') showToast('Dashboard telemetry refreshed', 'success');
    } catch (err) {
        console.error(err);
    } finally {
        if (refreshIcon) refreshIcon.classList.remove('ov-spin');
    }
}

function renderRecentTransactions(transactions, cacheRaw = true) {
    const list = Array.isArray(transactions) ? transactions : [];
    if (cacheRaw) _ovAllTransactions = list;

    const countBadge = document.getElementById('ovTxCountBadge');
    if (countBadge) countBadge.textContent = `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`;

    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    tbody.innerHTML = list.map(tx => `
        <tr>
            <td style="color:var(--text-main); font-weight:500; font-size:0.85rem;">${_esc(tx.description || '—')}</td>
            <td><span style="text-transform:capitalize; font-size:0.82rem; color:var(--text-muted);">${_esc(String(tx.category || 'general').replace(/_/g, ' '))}</span></td>
            <td style="font-weight:700; color:${tx.type === 'income' ? '#10b981' : 'var(--text-main)'};">LKR ${Number(tx.amount || 0).toLocaleString()}</td>
            <td style="font-size:0.82rem; color:var(--text-muted);">${tx.date ? new Date(tx.date).toLocaleDateString() : '—'}</td>
            <td><span class="status-badge" style="background:${tx.type === 'income' ? '#d1fae5' : '#fee2e2'}; color:${tx.type === 'income' ? '#065f46' : '#991b1b'};">${_esc(String(tx.type || '').toUpperCase())}</span></td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No matching transactions found</td></tr>';
    if (window.lucide) lucide.createIcons();
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

let currentMembers = []; // Global store for siblings & directory logic
let _lastFilteredMembers = [];
let _memberTypeFilter = 'all';
let _memberStatusFilter = 'all';
let _memberViewMode = 'table'; // 'table' | 'cards'

function _memEsc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _memInitials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
}

function _memFormatDate(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _memWhatsappUrl(rawPhone, text = '') {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.length < 7) return '';
    let intl = digits;
    if (digits.startsWith('0') && digits.length === 10) intl = '94' + digits.slice(1);
    else if (digits.length === 9 && digits.startsWith('7')) intl = '94' + digits;
    return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function _memAvatarHtml(m, extraClass = '') {
    const ring = `<span class="mem-status-ring-dot ${m.status === 'deactivate' ? 'deactivate' : 'active'}"></span>`;
    if (m.photo_url) {
        return `<div class="mem-avatar-wrap ${extraClass}"><img src="${_memEsc(m.photo_url)}" alt="${_memEsc(m.full_name)}" class="mem-avatar-img">${ring}</div>`;
    }
    const tierCls = m.member_type === 'founder' ? 'founder' : 'executive';
    return `<div class="mem-avatar-wrap ${extraClass}"><div class="mem-avatar-fallback ${tierCls}">${_memEsc(_memInitials(m.full_name))}</div>${ring}</div>`;
}

function _memTierPillHtml(m) {
    const isFounder = m.member_type === 'founder';
    const label = isFounder ? 'Founder' : 'Executive';
    const iconName = isFounder ? 'foundercrown' : 'idbadge';
    return `<span class="mem-tier-pill ${isFounder ? 'founder' : 'executive'}"><span class="edf-lottie-slot" style="width:14px;height:14px;" data-lottie-icon="${iconName}"></span>${label}</span>`;
}

async function copyMemberText(text, label = 'Text') {
    const clean = String(text || '').trim();
    if (!clean || clean === 'Auto' || clean === 'N/A' || clean === '—') return;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(clean);
        } else {
            const ta = document.createElement('textarea');
            ta.value = clean;
            ta.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
        showToast(`${label} copied: ${clean}`, 'success');
    } catch {
        showToast(`Copy failed`, 'error');
    }
}

let _mcmOnConfirm = null;
function openMemberConfirm({ title = 'Confirm Action', message = 'Are you sure?', note = '', confirmLabel = 'Confirm', onConfirm }) {
    const modal = document.getElementById('memberConfirmModal');
    if (!modal) {
        if (window.confirm(message) && typeof onConfirm === 'function') onConfirm();
        return;
    }
    document.getElementById('mcmTitle').textContent = title;
    document.getElementById('mcmMessage').textContent = message;
    const noteEl = document.getElementById('mcmNote');
    if (noteEl) {
        noteEl.textContent = note || '';
        noteEl.style.display = note ? 'block' : 'none';
    }
    const btn = document.getElementById('mcmConfirmBtn');
    btn.textContent = confirmLabel;
    _mcmOnConfirm = onConfirm;
    btn.onclick = async () => {
        btn.disabled = true;
        try {
            if (typeof _mcmOnConfirm === 'function') await _mcmOnConfirm();
        } finally {
            btn.disabled = false;
            closeModal('memberConfirmModal');
        }
    };
    openModal('memberConfirmModal');
    lucide.createIcons();
}

function openMemberPayDues(id) {
    closeModal('viewMemberModal');
    closeModal('memberHistoryModal');
    if (typeof openSubModal === 'function') {
        openSubModal('add', null, id);
    }
}

async function openMemberSms(id) {
    const m = currentMembers.find(mem => mem.id === id);
    if (!m) return;
    const phone = (m.phone || m.whatsapp || '').trim();
    if (!phone) {
        showToast(`No phone number saved for ${m.full_name}`, 'error');
        return;
    }
    closeModal('viewMemberModal');
    if (typeof window.switchTab === 'function') window.switchTab('smsgateway');
    if (typeof window.fetchSmsWorkspace === 'function' && Array.isArray(window.smsRecipients) && window.smsRecipients.length === 0) {
        await window.fetchSmsWorkspace();
    }
    if (typeof window.setSmsSubTab === 'function') window.setSmsSubTab('dispatch');
    if (typeof window.setSmsComposeMode === 'function') window.setSmsComposeMode('individual');
    if (typeof window.clearSmsRecipients === 'function') window.clearSmsRecipients();

    const customInp = document.getElementById('smsCustomPhones');
    if (customInp) customInp.value = phone;
    const msgBox = document.getElementById('smsMessageBody');
    if (msgBox && !msgBox.value.trim()) {
        msgBox.value = `Assalamu Alaikum ${m.full_name}, reminder regarding your EDF Galgamuwa membership.`;
    }
    if (typeof window.updateSmsSelectionSummary === 'function') window.updateSmsSelectionSummary();
    if (typeof window.updateSmsComposerPreview === 'function') window.updateSmsComposerPreview();
    if (msgBox) msgBox.focus();
    showToast(`SMS composer ready for ${m.full_name}`, 'success');
}

function openMemberIdCard(id) {
    const m = currentMembers.find(mem => mem.id === id);
    if (!m) return;
    const photoWrap = document.getElementById('micPhotoWrap');
    if (photoWrap) {
        photoWrap.innerHTML = m.photo_url
            ? `<img src="${_memEsc(m.photo_url)}" alt="${_memEsc(m.full_name)}" style="width:100%;height:100%;object-fit:cover;">`
            : _memEsc(_memInitials(m.full_name));
    }
    const isFounder = m.member_type === 'founder';
    const tierPill = document.getElementById('micTierPill');
    if (tierPill) {
        tierPill.textContent = isFounder ? 'FOUNDING MEMBER' : 'EXECUTIVE STEWARD';
        tierPill.style.background = isFounder ? 'rgba(212,175,55,0.24)' : 'rgba(16,185,129,0.25)';
        tierPill.style.borderColor = isFounder ? 'rgba(252,211,77,0.5)' : 'rgba(110,231,183,0.5)';
        tierPill.style.color = isFounder ? '#fde68a' : '#a7f3d0';
    }
    document.getElementById('micName').textContent = m.full_name || 'Member';
    document.getElementById('micDesignation').textContent = m.designation || (isFounder ? 'Charter Founder & Trustee' : 'Executive Member');
    document.getElementById('micMembershipNo').textContent = `ID: ${m.membership_no || `EDF-${String(m.id).padStart(4, '0')}`}`;
    document.getElementById('micJoined').textContent = _memFormatDate(m.join_date);
    document.getElementById('micBlood').textContent = m.blood_group || 'N/A';
    document.getElementById('micNic').textContent = m.nic_number || 'Not recorded';
    document.getElementById('micPhone').textContent = m.phone || m.whatsapp || 'Not recorded';
    document.getElementById('micCity').textContent = m.city || 'Galgamuwa';
    document.getElementById('micEmergency').textContent = m.emergency_contact_phone || m.emergency_contact_name || 'N/A';
    document.getElementById('micFooterSerial').textContent = `#EDF-${String(m.id).padStart(4, '0')}`;
    openModal('memberIdCardModal');
    lucide.createIcons();
    window.initEdfLottieIcons?.();
}

function printMemberIdCard() {
    document.body.classList.add('mic-printing-card');
    const cleanup = () => document.body.classList.remove('mic-printing-card');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1200);
}

async function fetchMembers(showToastOnManual = false) {
    try {
        const response = await fetch('/api/edf/members');
        currentMembers = await response.json();

        // Update Sibling Dropdowns
        ['memberSiblingSelect', 'editMemberSiblingSelect'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">None</option>' +
                    currentMembers.map(m => `<option value="${m.id}">${_memEsc(m.full_name)}</option>`).join('');
            }
        });

        // Populate City Filter preserving current selection
        const citySel = document.getElementById('memCityFilter');
        if (citySel) {
            const prevCity = citySel.value;
            const cities = [...new Set(currentMembers.map(m => (m.city || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
            citySel.innerHTML = '<option value="">All Cities</option>' +
                cities.map(c => `<option value="${_memEsc(c)}">${_memEsc(c)}</option>`).join('');
            if (prevCity && cities.includes(prevCity)) citySel.value = prevCity;
        }

        // Update 5 Bento KPI cards
        const founders = currentMembers.filter(m => m.member_type === 'founder');
        const executives = currentMembers.filter(m => m.member_type === 'executive');
        const active = currentMembers.filter(m => m.status === 'active');
        const inactive = currentMembers.filter(m => m.status === 'deactivate');
        const monthlyPool = active.reduce((sum, m) => sum + (Number(m.monthly_subscription) || 0), 0);

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setTxt('mStatTotal', currentMembers.length);
        setTxt('mStatFounders', founders.length);
        setTxt('mStatExecutives', executives.length);
        setTxt('mStatActive', active.length);
        setTxt('mStatDuesPool', `LKR ${monthlyPool.toLocaleString()}`);

        const totalRelCity = new Set(currentMembers.map(m => (m.city || '').trim()).filter(Boolean)).size;
        setTxt('mStatTotalSub', `${totalRelCity || 0} cities/divisions represented`);
        const fDues = founders.reduce((s, m) => s + (Number(m.monthly_subscription) || 0), 0);
        setTxt('mStatFoundersSub', `LKR ${fDues.toLocaleString()}/mo commitment`);
        const eDues = executives.reduce((s, m) => s + (Number(m.monthly_subscription) || 0), 0);
        setTxt('mStatExecSub', `LKR ${eDues.toLocaleString()}/mo commitment`);
        setTxt('mStatActiveSub', inactive.length ? `${inactive.length} inactive record${inactive.length > 1 ? 's' : ''}` : '100% in active standing');
        setTxt('mStatAnnualPool', `LKR ${(monthlyPool * 12).toLocaleString()} / yr`);

        // Pill counters
        setTxt('mCntTypeAll', currentMembers.length);
        setTxt('mCntTypeFounder', founders.length);
        setTxt('mCntTypeExec', executives.length);
        setTxt('mCntStatAll', currentMembers.length);
        setTxt('mCntStatActive', active.length);
        setTxt('mCntStatInactive', inactive.length);

        filterMembers();
        lucide.createIcons();
        window.initEdfLottieIcons?.();
        if (showToastOnManual) {
            showToast(`Synced ${currentMembers.length} member records`, 'success');
        }
    } catch (err) {
        console.error(err);
        if (showToastOnManual) showToast('Failed to refresh members', 'error');
    }
}

function _syncMemberFilterControls() {
    document.querySelectorAll('#membersTab [data-ftype]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-ftype') === _memberTypeFilter);
    });
    document.querySelectorAll('#membersTab [data-fstatus]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-fstatus') === _memberStatusFilter);
    });
    document.getElementById('memKpiFounders')?.classList.toggle('is-filtered', _memberTypeFilter === 'founder');
    document.getElementById('memKpiExecutives')?.classList.toggle('is-filtered', _memberTypeFilter === 'executive');
    document.getElementById('memKpiActive')?.classList.toggle('is-filtered', _memberStatusFilter === 'active');
}

function setMemberTypeFilter(type) {
    _memberTypeFilter = type;
    _syncMemberFilterControls();
    filterMembers();
}

function setMemberStatusFilter(status) {
    _memberStatusFilter = status;
    _syncMemberFilterControls();
    filterMembers();
}

function toggleMemberKpiFilter(axis, val) {
    if (axis === 'type') {
        _memberTypeFilter = _memberTypeFilter === val ? 'all' : val;
    } else if (axis === 'status') {
        _memberStatusFilter = _memberStatusFilter === val ? 'all' : val;
    }
    _syncMemberFilterControls();
    filterMembers();
}

function setMemberViewMode(mode) {
    _memberViewMode = mode === 'cards' ? 'cards' : 'table';
    document.getElementById('memViewBtnTable')?.classList.toggle('active', _memberViewMode === 'table');
    document.getElementById('memViewBtnCards')?.classList.toggle('active', _memberViewMode === 'cards');
    filterMembers();
}

function clearMemberSearch() {
    const inp = document.getElementById('memberSearchInput');
    if (inp) inp.value = '';
    filterMembers();
    inp?.focus();
}

function resetAllMemberFilters() {
    _memberTypeFilter = 'all';
    _memberStatusFilter = 'all';
    const inp = document.getElementById('memberSearchInput');
    if (inp) inp.value = '';
    const citySel = document.getElementById('memCityFilter');
    if (citySel) citySel.value = '';
    const sortSel = document.getElementById('memSortSelect');
    if (sortSel) sortSel.value = 'name_asc';
    _syncMemberFilterControls();
    filterMembers();
}

function exportMembersCsv() {
    const rows = _lastFilteredMembers.length ? _lastFilteredMembers : currentMembers;
    if (!rows.length) { showToast('No member records to export', 'error'); return; }
    const escCsv = (val) => {
        const s = String(val == null ? '' : val);
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = ['Membership ID', 'Full Name', 'Tier', 'Designation', 'Status', 'NIC', 'Phone', 'WhatsApp', 'Email', 'City', 'Blood Group', 'Joined', 'Monthly Dues (LKR)'];
    const lines = [
        header.map(escCsv).join(','),
        ...rows.map(m => [
            m.membership_no || '',
            m.full_name || '',
            m.member_type || '',
            m.designation || '',
            m.status === 'deactivate' ? 'Inactive' : 'Active',
            m.nic_number || '',
            m.phone || '',
            m.whatsapp || '',
            m.email || '',
            m.city || '',
            m.blood_group || '',
            m.join_date ? String(m.join_date).slice(0, 10) : '',
            Number(m.monthly_subscription) || 0
        ].map(escCsv).join(','))
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EDF-Members-Roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Exported ${rows.length} members to CSV`, 'success');
}

function printMembersRoster() {
    const rows = _lastFilteredMembers.length ? _lastFilteredMembers : currentMembers;
    if (!rows.length) { showToast('No members to print', 'error'); return; }
    let printWrap = document.getElementById('memRosterPrintOverlay');
    if (printWrap) printWrap.remove();
    let styleEl = document.getElementById('memRosterPrintStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'memRosterPrintStyle';
        styleEl.textContent = `@media print { body.mem-printing-roster * { visibility: hidden !important; } body.mem-printing-roster #memRosterPrintOverlay, body.mem-printing-roster #memRosterPrintOverlay * { visibility: visible !important; } body.mem-printing-roster #memRosterPrintOverlay { position: absolute !important; inset: 0 !important; background: #fff !important; color: #111 !important; padding: 16px !important; display: block !important; z-index: 99999 !important; } }`;
        document.head.appendChild(styleEl);
    }
    printWrap = document.createElement('div');
    printWrap.id = 'memRosterPrintOverlay';
    printWrap.style.display = 'none';
    const totalDues = rows.reduce((s, m) => s + (Number(m.monthly_subscription) || 0), 0);
    printWrap.innerHTML = `
        <h2 style="margin:0 0 4px;">EDF Galgamuwa — Founders &amp; Members Official Roster</h2>
        <p style="margin:0 0 12px;font-size:12px;color:#475569;">Printed ${new Date().toLocaleDateString('en-GB')} · ${rows.length} members · Total Monthly Dues Pool: LKR ${totalDues.toLocaleString()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">ID</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Full Name</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Tier / Role</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Phone</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">City</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Monthly Dues</th><th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Status</th></tr></thead>
            <tbody>${rows.map(m => `<tr><td style="border:1px solid #cbd5e1;padding:5px;font-family:monospace;">${_memEsc(m.membership_no || '—')}</td><td style="border:1px solid #cbd5e1;padding:5px;font-weight:700;">${_memEsc(m.full_name)}</td><td style="border:1px solid #cbd5e1;padding:5px;">${_memEsc(m.member_type)}${m.designation ? ` · ${_memEsc(m.designation)}` : ''}</td><td style="border:1px solid #cbd5e1;padding:5px;">${_memEsc(m.phone || '—')}</td><td style="border:1px solid #cbd5e1;padding:5px;">${_memEsc(m.city || '—')}</td><td style="border:1px solid #cbd5e1;padding:5px;text-align:right;">LKR ${(Number(m.monthly_subscription) || 0).toLocaleString()}</td><td style="border:1px solid #cbd5e1;padding:5px;">${m.status === 'deactivate' ? 'Inactive' : 'Active'}</td></tr>`).join('')}</tbody>
        </table>`;
    document.body.appendChild(printWrap);
    document.body.classList.add('mem-printing-roster');
    const cleanup = () => {
        document.body.classList.remove('mem-printing-roster');
        printWrap.remove();
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1200);
}

function filterMembers() {
    const q = (document.getElementById('memberSearchInput')?.value || '').trim().toLowerCase();
    const cityVal = document.getElementById('memCityFilter')?.value || '';
    const sortVal = document.getElementById('memSortSelect')?.value || 'name_asc';

    const clearBtn = document.getElementById('memSearchClearBtn');
    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';

    const hasFilters = Boolean(q || cityVal || _memberTypeFilter !== 'all' || _memberStatusFilter !== 'all');
    const resetBtn = document.getElementById('memResetFiltersBtn');
    if (resetBtn) resetBtn.style.display = hasFilters ? 'inline-flex' : 'none';

    let filtered = currentMembers.filter(m => {
        if (_memberTypeFilter !== 'all' && m.member_type !== _memberTypeFilter) return false;
        if (_memberStatusFilter !== 'all' && m.status !== _memberStatusFilter) return false;
        if (cityVal && (m.city || '').trim() !== cityVal) return false;
        if (q && !(
            (m.full_name || '').toLowerCase().includes(q) ||
            (m.phone || '').toLowerCase().includes(q) ||
            (m.whatsapp || '').toLowerCase().includes(q) ||
            (m.email || '').toLowerCase().includes(q) ||
            (m.city || '').toLowerCase().includes(q) ||
            (m.nic_number || '').toLowerCase().includes(q) ||
            (m.membership_no || '').toLowerCase().includes(q) ||
            (m.designation || '').toLowerCase().includes(q) ||
            (m.blood_group || '').toLowerCase().includes(q)
        )) return false;
        return true;
    });

    filtered.sort((a, b) => {
        if (sortVal === 'name_desc') return (b.full_name || '').localeCompare(a.full_name || '');
        if (sortVal === 'sub_desc') return (Number(b.monthly_subscription) || 0) - (Number(a.monthly_subscription) || 0);
        if (sortVal === 'sub_asc') return (Number(a.monthly_subscription) || 0) - (Number(b.monthly_subscription) || 0);
        if (sortVal === 'joined_desc') return new Date(b.join_date || 0) - new Date(a.join_date || 0);
        if (sortVal === 'joined_asc') return new Date(a.join_date || 0) - new Date(b.join_date || 0);
        if (sortVal === 'id_asc') return (a.membership_no || '').localeCompare(b.membership_no || '');
        return (a.full_name || '').localeCompare(b.full_name || '');
    });

    _lastFilteredMembers = filtered;

    const countEl = document.getElementById('membersFilterCount');
    if (countEl) {
        countEl.textContent = filtered.length < currentMembers.length
            ? `Showing ${filtered.length} of ${currentMembers.length} members`
            : `${currentMembers.length} total member${currentMembers.length !== 1 ? 's' : ''}`;
    }

    const tableWrap = document.getElementById('membersTableWrap');
    const cardsGrid = document.getElementById('membersCardsGrid');
    const emptyEl = document.getElementById('membersEmptyState');

    if (filtered.length === 0) {
        if (tableWrap) tableWrap.style.display = 'none';
        if (cardsGrid) cardsGrid.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        lucide.createIcons();
        window.initEdfLottieIcons?.();
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    const buildActionsHtml = (m) => `
        <div class="mem-act-bar">
            <button type="button" class="mem-act-btn emerald" onclick="viewMember(${m.id})" title="View Member Dossier"><i data-lucide="eye" style="width:15px;height:15px;"></i></button>
            <button type="button" class="mem-act-btn gold" onclick="openMemberHistory(${m.id})" title="Payment History Ledger"><i data-lucide="history" style="width:15px;height:15px;"></i></button>
            <button type="button" class="mem-act-btn info" onclick="openMemberIdCard(${m.id})" title="Digital ID Card"><i data-lucide="id-card" style="width:15px;height:15px;"></i></button>
            <button type="button" class="mem-act-btn" onclick="openMemberSms(${m.id})" title="Send SMS via Gateway"><i data-lucide="message-square" style="width:15px;height:15px;"></i></button>
            <button type="button" class="mem-act-btn emerald" onclick="editMember(${m.id})" title="Edit Member Profile"><i data-lucide="edit-2" style="width:15px;height:15px;"></i></button>
            <button type="button" class="mem-act-btn danger" onclick="deleteMember(${m.id})" title="Delete Member"><i data-lucide="trash-2" style="width:15px;height:15px;"></i></button>
        </div>`;

    if (_memberViewMode === 'cards') {
        if (tableWrap) tableWrap.style.display = 'none';
        if (cardsGrid) {
            cardsGrid.style.display = 'grid';
            cardsGrid.innerHTML = filtered.map(m => {
                const waUrl = _memWhatsappUrl(m.whatsapp || m.phone, `Assalamu Alaikum ${m.full_name}`);
                return `
                <div class="mem-card ${m.member_type === 'founder' ? 'is-founder' : ''}">
                    <div class="mem-card-top">
                        ${_memAvatarHtml(m)}
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem;">
                                <div style="font-weight:800; font-size:0.96rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${_memEsc(m.full_name)}</div>
                                <span class="status-badge status-${_memEsc(m.status)}" style="flex-shrink:0;">${m.status === 'deactivate' ? 'Inactive' : 'Active'}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.38rem; flex-wrap:wrap; margin-top:0.28rem;">
                                ${_memTierPillHtml(m)}
                                ${m.membership_no ? `<button type="button" class="mem-id-pill" onclick="copyMemberText('${_memEsc(m.membership_no)}','Membership ID')" title="Copy ID">${_memEsc(m.membership_no)}</button>` : ''}
                                ${m.blood_group ? `<span class="mem-blood-chip">${_memEsc(m.blood_group)}</span>` : ''}
                            </div>
                            ${m.designation ? `<div style="font-size:0.73rem; color:var(--text-muted); font-weight:600; margin-top:0.22rem;">${_memEsc(m.designation)}</div>` : ''}
                        </div>
                    </div>
                    <div class="mem-card-meta-grid">
                        <div>
                            <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Phone</div>
                            <div style="font-weight:700; color:var(--text-main);">${_memEsc(m.phone || '—')}</div>
                        </div>
                        <div>
                            <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">City</div>
                            <div style="font-weight:700; color:var(--text-main);">${_memEsc(m.city || '—')}</div>
                        </div>
                        <div>
                            <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Monthly Dues</div>
                            <div style="font-weight:800; color:#059669;">LKR ${(Number(m.monthly_subscription) || 0).toLocaleString()}</div>
                        </div>
                        <div>
                            <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Joined</div>
                            <div style="font-weight:700; color:var(--text-main);">${_memFormatDate(m.join_date)}</div>
                        </div>
                    </div>
                    <div class="mem-card-footer">
                        <div style="display:flex; align-items:center; gap:0.32rem; flex-wrap:wrap;">
                            <button type="button" class="mem-pay-quick-btn" style="margin-top:0;" onclick="openMemberPayDues(${m.id})" title="Record monthly dues">+ Pay</button>
                            ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="mem-wa-chip">WhatsApp</a>` : ''}
                        </div>
                        ${buildActionsHtml(m)}
                    </div>
                </div>`;
            }).join('');
        }
    } else {
        if (cardsGrid) cardsGrid.style.display = 'none';
        if (tableWrap) tableWrap.style.display = 'block';
        const tbody = document.getElementById('membersBody');
        tbody.innerHTML = filtered.map(m => {
            const waUrl = _memWhatsappUrl(m.whatsapp || m.phone, `Assalamu Alaikum ${m.full_name}`);
            return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:0.78rem;">
                        ${_memAvatarHtml(m)}
                        <div style="min-width:0;">
                            <div style="font-weight:700; color:var(--text-main); line-height:1.3;">${_memEsc(m.full_name)}</div>
                            <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap; margin-top:0.18rem;">
                                ${m.membership_no ? `<button type="button" class="mem-id-pill" onclick="copyMemberText('${_memEsc(m.membership_no)}','Membership ID')" title="Copy Membership ID">${_memEsc(m.membership_no)}</button>` : ''}
                                ${m.email ? `<span style="font-size:0.72rem; color:var(--text-muted);">${_memEsc(m.email)}</span>` : (m.nic_number ? `<span style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">NIC: ${_memEsc(m.nic_number)}</span>` : '')}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${_memTierPillHtml(m)}</div>
                    ${m.designation ? `<div style="font-size:0.71rem;color:var(--text-muted);margin-top:3px;font-weight:600;">${_memEsc(m.designation)}</div>` : ''}
                </td>
                <td>
                    <div style="font-size:0.83rem; font-weight:600; color:var(--text-main);">${_memEsc(m.phone || '—')}</div>
                    ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="mem-wa-chip" style="margin-top:0.2rem;"><i data-lucide="message-circle" style="width:11px;height:11px;"></i> WhatsApp</a>` : ''}
                </td>
                <td>
                    <div style="font-size:0.83rem; color:var(--text-main); font-weight:600;">${_memEsc(m.city || '—')}</div>
                    ${m.blood_group ? `<span class="mem-blood-chip" style="margin-top:0.18rem;">${_memEsc(m.blood_group)}</span>` : ''}
                </td>
                <td style="color:var(--text-muted); font-size:0.82rem; white-space:nowrap;">${_memFormatDate(m.join_date)}</td>
                <td>
                    <div style="font-weight:800; color:var(--text-main); font-size:0.86rem;">LKR ${(Number(m.monthly_subscription) || 0).toLocaleString()}</div>
                    <button type="button" class="mem-pay-quick-btn" onclick="openMemberPayDues(${m.id})" title="Record monthly dues">+ Pay</button>
                </td>
                <td><span class="status-badge status-${_memEsc(m.status)}">${m.status === 'deactivate' ? 'Inactive' : 'Active'}</span></td>
                <td style="text-align:right; white-space:nowrap;">${buildActionsHtml(m)}</td>
            </tr>`;
        }).join('');
    }
    lucide.createIcons();
    window.initEdfLottieIcons?.();
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
    const progWrap = document.getElementById('pmhAnnualProgressWrap');
    if (progWrap) progWrap.style.display = 'none';

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
        lucide.createIcons();
        window.initEdfLottieIcons?.();
    } catch (err) {
        showToast('Network error loading history', 'error');
        closeModal('memberHistoryModal');
    }
}

function pmhOpenQuickPay() {
    const memberId = _pmhData?.member?.id;
    if (!memberId) return;
    openMemberPayDues(memberId);
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
    const initials = _memInitials(member.full_name);
    const typeColor = member.member_type === 'founder' ? '#b45309' : '#047857';
    const typeBg    = member.member_type === 'founder' ? 'rgba(245,158,11,0.16)' : 'rgba(16,185,129,0.14)';
    const typeLabel = member.member_type === 'founder' ? 'Founder' : 'Executive';
    const statusColor = member.status === 'active' ? '#10b981' : '#ef4444';

    const avatarEl = document.getElementById('pmhAvatar');
    if (avatarEl) {
        if (member.photo_url) {
            avatarEl.innerHTML = `<img src="${_memEsc(member.photo_url)}" alt="${_memEsc(member.full_name)}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            avatarEl.textContent = initials;
        }
    }
    document.getElementById('pmhMemberName').textContent = member.full_name;
    document.getElementById('pmhTypeBadge').textContent = member.membership_no ? `${typeLabel} · ${member.membership_no}` : typeLabel;
    document.getElementById('pmhTypeBadge').style.cssText = `background:${typeBg};color:${typeColor};padding:0.2rem 0.72rem;border-radius:99px;font-size:0.72rem;font-weight:700;letter-spacing:0.03em;`;
    document.getElementById('pmhStatusDot').style.background = statusColor;
    document.getElementById('pmhStatusText').textContent = member.status === 'active' ? 'Active' : 'Inactive';
    document.getElementById('pmhJoinDate').textContent   = _pmhFmtDate(member.join_date);
    document.getElementById('pmhMonthlyAmt').textContent = _pmhFmt(member.monthly_subscription);
    document.getElementById('pmhEmail').textContent      = member.email || member.phone || '—';
}

function _pmhRenderStats() {
    const { member, subscriptions, summary } = _pmhData;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('pmhStatTotal',   _pmhFmt(summary.total_paid));
    s('pmhStatCount',   `${summary.months_count} payment${summary.months_count !== 1 ? 's' : ''}`);
    s('pmhStatAvg',     _pmhFmt(summary.avg_payment));
    s('pmhStatLast',    summary.latest_payment ? _pmhFmtDate(summary.latest_payment) : 'Never');
    s('pmhStatFirst',   summary.first_payment  ? _pmhFmtDate(summary.first_payment)  : '—');

    const progWrap = document.getElementById('pmhAnnualProgressWrap');
    const monthly = Number(member?.monthly_subscription) || 0;
    if (progWrap && monthly > 0) {
        const yr = String(new Date().getFullYear());
        const annualTarget = monthly * 12;
        const ytdPaid = (subscriptions || [])
            .filter(sub => String(sub.month || '').startsWith(yr))
            .reduce((acc, sub) => acc + (Number(sub.amount) || 0), 0);
        const pct = Math.min(100, Math.round((ytdPaid / annualTarget) * 100));
        document.getElementById('pmhAnnualLabel').textContent = `${yr} Dues Collection: LKR ${ytdPaid.toLocaleString()} / LKR ${annualTarget.toLocaleString()} annual pledge`;
        document.getElementById('pmhAnnualPct').textContent = `${pct}%`;
        document.getElementById('pmhAnnualFill').style.width = `${pct}%`;
        progWrap.style.display = 'block';
    }
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
                <div style="display:inline-flex; align-items:center; gap:0.4rem;">
                    <span class="pmh-paid-badge"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Paid</span>
                    <button type="button" class="sub-act-btn sub-act-receipt" onclick="openSubReceiptModal(${_pmhData.member.id}, ${s.id})" title="Print Receipt (A4 / 80mm)">
                        <i data-lucide="printer" style="width:13px;height:13px;"></i>
                    </button>
                </div>
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
    const initEl = document.getElementById('viewMemberInitial');
    if (initEl) {
        if (m.photo_url) {
            initEl.innerHTML = `<img src="${_memEsc(m.photo_url)}" alt="${_memEsc(m.full_name)}" style="width:100%;height:100%;object-fit:cover;">`;
            initEl.style.padding = '0';
        } else {
            initEl.textContent = _memInitials(m.full_name);
        }
    }
    const idPill = document.getElementById('viewMemberIdPill');
    if (idPill) {
        if (m.membership_no) {
            idPill.textContent = m.membership_no;
            idPill.style.display = 'inline-flex';
        } else {
            idPill.style.display = 'none';
        }
    }
    const bloodChip = document.getElementById('viewMemberBloodChip');
    if (bloodChip) {
        if (m.blood_group) {
            bloodChip.textContent = m.blood_group;
            bloodChip.style.display = 'inline-flex';
        } else {
            bloodChip.style.display = 'none';
        }
    }
    const badge = document.getElementById('viewMemberBadge');
    badge.textContent = m.status === 'deactivate' ? 'Inactive' : 'Active';
    badge.className = `status-badge status-${_memEsc(m.status)}`;

    const typeEl = document.getElementById('viewMemberType');
    if (typeEl) {
        const tierLabel = m.member_type === 'founder' ? 'Charter Founder' : 'Executive Member';
        const roleLabel = m.designation ? ` · ${m.designation}` : '';
        typeEl.textContent = tierLabel + roleLabel;
    }

    const waLink = document.getElementById('viewMemberWaLink');
    const waUrl = _memWhatsappUrl(m.whatsapp || m.phone, `Assalamu Alaikum ${m.full_name}`);
    if (waLink) {
        if (waUrl) {
            waLink.href = waUrl;
            waLink.style.display = 'inline-flex';
        } else {
            waLink.style.display = 'none';
        }
    }
    const histBtn = document.getElementById('viewMemberHistoryBtn');
    if (histBtn) histBtn.onclick = () => { closeModal('viewMemberModal'); openMemberHistory(id); };
    const payBtn = document.getElementById('viewMemberPayBtn');
    if (payBtn) payBtn.onclick = () => openMemberPayDues(id);
    const smsBtn = document.getElementById('viewMemberSmsBtn');
    if (smsBtn) smsBtn.onclick = () => openMemberSms(id);
    const cardBtn = document.getElementById('viewMemberIdCardBtn');
    if (cardBtn) cardBtn.onclick = () => { closeModal('viewMemberModal'); openMemberIdCard(id); };

    const sibling = currentMembers.find(s => s.id === m.sibling_id);
    const fmt = v => v != null && v !== '' ? _memEsc(v) : 'N/A';
    const fmtLKR = v => v != null ? `LKR ${Number(v).toLocaleString()}` : 'N/A';
    const fmtDate = d => d ? _memFormatDate(d) : 'N/A';

    const detailItem = (label, valueHtml, copyRaw = '') => `
        <div class="detail-item">
            <div class="detail-label">
                <span>${label}</span>
                ${copyRaw ? `<button type="button" class="vm-copy-btn" onclick="copyMemberText('${_memEsc(copyRaw)}','${_memEsc(label)}')" title="Copy ${label}">Copy</button>` : ''}
            </div>
            <div class="detail-value">${valueHtml}</div>
        </div>`;

    document.getElementById('memberDetailsDisplay').innerHTML = [
        detailItem('Membership ID', fmt(m.membership_no), m.membership_no || ''),
        detailItem('Role / Designation', fmt(m.designation)),
        detailItem('NIC Number', fmt(m.nic_number), m.nic_number || ''),
        detailItem('Date of Birth', fmtDate(m.dob)),
        detailItem('Gender', fmt(m.gender)),
        detailItem('Age', m.age != null && m.age !== '' ? `${_memEsc(m.age)} yrs` : 'N/A'),
        detailItem('Marital Status', fmt(m.marital_status)),
        detailItem('Blood Group', m.blood_group ? `<span class="mem-blood-chip">${_memEsc(m.blood_group)}</span>` : 'N/A'),
        detailItem('Primary Phone', fmt(m.phone), m.phone || ''),
        detailItem('WhatsApp', fmt(m.whatsapp), m.whatsapp || ''),
        detailItem('Email', fmt(m.email), m.email || ''),
        detailItem('City', fmt(m.city)),
        detailItem('Occupation', fmt(m.occupation)),
        detailItem('Address', fmt(m.address)),
        detailItem('Emergency Contact', m.emergency_contact_name ? `${_memEsc(m.emergency_contact_name)} (${_memEsc(m.emergency_contact_phone || '—')})` : 'N/A', m.emergency_contact_phone || ''),
        detailItem('Join Date', fmtDate(m.join_date)),
        m.notes ? detailItem('Notes / Bio', fmt(m.notes)) : ''
    ].join('');

    document.getElementById('memberFinancialDisplay').innerHTML = [
        detailItem('Member Tier', m.member_type === 'founder' ? 'Charter Founder' : 'Executive Member'),
        detailItem('Monthly Subscription', `<span style="color:#059669;">${fmtLKR(m.monthly_subscription)}</span>`),
        detailItem('Annual Commitment', fmtLKR((Number(m.monthly_subscription) || 0) * 12)),
        detailItem('Monthly Income', fmtLKR(m.monthly_income)),
        detailItem('Previous Balance', fmtLKR(m.previous_balance)),
        detailItem('Bank Name', fmt(m.bank_name)),
        detailItem('Bank Branch', fmt(m.bank_branch)),
        detailItem('Account Holder', fmt(m.account_holder_name)),
        detailItem('Account Number', fmt(m.account_number), m.account_number || ''),
        detailItem('Linked Member', sibling ? _memEsc(sibling.full_name) : 'None'),
    ].join('');

    const footerMeta = document.getElementById('viewMemberFooterMeta');
    if (footerMeta) {
        footerMeta.textContent = `Record #${m.id}${m.join_date ? ` · Steward since ${fmtDate(m.join_date)}` : ''}`;
    }

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
    window.initEdfLottieIcons?.();
}

function deleteMember(id) {
    const m = currentMembers.find(mem => mem.id === id);
    const name = m ? m.full_name : 'this member';
    openMemberConfirm({
        title: 'Delete Member Record',
        message: `Remove ${name} from the EDF Founders & Members directory?`,
        note: 'All associated family dependent records for this member will also be deleted.',
        confirmLabel: 'Delete Member',
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/edf/members/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    showToast(`${name} removed successfully`, 'success');
                    await fetchMembers();
                    if (typeof fetchStats === 'function') fetchStats();
                } else {
                    showToast('Failed to delete member', 'error');
                }
            } catch (err) {
                console.error('Delete failed:', err);
                showToast('Network error while deleting', 'error');
            }
        }
    });
}

async function fetchRelatives(memberId) {
    const res = await fetch(`/api/edf/members/${memberId}/relatives`);
    const data = await res.json();
    const list = document.getElementById('relativesList');
    const relCnt = document.getElementById('viewMemberRelCount');
    if (relCnt) relCnt.textContent = Array.isArray(data) ? data.length : 0;

    list.innerHTML = data.map(r => `
        <div class="relative-card">
            <div class="relative-info">
                <div class="relative-name">${_memEsc(r.full_name)}</div>
                <div class="relative-meta">
                    <span style="text-transform:capitalize; font-weight:700; color:#059669;">${_memEsc(r.relationship)}</span>${r.gender ? ` (${_memEsc(r.gender)})` : ''} •
                    Age: ${_memEsc(r.age || 'N/A')} •
                    NIC: ${_memEsc(r.nic_number || 'N/A')} •
                    ${_memEsc(r.occupation || 'No Job info')}
                </div>
            </div>
            <button type="button" class="mem-act-btn danger" onclick="deleteRelative(${r.id}, ${memberId})" title="Remove Dependent"><i data-lucide="trash-2" style="width:15px;height:15px;"></i></button>
        </div>
    `).join('') || `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.84rem; background:var(--input-bg); border:1px dashed var(--border-color); border-radius:14px;">No family dependents recorded yet. Use the form below to add one.</div>`;
    lucide.createIcons();
}

function deleteRelative(id, memberId) {
    openMemberConfirm({
        title: 'Remove Dependent',
        message: 'Remove this family dependent from the member dossier?',
        note: 'You can add the dependent back at any time.',
        confirmLabel: 'Remove',
        onConfirm: async () => {
            const res = await fetch(`/api/edf/relatives/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRelatives(memberId);
                showToast('Dependent removed', 'success');
            } else {
                showToast('Failed to remove dependent', 'error');
            }
        }
    });
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

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGNED MEMBER MODAL — STEPPER, SMART NIC DECODER, PHOTO & LIVE PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

const MEMBER_STEPS = ['tab-general', 'tab-contact', 'tab-financial', 'tab-family'];
const MEMBER_STEP_TITLES = [
    'Step 1 of 4 • Personal & Identity',
    'Step 2 of 4 • Contact & Location',
    'Step 3 of 4 • Membership & Financials',
    'Step 4 of 4 • Family & Dependents'
];
let _currentMemberStep = 0;
let _lastDecodedNicData = null;

function goToMemberStep(stepIdx) {
    if (stepIdx < 0 || stepIdx >= MEMBER_STEPS.length) return;
    _currentMemberStep = stepIdx;
    const modal = document.getElementById('memberModal');
    if (!modal) return;

    const targetTabId = MEMBER_STEPS[stepIdx];
    modal.querySelectorAll('.mem-step-tab').forEach((tab, idx) => {
        tab.classList.remove('active', 'completed');
        if (idx === stepIdx) tab.classList.add('active');
        else if (idx < stepIdx) tab.classList.add('completed');
    });

    modal.querySelectorAll('.modal-tab-content').forEach(panel => {
        panel.classList.toggle('active', panel.id === targetTabId);
    });

    const body = modal.querySelector('.mem-modal-body');
    if (body) body.scrollTop = 0;

    const stepText = document.getElementById('memStepFooterText');
    if (stepText) stepText.textContent = MEMBER_STEP_TITLES[stepIdx];

    const prevBtn = document.getElementById('memPrevStepBtn');
    const nextBtn = document.getElementById('memNextStepBtn');
    if (prevBtn) prevBtn.style.display = stepIdx === 0 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = stepIdx === MEMBER_STEPS.length - 1 ? 'none' : 'inline-flex';

    updateMemberLivePreview();
    window.initEdfLottieIcons?.();
    window.refreshEdfLottieState?.();
}

function stepMemberModal(delta) {
    const nextIdx = _currentMemberStep + delta;
    if (delta > 0 && _currentMemberStep === 0) {
        const nameInput = document.getElementById('memFullNameInput');
        if (nameInput && !nameInput.value.trim()) {
            nameInput.focus();
            showToast('Please enter the member\'s Full Legal Name before continuing', 'error');
            return;
        }
    }
    if (delta > 0 && _currentMemberStep === 1) {
        const phoneInput = document.getElementById('memPhoneInput');
        if (phoneInput && !phoneInput.value.trim()) {
            phoneInput.focus();
            showToast('Please enter the Primary Phone Number before continuing', 'error');
            return;
        }
    }
    goToMemberStep(nextIdx);
}

// Sri Lankan NIC Parser (supports old 9-digit+V/X and new 12-digit NICs)
function parseSriLankanNIC(raw) {
    if (!raw) return null;
    const clean = String(raw).trim().toUpperCase();
    let year = null;
    let dayOfYear = null;

    const oldMatch = clean.match(/^(\d{2})(\d{3})\d{4}[VX]$/);
    const newMatch = clean.match(/^(\d{4})(\d{3})\d{5}$/);

    if (oldMatch) {
        year = 1900 + parseInt(oldMatch[1], 10);
        dayOfYear = parseInt(oldMatch[2], 10);
    } else if (newMatch) {
        year = parseInt(newMatch[1], 10);
        dayOfYear = parseInt(newMatch[2], 10);
    } else {
        return null;
    }

    let gender = 'male';
    if (dayOfYear > 500) {
        gender = 'female';
        dayOfYear -= 500;
    }

    if (dayOfYear < 1 || dayOfYear > 366 || year < 1900 || year > new Date().getFullYear()) {
        return null;
    }

    // Sri Lankan NIC standard uses a 366-day leap-year month table
    const monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let rem = dayOfYear;
    let monthIdx = 0;
    for (let i = 0; i < 12; i++) {
        if (rem <= monthDays[i]) {
            monthIdx = i;
            break;
        }
        rem -= monthDays[i];
    }
    const day = Math.max(1, rem);
    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dob = `${year}-${mm}-${dd}`;

    const today = new Date();
    let age = today.getFullYear() - year;
    const mDiff = (today.getMonth() + 1) - (monthIdx + 1);
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
        age--;
    }

    return { dob, age: Math.max(0, age), gender, year };
}

function onMemberNicInput(val) {
    const clean = (val || '').trim();
    const form = document.getElementById('memberForm');
    const currentId = form?.elements['id']?.value ? Number(form.elements['id'].value) : null;

    // 1. Duplicate check
    const dupBanner = document.getElementById('memNicDupBanner');
    const dupText = document.getElementById('memNicDupText');
    if (clean.length >= 9) {
        const dup = currentMembers.find(m => m.id !== currentId && (m.nic_number || '').toUpperCase() === clean.toUpperCase());
        if (dup && dupBanner && dupText) {
            dupBanner.style.display = 'flex';
            dupText.textContent = `⚠️ NIC already registered to ${dup.full_name}`;
        } else if (dupBanner) {
            dupBanner.style.display = 'none';
        }
    } else if (dupBanner) {
        dupBanner.style.display = 'none';
    }

    // 2. Smart NIC Decode
    const decoded = parseSriLankanNIC(clean);
    const decBanner = document.getElementById('memNicDecodedBanner');
    const decText = document.getElementById('memNicDecodedText');
    _lastDecodedNicData = decoded;

    if (decoded && decBanner && decText) {
        decBanner.style.display = 'flex';
        decText.textContent = `✨ NIC Decoded: DOB ${decoded.dob} · Age ${decoded.age} yrs · ${decoded.gender === 'female' ? 'Female' : 'Male'}`;
        // Auto-apply if DOB or Age is empty
        const dobEl = document.getElementById('memDobInput');
        const ageEl = document.getElementById('memAgeInput');
        if (dobEl && !dobEl.value) dobEl.value = decoded.dob;
        if (ageEl && !ageEl.value) ageEl.value = decoded.age;
        setMemberGender(decoded.gender);
    } else if (decBanner) {
        decBanner.style.display = 'none';
    }

    updateMemberLivePreview();
}

function applyDecodedNicData() {
    if (!_lastDecodedNicData) return;
    const dobEl = document.getElementById('memDobInput');
    const ageEl = document.getElementById('memAgeInput');
    if (dobEl) dobEl.value = _lastDecodedNicData.dob;
    if (ageEl) ageEl.value = _lastDecodedNicData.age;
    setMemberGender(_lastDecodedNicData.gender);
    updateMemberLivePreview();
    showToast('Applied DOB, Age & Gender from NIC', 'success');
}

function onMemberDobChange(dobStr) {
    if (!dobStr) return;
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    const ageInput = document.getElementById('memAgeInput');
    if (ageInput && age >= 0 && age <= 120) {
        ageInput.value = age;
        const hint = document.getElementById('memAgeHint');
        if (hint) hint.textContent = 'From DOB';
    }
    updateMemberLivePreview();
}

function onMemberPhoneInput(val) {
    const clean = (val || '').replace(/\s+/g, '');
    const form = document.getElementById('memberForm');
    const currentId = form?.elements['id']?.value ? Number(form.elements['id'].value) : null;
    const dupBanner = document.getElementById('memPhoneDupBanner');
    const dupText = document.getElementById('memPhoneDupText');

    if (clean.length >= 9) {
        const dup = currentMembers.find(m => m.id !== currentId && (m.phone || '').replace(/\s+/g, '') === clean);
        if (dup && dupBanner && dupText) {
            dupBanner.style.display = 'flex';
            dupText.textContent = `ℹ️ Note: Phone number is also listed under ${dup.full_name}`;
        } else if (dupBanner) {
            dupBanner.style.display = 'none';
        }
    } else if (dupBanner) {
        dupBanner.style.display = 'none';
    }
    updateMemberLivePreview();
}

function setMemberGender(gender) {
    const g = gender === 'female' ? 'female' : 'male';
    const sel = document.getElementById('memGenderSelect');
    if (sel) sel.value = g;
    document.querySelectorAll('#memGenderSeg .mem-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === g);
    });
}

function setMemberBloodGroup(bg) {
    const val = bg || '';
    const sel = document.getElementById('memBloodSelect');
    if (sel) sel.value = val;
    document.querySelectorAll('#memBloodPills .mem-blood-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bg === val && val !== '');
    });
    updateMemberLivePreview();
}

function _setMemberModalHeaderLottie(iconName) {
    const box = document.getElementById('memModalHeaderIconBox');
    if (!box) return;
    box.innerHTML = `<span id="memModalHeaderLottie" class="edf-lottie-slot" data-lottie-icon="${iconName}" data-lottie-trigger="loop"></span>`;
    window.initEdfLottieIcons?.();
}

function setMemberCityChip(city) {
    const inp = document.getElementById('memCityInput');
    if (inp) inp.value = city;
    updateMemberLivePreview();
}

function setMemberTier(tier) {
    const t = tier === 'founder' ? 'founder' : 'executive';
    const sel = document.getElementById('memTypeSelect');
    if (sel) sel.value = t;
    document.querySelectorAll('#memberModal .mem-tier-card').forEach(card => {
        card.classList.toggle('active', card.dataset.tier === t);
    });
    const form = document.getElementById('memberForm');
    const idVal = (form?.elements['id']?.value || '').trim();
    const memNoInput = document.getElementById('memMembershipNoInput');
    if (!idVal && memNoInput && /^EDF-(EXE|FND)-\d+$/i.test(memNoInput.value.trim())) {
        generateMemberAutoId();
    }
    updateMemberLivePreview();
    window.refreshEdfLottieState?.();
}

function setMemberStatus(status) {
    const s = status === 'deactivate' ? 'deactivate' : 'active';
    const sel = document.getElementById('memStatusSelect');
    if (sel) sel.value = s;
    document.querySelectorAll('#memStatusSeg .mem-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === s);
    });
    updateMemberLivePreview();
}

function setMemberSubPreset(amount) {
    const input = document.getElementById('memSubInput');
    if (input) input.value = amount;
    onMemberSubAmountInput(amount);
}

function onMemberSubAmountInput(val) {
    const amt = Number(val) || 0;
    document.querySelectorAll('#memberModal .mem-sub-preset-btn').forEach(btn => {
        const presetVal = Number(btn.textContent.replace(/,/g, ''));
        btn.classList.toggle('active', presetVal === amt);
    });
    const annualEl = document.getElementById('memAnnualCalcBadge');
    if (annualEl) annualEl.textContent = `LKR ${(amt * 12).toLocaleString()} / yr`;

    const initAmtEl = document.getElementById('memInitPayAmount');
    if (initAmtEl) initAmtEl.value = amt;

    updateMemberLivePreview();
}

function generateMemberAutoId() {
    const tier = document.getElementById('memTypeSelect')?.value || 'executive';
    const prefix = tier === 'founder' ? 'EDF-FND-' : 'EDF-EXE-';
    const sameTierCount = currentMembers.filter(m => m.member_type === tier).length;
    let nextNum = sameTierCount + 1;
    let candidate = prefix + String(nextNum).padStart(3, '0');
    while (currentMembers.some(m => (m.membership_no || '').toUpperCase() === candidate)) {
        nextNum++;
        candidate = prefix + String(nextNum).padStart(3, '0');
    }
    const input = document.getElementById('memMembershipNoInput');
    if (input) input.value = candidate;
    updateMemberLivePreview();
}

function copyPrimaryPhoneToWhatsapp() {
    const phone = document.getElementById('memPhoneInput')?.value || '';
    const wa = document.getElementById('memWhatsappInput');
    if (wa) {
        wa.value = phone;
        updateMemberLivePreview();
    }
}

function copyMemberNameToBankHolder() {
    const name = document.getElementById('memFullNameInput')?.value || '';
    const holder = document.getElementById('memAccountHolderInput');
    if (holder) holder.value = name;
}

function setMemberJoinDateToday() {
    const jd = document.getElementById('memJoinDateInput');
    if (jd) jd.value = new Date().toISOString().split('T')[0];
    updateMemberLivePreview();
}

function toggleMemberInitPayFields(checked) {
    const wrap = document.getElementById('memInitPayFields');
    if (wrap) wrap.style.display = checked ? 'block' : 'none';
    if (checked) {
        const monthInput = document.getElementById('memInitPayMonth');
        if (monthInput && !monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);
        const amtInput = document.getElementById('memInitPayAmount');
        const subAmt = document.getElementById('memSubInput')?.value || 5000;
        if (amtInput) amtInput.value = subAmt;
        const chqAmt = document.getElementById('memInitChequeAmt');
        if (chqAmt) chqAmt.value = subAmt;
        const methodSel = document.getElementById('memInitPayMethod');
        onMemInitPayMethodChange(methodSel ? methodSel.value : 'cash');
    } else {
        onMemInitPayMethodChange('cash');
        clearSubChequeImage('memInit');
    }
}

function onMemInitPayMethodChange(method) {
    const card = document.getElementById('memInitChannelDetailsCard');
    const refLbl = document.getElementById('memInitRefLabel');
    if (!card) return;
    if (!method || method === 'cash' || method === 'other') {
        card.style.display = 'none';
        if (refLbl) refLbl.textContent = 'Receipt / Ref No.';
        return;
    }
    card.style.display = 'block';
    card.className = 'sub-channel-card channel-' + method;

    // Auto-fill from Card B Bank Info if empty
    const bankIn = document.getElementById('memInitBankName');
    const codeIn = document.getElementById('memInitBankCode');
    const dtIn = document.getElementById('memInitChequeDate');
    const amtIn = document.getElementById('memInitChequeAmt');
    if (bankIn && !bankIn.value) bankIn.value = document.getElementById('memBankNameInput')?.value || '';
    if (codeIn && !codeIn.value) codeIn.value = document.getElementById('memBankBranchInput')?.value || '';
    if (dtIn && !dtIn.value) dtIn.value = new Date().toISOString().slice(0, 10);
    if (amtIn && !amtIn.value) amtIn.value = document.getElementById('memInitPayAmount')?.value || '';

    const titleEl = document.getElementById('memInitChannelTitle');
    const tagEl = document.getElementById('memInitChannelTag');
    const bNameLbl = document.getElementById('memInitBankNameLabel');
    const bCodeLbl = document.getElementById('memInitBankCodeLabel');
    const cAmtLbl = document.getElementById('memInitChqAmtLabel');
    const cDateLbl = document.getElementById('memInitChqDateLabel');
    const cImgLbl = document.getElementById('memInitChqImgLabel');

    if (method === 'cheque') {
        if (titleEl) titleEl.textContent = 'Cheque Payment Details';
        if (tagEl) { tagEl.textContent = 'Cheque Verification'; tagEl.style.background = 'rgba(245,158,11,0.14)'; tagEl.style.color = '#d97706'; }
        if (refLbl) refLbl.textContent = 'Cheque Number *';
        if (bNameLbl) bNameLbl.textContent = 'Bank Name *';
        if (bCodeLbl) bCodeLbl.textContent = 'Bank / Branch Code';
        if (cAmtLbl) cAmtLbl.textContent = 'Cheque Amount (LKR)';
        if (cDateLbl) cDateLbl.textContent = 'Written Date';
        if (cImgLbl) cImgLbl.textContent = 'Image of Cheque (Front / Scan)';
    } else if (method === 'bank_transfer') {
        if (titleEl) titleEl.textContent = 'Bank Transfer Details';
        if (tagEl) { tagEl.textContent = 'Wire / Slip Details'; tagEl.style.background = 'rgba(59,130,246,0.14)'; tagEl.style.color = '#3b82f6'; }
        if (refLbl) refLbl.textContent = 'Transfer Ref No.';
        if (bNameLbl) bNameLbl.textContent = 'Transfer Bank Name';
        if (bCodeLbl) bCodeLbl.textContent = 'Branch / Account Code';
        if (cAmtLbl) cAmtLbl.textContent = 'Transfer Amount (LKR)';
        if (cDateLbl) cDateLbl.textContent = 'Transfer Date';
        if (cImgLbl) cImgLbl.textContent = 'Transfer Slip / Receipt Copy';
    } else if (method === 'online') {
        if (titleEl) titleEl.textContent = 'Online / Digital Payment Details';
        if (tagEl) { tagEl.textContent = 'Digital Gateway'; tagEl.style.background = 'rgba(139,92,246,0.14)'; tagEl.style.color = '#8b5cf6'; }
        if (refLbl) refLbl.textContent = 'Transaction ID';
        if (bNameLbl) bNameLbl.textContent = 'Platform / Banking App';
        if (bCodeLbl) bCodeLbl.textContent = 'Channel Code';
        if (cAmtLbl) cAmtLbl.textContent = 'Amount Paid (LKR)';
        if (cDateLbl) cDateLbl.textContent = 'Payment Date';
        if (cImgLbl) cImgLbl.textContent = 'Payment Screenshot / E-Receipt';
    }
    lucide.createIcons();
}

// Member Photo Upload Handlers
function setMemberPhotoPreview(url) {
    const hidden = document.getElementById('memPhotoUrl');
    const preview = document.getElementById('memPhotoPreview');
    const placeholder = document.getElementById('memPhotoPlaceholderIcon');
    const removeBtn = document.getElementById('memPhotoRemoveBtn');
    const liveImg = document.getElementById('memLiveAvatarImg');
    const liveInitials = document.getElementById('memLiveAvatarInitials');
    const statusTitle = document.getElementById('memPhotoStatusTitle');

    if (hidden) hidden.value = url || '';
    if (url) {
        if (preview) { preview.src = url; preview.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        if (liveImg) { liveImg.src = url; liveImg.style.display = 'block'; }
        if (liveInitials) liveInitials.style.display = 'none';
        if (statusTitle) statusTitle.textContent = 'Portrait Photo Attached';
    } else {
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        if (placeholder) placeholder.style.display = '';
        if (removeBtn) removeBtn.style.display = 'none';
        if (liveImg) { liveImg.src = ''; liveImg.style.display = 'none'; }
        if (liveInitials) liveInitials.style.display = '';
        if (statusTitle) statusTitle.textContent = 'Member Profile Photo';
    }
    updateMemberLivePreview();
}

async function uploadMemberPhotoFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5 MB', 'error');
        return;
    }
    const statusTitle = document.getElementById('memPhotoStatusTitle');
    if (statusTitle) statusTitle.textContent = 'Uploading photo…';

    const fd = new FormData();
    fd.append('photo', file);
    try {
        const res = await fetch('/api/edf/members/upload-photo', {
            method: 'POST',
            body: fd
        });
        const data = await res.json();
        if (res.ok && data.photo_url) {
            setMemberPhotoPreview(data.photo_url);
            showToast('Member photo uploaded', 'success');
        } else {
            if (statusTitle) statusTitle.textContent = 'Member Profile Photo';
            showToast(data.message || 'Photo upload failed', 'error');
        }
    } catch (err) {
        if (statusTitle) statusTitle.textContent = 'Member Profile Photo';
        showToast('Network error uploading photo', 'error');
    }
}

function handleMemberPhotoSelect(e) {
    const file = e.target?.files?.[0];
    if (file) uploadMemberPhotoFile(file);
}

function handleMemberPhotoDrop(e) {
    e.preventDefault();
    document.getElementById('memPhotoDrop')?.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadMemberPhotoFile(file);
}

function removeMemberPhoto(e) {
    if (e) e.stopPropagation();
    const fileInput = document.getElementById('memPhotoInput');
    if (fileInput) fileInput.value = '';
    setMemberPhotoPreview('');
}

// Live Identity Banner & Completion Progress Updater
function updateMemberLivePreview() {
    const form = document.getElementById('memberForm');
    if (!form) return;

    const fullName = (form.elements['full_name']?.value || '').trim();
    const memNo = (form.elements['membership_no']?.value || '').trim();
    const tier = form.elements['member_type']?.value || 'executive';
    const role = form.elements['designation']?.value || '';
    const status = form.elements['status']?.value || 'active';
    const nic = (form.elements['nic_number']?.value || '').trim();
    const phone = (form.elements['phone']?.value || '').trim();
    const city = (form.elements['city']?.value || '').trim();
    const subAmt = Number(form.elements['monthly_subscription']?.value) || 0;

    const nameEl = document.getElementById('memLiveName');
    if (nameEl) nameEl.textContent = fullName || 'New Member Profile';

    const initialsEl = document.getElementById('memLiveAvatarInitials');
    if (initialsEl) {
        const parts = (fullName || 'M').split(/\s+/).filter(Boolean);
        initialsEl.textContent = parts.length > 1
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : (parts[0]?.[0] || 'M').toUpperCase();
    }

    const idBadge = document.getElementById('memLiveIdBadge');
    if (idBadge) idBadge.textContent = memNo ? memNo : 'ID: Auto';

    const tierBadge = document.getElementById('memLiveTierBadge');
    if (tierBadge) {
        tierBadge.textContent = tier === 'founder' ? 'Founder' : 'Executive Member';
        tierBadge.className = 'mem-live-chip ' + (tier === 'founder' ? 'mem-chip-founder' : 'mem-chip-executive');
    }

    const roleBadge = document.getElementById('memLiveRoleBadge');
    if (roleBadge) {
        if (role) {
            roleBadge.textContent = role;
            roleBadge.style.display = 'inline-flex';
        } else {
            roleBadge.style.display = 'none';
        }
    }

    const bloodVal = (form.elements['blood_group']?.value || '').trim();
    const bloodBadge = document.getElementById('memLiveBloodBadge');
    if (bloodBadge) {
        if (bloodVal) {
            bloodBadge.textContent = bloodVal;
            bloodBadge.style.display = 'inline-flex';
        } else {
            bloodBadge.style.display = 'none';
        }
    }

    const statusDot = document.getElementById('memLiveStatusDot');
    if (statusDot) {
        if (status === 'deactivate') {
            statusDot.style.color = '#ef4444';
            statusDot.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;"></span> Inactive';
        } else {
            statusDot.style.color = '#10b981';
            statusDot.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#10b981;display:inline-block;"></span> Active';
        }
    }

    const metaNic = document.getElementById('memLiveMetaNic');
    if (metaNic) metaNic.textContent = nic ? `NIC: ${nic}` : 'NIC: Not set';

    const metaPhone = document.getElementById('memLiveMetaPhone');
    if (metaPhone) metaPhone.textContent = phone ? `Phone: ${phone}` : 'Phone: Not set';

    const metaCity = document.getElementById('memLiveMetaCity');
    if (metaCity) metaCity.textContent = city ? city : 'Location: —';

    const liveSub = document.getElementById('memLiveSubAmt');
    if (liveSub) liveSub.textContent = `LKR ${subAmt.toLocaleString()}`;

    const liveAnnual = document.getElementById('memLiveAnnualAmt');
    if (liveAnnual) liveAnnual.textContent = `LKR ${(subAmt * 12).toLocaleString()} / year`;

    // Profile Completion Calculation
    const checks = [
        Boolean(fullName),
        Boolean(nic),
        Boolean(form.elements['dob']?.value || form.elements['age']?.value),
        Boolean(phone),
        Boolean(city || form.elements['address']?.value),
        Boolean(form.elements['occupation']?.value),
        Boolean(subAmt > 0),
        Boolean(form.elements['join_date']?.value),
        Boolean(form.elements['bank_name']?.value || form.elements['account_number']?.value),
        Boolean(memNo || form.elements['photo_url']?.value)
    ];
    const filled = checks.filter(Boolean).length;
    const pct = Math.max(10, Math.round((filled / checks.length) * 100));
    const fillEl = document.getElementById('memCompletionFill');
    const lblEl = document.getElementById('memCompletionLabel');
    if (fillEl) {
        fillEl.style.width = pct + '%';
        fillEl.style.background = pct >= 80 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b';
    }
    if (lblEl) lblEl.textContent = `${pct}% Complete`;
}

// Dynamic Relative Cards for Member Modal
function onRelativeRelationChange(selectEl) {
    const card = selectEl.closest('.relative-entry');
    if (!card) return;
    const rel = selectEl.value;
    const genderSel = card.querySelector('[name="rel_gender"]');
    if (genderSel) {
        if (['wife', 'daughter', 'mother', 'sister'].includes(rel)) genderSel.value = 'female';
        else if (['son', 'father', 'brother'].includes(rel)) genderSel.value = 'male';
    }
    updateMemberRelativesStats();
}

function updateMemberRelativesStats() {
    const container = document.getElementById('relativesContainer');
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.relative-entry'));

    // Re-number cards
    rows.forEach((row, i) => {
        const numBadge = row.querySelector('.mem-rel-idx');
        if (numBadge) numBadge.textContent = `#${i + 1}`;
    });

    const emptyState = document.getElementById('memRelEmptyState');
    if (emptyState) emptyState.style.display = rows.length === 0 ? 'block' : 'none';

    let spouse = 0, children = 0, other = 0;
    rows.forEach(row => {
        const rel = row.querySelector('[name="rel_type"]')?.value || 'other';
        if (rel === 'wife') spouse++;
        else if (rel === 'son' || rel === 'daughter') children++;
        else other++;
    });

    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setEl('memRelTotalCount', rows.length);
    setEl('memRelSpouseCount', spouse);
    setEl('memRelChildCount', children);
    setEl('memRelOtherCount', other);
    setEl('memStepRelBadge', rows.length);
}

function addRelativeRow(data = {}) {
    const container = document.getElementById('relativesContainer');
    if (!container) return;
    const rowId = `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const div = document.createElement('div');
    div.className = 'relative-entry';
    div.id = rowId;

    const rel = data.relationship || 'wife';
    const inferredGender = data.gender || (['wife', 'daughter', 'mother', 'sister'].includes(rel) ? 'female' : 'male');
    const idx = container.querySelectorAll('.relative-entry').length + 1;

    div.innerHTML = `
        <div class="mem-rel-card-top">
            <div class="mem-rel-card-num">
                <span class="mem-rel-idx" style="background:var(--input-bg);border:1px solid var(--border-color);padding:0.1rem 0.45rem;border-radius:6px;color:var(--text-main);">#${idx}</span>
                <span>Family Dependent Record</span>
            </div>
            <button type="button" class="mem-label-action" style="color:#ef4444;border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);" onclick="document.getElementById('${rowId}').remove(); updateMemberRelativesStats();">
                <i data-lucide="trash-2" style="width:12px;height:12px;vertical-align:middle;"></i> Remove
            </button>
        </div>
        <div class="mem-rel-card-grid">
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" name="rel_name" class="form-input" value="${data.full_name || ''}" placeholder="Dependent full name">
            </div>
            <div class="form-group">
                <label class="form-label">Relationship</label>
                <select name="rel_type" class="form-select" onchange="onRelativeRelationChange(this)">
                    <option value="wife" ${rel === 'wife' ? 'selected' : ''}>Wife / Spouse</option>
                    <option value="son" ${rel === 'son' ? 'selected' : ''}>Son</option>
                    <option value="daughter" ${rel === 'daughter' ? 'selected' : ''}>Daughter</option>
                    <option value="father" ${rel === 'father' ? 'selected' : ''}>Father</option>
                    <option value="mother" ${rel === 'mother' ? 'selected' : ''}>Mother</option>
                    <option value="brother" ${rel === 'brother' ? 'selected' : ''}>Brother</option>
                    <option value="sister" ${rel === 'sister' ? 'selected' : ''}>Sister</option>
                    <option value="other" ${rel === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Gender</label>
                <select name="rel_gender" class="form-select">
                    <option value="female" ${inferredGender === 'female' ? 'selected' : ''}>Female</option>
                    <option value="male" ${inferredGender === 'male' ? 'selected' : ''}>Male</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Age</label>
                <input type="number" name="rel_age" class="form-input" value="${data.age || ''}" placeholder="Yrs" min="0" max="120">
            </div>
            <div class="form-group">
                <label class="form-label">NIC / ID</label>
                <input type="text" name="rel_nic" class="form-input" value="${data.nic_number || ''}" placeholder="Optional ID">
            </div>
            <div class="form-group">
                <label class="form-label">Occupation / School</label>
                <input type="text" name="rel_occupation" class="form-input" value="${data.occupation || ''}" placeholder="Job or Grade">
            </div>
        </div>
    `;
    container.appendChild(div);
    updateMemberRelativesStats();
    lucide.createIcons();
}

document.getElementById('addRelativeRowBtn').addEventListener('click', () => addRelativeRow({ relationship: 'son', gender: 'male' }));

function resetMemberModalForAdd() {
    document.getElementById('memberModalTitle').textContent = 'Add New Member';
    const subEl = document.getElementById('memberModalSubtitle');
    if (subEl) subEl.textContent = 'Register founding or executive members, subscription tiers, banking & family dependents';
    _setMemberModalHeaderLottie('useradd');

    const form = document.getElementById('memberForm');
    form.reset();
    form.elements['id'].value = '';
    document.getElementById('relativesContainer').innerHTML = '';

    // Hide smart banners
    ['memNicDecodedBanner', 'memNicDupBanner', 'memPhoneDupBanner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const ageHint = document.getElementById('memAgeHint');
    if (ageHint) ageHint.textContent = '';

    // Default controls
    setMemberPhotoPreview('');
    setMemberGender('male');
    setMemberBloodGroup('');
    setMemberTier('executive');
    setMemberStatus('active');
    setMemberSubPreset(5000);
    setMemberJoinDateToday();
    generateMemberAutoId();

    // Show Add-only features (Initial payment card & Save & Add Another button)
    const initPayCard = document.getElementById('memInitPayCard');
    if (initPayCard) initPayCard.style.display = 'block';
    const initToggle = document.getElementById('memRecordInitPayToggle');
    if (initToggle) initToggle.checked = false;
    toggleMemberInitPayFields(false);

    const saveAnotherBtn = document.getElementById('saveAndAddAnotherMemberBtn');
    if (saveAnotherBtn) saveAnotherBtn.style.display = 'inline-flex';

    // Reset to Step 1 and update empty state for dependents
    updateMemberRelativesStats();
    goToMemberStep(0);
    updateMemberLivePreview();
}

function openAddMemberModal() {
    const form = document.getElementById('memberForm');
    if (form) form.elements['id'].value = '';
    openModal('memberModal');
}

async function editMember(id) {
    const m = currentMembers.find(mem => mem.id === id);
    if (!m) return;

    document.getElementById('memberModalTitle').textContent = 'Edit Member Profile';
    const subEl = document.getElementById('memberModalSubtitle');
    if (subEl) subEl.textContent = `Updating profile, financial settings & family records for ${m.full_name}`;
    _setMemberModalHeaderLottie('idbadge');

    const form = document.getElementById('memberForm');
    form.reset();
    form.elements['id'].value = id;

    // Hide smart banners
    ['memNicDecodedBanner', 'memNicDupBanner', 'memPhoneDupBanner'].forEach(bid => {
        const el = document.getElementById(bid);
        if (el) el.style.display = 'none';
    });

    // Reset Relatives
    document.getElementById('relativesContainer').innerHTML = '';

    // Auto-fill standard inputs
    Object.keys(m).forEach(key => {
        const input = form.elements[key];
        if (input && input.type !== 'file' && input.type !== 'checkbox') {
            input.value = m[key] != null ? m[key] : '';
        }
    });

    // Sync interactive visual controls
    setMemberPhotoPreview(m.photo_url || '');
    setMemberGender(m.gender || 'male');
    setMemberBloodGroup(m.blood_group || '');
    setMemberTier(m.member_type || 'executive');
    setMemberStatus(m.status || 'active');
    onMemberSubAmountInput(m.monthly_subscription != null ? m.monthly_subscription : 5000);

    // Hide Add-only controls in Edit mode
    const initPayCard = document.getElementById('memInitPayCard');
    if (initPayCard) initPayCard.style.display = 'none';
    const initToggle = document.getElementById('memRecordInitPayToggle');
    if (initToggle) initToggle.checked = false;
    toggleMemberInitPayFields(false);

    const saveAnotherBtn = document.getElementById('saveAndAddAnotherMemberBtn');
    if (saveAnotherBtn) saveAnotherBtn.style.display = 'none';

    // Load Relatives from API for editing
    try {
        const res = await fetch(`/api/edf/members/${id}/relatives`);
        const relatives = await res.json();
        if (Array.isArray(relatives)) {
            relatives.forEach(r => addRelativeRow(r));
        }
    } catch (e) { console.error(e); }

    updateMemberRelativesStats();
    goToMemberStep(0);
    updateMemberLivePreview();

    // Bypass the openModal override (which would reset the form for "Add New")
    originalOpenModal('memberModal');
    lucide.createIcons();
    window.initEdfLottieIcons?.();
    window.refreshEdfLottieState?.();
}

// Override original openModal to reset form for ADD
const originalOpenModal = openModal;
window.openModal = function (id) {
    if (id === 'memberModal') {
        resetMemberModalForAdd();
    }
    if (id === 'beneficiaryModal') {
        goToWizardStep(0);
    }
    originalOpenModal(id);
    lucide.createIcons();
    window.initEdfLottieIcons?.();
    window.refreshEdfLottieState?.();
};

async function populateBeneficiaryCategorySelect() {
    try {
        const res = await fetch('/api/edf/beneficiary-categories');
        const categories = await res.json();
        const select = document.getElementById('beneficiaryCategorySelect');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Category</option>' +
            categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (currentValue) select.value = currentValue;
        if (typeof updateBenLivePreview === 'function') updateBenLivePreview();
    } catch (err) { console.error(err); }
}

// Handle Member Form Submit (supports both regular Save and Save & Add Another)
let _saveAndAddAnotherFlag = false;

function submitMemberForm(addAnother = false) {
    _saveAndAddAnotherFlag = Boolean(addAnother);
    const form = document.getElementById('memberForm');
    if (form) form.requestSubmit();
}

document.getElementById('memberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveAnother = _saveAndAddAnotherFlag;
    _saveAndAddAnotherFlag = false;

    const form = e.target;
    const fullName = (form.elements['full_name']?.value || '').trim();
    const phone = (form.elements['phone']?.value || '').trim();

    if (!fullName) {
        goToMemberStep(0);
        document.getElementById('memFullNameInput')?.focus();
        showToast('Full Legal Name is required (Step 1)', 'error');
        return;
    }
    if (!phone) {
        goToMemberStep(1);
        document.getElementById('memPhoneInput')?.focus();
        showToast('Primary Phone Number is required (Step 2)', 'error');
        return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const memberId = data.id;

    data.record_initial_payment = Boolean(document.getElementById('memRecordInitPayToggle')?.checked) && !memberId;

    // Collect Relatives
    const relatives = [];
    document.getElementById('relativesContainer').querySelectorAll('.relative-entry').forEach(row => {
        const name = (row.querySelector('[name="rel_name"]')?.value || '').trim();
        if (name) {
            relatives.push({
                full_name: name,
                relationship: row.querySelector('[name="rel_type"]')?.value || 'other',
                gender: row.querySelector('[name="rel_gender"]')?.value || null,
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
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span>Saving…</span>'; }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            await fetchMembers();
            fetchStats();
            if (data.record_initial_payment && typeof loadSubscriptionsTab === 'function') {
                loadSubscriptionsTab();
            }

            if (saveAnother && !memberId) {
                resetMemberModalForAdd();
                lucide.createIcons();
                showToast(`${fullName} added! Ready for the next member.`, 'success');
            } else {
                closeModal('memberModal');
                const msg = memberId
                    ? 'Member profile updated successfully'
                    : (data.record_initial_payment ? 'New member registered & initial subscription recorded!' : 'New member registered successfully');
                showToast(msg, 'success');
            }
        } else {
            const err = await res.json();
            showToast(`Error: ${err.message || 'Save failed'}`, 'error');
        }
    } catch (err) {
        console.error('Save failed:', err);
        showToast('Network error — please try again', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="check-circle" style="width:16px;height:16px;"></i> <span>Save Member Profile</span>';
            lucide.createIcons();
        }
    }
});

// ────────────────────────────────────────────────────────
// SUBSCRIPTIONS MANAGEMENT
// ────────────────────────────────────────────────────────
let subMembersData = [];
let subData = [];
let _subStatusFilter = 'all';
let _subTypeFilter   = 'all';
let _subMethodFilter = 'all';
let _currentEditSubId = null;
let _currentReceiptData = null;

// Yearly View State
let _subViewMode = 'monthly'; // 'monthly' | 'yearly'
let _subSelectedYear = new Date().getFullYear().toString();
let subYearlyData = [];
let subYearlyMembers = [];

function _currentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function setSubViewMode(mode) {
    _subViewMode = mode;
    const isYearly = mode === 'yearly';

    document.getElementById('subViewMonthlyBtn')?.classList.toggle('active', !isYearly);
    document.getElementById('subViewYearlyBtn')?.classList.toggle('active', isYearly);

    const monthNav = document.getElementById('subMonthNavContainer');
    const yearNav  = document.getElementById('subYearNavContainer');
    if (monthNav) monthNav.style.display = isYearly ? 'none' : 'inline-flex';
    if (yearNav)  yearNav.style.display  = isYearly ? 'inline-flex' : 'none';

    const legend = document.getElementById('subYearlyLegend');
    if (legend) legend.style.display = isYearly ? 'flex' : 'none';

    const periodBadge = document.getElementById('subPeriodBadge');
    if (periodBadge) {
        periodBadge.innerHTML = isYearly
            ? `<i data-lucide="calendar-range" style="width:13px;height:13px;"></i> Annual Overview — ${_subSelectedYear}`
            : `<i data-lucide="shield-check" style="width:13px;height:13px;"></i> Monthly Dues`;
    }

    const paidPillText = document.getElementById('subStatusPaidPillText');
    if (paidPillText) paidPillText.textContent = isYearly ? 'Paid in Full' : 'Paid';

    const pendingPillText = document.getElementById('subStatusPendingPillText');
    if (pendingPillText) pendingPillText.textContent = isYearly ? 'Pending / Arrears' : 'Pending';

    const exportBtnText = document.getElementById('subExportBtnText');
    if (exportBtnText) exportBtnText.textContent = isYearly ? 'Export Annual XLS' : 'Export XLS';

    if (isYearly) {
        fetchYearlySubscriptions();
    } else {
        fetchSubscriptions();
    }
    lucide.createIcons();
}

// ── MONTH NAVIGATOR ──
function subPrevMonth() {
    const p = document.getElementById('subMonthPicker');
    if (!p) return;
    const cur = p.value || _currentYearMonth();
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    p.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fetchSubscriptions();
}

function subNextMonth() {
    const p = document.getElementById('subMonthPicker');
    if (!p) return;
    const cur = p.value || _currentYearMonth();
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m, 1);
    p.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fetchSubscriptions();
}

function subThisMonth() {
    const p = document.getElementById('subMonthPicker');
    if (!p) return;
    p.value = _currentYearMonth();
    fetchSubscriptions();
}

// ── YEAR NAVIGATOR ──
function subPrevYear() {
    let y = parseInt(_subSelectedYear, 10) - 1;
    _subSelectedYear = y.toString();
    const sel = document.getElementById('subYearSelect');
    if (sel) sel.value = _subSelectedYear;
    fetchYearlySubscriptions();
}

function subNextYear() {
    let y = parseInt(_subSelectedYear, 10) + 1;
    _subSelectedYear = y.toString();
    const sel = document.getElementById('subYearSelect');
    if (sel) sel.value = _subSelectedYear;
    fetchYearlySubscriptions();
}

function subThisYear() {
    _subSelectedYear = new Date().getFullYear().toString();
    const sel = document.getElementById('subYearSelect');
    if (sel) sel.value = _subSelectedYear;
    fetchYearlySubscriptions();
}

function onSubYearSelectChange(sel) {
    _subSelectedYear = sel.value;
    fetchYearlySubscriptions();
}

// ── FETCH MONTHLY ──
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

        if (_subViewMode === 'monthly') {
            updateSubStats();
            filterSubscriptions();
            lucide.createIcons();
        }
    } catch (err) { console.error('fetchSubscriptions error:', err); }
}

// ── FETCH YEARLY ──
async function fetchYearlySubscriptions() {
    try {
        const res = await fetch(`/api/edf/subscriptions/yearly-status?year=${_subSelectedYear}`);
        const json = await res.json();
        subYearlyMembers = json.members || [];
        subYearlyData    = subYearlyMembers;

        // Populate year selector if options are different
        const sel = document.getElementById('subYearSelect');
        if (sel && json.availableYears) {
            sel.innerHTML = json.availableYears.map(y =>
                `<option value="${y}" ${y === _subSelectedYear ? 'selected' : ''}>${y}</option>`
            ).join('');
        }

        const periodBadge = document.getElementById('subPeriodBadge');
        if (periodBadge) {
            periodBadge.innerHTML = `<i data-lucide="calendar-range" style="width:13px;height:13px;"></i> Annual Overview — ${_subSelectedYear}`;
        }

        if (_subViewMode === 'yearly') {
            updateSubYearlyStats();
            filterYearlySubscriptions();
            lucide.createIcons();
        }
    } catch (err) {
        console.error('fetchYearlySubscriptions error:', err);
    }
}

// ── UPDATE MONTHLY STATS ──
function updateSubStats() {
    const subscribing = subData.filter(r => r.payStatus !== 'exempt');
    const paid        = subData.filter(r => r.payStatus === 'paid');
    const partial     = subData.filter(r => r.payStatus === 'partial');
    const pending     = subData.filter(r => r.payStatus === 'pending');
    const exempt      = subData.filter(r => r.payStatus === 'exempt');

    const totalTarget = subscribing.reduce((sum, r) => sum + (r.monthly_subscription || 0), 0);
    const collected   = [...paid, ...partial].reduce((sum, r) => sum + (r.rec?.paid_amount != null ? r.rec.paid_amount : (r.rec?.amount || 0)), 0);
    const pendingDue  = pending.reduce((sum, r) => sum + (r.monthly_subscription || 0), 0) +
                        partial.reduce((sum, r) => sum + Math.max(0, (r.monthly_subscription || r.rec?.amount || 0) - (r.rec?.paid_amount || 0)), 0);
    const pct = totalTarget > 0 ? Math.min(100, Math.round((collected / totalTarget) * 100)) : (subscribing.length === 0 ? 100 : 0);

    const founders   = subscribing.filter(r => r.member_type === 'founder').length;
    const executives = subscribing.filter(r => r.member_type === 'executive').length;

    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // Card 1
    s('sStatCardTitle', 'Monthly Collection');
    s('sStatCollected', `LKR ${collected.toLocaleString()}`);
    s('sStatPct', `${pct}%`);
    s('sStatTargetLabel', `Target: LKR ${totalTarget.toLocaleString()}`);
    s('sStatContribSummary', `${paid.length + partial.length} of ${subscribing.length} members contributed this month`);
    const bar = document.getElementById('sStatProgressBar');
    if (bar) bar.style.width = `${pct}%`;

    // Card 2
    s('sStatTotal', `${subscribing.length}`);
    s('sStatFoundersBadge', `Founders: ${founders}`);
    s('sStatExecBadge', `Executives: ${executives}`);

    // Card 3
    s('sStatPaidTitle', 'Paid Status');
    s('sStatPaidCount', `${paid.length}`);
    s('sStatPaidSummary', `${paid.length} Fully Paid`);
    s('sStatPartialSummary', partial.length > 0 ? ` · ${partial.length} Partial` : '');

    // Card 4
    s('sStatPendingTitle', 'Pending Dues');
    s('sStatPending', `${pending.length + partial.length}`);
    s('sStatPendingAmount', pendingDue > 0 ? `LKR ${pendingDue.toLocaleString()} to collect` : 'All dues collected!');

    // Toolbar counts
    s('subCountAll', subData.length);
    s('subCountPaid', paid.length);
    s('subCountPartial', partial.length);
    s('subCountPending', pending.length);
    s('subCountExempt', exempt.length);

    _renderSubChannelTelemetry(subData, false);
}

// ── UPDATE YEARLY STATS ──
function updateSubYearlyStats() {
    const subscribing = subYearlyData.filter(r => r.yearlyPayStatus !== 'exempt');
    const fullyPaid   = subYearlyData.filter(r => r.yearlyPayStatus === 'paid');
    const partial     = subYearlyData.filter(r => r.yearlyPayStatus === 'partial');
    const pending     = subYearlyData.filter(r => r.yearlyPayStatus === 'pending');
    const exempt      = subYearlyData.filter(r => r.yearlyPayStatus === 'exempt');

    const totalAnnualTarget = subscribing.reduce((sum, r) => sum + (r.annualTarget || 0), 0);
    const totalCollectedYear= subscribing.reduce((sum, r) => sum + (r.totalPaidYear || 0), 0);
    const totalPendingYear  = subscribing.reduce((sum, r) => sum + (r.pendingBalanceAnnual || 0), 0);
    const pct = totalAnnualTarget > 0 ? Math.min(100, Math.round((totalCollectedYear / totalAnnualTarget) * 100)) : 0;

    const founders   = subscribing.filter(r => r.member_type === 'founder').length;
    const executives = subscribing.filter(r => r.member_type === 'executive').length;

    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // Card 1
    s('sStatCardTitle', `Annual Collection (${_subSelectedYear})`);
    s('sStatCollected', `LKR ${totalCollectedYear.toLocaleString()}`);
    s('sStatPct', `${pct}%`);
    s('sStatTargetLabel', `Annual Target: LKR ${totalAnnualTarget.toLocaleString()}`);
    s('sStatContribSummary', `${fullyPaid.length + partial.length} of ${subscribing.length} members paid during ${_subSelectedYear}`);
    const bar = document.getElementById('sStatProgressBar');
    if (bar) bar.style.width = `${pct}%`;

    // Card 2
    s('sStatTotal', `${subscribing.length}`);
    s('sStatFoundersBadge', `Founders: ${founders}`);
    s('sStatExecBadge', `Executives: ${executives}`);

    // Card 3
    s('sStatPaidTitle', 'Yearly Fully Paid');
    s('sStatPaidCount', `${fullyPaid.length}`);
    s('sStatPaidSummary', `${fullyPaid.length} Fully Cleared (${_subSelectedYear})`);
    s('sStatPartialSummary', partial.length > 0 ? ` · ${partial.length} Partial` : '');

    // Card 4
    s('sStatPendingTitle', 'Pending / Arrears');
    s('sStatPending', `${pending.length + partial.length}`);
    s('sStatPendingAmount', totalPendingYear > 0 ? `LKR ${totalPendingYear.toLocaleString()} overdue` : 'All cleared!');

    // Toolbar counts
    s('subCountAll', subYearlyData.length);
    s('subCountPaid', fullyPaid.length);
    s('subCountPartial', partial.length);
    s('subCountPending', pending.length);
    s('subCountExempt', exempt.length);

    _renderSubChannelTelemetry(subYearlyData, true);
}

// ── CHANNEL TELEMETRY & FILTER HELPERS ──
function _subRecordMatchesMethod(rec, method) {
    if (!rec || method === 'all') return method === 'all';
    if ((rec.payment_method || 'cash') === method) return true;
    return Array.isArray(rec.payments) && rec.payments.some(p => (p.payment_method || 'cash') === method);
}

function _subAccumulateRecordTelemetry(rec, totals, tracker) {
    if (!rec) return;
    if (Array.isArray(rec.payments) && rec.payments.length > 0) {
        let slipsHere = 0;
        rec.payments.forEach(p => {
            const k = Object.prototype.hasOwnProperty.call(totals, p.payment_method) ? p.payment_method : 'other';
            totals[k] += Number(p.amount) || 0;
            if (p.cheque_image) slipsHere++;
        });
        tracker.slips += slipsHere > 0 ? slipsHere : (rec.cheque_image ? 1 : 0);
        return;
    }
    const k = Object.prototype.hasOwnProperty.call(totals, rec.payment_method) ? rec.payment_method : 'other';
    totals[k] += Number(rec.paid_amount != null ? rec.paid_amount : rec.amount) || 0;
    if (rec.cheque_image) tracker.slips += 1;
}

function _renderSubChannelTelemetry(rows, isYearly) {
    const totals = { cash: 0, cheque: 0, bank_transfer: 0, online: 0, other: 0 };
    const tracker = { slips: 0 };

    (rows || []).forEach(r => {
        if (isYearly) {
            (r.monthsMatrix || []).forEach(mItem => _subAccumulateRecordTelemetry(mItem.record, totals, tracker));
        } else {
            _subAccumulateRecordTelemetry(r.rec, totals, tracker);
        }
    });

    const grand = Object.values(totals).reduce((a, b) => a + b, 0);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('subChanCash', `LKR ${totals.cash.toLocaleString()}`);
    setTxt('subChanCheque', `LKR ${totals.cheque.toLocaleString()}`);
    setTxt('subChanBank', `LKR ${totals.bank_transfer.toLocaleString()}`);
    setTxt('subChanOnline', `LKR ${totals.online.toLocaleString()}`);
    setTxt('subChanSlipsCount', `${tracker.slips} slip${tracker.slips === 1 ? '' : 's'} attached`);

    const periodHint = document.getElementById('subChanPeriodHint');
    if (periodHint) {
        const label = isYearly
            ? `${_subSelectedYear} Full Year`
            : (document.getElementById('subMonthPicker')?.value || _currentYearMonth());
        periodHint.textContent = `· ${label}`;
    }

    const segBar = document.getElementById('subChanSegBar');
    if (segBar) {
        if (grand <= 0) {
            segBar.innerHTML = `<div class="sub-seg-part" style="width:100%;background:var(--border-color);opacity:0.45;" title="No collections recorded for this period yet"></div>`;
        } else {
            const segments = [
                { key: 'cash', label: 'Cash', color: '#10b981' },
                { key: 'cheque', label: 'Cheque', color: '#f59e0b' },
                { key: 'bank_transfer', label: 'Bank Transfer', color: '#3b82f6' },
                { key: 'online', label: 'Online', color: '#8b5cf6' },
                { key: 'other', label: 'Other', color: '#64748b' }
            ];
            segBar.innerHTML = segments
                .filter(seg => totals[seg.key] > 0)
                .map(seg => {
                    const w = Math.max(2, (totals[seg.key] / grand) * 100);
                    return `<div class="sub-seg-part" style="width:${w.toFixed(2)}%;background:${seg.color};" title="${seg.label}: LKR ${totals[seg.key].toLocaleString()} (${Math.round((totals[seg.key] / grand) * 100)}%)"></div>`;
                }).join('');
        }
    }

    document.querySelectorAll('#subscriptionsTab .sub-chan-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.chan === _subMethodFilter);
    });
}

// ── FILTERS DISPATCHER ──
function setSubStatusFilter(status, btn) {
    _subStatusFilter = status;
    const container = btn?.closest('.sub-pill-group') || document.querySelector('#subscriptionsTab .sub-filter-dock .sub-pill-group');
    if (container) {
        container.querySelectorAll('.sub-pill-btn').forEach(b => b.classList.remove('active'));
    }
    if (btn) btn.classList.add('active');
    filterSubscriptions();
}

function setSubTypeFilter(type, btn) {
    _subTypeFilter = type;
    const container = btn?.closest('.sub-pill-group') || document.querySelectorAll('#subscriptionsTab .sub-filter-dock .sub-pill-group')[1];
    if (container) {
        container.querySelectorAll('.sub-pill-btn').forEach(b => b.classList.remove('active'));
    }
    if (btn) btn.classList.add('active');
    filterSubscriptions();
}

function setSubMethodFilter(method) {
    _subMethodFilter = method || 'all';
    const sel = document.getElementById('subMethodFilter');
    if (sel) sel.value = _subMethodFilter;
    document.querySelectorAll('#subscriptionsTab .sub-chan-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.chan === _subMethodFilter);
    });
    filterSubscriptions();
}

function toggleSubMethodChip(method) {
    setSubMethodFilter(_subMethodFilter === method ? 'all' : method);
}

function _syncSubFilterResetBtn() {
    const q = (document.getElementById('subSearchInput')?.value || '').trim();
    const sort = document.getElementById('subSortSelect')?.value || 'name';
    const dirty = _subStatusFilter !== 'all' || _subTypeFilter !== 'all' || _subMethodFilter !== 'all' || q !== '' || sort !== 'name';
    const btn = document.getElementById('subFilterResetBtn');
    if (btn) btn.style.display = dirty ? 'inline-flex' : 'none';
}

function resetSubFilters() {
    _subStatusFilter = 'all';
    _subTypeFilter = 'all';
    _subMethodFilter = 'all';
    const searchEl = document.getElementById('subSearchInput');
    if (searchEl) searchEl.value = '';
    const sortEl = document.getElementById('subSortSelect');
    if (sortEl) sortEl.value = 'name';
    const methodEl = document.getElementById('subMethodFilter');
    if (methodEl) methodEl.value = 'all';

    document.querySelectorAll('#subscriptionsTab .sub-filter-dock .sub-pill-btn').forEach(b => {
        const isAllStatus = b.dataset.sstatus === 'all';
        const isAllType = b.dataset.smtype === 'all';
        b.classList.toggle('active', isAllStatus || isAllType);
    });
    document.querySelectorAll('#subscriptionsTab .sub-chan-chip').forEach(chip => chip.classList.remove('active'));
    filterSubscriptions();
}

async function subCopyPendingSummary() {
    const isYearly = _subViewMode === 'yearly';
    const periodLabel = isYearly
        ? `Annual Arrears (${_subSelectedYear})`
        : `Monthly Dues (${document.getElementById('subMonthPicker')?.value || _currentYearMonth()})`;

    const lines = [];
    let grandArrears = 0;

    if (isYearly) {
        (subYearlyData || [])
            .filter(r => r.yearlyPayStatus === 'pending' || r.yearlyPayStatus === 'partial')
            .sort((a, b) => (b.pendingBalanceAnnual || 0) - (a.pendingBalanceAnnual || 0))
            .forEach((r, i) => {
                const bal = Number(r.pendingBalanceAnnual || 0);
                grandArrears += bal;
                lines.push(`${i + 1}. ${r.full_name}${r.phone ? ` (${r.phone})` : ''} — LKR ${bal.toLocaleString()} [${r.pendingMonthsCount} mo overdue]`);
            });
    } else {
        (subData || [])
            .filter(r => r.payStatus === 'pending' || r.payStatus === 'partial')
            .forEach((r, i) => {
                const paid = r.rec ? (r.rec.paid_amount != null ? r.rec.paid_amount : (r.rec.amount || 0)) : 0;
                const due = Number(r.monthly_subscription || r.rec?.amount || 0);
                const rem = Math.max(0, due - paid);
                grandArrears += rem;
                lines.push(`${i + 1}. ${r.full_name}${r.phone ? ` (${r.phone})` : ''} — LKR ${rem.toLocaleString()} (${r.payStatus === 'partial' ? 'Partial Balance' : 'Unpaid'})`);
            });
    }

    if (lines.length === 0) {
        if (typeof showToast === 'function') showToast(`All active members cleared dues for ${periodLabel}!`, 'success');
        return `EDF Galgamuwa — ${periodLabel}: All dues cleared!`;
    }

    const report = [
        `EDF Galgamuwa — ${periodLabel}`,
        `Pending / Partial Members: ${lines.length} | Total Outstanding: LKR ${grandArrears.toLocaleString()}`,
        ...lines
    ].join('\n');

    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(report);
        }
        if (typeof showToast === 'function') {
            showToast(`Copied ${lines.length} pending dues (LKR ${grandArrears.toLocaleString()})`, 'success');
        }
    } catch (_) {
        if (typeof showToast === 'function') {
            showToast(`Prepared ${lines.length} arrears entries`, 'info');
        }
    }
    return report;
}

// ── RENDER MONTHLY TABLE ──
function filterSubscriptions() {
    if (_subViewMode === 'yearly') {
        filterYearlySubscriptions();
        return;
    }

    // Set Table Head for Monthly
    const thead = document.getElementById('subTableHead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>Member Details</th>
                <th>Type</th>
                <th>Monthly Due</th>
                <th>Paid This Month</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th style="text-align:right;">Actions</th>
            </tr>`;
    }

    const q    = (document.getElementById('subSearchInput')?.value || '').toLowerCase().trim();
    const sort = document.getElementById('subSortSelect')?.value || 'name';

    let filtered = subData.filter(r => {
        if (_subStatusFilter !== 'all' && r.payStatus !== _subStatusFilter) return false;
        if (_subTypeFilter !== 'all' && r.member_type !== _subTypeFilter) return false;
        if (_subMethodFilter !== 'all' && !_subRecordMatchesMethod(r.rec, _subMethodFilter)) return false;
        if (q) {
            const matchName  = (r.full_name || '').toLowerCase().includes(q);
            const matchPhone = (r.phone || '').toLowerCase().includes(q);
            const matchNic   = (r.nic_number || '').toLowerCase().includes(q);
            if (!matchName && !matchPhone && !matchNic) return false;
        }
        return true;
    });

    // Sort
    const arrearsRank = { pending: 0, partial: 1, paid: 2, exempt: 3 };
    filtered.sort((a, b) => {
        if (sort === 'name')        return (a.full_name || '').localeCompare(b.full_name || '');
        if (sort === 'arrears') {
            const ra = arrearsRank[a.payStatus] ?? 4;
            const rb = arrearsRank[b.payStatus] ?? 4;
            if (ra !== rb) return ra - rb;
            const remA = a.payStatus === 'exempt' ? 0 : Math.max(0, (a.monthly_subscription || 0) - (a.rec?.paid_amount != null ? a.rec.paid_amount : (a.rec?.amount || 0)));
            const remB = b.payStatus === 'exempt' ? 0 : Math.max(0, (b.monthly_subscription || 0) - (b.rec?.paid_amount != null ? b.rec.paid_amount : (b.rec?.amount || 0)));
            return remB !== remA ? remB - remA : (a.full_name || '').localeCompare(b.full_name || '');
        }
        if (sort === 'amount_desc') return (b.monthly_subscription || 0) - (a.monthly_subscription || 0);
        if (sort === 'amount_asc')  return (a.monthly_subscription || 0) - (b.monthly_subscription || 0);
        if (sort === 'date_desc') {
            const da  = a.rec?.payment_date || '';
            const db2 = b.rec?.payment_date || '';
            return db2.localeCompare(da);
        }
        return 0;
    });

    _syncSubFilterResetBtn();

    const countEl = document.getElementById('subFilterCount');
    if (countEl) countEl.textContent = filtered.length < subData.length
        ? `Showing ${filtered.length} of ${subData.length} members`
        : `${subData.length} member${subData.length !== 1 ? 's' : ''}`;

    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

    const avatarGradients = [
        'linear-gradient(135deg, #4f46e5, #06b6d4)',
        'linear-gradient(135deg, #059669, #10b981)',
        'linear-gradient(135deg, #d97706, #f59e0b)',
        'linear-gradient(135deg, #7c3aed, #a855f7)',
        'linear-gradient(135deg, #db2777, #f43f5e)',
        'linear-gradient(135deg, #2563eb, #38bdf8)'
    ];

    const picker = document.getElementById('subMonthPicker');
    const selectedMonth = picker?.value || _currentYearMonth();

    const tbody = document.getElementById('subBody');
    tbody.innerHTML = filtered.map((r, idx) => {
        const bgGrad = avatarGradients[(r.id || idx) % avatarGradients.length];
        const initials = (r.full_name || 'M').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

        const typeBadge = r.member_type === 'founder'
            ? `<span class="sub-type-badge sub-type-founder"><i data-lucide="award" style="width:12px;height:12px;"></i> Founder</span>`
            : `<span class="sub-type-badge sub-type-executive"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> Executive</span>`;

        const amountDueDisplay = r.monthly_subscription > 0
            ? `<div style="font-weight:800; font-size:0.92rem; color:var(--text-main);">LKR ${Number(r.monthly_subscription).toLocaleString()}</div><div style="font-size:0.72rem; color:var(--text-muted);">per month</div>`
            : `<span style="color:var(--text-muted); font-size:0.8rem;">Exempt (0)</span>`;

        let paidDisplay;
        if (r.payStatus === 'paid') {
            const actualPaid = r.rec?.paid_amount != null ? r.rec.paid_amount : (r.rec?.amount || 0);
            paidDisplay = `<div><div style="font-weight:800; color:#10b981; font-size:0.92rem; display:flex; align-items:center; gap:0.25rem;">
                <i data-lucide="check" style="width:14px;height:14px;stroke-width:3;"></i> LKR ${Number(actualPaid).toLocaleString()}
            </div><div style="font-size:0.72rem; color:#059669; font-weight:600;">100% Cleared</div></div>`;
        } else if (r.payStatus === 'partial') {
            const paid = r.rec?.paid_amount || 0;
            const due  = r.monthly_subscription || r.rec?.amount || 0;
            const pct  = due > 0 ? Math.round((paid / due) * 100) : 0;
            const rem  = Math.max(0, due - paid);
            paidDisplay = `<div>
                <div style="font-weight:800; color:#d97706; font-size:0.9rem;">LKR ${Number(paid).toLocaleString()}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Rem: LKR ${rem.toLocaleString()} (${pct}%)</div>
                <div style="width:80px; height:4px; background:var(--input-bg); border-radius:99px; overflow:hidden; margin-top:3px; border:1px solid var(--border-color);">
                    <div style="width:${pct}%; height:100%; background:#d97706; border-radius:99px;"></div>
                </div>
            </div>`;
        } else if (r.payStatus === 'pending') {
            paidDisplay = `<div style="font-weight:700; color:#ef4444; font-size:0.85rem;">LKR 0</div><div style="font-size:0.72rem; color:#ef4444;">Unpaid</div>`;
        } else {
            paidDisplay = `<span style="color:var(--text-muted); font-size:0.82rem;">—</span>`;
        }

        let methodBadge = '<span style="color:var(--text-muted); font-size:0.82rem;">—</span>';
        if (r.rec) {
            const m = r.rec.payment_method || 'cash';
            const firstPay = (r.rec.payments && r.rec.payments[0]) || {};
            const ref = r.rec.reference_number || firstPay.reference_number;
            const bankName = r.rec.bank_name || firstPay.bank_name;
            const bankCode = r.rec.bank_code || firstPay.bank_code;
            const chqDate = r.rec.cheque_date || firstPay.cheque_date;
            const chqImg = r.rec.cheque_image || firstPay.cheque_image;

            const iconMap = { cash: 'banknote', cheque: 'file-text', bank_transfer: 'landmark', online: 'smartphone', other: 'more-horizontal' };
            const labelMap = { cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer', online: 'Online', other: 'Other' };
            methodBadge = `<div class="sub-method-chip" title="${ref ? 'Ref: ' + ref : ''}">
                <i data-lucide="${iconMap[m] || 'banknote'}" style="width:13px;height:13px;"></i>
                <span>${labelMap[m] || m}</span>
            </div>`;
            if (bankName || bankCode) {
                methodBadge += `<div style="font-size:0.71rem; color:var(--text-main); font-weight:700; margin-top:3px; line-height:1.2;">${bankName || ''}${bankCode ? ` <span style="color:var(--text-muted);font-family:monospace;font-weight:500;">(${bankCode})</span>` : ''}</div>`;
            }
            if (ref || chqDate) {
                const dtFmt = chqDate ? new Date(chqDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                methodBadge += `<div style="font-size:0.69rem; color:var(--text-muted); font-family:monospace; margin-top:2px;">${ref ? '#' + ref : ''}${ref && dtFmt ? ' · ' : ''}${dtFmt ? 'Dt: ' + dtFmt : ''}</div>`;
            }
            if (chqImg) {
                const safeTitle = `${(r.full_name || 'Member').replace(/'/g, "\\'")} — ${labelMap[m] || m} ${ref ? '#' + ref : ''}`;
                methodBadge += `<div><button type="button" class="sub-table-cheque-btn" onclick="openChequePreviewModal('${chqImg}', '${safeTitle}')">
                    <i data-lucide="image" style="width:11px;height:11px;"></i>
                    <span>${m === 'cheque' ? 'Cheque Copy' : 'View Slip'}</span>
                </button></div>`;
            }
        }

        let statusBadge;
        if (r.payStatus === 'paid') {
            statusBadge = `<span class="sub-status-pill sub-status-paid"><span class="sub-pulse-dot"></span> Paid</span>`;
        } else if (r.payStatus === 'partial') {
            statusBadge = `<span class="sub-status-pill sub-status-partial"><span class="sub-pulse-dot"></span> Partial</span>`;
        } else if (r.payStatus === 'pending') {
            statusBadge = `<span class="sub-status-pill sub-status-pending"><span class="sub-pulse-dot"></span> Pending</span>`;
        } else {
            statusBadge = `<span class="sub-status-pill sub-status-exempt">Exempt</span>`;
        }

        let actions;
        if (r.payStatus === 'exempt') {
            actions = `<div class="sub-action-group">
                <button class="sub-act-btn sub-act-history" onclick="openMemberHistory(${r.id})" title="View Member Contribution History">
                    <i data-lucide="history" style="width:15px;height:15px;"></i>
                </button>
            </div>`;
        } else if (r.payStatus === 'paid' || r.payStatus === 'partial') {
            actions = `<div class="sub-action-group">
                <button class="sub-act-btn sub-act-receipt" onclick="openSubReceiptModal(${r.id}, ${r.rec.id})" title="Official Receipt Voucher">
                    <i data-lucide="receipt" style="width:15px;height:15px;"></i>
                </button>
                <button class="sub-act-btn sub-act-history" onclick="openMemberHistory(${r.id})" title="Annual Payment Timeline Ledger">
                    <i data-lucide="history" style="width:15px;height:15px;"></i>
                </button>
                <button class="sub-act-btn" onclick="openSubModal('edit',${r.rec.id})" title="Edit Payment Record">
                    <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                </button>
                ${r.payStatus === 'partial' ? `
                <button class="sub-act-btn sub-act-add-inst" onclick="openAddPaymentModalForSub(${r.rec.id})" title="Add Instalment">
                    <i data-lucide="plus-circle" style="width:15px;height:15px;"></i>
                </button>` : ''}
                <button class="sub-act-btn sub-act-delete" onclick="deleteSubscription(${r.rec.id})" title="Delete Subscription">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </div>`;
        } else {
            actions = `<div class="sub-action-group">
                <button class="sub-quick-pay-btn" onclick="openSubModal('add',null,${r.id},'${selectedMonth}')" title="Record contribution for this month">
                    <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Record Pay
                </button>
                <button class="sub-act-btn sub-act-history" onclick="openMemberHistory(${r.id})" title="Payment History Ledger">
                    <i data-lucide="history" style="width:15px;height:15px;"></i>
                </button>
            </div>`;
        }

        return `
        <tr>
            <td>
                <div class="sub-member-cell">
                    <div class="sub-member-avatar" style="background:${bgGrad};">${initials}</div>
                    <div>
                        <div class="sub-member-name" onclick="openMemberHistory(${r.id})" title="Click to view ${r.full_name}'s full payment ledger">${r.full_name}</div>
                        <div class="sub-member-meta">
                            ${r.phone ? `<span><i data-lucide="phone" style="width:11px;height:11px;vertical-align:middle;"></i> ${r.phone}</span>` : ''}
                            ${r.nic_number ? `<span>· NIC: ${r.nic_number}</span>` : ''}
                        </div>
                    </div>
                </div>
            </td>
            <td>${typeBadge}</td>
            <td>${amountDueDisplay}</td>
            <td>${paidDisplay}</td>
            <td>${methodBadge}</td>
            <td>${statusBadge}</td>
            <td style="color:var(--text-muted); font-size:0.83rem;">${r.rec ? fmtDate(r.rec.payment_date) : '—'}</td>
            <td style="text-align:right; white-space:nowrap;">${actions}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
        <i data-lucide="search-x" style="width:36px;height:36px;opacity:0.3;margin-bottom:0.5rem;"></i>
        <div>No member subscription records match the selected filters.</div>
    </td></tr>`;

    lucide.createIcons();
}

// ── RENDER YEARLY TABLE (ANNUAL MATRIX) ──
function filterYearlySubscriptions() {
    // Set Table Head for Yearly
    const thead = document.getElementById('subTableHead');
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th>Member Details</th>
                <th>Type</th>
                <th>Annual Target</th>
                <th>Total Paid (${_subSelectedYear})</th>
                <th>Outstanding Balance</th>
                <th>12-Month Contribution Tracker</th>
                <th>Annual Status</th>
                <th style="text-align:right;">Actions</th>
            </tr>`;
    }

    const q    = (document.getElementById('subSearchInput')?.value || '').toLowerCase().trim();
    const sort = document.getElementById('subSortSelect')?.value || 'name';

    let filtered = subYearlyData.filter(r => {
        if (_subStatusFilter !== 'all' && r.yearlyPayStatus !== _subStatusFilter) return false;
        if (_subTypeFilter !== 'all' && r.member_type !== _subTypeFilter) return false;
        if (_subMethodFilter !== 'all') {
            const hasChan = (r.monthsMatrix || []).some(mItem => _subRecordMatchesMethod(mItem.record, _subMethodFilter));
            if (!hasChan) return false;
        }
        if (q) {
            const matchName  = (r.full_name || '').toLowerCase().includes(q);
            const matchPhone = (r.phone || '').toLowerCase().includes(q);
            const matchNic   = (r.nic_number || '').toLowerCase().includes(q);
            if (!matchName && !matchPhone && !matchNic) return false;
        }
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        if (sort === 'name')        return (a.full_name || '').localeCompare(b.full_name || '');
        if (sort === 'arrears') {
            const ae = a.yearlyPayStatus === 'exempt' ? 1 : 0;
            const be = b.yearlyPayStatus === 'exempt' ? 1 : 0;
            if (ae !== be) return ae - be;
            const diff = (b.pendingBalanceAnnual || 0) - (a.pendingBalanceAnnual || 0);
            return diff !== 0 ? diff : (a.full_name || '').localeCompare(b.full_name || '');
        }
        if (sort === 'amount_desc') return (b.annualTarget || 0) - (a.annualTarget || 0);
        if (sort === 'amount_asc')  return (a.annualTarget || 0) - (b.annualTarget || 0);
        if (sort === 'date_desc')   return (b.totalPaidYear || 0) - (a.totalPaidYear || 0);
        return 0;
    });

    _syncSubFilterResetBtn();

    const countEl = document.getElementById('subFilterCount');
    if (countEl) countEl.textContent = filtered.length < subYearlyData.length
        ? `Showing ${filtered.length} of ${subYearlyData.length} members (${_subSelectedYear})`
        : `${subYearlyData.length} member${subYearlyData.length !== 1 ? 's' : ''} (${_subSelectedYear})`;

    const avatarGradients = [
        'linear-gradient(135deg, #4f46e5, #06b6d4)',
        'linear-gradient(135deg, #059669, #10b981)',
        'linear-gradient(135deg, #d97706, #f59e0b)',
        'linear-gradient(135deg, #7c3aed, #a855f7)',
        'linear-gradient(135deg, #db2777, #f43f5e)',
        'linear-gradient(135deg, #2563eb, #38bdf8)'
    ];

    const monthLetters = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const monthNames   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const tbody = document.getElementById('subBody');
    tbody.innerHTML = filtered.map((r, idx) => {
        const bgGrad = avatarGradients[(r.id || idx) % avatarGradients.length];
        const initials = (r.full_name || 'M').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

        const typeBadge = r.member_type === 'founder'
            ? `<span class="sub-type-badge sub-type-founder"><i data-lucide="award" style="width:12px;height:12px;"></i> Founder</span>`
            : `<span class="sub-type-badge sub-type-executive"><i data-lucide="briefcase" style="width:12px;height:12px;"></i> Executive</span>`;

        // Target
        const targetDisplay = r.monthly_subscription > 0
            ? `<div><div style="font-weight:800; font-size:0.92rem; color:var(--text-main);">LKR ${Number(r.annualTarget).toLocaleString()}</div><div style="font-size:0.72rem; color:var(--text-muted);">LKR ${Number(r.monthly_subscription).toLocaleString()} /mo</div></div>`
            : `<span style="color:var(--text-muted); font-size:0.8rem;">Exempt</span>`;

        // Paid
        const pctPaid = r.annualTarget > 0 ? Math.round((r.totalPaidYear / r.annualTarget) * 100) : 0;
        const paidDisplay = r.totalPaidYear > 0
            ? `<div><div style="font-weight:800; color:#10b981; font-size:0.92rem;">LKR ${Number(r.totalPaidYear).toLocaleString()}</div><div style="font-size:0.72rem; color:#059669; font-weight:600;">${pctPaid}% of Annual (${r.paidMonthsCount} mo)</div></div>`
            : `<span style="color:#ef4444; font-weight:700; font-size:0.85rem;">LKR 0</span>`;

        // Outstanding Balance
        let balanceDisplay;
        if (r.yearlyPayStatus === 'exempt') {
            balanceDisplay = '<span style="color:var(--text-muted); font-size:0.8rem;">—</span>';
        } else if (r.pendingBalanceAnnual === 0) {
            balanceDisplay = `<span style="color:#10b981; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.25rem;">
                <i data-lucide="check-circle-2" style="width:15px;height:15px;"></i> Fully Cleared
            </span>`;
        } else {
            balanceDisplay = `<div>
                <div style="font-weight:800; color:#ef4444; font-size:0.9rem;">LKR ${Number(r.pendingBalanceAnnual).toLocaleString()}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">YTD Arrears: LKR ${Number(r.pendingBalanceYTD).toLocaleString()}</div>
            </div>`;
        }

        // 12-Month Tracker Matrix
        const matrixPills = (r.monthsMatrix || []).map((mItem, mIdx) => {
            const letter = monthLetters[mIdx];
            const mName  = monthNames[mIdx];
            const moKey  = mItem.month; // e.g. '2026-05'

            let tooltip = '';
            let clickAction = '';

            if (mItem.status === 'paid') {
                tooltip = `${mName} ${_subSelectedYear}: Paid LKR ${Number(mItem.paid).toLocaleString()} (Click to view receipt)`;
                clickAction = `openSubReceiptModal(${r.id}, ${mItem.record?.id || 'null'})`;
            } else if (mItem.status === 'partial') {
                tooltip = `${mName} ${_subSelectedYear}: Partial LKR ${Number(mItem.paid).toLocaleString()} of ${Number(mItem.due).toLocaleString()} (Click to pay)`;
                clickAction = `openSubModal('edit', ${mItem.record?.id})`;
            } else if (mItem.status === 'pending') {
                tooltip = `${mName} ${_subSelectedYear}: Overdue LKR ${Number(mItem.due).toLocaleString()} (Click to record payment)`;
                clickAction = `openSubModal('add', null, ${r.id}, '${moKey}')`;
            } else if (mItem.status === 'upcoming') {
                tooltip = `${mName} ${_subSelectedYear}: Upcoming (Click for advance payment)`;
                clickAction = `openSubModal('add', null, ${r.id}, '${moKey}')`;
            } else {
                tooltip = `${mName} ${_subSelectedYear}: Exempt`;
                clickAction = '';
            }

            return `<span class="sub-matrix-pill ${mItem.status}" title="${tooltip}" onclick="${clickAction}">${letter}</span>`;
        }).join('');

        const matrixDisplay = `<div class="sub-matrix-wrap">${matrixPills}</div>`;

        // Yearly Status Badge
        let statusBadge;
        if (r.yearlyPayStatus === 'paid') {
            statusBadge = `<span class="sub-status-pill sub-status-paid"><span class="sub-pulse-dot"></span> Paid in Full</span>`;
        } else if (r.yearlyPayStatus === 'partial') {
            statusBadge = `<span class="sub-status-pill sub-status-partial"><span class="sub-pulse-dot"></span> Partial (${r.paidMonthsCount} mo)</span>`;
        } else if (r.yearlyPayStatus === 'pending') {
            statusBadge = `<span class="sub-status-pill sub-status-pending"><span class="sub-pulse-dot"></span> Overdue (${r.pendingMonthsCount} mo)</span>`;
        } else {
            statusBadge = `<span class="sub-status-pill sub-status-exempt">Exempt</span>`;
        }

        // Actions
        // Find earliest unpaid month for quick-pay
        const earliestUnpaid = (r.monthsMatrix || []).find(m => m.status === 'pending' || m.status === 'partial');
        const quickPayMonth = earliestUnpaid ? earliestUnpaid.month : `${_subSelectedYear}-01`;

        let actions = `<div class="sub-action-group">
            <button class="sub-act-btn sub-act-history" onclick="openMemberHistory(${r.id})" title="Full Member Payment Ledger">
                <i data-lucide="history" style="width:15px;height:15px;"></i>
            </button>
            ${r.totalPaidYear > 0 ? `
            <button class="sub-act-btn sub-act-receipt" onclick="openSubReceiptModal(${r.id})" title="View Latest Receipt Voucher">
                <i data-lucide="receipt" style="width:15px;height:15px;"></i>
            </button>` : ''}
            ${r.yearlyPayStatus !== 'exempt' && r.pendingBalanceAnnual > 0 ? `
            <button class="sub-quick-pay-btn" onclick="openSubModal('add',null,${r.id},'${quickPayMonth}')" title="Pay for ${quickPayMonth}">
                <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Pay
            </button>` : ''}
        </div>`;

        return `
        <tr>
            <td>
                <div class="sub-member-cell">
                    <div class="sub-member-avatar" style="background:${bgGrad};">${initials}</div>
                    <div>
                        <div class="sub-member-name" onclick="openMemberHistory(${r.id})" title="Click to view ${r.full_name}'s full ledger">${r.full_name}</div>
                        <div class="sub-member-meta">
                            ${r.phone ? `<span><i data-lucide="phone" style="width:11px;height:11px;vertical-align:middle;"></i> ${r.phone}</span>` : ''}
                            ${r.nic_number ? `<span>· NIC: ${r.nic_number}</span>` : ''}
                        </div>
                    </div>
                </div>
            </td>
            <td>${typeBadge}</td>
            <td>${targetDisplay}</td>
            <td>${paidDisplay}</td>
            <td>${balanceDisplay}</td>
            <td>${matrixDisplay}</td>
            <td>${statusBadge}</td>
            <td style="text-align:right; white-space:nowrap;">${actions}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
        <i data-lucide="search-x" style="width:36px;height:36px;opacity:0.3;margin-bottom:0.5rem;"></i>
        <div>No member records match the selected yearly filters for ${_subSelectedYear}.</div>
    </td></tr>`;

    lucide.createIcons();
}

// Payment method pill selection & dynamic channel details
function setSubPayMethod(method, btn) {
    if (btn) {
        btn.closest('div').querySelectorAll('.sub-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    document.getElementById('subPayMethodInput').value = method;
    _updateSubChannelFields(method);
}

function _updateSubChannelFields(method) {
    const card = document.getElementById('subChannelDetailsCard');
    const cashRefGroup = document.getElementById('subCashRefGroup');
    if (!card) return;

    if (method === 'cash' || method === 'other') {
        card.style.display = 'none';
        if (cashRefGroup) cashRefGroup.style.display = 'block';
        return;
    }

    card.style.display = 'block';
    if (cashRefGroup) cashRefGroup.style.display = 'none';
    card.className = 'sub-channel-card channel-' + method;

    // Sync default cheque/instrument amount with Paying Now or Standard Due
    const chqAmtEl = document.getElementById('subChequeAmountInput');
    const paidEl = document.getElementById('subPaidAmountInput');
    const dueEl = document.getElementById('subAmountInput');
    if (chqAmtEl && !chqAmtEl.value) {
        chqAmtEl.value = paidEl?.value || dueEl?.value || '';
    }

    // Default written/transfer date to today if empty
    const chqDateEl = document.getElementById('subChequeDateInput');
    if (chqDateEl && !chqDateEl.value) {
        chqDateEl.value = new Date().toISOString().slice(0, 10);
    }

    const headerTitle = document.getElementById('subChannelHeaderTitle');
    const headerTag = document.getElementById('subChannelHeaderTag');
    const bankNameLabel = document.getElementById('subBankNameLabel');
    const bankNameInput = document.getElementById('subBankNameInput');
    const bankCodeLabel = document.getElementById('subBankCodeLabel');
    const bankCodeInput = document.getElementById('subBankCodeInput');
    const chqNoLabel = document.getElementById('subChequeNoLabel');
    const chqNoInput = document.getElementById('subChequeNoInput');
    const chqAmtLabel = document.getElementById('subChequeAmtLabel');
    const chqDateLabel = document.getElementById('subChequeDateLabel');
    const chqImgLabel = document.getElementById('subChequeImgLabel');
    const chqDropText = document.getElementById('subChequeDropText');

    if (method === 'cheque') {
        if (headerTitle) headerTitle.textContent = 'Cheque Payment Details';
        if (headerTag) {
            headerTag.textContent = 'Cheque Verification';
            headerTag.style.background = 'rgba(245,158,11,0.14)';
            headerTag.style.color = '#d97706';
        }
        if (bankNameLabel) bankNameLabel.innerHTML = 'Bank Name <span style="color:#ef4444;">*</span>';
        if (bankNameInput) bankNameInput.placeholder = 'Select or type bank name (e.g. BOC, Commercial)…';
        if (bankCodeLabel) bankCodeLabel.textContent = 'Bank / Branch Code';
        if (bankCodeInput) bankCodeInput.placeholder = 'e.g. 7010 - 045';
        if (chqNoLabel) chqNoLabel.innerHTML = 'Cheque Number <span style="color:#ef4444;">*</span>';
        if (chqNoInput) chqNoInput.placeholder = 'e.g. 849201';
        if (chqAmtLabel) chqAmtLabel.textContent = 'Cheque Amount (LKR)';
        if (chqDateLabel) chqDateLabel.textContent = 'Written Date';
        if (chqImgLabel) chqImgLabel.innerHTML = '<span>Image of Cheque (Front / Scan)</span><span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">JPG, PNG, WEBP up to 10MB</span>';
        if (chqDropText) chqDropText.textContent = 'Click to upload or drag & drop cheque image';
    } else if (method === 'bank_transfer') {
        if (headerTitle) headerTitle.textContent = 'Bank Transfer Details';
        if (headerTag) {
            headerTag.textContent = 'Wire / Slip Details';
            headerTag.style.background = 'rgba(59,130,246,0.14)';
            headerTag.style.color = '#3b82f6';
        }
        if (bankNameLabel) bankNameLabel.innerHTML = 'Transfer Bank Name <span style="color:#ef4444;">*</span>';
        if (bankNameInput) bankNameInput.placeholder = 'Select or type bank name…';
        if (bankCodeLabel) bankCodeLabel.textContent = 'Branch / Account Code';
        if (bankCodeInput) bankCodeInput.placeholder = 'e.g. Galgamuwa Br / Acc #';
        if (chqNoLabel) chqNoLabel.innerHTML = 'Transaction Ref No.';
        if (chqNoInput) chqNoInput.placeholder = 'e.g. FT-2026102901';
        if (chqAmtLabel) chqAmtLabel.textContent = 'Transfer Amount (LKR)';
        if (chqDateLabel) chqDateLabel.textContent = 'Transfer Date';
        if (chqImgLabel) chqImgLabel.innerHTML = '<span>Transfer Slip / Receipt Copy</span><span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">JPG, PNG, WEBP up to 10MB</span>';
        if (chqDropText) chqDropText.textContent = 'Click to upload or drag & drop transfer receipt';
    } else if (method === 'online') {
        if (headerTitle) headerTitle.textContent = 'Online / Digital Payment Details';
        if (headerTag) {
            headerTag.textContent = 'Digital Gateway';
            headerTag.style.background = 'rgba(139,92,246,0.14)';
            headerTag.style.color = '#8b5cf6';
        }
        if (bankNameLabel) bankNameLabel.innerHTML = 'Platform / Banking App';
        if (bankNameInput) bankNameInput.placeholder = 'e.g. FriMi, LankaQR, Genie, Vishwa, eZ Cash';
        if (bankCodeLabel) bankCodeLabel.textContent = 'Channel / Terminal Code';
        if (bankCodeInput) bankCodeInput.placeholder = 'Optional code';
        if (chqNoLabel) chqNoLabel.innerHTML = 'Transaction / Approval ID';
        if (chqNoInput) chqNoInput.placeholder = 'e.g. TXN-9928174';
        if (chqAmtLabel) chqAmtLabel.textContent = 'Amount Paid (LKR)';
        if (chqDateLabel) chqDateLabel.textContent = 'Payment Date';
        if (chqImgLabel) chqImgLabel.innerHTML = '<span>Payment Screenshot / E-Receipt</span><span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">Optional screenshot</span>';
        if (chqDropText) chqDropText.textContent = 'Click to upload payment screenshot';
    }
    lucide.createIcons();
}

function setAddPayMethod(method, btn) {
    if (btn) {
        btn.closest('div').querySelectorAll('.sub-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    document.getElementById('addPayMethodInput').value = method;
    _updateAddPayChannelFields(method);
}

function _updateAddPayChannelFields(method) {
    const card = document.getElementById('addPayChannelDetailsCard');
    const refLabel = document.getElementById('addPayRefLabel');
    if (!card) return;

    if (method === 'cash' || method === 'other') {
        card.style.display = 'none';
        if (refLabel) refLabel.textContent = 'Reference / Receipt No.';
        return;
    }

    card.style.display = 'block';
    card.className = 'sub-channel-card channel-' + method;
    const titleEl = document.getElementById('addPayChannelHeaderTitle');
    const dtEl = document.getElementById('addPayChequeDateInput');
    if (dtEl && !dtEl.value) dtEl.value = new Date().toISOString().slice(0, 10);

    if (method === 'cheque') {
        if (titleEl) titleEl.textContent = 'Cheque Payment Details';
        if (refLabel) refLabel.innerHTML = 'Cheque Number <span style="color:#ef4444;">*</span>';
    } else if (method === 'bank_transfer') {
        if (titleEl) titleEl.textContent = 'Bank Transfer Details';
        if (refLabel) refLabel.textContent = 'Transfer Reference No.';
    } else if (method === 'online') {
        if (titleEl) titleEl.textContent = 'Online Payment Details';
        if (refLabel) refLabel.textContent = 'Transaction ID';
    }
    lucide.createIcons();
}

function onSubChequeAmtInput(input) {
    const paidInput = document.getElementById('subPaidAmountInput');
    if (paidInput) {
        paidInput.value = input.value;
        onSubPaidAmountInput(paidInput, true);
    }
}

function handleSubChequeFileSelect(input, prefix = 'sub') {
    const file = input.files && input.files[0];
    if (file) uploadSubChequeFile(file, prefix);
}

function handleSubChequeDrop(event, prefix = 'sub') {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) uploadSubChequeFile(file, prefix);
}

async function uploadSubChequeFile(file, prefix = 'sub') {
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size exceeds 10MB limit', 'error');
        return;
    }

    const dropText = document.getElementById('subChequeDropText');
    const addBtnLbl = document.getElementById('addPayUploadBtnLabel');
    const origDropText = dropText ? dropText.textContent : '';
    if (prefix === 'sub' && dropText) dropText.textContent = 'Uploading image… please wait';
    if (prefix === 'addPay' && addBtnLbl) addBtnLbl.textContent = 'Uploading…';

    const formData = new FormData();
    formData.append('cheque', file);

    try {
        const res = await fetch('/api/edf/subscriptions/upload-cheque', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        if (res.ok && json.fileUrl) {
            _setSubChequeImagePreview(json.fileUrl, file.name, prefix);
            showToast('Image attached successfully', 'success');
        } else {
            showToast(json.message || 'Image upload failed', 'error');
            if (prefix === 'sub' && dropText) dropText.textContent = origDropText;
            if (prefix === 'addPay' && addBtnLbl) addBtnLbl.textContent = 'Upload Image';
        }
    } catch (err) {
        console.error(err);
        showToast('Network error during file upload', 'error');
        if (prefix === 'sub' && dropText) dropText.textContent = origDropText;
        if (prefix === 'addPay' && addBtnLbl) addBtnLbl.textContent = 'Upload Image';
    }
}

function _setSubChequeImagePreview(fileUrl, fileName, prefix = 'sub') {
    const urlInput = document.getElementById(prefix + 'ChequeImageUrl');
    const previewWrap = document.getElementById(prefix + 'ChequePreviewWrap');
    const previewImg = document.getElementById(prefix + 'ChequePreviewImg');
    const previewName = document.getElementById(prefix + 'ChequePreviewName');
    const dropzone = document.getElementById('subChequeDropzone');
    const addBtnLbl = document.getElementById('addPayUploadBtnLabel');

    if (urlInput) urlInput.value = fileUrl || '';
    if (previewImg) previewImg.src = fileUrl || '';
    if (previewName) previewName.textContent = fileName || (fileUrl ? fileUrl.split('/').pop() : 'Attached');
    if (previewWrap) previewWrap.style.display = fileUrl ? 'flex' : 'none';
    if (prefix === 'sub' && dropzone) dropzone.style.display = fileUrl ? 'none' : 'flex';
    const memInitDrop = document.getElementById('memInitChequeDropzone');
    if (prefix === 'memInit' && memInitDrop) memInitDrop.style.display = fileUrl ? 'none' : 'flex';
    if (prefix === 'addPay' && addBtnLbl) addBtnLbl.textContent = fileUrl ? 'Change Image' : 'Upload Image';
    lucide.createIcons();
}

function clearSubChequeImage(prefix = 'sub') {
    const fileInput = document.getElementById(prefix + 'ChequeFileInput');
    if (fileInput) fileInput.value = '';
    _setSubChequeImagePreview('', '', prefix);
}

function openChequePreviewModal(imgUrl, title = 'Cheque / Instrument Image') {
    if (!imgUrl) {
        showToast('No image available to preview', 'error');
        return;
    }
    const imgEl = document.getElementById('chequeViewerImg');
    const titleEl = document.getElementById('chequeViewerTitle');
    const dlBtn = document.getElementById('chequeViewerDownloadBtn');
    if (imgEl) imgEl.src = imgUrl;
    if (titleEl) titleEl.textContent = title;
    if (dlBtn) dlBtn.href = imgUrl;
    openModal('chequeViewerModal');
    lucide.createIcons();
}

function onSubAdvanceToggle(cb) {
    const monthEl = document.getElementById('subMonthInput');
    if (cb.checked) {
        monthEl.style.borderColor = 'var(--primary)';
    } else {
        monthEl.style.borderColor = '';
    }
}

function applySubPreset(type) {
    const dueAmt = parseFloat(document.getElementById('subAmountInput').value) || 0;
    const paidInput = document.getElementById('subPaidAmountInput');
    if (type === 'full') {
        paidInput.value = dueAmt > 0 ? dueAmt : '';
    } else if (type === 'half') {
        paidInput.value = dueAmt > 0 ? (dueAmt / 2) : '';
    }
    onSubPaidAmountInput(paidInput);
}

function onSubPaidAmountInput(input, skipChequeSync = false) {
    const dueAmt  = parseFloat(document.getElementById('subAmountInput').value) || 0;
    const paying  = parseFloat(input.value) || 0;
    const hint    = document.getElementById('subPartialHint');

    if (!skipChequeSync) {
        const chqAmtEl = document.getElementById('subChequeAmountInput');
        if (chqAmtEl) chqAmtEl.value = input.value || (dueAmt > 0 ? dueAmt : '');
    }

    if (!hint) return;
    if (paying > 0 && paying < dueAmt) {
        const rem = dueAmt - paying;
        hint.style.display = 'block';
        hint.style.color   = '#d97706';
        hint.innerHTML     = `Partial payment: <strong>LKR ${paying.toLocaleString()}</strong> of LKR ${dueAmt.toLocaleString()} (Remaining: <strong>LKR ${rem.toLocaleString()}</strong>)`;
    } else if (paying >= dueAmt && dueAmt > 0) {
        hint.style.display = 'block';
        hint.style.color   = '#10b981';
        hint.innerHTML     = `Full payment of <strong>LKR ${paying.toLocaleString()}</strong> will be recorded.`;
    } else {
        hint.style.display = 'none';
    }
}

function _renderSubPayHistory(payments) {
    const list = document.getElementById('subPayHistoryList');
    if (!payments || payments.length === 0) {
        list.innerHTML = '<div style="font-size:0.82rem; color:var(--text-muted); padding:0.5rem;">No instalments recorded.</div>';
        return;
    }
    const methodLabel = { cash:'Cash', cheque:'Cheque', bank_transfer:'Bank Transfer', online:'Online', other:'Other' };
    list.innerHTML = payments.map(p => {
        const dt = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
        const bankInfo = p.bank_name ? `<span style="color:var(--text-main); font-size:0.73rem; font-weight:600;">${p.bank_name}${p.bank_code ? ' (' + p.bank_code + ')' : ''}</span>` : '';
        const chqBtn = p.cheque_image ? `<button type="button" onclick="openChequePreviewModal('${p.cheque_image}', 'Instalment Cheque / Receipt')" style="border:none;background:rgba(245,158,11,0.12);color:#d97706;border-radius:5px;padding:2px 6px;font-size:0.7rem;font-weight:700;cursor:pointer;" title="View Cheque Image"><i data-lucide="image" style="width:11px;height:11px;vertical-align:middle;"></i> Image</button>` : '';
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; padding:0.5rem 0.75rem; background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; font-size:0.82rem;">
            <span style="font-weight:700; color:var(--text-main);">LKR ${Number(p.amount).toLocaleString()}</span>
            <span style="color:var(--text-muted); background:var(--input-bg); padding:0.15rem 0.5rem; border-radius:6px; font-size:0.75rem;">${methodLabel[p.payment_method] || p.payment_method || 'Cash'}</span>
            ${bankInfo}
            ${p.reference_number ? `<span style="color:var(--text-muted); font-family:monospace; font-size:0.75rem;">#${p.reference_number}</span>` : ''}
            ${chqBtn}
            <span style="color:var(--text-muted); font-size:0.75rem; margin-left:auto;">${dt}</span>
            <button type="button" onclick="deleteSubPayment(${p.id})" style="border:none;background:none;color:#ef4444;cursor:pointer;padding:0 4px;" title="Delete instalment">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
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
            showToast('Payment instalment removed', 'success');
            const hRes = await fetch(`/api/edf/subscriptions/${_currentEditSubId}/payments`);
            const hData = await hRes.json();
            _renderSubPayHistory(hData);
            if (_subViewMode === 'yearly') {
                fetchYearlySubscriptions();
            } else {
                fetchSubscriptions();
            }
        } else {
            showToast('Delete failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

function openSubModal(mode, subId = null, memberId = null, month = null) {
    const form = document.getElementById('subForm');
    form.reset();
    document.getElementById('subRecordId').value = '';
    document.getElementById('subModalTitle').textContent = mode === 'edit' ? 'Edit Payment Record' : 'Record Member Contribution';
    document.getElementById('subSaveBtn').innerHTML = '<i data-lucide="check-circle"></i> Save Payment';
    document.getElementById('subMemberNote').style.display = 'none';
    document.getElementById('subMemberPreviewCard').style.display = 'none';
    document.getElementById('subPartialHint').style.display = 'none';
    document.getElementById('subPayHistorySection').style.display = 'none';
    document.getElementById('subPayHistoryList').innerHTML = '';
    document.getElementById('subAdvanceToggle').checked = false;
    document.getElementById('subMonthInput').style.borderColor = '';
    _currentEditSubId = null;

    // Reset channel detail inputs & image preview
    if (document.getElementById('subBankNameInput')) document.getElementById('subBankNameInput').value = '';
    if (document.getElementById('subBankCodeInput')) document.getElementById('subBankCodeInput').value = '';
    if (document.getElementById('subChequeNoInput')) document.getElementById('subChequeNoInput').value = '';
    if (document.getElementById('subChequeAmountInput')) document.getElementById('subChequeAmountInput').value = '';
    if (document.getElementById('subChequeDateInput')) document.getElementById('subChequeDateInput').value = '';
    clearSubChequeImage('sub');

    // Reset method buttons to cash by default
    document.querySelectorAll('#subForm .sub-method-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#subForm .sub-method-btn[data-method="cash"]')?.classList.add('active');
    document.getElementById('subPayMethodInput').value = 'cash';
    _updateSubChannelFields('cash');

    // Populate member dropdown
    const sel = document.getElementById('subMemberSelect');
    const memberPool = subMembersData.length > 0 ? subMembersData : (subYearlyMembers.length > 0 ? subYearlyMembers : currentMembers);
    const memberList = mode === 'add'
        ? memberPool.filter(m => m.monthly_subscription > 0)
        : memberPool;
    sel.innerHTML = '<option value="">Select member…</option>' +
        memberList.map(m => `<option value="${m.id}" data-amount="${m.monthly_subscription}" data-type="${m.member_type}" data-phone="${m.phone || ''}" data-nic="${m.nic_number || ''}">${m.full_name} (${m.member_type === 'founder' ? 'Founder' : 'Executive'} - LKR ${Number(m.monthly_subscription).toLocaleString()}/mo)</option>`).join('');

    const picker = document.getElementById('subMonthPicker');
    const defaultMonth = month || picker?.value || _currentYearMonth();

    const printRecBtn = document.getElementById('subModalPrintReceiptBtn');
    if (printRecBtn) printRecBtn.style.display = (mode === 'edit' && subId) ? 'inline-flex' : 'none';
    const defFmtSel = document.getElementById('subDefaultReceiptFormat');
    if (defFmtSel && typeof _receiptPrintFormat !== 'undefined') defFmtSel.value = _receiptPrintFormat;

    if (mode === 'edit' && subId) {
        let row = subData.find(r => r.rec && r.rec.id === subId);
        let recObj = row ? row.rec : null;
        if (!row && subYearlyData.length > 0) {
            for (const yrRow of subYearlyData) {
                const foundMo = (yrRow.monthsMatrix || []).find(m => m.record && m.record.id === subId);
                if (foundMo) {
                    row = yrRow;
                    recObj = foundMo.record;
                    break;
                }
            }
        }
        if (!row || !recObj) return;

        _currentEditSubId = subId;
        sel.value = row.id;
        sel.disabled = true;
        const paidVal = recObj.paid_amount != null ? recObj.paid_amount : recObj.amount;
        const firstPay = (recObj.payments && recObj.payments[0]) || {};
        const refVal = recObj.reference_number || firstPay.reference_number || '';
        const bankNameVal = recObj.bank_name || firstPay.bank_name || '';
        const bankCodeVal = recObj.bank_code || firstPay.bank_code || '';
        const chqDateVal = recObj.cheque_date || firstPay.cheque_date || '';
        const chqImgVal = recObj.cheque_image || firstPay.cheque_image || '';

        document.getElementById('subMonthInput').value = recObj.month;
        document.getElementById('subAmountInput').value = recObj.amount;
        document.getElementById('subPaidAmountInput').value = paidVal;
        document.getElementById('subRefInput').value = refVal;
        document.getElementById('subNotesInput').value = recObj.notes || '';
        document.getElementById('subRecordId').value = subId;
        if (recObj.is_advance) document.getElementById('subAdvanceToggle').checked = true;

        if (document.getElementById('subBankNameInput')) document.getElementById('subBankNameInput').value = bankNameVal;
        if (document.getElementById('subBankCodeInput')) document.getElementById('subBankCodeInput').value = bankCodeVal;
        if (document.getElementById('subChequeNoInput')) document.getElementById('subChequeNoInput').value = refVal;
        if (document.getElementById('subChequeAmountInput')) document.getElementById('subChequeAmountInput').value = paidVal;
        if (document.getElementById('subChequeDateInput')) document.getElementById('subChequeDateInput').value = chqDateVal ? chqDateVal.slice(0, 10) : '';
        if (chqImgVal) {
            _setSubChequeImagePreview(chqImgVal, chqImgVal.split('/').pop(), 'sub');
        }

        const method = recObj.payment_method || 'cash';
        document.querySelectorAll('#subForm .sub-method-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#subForm .sub-method-btn[data-method="${method}"]`)?.classList.add('active');
        document.getElementById('subPayMethodInput').value = method;
        _updateSubChannelFields(method);
        _showSubMemberNote(row);

        if (recObj.payments && recObj.payments.length > 0) {
            document.getElementById('subPayHistorySection').style.display = 'block';
            _renderSubPayHistory(recObj.payments);
        }
    } else {
        sel.disabled = false;
        document.getElementById('subMonthInput').value = defaultMonth;
        if (memberId) {
            sel.value = memberId;
            const m = memberPool.find(x => x.id === memberId);
            if (m) {
                document.getElementById('subAmountInput').value = m.monthly_subscription || '';
                if (document.getElementById('subChequeAmountInput')) {
                    document.getElementById('subChequeAmountInput').value = m.monthly_subscription || '';
                }
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
    if (document.getElementById('addPayBankNameInput')) document.getElementById('addPayBankNameInput').value = '';
    if (document.getElementById('addPayBankCodeInput')) document.getElementById('addPayBankCodeInput').value = '';
    if (document.getElementById('addPayChequeDateInput')) document.getElementById('addPayChequeDateInput').value = '';
    clearSubChequeImage('addPay');

    const todayInput = document.querySelector('#addPaymentForm [name="payment_date"]');
    if (todayInput) todayInput.value = new Date().toISOString().slice(0,10);
    document.querySelectorAll('#addPaymentForm .sub-method-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#addPaymentForm .sub-method-btn[data-method="cash"]')?.classList.add('active');
    document.getElementById('addPayMethodInput').value = 'cash';
    _updateAddPayChannelFields('cash');
    openModal('addPaymentModal');
    lucide.createIcons();
}

async function saveExtraPayment(e) {
    e.preventDefault();
    const form = e.target;
    const subId = document.getElementById('addPaySubId').value;
    const method = document.getElementById('addPayMethodInput').value || 'cash';
    const isChannel = method !== 'cash' && method !== 'other';
    const payload = {
        amount: parseFloat(form.amount.value),
        payment_method: method,
        reference_number: form.reference_number.value || null,
        bank_name: isChannel ? (document.getElementById('addPayBankNameInput')?.value.trim() || null) : null,
        bank_code: isChannel ? (document.getElementById('addPayBankCodeInput')?.value.trim() || null) : null,
        cheque_date: isChannel ? (document.getElementById('addPayChequeDateInput')?.value || null) : null,
        cheque_image: isChannel ? (document.getElementById('addPayChequeImageUrl')?.value || null) : null,
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
            showToast('Instalment recorded successfully', 'success');
            const hRes = await fetch(`/api/edf/subscriptions/${subId}/payments`);
            const hData = await hRes.json();
            document.getElementById('subPayHistorySection').style.display = 'block';
            _renderSubPayHistory(hData);
            if (_subViewMode === 'yearly') {
                fetchYearlySubscriptions();
            } else {
                fetchSubscriptions();
            }
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
    const chqAmtEl = document.getElementById('subChequeAmountInput');
    const paidEl = document.getElementById('subPaidAmountInput');
    if (chqAmtEl && !paidEl?.value) chqAmtEl.value = amount || '';
    const memberId = parseInt(sel.value);
    const pool = subMembersData.length > 0 ? subMembersData : subYearlyMembers;
    const m = pool.find(x => x.id === memberId);
    if (m) _showSubMemberNote(m); else {
        document.getElementById('subMemberNote').style.display = 'none';
        document.getElementById('subMemberPreviewCard').style.display = 'none';
    }
}

function _showSubMemberNote(m) {
    const card = document.getElementById('subMemberPreviewCard');
    if (!m) { if (card) card.style.display = 'none'; return; }

    const sub = m.monthly_subscription || (m.rec?.amount);
    if (card) {
        card.style.display = 'flex';
        document.getElementById('subPreviewAvatar').textContent = (m.full_name || 'M').charAt(0).toUpperCase();
        document.getElementById('subPreviewName').textContent   = m.full_name;
        document.getElementById('subPreviewTypeBadge').innerHTML = m.member_type === 'founder'
            ? '<span class="sub-type-badge sub-type-founder" style="padding:0.1rem 0.4rem;font-size:0.68rem;">Founder</span>'
            : '<span class="sub-type-badge sub-type-executive" style="padding:0.1rem 0.4rem;font-size:0.68rem;">Executive</span>';
        document.getElementById('subPreviewMeta').textContent = [m.phone ? 'Phone: ' + m.phone : null, m.nic_number ? 'NIC: ' + m.nic_number : null].filter(Boolean).join(' · ') || 'Active Member';
        document.getElementById('subPreviewDueAmt').textContent = `LKR ${Number(sub || 0).toLocaleString()}`;
    }
}

async function saveSubscription(e) {
    e.preventDefault();
    const form = e.target;
    const subId = document.getElementById('subRecordId').value;
    const paidAmountVal = document.getElementById('subPaidAmountInput').value;
    const chqAmountVal = document.getElementById('subChequeAmountInput')?.value;
    const memberId = parseInt(form.member_id.value);
    const autoReceipt = document.getElementById('subAutoReceipt')?.checked;
    const payMethod = document.getElementById('subPayMethodInput').value || 'cash';
    const isChannel = payMethod !== 'cash' && payMethod !== 'other';

    const bankName = isChannel ? (document.getElementById('subBankNameInput')?.value.trim() || null) : null;
    const bankCode = isChannel ? (document.getElementById('subBankCodeInput')?.value.trim() || null) : null;
    const chequeDate = isChannel ? (document.getElementById('subChequeDateInput')?.value || null) : null;
    const chequeImage = isChannel ? (document.getElementById('subChequeImageUrl')?.value || null) : null;
    const refNo = isChannel
        ? (document.getElementById('subChequeNoInput')?.value.trim() || document.getElementById('subRefInput')?.value.trim() || null)
        : (document.getElementById('subRefInput')?.value.trim() || null);

    if (payMethod === 'cheque' && !bankName) {
        showToast('Please enter the Bank Name for the cheque payment', 'error');
        document.getElementById('subBankNameInput')?.focus();
        return;
    }

    const effectivePaid = paidAmountVal
        ? parseFloat(paidAmountVal)
        : (isChannel && chqAmountVal ? parseFloat(chqAmountVal) : null);

    const payload = {
        member_id: memberId,
        month: form.month.value,
        amount: parseFloat(form.amount.value),
        paid_amount: effectivePaid,
        payment_method: payMethod,
        notes: document.getElementById('subNotesInput').value || null,
        is_advance: document.getElementById('subAdvanceToggle').checked ? 1 : 0,
        reference_number: refNo,
        bank_name: bankName,
        bank_code: bankCode,
        cheque_date: chequeDate,
        cheque_image: chequeImage,
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
            if (_subViewMode === 'yearly') {
                await fetchYearlySubscriptions();
            } else {
                await fetchSubscriptions();
            }
            fetchStats();
            showToast(subId ? 'Payment updated successfully' : 'Payment recorded successfully', 'success');

            if (autoReceipt) {
                setTimeout(() => {
                    openSubReceiptModal(memberId, json.id || subId);
                }, 300);
            }
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
    if (!confirm('Are you sure you want to delete this subscription record? The associated income transaction will also be removed.')) return;
    try {
        const res = await fetch(`/api/edf/subscriptions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (_subViewMode === 'yearly') {
                fetchYearlySubscriptions();
            } else {
                fetchSubscriptions();
            }
            fetchStats();
            showToast('Subscription record deleted', 'success');
        } else {
            showToast('Failed to delete record', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// ── OFFICIAL RECEIPT / VOUCHER GENERATOR (A4 & 80mm THERMAL POS) ──

let _receiptPrintFormat = (typeof localStorage !== 'undefined' && localStorage.getItem('edf_receipt_print_format')) || 'a4';
let _receiptIncludeStub = true;

function numberToWords(num) {
    if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
    num = Math.round(num);
    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    }

    return inWords(num).trim() + ' Sri Lankan Rupees Only';
}

function _generateReceiptQrSvg(seedStr, sizePx = 64, color = '#0f172a', bg = '#ffffff') {
    const text = String(seedStr || 'EDF-RECEIPT').trim();
    
    // 1. High-precision ISO/IEC 18004 QR Matrix generation using QRCode engine
    if (typeof QRCode !== 'undefined' && typeof document !== 'undefined') {
        try {
            let container = document.getElementById('__edf_qr_host__');
            if (!container) {
                container = document.createElement('div');
                container.id = '__edf_qr_host__';
                container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:120px;height:120px;visibility:hidden;pointer-events:none;';
                if (document.body) {
                    document.body.appendChild(container);
                } else if (document.documentElement) {
                    document.documentElement.appendChild(container);
                }
            }
            container.innerHTML = '';

            const qr = new QRCode(container, {
                text: text,
                width: 120,
                height: 120,
                colorDark: color,
                colorLight: bg,
                correctLevel: QRCode.CorrectLevel.M
            });

            if (qr && qr._oQRCode && typeof qr._oQRCode.getModuleCount === 'function') {
                const model = qr._oQRCode;
                const count = model.getModuleCount();
                const quietZone = 4; // Mandatory 4-module quiet zone (ISO/IEC 18004)
                const total = count + (quietZone * 2);
                let pathD = '';
                for (let r = 0; r < count; r++) {
                    for (let c = 0; c < count; c++) {
                        if (model.isDark(r, c)) {
                            pathD += `M${c + quietZone},${r + quietZone}h1v1h-1z `;
                        }
                    }
                }
                container.innerHTML = '';
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" style="display:block;background:${bg};"><rect width="${total}" height="${total}" fill="${bg}"/><path fill="${color}" d="${pathD}"/></svg>`;
            }
        } catch (err) {
            console.warn('QRCode SVG generation fallback:', err);
        }
    }

    // 2. Safe standalone vector fallback with quiet zones
    const N = 21;
    const quiet = 4;
    const total = N + (quiet * 2);
    let pathD = '';
    function addFinder(r0, c0) {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                    pathD += `M${c0 + c + quiet},${r0 + r + quiet}h1v1h-1z `;
                }
            }
        }
    }
    addFinder(0, 0);
    addFinder(0, N - 7);
    addFinder(N - 7, 0);
    for (let i = 8; i < N - 8; i += 2) {
        pathD += `M${i + quiet},${6 + quiet}h1v1h-1z M${6 + quiet},${i + quiet}h1v1h-1z `;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" style="display:block;background:${bg};"><rect width="${total}" height="${total}" fill="${bg}"/><path fill="${color}" d="${pathD}"/></svg>`;
}

function setReceiptPrintFormat(format) {
    const fmt = format === '80mm' ? '80mm' : 'a4';
    _receiptPrintFormat = fmt;
    try { localStorage.setItem('edf_receipt_print_format', fmt); } catch (_) {}

    const area = document.getElementById('subReceiptPrintArea');
    if (area) area.setAttribute('data-print-format', fmt);

    const a4Doc = document.getElementById('recA4Document');
    const thDoc = document.getElementById('recThermalDocument');
    if (a4Doc) a4Doc.style.display = fmt === 'a4' ? 'block' : 'none';
    if (thDoc) thDoc.style.display = fmt === '80mm' ? 'block' : 'none';

    document.getElementById('recFmtBtnA4')?.classList.toggle('active', fmt === 'a4');
    document.getElementById('recFmtBtn80mm')?.classList.toggle('active', fmt === '80mm');

    const stubWrap = document.getElementById('recStubToggleWrap');
    if (stubWrap) stubWrap.style.display = fmt === 'a4' ? 'inline-flex' : 'none';

    const defSelect = document.getElementById('subDefaultReceiptFormat');
    if (defSelect && defSelect.value !== fmt) defSelect.value = fmt;

    const primaryLbl = document.getElementById('recPrimaryPrintLabel');
    if (primaryLbl) primaryLbl.textContent = fmt === '80mm' ? 'Print 80mm Thermal' : 'Print A4 Receipt';

    const quickAltBtn = document.getElementById('recQuickThermalBtn');
    if (quickAltBtn) {
        if (fmt === 'a4') {
            quickAltBtn.setAttribute('onclick', "printReceiptVoucher('80mm')");
            quickAltBtn.setAttribute('title', 'Print directly to 80mm Thermal POS Printer');
            quickAltBtn.innerHTML = `<i data-lucide="scroll-text" style="width:13px;height:13px;"></i><span>Print 80mm</span>`;
        } else {
            quickAltBtn.setAttribute('onclick', "printReceiptVoucher('a4')");
            quickAltBtn.setAttribute('title', 'Print directly as A4 Official Voucher');
            quickAltBtn.innerHTML = `<i data-lucide="file-text" style="width:13px;height:13px;"></i><span>Print A4</span>`;
        }
        lucide.createIcons();
    }
}

function toggleReceiptOfficeStub(checked) {
    _receiptIncludeStub = !!checked;
    const stub = document.getElementById('recA4OfficeStub');
    if (stub) stub.style.display = _receiptIncludeStub ? 'block' : 'none';
}

function openReceiptFromSubModal() {
    const memberId = parseInt(document.getElementById('subMemberSelect')?.value, 10);
    const subId = document.getElementById('subRecordId')?.value || _currentEditSubId;
    if (!memberId) {
        showToast('Please select a member first', 'error');
        return;
    }
    closeModal('subModal');
    openSubReceiptModal(memberId, subId);
}

function openSubReceiptModal(memberId, subId = null, preferredFormat = null) {
    const pool = subData.length > 0 ? subData : (subYearlyData.length > 0 ? subYearlyData : subMembersData);
    let row = pool.find(r => r.id === memberId);

    // Fallback to _pmhData if opened from Member Payment History modal
    if (!row && typeof _pmhData !== 'undefined' && _pmhData && _pmhData.member && _pmhData.member.id === memberId) {
        row = _pmhData.member;
    }
    if (!row) { showToast('Member data not found', 'error'); return; }

    let recObj = row.rec || null;
    if (subId && recObj && recObj.id != subId) {
        recObj = null;
    }
    if (!recObj && row.monthsMatrix) {
        if (subId) {
            const matchMo = row.monthsMatrix.find(m => m.record && m.record.id == subId);
            if (matchMo) recObj = matchMo.record;
        }
        if (!recObj) {
            const lastPaid = [...row.monthsMatrix].reverse().find(m => m.record && m.paid > 0);
            if (lastPaid) recObj = lastPaid.record;
        }
    }
    if (!recObj && typeof _pmhData !== 'undefined' && _pmhData && Array.isArray(_pmhData.subscriptions)) {
        if (subId) {
            recObj = _pmhData.subscriptions.find(s => s.id == subId) || null;
        }
        if (!recObj && _pmhData.subscriptions.length > 0) {
            recObj = _pmhData.subscriptions[0];
        }
    }

    const picker = document.getElementById('subMonthPicker');
    const month = recObj?.month || picker?.value || _currentYearMonth();
    const [y, mo] = month.split('-');
    const monthName = new Date(y, mo - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const shortMonthName = new Date(y, mo - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    let paidAmt   = 0;
    let dueAmt    = row.monthly_subscription || 0;
    let method    = 'cash';
    let ref       = 'N/A';
    let pDate     = null;
    let bankName  = null;
    let bankCode  = null;
    let chqDate   = null;
    let chqImg    = null;
    let notes     = null;
    let isAdvance = false;
    let payments  = [];

    if (recObj) {
        payments  = Array.isArray(recObj.payments) ? recObj.payments : [];
        const firstPay = payments[0] || {};
        paidAmt   = recObj.paid_amount != null ? Number(recObj.paid_amount) : Number(recObj.amount || 0);
        dueAmt    = Number(recObj.amount || row.monthly_subscription || 0);
        method    = recObj.payment_method || firstPay.payment_method || 'cash';
        ref       = recObj.reference_number || firstPay.reference_number || 'N/A';
        pDate     = recObj.payment_date || firstPay.payment_date;
        bankName  = recObj.bank_name || firstPay.bank_name || null;
        bankCode  = recObj.bank_code || firstPay.bank_code || null;
        chqDate   = recObj.cheque_date || firstPay.cheque_date || null;
        chqImg    = recObj.cheque_image || firstPay.cheque_image || null;
        notes     = recObj.notes || firstPay.notes || null;
        isAdvance = !!recObj.is_advance;
    } else {
        paidAmt = Number(row.totalPaidYear || row.monthly_subscription || 0);
    }

    const balanceAmt = Math.max(0, dueAmt - paidAmt);
    const isFullyPaid = paidAmt >= dueAmt && dueAmt > 0;
    const voucherNo = `EDF-SUB-${month.replace('-', '')}-${String(subId || recObj?.id || row.id).padStart(4, '0')}`;
    const memberCode = `MEM-${String(row.id).padStart(4, '0')}`;
    const issueDateObj = pDate ? new Date(pDate) : new Date();
    const issueDate = issueDateObj.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const issueDateShort = issueDateObj.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    const printNowStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const fmtCurrency = val => `LKR ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtNumOnly  = val => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const methodLabels = { cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer', online: 'Online Transfer', other: 'Other' };
    const methodLabel  = methodLabels[method] || method;
    const memberTierLabel = row.member_type === 'founder' ? 'Founder Member' : 'Executive Member';
    const wordsStr = numberToWords(paidAmt);

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    // ── 1. POPULATE A4 OFFICIAL VOUCHER ──
    setTxt('recVoucherNo', voucherNo);
    setTxt('recIssueDate', `Issued: ${issueDate}`);
    setTxt('recMemberIdTag', memberCode);
    setTxt('recMemberName', row.full_name || '—');
    setTxt('recMemberType', memberTierLabel);
    setTxt('recMemberContact', row.phone || 'Not on file');
    setTxt('recMemberNic', row.nic_number || 'Verified Member');

    setTxt('recNatureTag', isAdvance ? 'ADVANCE CONTRIBUTION' : (isFullyPaid ? 'REGULAR DUES' : 'PARTIAL INSTALMENT'));
    setTxt('recBillingPeriodVal', `${monthName} (${month})`);
    setTxt('recMethodBadge', methodLabel);
    setTxt('recRefNo', ref !== 'N/A' ? `#${ref}` : 'Direct Counter');

    setTxt('recParticulars', `Membership Subscription Contribution — ${monthName}`);
    setTxt('recPeriod', `Billing Period: ${monthName} (${month})${isAdvance ? ' · Advance Payment' : ''}`);
    setTxt('recTableMonthCode', month);
    setTxt('recMonthlyDue', fmtCurrency(dueAmt));
    setTxt('recPaidAmount', fmtCurrency(paidAmt));
    setTxt('recBalanceDue', balanceAmt > 0 ? `${fmtCurrency(balanceAmt)} (Remaining)` : 'LKR 0.00 (Cleared)');
    const balEl = document.getElementById('recBalanceDue');
    if (balEl) balEl.style.color = balanceAmt > 0 ? '#d97706' : '#15803d';

    // Remarks & Instalments on A4
    const remBox = document.getElementById('recRemarksBox');
    if (remBox) {
        if (notes) {
            remBox.style.display = 'block';
            remBox.textContent = `Remarks: ${notes}`;
        } else {
            remBox.style.display = 'none';
            remBox.textContent = '';
        }
    }
    const instBox = document.getElementById('recInstalmentsBox');
    if (instBox) {
        if (payments && payments.length > 1) {
            instBox.style.display = 'block';
            instBox.innerHTML = `<div style="font-weight:700; color:#334155; margin-bottom:2px;">Instalment Breakdown (${payments.length} payments):</div>` +
                payments.map((p, idx) => {
                    const dt = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
                    return `<div>#${idx + 1}: ${fmtCurrency(p.amount)} via ${methodLabels[p.payment_method] || p.payment_method || 'Cash'} on ${dt}${p.reference_number ? ` (Ref: #${p.reference_number})` : ''}</div>`;
                }).join('');
        } else {
            instBox.style.display = 'none';
            instBox.innerHTML = '';
        }
    }

    // Status Pill & Watermark on A4
    const statusPillA4 = document.getElementById('recA4StatusPill');
    const statusTextA4 = document.getElementById('recA4StatusText');
    const watermarkA4  = document.getElementById('recA4Watermark');
    if (statusPillA4 && statusTextA4) {
        statusPillA4.classList.toggle('partial', !isFullyPaid);
        statusTextA4.textContent = isFullyPaid ? 'PAID IN FULL' : 'PARTIAL PAYMENT';
    }
    if (watermarkA4) {
        watermarkA4.textContent = isFullyPaid ? 'PAID IN FULL' : 'PARTIAL PAID';
    }

    // Populate Cheque / Bank Instrument Box on A4 Receipt
    const channelBox = document.getElementById('recChannelDetailsBox');
    const formattedChqDate = chqDate
        ? new Date(chqDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    if (channelBox) {
        if (method !== 'cash' || bankName || bankCode || chqDate || chqImg) {
            channelBox.style.display = 'block';
            const boxTitle = document.getElementById('recChannelBoxTitle');
            if (boxTitle) {
                boxTitle.textContent = method === 'cheque'
                    ? 'CHEQUE PAYMENT PARTICULARS'
                    : (method === 'bank_transfer' ? 'BANK TRANSFER PARTICULARS' : 'DIGITAL PAYMENT PARTICULARS');
            }
            setTxt('recBankName', bankName || '—');
            setTxt('recBankCode', bankCode || '—');
            setTxt('recChequeNo', ref !== 'N/A' ? `#${ref}` : '—');
            setTxt('recChequeDate', formattedChqDate);

            const imgWrap = document.getElementById('recChequeImageWrap');
            const imgEl = document.getElementById('recChequeImageEl');
            if (imgWrap && imgEl) {
                if (chqImg) {
                    imgWrap.style.display = 'block';
                    imgEl.src = chqImg;
                } else {
                    imgWrap.style.display = 'none';
                    imgEl.src = '';
                }
            }
        } else {
            channelBox.style.display = 'none';
        }
    }

    setTxt('recTotalAmount', fmtCurrency(paidAmt));
    setTxt('recAmountInWords', wordsStr);
    setTxt('recStatusStamp', isFullyPaid ? 'VERIFIED & PAID IN FULL' : 'PARTIAL PAYMENT RECORDED');
    setTxt('recPrintTimestamp', `PRINTED: ${printNowStr}`);

    // QR Code & Verification Hash
    const qrPayload = `EDF|${voucherNo}|${row.full_name}|${month}|LKR:${paidAmt}`;
    const verifyHash = `EDF-${voucherNo.slice(-8)}-${Math.abs(paidAmt | 0).toString(16).toUpperCase()}`;
    setTxt('recVerifyHash', verifyHash);
    const a4QrBox = document.getElementById('recA4QrBox');
    if (a4QrBox) a4QrBox.innerHTML = _generateReceiptQrSvg(qrPayload, 56, '#0f172a');

    // Office Counterfoil Stub (A4)
    setTxt('stubVoucherNo', voucherNo);
    setTxt('stubIssueDate', issueDateShort);
    setTxt('stubMemberName', row.full_name || '—');
    setTxt('stubMemberMeta', `${row.member_type === 'founder' ? 'Founder' : 'Executive'} · ${row.nic_number || memberCode}`);
    setTxt('stubPeriod', `${shortMonthName} (${month})`);
    setTxt('stubStatus', isFullyPaid ? 'PAID IN FULL' : `PARTIAL (Bal: ${fmtNumOnly(balanceAmt)})`);
    setTxt('stubAmount', fmtCurrency(paidAmt));
    setTxt('stubMethodRef', `${methodLabel}${ref !== 'N/A' ? ' #' + ref : ''}`);
    const stubEl = document.getElementById('recA4OfficeStub');
    if (stubEl) stubEl.style.display = _receiptIncludeStub ? 'block' : 'none';

    // ── 2. POPULATE 80mm THERMAL POS RECEIPT ──
    setTxt('thVoucherNo', voucherNo);
    setTxt('thIssueDate', issueDate);
    setTxt('thStatusBadge', isFullyPaid ? 'PAID IN FULL' : 'PARTIAL PAYMENT');
    setTxt('thMemberName', row.full_name || '—');
    setTxt('thMemberType', `${memberTierLabel} (${memberCode})`);
    setTxt('thMemberNic', row.nic_number || 'Verified');
    setTxt('thMemberContact', row.phone || '—');

    setTxt('thParticulars', `Membership Sub. (${shortMonthName})`);
    setTxt('thPeriod', `Period: ${monthName}`);
    setTxt('thPaidAmount', fmtNumOnly(paidAmt));

    const thRemRow = document.getElementById('thRemarksRow');
    if (thRemRow) {
        if (notes) {
            thRemRow.style.display = 'block';
            thRemRow.textContent = `Note: ${notes}`;
        } else {
            thRemRow.style.display = 'none';
            thRemRow.textContent = '';
        }
    }

    setTxt('thMonthlyDue', fmtCurrency(dueAmt));
    setTxt('thSummaryPaid', fmtCurrency(paidAmt));
    setTxt('thBalanceDue', fmtCurrency(balanceAmt));
    setTxt('thTotalAmount', fmtCurrency(paidAmt));
    setTxt('thAmountInWords', wordsStr);

    setTxt('thMethodBadge', methodLabel.toUpperCase());
    const thRefRow = document.getElementById('thRefRow');
    if (thRefRow) {
        thRefRow.style.display = ref !== 'N/A' ? 'flex' : 'none';
        setTxt('thRefNo', `#${ref}`);
    }
    const thBankRow = document.getElementById('thBankRow');
    if (thBankRow) {
        thBankRow.style.display = (bankName || bankCode) ? 'flex' : 'none';
        setTxt('thBankInfo', `${bankName || ''}${bankCode ? ' (' + bankCode + ')' : ''}`);
    }
    const thChqDateRow = document.getElementById('thChqDateRow');
    if (thChqDateRow) {
        thChqDateRow.style.display = chqDate ? 'flex' : 'none';
        setTxt('thChequeDate', formattedChqDate);
    }

    const thQrBox = document.getElementById('thQrBox');
    if (thQrBox) thQrBox.innerHTML = _generateReceiptQrSvg(qrPayload, 74, '#000000');
    setTxt('thStatusStamp', isFullyPaid ? 'VERIFIED & PAID IN FULL' : 'PARTIAL PAYMENT');
    setTxt('thFooterTimestamp', `Printed: ${printNowStr}`);

    // Apply requested or saved format
    const activeFmt = preferredFormat || document.getElementById('subDefaultReceiptFormat')?.value || _receiptPrintFormat || 'a4';
    setReceiptPrintFormat(activeFmt);

    _currentReceiptData = {
        voucherNo,
        memberCode,
        memberName: row.full_name,
        memberType: memberTierLabel,
        memberNic: row.nic_number || '—',
        memberPhone: row.phone || '—',
        monthName,
        month,
        dueAmt: fmtCurrency(dueAmt),
        paidAmt: fmtCurrency(paidAmt),
        balanceAmt: fmtCurrency(balanceAmt),
        amountInWords: wordsStr,
        isFullyPaid,
        method: methodLabel,
        ref,
        bankName,
        bankCode,
        chqDate,
        notes,
        issueDate
    };

    openModal('subReceiptModal');
    lucide.createIcons();
}

function printReceiptVoucher(requestedFormat = null) {
    if (requestedFormat === 'a4' || requestedFormat === '80mm') {
        setReceiptPrintFormat(requestedFormat);
    }
    const fmt = _receiptPrintFormat === '80mm' ? '80mm' : 'a4';
    const sourceEl = document.getElementById(fmt === '80mm' ? 'recThermalDocument' : 'recA4Document');
    if (!sourceEl) {
        window.print();
        return;
    }

    let printFrame = document.getElementById('edfReceiptPrintFrame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'edfReceiptPrintFrame';
        printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(printFrame);
    }

    const docTitle = _currentReceiptData?.voucherNo
        ? `${_currentReceiptData.voucherNo}_${fmt.toUpperCase()}`
        : `EDF_Receipt_${fmt.toUpperCase()}`;

    const a4PrintCss = `
        @page { size: A4 portrait; margin: 10mm 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; }
        .no-print-in-receipt { display: none !important; }
        .rec-a4-sheet { width: 100%; max-width: 100%; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; position: relative; page-break-inside: avoid; }
        .rec-a4-ribbon { height: 7px; background: linear-gradient(90deg, #0f172a 0%, #1e293b 55%, #059669 55%, #10b981 100%); }
        .rec-a4-body { padding: 16px 22px 14px; position: relative; }
        .rec-a4-watermark { position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg); font-size: 56px; font-weight: 900; letter-spacing: 0.14em; color: rgba(15, 23, 42, 0.035); pointer-events: none; white-space: nowrap; z-index: 0; }
        .rec-a4-content { position: relative; z-index: 1; }
        .receipt-document-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; margin-bottom: 12px; }
        .receipt-logo-block { display: flex; align-items: flex-start; gap: 12px; }
        .receipt-logo-icon { width: 48px; height: 48px; border-radius: 11px; background: #0f172a; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; letter-spacing: 0.05em; border: 2px solid #10b981; flex-shrink: 0; line-height: 1; }
        .receipt-logo-icon span { font-size: 6.5px; font-weight: 700; letter-spacing: 0.12em; color: #34d399; margin-top: 3px; text-transform: uppercase; }
        .receipt-org-name { font-size: 16px; font-weight: 900; letter-spacing: 0.02em; color: #0f172a; margin: 0; line-height: 1.2; text-transform: uppercase; }
        .receipt-org-sub { font-size: 10.5px; color: #475569; margin-top: 2px; font-weight: 600; }
        .receipt-org-meta { font-size: 9.5px; color: #64748b; margin-top: 2px; display: flex; gap: 6px; }
        .receipt-badge-title { text-align: right; flex-shrink: 0; }
        .rec-doc-pill { display: inline-block; background: #0f172a; color: #ffffff; font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 5px; margin-bottom: 4px; }
        .receipt-no-tag { font-family: 'Courier New', Consolas, monospace; font-size: 12.5px; color: #0f172a; font-weight: 800; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 7px; border-radius: 5px; display: inline-block; }
        .rec-status-pill-a4 { display: inline-flex; align-items: center; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 99px; margin-top: 4px; background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .rec-status-pill-a4.partial { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
        .receipt-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 12px; margin-bottom: 12px; }
        .rec-info-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
        .rec-info-box-hdr { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
        .receipt-field-val { font-size: 13.5px; font-weight: 800; color: #0f172a; line-height: 1.25; }
        .rec-kv-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 10.5px; padding: 2px 0; gap: 6px; }
        .rec-kv-lbl { color: #64748b; font-weight: 600; }
        .rec-kv-val { color: #0f172a; font-weight: 700; text-align: right; }
        .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #cbd5e1; }
        .receipt-table th { background: #0f172a; color: #ffffff; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 7px 10px; text-align: left; border-right: 1px solid #334155; }
        .receipt-table th:last-child { border-right: none; }
        .receipt-table td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; vertical-align: top; }
        .receipt-table td:last-child { border-right: none; }
        .receipt-table tfoot td { padding: 6px 10px; background: #f8fafc; font-size: 10.5px; }
        .receipt-total-strip { background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
        .receipt-total-amount { font-size: 18px; font-weight: 900; color: #14532d; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac; white-space: nowrap; }
        .receipt-words { font-size: 11px; font-weight: 700; font-style: italic; color: #1e293b; margin-top: 2px; }
        .receipt-sign-row { display: grid; grid-template-columns: auto 1fr 150px 150px; gap: 12px; align-items: end; margin-top: 12px; padding-top: 10px; border-top: 1px solid #cbd5e1; }
        .rec-qr-box { display: flex; align-items: center; gap: 8px; }
        .rec-qr-svg-wrap { width: 60px; height: 60px; padding: 3px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
        .receipt-seal { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; color: #059669; font-size: 9.5px; font-weight: 800; border: 2px double #059669; border-radius: 6px; padding: 4px 10px; text-transform: uppercase; letter-spacing: 0.06em; background: rgba(16, 185, 129, 0.04); justify-self: start; text-align: center; }
        .receipt-sign-line { text-align: center; }
        .receipt-sign-line-bar { border-bottom: 1.5px solid #334155; margin-bottom: 4px; height: 24px; }
        .rec-a4-stub { margin-top: 14px; padding-top: 12px; border-top: 1.5px dashed #94a3b8; position: relative; }
        .rec-a4-stub-cut { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #ffffff; padding: 0 8px; font-size: 8.5px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; white-space: nowrap; }
        .rec-a4-stub-grid { display: grid; grid-template-columns: 1.2fr 1.3fr 1fr 1fr 100px; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; align-items: center; font-size: 10px; }
    `;

    const thermalPrintCss = `
        @page { size: 80mm auto; margin: 0mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { margin: 0; padding: 0; width: 80mm; background: #ffffff; color: #000000; font-family: 'Courier New', Consolas, 'Liberation Mono', monospace; font-size: 11.5px; line-height: 1.35; }
        .rec-thermal-roll { width: 72mm; margin: 0 auto; padding: 3mm 1mm 6mm; background: #ffffff; color: #000000; border: none; box-shadow: none; }
        .th-center { text-align: center; }
        .th-logo-badge { display: inline-block; border: 2px solid #000; padding: 1px 8px; font-weight: 900; font-size: 14px; letter-spacing: 3px; margin-bottom: 3px; }
        .th-org-name { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12.5px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; color: #000; line-height: 1.18; }
        .th-org-sub { font-size: 10px; color: #000; font-weight: 700; }
        .th-title-banner { background: #000000 !important; color: #ffffff !important; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 11px; letter-spacing: 0.08em; padding: 3.5px 4px; margin: 6px 0; text-transform: uppercase; }
        .th-divider { border-top: 1px dashed #000000; margin: 5px 0; }
        .th-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin: 2px 0; font-size: 11px; }
        .th-row-lbl { font-weight: 700; color: #000; white-space: nowrap; }
        .th-row-val { font-weight: 700; color: #000; text-align: right; word-break: break-word; }
        .th-item-hdr { display: flex; justify-content: space-between; font-weight: 900; font-size: 10.5px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 2.5px 0; margin: 4px 0; }
        .th-total-box { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 0; margin: 5px 0; }
        .th-grand-row { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; font-size: 14px; color: #000; }
        .th-words { font-size: 10px; font-style: italic; font-weight: 700; color: #000; margin-top: 2px; line-height: 1.2; }
        .th-stamp-box { display: inline-block; border: 1.5px solid #000; padding: 2px 7px; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; margin: 5px 0; text-transform: uppercase; }
        .th-qr-wrap { width: 74px; height: 74px; margin: 5px auto 2px; display: flex; align-items: center; justify-content: center; }
    `;

    const clone = sourceEl.cloneNode(true);
    clone.style.display = 'block';

    const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
    const doc = frameDoc.document || frameDoc;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<style>${fmt === '80mm' ? thermalPrintCss : a4PrintCss}</style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 180);
}

function copyReceiptWhatsApp() {
    if (!_currentReceiptData) return;
    const r = _currentReceiptData;
    const bankLine = r.bankName ? `\n*Bank:* ${r.bankName}${r.bankCode ? ' (' + r.bankCode + ')' : ''}` : '';
    const chqDateLine = r.chqDate ? `\n*Instrument Date:* ${new Date(r.chqDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}` : '';
    const balLine = !r.isFullyPaid ? `\n*Balance Remaining:* ${r.balanceAmt}` : '';
    const text = `*EDUCATION & DEVELOPMENT FOUNDATION (EDF)*\n*OFFICIAL PAYMENT RECEIPT*\n----------------------------------\n*Receipt No:* ${r.voucherNo}\n*Date:* ${r.issueDate}\n*Contributor:* ${r.memberName} (${r.memberType})\n*Contribution Period:* ${r.monthName}\n*Amount Received:* ${r.paidAmt}${balLine}\n*Payment Method:* ${r.method}${r.ref !== 'N/A' ? ' (Ref: #' + r.ref + ')' : ''}${bankLine}${chqDateLine}\n*Status:* ${r.isFullyPaid ? 'Verified & Paid in Full' : 'Partial Payment Recorded'}\n----------------------------------\n_Thank you for your generous contribution supporting EDF charitable educational & community initiatives!_`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Receipt message copied! Paste into WhatsApp.', 'success');
        }).catch(() => {
            showToast('Copied to clipboard', 'success');
        });
    } else {
        showToast('Receipt summary ready to share', 'success');
    }
}

// ── EXPORT TO EXCEL (MONTHLY OR YEARLY) ──
function exportSubscriptionsExcel() {
    if (_subViewMode === 'yearly') {
        if (!subYearlyData || subYearlyData.length === 0) {
            showToast('No annual subscription data to export', 'error');
            return;
        }

        const monthKeys = ['01','02','03','04','05','06','07','08','09','10','11','12'];
        const mNames    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        const rows = subYearlyData.map(r => {
            const rowObj = {
                'Member Name': r.full_name,
                'Member Type': r.member_type === 'founder' ? 'Founder' : 'Executive',
                'Phone': r.phone || '—',
                'NIC': r.nic_number || '—',
                'Monthly Rate (LKR)': r.monthly_subscription || 0,
                'Annual Target (LKR)': r.annualTarget || 0,
                'Total Paid (LKR)': r.totalPaidYear || 0,
                'Outstanding Balance (LKR)': r.pendingBalanceAnnual || 0,
                'Annual Status': r.yearlyPayStatus.toUpperCase()
            };

            // Add each of the 12 months status & paid
            mNames.forEach((name, idx) => {
                const mItem = (r.monthsMatrix || [])[idx];
                if (!mItem || mItem.status === 'exempt') {
                    rowObj[`${name} ${_subSelectedYear}`] = 'Exempt';
                } else if (mItem.status === 'paid') {
                    rowObj[`${name} ${_subSelectedYear}`] = `Paid (${mItem.paid})`;
                } else if (mItem.status === 'partial') {
                    rowObj[`${name} ${_subSelectedYear}`] = `Partial (${mItem.paid}/${mItem.due})`;
                } else if (mItem.status === 'pending') {
                    rowObj[`${name} ${_subSelectedYear}`] = `Pending (${mItem.due})`;
                } else {
                    rowObj[`${name} ${_subSelectedYear}`] = 'Upcoming';
                }
            });

            return rowObj;
        });

        try {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `Annual ${_subSelectedYear}`);
            XLSX.writeFile(wb, `EDF_Subscriptions_Annual_${_subSelectedYear}.xlsx`);
            showToast(`Annual ${_subSelectedYear} report exported to Excel!`, 'success');
        } catch (err) {
            console.error('Annual export error:', err);
            showToast('Export failed', 'error');
        }
    } else {
        // Monthly Export
        if (!subData || subData.length === 0) {
            showToast('No subscription data to export', 'error');
            return;
        }
        const picker = document.getElementById('subMonthPicker');
        const selectedMonth = picker?.value || _currentYearMonth();

        const rows = subData.map(r => {
            const actualPaid = r.rec ? (r.rec.paid_amount != null ? r.rec.paid_amount : r.rec.amount) : 0;
            const due = r.monthly_subscription || 0;
            const bal = Math.max(0, due - actualPaid);
            return {
                'Member Name': r.full_name,
                'Member Type': r.member_type === 'founder' ? 'Founder' : 'Executive',
                'Phone': r.phone || '—',
                'NIC': r.nic_number || '—',
                'Month Period': selectedMonth,
                'Monthly Due (LKR)': due,
                'Paid Amount (LKR)': actualPaid,
                'Balance Due (LKR)': bal,
                'Payment Method': r.rec?.payment_method || '—',
                'Bank Name': r.rec?.bank_name || '—',
                'Bank Code': r.rec?.bank_code || '—',
                'Reference / Cheque No': r.rec?.reference_number || '—',
                'Cheque / Instrument Date': r.rec?.cheque_date || '—',
                'Status': r.payStatus.toUpperCase(),
                'Payment Date': r.rec?.payment_date ? new Date(r.rec.payment_date).toISOString().slice(0, 10) : '—',
                'Notes': r.rec?.notes || ''
            };
        });

        try {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Subscriptions');
            XLSX.writeFile(wb, `EDF_Subscriptions_${selectedMonth}.xlsx`);
            showToast('Subscriptions exported to Excel successfully!', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('Excel export failed', 'error');
        }
    }
}

// ────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// LOW-INCOME FAMILIES (BENEFICIARIES) — COMMAND CENTER, FILTERS, GRID & BULK SUITE
// ═══════════════════════════════════════════════════════════════════════════
let currentBeneficiaries = [];
let _benStatusFilter    = 'all';
let _benCategoryFilter  = 'all';
let _benTownFilter      = 'all';
let _benHousingFilter   = 'all';
let _benFamStatusFilter = 'all';
let _benIncomeFilter    = 'all';
let _benSortKey         = 'created_at';
let _benSortDir         = 'desc';
let _benPage            = 1;
let _benPageSize        = 15;
let _benViewMode        = 'table'; // 'table' | 'grid'
let _selectedBenIds     = new Set();
let _currentPageBenIds  = [];

async function fetchBeneficiaries() {
    try {
        const res = await fetch('/api/edf/beneficiaries');
        const list = await res.json();
        currentBeneficiaries = Array.isArray(list) ? list : [];

        // Keep selection valid
        const validSet = new Set(currentBeneficiaries.map(b => Number(b.id)));
        _selectedBenIds.forEach(id => {
            if (!validSet.has(Number(id))) _selectedBenIds.delete(id);
        });

        updateBenPageStatsAndTowns();
        if (typeof updateBenCategoryKpis === 'function') updateBenCategoryKpis();
        filterBeneficiaries();
        const hubPanel = document.getElementById('benHelpsHubPanel');
        if (hubPanel && hubPanel.style.display !== 'none' && typeof fetchBenHelpsHub === 'function') {
            fetchBenHelpsHub(false);
        }
        if (window.lucide) lucide.createIcons();
    } catch (err) { console.error(err); }
}

function updateBenPageStatsAndTowns() {
    const total    = currentBeneficiaries.length;
    const active   = currentBeneficiaries.filter(b => b.status === 'Active').length;
    const pending  = currentBeneficiaries.filter(b => b.status === 'pending').length;
    const hold     = currentBeneficiaries.filter(b => b.status === 'deactivate').length;
    const rejected = currentBeneficiaries.filter(b => b.status === 'rejected').length;
    const totalChildren = currentBeneficiaries.reduce((sum, b) => sum + (Number(b.children_total_count) || 0), 0);

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };

    setTxt('benHeroTotalBadge', `${total} Registered ${total === 1 ? 'Family' : 'Families'}`);
    const totalHelpsCount = currentBeneficiaries.reduce((sum, b) => sum + (Number(b.helps_count) || 0), 0);
    setTxt('benHeroHelpsBadge', totalHelpsCount);
    setTxt('bStatTotal', total);
    setTxt('bStatTotalSub', `${totalChildren} dependent children tracked`);
    setTxt('bStatActive', active);
    setTxt('bStatActiveSub', total > 0 ? `${Math.round((active / total) * 100)}% approval rate` : 'Verified & eligible');
    setTxt('bStatPending', pending);
    setTxt('bStatPendingSub', pending > 0 ? 'Awaiting assessment' : 'All reviewed');
    setTxt('bStatHold', hold);
    setTxt('bStatHoldSub', hold > 0 ? 'Paused files' : 'None on hold');
    setTxt('bStatRejected', rejected);
    setTxt('bStatRejectedSub', rejected > 0 ? 'Ineligible records' : '0 rejected');

    setTxt('benPillCountAll', total);
    setTxt('benPillCountActive', active);
    setTxt('benPillCountPending', pending);
    setTxt('benPillCountHold', hold);
    setTxt('benPillCountRejected', rejected);

    // Populate distinct Home Towns dropdown
    const townSel = document.getElementById('benTownFilter');
    if (townSel) {
        const curTown = townSel.value || _benTownFilter;
        const towns = [...new Set(
            currentBeneficiaries
                .map(b => String(b.home_town || '').trim())
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        townSel.innerHTML = '<option value="all">Town: All</option>' +
            towns.map(t => `<option value="${escapeBenCatHtml(t)}">${escapeBenCatHtml(t)}</option>`).join('');
        townSel.value = towns.includes(curTown) ? curTown : 'all';
        _benTownFilter = townSel.value;
    }
}

function setBenViewMode(mode) {
    _benViewMode = mode === 'grid' ? 'grid' : 'table';
    const tblBtn = document.getElementById('benViewTableBtn');
    const grdBtn = document.getElementById('benViewGridBtn');
    const tblWrap = document.getElementById('benTableViewWrap');
    const grdWrap = document.getElementById('benGridViewWrap');
    if (tblBtn) tblBtn.classList.toggle('active', _benViewMode === 'table');
    if (grdBtn) grdBtn.classList.toggle('active', _benViewMode === 'grid');
    if (tblWrap) tblWrap.style.display = _benViewMode === 'table' ? 'block' : 'none';
    if (grdWrap) grdWrap.style.display = _benViewMode === 'grid' ? 'grid' : 'none';
    filterBeneficiaries();
}

function setBenStatusFilter(status, btn) {
    _benStatusFilter = status;
    _benPage = 1;
    const wrap = document.getElementById('benStatusPillsWrap');
    if (wrap) {
        wrap.querySelectorAll('.filter-pill').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-bstat-pill') === status);
        });
    } else if (btn) {
        btn.closest('div')?.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    filterBeneficiaries();
}

function setBenStatusFromKpi(status) {
    const pill = document.querySelector(`#benStatusPillsWrap [data-bstat-pill="${status}"]`);
    setBenStatusFilter(status, pill);
}

function setBenCategoryFilter(val) {
    _benCategoryFilter = val || 'all';
    const sel = document.getElementById('benCategoryFilter');
    if (sel && sel.value !== _benCategoryFilter) sel.value = _benCategoryFilter;
    if (sel) sel.classList.toggle('active-select', _benCategoryFilter !== 'all');
    _benPage = 1;
    filterBeneficiaries();
}

function setBenAdvFilter(type, val) {
    if (type === 'town') {
        _benTownFilter = val || 'all';
        document.getElementById('benTownFilter')?.classList.toggle('active-select', _benTownFilter !== 'all');
    } else if (type === 'housing') {
        _benHousingFilter = val || 'all';
        document.getElementById('benHomeFilter')?.classList.toggle('active-select', _benHousingFilter !== 'all');
    } else if (type === 'famStatus') {
        _benFamStatusFilter = val || 'all';
        document.getElementById('benFamStatusFilter')?.classList.toggle('active-select', _benFamStatusFilter !== 'all');
    } else if (type === 'income') {
        _benIncomeFilter = val || 'all';
        document.getElementById('benIncomeFilter')?.classList.toggle('active-select', _benIncomeFilter !== 'all');
    }
    _benPage = 1;
    filterBeneficiaries();
}

function setBenQuickPresetFilter(preset) {
    resetBeneficiaryFilters(false);
    if (preset === 'widow') {
        _benFamStatusFilter = 'widow';
        const el = document.getElementById('benFamStatusFilter');
        if (el) { el.value = 'widow'; el.classList.add('active-select'); }
    } else if (preset === 'extreme_poverty') {
        _benIncomeFilter = 'extreme';
        const el = document.getElementById('benIncomeFilter');
        if (el) { el.value = 'extreme'; el.classList.add('active-select'); }
    } else if (preset === 'dry_ration') {
        _benFamStatusFilter = 'dry_ration';
        const el = document.getElementById('benFamStatusFilter');
        if (el) { el.value = 'dry_ration'; el.classList.add('active-select'); }
    } else if (preset === 'special_needs') {
        _benFamStatusFilter = 'special_needs';
        const el = document.getElementById('benFamStatusFilter');
        if (el) { el.value = 'special_needs'; el.classList.add('active-select'); }
    } else if (preset === 'pending') {
        setBenStatusFromKpi('pending');
        return;
    }
    filterBeneficiaries();
}

function resetBeneficiaryFilters(shouldRender = true) {
    _benStatusFilter    = 'all';
    _benCategoryFilter  = 'all';
    _benTownFilter      = 'all';
    _benHousingFilter   = 'all';
    _benFamStatusFilter = 'all';
    _benIncomeFilter    = 'all';
    _benSortKey         = 'created_at';
    _benSortDir         = 'desc';
    _benPage            = 1;

    const searchEl = document.getElementById('benSearchInput');
    if (searchEl) searchEl.value = '';

    ['benCategoryFilter', 'benTownFilter', 'benHomeFilter', 'benFamStatusFilter', 'benIncomeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = 'all';
            el.classList.remove('active-select');
        }
    });

    const sortSel = document.getElementById('benSortSelect');
    if (sortSel) sortSel.value = 'created_at:desc';

    const wrap = document.getElementById('benStatusPillsWrap');
    if (wrap) {
        wrap.querySelectorAll('.filter-pill').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-bstat-pill') === 'all');
        });
    }

    if (shouldRender) filterBeneficiaries();
}

function onBenSortDropdownChange(val) {
    const [key, dir] = String(val || 'created_at:desc').split(':');
    _benSortKey = key || 'created_at';
    _benSortDir = dir || 'desc';
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
    const sortSel = document.getElementById('benSortSelect');
    if (sortSel) {
        const candidate = `${_benSortKey}:${_benSortDir}`;
        if ([...sortSel.options].some(o => o.value === candidate)) {
            sortSel.value = candidate;
        }
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
        sel.innerHTML = '<option value="all">Category: All</option>' +
            cats.map(c => `<option value="${escapeBenCatHtml(c.name)}">${escapeBenCatHtml(c.name)}</option>`).join('');
        if (cur && [...sel.options].some(o => o.value === cur)) {
            sel.value = cur;
        }
    } catch (_) {}
}

function toggleSelectBeneficiary(id, checked) {
    const numId = Number(id);
    if (checked) _selectedBenIds.add(numId);
    else _selectedBenIds.delete(numId);
    updateBenBulkBarUI();
}

function toggleSelectAllBeneficiaries(checked) {
    _currentPageBenIds.forEach(id => {
        if (checked) _selectedBenIds.add(Number(id));
        else _selectedBenIds.delete(Number(id));
    });
    document.querySelectorAll('.ben-row-cb').forEach(cb => {
        cb.checked = checked;
    });
    updateBenBulkBarUI();
}

function clearBenSelection() {
    _selectedBenIds.clear();
    const allCb = document.getElementById('benSelectAllCb');
    if (allCb) allCb.checked = false;
    document.querySelectorAll('.ben-row-cb').forEach(cb => { cb.checked = false; });
    updateBenBulkBarUI();
}

function updateBenBulkBarUI() {
    const bar = document.getElementById('benBulkBar');
    const countEl = document.getElementById('benBulkCount');
    const allCb = document.getElementById('benSelectAllCb');
    const count = _selectedBenIds.size;

    if (countEl) countEl.textContent = String(count);
    if (bar) bar.classList.toggle('visible', count > 0);
    if (allCb) {
        allCb.checked = _currentPageBenIds.length > 0 && _currentPageBenIds.every(id => _selectedBenIds.has(Number(id)));
    }
}

async function executeBenBulkAction(action, value = '') {
    const ids = [..._selectedBenIds];
    if (ids.length === 0) return;

    if (action === 'delete') {
        if (!confirm(`Delete ${ids.length} selected beneficiary record(s)? This cannot be undone.`)) return;
        let deleted = 0;
        for (const id of ids) {
            const res = await fetch(`/api/edf/beneficiaries/${id}`, { method: 'DELETE' });
            if (res.ok) deleted++;
        }
        clearBenSelection();
        await fetchBeneficiaries();
        showToast(`Deleted ${deleted} beneficiary record(s)`, 'success');
        return;
    }

    if (action === 'status') {
        let updated = 0;
        for (const id of ids) {
            const detailRes = await fetch(`/api/edf/beneficiaries/${id}`);
            if (!detailRes.ok) continue;
            const fullRecord = await detailRes.json();
            fullRecord.status = value;
            const putRes = await fetch(`/api/edf/beneficiaries/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fullRecord)
            });
            if (putRes.ok) updated++;
        }
        clearBenSelection();
        await fetchBeneficiaries();
        showToast(`Updated status for ${updated} beneficiary household(s)`, 'success');
    }
}

function exportSelectedBeneficiariesCSV() {
    const selected = currentBeneficiaries.filter(b => _selectedBenIds.has(Number(b.id)));
    if (selected.length === 0) return;
    const headers = ['App #', 'Head of Family', 'NIC Number', 'Contact Number', 'Home Town', 'Category', 'Monthly Income (LKR)', 'Housing', 'Children Count', 'Status'];
    const csvRows = [
        headers.join(','),
        ...selected.map(b => [
            b.application_number || '',
            b.male_head_name || '',
            b.nic_number || '',
            b.contact_number || '',
            b.home_town || '',
            b.category || '',
            b.monthly_income ?? '',
            b.living_home_details || '',
            b.children_total_count ?? 0,
            b.status || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EDF_Selected_Beneficiaries_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(`Exported ${selected.length} selected beneficiaries`, 'success');
}

function filterBeneficiaries() {
    const qRaw = document.getElementById('benSearchInput')?.value || '';
    const q = qRaw.trim().toLowerCase();

    const clearSearchBtn = document.getElementById('benSearchClearBtn');
    if (clearSearchBtn) clearSearchBtn.style.display = q ? 'inline-flex' : 'none';

    const hasAnyFilter =
        Boolean(q) ||
        _benStatusFilter !== 'all' ||
        _benCategoryFilter !== 'all' ||
        _benTownFilter !== 'all' ||
        _benHousingFilter !== 'all' ||
        _benFamStatusFilter !== 'all' ||
        _benIncomeFilter !== 'all';

    const resetBtn = document.getElementById('benResetFiltersBtn');
    if (resetBtn) resetBtn.style.display = hasAnyFilter ? 'inline-flex' : 'none';

    let filtered = currentBeneficiaries.filter(b => {
        if (_benStatusFilter !== 'all' && b.status !== _benStatusFilter) return false;
        if (_benCategoryFilter !== 'all' && (b.category || '') !== _benCategoryFilter) return false;
        if (_benTownFilter !== 'all' && String(b.home_town || '').trim() !== _benTownFilter) return false;
        if (_benHousingFilter !== 'all' && String(b.living_home_details || '').toLowerCase() !== _benHousingFilter.toLowerCase()) return false;

        if (_benFamStatusFilter !== 'all') {
            if (_benFamStatusFilter === 'widow') {
                const isWidow = String(b.family_status || '').toLowerCase() === 'widow' ||
                                String(b.category || '').toLowerCase().includes('widow');
                if (!isWidow) return false;
            } else if (_benFamStatusFilter === 'special_needs') {
                const hasSpec = String(b.special_needs_at_home || '').toLowerCase() === 'yes' ||
                                (b.special_needs && String(b.special_needs).trim().toLowerCase() !== 'none' && String(b.special_needs).trim() !== '');
                if (!hasSpec) return false;
            } else if (_benFamStatusFilter === 'dry_ration') {
                if (String(b.assistance_details || '').toLowerCase() !== 'dry ration') return false;
            } else if (String(b.family_status || '') !== _benFamStatusFilter) {
                return false;
            }
        }

        if (_benIncomeFilter !== 'all') {
            const inc = Number(b.monthly_income || 0);
            if (_benIncomeFilter === 'zero' && inc > 0) return false;
            if (_benIncomeFilter === 'extreme' && inc > 15000) return false;
            if (_benIncomeFilter === 'low' && (inc <= 15000 || inc > 30000)) return false;
            if (_benIncomeFilter === 'moderate' && inc <= 30000) return false;
        }

        if (q && !(
            (b.male_head_name || '').toLowerCase().includes(q) ||
            (b.female_head_name || '').toLowerCase().includes(q) ||
            (b.application_number || '').toLowerCase().includes(q) ||
            (b.home_town || '').toLowerCase().includes(q) ||
            (b.contact_number || '').toLowerCase().includes(q) ||
            (b.nic_number || '').toLowerCase().includes(q) ||
            (b.category || '').toLowerCase().includes(q) ||
            (b.male_head_occupation || '').toLowerCase().includes(q)
        )) return false;
        return true;
    });

    // Sort
    filtered.sort((a, b) => {
        let va = a[_benSortKey] ?? '', vb = b[_benSortKey] ?? '';
        if (_benSortKey === 'monthly_income' || _benSortKey === 'children_total_count') {
            va = Number(va || 0);
            vb = Number(vb || 0);
        } else {
            va = String(va).toLowerCase();
            vb = String(vb).toLowerCase();
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return _benSortDir === 'asc' ? cmp : -cmp;
    });

    const totalFiltered = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalFiltered / _benPageSize));
    if (_benPage > totalPages) _benPage = totalPages;

    // Paginate
    const start = (_benPage - 1) * _benPageSize;
    const pageItems = filtered.slice(start, start + _benPageSize);
    _currentPageBenIds = pageItems.map(b => Number(b.id));

    // Filter count label
    const countEl = document.getElementById('benFilterCount');
    if (countEl) {
        const showing = pageItems.length;
        countEl.textContent = totalFiltered === 0
            ? `0 matching families`
            : totalFiltered < currentBeneficiaries.length
                ? `Showing ${start + 1}–${start + showing} of ${totalFiltered} (filtered from ${currentBeneficiaries.length})`
                : `Showing ${start + 1}–${start + showing} of ${totalFiltered} ${totalFiltered === 1 ? 'family' : 'families'}`;
    }

    const statusLabel = { Active: 'Approved', pending: 'Pending', deactivate: 'On Hold', rejected: 'Rejected' };
    const housingLabel = { 'own house': 'Own House', 'rent house': 'Rented', 'joint Family': 'Joint Family' };

    const getIncomeTierHtml = (incVal) => {
        if (incVal == null || incVal === '') return '<span style="font-size:0.7rem; color:var(--text-muted);">Unreported</span>';
        const n = Number(incVal);
        if (n <= 0) return '<span style="font-size:0.68rem; color:#ef4444; font-weight:700;">No Income · Critical</span>';
        if (n <= 15000) return '<span style="font-size:0.68rem; color:#ef4444; font-weight:700;">Extreme Poverty</span>';
        if (n <= 30000) return '<span style="font-size:0.68rem; color:#d97706; font-weight:700;">Low Income</span>';
        return '<span style="font-size:0.68rem; color:#10b981; font-weight:600;">Moderate Tier</span>';
    };

    const tbody = document.getElementById('beneficiariesBody');
    if (tbody) {
        tbody.innerHTML = pageItems.map((b, i) => {
            const catMeta = b.category && typeof getBenCategoryVisualMeta === 'function'
                ? getBenCategoryVisualMeta(b.category)
                : null;
            const catCellHtml = catMeta
                ? `<span class="bcat-badge-chip" style="background:${catMeta.bg}; color:${catMeta.color}; border-color:${catMeta.border}; font-size:0.72rem; padding:0.16rem 0.55rem;"><i data-lucide="${catMeta.icon}" style="width:12px;height:12px;"></i><span>${escapeBenCatHtml(b.category)}</span></span>`
                : '<span style="font-size:0.74rem; color:var(--text-muted);">Uncategorized</span>';

            const isChecked = _selectedBenIds.has(Number(b.id));
            const initials = (b.male_head_name || '?').trim().charAt(0).toUpperCase();
            const avatarHtml = b.photo_url
                ? `<div class="fam-avatar"><img src="${escapeBenCatHtml(b.photo_url)}" alt=""></div>`
                : `<div class="fam-avatar" style="background:rgba(16,185,129,0.12); color:#10b981; border-color:rgba(16,185,129,0.28);">${escapeBenCatHtml(initials)}</div>`;

            const childCount = Number(b.children_total_count || 0);
            const hLabel = housingLabel[b.living_home_details] || b.living_home_details || '';

            return `
            <tr>
                <td style="text-align:center;">
                    <input type="checkbox" class="ben-row-cb" ${isChecked ? 'checked' : ''} onchange="toggleSelectBeneficiary(${b.id}, this.checked)" style="cursor:pointer;">
                </td>
                <td style="text-align:center; font-size:0.76rem; color:var(--text-muted); font-weight:700;">${start + i + 1}</td>
                <td>
                    <span class="fam-code-badge">${escapeBenCatHtml(b.application_number || '—')}</span>
                    ${b.created_at ? `<div style="font-size:0.68rem; color:var(--text-muted); margin-top:0.2rem;">${new Date(b.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>` : ''}
                </td>
                <td>
                    <div class="fam-head-cell">
                        ${avatarHtml}
                        <div style="min-width:0;">
                            <div style="font-weight:700; color:var(--text-main); font-size:0.86rem; cursor:pointer;" onclick="viewBeneficiary(${b.id})">${escapeBenCatHtml(b.male_head_name || '—')}</div>
                            <div style="font-size:0.73rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                <span>${escapeBenCatHtml(b.nic_number || 'No NIC')}</span>
                                ${b.female_head_name ? `<span>· Spouse: ${escapeBenCatHtml(b.female_head_name)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight:600; font-size:0.82rem; color:var(--text-main);">${escapeBenCatHtml(b.contact_number || '—')}</div>
                    <div style="font-size:0.73rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem; margin-top:0.15rem; flex-wrap:wrap;">
                        <span><i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:middle;"></i> ${escapeBenCatHtml(b.home_town || '—')}</span>
                        ${hLabel ? `<span style="padding:0.05rem 0.38rem; border-radius:5px; background:var(--input-bg); border:1px solid var(--border-color); font-size:0.66rem;">${escapeBenCatHtml(hLabel)}</span>` : ''}
                    </div>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:0.28rem;">
                        ${catCellHtml}
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.7rem; color:var(--text-muted);">
                            <span><i data-lucide="baby" style="width:11px;height:11px;vertical-align:middle;"></i> ${childCount} ${childCount === 1 ? 'Child' : 'Children'}</span>
                            ${b.assistance_details ? `<span>· ${escapeBenCatHtml(b.assistance_details)}</span>` : ''}
                        </div>
                        <div style="margin-top:0.15rem;">${typeof _buildBenRowHelpsBadgeHtml === 'function' ? _buildBenRowHelpsBadgeHtml(b) : ''}</div>
                    </div>
                </td>
                <td>
                    <div style="font-weight:700; font-size:0.86rem; color:var(--text-main); font-variant-numeric:tabular-nums;">
                        ${b.monthly_income != null && b.monthly_income !== '' ? 'LKR ' + Number(b.monthly_income).toLocaleString() : '—'}
                    </div>
                    <div>${getIncomeTierHtml(b.monthly_income)}</div>
                </td>
                <td><span class="status-badge status-${b.status}">${statusLabel[b.status] || b.status}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; align-items:center; gap:0.3rem;">
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:var(--glow-bg);" onclick="viewBeneficiary(${b.id})" title="View Profile"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:rgba(16,185,129,0.13); color:#059669; border:1px solid rgba(16,185,129,0.28);" onclick="openBenHelpsTab(${b.id})" title="Manage Helps, Equipment, Repairs &amp; Logs"><i data-lucide="hand-helping" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:rgba(212,175,55,0.14); color:#b45309; border:1px solid rgba(212,175,55,0.34);" onclick="openBeneficiaryHistoryModal(${b.id})" title="Aid &amp; Donation History"><i data-lucide="history" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:linear-gradient(135deg,#0f172a,#1e293b); color:#f59e0b; border:1px solid rgba(212,175,55,0.4);" onclick="generateBenIdCard(${b.id})" title="PVC Member ID Card"><i data-lucide="id-card" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:var(--glow-bg);" onclick="editBeneficiary(${b.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:rgba(2,132,199,0.12); color:#0284c7;" onclick="printBeneficiaryReport(${b.id})" title="Print Report"><i data-lucide="printer" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.38rem 0.48rem; background:rgba(239,68,68,0.12); color:#ef4444;" onclick="deleteBeneficiary(${b.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                    </div>
                </td>
            </tr>
        `;}).join('') || `
            <tr>
                <td colspan="9" style="text-align:center; padding:2.75rem 1.5rem; color:var(--text-muted);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
                        <i data-lucide="users" style="width:28px;height:28px;opacity:0.45;"></i>
                        <div style="font-weight:700; color:var(--text-main);">No matching beneficiary households found</div>
                        <div style="font-size:0.78rem;">Try adjusting your search or filter criteria, or register a new family.</div>
                    </div>
                </td>
            </tr>`;
    }

    // Also render Grid View if active
    const gridWrap = document.getElementById('benGridViewWrap');
    if (gridWrap && _benViewMode === 'grid') {
        gridWrap.innerHTML = pageItems.map(b => {
            const catMeta = b.category && typeof getBenCategoryVisualMeta === 'function'
                ? getBenCategoryVisualMeta(b.category)
                : null;
            const catChip = catMeta
                ? `<span class="bcat-badge-chip" style="background:${catMeta.bg}; color:${catMeta.color}; border-color:${catMeta.border}; font-size:0.7rem; padding:0.15rem 0.5rem;"><i data-lucide="${catMeta.icon}" style="width:11px;height:11px;"></i><span>${escapeBenCatHtml(b.category)}</span></span>`
                : '<span style="font-size:0.7rem; color:var(--text-muted);">Uncategorized</span>';
            const initials = (b.male_head_name || '?').trim().charAt(0).toUpperCase();
            const avatarHtml = b.photo_url
                ? `<div class="fam-avatar" style="width:44px;height:44px;border-radius:12px;"><img src="${escapeBenCatHtml(b.photo_url)}" alt=""></div>`
                : `<div class="fam-avatar" style="width:44px;height:44px;border-radius:12px;background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.28);">${escapeBenCatHtml(initials)}</div>`;
            const childCount = Number(b.children_total_count || 0);

            return `
            <div class="ben-household-card">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.65rem; margin-bottom:0.75rem;">
                        <div style="display:flex; align-items:center; gap:0.7rem; min-width:0;">
                            ${avatarHtml}
                            <div style="min-width:0;">
                                <div style="font-weight:800; font-size:0.92rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeBenCatHtml(b.male_head_name || '—')}</div>
                                <div style="font-size:0.72rem; color:var(--text-muted); display:flex; align-items:center; gap:0.35rem; margin-top:0.1rem;">
                                    <span class="fam-code-badge" style="font-size:0.66rem; padding:0.08rem 0.35rem;">${escapeBenCatHtml(b.application_number || '—')}</span>
                                    <span>${escapeBenCatHtml(b.nic_number || 'No NIC')}</span>
                                </div>
                            </div>
                        </div>
                        <span class="status-badge status-${b.status}">${statusLabel[b.status] || b.status}</span>
                    </div>

                    <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.75rem;">
                        ${catChip}
                        <span style="font-size:0.7rem; padding:0.15rem 0.5rem; border-radius:99px; background:var(--input-bg); border:1px solid var(--border-color); color:var(--text-muted); font-weight:600;">
                            <i data-lucide="baby" style="width:11px;height:11px;vertical-align:middle;"></i> ${childCount} ${childCount === 1 ? 'Child' : 'Children'}
                        </span>
                        ${typeof _buildBenRowHelpsBadgeHtml === 'function' ? _buildBenRowHelpsBadgeHtml(b) : ''}
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.65rem 0.75rem; border-radius:11px; background:var(--input-bg); border:1px solid var(--border-color); font-size:0.76rem;">
                        <div>
                            <div style="font-size:0.64rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Town &amp; Contact</div>
                            <div style="font-weight:700; color:var(--text-main); margin-top:0.1rem;">${escapeBenCatHtml(b.home_town || '—')}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${escapeBenCatHtml(b.contact_number || '—')}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:0.64rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Monthly Income</div>
                            <div style="font-weight:800; color:var(--text-main); margin-top:0.1rem;">${b.monthly_income != null && b.monthly_income !== '' ? 'LKR ' + Number(b.monthly_income).toLocaleString() : '—'}</div>
                            <div>${getIncomeTierHtml(b.monthly_income)}</div>
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.4rem; padding-top:0.65rem; border-top:1px dashed var(--border-color);">
                    <div style="display:flex; gap:0.32rem; flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline" style="padding:0.35rem 0.65rem; font-size:0.74rem;" onclick="viewBeneficiary(${b.id})">
                            <i data-lucide="eye" style="width:13px;height:13px;"></i> View
                        </button>
                        <button type="button" class="btn" style="padding:0.35rem 0.62rem; font-size:0.74rem; background:rgba(16,185,129,0.13); color:#059669; border:1px solid rgba(16,185,129,0.3); font-weight:700;" onclick="openBenHelpsTab(${b.id})" title="Helps &amp; Logs">
                            <i data-lucide="hand-helping" style="width:13px;height:13px;"></i> Helps
                        </button>
                        <button type="button" class="btn" style="padding:0.35rem 0.62rem; font-size:0.74rem; background:rgba(212,175,55,0.14); color:#b45309; border:1px solid rgba(212,175,55,0.35); font-weight:700;" onclick="openBeneficiaryHistoryModal(${b.id})" title="Full Aid &amp; Donation History">
                            <i data-lucide="history" style="width:13px;height:13px;"></i> History
                        </button>
                    </div>
                    <div style="display:flex; gap:0.3rem;">
                        <button type="button" class="btn" style="padding:0.35rem 0.5rem; background:linear-gradient(135deg,#0f172a,#1e293b); color:#f59e0b; border:1px solid rgba(212,175,55,0.4);" onclick="generateBenIdCard(${b.id})" title="PVC ID Card"><i data-lucide="id-card" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.35rem 0.5rem; background:var(--glow-bg);" onclick="editBeneficiary(${b.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.35rem 0.5rem; background:rgba(2,132,199,0.12); color:#0284c7;" onclick="printBeneficiaryReport(${b.id})" title="Print"><i data-lucide="printer" style="width:14px;height:14px;"></i></button>
                        <button type="button" class="btn" style="padding:0.35rem 0.5rem; background:rgba(239,68,68,0.12); color:#ef4444;" onclick="deleteBeneficiary(${b.id})" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    updateBenBulkBarUI();
    _renderBenPagination(totalFiltered, totalPages);
    if (window.lucide) lucide.createIcons();
}

function _renderBenPagination(total, totalPages) {
    const bar = document.getElementById('benPaginationBar');
    if (!bar) return;
    if (total === 0) { bar.innerHTML = ''; return; }

    const btnBase = `font-family:inherit; cursor:pointer; border:1px solid var(--border-color); border-radius:8px; padding:0.35rem 0.7rem; font-size:0.8rem; font-weight:500; transition:background 0.15s, color 0.15s;`;
    const btnActive = `${btnBase} background:var(--text-main); color:var(--bg-main); border-color:var(--text-main);`;
    const btnNormal = `${btnBase} background:var(--bg-card); color:var(--text-main);`;
    const btnDisabled = `${btnBase} background:var(--bg-card); color:var(--text-muted); cursor:default; opacity:0.5;`;

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
    if (window.lucide) lucide.createIcons();
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

async function viewBeneficiary(id, initialTab = 'vben-primary') {
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
        const targetTab = (initialTab && vm.querySelector(`[data-modal-tab="${initialTab}"]`)) ? initialTab : 'vben-primary';
        if (targetTab !== 'vben-primary') {
            vm.querySelector('[data-modal-tab="vben-primary"]')?.classList.remove('active');
            vm.querySelector(`[data-modal-tab="${targetTab}"]`)?.classList.add('active');
            document.getElementById(targetTab)?.classList.add('active');
        } else {
            document.getElementById('vben-primary')?.classList.add('active');
        }

        document.getElementById('editFromViewBenBtn').onclick = () => {
            closeModal('viewBeneficiaryModal');
            editBeneficiary(id);
        };
        document.getElementById('idCardFromViewBenBtn').onclick = () => generateBenIdCard(b);
        const historyBtn = document.getElementById('historyFromViewBenBtn');
        if (historyBtn) historyBtn.onclick = () => openBeneficiaryHistoryModal(b.id);
        const addHelpBtn = document.getElementById('addHelpFromViewBenBtn');
        if (addHelpBtn) addHelpBtn.onclick = () => openBeneficiaryHelpModal(null, b.id);
        const smsBenBtn = document.getElementById('smsFromViewBenBtn');
        if (smsBenBtn) smsBenBtn.onclick = () => { closeModal('viewBeneficiaryModal'); if (typeof openSmsForBeneficiary === 'function') openSmsForBeneficiary(b.id); };
        if (typeof renderVbenHelpsTab === 'function') renderVbenHelpsTab(b);

        openModal('viewBeneficiaryModal');
        lucide.createIcons();
    } catch (err) { console.error('viewBeneficiary error:', err); showToast('Failed to load beneficiary details', 'error'); }
}
// ── Beneficiary Premium PVC Identity Card Studio (CR-80 ISO/IEC 7810) ──────────
let _benPvcCurrentBen  = null;
let _benPvcTheme       = localStorage.getItem('edf-ben-pvc-theme') || 'white-emerald';
let _benPvcLayoutStyle = localStorage.getItem('edf-ben-pvc-style') || 'band';
let _benPvcViewMode    = 'dual';
let _benPvcPrintFmt    = 'a4';
let _benPvcShowChip    = true;
let _benPvcShowCrops   = true;
let _benPvcZoom        = 100;
let _benPvcActiveTab   = 'design';

let _benPvcFeatures = {
    chip:      true,
    seal:      true,
    guilloche: true,
    watermark: true,
    magstripe: true,
    barcode:   true,
    signature: true
};

let _benPvcCustomData = {};

function _escapePvcHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _getBenPvcSavedDefaults() {
    let orgName = 'EDUCATIONAL DEVELOPMENT FOUNDATION';
    try {
        const savedOrg = JSON.parse(localStorage.getItem('edf-org-settings') || '{}');
        if (savedOrg.org_name && savedOrg.org_name.length > 3) orgName = savedOrg.org_name.toUpperCase();
    } catch (_) {}

    let savedTpl = {};
    try {
        savedTpl = JSON.parse(localStorage.getItem('edf-ben-pvc-template-defaults') || '{}') || {};
    } catch (_) {}

    return {
        orgTitle:      savedTpl.orgTitle      || orgName,
        orgSub1:       savedTpl.orgSub1       || 'GALGAMUWA • SRI LANKA',
        orgSub2:       savedTpl.orgSub2       || 'BENEFICIARY PRIVILEGE CARD',
        holderLabel:   savedTpl.holderLabel   || 'CARDHOLDER / HEAD OF HOUSEHOLD',
        validThru:     savedTpl.validThru     || 'LIFETIME / ANNUAL AUDIT',
        sealText:      savedTpl.sealText      || 'EDF HOLOGRAM',
        magTitle:      savedTpl.magTitle      || 'EDF OFFICIAL WELFARE VERIFICATION • ISO/IEC 7810 CR-80',
        qrCaption:     savedTpl.qrCaption     || 'SCAN TO VERIFY',
        sigScript:     savedTpl.sigScript     || 'EDF Welfare Secretariat',
        sigTitle:      savedTpl.sigTitle      || 'GENERAL SECRETARY • EDF GALGAMUWA',
        returnNotice:  savedTpl.returnNotice  || 'Property of Educational Development Foundation (EDF). Present card with NIC at distributions.',
        returnContact: savedTpl.returnContact || 'info@edf.org'
    };
}

function _initBenPvcCustomDataFromBen(b) {
    if (!b) return;
    const fmt = v => (v != null && String(v).trim() !== '') ? String(v).trim() : '—';
    const fmtDate = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const tpl = _getBenPvcSavedDefaults();
    const appNum = b.application_number || ('EDF-BEN-' + String(b.id || 1).padStart(5, '0'));
    const issueDate = b.created_at
        ? new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const kidsArr = [
        ...(b.study || []),
        ...(b.dropout || []),
        ...(b.university || []),
        ...(b.abroad || []),
        ...(b.other || [])
    ];
    const kidsCount = kidsArr.length || Number(b.children_total_count || 0) || 0;
    const headCount = 1 + (b.female_head_name ? 1 : 0) + kidsCount;
    const householdLabel = headCount > 1 ? `${headCount} Members` : (b.contact_number || '1 Member');

    const statusToneMap = {
        Active:     { label: 'VERIFIED ACTIVE', tone: 'emerald' },
        pending:    { label: 'PENDING REVIEW',  tone: 'amber' },
        deactivate: { label: 'ON HOLD',         tone: 'blue' },
        rejected:   { label: 'INACTIVE',        tone: 'rose' }
    };
    const st = statusToneMap[b.status] || { label: String(b.status || 'VERIFIED ACTIVE').toUpperCase(), tone: 'emerald' };

    const dobDisplay = fmtDate(b.male_head_dob) + (b.male_head_age ? ` (${b.male_head_age}Y)` : '');

    _benPvcCustomData = {
        holderName:    fmt(b.male_head_name),
        holderLabel:   tpl.holderLabel,
        appNo:         appNum,
        roleTag:       'PRIMARY HEAD',
        statusText:    st.label,
        statusTone:    st.tone,
        photoUrl:      b.photo_url || '',
        f1Lbl:         'NIC / IDENTITY NO',
        f1Val:         fmt(b.nic_number),
        f2Lbl:         'WELFARE CATEGORY',
        f2Val:         fmt(b.category),
        f3Lbl:         'HOME TOWN / ZONE',
        f3Val:         fmt(b.home_town),
        f4Lbl:         'HOUSEHOLD UNIT',
        f4Val:         householdLabel,
        issueDate:     issueDate,
        validThru:     tpl.validThru,
        sealText:      tpl.sealText,
        b1Lbl:         'EMERGENCY / CONTACT',
        b1Val:         fmt(b.contact_number),
        b2Lbl:         'DATE OF BIRTH',
        b2Val:         dobDisplay,
        b3Lbl:         'SPOUSE / SECONDARY',
        b3Val:         fmt(b.female_head_name || b.guardian_if_divorced),
        b4Lbl:         'OCCUPATION',
        b4Val:         fmt(b.male_head_occupation),
        addrLbl:       'REGISTERED RESIDENTIAL ADDRESS',
        addrVal:       fmt(b.male_head_address || b.home_town),
        qrCaption:     tpl.qrCaption,
        sigScript:     tpl.sigScript,
        sigTitle:      tpl.sigTitle,
        orgTitle:      tpl.orgTitle,
        orgSub1:       tpl.orgSub1,
        orgSub2:       tpl.orgSub2,
        magTitle:      tpl.magTitle,
        returnNotice:  tpl.returnNotice,
        returnContact: tpl.returnContact
    };

    _syncBenPvcCustomizerInputs();
}

function _syncBenPvcCustomizerInputs() {
    const d = _benPvcCustomData || {};
    const map = {
        pvcCustHolderName:    d.holderName,
        pvcCustHolderLabel:   d.holderLabel,
        pvcCustAppNo:         d.appNo,
        pvcCustRoleTag:       d.roleTag,
        pvcCustStatusText:    d.statusText,
        pvcCustStatusColor:   d.statusTone || 'emerald',
        pvcCustF1Lbl:         d.f1Lbl,
        pvcCustF1Val:         d.f1Val,
        pvcCustF2Lbl:         d.f2Lbl,
        pvcCustF2Val:         d.f2Val,
        pvcCustF3Lbl:         d.f3Lbl,
        pvcCustF3Val:         d.f3Val,
        pvcCustF4Lbl:         d.f4Lbl,
        pvcCustF4Val:         d.f4Val,
        pvcCustIssueDate:     d.issueDate,
        pvcCustValidThru:     d.validThru,
        pvcCustSealText:      d.sealText,
        pvcCustB1Lbl:         d.b1Lbl,
        pvcCustB1Val:         d.b1Val,
        pvcCustB2Lbl:         d.b2Lbl,
        pvcCustB2Val:         d.b2Val,
        pvcCustB3Lbl:         d.b3Lbl,
        pvcCustB3Val:         d.b3Val,
        pvcCustB4Lbl:         d.b4Lbl,
        pvcCustB4Val:         d.b4Val,
        pvcCustAddrLbl:       d.addrLbl,
        pvcCustAddrVal:       d.addrVal,
        pvcCustQrCaption:     d.qrCaption,
        pvcCustSigScript:     d.sigScript,
        pvcCustSigTitle:      d.sigTitle,
        pvcCustOrgTitle:      d.orgTitle,
        pvcCustOrgSub1:       d.orgSub1,
        pvcCustOrgSub2:       d.orgSub2,
        pvcCustMagTitle:      d.magTitle,
        pvcCustReturnNotice:  d.returnNotice,
        pvcCustReturnContact: d.returnContact
    };

    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    });

    const thumbEl = document.getElementById('pvcCustomPhotoPreview');
    if (thumbEl) {
        if (d.photoUrl) {
            thumbEl.innerHTML = `<img src="${_escapePvcHtml(d.photoUrl)}" alt="Portrait" onerror="this.remove()">`;
        } else {
            const initChar = String(d.holderName || 'B').trim().charAt(0).toUpperCase();
            thumbEl.innerHTML = `<span style="font-weight:900;font-size:0.95rem;color:var(--primary);">${_escapePvcHtml(initChar)}</span>`;
        }
    }
}

function onBenPvcCustomInput(key, value, syncInput = false) {
    if (!key) return;
    _benPvcCustomData[key] = value;
    if (syncInput) {
        _syncBenPvcCustomizerInputs();
    }
    _renderBenPvcStudioStage();
}

function applyBenPvcFrontGridPreset(preset) {
    const b = _benPvcCurrentBen || {};
    const fmt = v => (v != null && String(v).trim() !== '') ? String(v).trim() : '—';
    const fmtDate = d => {
        if (!d) return '—';
        const dt = new Date(d);
        return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const kidsCount = [
        ...(b.study || []), ...(b.dropout || []), ...(b.university || []), ...(b.abroad || []), ...(b.other || [])
    ].length || Number(b.children_total_count || 0) || 0;
    const headCount = 1 + (b.female_head_name ? 1 : 0) + kidsCount;
    const householdLabel = headCount > 1 ? `${headCount} Members` : '1 Member';

    if (preset === 'standard') {
        _benPvcCustomData.f1Lbl = 'NIC / IDENTITY NO';
        _benPvcCustomData.f1Val = fmt(b.nic_number);
        _benPvcCustomData.f2Lbl = 'WELFARE CATEGORY';
        _benPvcCustomData.f2Val = fmt(b.category);
        _benPvcCustomData.f3Lbl = 'HOME TOWN / ZONE';
        _benPvcCustomData.f3Val = fmt(b.home_town);
        _benPvcCustomData.f4Lbl = 'HOUSEHOLD UNIT';
        _benPvcCustomData.f4Val = householdLabel;
    } else if (preset === 'medical') {
        _benPvcCustomData.f1Lbl = 'EMERGENCY CONTACT';
        _benPvcCustomData.f1Val = fmt(b.contact_number);
        _benPvcCustomData.f2Lbl = 'HEALTH / MEDICAL';
        _benPvcCustomData.f2Val = fmt(b.health_condition || b.disability_details || 'General Care');
        _benPvcCustomData.f3Lbl = 'AGE / DOB';
        _benPvcCustomData.f3Val = b.male_head_age ? `${b.male_head_age} Years` : fmtDate(b.male_head_dob);
        _benPvcCustomData.f4Lbl = 'HOME TOWN / ZONE';
        _benPvcCustomData.f4Val = fmt(b.home_town);
    } else if (preset === 'welfare') {
        _benPvcCustomData.f1Lbl = 'CONTACT PHONE';
        _benPvcCustomData.f1Val = fmt(b.contact_number);
        _benPvcCustomData.f2Lbl = 'WELFARE CATEGORY';
        _benPvcCustomData.f2Val = fmt(b.category);
        _benPvcCustomData.f3Lbl = 'MONTHLY INCOME';
        _benPvcCustomData.f3Val = b.monthly_income ? `LKR ${Number(b.monthly_income).toLocaleString()}` : 'Verified';
        _benPvcCustomData.f4Lbl = 'HOUSEHOLD UNIT';
        _benPvcCustomData.f4Val = householdLabel;
    } else if (preset === 'identity') {
        _benPvcCustomData.f1Lbl = 'NIC / IDENTITY NO';
        _benPvcCustomData.f1Val = fmt(b.nic_number);
        _benPvcCustomData.f2Lbl = 'CONTACT PHONE';
        _benPvcCustomData.f2Val = fmt(b.contact_number);
        _benPvcCustomData.f3Lbl = 'DATE OF BIRTH';
        _benPvcCustomData.f3Val = fmtDate(b.male_head_dob);
        _benPvcCustomData.f4Lbl = 'OCCUPATION';
        _benPvcCustomData.f4Val = fmt(b.male_head_occupation);
    }

    _syncBenPvcCustomizerInputs();
    _renderBenPvcStudioStage();
    showToast(`Applied "${preset.toUpperCase()}" front-face field layout`, 'success');
}

function handleBenPvcCustomPhotoUpload(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (PNG, JPG, WEBP)', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
        if (evt.target && evt.target.result) {
            _benPvcCustomData.photoUrl = evt.target.result;
            _syncBenPvcCustomizerInputs();
            _renderBenPvcStudioStage();
            showToast('Custom cardholder portrait photo applied', 'success');
        }
    };
    reader.readAsDataURL(file);
    inputEl.value = '';
}

function clearBenPvcCustomPhoto() {
    _benPvcCustomData.photoUrl = '';
    _syncBenPvcCustomizerInputs();
    _renderBenPvcStudioStage();
    showToast('Switched to official EDF initials avatar', 'info');
}

function resetBenPvcCustomData(notify = false) {
    if (!_benPvcCurrentBen) return;
    _initBenPvcCustomDataFromBen(_benPvcCurrentBen);
    _renderBenPvcStudioStage();
    if (notify) {
        showToast('Card details reset to beneficiary database record', 'info');
    }
}

function saveBenPvcTemplateDefaults() {
    const d = _benPvcCustomData || {};
    const toSave = {
        orgTitle:      d.orgTitle,
        orgSub1:       d.orgSub1,
        orgSub2:       d.orgSub2,
        holderLabel:   d.holderLabel,
        validThru:     d.validThru,
        sealText:      d.sealText,
        magTitle:      d.magTitle,
        qrCaption:     d.qrCaption,
        sigScript:     d.sigScript,
        sigTitle:      d.sigTitle,
        returnNotice:  d.returnNotice,
        returnContact: d.returnContact
    };
    try {
        localStorage.setItem('edf-ben-pvc-template-defaults', JSON.stringify(toSave));
        showToast('Organization branding & signatory defaults saved for all cards', 'success');
    } catch (e) {
        showToast('Unable to save template defaults to browser storage', 'error');
    }
}

function switchBenPvcSidebarTab(tabId) {
    _benPvcActiveTab = tabId || 'design';
    document.querySelectorAll('#benIdCardModal .pvc-sidebar-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-pvc-tab') === _benPvcActiveTab);
    });
    document.querySelectorAll('#benIdCardModal .pvc-tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `pvcTabPane-${_benPvcActiveTab}`);
    });
    if (window.lucide) window.lucide.createIcons();
}

function setBenPvcZoom(delta) {
    if (delta === 0) {
        _benPvcZoom = 100;
    } else {
        _benPvcZoom = Math.max(75, Math.min(130, _benPvcZoom + delta));
    }
    const lbl = document.getElementById('pvcZoomValLabel');
    if (lbl) lbl.textContent = `${_benPvcZoom}%`;
    const showcase = document.getElementById('pvcCardsShowcase');
    if (showcase) {
        if (_benPvcZoom === 100) {
            showcase.style.transform = '';
            showcase.style.transformOrigin = '';
        } else {
            showcase.style.transform = `scale(${(_benPvcZoom / 100).toFixed(2)})`;
            showcase.style.transformOrigin = 'top center';
        }
    }
}

function _updateBenPvcSwitcherLabel() {
    const list = (typeof currentBeneficiaries !== 'undefined' && Array.isArray(currentBeneficiaries)) ? currentBeneficiaries : [];
    const lbl = document.getElementById('pvcBenSwitcherLabel');
    if (!lbl) return;
    if (!list.length || !_benPvcCurrentBen) {
        lbl.textContent = _benPvcCurrentBen ? `ID #${_benPvcCurrentBen.id || 1}` : 'Member';
        return;
    }
    const idx = list.findIndex(x => String(x.id) === String(_benPvcCurrentBen.id));
    if (idx >= 0) {
        lbl.textContent = `Member ${idx + 1} / ${list.length}`;
    } else {
        lbl.textContent = `ID #${_benPvcCurrentBen.id || 1}`;
    }
}

async function switchBenPvcBeneficiary(dir = 1) {
    const list = (typeof currentBeneficiaries !== 'undefined' && Array.isArray(currentBeneficiaries)) ? currentBeneficiaries : [];
    if (!list.length || !_benPvcCurrentBen) {
        showToast('No additional beneficiaries in the current list', 'info');
        return;
    }
    const idx = list.findIndex(x => String(x.id) === String(_benPvcCurrentBen.id));
    const nextIdx = idx < 0 ? 0 : (idx + dir + list.length) % list.length;
    const nextBen = list[nextIdx];
    if (nextBen && nextBen.id) {
        await generateBenIdCard(nextBen.id);
    }
}

function toggleBenPvcFeature(featureKey, checked) {
    if (!featureKey) return;
    _benPvcFeatures[featureKey] = !!checked;
    if (featureKey === 'chip') {
        _benPvcShowChip = !!checked;
    }
    _renderBenPvcStudioStage();
}

const _CODE128_PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
];

function _generateCode128BarcodeSvg(seedStr, height = 28) {
    const text = String(seedStr || 'EDF-BEN-0001').trim();

    // 1. Preferred: ISO/IEC 15417 Code 128 rendering via JsBarcode
    if (typeof JsBarcode !== 'undefined' && typeof document !== 'undefined') {
        try {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            JsBarcode(svg, text, {
                format: "CODE128",
                width: 1.5,
                height: height,
                displayValue: false,
                margin: 8,
                background: "#ffffff",
                lineColor: "#0f172a"
            });
            svg.setAttribute("style", "width:100%;height:100%;display:block;");
            svg.setAttribute("preserveAspectRatio", "none");
            return svg.outerHTML;
        } catch (err) {
            console.warn('JsBarcode SVG error:', err);
        }
    }

    // 2. Pure ISO/IEC 15417 Code-128B fallback with mandatory 10-module quiet zones
    const START_B = 104;
    const STOP = 106;
    const codes = [START_B];
    let checksum = START_B;

    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const val = (code >= 32 && code <= 126) ? (code - 32) : 0;
        codes.push(val);
        checksum += val * (i + 1);
    }
    codes.push(checksum % 103);
    codes.push(STOP);

    const quietModules = 10;
    let currentX = quietModules;
    let rects = '';

    for (let cIdx = 0; cIdx < codes.length; cIdx++) {
        const pat = _CODE128_PATTERNS[codes[cIdx]] || _CODE128_PATTERNS[0];
        for (let pIdx = 0; pIdx < pat.length; pIdx++) {
            const w = parseInt(pat[pIdx], 10);
            if (pIdx % 2 === 0) {
                rects += `<rect x="${currentX}" y="0" width="${w}" height="${height}" fill="#0f172a"/>`;
            }
            currentX += w;
        }
    }

    const totalWidth = currentX + quietModules;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;background:#ffffff;"><rect width="${totalWidth}" height="${height}" fill="#ffffff"/>${rects}</svg>`;
}

function _getPvcGuillocheSvg() {
    return `<svg class="pvc-guilloche-svg" viewBox="0 0 444 280" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M-40 210 C 90 120, 220 290, 480 140" stroke="currentColor" stroke-width="0.9"/>
        <path d="M-40 220 C 95 130, 225 280, 480 150" stroke="currentColor" stroke-width="0.8"/>
        <path d="M-40 230 C 100 140, 230 270, 480 160" stroke="currentColor" stroke-width="0.7"/>
        <path d="M-40 240 C 105 150, 235 260, 480 170" stroke="currentColor" stroke-width="0.7"/>
        <path d="M-40 70 C 120 180, 290 -20, 480 110" stroke="currentColor" stroke-width="0.8"/>
        <path d="M-40 82 C 125 190, 295 -10, 480 122" stroke="currentColor" stroke-width="0.7"/>
        <circle cx="395" cy="215" r="78" stroke="currentColor" stroke-width="0.7" stroke-dasharray="3 3"/>
        <circle cx="395" cy="215" r="58" stroke="currentColor" stroke-width="0.6"/>
    </svg>`;
}

function _buildBenPvcCardsMarkup(b, theme = 'white-emerald', showChip = true, layoutStyle = 'band') {
    if (!_benPvcCustomData || !_benPvcCustomData.appNo) {
        _initBenPvcCustomDataFromBen(b || {});
    }
    const d = _benPvcCustomData;
    const esc = _escapePvcHtml;

    const appNum         = d.appNo || b.application_number || ('EDF-BEN-' + String(b.id || 1).padStart(5, '0'));
    const issueDate      = d.issueDate || '—';
    const validThru      = d.validThru || 'LIFETIME / ANNUAL AUDIT';
    const holderName     = d.holderName || b.male_head_name || '—';
    const holderLabel    = d.holderLabel || 'CARDHOLDER / HEAD OF HOUSEHOLD';
    const roleTag        = d.roleTag || 'PRIMARY HEAD';
    const orgName        = d.orgTitle || 'EDUCATIONAL DEVELOPMENT FOUNDATION';
    const orgSub1        = d.orgSub1 || 'GALGAMUWA • SRI LANKA';
    const orgSub2        = d.orgSub2 || 'BENEFICIARY PRIVILEGE CARD';
    const householdLabel = d.f4Val || '1 Member';

    const toneColors = {
        emerald: '#10b981',
        amber:   '#f59e0b',
        blue:    '#38bdf8',
        rose:    '#ef4444'
    };
    const st = {
        label: d.statusText || 'VERIFIED ACTIVE',
        color: toneColors[d.statusTone] || '#10b981'
    };

    // Security Verification Hash
    const rawHashSource = `${appNum}|${d.f1Val || b.nic_number || ''}|${b.id || 0}`;
    let hashNum = 2166136261 >>> 0;
    for (let i = 0; i < rawHashSource.length; i++) {
        hashNum = Math.imul(hashNum ^ rawHashSource.charCodeAt(i), 16777619) >>> 0;
    }
    const secHash = 'EDF-' + hashNum.toString(16).toUpperCase().padStart(8, '0').slice(0, 8);

    // Offline Vector QR + Barcode reflecting live customized fields
    const benNic = String(d.f1Val || b.nic_number || '').trim();
    // High-contrast, scannable QR payload: compact string ensures low matrix version with bold, readable modules on mobile cameras
    const qrPayload  = benNic
        ? `EDF-BEN|${appNum}|NIC:${benNic}`
        : `EDF-BEN|${appNum}|ID:${b.id || ''}`;
    const qrSvg      = _generateReceiptQrSvg(qrPayload, 76, '#0f172a', '#ffffff');
    const barcodeSvg = _generateCode128BarcodeSvg(appNum, 26);

    const initialChar = String(holderName || 'B').trim().charAt(0).toUpperCase() || 'B';
    const activePhotoUrl = d.photoUrl !== undefined ? d.photoUrl : (b.photo_url || '');
    const photoHtml = activePhotoUrl
        ? `<img src="${esc(activePhotoUrl)}" alt="Beneficiary Portrait" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <div class="pvc-photo-avatar" style="display:none;"><span class="initial">${esc(initialChar)}</span><span class="lbl">EDF Registry</span></div>`
        : `<div class="pvc-photo-avatar"><span class="initial">${esc(initialChar)}</span><span class="lbl">EDF Registry</span></div>`;

    const featureClasses = [
        (!showChip || !_benPvcFeatures.chip) ? 'hide-chip' : '',
        !_benPvcFeatures.seal      ? 'hide-seal' : '',
        !_benPvcFeatures.guilloche ? 'hide-guilloche' : '',
        !_benPvcFeatures.watermark ? 'hide-watermark' : '',
        !_benPvcFeatures.magstripe ? 'hide-magstripe' : '',
        !_benPvcFeatures.barcode   ? 'hide-barcode' : '',
        !_benPvcFeatures.signature ? 'hide-signature' : ''
    ].filter(Boolean).join(' ');

    const styleClass = `style-${layoutStyle || 'band'}`;
    const guilloche  = _getPvcGuillocheSvg();

    const frontHtml = `
    <div class="edf-pvc-card pvc-card-front theme-${esc(theme)} ${styleClass} ${featureClasses}">
        <div class="pvc-security-mesh"></div>
        ${guilloche}
        <div class="pvc-specular-sheen"></div>
        <img src="/uploads/logo/logo-1775982368852.svg" class="pvc-watermark-crest" alt="" onerror="this.style.display='none'">

        <!-- Header Authority Bar -->
        <div class="pvc-front-header">
            <div class="pvc-crest-ring">
                <img src="/uploads/logo/logo-1775982368852.svg" alt="EDF" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <span class="pvc-crest-fallback" style="display:none;">EDF</span>
            </div>
            <div class="pvc-org-lockup">
                <div class="pvc-org-title">${esc(orgName)}</div>
                <div class="pvc-org-sub">
                    <span>${esc(orgSub1)}</span>
                    <span>|</span>
                    <span>${esc(orgSub2)}</span>
                </div>
            </div>
            <div class="pvc-tier-badge">
                <span class="pvc-status-led" style="background:${st.color};color:${st.color};"></span>
                <span>${esc(st.label)}</span>
            </div>
        </div>

        <!-- Metallic Security Ribbon -->
        <div class="pvc-metallic-ribbon"></div>

        <!-- Main Identity Core -->
        <div class="pvc-front-body">
            <!-- Left Portrait Column -->
            <div class="pvc-photo-col">
                <div class="pvc-photo-bezel">
                    <div class="pvc-photo-inner">
                        ${photoHtml}
                    </div>
                </div>
                <div class="pvc-role-tag">${esc(roleTag)}</div>
            </div>

            <!-- Right Cardholder Data Column -->
            <div class="pvc-identity-col">
                <div class="pvc-name-chip-row">
                    <div style="min-width:0;flex:1;">
                        <div class="pvc-holder-lbl">${esc(holderLabel)}</div>
                        <div class="pvc-holder-name" title="${esc(holderName)}">${esc(holderName)}</div>
                    </div>
                    <div class="pvc-smart-chip-group">
                        <div class="pvc-emv-chip" title="EMV Security Smart Chip"></div>
                        <svg class="pvc-nfc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                            <path d="M6 8.5a6.5 6.5 0 0 1 0 7"/>
                            <path d="M10 6a10 10 0 0 1 0 12"/>
                            <path d="M14 3.5a13.5 13.5 0 0 1 0 17"/>
                        </svg>
                    </div>
                </div>

                <!-- Laser-Engraved Serial Strip -->
                <div class="pvc-serial-strip">
                    <span class="pvc-serial-lbl">REGISTRY ID NO</span>
                    <span class="pvc-serial-code">${esc(appNum)}</span>
                </div>

                <!-- 2x2 Key Welfare Particulars Grid -->
                <div class="pvc-front-meta-grid">
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.f1Lbl || 'NIC / IDENTITY NO')}</div>
                        <div class="pvc-meta-val mono">${esc(d.f1Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.f2Lbl || 'WELFARE CATEGORY')}</div>
                        <div class="pvc-meta-val">${esc(d.f2Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.f3Lbl || 'HOME TOWN / ZONE')}</div>
                        <div class="pvc-meta-val">${esc(d.f3Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.f4Lbl || 'HOUSEHOLD UNIT')}</div>
                        <div class="pvc-meta-val">${esc(d.f4Val || '—')}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Security Footer -->
        <div class="pvc-front-footer">
            <div class="pvc-footer-dates">
                <span>ISSUED: <strong>${esc(issueDate)}</strong></span>
                <span>&bull;</span>
                <span>TENURE: <strong>${esc(validThru)}</strong></span>
            </div>
            <div class="pvc-hologram-seal">
                <span>&#10022; ${esc(d.sealText || 'EDF HOLOGRAM')} &bull; ${secHash.slice(-4)}</span>
            </div>
        </div>
    </div>`;

    const backHtml = `
    <div class="edf-pvc-card pvc-card-back theme-${esc(theme)} ${styleClass} ${featureClasses}">
        <div class="pvc-security-mesh"></div>
        ${guilloche}
        <div class="pvc-specular-sheen"></div>

        <!-- Top Magnetic / Security Stripe -->
        <div class="pvc-back-magstripe">
            <span class="pvc-mag-left">${esc(d.magTitle || 'EDF OFFICIAL WELFARE VERIFICATION • ISO/IEC 7810 CR-80')}</span>
            <span class="pvc-mag-right">HASH: ${secHash}</span>
        </div>

        <!-- Main Reverse Body -->
        <div class="pvc-back-body">
            <!-- Left QR Verification Pod -->
            <div class="pvc-qr-pod">
                <div class="pvc-qr-box">${qrSvg}</div>
                <div class="pvc-qr-caption">${esc(d.qrCaption || 'SCAN TO VERIFY')}<br><span style="font-family:monospace;font-size:6px;color:#475569;">${esc(appNum)}</span></div>
            </div>

            <!-- Right Household & Signature Particulars -->
            <div class="pvc-back-details-col">
                <div class="pvc-back-grid">
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.b1Lbl || 'EMERGENCY / CONTACT')}</div>
                        <div class="pvc-meta-val mono">${esc(d.b1Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.b2Lbl || 'DATE OF BIRTH')}</div>
                        <div class="pvc-meta-val">${esc(d.b2Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.b3Lbl || 'SPOUSE / SECONDARY')}</div>
                        <div class="pvc-meta-val">${esc(d.b3Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell">
                        <div class="pvc-meta-lbl">${esc(d.b4Lbl || 'OCCUPATION')}</div>
                        <div class="pvc-meta-val">${esc(d.b4Val || '—')}</div>
                    </div>
                    <div class="pvc-meta-cell pvc-back-cell full">
                        <div class="pvc-meta-lbl">${esc(d.addrLbl || 'REGISTERED RESIDENTIAL ADDRESS')}</div>
                        <div class="pvc-meta-val" style="white-space:normal;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${esc(d.addrVal || '—')}</div>
                    </div>
                </div>

                <!-- Signature Panel + Code-128 Barcode -->
                <div class="pvc-sig-barcode-row">
                    <div class="pvc-signature-strip">
                        <div class="pvc-sig-top">
                            <span>AUTHORIZED SIGNATORY</span>
                            <span style="font-family:monospace;color:#0f172a;">CVV ${String(hashNum).slice(0, 3)}</span>
                        </div>
                        <div class="pvc-sig-script">${esc(d.sigScript || 'EDF Welfare Secretariat')}</div>
                        <div style="font-size:5.5px;color:#475569;font-weight:700;letter-spacing:0.05em;">${esc(d.sigTitle || 'GENERAL SECRETARY • EDF GALGAMUWA')}</div>
                    </div>
                    <div class="pvc-barcode-pod">
                        <div class="pvc-barcode-svg-wrap">${barcodeSvg}</div>
                        <div class="pvc-barcode-txt">${esc(appNum)}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Property & Return Notice -->
        <div class="pvc-back-footer">
            <span>${esc(d.returnNotice || 'Property of Educational Development Foundation (EDF). Present card with NIC at distributions.')}</span>
            <span style="font-family:monospace;font-weight:800;opacity:0.95;flex-shrink:0;">${esc(d.returnContact || 'info@edf.org')}</span>
        </div>
    </div>`;

    return { frontHtml, backHtml, appNum, issueDate, secHash, householdLabel, st, orgName };
}

function _renderBenPvcStudioStage() {
    if (!_benPvcCurrentBen) return;
    const { frontHtml, backHtml, appNum } = _buildBenPvcCardsMarkup(_benPvcCurrentBen, _benPvcTheme, _benPvcShowChip, _benPvcLayoutStyle);

    const frontMount   = document.getElementById('pvcFrontMount');
    const backMount    = document.getElementById('pvcBackMount');
    const back3dMount  = document.getElementById('pvc3dBackMount');
    const subTitleEl   = document.getElementById('pvcStudioSubtitle');

    if (frontMount)  frontMount.innerHTML  = frontHtml;
    if (backMount)   backMount.innerHTML   = backHtml;
    if (back3dMount) back3dMount.innerHTML = backHtml;
    if (subTitleEl) {
        const displayName = (_benPvcCustomData && _benPvcCustomData.holderName) || _benPvcCurrentBen.male_head_name || '—';
        subTitleEl.innerHTML = `Cardholder: <strong>${_escapePvcHtml(displayName)}</strong> &bull; Registry ID: <span style="font-family:monospace;font-weight:700;">${_escapePvcHtml(appNum)}</span> &bull; CR-80 Standard (85.60mm &times; 53.98mm)`;
    }

    // Sync active theme button
    document.querySelectorAll('#benIdCardModal .pvc-swatch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-pvc-theme') === _benPvcTheme);
    });

    // Sync active architectural layout style button
    document.querySelectorAll('#benIdCardModal [data-pvc-style]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-pvc-style') === _benPvcLayoutStyle);
    });

    // Sync crop frames
    ['pvcCropFront', 'pvcCropBack'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('show-crops', _benPvcShowCrops);
    });

    _updateBenPvcSwitcherLabel();
    _updatePvcQuickActionButtons();
}

async function generateBenIdCard(bOrId) {
    try {
        let b = bOrId;
        if (typeof bOrId === 'number' || typeof bOrId === 'string') {
            // Fetch full beneficiary record so children & secondary details are complete
            const res = await fetch(`/api/edf/beneficiaries/${bOrId}`);
            if (res.ok) {
                b = await res.json();
            } else {
                b = (typeof currentBeneficiaries !== 'undefined' ? currentBeneficiaries.find(x => String(x.id) === String(bOrId)) : null);
            }
        }
        if (!b || typeof b !== 'object') {
            showToast('Unable to load beneficiary data for ID card', 'error');
            return;
        }

        _benPvcCurrentBen = b;
        _initBenPvcCustomDataFromBen(b);

        const flipper = document.getElementById('pvc3dFlipper');
        if (flipper) flipper.classList.remove('is-flipped');

        _renderBenPvcStudioStage();
        setBenPvcViewMode(_benPvcViewMode);
        setBenPvcPrintFormat(_benPvcPrintFmt);
        openModal('benIdCardModal');
        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error('generateBenIdCard error:', err);
        showToast('Failed to open PVC ID Card Studio', 'error');
    }
}

function setBenPvcTheme(theme) {
    _benPvcTheme = theme || 'white-emerald';
    try { localStorage.setItem('edf-ben-pvc-theme', _benPvcTheme); } catch (_) {}
    _renderBenPvcStudioStage();
}

function setBenPvcLayoutStyle(style) {
    _benPvcLayoutStyle = style || 'band';
    try { localStorage.setItem('edf-ben-pvc-style', _benPvcLayoutStyle); } catch (_) {}
    _renderBenPvcStudioStage();
}

function setBenPvcViewMode(mode) {
    const validModes = ['dual', 'front', 'back', '3d'];
    _benPvcViewMode = validModes.includes(mode) ? mode : 'dual';

    const showcase  = document.getElementById('pvcCardsShowcase');
    const frontSlot = document.getElementById('pvcFrontSlotWrap');
    const backSlot  = document.getElementById('pvcBackSlotWrap');
    const dualBtn   = document.getElementById('pvcViewDualBtn');
    const frontBtn  = document.getElementById('pvcViewFrontBtn');
    const backBtn   = document.getElementById('pvcViewBackBtn');
    const btn3d     = document.getElementById('pvcView3dBtn');
    const flipBtn   = document.getElementById('pvcFlipCardBtn');
    const flipper   = document.getElementById('pvc3dFlipper');
    const badgeLbl  = document.getElementById('pvcFrontBadgeLabel');

    if (showcase) showcase.classList.toggle('mode-3d', _benPvcViewMode === '3d');
    if (dualBtn)  dualBtn.classList.toggle('active', _benPvcViewMode === 'dual');
    if (frontBtn) frontBtn.classList.toggle('active', _benPvcViewMode === 'front');
    if (backBtn)  backBtn.classList.toggle('active', _benPvcViewMode === 'back');
    if (btn3d)    btn3d.classList.toggle('active', _benPvcViewMode === '3d');
    if (flipBtn)  flipBtn.style.display = _benPvcViewMode === '3d' ? 'inline-flex' : 'none';

    if (frontSlot) {
        frontSlot.style.display = (_benPvcViewMode === 'back') ? 'none' : 'flex';
    }
    if (backSlot) {
        backSlot.style.display = (_benPvcViewMode === 'dual' || _benPvcViewMode === 'back') ? 'flex' : 'none';
    }

    if (_benPvcViewMode !== '3d') {
        if (flipper) flipper.classList.remove('is-flipped');
        if (badgeLbl) badgeLbl.innerHTML = `<span class="dot"></span><span>FRONT FACE &mdash; PRIMARY IDENTITY &amp; CHIP</span>`;
    } else {
        const isFlipped = flipper && flipper.classList.contains('is-flipped');
        if (badgeLbl) {
            badgeLbl.innerHTML = isFlipped
                ? `<span class="dot" style="background:#10b981;"></span><span>3D INTERACTIVE &mdash; REVERSE FACE (CLICK CARD TO FLIP)</span>`
                : `<span class="dot"></span><span>3D INTERACTIVE &mdash; FRONT FACE (CLICK CARD TO FLIP)</span>`;
        }
    }
    _updatePvcQuickActionButtons();
}

function flipBenPvcCard() {
    const flipper  = document.getElementById('pvc3dFlipper');
    const badgeLbl = document.getElementById('pvcFrontBadgeLabel');
    if (!flipper) return;
    const isFlipped = flipper.classList.toggle('is-flipped');
    if (badgeLbl && _benPvcViewMode === '3d') {
        badgeLbl.innerHTML = isFlipped
            ? `<span class="dot" style="background:#10b981;"></span><span>3D INTERACTIVE &mdash; REVERSE FACE (CLICK CARD TO FLIP)</span>`
            : `<span class="dot"></span><span>3D INTERACTIVE &mdash; FRONT FACE (CLICK CARD TO FLIP)</span>`;
    }
    _updatePvcQuickActionButtons();
}

function setBenPvcPrintFormat(fmt) {
    _benPvcPrintFmt = fmt === 'cr80' ? 'cr80' : 'a4';
    const a4Btn   = document.getElementById('pvcFmtA4Btn');
    const cr80Btn = document.getElementById('pvcFmtCr80Btn');
    const lbl     = document.getElementById('pvcPrimaryPrintBtnLabel');
    if (a4Btn)   a4Btn.classList.toggle('active', _benPvcPrintFmt === 'a4');
    if (cr80Btn) cr80Btn.classList.toggle('active', _benPvcPrintFmt === 'cr80');
    if (lbl)     lbl.textContent = _benPvcPrintFmt === 'cr80' ? 'Print CR-80 Card' : 'Print A4 PVC Sheet';
}

function toggleBenPvcChip(checked) {
    _benPvcShowChip = !!checked;
    _benPvcFeatures.chip = !!checked;
    _renderBenPvcStudioStage();
}

function toggleBenPvcCrops(checked) {
    _benPvcShowCrops = !!checked;
    ['pvcCropFront', 'pvcCropBack'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('show-crops', _benPvcShowCrops);
    });
}

function _buildBenPvcPrintableDocument(b, fmt = 'a4', autoPrint = false) {
    const { frontHtml, backHtml, appNum, issueDate, secHash, householdLabel, st, orgName } =
        _buildBenPvcCardsMarkup(b, _benPvcTheme, _benPvcShowChip, _benPvcLayoutStyle);

    const fmtVal = v => (v != null && String(v).trim() !== '') ? String(v).trim() : '—';
    const isCr80 = fmt === 'cr80';

    const pageRules = isCr80
        ? `@page { size: 85.6mm 54mm; margin: 0mm; }
           html, body { margin: 0; padding: 0; width: 85.6mm; background: #fff; }
           .print-toolbar, .a4-sheet-header, .a4-issuance-slip, .a4-cut-guide { display: none !important; }
           .print-sheet { padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; background: transparent !important; }
           .pvc-print-pair { display: block !important; }
           .pvc-print-slot { page-break-after: always; break-after: page; margin: 0 !important; padding: 0 !important; }
           .pvc-print-slot:last-child { page-break-after: auto; break-after: auto; }
           .pvc-crop-box::before, .pvc-crop-box::after, .pvc-crop-box .c-bl, .pvc-crop-box .c-br { display: none !important; }
           .edf-pvc-card { width: 85.6mm !important; height: 54mm !important; border-radius: 0 !important; box-shadow: none !important; }`
        : `@page { size: A4 portrait; margin: 12mm 14mm; }
           @media print {
               html, body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; }
               .print-toolbar { display: none !important; }
               .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; }
               .edf-pvc-card { box-shadow: none !important; border: 0.3mm solid rgba(148,163,184,0.45); }
           }`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EDF Beneficiary PVC ID Card — ${appNum}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
        font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
        background: #f1f5f9;
        color: #0f172a;
        padding: ${isCr80 ? '0' : '24px'};
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .print-toolbar {
        width: 100%;
        max-width: 210mm;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 18px;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    }
    .print-toolbar button {
        background: linear-gradient(135deg, #d97706, #f59e0b);
        color: #0f172a;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 800;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
    }
    .print-sheet {
        width: 100%;
        max-width: 210mm;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        padding: 14mm 12mm;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    .a4-sheet-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding-bottom: 12px;
        border-bottom: 2px solid #0f172a;
        margin-bottom: 18px;
    }
    .a4-hdr-title { font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: 0.03em; text-transform: uppercase; }
    .a4-hdr-sub { font-size: 10px; color: #475569; font-weight: 600; margin-top: 2px; }
    .a4-hdr-badge {
        background: #0f172a;
        color: #fef08a;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.1em;
        padding: 4px 10px;
        border-radius: 6px;
        text-transform: uppercase;
    }

    /* Exact CR-80 Physical Print Pair (85.60mm x 53.98mm = 323.5px x 204px at 96dpi; we scale 444x280 by 0.7286 so typography stays razor-sharp!) */
    .pvc-print-pair {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8mm;
        margin: 6mm 0;
        flex-wrap: nowrap;
    }
    .pvc-print-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3mm;
    }
    .pvc-slot-caption {
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #475569;
    }
    .pvc-crop-box {
        position: relative;
        width: 85.6mm;
        height: 53.98mm;
    }
    ${_benPvcShowCrops ? `
    .pvc-crop-box::before, .pvc-crop-box::after, .pvc-crop-box .c-bl, .pvc-crop-box .c-br {
        content: '';
        position: absolute;
        width: 3.5mm;
        height: 3.5mm;
        border-color: #64748b;
        border-style: solid;
        pointer-events: none;
        z-index: 10;
    }
    .pvc-crop-box::before { top: -2mm; left: -2mm; border-width: 0.35mm 0 0 0.35mm; }
    .pvc-crop-box::after  { top: -2mm; right: -2mm; border-width: 0.35mm 0.35mm 0 0; }
    .pvc-crop-box .c-bl   { bottom: -2mm; left: -2mm; border-width: 0 0 0.35mm 0.35mm; }
    .pvc-crop-box .c-br   { bottom: -2mm; right: -2mm; border-width: 0 0.35mm 0.35mm 0; }
    ` : ''}

    /* Scale the 444x280 studio card to exact 85.6mm x 53.98mm physical CR80 box */
    .pvc-scale-wrap {
        width: 85.6mm;
        height: 53.98mm;
        position: relative;
        overflow: hidden;
        border-radius: 3.18mm;
    }
    .pvc-scale-wrap > .edf-pvc-card {
        width: 444px !important;
        height: 280px !important;
        transform: scale(0.72865);
        transform-origin: top left;
        border-radius: 16px !important;
        box-shadow: none !important;
    }

    .a4-cut-guide {
        text-align: center;
        font-size: 8.5px;
        color: #64748b;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 4mm 0 7mm;
        padding: 5px;
        border-top: 1px dashed #cbd5e1;
        border-bottom: 1px dashed #cbd5e1;
    }

    /* Official Card Issuance Counterfoil Slip on A4 */
    .a4-issuance-slip {
        margin-top: 6mm;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        padding: 12px 16px;
        background: #f8fafc;
    }
    .slip-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #334155;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 6px;
        margin-bottom: 10px;
    }
    .slip-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        font-size: 9.5px;
        margin-bottom: 14px;
    }
    .slip-lbl { font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .slip-val { font-size: 10px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .slip-signs {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 18px;
        padding-top: 14px;
        border-top: 1px dashed #cbd5e1;
        text-align: center;
        font-size: 8.5px;
        font-weight: 700;
        color: #475569;
    }
    .slip-sign-line { border-bottom: 1px solid #475569; height: 22px; margin-bottom: 4px; }

    /* Include Studio Card CSS rules for print fidelity across all 9 themes & 3 layout styles */
    .edf-pvc-card { position: relative; overflow: hidden; color: #ffffff; display: flex; flex-direction: column; justify-content: space-between; }
    .edf-pvc-card.theme-white-emerald {
        background: radial-gradient(ellipse 75% 60% at 92% 92%, rgba(16, 185, 129, 0.08) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #f8fafc 60%, #f0fdf4 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #022c22 0%, #065f46 58%, #059669 100%);
        --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #fde68a;
        --pvc-accent-grad: linear-gradient(90deg, #059669 0%, #34d399 30%, #f59e0b 65%, #047857 100%);
        --pvc-accent-solid: #065f46; --pvc-accent-soft: #ecfdf5; --pvc-accent-border: #6ee7b7;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #a7f3d0; --pvc-footer-bg: #064e3b; --pvc-footer-text: #ecfdf5;
        --pvc-mag-bg: linear-gradient(90deg, #022c22 0%, #065f46 50%, #047857 100%);
    }
    .edf-pvc-card.theme-white-royal {
        background: radial-gradient(ellipse 75% 60% at 92% 92%, rgba(37, 99, 235, 0.08) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #f8fafc 60%, #eff6ff 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #2563eb 100%);
        --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #fde68a;
        --pvc-accent-grad: linear-gradient(90deg, #1d4ed8 0%, #38bdf8 35%, #f59e0b 70%, #1e3a8a 100%);
        --pvc-accent-solid: #1e3a8a; --pvc-accent-soft: #eff6ff; --pvc-accent-border: #93c5fd;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #bfdbfe; --pvc-footer-bg: #1e3a8a; --pvc-footer-text: #e0f2fe;
        --pvc-mag-bg: linear-gradient(90deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%);
    }
    .edf-pvc-card.theme-ivory-gold {
        background: radial-gradient(ellipse 80% 60% at 88% 12%, rgba(212, 175, 55, 0.12) 0%, transparent 55%), linear-gradient(145deg, #ffffff 0%, #fafaf9 65%, #fefce8 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #ffffff 0%, #fef9c3 100%);
        --pvc-hdr-title: #0f172a; --pvc-hdr-sub: #92400e;
        --pvc-accent-grad: linear-gradient(90deg, #b45309 0%, #f59e0b 32%, #d97706 70%, #78350f 100%);
        --pvc-accent-solid: #92400e; --pvc-accent-soft: #fffbeb; --pvc-accent-border: #f59e0b;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #fcd34d; --pvc-footer-bg: #fef3c7; --pvc-footer-text: #0f172a;
        --pvc-mag-bg: linear-gradient(90deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%);
    }
    .edf-pvc-card.theme-white-teal {
        background: radial-gradient(ellipse 75% 60% at 92% 92%, rgba(13, 148, 136, 0.09) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #f8fafc 60%, #f0fdfa 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #0284c7 100%);
        --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #99f6e4;
        --pvc-accent-grad: linear-gradient(90deg, #0d9488 0%, #2dd4bf 35%, #38bdf8 70%, #0f766e 100%);
        --pvc-accent-solid: #115e59; --pvc-accent-soft: #f0fdfa; --pvc-accent-border: #5eead4;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #99f6e4; --pvc-footer-bg: #115e59; --pvc-footer-text: #ccfbf1;
        --pvc-mag-bg: linear-gradient(90deg, #134e4a 0%, #0f766e 55%, #0284c7 100%);
    }
    .edf-pvc-card.theme-white-crimson {
        background: radial-gradient(ellipse 75% 60% at 92% 92%, rgba(225, 29, 72, 0.07) 0%, transparent 60%), linear-gradient(145deg, #ffffff 0%, #f8fafc 60%, #fff1f2 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #4c0519 0%, #881337 52%, #be123c 100%);
        --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #fde68a;
        --pvc-accent-grad: linear-gradient(90deg, #9f1239 0%, #fb7185 32%, #f59e0b 68%, #881337 100%);
        --pvc-accent-solid: #881337; --pvc-accent-soft: #fff1f2; --pvc-accent-border: #fda4af;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #fecdd3; --pvc-footer-bg: #4c0519; --pvc-footer-text: #ffe4e6;
        --pvc-mag-bg: linear-gradient(90deg, #4c0519 0%, #881337 55%, #be123c 100%);
    }
    .edf-pvc-card.theme-pearl {
        background: radial-gradient(ellipse 80% 60% at 15% 15%, rgba(212, 175, 55, 0.1) 0%, transparent 55%), linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f1f5f9 100%);
        color: #0f172a;
        --pvc-hdr-bg: linear-gradient(135deg, #0f172a 0%, #1e293b 65%, #334155 100%);
        --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #fde68a;
        --pvc-accent-grad: linear-gradient(90deg, #0f172a 0%, #1e293b 40%, #b45309 72%, #059669 100%);
        --pvc-accent-solid: #0f172a; --pvc-accent-soft: #f1f5f9; --pvc-accent-border: #94a3b8;
        --pvc-text-primary: #0f172a; --pvc-text-secondary: #1e293b; --pvc-text-muted: #334155;
        --pvc-panel-bg: #ffffff; --pvc-panel-border: #cbd5e1; --pvc-footer-bg: #0f172a; --pvc-footer-text: #f8fafc;
        --pvc-mag-bg: linear-gradient(90deg, #020617 0%, #1e293b 55%, #0f172a 100%);
    }
    .edf-pvc-card.theme-obsidian {
        background: radial-gradient(ellipse 85% 65% at 18% 12%, rgba(212, 175, 55, 0.18) 0%, transparent 55%), radial-gradient(ellipse 75% 60% at 88% 88%, rgba(16, 185, 129, 0.14) 0%, transparent 55%), linear-gradient(135deg, #070b14 0%, #0f172a 46%, #172036 78%, #090d16 100%);
        --pvc-hdr-bg: transparent; --pvc-hdr-title: #ffffff; --pvc-hdr-sub: rgba(250,204,21,0.92);
        --pvc-accent-grad: linear-gradient(90deg, #b38728 0%, #fbf5b7 28%, #d4af37 52%, #fcf6ba 76%, #aa771c 100%);
        --pvc-accent-solid: #eab308; --pvc-accent-soft: rgba(234, 179, 8, 0.16); --pvc-accent-border: rgba(250, 204, 21, 0.42);
        --pvc-text-primary: #ffffff; --pvc-text-secondary: #e2e8f0; --pvc-text-muted: rgba(203, 213, 225, 0.78);
        --pvc-panel-bg: rgba(15, 23, 42, 0.56); --pvc-panel-border: rgba(255, 255, 255, 0.13); --pvc-footer-bg: rgba(4, 7, 15, 0.72); --pvc-footer-text: rgba(255,255,255,0.85);
        --pvc-mag-bg: linear-gradient(180deg, #020617 0%, #1e293b 48%, #090d16 100%);
    }
    .edf-pvc-card.theme-emerald {
        background: radial-gradient(ellipse 85% 65% at 15% 15%, rgba(250, 204, 21, 0.16) 0%, transparent 55%), radial-gradient(ellipse 75% 60% at 88% 88%, rgba(52, 211, 153, 0.18) 0%, transparent 55%), linear-gradient(135deg, #021a13 0%, #064e3b 48%, #065f46 78%, #022c22 100%);
        --pvc-hdr-bg: transparent; --pvc-hdr-title: #ffffff; --pvc-hdr-sub: rgba(250,204,21,0.92);
        --pvc-accent-grad: linear-gradient(90deg, #b38728 0%, #fef08a 30%, #10b981 55%, #fde68a 80%, #ca8a04 100%);
        --pvc-accent-solid: #34d399; --pvc-accent-soft: rgba(52, 211, 153, 0.16); --pvc-accent-border: rgba(110, 231, 183, 0.42);
        --pvc-text-primary: #ffffff; --pvc-text-secondary: #ecfdf5; --pvc-text-muted: rgba(209, 250, 229, 0.78);
        --pvc-panel-bg: rgba(2, 44, 34, 0.55); --pvc-panel-border: rgba(255, 255, 255, 0.14); --pvc-footer-bg: rgba(1, 24, 18, 0.76); --pvc-footer-text: rgba(255,255,255,0.85);
        --pvc-mag-bg: linear-gradient(180deg, #021a13 0%, #064e3b 48%, #022c22 100%);
    }
    .edf-pvc-card.theme-sapphire {
        background: radial-gradient(ellipse 85% 65% at 20% 15%, rgba(96, 165, 250, 0.2) 0%, transparent 55%), radial-gradient(ellipse 75% 60% at 85% 85%, rgba(167, 139, 250, 0.18) 0%, transparent 55%), linear-gradient(135deg, #090d24 0%, #1e1b4b 45%, #1d4ed8 82%, #0f172a 100%);
        --pvc-hdr-bg: transparent; --pvc-hdr-title: #ffffff; --pvc-hdr-sub: #bae6fd;
        --pvc-accent-grad: linear-gradient(90deg, #94a3b8 0%, #f8fafc 30%, #38bdf8 55%, #e2e8f0 80%, #64748b 100%);
        --pvc-accent-solid: #38bdf8; --pvc-accent-soft: rgba(56, 189, 248, 0.16); --pvc-accent-border: rgba(125, 211, 252, 0.42);
        --pvc-text-primary: #ffffff; --pvc-text-secondary: #e0f2fe; --pvc-text-muted: rgba(224, 242, 254, 0.78);
        --pvc-panel-bg: rgba(15, 23, 42, 0.55); --pvc-panel-border: rgba(255, 255, 255, 0.15); --pvc-footer-bg: rgba(7, 10, 29, 0.76); --pvc-footer-text: rgba(255,255,255,0.85);
        --pvc-mag-bg: linear-gradient(180deg, #090d24 0%, #1e1b4b 48%, #0f172a 100%);
    }
    .edf-pvc-card[class*="theme-white-"], .edf-pvc-card.theme-ivory-gold, .edf-pvc-card.theme-pearl, .edf-pvc-card.style-minimal {
        color: #0f172a !important;
        --pvc-text-primary: #0f172a !important;
        --pvc-text-secondary: #1e293b !important;
        --pvc-text-muted: #334155 !important;
    }
    .edf-pvc-card.style-minimal {
        background: linear-gradient(145deg, #ffffff 0%, #f8fafc 70%, #f1f5f9 100%) !important;
        --pvc-panel-bg: #ffffff !important; --pvc-panel-border: #cbd5e1 !important;
        --pvc-accent-soft: #f1f5f9 !important; --pvc-accent-border: #94a3b8 !important;
    }
    .edf-pvc-card.style-minimal.theme-obsidian, .edf-pvc-card.style-minimal.theme-emerald, .edf-pvc-card.style-minimal.theme-sapphire {
        --pvc-accent-solid: #0f172a !important;
    }
    .pvc-security-mesh { position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.22; }
    .pvc-guilloche-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.16; }
    .edf-pvc-card[class*="theme-white-"] .pvc-guilloche-svg, .edf-pvc-card.theme-ivory-gold .pvc-guilloche-svg, .edf-pvc-card.theme-pearl .pvc-guilloche-svg, .edf-pvc-card.style-minimal .pvc-guilloche-svg { opacity: 0.09; color: var(--pvc-accent-solid); }
    .pvc-specular-sheen { position: absolute; inset: 0; background: linear-gradient(118deg, transparent 22%, rgba(255,255,255,0.08) 38%, transparent 62%); pointer-events: none; z-index: 1; }
    .pvc-watermark-crest { position: absolute; right: -18px; bottom: 14px; width: 150px; height: 150px; opacity: 0.045; pointer-events: none; z-index: 0; filter: grayscale(1) brightness(2); }
    .edf-pvc-card[class*="theme-white-"] .pvc-watermark-crest, .edf-pvc-card.theme-ivory-gold .pvc-watermark-crest, .edf-pvc-card.theme-pearl .pvc-watermark-crest, .edf-pvc-card.style-minimal .pvc-watermark-crest { opacity: 0.055; filter: grayscale(0.2); }
    .pvc-front-header { position: relative; z-index: 2; display: flex; align-items: center; gap: 9px; padding: 11px 15px 8px; background: var(--pvc-hdr-bg, transparent); }
    .pvc-crest-ring { width: 34px; height: 34px; border-radius: 10px; background: #ffffff; border: 1.5px solid rgba(250,204,21,0.75); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 2px; }
    .pvc-crest-ring img { width: 100%; height: 100%; object-fit: contain; }
    .pvc-crest-fallback { font-size: 11px; font-weight: 900; color: #0f172a; }
    .pvc-org-lockup { flex: 1; min-width: 0; }
    .pvc-org-title { font-size: 10.2px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pvc-hdr-title, #ffffff); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pvc-org-sub { font-size: 7.2px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pvc-hdr-sub, rgba(250,204,21,0.9)); margin-top: 1.5px; display: flex; align-items: center; gap: 4px; }
    .pvc-tier-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 99px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.32); font-size: 7px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; flex-shrink: 0; }
    .edf-pvc-card.theme-ivory-gold .pvc-org-title, .edf-pvc-card.style-minimal .pvc-org-title { color: #0f172a !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-org-sub, .edf-pvc-card.style-minimal .pvc-org-sub { color: var(--pvc-accent-solid, #1e293b) !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-tier-badge, .edf-pvc-card.style-minimal .pvc-tier-badge { background: var(--pvc-accent-soft, #f1f5f9) !important; border-color: var(--pvc-accent-border, #cbd5e1) !important; color: #0f172a !important; }
    .pvc-status-led { width: 6px; height: 6px; border-radius: 50%; }
    .pvc-metallic-ribbon { position: relative; z-index: 2; height: 3.5px; background: var(--pvc-accent-grad); }
    .edf-pvc-card.style-wave .pvc-front-header { padding-bottom: 11px; clip-path: polygon(0 0, 100% 0, 100% 82%, 66% 100%, 0 100%); }
    .edf-pvc-card.style-wave .pvc-metallic-ribbon { height: 4px; margin-top: -2px; }
    .edf-pvc-card.style-wave .pvc-front-meta-grid { background: transparent; border: none; padding: 0; gap: 5px 8px; }
    .edf-pvc-card.style-wave .pvc-meta-cell { background: var(--pvc-panel-bg); border: 1px solid var(--pvc-panel-border); border-left: 3px solid var(--pvc-accent-solid); border-radius: 6px; padding: 3.5px 7px; }
    .edf-pvc-card.style-wave .pvc-photo-bezel { border-radius: 14px 4px 14px 4px; }
    .edf-pvc-card.style-wave .pvc-photo-inner { border-radius: 12px 2px 12px 2px; }
    .edf-pvc-card.style-sovereign::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 7px; background: var(--pvc-accent-grad); z-index: 6; }
    .edf-pvc-card.style-sovereign .pvc-front-header { padding-left: 19px; border-bottom: 1.5px solid var(--pvc-accent-border); }
    .edf-pvc-card.style-sovereign .pvc-metallic-ribbon { height: 2px; margin-left: 7px; }
    .edf-pvc-card.style-sovereign .pvc-front-body, .edf-pvc-card.style-sovereign .pvc-front-footer, .edf-pvc-card.style-sovereign .pvc-back-footer, .edf-pvc-card.style-sovereign .pvc-back-body, .edf-pvc-card.style-sovereign .pvc-back-magstripe { padding-left: 19px; }
    .edf-pvc-card.style-sovereign .pvc-serial-strip { background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%) !important; border: 1px solid var(--pvc-accent-solid) !important; }
    .edf-pvc-card.style-sovereign .pvc-serial-lbl { color: rgba(255,255,255,0.78) !important; }
    .edf-pvc-card.style-sovereign .pvc-serial-code { color: #fde047 !important; }
    .edf-pvc-card.style-sovereign .pvc-front-meta-grid { background: transparent; border: none; padding: 0; gap: 4px 7px; }
    .edf-pvc-card.style-sovereign .pvc-meta-cell { background: var(--pvc-panel-bg); border: 1px solid var(--pvc-panel-border); border-top: 2px solid var(--pvc-accent-solid); border-radius: 5px; padding: 3px 6px; }
    .edf-pvc-card.style-minimal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: var(--pvc-accent-grad); z-index: 5; }
    .edf-pvc-card.style-minimal .pvc-front-header { background: #ffffff !important; padding-top: 13px; border-bottom: 1px solid #e2e8f0; }
    .edf-pvc-card.style-minimal .pvc-metallic-ribbon { height: 1.5px; opacity: 0.55; }
    .pvc-front-body { position: relative; z-index: 2; flex: 1; display: flex; align-items: stretch; gap: 13px; padding: 11px 15px 8px; }
    .pvc-photo-col { display: flex; flex-direction: column; align-items: center; gap: 5px; flex-shrink: 0; }
    .pvc-photo-bezel { width: 84px; height: 102px; border-radius: 10px; padding: 2px; background: var(--pvc-accent-grad); }
    .pvc-photo-inner { width: 100%; height: 100%; border-radius: 8px; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center; }
    .pvc-photo-inner img { width: 100%; height: 100%; object-fit: cover; }
    .pvc-photo-avatar { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; color: #fff; background: #0f172a; }
    .pvc-photo-avatar span.initial { font-size: 28px; font-weight: 900; color: #fde047; }
    .pvc-photo-avatar span.lbl { font-size: 6px; font-weight: 700; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-top: 3px; }
    .pvc-role-tag { font-size: 6.5px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; background: var(--pvc-accent-soft); border: 1px solid var(--pvc-accent-border); color: var(--pvc-text-primary); }
    .pvc-identity-col { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
    .pvc-name-chip-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .pvc-holder-lbl { font-size: 6.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--pvc-text-muted); margin-bottom: 1px; }
    .pvc-holder-name { font-size: 13.5px; font-weight: 900; color: var(--pvc-text-primary); line-height: 1.15; }
    .pvc-smart-chip-group { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .pvc-emv-chip { width: 34px; height: 25px; border-radius: 5px; background: linear-gradient(135deg, #d4af37 0%, #fef08a 35%, #b45309 70%, #fde047 100%); border: 1px solid rgba(120,53,15,0.55); position: relative; }
    .pvc-emv-chip::before { content: ''; position: absolute; inset: 3px; border: 1px solid rgba(120,53,15,0.45); border-radius: 3px; }
    .pvc-nfc-icon { width: 13px; height: 13px; opacity: 0.72; color: var(--pvc-text-secondary); }
    .pvc-serial-strip { display: flex; align-items: center; justify-content: space-between; padding: 3.5px 8px; border-radius: 6px; background: var(--pvc-panel-bg); border: 1px solid var(--pvc-panel-border); margin: 4px 0; }
    .edf-pvc-card[class*="theme-white-"] .pvc-serial-strip, .edf-pvc-card.theme-ivory-gold .pvc-serial-strip, .edf-pvc-card.theme-pearl .pvc-serial-strip, .edf-pvc-card.style-minimal .pvc-serial-strip { background: var(--pvc-accent-soft); border-color: var(--pvc-accent-border); }
    .pvc-serial-lbl { font-size: 6.2px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pvc-text-muted); }
    .pvc-serial-code { font-family: 'Courier New', Consolas, monospace; font-size: 11px; font-weight: 900; letter-spacing: 0.08em; color: var(--pvc-accent-solid, #0f172a); }
    .pvc-front-meta-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 5px 10px; background: var(--pvc-panel-bg); border: 1px solid var(--pvc-panel-border); border-radius: 8px; padding: 6px 9px; }
    .pvc-meta-cell { min-width: 0; }
    .pvc-meta-lbl { font-size: 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--pvc-text-muted); }
    .pvc-meta-val { font-size: 9px; font-weight: 800; color: var(--pvc-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
    .pvc-meta-val.mono { font-family: 'Courier New', Consolas, monospace; }
    .pvc-front-footer { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; background: var(--pvc-footer-bg); border-top: 1px solid rgba(255,255,255,0.1); font-size: 7px; color: var(--pvc-footer-text, rgba(255,255,255,0.85)); }
    .pvc-footer-dates { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .pvc-footer-dates strong { color: inherit; font-weight: 800; }
    .pvc-hologram-seal { display: inline-flex; align-items: center; gap: 4px; padding: 1.5px 7px; border-radius: 99px; background: rgba(250,204,21,0.2); border: 1px solid rgba(255,255,255,0.35); font-size: 6.2px; font-weight: 900; letter-spacing: 0.1em; color: #ffffff; }
    .edf-pvc-card.theme-ivory-gold .pvc-front-footer, .edf-pvc-card.style-minimal .pvc-front-footer { background: #f8fafc !important; color: #1e293b !important; border-top: 1px solid #cbd5e1 !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-footer-dates strong, .edf-pvc-card.style-minimal .pvc-footer-dates strong { color: #0f172a !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-hologram-seal, .edf-pvc-card.style-minimal .pvc-hologram-seal { color: #0f172a !important; border-color: var(--pvc-accent-border, #94a3b8) !important; background: var(--pvc-accent-soft, #e2e8f0) !important; }
    .pvc-back-magstripe { position: relative; z-index: 2; height: 28px; margin-top: 10px; background: var(--pvc-mag-bg, linear-gradient(180deg, #020617 0%, #1e293b 48%, #090d16 100%)); border-top: 1px solid rgba(255,255,255,0.12); border-bottom: 1.5px solid rgba(250,204,21,0.45); display: flex; align-items: center; justify-content: space-between; padding: 0 15px; }
    .pvc-mag-left { font-size: 6.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(250,204,21,0.95); }
    .pvc-mag-right { font-family: 'Courier New', Consolas, monospace; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.9); }
    .edf-pvc-card.theme-ivory-gold .pvc-back-magstripe, .edf-pvc-card.style-minimal .pvc-back-magstripe { background: #f1f5f9 !important; border-top: 1px solid #cbd5e1 !important; border-bottom: 1.5px solid var(--pvc-accent-border, #94a3b8) !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-mag-left, .edf-pvc-card.style-minimal .pvc-mag-left { color: #0f172a !important; }
    .edf-pvc-card.theme-ivory-gold .pvc-mag-right, .edf-pvc-card.style-minimal .pvc-mag-right { color: #1e293b !important; }
    .pvc-back-body { position: relative; z-index: 2; flex: 1; display: flex; align-items: stretch; gap: 12px; padding: 9px 15px 6px; }
    .pvc-qr-pod { width: 98px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ffffff; border-radius: 10px; padding: 5px; border: 1.5px solid var(--pvc-accent-border, rgba(212,175,55,0.6)); flex-shrink: 0; }
    .pvc-qr-box { width: 76px; height: 76px; display: flex; align-items: center; justify-content: center; }
    .pvc-qr-caption { font-size: 5.8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; margin-top: 3px; text-align: center; line-height: 1.1; }
    .pvc-back-details-col { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 5px; }
    .pvc-back-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; background: var(--pvc-panel-bg); border: 1px solid var(--pvc-panel-border); border-radius: 8px; padding: 6px 9px; }
    .pvc-back-cell.full { grid-column: 1 / -1; border-top: 1px dashed var(--pvc-panel-border); padding-top: 3px; }
    .pvc-sig-barcode-row { display: flex; align-items: stretch; gap: 8px; }
    .pvc-signature-strip { flex: 1; background: repeating-linear-gradient(135deg, #f8fafc 0px, #f8fafc 4px, #f1f5f9 4px, #f1f5f9 8px); border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px 8px; display: flex; flex-direction: column; justify-content: space-between; }
    .pvc-sig-top { display: flex; align-items: center; justify-content: space-between; font-size: 5.8px; font-weight: 800; text-transform: uppercase; color: #334155; }
    .pvc-sig-script { font-family: Georgia, serif; font-style: italic; font-size: 11px; font-weight: 700; color: #1e3a8a; line-height: 1.1; }
    .pvc-barcode-pod { width: 112px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px 6px 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
    .pvc-barcode-svg-wrap { width: 100%; height: 20px; overflow: hidden; }
    .pvc-barcode-txt { font-family: 'Courier New', Consolas, monospace; font-size: 6px; font-weight: 800; letter-spacing: 0.08em; color: #0f172a; margin-top: 1px; }
    .pvc-back-footer { position: relative; z-index: 2; padding: 4.5px 15px; background: var(--pvc-footer-bg); border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 6.2px; color: var(--pvc-footer-text, rgba(255,255,255,0.85)); }
    .edf-pvc-card.theme-ivory-gold .pvc-back-footer, .edf-pvc-card.style-minimal .pvc-back-footer { background: #f8fafc !important; color: #1e293b !important; border-top: 1px solid #cbd5e1 !important; }
    .edf-pvc-card.hide-chip .pvc-smart-chip-group { display: none !important; }
    .edf-pvc-card.hide-seal .pvc-hologram-seal { display: none !important; }
    .edf-pvc-card.hide-guilloche .pvc-guilloche-svg, .edf-pvc-card.hide-guilloche .pvc-security-mesh { display: none !important; }
    .edf-pvc-card.hide-watermark .pvc-watermark-crest { display: none !important; }
    .edf-pvc-card.hide-magstripe .pvc-back-magstripe { display: none !important; }
    .edf-pvc-card.hide-barcode .pvc-barcode-pod { display: none !important; }
    .edf-pvc-card.hide-signature .pvc-signature-strip { display: none !important; }

    ${pageRules}
</style>
</head>
<body>
    <div class="print-toolbar">
        <div>
            <div style="font-weight:800;font-size:13px;">EDF Beneficiary PVC ID Card &mdash; ${appNum}</div>
            <div style="font-size:11px;color:#94a3b8;">Exact ISO/IEC 7810 CR-80 Standard (85.60mm &times; 53.98mm) &bull; Set Printer Scale to 100% (Actual Size)</div>
        </div>
        <button onclick="window.print()">Print PVC Card Now</button>
    </div>

    <div class="print-sheet">
        <div class="a4-sheet-header">
            <div>
                <div class="a4-hdr-title">${orgName}</div>
                <div class="a4-hdr-sub">Official CR-80 PVC Beneficiary Identity Card Production Sheet &bull; Galgamuwa, Sri Lanka</div>
            </div>
            <div class="a4-hdr-badge">CR-80 PVC SPEC &bull; ${appNum}</div>
        </div>

        <div class="pvc-print-pair">
            <div class="pvc-print-slot">
                <div class="pvc-slot-caption">FRONT FACE (85.6mm &times; 54.0mm)</div>
                <div class="pvc-crop-box">
                    <span class="c-bl"></span><span class="c-br"></span>
                    <div class="pvc-scale-wrap">${frontHtml}</div>
                </div>
            </div>

            <div class="pvc-print-slot">
                <div class="pvc-slot-caption">REVERSE FACE (85.6mm &times; 54.0mm)</div>
                <div class="pvc-crop-box">
                    <span class="c-bl"></span><span class="c-br"></span>
                    <div class="pvc-scale-wrap">${backHtml}</div>
                </div>
            </div>
        </div>

        <div class="a4-cut-guide">
            &#9986; Trim along outer corner crop marks (85.60mm &times; 53.98mm), align Front &amp; Reverse faces back-to-back, and thermal-laminate in CR-80 PVC pouch
        </div>

        <div class="a4-issuance-slip">
            <div class="slip-hdr">
                <span>OFFICIAL BENEFICIARY PVC CARD ISSUANCE &amp; ACKNOWLEDGEMENT RECORD</span>
                <span style="font-family:monospace;">HASH: ${secHash}</span>
            </div>
            <div class="slip-grid">
                <div>
                    <div class="slip-lbl">Cardholder Full Name</div>
                    <div class="slip-val">${fmtVal(b.male_head_name)}</div>
                </div>
                <div>
                    <div class="slip-lbl">Registry / Application No</div>
                    <div class="slip-val" style="font-family:monospace;">${appNum}</div>
                </div>
                <div>
                    <div class="slip-lbl">NIC / Identity No</div>
                    <div class="slip-val" style="font-family:monospace;">${fmtVal(b.nic_number)}</div>
                </div>
                <div>
                    <div class="slip-lbl">Welfare Category &amp; Status</div>
                    <div class="slip-val">${fmtVal(b.category)} (${st.label})</div>
                </div>
                <div>
                    <div class="slip-lbl">Home Town / Zone</div>
                    <div class="slip-val">${fmtVal(b.home_town)}</div>
                </div>
                <div>
                    <div class="slip-lbl">Contact Phone</div>
                    <div class="slip-val">${fmtVal(b.contact_number)}</div>
                </div>
                <div>
                    <div class="slip-lbl">Household Unit</div>
                    <div class="slip-val">${householdLabel}</div>
                </div>
                <div>
                    <div class="slip-lbl">Date of Card Issue</div>
                    <div class="slip-val">${issueDate}</div>
                </div>
            </div>
            <div class="slip-signs">
                <div>
                    <div class="slip-sign-line"></div>
                    <div>Beneficiary Signature / Thumbprint</div>
                </div>
                <div>
                    <div class="slip-sign-line"></div>
                    <div>Issuing Welfare Officer</div>
                </div>
                <div>
                    <div class="slip-sign-line"></div>
                    <div>Authorized Secretariat Seal &amp; Sign</div>
                </div>
            </div>
        </div>
    </div>
    ${autoPrint ? `<script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 250); };<\/script>` : ''}
</body>
</html>`;
}

function printBenPvcCard(overrideFmt = null) {
    if (!_benPvcCurrentBen) return;
    if (overrideFmt === 'a4' || overrideFmt === 'cr80') {
        setBenPvcPrintFormat(overrideFmt);
    }
    const fmt = _benPvcPrintFmt;
    const html = _buildBenPvcPrintableDocument(_benPvcCurrentBen, fmt, false);

    let printFrame = document.getElementById('edfBenPvcPrintFrame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'edfBenPvcPrintFrame';
        printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow || printFrame.contentDocument;
    const doc = frameDoc.document || frameDoc;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 220);
}

function openBenPvcStandaloneWindow() {
    if (!_benPvcCurrentBen) return;
    const html = _buildBenPvcPrintableDocument(_benPvcCurrentBen, _benPvcPrintFmt, false);
    const win = window.open('', '_blank');
    if (!win) {
        showToast('Pop-up blocked — use "Print PVC Card Sheet" for direct printing', 'error');
        return;
    }
    win.document.write(html);
    win.document.close();
}

// ── Beneficiary CR-80 PVC High-Quality Image Exporter (600 DPI) ───────────────
let _benPvcCachedLogoSvg = null;

async function _getBenPvcLogoSvg() {
    if (_benPvcCachedLogoSvg) return _benPvcCachedLogoSvg;
    try {
        const res = await fetch('/uploads/logo/logo-1775982368852.svg');
        if (res.ok) {
            _benPvcCachedLogoSvg = await res.text();
            return _benPvcCachedLogoSvg;
        }
    } catch (_) {}
    return null;
}

async function _ensureHtml2Canvas() {
    if (typeof window.html2canvas === 'function') {
        return window.html2canvas;
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/vendor/html2canvas.min.js';
        script.onload = () => {
            if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
            else reject(new Error('html2canvas failed to initialize'));
        };
        script.onerror = () => {
            const cdn = document.createElement('script');
            cdn.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            cdn.onload = () => {
                if (typeof window.html2canvas === 'function') resolve(window.html2canvas);
                else reject(new Error('Failed to load html2canvas from CDN'));
            };
            cdn.onerror = () => reject(new Error('Network error: Unable to load html2canvas library'));
            document.head.appendChild(cdn);
        };
        document.head.appendChild(script);
    });
}

function _triggerFileDownload(blobOrUrl, filename) {
    const isBlob = blobOrUrl instanceof Blob;
    const url = isBlob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (isBlob) {
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
}

async function _preparePvcCardForCapture(cardElement) {
    // 1. Remove preview shadows, transforms and margins for a pristine print cut
    cardElement.style.boxShadow = 'none';
    cardElement.style.transform = 'none';
    cardElement.style.margin = '0';

    // 2. Inline the official EDF logo SVG so html2canvas renders vectors with razor sharpness
    const logoSvg = await _getBenPvcLogoSvg();
    if (logoSvg) {
        cardElement.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            if (src.includes('logo-1775982368852.svg')) {
                const span = document.createElement('span');
                span.className = img.className;
                span.innerHTML = logoSvg;
                const innerSvg = span.querySelector('svg');
                if (innerSvg) {
                    innerSvg.style.width = '100%';
                    innerSvg.style.height = '100%';
                    innerSvg.style.display = 'block';
                    if (img.classList.contains('pvc-watermark-crest')) {
                        innerSvg.style.opacity = 'inherit';
                    }
                }
                img.replaceWith(span);
            }
        });
    }

    // 3. For cardholder portrait, ensure cross-origin is anonymous and image is decoded
    const images = Array.from(cardElement.querySelectorAll('img'));
    await Promise.all(images.map(img => {
        img.crossOrigin = 'anonymous';
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(res => {
            img.onload = res;
            img.onerror = () => {
                // If portrait failed to load, display the initials avatar fallback
                img.style.display = 'none';
                if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex';
                res();
            };
        });
    }));

    // 4. Await document fonts for razor-sharp typography
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (_) {}
    }
}

async function _renderPvcFaceToCanvas(faceType = 'front', options = {}) {
    if (!_benPvcCurrentBen) {
        throw new Error('No beneficiary record active');
    }

    const { frontHtml, backHtml } = _buildBenPvcCardsMarkup(
        _benPvcCurrentBen,
        _benPvcTheme,
        _benPvcShowChip,
        _benPvcLayoutStyle
    );

    // Create an isolated sandbox offscreen container
    const sandbox = document.createElement('div');
    sandbox.className = 'pvc-capture-sandbox';
    sandbox.style.cssText = 'position:fixed;left:-9999px;top:0;width:444px;height:280px;z-index:-99999;pointer-events:none;background:transparent;overflow:visible;';
    sandbox.innerHTML = faceType === 'front' ? frontHtml : backHtml;
    document.body.appendChild(sandbox);

    const card = sandbox.querySelector('.edf-pvc-card');
    if (!card) {
        sandbox.remove();
        throw new Error('Failed to find card element in sandbox');
    }

    await _preparePvcCardForCapture(card);

    const h2c = await _ensureHtml2Canvas();

    // Scale 4.554054 renders the 444px x 280px CSS card to exact 2022px x 1275px (600 DPI for CR-80: 85.60mm x 53.98mm)
    const scale = options.scale || 4.554054;

    const canvas = await h2c(card, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false
    });

    sandbox.remove();
    return canvas;
}

async function downloadBenPvcCardFace(faceType = 'front', format = 'png') {
    try {
        if (!_benPvcCurrentBen) {
            showToast('Please select a beneficiary first to generate PVC ID card', 'warning');
            return;
        }

        closeBenPvcDownloadMenu();

        const isFront = faceType === 'front';
        const faceName = isFront ? 'FRONT FACE' : 'REVERSE FACE';
        const ext = (format && (format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg')) ? 'jpg' : 'png';

        showToast(`Rendering high-resolution ${faceName} (${ext.toUpperCase()} 600 DPI)...`, 'info');

        const canvas = await _renderPvcFaceToCanvas(faceType, { scale: 4.554054 });

        const rawApp = (_benPvcCustomData && _benPvcCustomData.appNo) || _benPvcCurrentBen.application_number || ('EDF-BEN-' + String(_benPvcCurrentBen.id || 1).padStart(5, '0'));
        const rawName = (_benPvcCustomData && _benPvcCustomData.holderName) || _benPvcCurrentBen.male_head_name || 'beneficiary';
        const appNum = String(rawApp).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeName = String(rawName).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileTag = isFront ? 'FRONT_FACE' : 'REVERSE_FACE';
        const filename = `${appNum}_${safeName}_CR80_${fileTag}.${ext}`;

        if (ext === 'png') {
            canvas.toBlob(blob => {
                if (!blob) throw new Error('Canvas toBlob failed');
                _triggerFileDownload(blob, filename);
                showToast(`${faceName} downloaded in 600 DPI Ultra-HD (${ext.toUpperCase()})`, 'success');
            }, 'image/png');
        } else {
            // For JPG: composite with solid white background to prevent transparent corners turning black
            const jpgCanvas = document.createElement('canvas');
            jpgCanvas.width = canvas.width;
            jpgCanvas.height = canvas.height;
            const ctx = jpgCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
            ctx.drawImage(canvas, 0, 0);

            jpgCanvas.toBlob(blob => {
                if (!blob) throw new Error('Canvas toBlob failed');
                _triggerFileDownload(blob, filename);
                showToast(`${faceName} downloaded in 600 DPI Ultra-HD (${ext.toUpperCase()})`, 'success');
            }, 'image/jpeg', 0.98);
        }
    } catch (err) {
        console.error('downloadBenPvcCardFace error:', err);
        showToast('Failed to download ID card image: ' + (err.message || 'Render error'), 'error');
    }
}

async function downloadBenPvcBothFaces(format = 'png') {
    try {
        if (!_benPvcCurrentBen) {
            showToast('Please select a beneficiary first', 'warning');
            return;
        }
        closeBenPvcDownloadMenu();
        const ext = format.toLowerCase() === 'jpg' ? 'jpg' : 'png';
        showToast(`Preparing both FRONT & REVERSE faces (${ext.toUpperCase()} 600 DPI)...`, 'info');

        await downloadBenPvcCardFace('front', ext);
        await new Promise(r => setTimeout(r, 450));
        await downloadBenPvcCardFace('back', ext);
    } catch (err) {
        console.error('downloadBenPvcBothFaces error:', err);
        showToast('Failed to download both faces', 'error');
    }
}

async function downloadBenPvcSideBySide(format = 'png') {
    try {
        if (!_benPvcCurrentBen) {
            showToast('Please select a beneficiary first', 'warning');
            return;
        }
        closeBenPvcDownloadMenu();

        const ext = format.toLowerCase() === 'jpg' ? 'jpg' : 'png';
        showToast('Rendering Dual Side-by-Side CR-80 Production Sheet (600 DPI)...', 'info');

        const [frontCanvas, backCanvas] = await Promise.all([
            _renderPvcFaceToCanvas('front', { scale: 4.554054 }),
            _renderPvcFaceToCanvas('back', { scale: 4.554054 })
        ]);

        const cardW = frontCanvas.width;
        const cardH = frontCanvas.height;
        const gap = Math.round(50 * 4.554054);
        const padX = Math.round(40 * 4.554054);
        const topH = Math.round(90 * 4.554054);
        const botH = Math.round(50 * 4.554054);

        const sheetW = (padX * 2) + (cardW * 2) + gap;
        const sheetH = topH + cardH + botH;

        const sheet = document.createElement('canvas');
        sheet.width = sheetW;
        sheet.height = sheetH;
        const ctx = sheet.getContext('2d');

        // Crisp white presentation background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sheetW, sheetH);

        // Header lockup
        const appNum = String((_benPvcCustomData && _benPvcCustomData.appNo) || _benPvcCurrentBen.application_number || ('EDF-BEN-' + String(_benPvcCurrentBen.id || 1).padStart(5, '0')));
        const safeName = String((_benPvcCustomData && _benPvcCustomData.holderName) || _benPvcCurrentBen.male_head_name || 'beneficiary').trim();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold ' + Math.round(18 * 4.554) + 'px Inter, "Segoe UI", sans-serif';
        ctx.fillText('EDUCATIONAL DEVELOPMENT FOUNDATION — BENEFICIARY CR-80 PVC IDENTITY CARD', padX, Math.round(36 * 4.554));

        ctx.fillStyle = '#475569';
        ctx.font = '600 ' + Math.round(10.5 * 4.554) + 'px Inter, "Segoe UI", sans-serif';
        ctx.fillText(`Cardholder: ${safeName}  •  Registry ID: ${appNum}  •  CR-80 ISO/IEC 7810 Standard (85.60mm × 53.98mm)  •  Direct 600 DPI Master`, padX, Math.round(54 * 4.554));

        // Sub-captions above each face
        ctx.fillStyle = '#d97706';
        ctx.font = 'bold ' + Math.round(8.5 * 4.554) + 'px Inter, "Segoe UI", sans-serif';
        ctx.fillText('▲ FRONT FACE — PRIMARY IDENTITY & CHIP (85.6mm × 54.0mm)', padX, topH - Math.round(10 * 4.554));
        ctx.fillText('▲ REVERSE FACE — QR VERIFICATION & CODE-128 BARCODE (85.6mm × 54.0mm)', padX + cardW + gap, topH - Math.round(10 * 4.554));

        // Draw Front & Back Cards
        ctx.drawImage(frontCanvas, padX, topH);
        ctx.drawImage(backCanvas, padX + cardW + gap, topH);

        // Corner crop marks for precision cutting & laminating
        function drawCrop(x, y, isLeft, isTop) {
            const len = Math.round(8 * 4.554);
            const off = Math.round(4 * 4.554);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = Math.round(0.7 * 4.554);
            ctx.beginPath();
            const cx = isLeft ? (x - off) : (x + off);
            const cy = isTop ? (y - off) : (y + off);
            ctx.moveTo(cx, isTop ? (cy + len) : (cy - len));
            ctx.lineTo(cx, cy);
            ctx.lineTo(isLeft ? (cx + len) : (cx - len), cy);
            ctx.stroke();
        }

        [padX, padX + cardW + gap].forEach(slotX => {
            drawCrop(slotX, topH, true, true);
            drawCrop(slotX + cardW, topH, false, true);
            drawCrop(slotX, topH + cardH, true, false);
            drawCrop(slotX + cardW, topH + cardH, false, false);
        });

        // Bottom trimming guide
        ctx.fillStyle = '#64748b';
        ctx.font = '600 ' + Math.round(8 * 4.554) + 'px Inter, "Segoe UI", sans-serif';
        ctx.fillText('✂ Production Guide: Print at 100% (Actual Size). Trim along outer crop corners, align Front & Reverse back-to-back, and thermal-laminate in CR-80 PVC pouch.', padX, sheetH - Math.round(18 * 4.554));

        const filename = `${appNum.replace(/[^a-zA-Z0-9_-]/g, '_')}_${safeName.replace(/[^a-zA-Z0-9_-]/g, '_')}_CR80_DUAL_SHEET.${ext}`;

        if (ext === 'png') {
            sheet.toBlob(blob => {
                _triggerFileDownload(blob, filename);
                showToast('Dual Side-by-Side Sheet downloaded in 600 DPI (PNG)', 'success');
            }, 'image/png');
        } else {
            sheet.toBlob(blob => {
                _triggerFileDownload(blob, filename);
                showToast('Dual Side-by-Side Sheet downloaded in 600 DPI (JPG)', 'success');
            }, 'image/jpeg', 0.98);
        }
    } catch (err) {
        console.error('downloadBenPvcSideBySide error:', err);
        showToast('Failed to download side-by-side card sheet', 'error');
    }
}

function toggleBenPvcDownloadMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('pvcDownloadMenu');
    if (!menu) return;
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
    if (!isVisible && window.lucide) {
        window.lucide.createIcons();
    }
}

function closeBenPvcDownloadMenu() {
    const menu = document.getElementById('pvcDownloadMenu');
    if (menu) menu.style.display = 'none';
}

function _updatePvcQuickActionButtons() {
    const is3d = _benPvcViewMode === '3d';
    const flipper = document.getElementById('pvc3dFlipper');
    const isFlipped = flipper && flipper.classList.contains('is-flipped');
    const targetFace = (is3d && isFlipped) ? 'back' : 'front';
    const frontActions = document.getElementById('pvcFrontQuickActions');

    if (frontActions) {
        const titleFace = targetFace === 'front' ? 'Front' : 'Reverse';
        frontActions.innerHTML = `
            <button type="button" class="pvc-face-dl-btn" onclick="downloadBenPvcCardFace('${targetFace}', 'png')" title="Download ${titleFace} Face as High-Res PNG (600 DPI)">
                <i data-lucide="download" style="width:11px;height:11px;color:#3b82f6;"></i>
                <span>PNG</span>
            </button>
            <button type="button" class="pvc-face-dl-btn" onclick="downloadBenPvcCardFace('${targetFace}', 'jpg')" title="Download ${titleFace} Face as High-Res JPG (600 DPI)">
                <i data-lucide="download" style="width:11px;height:11px;color:#d97706;"></i>
                <span>JPG</span>
            </button>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

// Global outside-click listener for PVC download dropdown menu
document.addEventListener('click', function(e) {
    const wrap = document.getElementById('pvcDownloadDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
        closeBenPvcDownloadMenu();
    }
});

// Explicit window bindings
window.downloadBenPvcCardFace         = downloadBenPvcCardFace;
window.downloadBenPvcBothFaces        = downloadBenPvcBothFaces;
window.downloadBenPvcSideBySide       = downloadBenPvcSideBySide;
window.toggleBenPvcDownloadMenu       = toggleBenPvcDownloadMenu;
window.closeBenPvcDownloadMenu        = closeBenPvcDownloadMenu;
window._updatePvcQuickActionButtons   = _updatePvcQuickActionButtons;
window.onBenPvcCustomInput            = onBenPvcCustomInput;
window.applyBenPvcFrontGridPreset     = applyBenPvcFrontGridPreset;
window.handleBenPvcCustomPhotoUpload  = handleBenPvcCustomPhotoUpload;
window.clearBenPvcCustomPhoto         = clearBenPvcCustomPhoto;
window.resetBenPvcCustomData          = resetBenPvcCustomData;
window.saveBenPvcTemplateDefaults     = saveBenPvcTemplateDefaults;
window.switchBenPvcSidebarTab         = switchBenPvcSidebarTab;
window.setBenPvcZoom                  = setBenPvcZoom;
window.switchBenPvcBeneficiary        = switchBenPvcBeneficiary;
window.toggleBenPvcFeature            = toggleBenPvcFeature;

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
let _benSaveAndAddAnotherFlag = false;
const _benDecodedNic = { primary: null, female: null };

// ── Children Overview auto-counter ──────────────────────────────────────────
// Counts gender selects across all 5 child containers and writes Male/Female/Total
const CHILD_CONTAINERS = ['studyContainer','dropoutContainer','uniContainer','abroadContainer','otherContainer'];
const GENDER_SELECT_NAMES = ['study_gender','dropout_gender','uni_gender','abroad_gender','other_gender'];

function updateChildrenCounts() {
    let male = 0, female = 0, totalRows = 0;
    CHILD_CONTAINERS.forEach(cid => {
        const c = document.getElementById(cid);
        if (!c) return;
        const cards = c.querySelectorAll('.dynamic-card');
        totalRows += cards.length;
        const countBadge = document.getElementById('benCount_' + cid);
        if (countBadge) countBadge.textContent = String(cards.length);

        cards.forEach(card => {
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
    if (totalRows > 0 || (mEl && fEl && (Number(mEl.value) === 0 && Number(fEl.value) === 0))) {
        if (mEl) mEl.value = male;
        if (fEl) fEl.value = female;
        if (tEl) tEl.value = male + female;
    } else if (mEl && fEl && tEl) {
        tEl.value = (parseInt(mEl.value, 10) || 0) + (parseInt(fEl.value, 10) || 0);
    }

    const totalVal = tEl ? (parseInt(tEl.value, 10) || 0) : (male + female);
    const stepBadge = document.getElementById('benStepChildBadge');
    if (stepBadge) stepBadge.textContent = String(totalVal);

    if (typeof updateBenLivePreview === 'function') updateBenLivePreview();
}

function onBenManualChildCountChange() {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const mEl = form.querySelector('[name="children_count_male"]');
    const fEl = form.querySelector('[name="children_count_female"]');
    const tEl = form.querySelector('[name="children_total_count"]');
    const male = mEl ? (parseInt(mEl.value, 10) || 0) : 0;
    const female = fEl ? (parseInt(fEl.value, 10) || 0) : 0;
    if (tEl) tEl.value = male + female;
    const stepBadge = document.getElementById('benStepChildBadge');
    if (stepBadge) stepBadge.textContent = String(male + female);
    if (typeof updateBenLivePreview === 'function') updateBenLivePreview();
}

function _makeRemoveBtn(rowId) {
    return `<button type="button" class="ben-dep-remove-btn remove-btn" title="Remove entry" onclick="document.getElementById('${rowId}').remove(); updateChildrenCounts()"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>`;
}

function _escapeBenAttr(val) {
    return String(val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function addStudyRow(data = {}) {
    const container = document.getElementById('studyContainer');
    if (!container) return;
    const rowId = 'study-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="ben-dep-row-grid cols-4">
            <div class="form-group">
                <label class="form-label"><span>Child Full Name</span></label>
                <input type="text" name="study_name" placeholder="Full Name" value="${_escapeBenAttr(data.name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Gender</span></label>
                <select name="study_gender" class="form-select premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><span>Date of Birth</span></label>
                <input type="date" name="study_dob" value="${_escapeBenAttr(data.dob)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Current Grade</span></label>
                <input type="text" name="study_grade" placeholder="e.g. Grade 10" value="${_escapeBenAttr(data.grade)}" class="form-input premium-input">
            </div>
            ${_makeRemoveBtn(rowId)}
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
    if (window.lucide) lucide.createIcons();
}

function addDropoutRow(data = {}) {
    const container = document.getElementById('dropoutContainer');
    if (!container) return;
    const rowId = 'dropout-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="ben-dep-row-grid cols-4">
            <div class="form-group">
                <label class="form-label"><span>Child Full Name</span></label>
                <input type="text" name="dropout_name" placeholder="Full Name" value="${_escapeBenAttr(data.name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Gender</span></label>
                <select name="dropout_gender" class="form-select premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><span>Date of Birth</span></label>
                <input type="date" name="dropout_dob" value="${_escapeBenAttr(data.dob)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Last Grade Attended</span></label>
                <input type="text" name="dropout_grade" placeholder="e.g. Grade 8" value="${_escapeBenAttr(data.grade)}" class="form-input premium-input">
            </div>
            ${_makeRemoveBtn(rowId)}
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
    if (window.lucide) lucide.createIcons();
}

function addUniRow(data = {}) {
    const container = document.getElementById('uniContainer');
    if (!container) return;
    const rowId = 'uni-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="ben-dep-row-grid cols-4">
            <div class="form-group">
                <label class="form-label"><span>Student Full Name</span></label>
                <input type="text" name="uni_name" placeholder="Full Name" value="${_escapeBenAttr(data.name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Gender</span></label>
                <select name="uni_gender" class="form-select premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><span>University / Institute</span></label>
                <input type="text" name="uni_college" placeholder="University / College Name" value="${_escapeBenAttr(data.university_name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Academic Year</span></label>
                <input type="text" name="uni_year" placeholder="e.g. 2nd Year" value="${_escapeBenAttr(data.year)}" class="form-input premium-input">
            </div>
            ${_makeRemoveBtn(rowId)}
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
    if (window.lucide) lucide.createIcons();
}

function addAbroadRow(data = {}) {
    const container = document.getElementById('abroadContainer');
    if (!container) return;
    const rowId = 'abroad-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="ben-dep-row-grid cols-3">
            <div class="form-group">
                <label class="form-label"><span>Full Name</span></label>
                <input type="text" name="abroad_name" placeholder="Full Name" value="${_escapeBenAttr(data.name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Gender</span></label>
                <select name="abroad_gender" class="form-select premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><span>Date of Birth</span></label>
                <input type="date" name="abroad_dob" value="${_escapeBenAttr(data.dob)}" class="form-input premium-input">
            </div>
            ${_makeRemoveBtn(rowId)}
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
    if (window.lucide) lucide.createIcons();
}

function addOtherRow(data = {}) {
    const container = document.getElementById('otherContainer');
    if (!container) return;
    const rowId = 'other-' + (++_depRowCounter);
    const div = document.createElement('div');
    div.className = 'dynamic-card';
    div.id = rowId;
    div.innerHTML = `
        <div class="ben-dep-row-grid cols-4">
            <div class="form-group">
                <label class="form-label"><span>Child Full Name</span></label>
                <input type="text" name="other_name" placeholder="Full Name" value="${_escapeBenAttr(data.name)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Gender</span></label>
                <select name="other_gender" class="form-select premium-input">
                    <option value="" ${!data.gender ? 'selected' : ''}>— Select —</option>
                    <option value="male" ${data.gender === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${data.gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label"><span>Date of Birth</span></label>
                <input type="date" name="other_dob" value="${_escapeBenAttr(data.dob)}" class="form-input premium-input">
            </div>
            <div class="form-group">
                <label class="form-label"><span>Category</span></label>
                <select name="other_category" class="form-select premium-input">
                    <option value="kindergarten" ${data.category === 'kindergarten' ? 'selected' : ''}>Kindergarten</option>
                    <option value="nursery" ${data.category === 'nursery' ? 'selected' : ''}>Nursery</option>
                    <option value="baby" ${data.category === 'baby' ? 'selected' : ''}>Baby / Infant</option>
                    <option value="other" ${data.category === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            ${_makeRemoveBtn(rowId)}
        </div>
    `;
    container.appendChild(div);
    updateChildrenCounts();
    if (window.lucide) lucide.createIcons();
}

// ── Global UI & Wizard Handlers for Beneficiary Modal ──────────────────────
const WIZARD_STEPS = ['ben-male', 'ben-female', 'ben-children', 'ben-family', 'ben-status'];
const WIZARD_STEP_TITLES = [
    'Primary Head',
    'Secondary Head',
    'Children & Dependents',
    'Living & Economy',
    'Assessment & Decision'
];

function goToWizardStep(stepIdx) {
    const modal = document.getElementById('beneficiaryModal');
    if (!modal) return;
    const boundedIdx = Math.max(0, Math.min(WIZARD_STEPS.length - 1, Number(stepIdx) || 0));
    const stepId = WIZARD_STEPS[boundedIdx];

    // Update stepper tabs (preserve .ben-step-tab)
    modal.querySelectorAll('.stepper-item').forEach((item, i) => {
        item.classList.remove('active', 'completed');
        if (i < boundedIdx) item.classList.add('completed');
        if (i === boundedIdx) item.classList.add('active');
    });

    // Update content panels (sync both .active class and inline style.display)
    modal.querySelectorAll('.modal-tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });
    const panel = document.getElementById(stepId);
    if (panel) {
        panel.classList.add('active');
        panel.style.display = 'block';
    }

    // Scroll modal body back to top on step switch
    const scrollBody = document.getElementById('benModalScrollBody');
    if (scrollBody) scrollBody.scrollTop = 0;

    // Update footer step label
    const footerStepText = document.getElementById('benFooterStepText');
    if (footerStepText) {
        footerStepText.textContent = `Step ${boundedIdx + 1} of ${WIZARD_STEPS.length} · ${WIZARD_STEP_TITLES[boundedIdx]}`;
    }

    // Show / hide navigation and save buttons
    const prevBtn = modal.querySelector('.btn-wizard-prev');
    const nextBtn = modal.querySelector('.btn-wizard-next');
    const submitBtn = modal.querySelector('.btn-wizard-submit');
    const quickSaveEditBtn = document.getElementById('benQuickSaveEditBtn');
    const saveAndAnotherBtn = document.getElementById('benSaveAndAnotherBtn');
    const form = document.getElementById('beneficiaryForm');
    const isEditMode = Boolean(form && form.elements['id'] && form.elements['id'].value);
    const isLastStep = boundedIdx === WIZARD_STEPS.length - 1;

    if (prevBtn) prevBtn.style.display = boundedIdx === 0 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = isLastStep ? 'none' : 'inline-flex';
    if (submitBtn) submitBtn.style.display = isLastStep ? 'inline-flex' : 'none';
    if (quickSaveEditBtn) quickSaveEditBtn.style.display = (isEditMode && !isLastStep) ? 'inline-flex' : 'none';
    if (saveAndAnotherBtn) saveAndAnotherBtn.style.display = (!isEditMode && isLastStep) ? 'inline-flex' : 'none';

    if (window.lucide) lucide.createIcons();
}

function toggleGuardianField(familyStatus) {
    const wrap = document.getElementById('guardianFieldWrap');
    if (wrap) wrap.style.display = familyStatus === 'Divorced' ? 'block' : 'none';
}

function toggleRejectionReason(statusVal) {
    const wrap = document.getElementById('rejectionReasonWrap');
    if (wrap) wrap.style.display = statusVal === 'rejected' ? 'block' : 'none';
}

// ── Visual Segmented Buttons & Choice Card Helpers ─────────────────────────
function setBenPrimaryGender(gender) {
    const sel = document.getElementById('benPrimaryGenderSelect');
    if (sel) sel.value = gender;
    const seg = document.getElementById('benPrimaryGenderSeg');
    if (seg) {
        seg.querySelectorAll('.ben-seg-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-gender') === gender);
        });
    }
    updateBenLivePreview();
}

function setBenHomeOwnership(val) {
    const sel = document.getElementById('benHomeDetailsSelect');
    if (sel) sel.value = val;
    const group = document.getElementById('benHomeOwnershipCards');
    if (group) {
        group.querySelectorAll('.ben-choice-card').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-home') === val);
        });
    }
    updateBenLivePreview();
}

function setBenFamilyStatus(val) {
    const sel = document.getElementById('benFamilyStatusSelect');
    if (sel) sel.value = val;
    const group = document.getElementById('benFamilyStatusCards');
    if (group) {
        group.querySelectorAll('.ben-choice-card').forEach(btn => {
            btn.classList.toggle('active', (btn.getAttribute('data-fstat') || '') === (val || ''));
        });
    }
    toggleGuardianField(val);
    updateBenLivePreview();
}

function setBenAssistanceNeeded(val) {
    const sel = document.getElementById('benAssistanceSelect');
    if (sel) sel.value = val;
    const group = document.getElementById('benAssistanceTypeCards');
    if (group) {
        group.querySelectorAll('.ben-choice-card').forEach(btn => {
            btn.classList.toggle('active', (btn.getAttribute('data-aid') || '') === (val || ''));
        });
    }
    updateBenLivePreview();
}

function setBenModalStatus(val) {
    const sel = document.getElementById('benStatusSelect');
    if (sel) sel.value = val;
    const group = document.getElementById('benStatusCardGroup');
    if (group) {
        group.querySelectorAll('.ben-status-card').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-bstatus') === val);
        });
    }
    toggleRejectionReason(val);
    updateBenLivePreview();
}

function setBenIncomePreset(val) {
    const inp = document.getElementById('benMonthlyIncomeInput');
    if (inp) inp.value = val;
    updateBenLivePreview();
}

function setBenFieldVal(fieldName, val) {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const el = form.querySelector(`[name="${fieldName}"]`);
    if (el) {
        el.value = val;
        updateBenLivePreview();
    }
}

function appendBenCommaTag(fieldName, tag) {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const el = form.querySelector(`[name="${fieldName}"]`);
    if (!el) return;
    const cur = (el.value || '').trim();
    if (!cur || cur.toLowerCase() === 'none') {
        el.value = tag;
    } else if (!cur.toLowerCase().includes(tag.toLowerCase())) {
        el.value = `${cur}, ${tag}`;
    }
    updateBenLivePreview();
}

function copyBenField(fromName, toName) {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const fromEl = form.querySelector(`[name="${fromName}"]`);
    const toEl = form.querySelector(`[name="${toName}"]`);
    if (fromEl && toEl) {
        toEl.value = fromEl.value || '';
        updateBenLivePreview();
        if (typeof showToast === 'function' && fromEl.value) {
            showToast('Copied from Primary Head', 'info', 1800);
        }
    }
}

function copyBenPrimaryLocationToSecondary() {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    const pTown = form.querySelector('[name="home_town"]');
    const fTown = form.querySelector('[name="female_head_home_town"]');
    const pAddr = form.querySelector('[name="male_head_address"]');
    const fAddr = form.querySelector('[name="female_head_address"]');
    if (pTown && fTown && pTown.value) fTown.value = pTown.value;
    if (pAddr && fAddr && pAddr.value) fAddr.value = pAddr.value;
    updateBenLivePreview();
    if (typeof showToast === 'function') {
        showToast('Copied Home Town & Address from Primary Head', 'success', 2000);
    }
}

// ── Auto Application ID & Duplicate Checkers ───────────────────────────────
function generateBenAutoAppNo() {
    const year = new Date().getFullYear();
    const list = Array.isArray(window.currentBeneficiaries) ? window.currentBeneficiaries : (typeof currentBeneficiaries !== 'undefined' ? currentBeneficiaries : []);
    let maxSeq = 0;
    list.forEach(b => {
        const raw = String(b.application_number || '').trim();
        const m = raw.match(/(\d+)$/);
        if (m) {
            const num = parseInt(m[1], 10);
            if (num > 0 && num < 100000 && num > maxSeq) maxSeq = num;
        }
    });
    const nextNum = String(maxSeq + 1).padStart(3, '0');
    const code = `EDF-${year}-${nextNum}`;
    const inp = document.getElementById('benAppNoInput');
    if (inp) {
        inp.value = code;
        onBenAppNoInput(code);
    }
}

function _getEditingBeneficiaryId() {
    const form = document.getElementById('beneficiaryForm');
    return form && form.elements['id'] ? String(form.elements['id'].value || '') : '';
}

function onBenAppNoInput(val) {
    const clean = String(val || '').trim().toLowerCase();
    const editId = _getEditingBeneficiaryId();
    const list = typeof currentBeneficiaries !== 'undefined' && Array.isArray(currentBeneficiaries) ? currentBeneficiaries : [];
    const dup = clean ? list.find(b => String(b.id) !== editId && String(b.application_number || '').trim().toLowerCase() === clean) : null;
    const banner = document.getElementById('benAppDupBanner');
    const text = document.getElementById('benAppDupText');
    if (banner && text) {
        if (dup) {
            text.textContent = `App # "${val}" is already assigned to ${dup.male_head_name || 'another record'}`;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }
    updateBenLivePreview();
}

function onBenPhoneInput(val) {
    const digits = String(val || '').replace(/\D/g, '');
    const editId = _getEditingBeneficiaryId();
    const list = typeof currentBeneficiaries !== 'undefined' && Array.isArray(currentBeneficiaries) ? currentBeneficiaries : [];
    const dup = digits.length >= 9 ? list.find(b => {
        if (String(b.id) === editId) return false;
        const bDigits = String(b.contact_number || '').replace(/\D/g, '');
        return bDigits && bDigits.slice(-9) === digits.slice(-9);
    }) : null;
    const banner = document.getElementById('benPhoneDupBanner');
    const text = document.getElementById('benPhoneDupText');
    if (banner && text) {
        if (dup) {
            text.textContent = `Phone matches existing beneficiary: ${dup.male_head_name || 'Record'} (${dup.application_number || 'No App #'})`;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }
    updateBenLivePreview();
}

// ── Sri Lankan NIC Decoder (9-digit V/X & 12-digit) + Duplicate Check ──────
function _decodeSriLankanNic(rawNic) {
    const clean = String(rawNic || '').trim().toUpperCase();
    let year = 0, dayOfYear = 0;
    const oldMatch = clean.match(/^(\d{2})(\d{3})\d{4}[VX]$/);
    const newMatch = clean.match(/^(\d{4})(\d{3})\d{5}$/);
    if (oldMatch) {
        year = 1900 + parseInt(oldMatch[1], 10);
        dayOfYear = parseInt(oldMatch[2], 10);
    } else if (newMatch) {
        year = parseInt(newMatch[1], 10);
        dayOfYear = parseInt(newMatch[2], 10);
    } else {
        return null;
    }

    const gender = dayOfYear > 500 ? 'female' : 'male';
    if (dayOfYear > 500) dayOfYear -= 500;
    if (dayOfYear < 1 || dayOfYear > 366) return null;

    // Sri Lankan NIC uses a 366-day leap calendar (Feb = 29 days)
    const monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let month = 0;
    let day = dayOfYear;
    for (let i = 0; i < 12; i++) {
        if (day <= monthDays[i]) {
            month = i + 1;
            break;
        }
        day -= monthDays[i];
    }
    if (!month) return null;

    // Clamp Feb 29 on non-leap years to Feb 28 for valid HTML date input
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    if (month === 2 && day === 29 && !isLeap) day = 28;

    const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const today = new Date();
    let age = today.getFullYear() - year;
    const mDiff = (today.getMonth() + 1) - month;
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) age--;
    age = Math.max(0, age);

    return { dob, age, gender };
}

function onBenNicInput(val, target = 'primary') {
    const decoded = _decodeSriLankanNic(val);
    _benDecodedNic[target] = decoded;

    if (target === 'primary') {
        const banner = document.getElementById('benPrimaryNicDecodeBanner');
        const text = document.getElementById('benPrimaryNicDecodeText');
        if (banner && text) {
            if (decoded) {
                text.textContent = `NIC Decoded: ${decoded.gender === 'female' ? 'Female' : 'Male'} · Born ${decoded.dob} (${decoded.age} yrs)`;
                banner.style.display = 'flex';
                // Auto-fill DOB & Age if currently blank
                const dobEl = document.getElementById('benPrimaryDobInput');
                const ageEl = document.getElementById('benPrimaryAgeInput');
                if (dobEl && !dobEl.value) {
                    dobEl.value = decoded.dob;
                    if (ageEl) ageEl.value = decoded.age;
                    setBenPrimaryGender(decoded.gender);
                }
            } else {
                banner.style.display = 'none';
            }
        }

        // Check duplicate NIC in currentBeneficiaries
        const cleanNic = String(val || '').trim().toLowerCase();
        const editId = _getEditingBeneficiaryId();
        const list = typeof currentBeneficiaries !== 'undefined' && Array.isArray(currentBeneficiaries) ? currentBeneficiaries : [];
        const dup = cleanNic.length >= 9 ? list.find(b => {
            if (String(b.id) === editId) return false;
            return String(b.nic_number || '').trim().toLowerCase() === cleanNic ||
                   String(b.female_head_nic || '').trim().toLowerCase() === cleanNic;
        }) : null;
        const dupBanner = document.getElementById('benNicDupBanner');
        const dupText = document.getElementById('benNicDupText');
        if (dupBanner && dupText) {
            if (dup) {
                dupText.textContent = `NIC already registered under ${dup.male_head_name || 'Beneficiary'} (${dup.application_number || 'No App #'})`;
                dupBanner.style.display = 'flex';
            } else {
                dupBanner.style.display = 'none';
            }
        }
    } else if (target === 'female') {
        const banner = document.getElementById('benFemaleNicDecodeBanner');
        const text = document.getElementById('benFemaleNicDecodeText');
        if (banner && text) {
            if (decoded) {
                text.textContent = `NIC Decoded: Born ${decoded.dob} (${decoded.age} yrs)`;
                banner.style.display = 'flex';
                const dobEl = document.getElementById('benFemaleDobInput');
                if (dobEl && !dobEl.value) {
                    dobEl.value = decoded.dob;
                    onBenDobChange(decoded.dob, 'female');
                }
            } else {
                banner.style.display = 'none';
            }
        }
    }

    updateBenLivePreview();
}

function applyBenDecodedNic(target = 'primary') {
    const d = _benDecodedNic[target];
    if (!d) return;
    if (target === 'primary') {
        const dobEl = document.getElementById('benPrimaryDobInput');
        const ageEl = document.getElementById('benPrimaryAgeInput');
        if (dobEl) dobEl.value = d.dob;
        if (ageEl) ageEl.value = d.age;
        setBenPrimaryGender(d.gender);
        onBenDobChange(d.dob, 'primary');
        if (typeof showToast === 'function') showToast('Applied decoded NIC (Gender, DOB & Age)', 'success', 1800);
    } else if (target === 'female') {
        const dobEl = document.getElementById('benFemaleDobInput');
        if (dobEl) dobEl.value = d.dob;
        onBenDobChange(d.dob, 'female');
        if (typeof showToast === 'function') showToast('Applied decoded Spouse DOB', 'success', 1800);
    }
    updateBenLivePreview();
}

function onBenDobChange(val, target = 'primary') {
    if (!val) {
        if (target === 'female') {
            const hint = document.getElementById('benFemaleAgeHint');
            if (hint) hint.textContent = '';
        }
        return;
    }
    const birth = new Date(val);
    if (isNaN(birth.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const mDiff = today.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
    age = Math.max(0, age);

    if (target === 'primary') {
        const ageEl = document.getElementById('benPrimaryAgeInput');
        if (ageEl) ageEl.value = age;
        const hint = document.getElementById('benPrimaryAgeHint');
        if (hint) hint.textContent = `(${age} yrs)`;
    } else if (target === 'female') {
        const hint = document.getElementById('benFemaleAgeHint');
        if (hint) hint.textContent = `${age} yrs old`;
    }
}

// ── Live Identity & Assessment Strip + Completion Meter ────────────────────
const BEN_TOGGLE_FIELDS = [
    'parents_live_with_head',
    'special_needs_at_home',
    'children_seeking_job',
    'children_marriageable_age',
    'children_drugs',
    'family_problems',
    'applied_before',
    'received_assistance_before'
];

function updateBenLivePreview() {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;

    const getVal = (name) => {
        const el = form.querySelector(`[name="${name}"]`);
        return el ? String(el.value || '').trim() : '';
    };

    const name = getVal('male_head_name');
    const appNo = getVal('application_number');
    const category = getVal('category');
    const status = getVal('status') || 'pending';
    const nic = getVal('nic_number');
    const phone = getVal('contact_number');
    const town = getVal('home_town');
    const spouse = getVal('female_head_name');
    const totalKids = parseInt(getVal('children_total_count'), 10) || 0;
    const incomeRaw = getVal('monthly_income');
    const incomeNum = parseFloat(incomeRaw);
    const homeType = getVal('living_home_details') || 'own house';
    const famStatus = getVal('family_status');
    const aidType = getVal('assistance_details');

    // 1. Name & Avatar Initials
    const liveName = document.getElementById('benLiveName');
    if (liveName) liveName.textContent = name || 'New Beneficiary Applicant';

    const initialsEl = document.getElementById('benLiveAvatarInitials');
    if (initialsEl) {
        if (name) {
            const parts = name.split(/\s+/).filter(Boolean);
            initialsEl.textContent = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : name.slice(0, 2).toUpperCase();
        } else {
            initialsEl.textContent = '?';
        }
    }

    // 2. Top Badges (App #, Category, Status)
    const appBadge = document.getElementById('benLiveAppBadge');
    if (appBadge) appBadge.innerHTML = `<i data-lucide="hash" style="width:11px;height:11px;"></i> ${_escapeBenAttr(appNo || 'No App #')}`;

    const catBadge = document.getElementById('benLiveCatBadge');
    if (catBadge) catBadge.innerHTML = `<i data-lucide="tag" style="width:11px;height:11px;"></i> ${_escapeBenAttr(category || 'Uncategorized')}`;

    const statusBadge = document.getElementById('benLiveStatusBadge');
    if (statusBadge) {
        const statusLabels = {
            pending: 'Pending Review',
            Active: 'Approved / Active',
            deactivate: 'On Hold',
            rejected: 'Rejected'
        };
        statusBadge.className = `ben-live-chip ben-chip-status-${status}`;
        statusBadge.textContent = statusLabels[status] || status;
    }

    // 3. Meta Row (NIC, Phone, Town, Spouse, Children)
    const metaNic = document.getElementById('benLiveMetaNic');
    if (metaNic) metaNic.innerHTML = `<i data-lucide="credit-card" style="width:12px;height:12px;vertical-align:middle;"></i> ${_escapeBenAttr(nic || 'NIC not set')}`;

    const metaPhone = document.getElementById('benLiveMetaPhone');
    if (metaPhone) metaPhone.innerHTML = `<i data-lucide="phone" style="width:12px;height:12px;vertical-align:middle;"></i> ${_escapeBenAttr(phone || 'No contact')}`;

    const metaTown = document.getElementById('benLiveMetaTown');
    if (metaTown) metaTown.innerHTML = `<i data-lucide="map-pin" style="width:12px;height:12px;vertical-align:middle;"></i> ${_escapeBenAttr(town || 'No town')}`;

    const metaSpouse = document.getElementById('benLiveMetaSpouse');
    if (metaSpouse) metaSpouse.innerHTML = `<i data-lucide="heart-handshake" style="width:12px;height:12px;vertical-align:middle;"></i> ${_escapeBenAttr(spouse ? 'Spouse: ' + spouse : 'Spouse: —')}`;

    const metaKids = document.getElementById('benLiveMetaChildren');
    if (metaKids) metaKids.innerHTML = `<i data-lucide="baby" style="width:12px;height:12px;vertical-align:middle;"></i> ${totalKids} ${totalKids === 1 ? 'Child' : 'Children'}`;

    // 4. Right KPI Boxes (Income, Housing, Vulnerability Flags, Aid)
    const incomeValEl = document.getElementById('benLiveIncomeVal');
    const incomeTierEl = document.getElementById('benIncomeTierBadge');
    if (incomeValEl) {
        if (!isNaN(incomeNum) && incomeRaw !== '') {
            incomeValEl.textContent = `LKR ${incomeNum.toLocaleString()}`;
        } else {
            incomeValEl.textContent = 'LKR 0';
        }
    }
    if (incomeTierEl) {
        if (incomeRaw === '' || isNaN(incomeNum)) {
            incomeTierEl.textContent = 'No Income Set';
            incomeTierEl.style.color = 'var(--text-muted)';
        } else if (incomeNum === 0) {
            incomeTierEl.textContent = 'Zero Income · Critical Need';
            incomeTierEl.style.color = '#ef4444';
        } else if (incomeNum <= 20000) {
            incomeTierEl.textContent = 'Extreme Low Income (≤20k)';
            incomeTierEl.style.color = '#f59e0b';
        } else if (incomeNum <= 40000) {
            incomeTierEl.textContent = 'Low-Moderate Income';
            incomeTierEl.style.color = '#10b981';
        } else {
            incomeTierEl.textContent = 'Above Standard Threshold';
            incomeTierEl.style.color = '#6366f1';
        }
    }

    const housingSub = document.getElementById('benLiveHousingSub');
    if (housingSub) {
        const homeLabels = { 'own house': 'Own House', 'rent house': 'Rent House', 'joint Family': 'Joint Family' };
        const famLabels = { '': 'General', 'widow': 'Widow(er)', 'Divorced': 'Divorced', 'sicker': 'Health Issue' };
        housingSub.textContent = `${homeLabels[homeType] || homeType} · ${famLabels[famStatus] || famStatus}`;
    }

    // 5. Assessment Flags tally & card highlight
    let yesFlags = 0;
    BEN_TOGGLE_FIELDS.forEach(field => {
        const hi = form.querySelector(`input[name="${field}"]`);
        const isYes = hi && hi.value === 'yes';
        if (isYes) yesFlags++;
        const card = document.getElementById(`benAssessCard_${field}`);
        if (card) card.classList.toggle('flagged', Boolean(isYes));
    });

    const flagsVal = document.getElementById('benLiveFlagsVal');
    if (flagsVal) {
        flagsVal.textContent = `${yesFlags} / 8 Flags`;
        flagsVal.style.color = yesFlags >= 3 ? '#ef4444' : yesFlags >= 1 ? '#f59e0b' : 'var(--text-main)';
    }

    const stepFlagsBadge = document.getElementById('benStepFlagsBadge');
    if (stepFlagsBadge) stepFlagsBadge.textContent = `${yesFlags}/8`;

    const summaryBadge = document.getElementById('benAssessmentSummaryBadge');
    if (summaryBadge) summaryBadge.textContent = `${yesFlags} of 8 Indicators Yes`;

    const aidSub = document.getElementById('benLiveAidNeedSub');
    if (aidSub) {
        const aidLabels = { '': 'None', 'dry ration': 'Dry Ration', 'other': 'Other Aid' };
        aidSub.textContent = `Aid: ${aidLabels[aidType] || aidType}`;
    }

    // 6. Profile Completion Meter
    const completionFields = [
        'application_number',
        'male_head_name',
        'nic_number',
        'contact_number',
        'home_town',
        'male_head_dob',
        'male_head_occupation',
        'male_head_address',
        'category',
        'monthly_income'
    ];
    let filled = 0;
    completionFields.forEach(f => {
        if (getVal(f) !== '') filled++;
    });
    const pct = Math.max(10, Math.round((filled / completionFields.length) * 100));
    const compFill = document.getElementById('benCompletionFill');
    const compLabel = document.getElementById('benCompletionLabel');
    if (compFill) compFill.style.width = `${pct}%`;
    if (compLabel) compLabel.textContent = `${pct}% Complete`;

    if (window.lucide) lucide.createIcons();
}

function syncBenModalUIFromForm() {
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;

    const gender = (form.querySelector('[name="male_head_gender"]')?.value) || 'male';
    setBenPrimaryGender(gender);

    const home = (form.querySelector('[name="living_home_details"]')?.value) || 'own house';
    setBenHomeOwnership(home);

    const famStatus = (form.querySelector('[name="family_status"]')?.value) || '';
    setBenFamilyStatus(famStatus);

    const aid = (form.querySelector('[name="assistance_details"]')?.value) || '';
    setBenAssistanceNeeded(aid);

    const status = (form.querySelector('[name="status"]')?.value) || 'pending';
    setBenModalStatus(status);

    // Clear duplicate & NIC decode banners until triggered
    ['benAppDupBanner', 'benNicDupBanner', 'benPhoneDupBanner', 'benPrimaryNicDecodeBanner', 'benFemaleNicDecodeBanner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Update DOB age hints
    onBenDobChange(form.querySelector('[name="male_head_dob"]')?.value || '', 'primary');
    onBenDobChange(form.querySelector('[name="female_head_dob"]')?.value || '', 'female');

    updateChildrenCounts();
    updateBenLivePreview();
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

// Toggle switch logic for yes/no hidden inputs + live preview updates
document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.name && e.target.name.endsWith('_toggle')) {
        const baseName = e.target.name.replace('_toggle', '');
        const form = e.target.closest('form');
        const hiddenInput = form ? form.querySelector(`input[name="${baseName}"]`) : null;
        if (hiddenInput) {
            hiddenInput.value = e.target.checked ? 'yes' : 'no';
        }
        updateBenLivePreview();
    }
    // Re-tally gender counts whenever any gender select changes inside a child container
    if (e.target.tagName === 'SELECT' && e.target.name && e.target.name.endsWith('_gender') &&
        CHILD_CONTAINERS.some(cid => { const c = document.getElementById(cid); return c && c.contains(e.target); })) {
        updateChildrenCounts();
    }
});

function openAddBeneficiaryModal() {
    document.getElementById('beneficiaryModalTitle').textContent = 'Register New Beneficiary';
    const modePill = document.getElementById('benModalModePill');
    if (modePill) {
        modePill.textContent = 'New Application';
        modePill.style.background = 'rgba(16, 185, 129, 0.12)';
        modePill.style.color = '#10b981';
    }
    const subBtn = document.getElementById('benSubmitBtn');
    if (subBtn) subBtn.innerHTML = '<i data-lucide="check-circle" style="width:15px;height:15px;"></i> Complete Registration';

    const form = document.getElementById('beneficiaryForm');
    form.reset();
    // Explicitly clear hidden ID so Add never becomes a PUT
    const hiddenId = form.querySelector('input[name="id"]');
    if (hiddenId) hiddenId.value = '';

    // Clear dynamic rows
    CHILD_CONTAINERS.forEach(cid => {
        const c = document.getElementById(cid);
        if (c) c.innerHTML = '';
    });

    // Reset modern-switch toggles & hidden values
    BEN_TOGGLE_FIELDS.forEach(field => {
        const cb = form.querySelector(`input[name="${field}_toggle"]`);
        if (cb) cb.checked = false;
        const hi = form.querySelector(`input[name="${field}"]`);
        if (hi) hi.value = 'no';
    });

    // Reset photo widget
    resetBenPhotoWidget();

    // Sync visual choice cards, counters, and live strip
    syncBenModalUIFromForm();

    openModal('beneficiaryModal');
    goToWizardStep(0);
    populateBeneficiaryCategorySelect();
    if (window.lucide) lucide.createIcons();
}

// ── Beneficiary Photo Upload Helpers ──────────────────────────────────────────
function resetBenPhotoWidget() {
    const inp = document.getElementById('benPhotoInput');
    const url = document.getElementById('benPhotoUrl');
    const preview = document.getElementById('benPhotoPreview');
    const previewWrap = document.getElementById('benPhotoPreviewWrap');
    const placeholder = document.getElementById('benPhotoPlaceholder');
    const status = document.getElementById('benPhotoStatus');
    const removeBtn = document.getElementById('benPhotoRemoveBtn');
    const liveImg = document.getElementById('benLiveAvatarImg');
    const liveInitials = document.getElementById('benLiveAvatarInitials');

    if (inp) inp.value = '';
    if (url) url.value = '';
    if (preview) preview.src = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
    if (removeBtn) removeBtn.style.display = 'none';
    if (status) { status.style.display = 'none'; status.textContent = ''; }
    if (liveImg) { liveImg.src = ''; liveImg.style.display = 'none'; }
    if (liveInitials) liveInitials.style.display = '';
}

function setBenPhotoPreview(src) {
    const preview = document.getElementById('benPhotoPreview');
    const previewWrap = document.getElementById('benPhotoPreviewWrap');
    const placeholder = document.getElementById('benPhotoPlaceholder');
    const removeBtn = document.getElementById('benPhotoRemoveBtn');
    const liveImg = document.getElementById('benLiveAvatarImg');
    const liveInitials = document.getElementById('benLiveAvatarInitials');

    if (preview) preview.src = src;
    if (previewWrap) previewWrap.style.display = 'flex';
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
    if (liveImg) { liveImg.src = src; liveImg.style.display = 'block'; }
    if (liveInitials) liveInitials.style.display = 'none';
}

function setPhotoStatus(msg, type) {
    const status = document.getElementById('benPhotoStatus');
    if (!status) return;
    status.style.display = 'block';
    status.style.color = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : 'var(--text-muted)';
    status.textContent = msg;
}

async function _uploadBenPhotoFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        setPhotoStatus('File too large. Max 5 MB.', 'error');
        return;
    }
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
        document.getElementById('benPhotoUrl').value = '';
    }
}

async function handleBenPhotoSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (file) await _uploadBenPhotoFile(file);
}

async function handleBenPhotoDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const dropzone = document.getElementById('benPhotoDropzone');
    if (dropzone) dropzone.style.borderColor = 'var(--border-color)';
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) await _uploadBenPhotoFile(file);
}

function removeBenPhoto(event) {
    if (event) event.stopPropagation();
    resetBenPhotoWidget();
}

async function editBeneficiary(id) {
    try {
        const res = await fetch(`/api/edf/beneficiaries/${id}`);
        if (!res.ok) throw new Error('Failed to fetch beneficiary');
        const b = await res.json();

        document.getElementById('beneficiaryModalTitle').textContent = 'Edit Beneficiary Profile';
        const modePill = document.getElementById('benModalModePill');
        if (modePill) {
            modePill.textContent = `Editing ${b.application_number || '#' + id}`;
            modePill.style.background = 'rgba(99, 102, 241, 0.14)';
            modePill.style.color = '#6366f1';
        }
        const subBtn = document.getElementById('benSubmitBtn');
        if (subBtn) subBtn.innerHTML = '<i data-lucide="check-circle" style="width:15px;height:15px;"></i> Update Profile';

        const form = document.getElementById('beneficiaryForm');
        form.reset();

        // Populate category select first so value can be set when we fill fields
        await populateBeneficiaryCategorySelect();

        // Clear dynamic rows
        CHILD_CONTAINERS.forEach(cid => {
            const c = document.getElementById(cid);
            if (c) c.innerHTML = '';
        });

        // Fill all main scalar fields.
        // Skip nested arrays and the auto-managed created_at so the backend UPDATE is clean.
        const skipKeys = new Set(['study', 'dropout', 'university', 'abroad', 'other', 'created_at']);
        Object.keys(b).forEach(key => {
            if (skipKeys.has(key)) return;
            const el = form.querySelector(`[name="${key}"]`);
            if (el && el.type !== 'checkbox') el.value = b[key] ?? '';
        });

        // Populate dependent rows
        if (b.study)      b.study.forEach(s => addStudyRow(s));
        if (b.dropout)    b.dropout.forEach(d => addDropoutRow(d));
        if (b.university) b.university.forEach(u => addUniRow(u));
        if (b.abroad)     b.abroad.forEach(a => addAbroadRow(a));
        if (b.other)      b.other.forEach(o => addOtherRow(o));

        // Preserve stored children counts if no individual child cards were entered
        if ((!b.study || !b.study.length) && (!b.dropout || !b.dropout.length) &&
            (!b.university || !b.university.length) && (!b.abroad || !b.abroad.length) && (!b.other || !b.other.length)) {
            const mEl = form.querySelector('[name="children_count_male"]');
            const fEl = form.querySelector('[name="children_count_female"]');
            const tEl = form.querySelector('[name="children_total_count"]');
            if (mEl) mEl.value = b.children_count_male ?? 0;
            if (fEl) fEl.value = b.children_count_female ?? 0;
            if (tEl) tEl.value = b.children_total_count ?? ((Number(b.children_count_male) || 0) + (Number(b.children_count_female) || 0));
        }

        // Sync toggle checkboxes AND their paired hidden yes/no inputs.
        BEN_TOGGLE_FIELDS.forEach(field => {
            const isYes = b[field] === 'yes';
            const cb = form.querySelector(`input[name="${field}_toggle"]`);
            const hi = form.querySelector(`input[name="${field}"]`);
            if (cb) cb.checked = isYes;
            if (hi) hi.value = isYes ? 'yes' : 'no';
        });

        // Populate photo widget if a saved photo exists
        resetBenPhotoWidget();
        if (b.photo_url) {
            setBenPhotoPreview(b.photo_url);
            document.getElementById('benPhotoUrl').value = b.photo_url;
            setPhotoStatus('Existing photo loaded', 'success');
        }

        // Sync visual choice cards, rejection/guardian conditional blocks, and live preview
        syncBenModalUIFromForm();

        openModal('beneficiaryModal');
        goToWizardStep(0);
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error(err);
        showToast('Failed to load beneficiary for editing', 'error');
    }
}

function submitBeneficiaryForm(addAnother = false) {
    _benSaveAndAddAnotherFlag = Boolean(addAnother);
    const form = document.getElementById('beneficiaryForm');
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
    } else {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

// Beneficiary Form Submit
document.getElementById('beneficiaryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveAndAnother = _benSaveAndAddAnotherFlag;
    _benSaveAndAddAnotherFlag = false;

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const id = data.id;

    // Validate Primary Head Name
    if (!String(data.male_head_name || '').trim()) {
        goToWizardStep(0);
        const nameInput = document.getElementById('benPrimaryNameInput');
        if (nameInput) nameInput.focus();
        showToast('Primary Head Full Name is required', 'error');
        return;
    }

    // Validate Rejection Reason when status === 'rejected'
    if (data.status === 'rejected' && !String(data.rejection_reason || '').trim()) {
        goToWizardStep(4);
        const rejInput = document.getElementById('rejectionReasonInput');
        if (rejInput) rejInput.focus();
        showToast('Please provide a Rejection Reason for rejected applications', 'error');
        return;
    }

    // Strip UI-only toggle fields (not DB columns) and empty id for new records
    Object.keys(data).filter(k => k.endsWith('_toggle')).forEach(k => delete data[k]);
    if (!id) delete data.id;

    const collectRows = (containerId, keys) => {
        const rows = [];
        const container = document.getElementById(containerId);
        if (!container) return rows;
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
    const quickSaveBtn = document.getElementById('benQuickSaveEditBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
    if (quickSaveBtn) { quickSaveBtn.disabled = true; }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            await fetchBeneficiaries();
            showToast(id ? 'Beneficiary profile updated' : 'Beneficiary registered successfully', 'success');
            if (saveAndAnother && !id) {
                openAddBeneficiaryModal();
                generateBenAutoAppNo();
            } else {
                closeModal('beneficiaryModal');
            }
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
            submitBtn.innerHTML = id
                ? '<i data-lucide="check-circle" style="width:15px;height:15px;"></i> Update Profile'
                : '<i data-lucide="check-circle" style="width:15px;height:15px;"></i> Complete Registration';
        }
        if (quickSaveBtn) {
            quickSaveBtn.disabled = false;
        }
        if (window.lucide) lucide.createIcons();
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// BENEFICIARY CATEGORIES MANAGEMENT & ADD/EDIT STUDIO SUITE
// ═══════════════════════════════════════════════════════════════════════════
let categoryData = [];
let _bcatSaveAndAnother = false;

const DEFAULT_BEN_CATEGORY_PRESETS = [
    {
        name: 'Widow Support',
        description: 'Female-headed households where the primary breadwinner has passed away; eligible for monthly family allowance and seasonal rations.'
    },
    {
        name: 'Orphan Care',
        description: 'Households caring for orphaned minors requiring educational sponsorship, nutritional support, and welfare monitoring.'
    },
    {
        name: 'Medical & Chronic Illness',
        description: 'Families with bedridden members, dialysis/kidney patients, or severe chronic conditions requiring ongoing medication assistance.'
    },
    {
        name: 'Disability / Special Needs',
        description: 'Households with physically or mentally differently-abled members needing mobility aids, therapy, or livelihood support.'
    },
    {
        name: 'Elderly Care',
        description: 'Senior citizens living without regular income or family support; prioritized for monthly dry rations and healthcare aid.'
    },
    {
        name: 'Zakat Eligible',
        description: 'Verified low-income households meeting Islamic Zakat eligibility criteria (Fuqara & Masakeen) after field assessment.'
    },
    {
        name: 'Education Assistance',
        description: 'Low-income families with school or university students needing bursaries, uniforms, and learning materials.'
    },
    {
        name: 'Emergency Relief',
        description: 'Households facing sudden crisis, disaster displacement, or acute income loss requiring immediate humanitarian intervention.'
    },
    {
        name: 'Livelihood & Self-Employment',
        description: 'Families eligible for micro-enterprise grants, vocational tools, or self-employment startup support.'
    }
];

function escapeBenCatHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBenCategoryVisualMeta(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('widow') || n.includes('single mother') || n.includes('female')) {
        return { icon: 'heart-handshake', color: '#ec4899', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.28)' };
    }
    if (n.includes('orphan') || n.includes('child')) {
        return { icon: 'baby', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)' };
    }
    if (n.includes('medical') || n.includes('illness') || n.includes('health') || n.includes('sick') || n.includes('patient') || n.includes('kidney')) {
        return { icon: 'heart-pulse', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)' };
    }
    if (n.includes('disab') || n.includes('special') || n.includes('diff')) {
        return { icon: 'accessibility', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.28)' };
    }
    if (n.includes('elder') || n.includes('senior') || n.includes('old')) {
        return { icon: 'user-check', color: '#d97706', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' };
    }
    if (n.includes('zakat')) {
        return { icon: 'hand-coins', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)' };
    }
    if (n.includes('educat') || n.includes('student') || n.includes('school') || n.includes('schol')) {
        return { icon: 'graduation-cap', color: '#0284c7', bg: 'rgba(2,132,199,0.12)', border: 'rgba(2,132,199,0.28)' };
    }
    if (n.includes('emerg') || n.includes('disaster') || n.includes('relief') || n.includes('urgent')) {
        return { icon: 'siren', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.28)' };
    }
    if (n.includes('livelihood') || n.includes('employ') || n.includes('business') || n.includes('job')) {
        return { icon: 'briefcase', color: '#059669', bg: 'rgba(5,150,105,0.12)', border: 'rgba(5,150,105,0.28)' };
    }
    return { icon: 'tag', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)' };
}

function getBenCategoryHouseholdCount(catName) {
    if (!catName || !Array.isArray(currentBeneficiaries)) return 0;
    const target = String(catName).trim().toLowerCase();
    return currentBeneficiaries.filter(b => String(b.category || '').trim().toLowerCase() === target).length;
}

function updateBenCategoryKpis() {
    const totalCats = categoryData.length;
    const headerPill = document.getElementById('bcatHeaderCountPill');
    if (headerPill) headerPill.textContent = `${totalCats} ${totalCats === 1 ? 'Category' : 'Categories'}`;

    const statTotal = document.getElementById('bcatStatTotal');
    if (statTotal) statTotal.textContent = String(totalCats);

    const bens = Array.isArray(currentBeneficiaries) ? currentBeneficiaries : [];
    const assignedCount = bens.filter(b => b.category && String(b.category).trim() !== '').length;
    const unassignedCount = Math.max(0, bens.length - assignedCount);

    const statAssigned = document.getElementById('bcatStatAssigned');
    const statAssignedSub = document.getElementById('bcatStatAssignedSub');
    if (statAssigned) statAssigned.textContent = String(assignedCount);
    if (statAssignedSub) statAssignedSub.textContent = `${unassignedCount} uncategorized of ${bens.length}`;

    let topName = '—';
    let topCount = 0;
    categoryData.forEach(c => {
        const cnt = getBenCategoryHouseholdCount(c.name);
        if (cnt > topCount) {
            topCount = cnt;
            topName = c.name;
        }
    });

    const statTop = document.getElementById('bcatStatTop');
    const statTopSub = document.getElementById('bcatStatTopSub');
    if (statTop) {
        statTop.textContent = topCount > 0 ? topName : (totalCats > 0 ? categoryData[0].name : '—');
        statTop.title = statTop.textContent;
    }
    if (statTopSub) {
        statTopSub.textContent = topCount > 0
            ? `${topCount} ${topCount === 1 ? 'household' : 'households'} assigned`
            : 'No households assigned yet';
    }
}

function updateBenPresetChipsState() {
    const wrap = document.getElementById('bcatPresetChipsWrap');
    if (!wrap) return;
    const currentVal = (document.getElementById('categoryName')?.value || '').trim().toLowerCase();
    const existingSet = new Set(categoryData.map(c => String(c.name || '').trim().toLowerCase()));

    wrap.querySelectorAll('.bcat-preset-chip').forEach(btn => {
        const presetName = (btn.getAttribute('data-preset-name') || '').trim();
        const lower = presetName.toLowerCase();
        btn.classList.toggle('active', lower === currentVal && lower !== '');
        btn.classList.toggle('already-exists', existingSet.has(lower));
        btn.title = existingSet.has(lower)
            ? `"${presetName}" is already in your categories list`
            : `Click to auto-fill "${presetName}"`;
    });
}

function renderBeneficiaryCategoriesTable() {
    const tbody = document.getElementById('beneficiaryCategoriesBody');
    if (!tbody) return;

    const searchInput = document.getElementById('bcatSearchInput');
    const clearBtn = document.getElementById('bcatSearchClearBtn');
    const countLabel = document.getElementById('bcatFilterCountLabel');
    const q = (searchInput?.value || '').trim().toLowerCase();

    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';

    const editingId = document.getElementById('categoryFormPanel')?.style.display !== 'none'
        ? Number(document.getElementById('categoryRecordId')?.value || 0)
        : 0;

    const filtered = categoryData.filter(c => {
        if (!q) return true;
        return (c.name || '').toLowerCase().includes(q) ||
               (c.description || '').toLowerCase().includes(q);
    });

    if (countLabel) {
        countLabel.textContent = q
            ? `Showing ${filtered.length} of ${categoryData.length}`
            : `${categoryData.length} ${categoryData.length === 1 ? 'category' : 'categories'}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:2.25rem 1.25rem;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.55rem;">
                        <div style="width:44px; height:44px; border-radius:12px; background:rgba(16,185,129,0.1); color:#10b981; display:flex; align-items:center; justify-content:center;">
                            <i data-lucide="${q ? 'search-x' : 'tags'}" style="width:20px;height:20px;"></i>
                        </div>
                        <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">
                            ${q ? 'No matching categories found' : 'No beneficiary categories defined yet'}
                        </div>
                        <div style="font-size:0.76rem; color:var(--text-muted); max-width:360px;">
                            ${q
                                ? 'Try clearing your search filter or create a new category with that name.'
                                : 'Create a custom welfare classification or load standard EDF humanitarian categories in one click.'}
                        </div>
                        <div style="display:flex; gap:0.5rem; margin-top:0.35rem; flex-wrap:wrap; justify-content:center;">
                            <button type="button" class="btn btn-primary" style="padding:0.42rem 0.9rem; font-size:0.78rem; background:#10b981; border-color:#10b981;" onclick="openCategoryForm('add')">
                                <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add New Category
                            </button>
                            ${!q ? `
                            <button type="button" class="btn btn-outline" style="padding:0.42rem 0.9rem; font-size:0.78rem;" onclick="seedDefaultBeneficiaryCategories()">
                                <i data-lucide="wand-2" style="width:14px;height:14px;"></i> Load Standard Presets
                            </button>` : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    tbody.innerHTML = filtered.map((c, idx) => {
        const meta = getBenCategoryVisualMeta(c.name);
        const famCount = getBenCategoryHouseholdCount(c.name);
        const isEditing = editingId === Number(c.id);
        const safeName = escapeBenCatHtml(c.name);
        const safeDesc = c.description ? escapeBenCatHtml(c.description) : '';
        const jsSafeName = String(c.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
            <tr class="${isEditing ? 'bcat-row-editing' : ''}">
                <td style="text-align:center; font-size:0.75rem; font-weight:700; color:var(--text-muted);">${idx + 1}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                        <span class="bcat-badge-chip" style="background:${meta.bg}; color:${meta.color}; border-color:${meta.border};">
                            <i data-lucide="${meta.icon}" style="width:13px;height:13px;"></i>
                            <span>${safeName}</span>
                        </span>
                        ${isEditing ? '<span style="font-size:0.62rem; font-weight:800; text-transform:uppercase; padding:0.1rem 0.42rem; border-radius:99px; background:rgba(99,102,241,0.14); color:#6366f1;">Editing</span>' : ''}
                    </div>
                </td>
                <td style="font-size:0.8rem; color:${safeDesc ? 'var(--text-main)' : 'var(--text-muted)'}; line-height:1.4;">
                    ${safeDesc || '<span style="font-style:italic; opacity:0.75;">No eligibility description provided</span>'}
                </td>
                <td style="text-align:center;">
                    <button type="button" class="bcat-usage-pill ${famCount > 0 ? 'has-families' : ''}"
                        onclick="filterBeneficiariesByCategoryFromModal('${jsSafeName}')"
                        title="Click to filter Beneficiaries list by ${safeName}">
                        <i data-lucide="users" style="width:11px;height:11px;"></i>
                        <span>${famCount} ${famCount === 1 ? 'Family' : 'Families'}</span>
                    </button>
                </td>
                <td style="text-align:right; white-space:nowrap;">
                    <div style="display:inline-flex; align-items:center; gap:0.35rem;">
                        <button type="button" class="bcat-action-btn edit"
                            onclick="openCategoryForm('edit', ${c.id})" title="Edit ${safeName}">
                            <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
                        </button>
                        <button type="button" class="bcat-action-btn del"
                            onclick="deleteCategory(${c.id})" title="Delete ${safeName}">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

async function fetchBeneficiaryCategories() {
    try {
        const res = await fetch('/api/edf/beneficiary-categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const categories = await res.json();
        categoryData = Array.isArray(categories) ? categories : [];
        updateBenCategoryKpis();
        updateBenPresetChipsState();
        renderBeneficiaryCategoriesTable();
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function openBeneficiaryCategories() {
    cancelCategoryForm();
    const searchInput = document.getElementById('bcatSearchInput');
    if (searchInput) searchInput.value = '';
    fetchBeneficiaryCategories();
    openModal('beneficiaryCategoryModal');
}

function onBenCategoryNameInput(val) {
    const trimmed = String(val || '').trim();
    const len = String(val || '').length;

    const charCount = document.getElementById('bcatNameCharCount');
    if (charCount) charCount.textContent = `${len} / 50`;

    const clearBtn = document.getElementById('bcatClearNameBtn');
    if (clearBtn) clearBtn.style.display = len > 0 ? 'inline-flex' : 'none';

    // Update live badge preview
    const preview = document.getElementById('bcatLiveBadgePreview');
    if (preview) {
        const label = trimmed || 'New Category';
        const meta = getBenCategoryVisualMeta(label);
        preview.style.background = meta.bg;
        preview.style.color = meta.color;
        preview.style.borderColor = meta.border;
        preview.innerHTML = `<i data-lucide="${meta.icon}" style="width:12px;height:12px;"></i><span>${escapeBenCatHtml(label)}</span>`;
    }

    // Duplicate name check (ignoring current record when editing)
    const editId = Number(document.getElementById('categoryRecordId')?.value || 0);
    const dup = trimmed
        ? categoryData.find(c => String(c.name || '').trim().toLowerCase() === trimmed.toLowerCase() && Number(c.id) !== editId)
        : null;
    const dupWarn = document.getElementById('bcatDuplicateWarn');
    const dupText = document.getElementById('bcatDuplicateWarnText');
    if (dupWarn) {
        dupWarn.style.display = dup ? 'flex' : 'none';
        if (dup && dupText) {
            dupText.textContent = `"${dup.name}" already exists in your categories list. You can edit it below or choose a distinct name.`;
        }
    }

    updateBenPresetChipsState();
    if (window.lucide) lucide.createIcons();
}

function applyBenCategoryPreset(name, description) {
    const nameEl = document.getElementById('categoryName');
    const descEl = document.getElementById('categoryDescription');
    if (nameEl) nameEl.value = name || '';
    if (descEl) descEl.value = description || '';
    onBenCategoryNameInput(name || '');
    if (nameEl) nameEl.focus();
}

function appendBenCategoryDescTag(tagText) {
    const descEl = document.getElementById('categoryDescription');
    if (!descEl || !tagText) return;
    const cur = descEl.value.trim();
    if (cur.toLowerCase().includes(tagText.toLowerCase())) {
        showToast('Criteria tag already included in description', 'info');
        return;
    }
    const sep = cur ? (cur.endsWith('.') || cur.endsWith(';') ? ' ' : ' · ') : '';
    descEl.value = cur + sep + tagText;
    descEl.focus();
}

function resetCategoryFormFields() {
    const editId = Number(document.getElementById('categoryRecordId')?.value || 0);
    if (editId) {
        openCategoryForm('edit', editId);
    } else {
        const nameEl = document.getElementById('categoryName');
        const descEl = document.getElementById('categoryDescription');
        if (nameEl) nameEl.value = '';
        if (descEl) descEl.value = '';
        onBenCategoryNameInput('');
        if (nameEl) nameEl.focus();
    }
}

function openCategoryForm(mode, catId = null) {
    const panel = document.getElementById('categoryFormPanel');
    const title = document.getElementById('categoryFormTitle');
    const modePill = document.getElementById('bcatFormModePill');
    const subtitle = document.getElementById('bcatFormSubtitle');
    const iconBox = document.getElementById('bcatStudioIconBox');
    const saveAnotherBtn = document.getElementById('bcatSaveAnotherBtn');
    const submitBtn = document.getElementById('categorySubmitBtn');
    const hintText = document.getElementById('bcatStudioHintText');
    const cat = catId ? categoryData.find(c => Number(c.id) === Number(catId)) : null;
    const isEdit = mode === 'edit' && !!cat;

    document.getElementById('categoryRecordId').value = isEdit ? cat.id : '';
    document.getElementById('categoryName').value = isEdit ? cat.name : '';
    document.getElementById('categoryDescription').value = isEdit ? (cat.description || '') : '';

    if (panel) {
        panel.classList.toggle('edit-mode', isEdit);
        panel.style.display = 'block';
    }
    if (title) title.textContent = isEdit ? `Edit Category: ${cat.name}` : 'Add New Category';
    if (modePill) modePill.textContent = isEdit ? `Editing #${cat.id}` : 'New Classification';
    if (subtitle) {
        subtitle.textContent = isEdit
            ? 'Update the category name or eligibility notes across the beneficiaries module'
            : 'Create a welfare classification for beneficiary registration & filtering';
    }
    if (iconBox) {
        iconBox.innerHTML = `<i data-lucide="${isEdit ? 'edit-3' : 'folder-plus'}" style="width:18px;height:18px;"></i>`;
    }
    if (saveAnotherBtn) {
        saveAnotherBtn.style.display = isEdit ? 'none' : 'inline-flex';
    }
    if (hintText) {
        hintText.textContent = isEdit
            ? `Assigned to ${getBenCategoryHouseholdCount(cat.name)} household(s)`
            : 'Fill details or pick a preset above';
    }
    if (submitBtn) {
        submitBtn.style.background = isEdit ? '#6366f1' : '#10b981';
        submitBtn.style.borderColor = isEdit ? '#6366f1' : '#10b981';
        submitBtn.innerHTML = isEdit
            ? '<i data-lucide="save" style="width:14px;height:14px;"></i> Update Category'
            : '<i data-lucide="check-circle" style="width:14px;height:14px;"></i> Save Category';
    }

    onBenCategoryNameInput(isEdit ? cat.name : '');
    renderBeneficiaryCategoriesTable();
    if (window.lucide) lucide.createIcons();

    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
        const nameInput = document.getElementById('categoryName');
        if (nameInput) nameInput.focus();
    }, 80);
}

function cancelCategoryForm() {
    const panel = document.getElementById('categoryFormPanel');
    if (panel) {
        panel.style.display = 'none';
        panel.classList.remove('edit-mode');
    }
    const form = document.getElementById('beneficiaryCategoryForm');
    if (form) form.reset();
    const rid = document.getElementById('categoryRecordId');
    if (rid) rid.value = '';
    onBenCategoryNameInput('');
    renderBeneficiaryCategoriesTable();
}

function submitBeneficiaryCategoryForm(saveAndAnother = false) {
    _bcatSaveAndAnother = Boolean(saveAndAnother);
    const form = document.getElementById('beneficiaryCategoryForm');
    if (form) form.requestSubmit();
}

async function saveCategoryRecord(e) {
    e.preventDefault();
    const saveAnother = _bcatSaveAndAnother;
    _bcatSaveAndAnother = false;

    const id = document.getElementById('categoryRecordId').value;
    const nameVal = document.getElementById('categoryName').value.trim();
    const descVal = document.getElementById('categoryDescription').value.trim();

    if (!nameVal) {
        showToast('Please enter a category name', 'error');
        document.getElementById('categoryName')?.focus();
        return;
    }

    const payload = { name: nameVal, description: descVal };
    const isEdit = !!id;
    const url = isEdit ? `/api/edf/beneficiary-categories/${id}` : '/api/edf/beneficiary-categories';
    const submitBtn = document.getElementById('categorySubmitBtn');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok) {
            showToast(isEdit ? `Category "${nameVal}" updated` : `Category "${nameVal}" added`, 'success');
            await fetchBeneficiaryCategories();
            await populateBeneficiaryCategorySelect();
            await populateBenCategoryFilter();

            // If Beneficiary Registration modal is open in background, auto-select the newly saved category
            const benModal = document.getElementById('beneficiaryModal');
            const benCatSelect = document.getElementById('beneficiaryCategorySelect');
            if (benModal && benModal.style.display === 'flex' && benCatSelect) {
                benCatSelect.value = nameVal;
                if (typeof updateBenLivePreview === 'function') updateBenLivePreview();
            }

            if (saveAnother && !isEdit) {
                openCategoryForm('add');
            } else {
                cancelCategoryForm();
            }
        } else {
            showToast(result.message || 'Operation failed', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function seedDefaultBeneficiaryCategories() {
    const existingNames = new Set(categoryData.map(c => String(c.name || '').trim().toLowerCase()));
    const missing = DEFAULT_BEN_CATEGORY_PRESETS.filter(p => !existingNames.has(p.name.toLowerCase()));

    if (missing.length === 0) {
        showToast('All standard humanitarian categories are already in your list', 'info');
        return;
    }

    const btn = document.getElementById('bcatSeedDefaultsBtn');
    if (btn) btn.disabled = true;

    let addedCount = 0;
    try {
        for (const item of missing) {
            const res = await fetch('/api/edf/beneficiary-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (res.ok) addedCount++;
        }
        if (addedCount > 0) {
            showToast(`Added ${addedCount} standard humanitarian ${addedCount === 1 ? 'category' : 'categories'}`, 'success');
            await fetchBeneficiaryCategories();
            await populateBeneficiaryCategorySelect();
            await populateBenCategoryFilter();
        }
    } catch (err) {
        showToast('Error loading preset categories', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function filterBeneficiariesByCategoryFromModal(catName) {
    if (!catName) return;
    const sel = document.getElementById('benCategoryFilter');
    if (sel) sel.value = catName;
    if (typeof setBenCategoryFilter === 'function') {
        setBenCategoryFilter(catName);
    }
    closeModal('beneficiaryCategoryModal');
    showToast(`Filtered beneficiaries by category: ${catName}`, 'info');
}

async function deleteCategory(id) {
    const cat = categoryData.find(c => Number(c.id) === Number(id));
    const famCount = cat ? getBenCategoryHouseholdCount(cat.name) : 0;
    const confirmMsg = famCount > 0
        ? `Delete category "${cat.name}"? Note: ${famCount} registered household(s) currently reference this category name.`
        : `Delete category "${cat ? cat.name : ''}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;
    try {
        const res = await fetch(`/api/edf/beneficiary-categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
            if (Number(document.getElementById('categoryRecordId')?.value || 0) === Number(id)) {
                cancelCategoryForm();
            }
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

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY REGISTRY & HUMANITARIAN AID SUITE — ENHANCED UI/UX, FILTERS & PAGINATION
// ═══════════════════════════════════════════════════════════════════════════
let currentFamilies = [];
let _familyPovertyFilter  = 'all';
let _familyStatusFilter   = 'all';
let _familyTownFilter     = 'all';
let _familyCategoryFilter = 'all';
let _familyHousingFilter  = 'all';
let _familyAidStatusFilter = 'all';
let _familySizeFilter     = 'all';
let _familySortKey        = 'created_at';
let _familySortDir        = 'desc';
let _famPage              = 1;
let _famPageSize          = 10;
let _familyViewMode       = 'table'; // 'table' | 'grid'
let _selectedFamilyIds    = new Set();
let _currentPageFamilyIds = [];

const FAMILY_AID_CATEGORY_LABELS = {
    zakat_eligible: 'Zakat Eligible',
    dry_ration:     'Dry Ration',
    medical:        'Medical Aid',
    education:      'Education',
    widow_orphan:   'Widow & Orphan',
    livelihood:     'Livelihood',
    emergency:      'Emergency Relief',
    general:        'General Welfare'
};

const FAMILY_HOUSING_LABELS = {
    own:       'Own House',
    rented:    'Rented House',
    shared:    'Shared / Joint',
    temporary: 'Temporary Shelter',
    homeless:  'Displaced / Homeless'
};

const FAMILY_VULN_TAG_LABELS = {
    widow_headed:        'Widow / Single Mother',
    orphans:             'Orphaned Children',
    chronic_illness:     'Chronic Illness',
    disability:          'Disability / Special Needs',
    no_steady_income:    'No Steady Income',
    debt_burden:         'Heavy Debt',
    elderly_alone:       'Elderly Alone',
    school_dropout_risk: 'Schooling At Risk'
};

async function fetchFamilyStats() {
    try {
        const s = await (await fetch('/api/edf/families/stats')).json();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const total = s.total ?? currentFamilies.length ?? 0;
        const totalMembers = s.totalMembers ?? currentFamilies.reduce((acc, f) => acc + (Number(f.member_count) || 0), 0);
        const avgSize = total > 0 ? (totalMembers / total).toFixed(1) : '0';
        const totalAid = Number(s.totalAid || 0);
        const grantsCount = Number(s.aidGrantsCount || 0);
        const aidedFamCount = Number(s.aidedFamiliesCount || 0);
        const unaidedFamCount = Number(s.unaidedFamiliesCount ?? Math.max(0, total - aidedFamCount));
        const avgAid = aidedFamCount > 0 ? Math.round(totalAid / aidedFamCount) : 0;

        set('fStatTotal',        total);
        set('fStatMembersCount', totalMembers.toLocaleString());
        set('fStatAvgSize',      `Avg: ${avgSize} / fam`);
        set('fStatActive',       s.active ?? 0);
        set('fStatPendingSub',   `${s.pending ?? 0} Pending`);
        set('fStatInactiveSub',  `${s.inactive ?? 0} Inactive`);
        set('fStatHighNeed',     s.highNeed ?? 0);
        set('fStatMediumSub',    `Med: ${s.mediumNeed ?? 0}`);
        set('fStatLowSub',       `Low: ${s.lowNeed ?? 0}`);
        set('fStatZakat',        s.zakatEligible ?? s.highNeed ?? 0);
        set('fStatUnaidedChip',  `${unaidedFamCount} Never Aided`);
        set('fStatAidedSub',     `${aidedFamCount} Aided`);
        set('fStatAid',          'LKR ' + totalAid.toLocaleString());
        set('fStatGrantsCount',  `${grantsCount} Grant${grantsCount !== 1 ? 's' : ''}`);
        set('fStatAvgAid',       `Avg: LKR ${avgAid.toLocaleString()}`);
        set('famHeroSubtitleBadge', `${total} Registered Household${total !== 1 ? 's' : ''}`);
    } catch (err) { console.error(err); }
}

async function fetchFamilies() {
    try {
        const res = await fetch('/api/edf/families');
        currentFamilies = await res.json();
        populateFamilyTownFilter();
        updateFamilyFilterPillCounts();
        fetchFamilyStats();
        renderFamilies();
    } catch (err) { console.error(err); }
}

function populateFamilyTownFilter() {
    const sel = document.getElementById('famTownFilter');
    if (!sel) return;
    const prev = sel.value || 'all';
    const towns = [...new Set(
        currentFamilies
            .map(f => (f.city || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    sel.innerHTML = `<option value="all">All Towns / Cities (${towns.length})</option>` +
        towns.map(t => `<option value="${t}">${t}</option>`).join('');
    if ([...sel.options].some(o => o.value === prev)) {
        sel.value = prev;
    } else {
        sel.value = 'all';
        _familyTownFilter = 'all';
    }
}

function updateFamilyFilterPillCounts() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('famCountPovAll',      currentFamilies.length);
    set('famCountPovHigh',     currentFamilies.filter(f => f.poverty_level === 'high').length);
    set('famCountPovMed',      currentFamilies.filter(f => f.poverty_level === 'medium').length);
    set('famCountPovLow',      currentFamilies.filter(f => (f.poverty_level || 'low') === 'low').length);
    set('famCountStatActive',  currentFamilies.filter(f => (f.status || 'active') === 'active').length);
    set('famCountStatPending', currentFamilies.filter(f => f.status === 'pending').length);
    set('famCountStatInactive',currentFamilies.filter(f => f.status === 'inactive').length);
}

function filterFamilies() {
    renderFamilies();
}

function setFamilyPovertyFilter(val) {
    _familyPovertyFilter = val;
    _famPage = 1;
    document.querySelectorAll('[id^="fPov-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fPov-' + val)?.classList.add('active');
    renderFamilies();
}

function setFamilyStatusFilter(val) {
    _familyStatusFilter = val;
    _famPage = 1;
    document.querySelectorAll('[id^="fStat-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fStat-' + val)?.classList.add('active');
    renderFamilies();
}

function setFamilyAdvFilter(type, val) {
    if (type === 'town')      _familyTownFilter = val;
    if (type === 'category')  _familyCategoryFilter = val;
    if (type === 'housing')   _familyHousingFilter = val;
    if (type === 'aidStatus') _familyAidStatusFilter = val;
    if (type === 'size')      _familySizeFilter = val;
    _famPage = 1;

    // Highlight active select dropdowns
    const map = {
        town: 'famTownFilter',
        category: 'famCategoryFilter',
        housing: 'famHousingFilter',
        aidStatus: 'famAidStatusFilter',
        size: 'famSizeFilter'
    };
    const sel = document.getElementById(map[type]);
    if (sel) sel.classList.toggle('active-select', val !== 'all');

    renderFamilies();
}

function setFamilyQuickFilter(mode) {
    if (mode === 'unaided') {
        const sel = document.getElementById('famAidStatusFilter');
        if (sel) { sel.value = 'unaided'; sel.classList.add('active-select'); }
        _familyAidStatusFilter = 'unaided';
        _famPage = 1;
        renderFamilies();
    } else if (mode === 'aided') {
        const sel = document.getElementById('famAidStatusFilter');
        if (sel) { sel.value = 'aided'; sel.classList.add('active-select'); }
        _familyAidStatusFilter = 'aided';
        _famPage = 1;
        renderFamilies();
    }
}

function resetFamilyFilters() {
    _familyPovertyFilter   = 'all';
    _familyStatusFilter    = 'all';
    _familyTownFilter      = 'all';
    _familyCategoryFilter  = 'all';
    _familyHousingFilter   = 'all';
    _familyAidStatusFilter = 'all';
    _familySizeFilter      = 'all';
    _familySortKey         = 'created_at';
    _familySortDir         = 'desc';
    _famPage               = 1;

    const searchEl = document.getElementById('familySearchInput');
    if (searchEl) searchEl.value = '';

    document.querySelectorAll('[id^="fPov-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fPov-all')?.classList.add('active');
    document.querySelectorAll('[id^="fStat-"]').forEach(el => el.classList.remove('active'));
    document.getElementById('fStat-all')?.classList.add('active');

    ['famTownFilter', 'famCategoryFilter', 'famHousingFilter', 'famAidStatusFilter', 'famSizeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = 'all'; el.classList.remove('active-select'); }
    });
    const sortSel = document.getElementById('famSortSelect');
    if (sortSel) sortSel.value = 'created_at:desc';

    renderFamilies();
}

function onFamilySortDropdownChange(val) {
    const [key, dir] = (val || 'created_at:desc').split(':');
    _familySortKey = key || 'created_at';
    _familySortDir = dir || 'desc';
    _famPage = 1;
    renderFamilies();
}

function sortFamilies(key) {
    if (_familySortKey === key) {
        _familySortDir = _familySortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _familySortKey = key;
        _familySortDir = key === 'head_name' || key === 'address' ? 'asc' : 'desc';
    }
    _famPage = 1;
    const sortSel = document.getElementById('famSortSelect');
    if (sortSel) {
        const candidate = `${_familySortKey}:${_familySortDir}`;
        if ([...sortSel.options].some(o => o.value === candidate)) sortSel.value = candidate;
    }
    renderFamilies();
}

function setFamilyViewMode(mode) {
    _familyViewMode = mode === 'grid' ? 'grid' : 'table';
    document.getElementById('famViewTableBtn')?.classList.toggle('active', _familyViewMode === 'table');
    document.getElementById('famViewGridBtn')?.classList.toggle('active', _familyViewMode === 'grid');
    const tableWrap = document.getElementById('famTableViewWrap');
    const gridWrap  = document.getElementById('famGridViewWrap');
    if (tableWrap) tableWrap.style.display = _familyViewMode === 'table' ? 'block' : 'none';
    if (gridWrap)  gridWrap.style.display  = _familyViewMode === 'grid'  ? 'grid'  : 'none';
    renderFamilies();
}

function getFilteredAndSortedFamilies() {
    const search = (document.getElementById('familySearchInput')?.value || '').toLowerCase().trim();
    const clearBtn = document.getElementById('famSearchClearBtn');
    if (clearBtn) clearBtn.style.display = search ? 'inline-block' : 'none';

    const povertyOrder = { low: 1, medium: 2, high: 3 };
    const now = Date.now();
    const dayMs = 86400000;

    // Show/hide Reset Filters button
    const hasActiveFilter = (
        !!search ||
        _familyPovertyFilter !== 'all' ||
        _familyStatusFilter !== 'all' ||
        _familyTownFilter !== 'all' ||
        _familyCategoryFilter !== 'all' ||
        _familyHousingFilter !== 'all' ||
        _familyAidStatusFilter !== 'all' ||
        _familySizeFilter !== 'all'
    );
    const resetBtn = document.getElementById('famResetFiltersBtn');
    if (resetBtn) resetBtn.style.display = hasActiveFilter ? 'inline-flex' : 'none';

    let list = currentFamilies.filter(f => {
        const pov = f.poverty_level || 'low';
        const status = f.status || 'active';
        const town = (f.city || '').trim();
        const cat = f.aid_category || 'general';
        const housing = f.housing_type || 'own';
        const memCount = Number(f.member_count) || 1;
        const aidCount = Number(f.aid_count) || 0;
        const lastAidTs = f.last_aid_date ? new Date(f.last_aid_date).getTime() : 0;

        if (_familyPovertyFilter !== 'all' && pov !== _familyPovertyFilter) return false;
        if (_familyStatusFilter !== 'all' && status !== _familyStatusFilter) return false;
        if (_familyTownFilter !== 'all' && town.toLowerCase() !== _familyTownFilter.toLowerCase()) return false;
        if (_familyCategoryFilter !== 'all' && cat !== _familyCategoryFilter) return false;
        if (_familyHousingFilter !== 'all' && housing !== _familyHousingFilter) return false;

        if (_familyAidStatusFilter === 'unaided' && aidCount > 0) return false;
        if (_familyAidStatusFilter === 'aided' && aidCount === 0) return false;
        if (_familyAidStatusFilter === 'recent30' && (!lastAidTs || (now - lastAidTs) > 30 * dayMs)) return false;
        if (_familyAidStatusFilter === 'overdue90' && (lastAidTs && (now - lastAidTs) <= 90 * dayMs)) return false;

        if (_familySizeFilter === 'small' && memCount > 3) return false;
        if (_familySizeFilter === 'medium' && (memCount < 4 || memCount > 6)) return false;
        if (_familySizeFilter === 'large' && memCount < 7) return false;
        if (_familySizeFilter === 'has_children' && !(Number(f.children_count) > 0)) return false;
        if (_familySizeFilter === 'has_elderly' && !(Number(f.elderly_count) > 0)) return false;
        if (_familySizeFilter === 'has_disabled' && !(Number(f.disabled_count) > 0)) return false;

        if (search) {
            const haystack = [
                f.head_name,
                f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`,
                f.nic_number,
                f.phone,
                f.whatsapp,
                f.address,
                f.city,
                f.gn_division,
                f.spouse_name,
                f.head_occupation
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    list.sort((a, b) => {
        let va = a[_familySortKey] ?? '', vb = b[_familySortKey] ?? '';
        if (_familySortKey === 'poverty_level') {
            va = povertyOrder[va] || 0;
            vb = povertyOrder[vb] || 0;
        } else if (['member_count', 'monthly_income', 'total_aid_amount', 'priority_score'].includes(_familySortKey)) {
            va = Number(va) || 0;
            vb = Number(vb) || 0;
        } else if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = String(vb).toLowerCase();
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return _familySortDir === 'asc' ? cmp : -cmp;
    });

    return list;
}

function renderFamilies() {
    const filtered = getFilteredAndSortedFamilies();
    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / _famPageSize));
    if (_famPage > totalPages) _famPage = totalPages;
    if (_famPage < 1) _famPage = 1;

    const start = (_famPage - 1) * _famPageSize;
    const pageItems = filtered.slice(start, start + _famPageSize);
    _currentPageFamilyIds = pageItems.map(f => f.id);

    // Filter count label
    const countEl = document.getElementById('famFilterCount');
    if (countEl) {
        if (totalFiltered === 0) {
            countEl.textContent = currentFamilies.length > 0 ? `0 matches (from ${currentFamilies.length})` : '0 families';
        } else {
            const rangeStr = `${start + 1}–${start + pageItems.length} of ${totalFiltered}`;
            countEl.textContent = totalFiltered < currentFamilies.length
                ? `Showing ${rangeStr} (filtered from ${currentFamilies.length})`
                : `Showing ${rangeStr} families`;
        }
    }

    // Sync Select All checkbox
    const selectAllCb = document.getElementById('famSelectAllCb');
    if (selectAllCb) {
        selectAllCb.checked = pageItems.length > 0 && pageItems.every(f => _selectedFamilyIds.has(f.id));
    }
    updateFamilyBulkBar();

    // Render Table View
    const tbody = document.getElementById('familiesBody');
    if (tbody) {
        if (!pageItems.length) {
            tbody.innerHTML = `<tr>
                <td colspan="9" style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                    <div style="width:48px;height:48px;border-radius:14px;background:var(--input-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem;color:var(--text-muted);">
                        <i data-lucide="home" style="width:24px;height:24px;"></i>
                    </div>
                    <div style="font-size:0.95rem; font-weight:700; color:var(--text-main);">No matching families found</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">Try adjusting your filters or click <strong>+ Register Family</strong> to add a new household.</div>
                </td>
            </tr>`;
        } else {
            tbody.innerHTML = pageItems.map((f, idx) => {
                const pov = f.poverty_level || 'low';
                const status = f.status || 'active';
                const code = f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`;
                const safeName = (f.head_name || '').replace(/'/g, "\\'");
                const initials = (f.head_name || 'F').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const avatarBg = pov === 'high' ? 'rgba(239,68,68,0.12)' : pov === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';
                const avatarColor = pov === 'high' ? '#ef4444' : pov === 'medium' ? '#d97706' : '#10b981';
                const catLabel = FAMILY_AID_CATEGORY_LABELS[f.aid_category || 'general'] || 'General Welfare';
                const housingLabel = FAMILY_HOUSING_LABELS[f.housing_type || 'own'] || 'Own House';

                const adults = f.adults_count != null ? Number(f.adults_count) : (Number(f.member_count) || 1);
                const children = Number(f.children_count) || 0;
                const elderly = Number(f.elderly_count) || 0;
                const disabled = Number(f.disabled_count) || 0;
                const compParts = [`${adults}A`];
                if (children > 0) compParts.push(`${children}C`);
                if (elderly > 0) compParts.push(`${elderly}E`);
                if (disabled > 0) compParts.push(`${disabled}SN`);

                const totalAid = Number(f.total_aid_amount) || 0;
                const aidCount = Number(f.aid_count) || 0;
                const lastAidStr = f.last_aid_date
                    ? new Date(f.last_aid_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : null;

                const tags = (f.vulnerability_tags || '').split(',').map(t => t.trim()).filter(Boolean);
                const firstTag = tags.length > 0 ? (FAMILY_VULN_TAG_LABELS[tags[0]] || tags[0]) : null;
                const extraTags = tags.length > 1 ? `+${tags.length - 1}` : '';

                const statusClass = status === 'active' ? 'status-active' : status === 'pending' ? 'status-pending' : 'status-deactivate';
                const statusText = status === 'active' ? 'Active' : status === 'pending' ? 'Pending' : 'Inactive';
                const isSelected = _selectedFamilyIds.has(f.id);

                return `<tr style="${isSelected ? 'background:rgba(99,102,241,0.06);' : ''}">
                    <td style="text-align:center;">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectFamily(${f.id}, this.checked)" style="cursor:pointer;">
                    </td>
                    <td style="text-align:center; font-size:0.76rem; color:var(--text-muted); font-weight:600;">${start + idx + 1}</td>
                    <td>
                        <div class="fam-head-cell">
                            <div class="fam-avatar" style="background:${avatarBg}; color:${avatarColor}; border-color:transparent; cursor:pointer;" onclick="viewFamily(${f.id})">
                                ${f.photo_url ? `<img src="${f.photo_url}" alt="${f.head_name}">` : initials}
                            </div>
                            <div style="min-width:0;">
                                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                    <a href="javascript:void(0)" onclick="viewFamily(${f.id})" style="font-weight:700; color:var(--text-main); text-decoration:none; font-size:0.88rem;">${f.head_name}</a>
                                    <span class="fam-code-badge">${code}</span>
                                </div>
                                <div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                    <span>${f.nic_number ? `NIC: ${f.nic_number}` : (f.head_occupation || 'Household Head')}</span>
                                    ${f.marital_status && f.marital_status !== 'married' ? `<span style="text-transform:capitalize; color:#d97706; font-weight:600;">• ${f.marital_status}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size:0.82rem; font-weight:600; color:var(--text-main);">
                            ${f.phone ? `<span style="display:inline-flex;align-items:center;gap:4px;"><i data-lucide="phone" style="width:12px;height:12px;color:var(--text-muted);"></i> ${f.phone}</span>` : '<span style="color:var(--text-muted);">No phone</span>'}
                        </div>
                        <div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px; max-width:210px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${f.address || ''}">
                            ${f.city ? `<strong style="color:var(--text-main);">${f.city}</strong> · ` : ''}${f.address || '—'}
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.35rem;">
                            <span class="status-badge" style="font-weight:800;">${f.member_count || 1} ${(Number(f.member_count) || 1) === 1 ? 'Member' : 'Members'}</span>
                        </div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px;">
                            ${compParts.join(' · ')} • ${housingLabel}
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                            <span class="fam-pov-badge fam-pov-${pov}">${pov} Need</span>
                            <span class="fam-tag-chip">${catLabel}</span>
                        </div>
                        <div style="font-size:0.71rem; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                            <span>Inc: LKR ${Number(f.monthly_income || 0).toLocaleString()}/mo</span>
                            ${firstTag ? `<span style="color:#ef4444; font-weight:600;">• ${firstTag} ${extraTags}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        ${aidCount > 0 ? `
                            <div style="font-weight:800; font-size:0.84rem; color:#10b981;">LKR ${totalAid.toLocaleString()}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${aidCount} grant${aidCount !== 1 ? 's' : ''} · Last: ${lastAidStr}</div>
                        ` : `
                            <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.72rem; font-weight:700; color:#f59e0b; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); padding:0.15rem 0.5rem; border-radius:99px;">
                                <i data-lucide="clock" style="width:11px;height:11px;"></i> Never Aided
                            </span>
                        `}
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:0.3rem;">
                            <button type="button" class="fam-action-btn" onclick="viewFamily(${f.id})" title="View Full Household Profile">
                                <i data-lucide="eye" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="fam-action-btn" style="background:rgba(2,132,199,0.1); color:#0284c7; border-color:rgba(2,132,199,0.25);" onclick="openAidModal(${f.id},'${safeName}')" title="Distribute Aid">
                                <i data-lucide="gift" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="fam-action-btn" onclick="viewAidHistory(${f.id},'${safeName}')" title="Aid Distribution History">
                                <i data-lucide="history" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="fam-action-btn" onclick="editFamily(${f.id})" title="Edit Family">
                                <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                            </button>
                            <button type="button" class="fam-action-btn" style="background:rgba(239,68,68,0.1); color:#ef4444; border-color:rgba(239,68,68,0.25);" onclick="deleteFamily(${f.id},'${safeName}')" title="Delete Family">
                                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }
    }

    // Render Card Grid View if active
    const gridWrap = document.getElementById('famGridViewWrap');
    if (gridWrap && _familyViewMode === 'grid') {
        if (!pageItems.length) {
            gridWrap.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem 1.5rem; background:var(--bg-card); border:1px dashed var(--border-color); border-radius:16px; color:var(--text-muted);">
                No matching families found.
            </div>`;
        } else {
            gridWrap.innerHTML = pageItems.map(f => {
                const pov = f.poverty_level || 'low';
                const status = f.status || 'active';
                const code = f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`;
                const safeName = (f.head_name || '').replace(/'/g, "\\'");
                const initials = (f.head_name || 'F').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const catLabel = FAMILY_AID_CATEGORY_LABELS[f.aid_category || 'general'] || 'General Welfare';
                const housingLabel = FAMILY_HOUSING_LABELS[f.housing_type || 'own'] || 'Own House';
                const totalAid = Number(f.total_aid_amount) || 0;
                const aidCount = Number(f.aid_count) || 0;
                return `<div class="fam-grid-card">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                            <div class="fam-head-cell">
                                <div class="fam-avatar" onclick="viewFamily(${f.id})" style="cursor:pointer;">
                                    ${f.photo_url ? `<img src="${f.photo_url}" alt="${f.head_name}">` : initials}
                                </div>
                                <div>
                                    <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); cursor:pointer;" onclick="viewFamily(${f.id})">${f.head_name}</div>
                                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:2px;">
                                        <span class="fam-code-badge">${code}</span>
                                        <span style="font-size:0.72rem; color:var(--text-muted);">${f.city || 'No Town'}</span>
                                    </div>
                                </div>
                            </div>
                            <span class="fam-pov-badge fam-pov-${pov}">${pov}</span>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.85rem; padding:0.65rem; background:var(--input-bg); border-radius:11px; font-size:0.75rem;">
                            <div>
                                <div style="color:var(--text-muted); font-size:0.67rem; font-weight:700; text-transform:uppercase;">Household</div>
                                <div style="font-weight:800; color:var(--text-main); margin-top:1px;">${f.member_count || 1} Members · ${housingLabel}</div>
                            </div>
                            <div>
                                <div style="color:var(--text-muted); font-size:0.67rem; font-weight:700; text-transform:uppercase;">Aid Disbursed</div>
                                <div style="font-weight:800; color:#10b981; margin-top:1px;">LKR ${totalAid.toLocaleString()} (${aidCount})</div>
                            </div>
                            <div>
                                <div style="color:var(--text-muted); font-size:0.67rem; font-weight:700; text-transform:uppercase;">Contact</div>
                                <div style="font-weight:600; color:var(--text-main); margin-top:1px;">${f.phone || '—'}</div>
                            </div>
                            <div>
                                <div style="color:var(--text-muted); font-size:0.67rem; font-weight:700; text-transform:uppercase;">Category</div>
                                <div style="font-weight:700; color:#6366f1; margin-top:1px;">${catLabel}</div>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; padding-top:0.65rem; border-top:1px solid var(--border-color);">
                        <span class="status-badge ${status === 'active' ? 'status-active' : 'status-deactivate'}">${status}</span>
                        <div style="display:flex; gap:0.35rem;">
                            <button type="button" class="fam-action-btn" onclick="viewFamily(${f.id})" title="View Profile"><i data-lucide="eye" style="width:14px;height:14px;"></i></button>
                            <button type="button" class="fam-action-btn" style="color:#0284c7;" onclick="openAidModal(${f.id},'${safeName}')" title="Distribute Aid"><i data-lucide="gift" style="width:14px;height:14px;"></i></button>
                            <button type="button" class="fam-action-btn" onclick="viewAidHistory(${f.id},'${safeName}')" title="Aid History"><i data-lucide="history" style="width:14px;height:14px;"></i></button>
                            <button type="button" class="fam-action-btn" onclick="editFamily(${f.id})" title="Edit"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                            <button type="button" class="fam-action-btn" style="color:#ef4444;" onclick="deleteFamily(${f.id},'${safeName}')" title="Delete"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    renderFamilyPaginationBar(totalFiltered, totalPages, start, pageItems.length);
    lucide.createIcons();
}

function renderFamilyPaginationBar(totalFiltered, totalPages, start, showingCount) {
    const bar = document.getElementById('famPaginationBar');
    if (!bar) return;

    if (totalFiltered === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    // Build page number buttons with ellipsis
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= _famPage - 1 && i <= _famPage + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    const pageBtnsHtml = pages.map(p => {
        if (p === '...') return `<span style="padding:0 0.3rem; color:var(--text-muted); font-weight:700;">…</span>`;
        return `<button type="button" class="fam-page-btn ${p === _famPage ? 'active' : ''}" onclick="goToFamilyPage(${p})">${p}</button>`;
    }).join('');

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.55rem; font-size:0.79rem; color:var(--text-muted);">
            <span>Rows per page:</span>
            <select onchange="changeFamilyPageSize(this.value)" class="fam-filter-select" style="padding:0.25rem 0.5rem;">
                ${[10, 15, 25, 50, 100].map(n => `<option value="${n}" ${n === _famPageSize ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <span style="margin-left:0.35rem;">Showing <strong>${start + 1}–${start + showingCount}</strong> of <strong>${totalFiltered}</strong></span>
        </div>

        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
            <button type="button" class="fam-page-btn" ${_famPage <= 1 ? 'disabled' : ''} onclick="goToFamilyPage(1)" title="First Page">
                <i data-lucide="chevrons-left" style="width:14px;height:14px;"></i>
            </button>
            <button type="button" class="fam-page-btn" ${_famPage <= 1 ? 'disabled' : ''} onclick="goToFamilyPage(${_famPage - 1})" title="Previous Page">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i>
            </button>
            ${pageBtnsHtml}
            <button type="button" class="fam-page-btn" ${_famPage >= totalPages ? 'disabled' : ''} onclick="goToFamilyPage(${_famPage + 1})" title="Next Page">
                <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
            </button>
            <button type="button" class="fam-page-btn" ${_famPage >= totalPages ? 'disabled' : ''} onclick="goToFamilyPage(${totalPages})" title="Last Page">
                <i data-lucide="chevrons-right" style="width:14px;height:14px;"></i>
            </button>
        </div>

        <div style="display:flex; align-items:center; gap:0.45rem; font-size:0.79rem; color:var(--text-muted);">
            <span>Page <strong>${_famPage}</strong> of <strong>${totalPages}</strong></span>
        </div>
    `;
}

function goToFamilyPage(p) {
    _famPage = p;
    renderFamilies();
}

function changeFamilyPageSize(val) {
    _famPageSize = parseInt(val, 10) || 10;
    _famPage = 1;
    renderFamilies();
}

// ── Bulk Selection & Actions ──────────────────────────────────────────────
function toggleSelectFamily(id, checked) {
    if (checked) _selectedFamilyIds.add(id);
    else _selectedFamilyIds.delete(id);
    updateFamilyBulkBar();
}

function toggleSelectAllFamilies(checked) {
    _currentPageFamilyIds.forEach(id => {
        if (checked) _selectedFamilyIds.add(id);
        else _selectedFamilyIds.delete(id);
    });
    renderFamilies();
}

function clearFamilySelection() {
    _selectedFamilyIds.clear();
    renderFamilies();
}

function updateFamilyBulkBar() {
    const bar = document.getElementById('famBulkBar');
    const cnt = document.getElementById('famBulkCount');
    if (!bar || !cnt) return;
    cnt.textContent = _selectedFamilyIds.size;
    bar.classList.toggle('visible', _selectedFamilyIds.size > 0);
}

async function executeFamilyBulkAction(action, value = null) {
    const ids = [..._selectedFamilyIds];
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Delete ${ids.length} selected families and all their aid records?`)) return;
    try {
        const res = await fetch('/api/edf/families/bulk-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, action, value })
        });
        if (res.ok) {
            const data = await res.json();
            showToast(data.message || 'Bulk action completed', 'success');
            _selectedFamilyIds.clear();
            fetchFamilies();
            fetchStats();
        } else {
            showToast('Bulk action failed', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// ── Export Families (CSV / Excel) ─────────────────────────────────────────
function exportFamiliesData(format = 'csv', customList = null) {
    const rows = customList || getFilteredAndSortedFamilies();
    if (!rows.length) {
        showToast('No families to export', 'error');
        return;
    }
    const headers = [
        'Family ID', 'Head of Family', 'NIC Number', 'Gender', 'Age', 'Marital Status',
        'Occupation', 'Spouse Name', 'Phone', 'WhatsApp', 'Town / City', 'GN Division',
        'Address', 'Total Members', 'Adults', 'Children', 'Elderly', 'Special Needs',
        'Housing Type', 'Poverty Level', 'Aid Category', 'Monthly Income (LKR)',
        'Priority Score', 'Total Aid Received (LKR)', 'Aid Grants Count', 'Status', 'Registered Date'
    ];
    const dataRows = rows.map(f => [
        f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`,
        f.head_name || '',
        f.nic_number || '',
        f.head_gender || '',
        f.head_age || '',
        f.marital_status || '',
        f.head_occupation || '',
        f.spouse_name || '',
        f.phone || '',
        f.whatsapp || '',
        f.city || '',
        f.gn_division || '',
        f.address || '',
        f.member_count || 1,
        f.adults_count ?? 1,
        f.children_count ?? 0,
        f.elderly_count ?? 0,
        f.disabled_count ?? 0,
        FAMILY_HOUSING_LABELS[f.housing_type || 'own'] || f.housing_type || 'Own House',
        f.poverty_level || 'low',
        FAMILY_AID_CATEGORY_LABELS[f.aid_category || 'general'] || f.aid_category || 'General',
        Number(f.monthly_income || 0),
        Number(f.priority_score || 0),
        Number(f.total_aid_amount || 0),
        Number(f.aid_count || 0),
        f.status || 'active',
        f.created_at ? new Date(f.created_at).toISOString().split('T')[0] : ''
    ]);

    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Family Registry');
        XLSX.writeFile(wb, `EDF_Family_Registry_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast(`Exported ${rows.length} families to Excel`, 'success');
        return;
    }

    const escapeCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...dataRows.map(r => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EDF_Family_Registry_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} families to CSV`, 'success');
}

function exportSelectedFamiliesCSV() {
    const selected = currentFamilies.filter(f => _selectedFamilyIds.has(f.id));
    exportFamiliesData('csv', selected);
}

// ═══════════════════════════════════════════════════════════════════════════
// REDESIGNED REGISTER / EDIT FAMILY MODAL — 4-STEP STEPPER & SMART FEATURES
// ═══════════════════════════════════════════════════════════════════════════
const FAMILY_STEPS = ['fam-tab-head', 'fam-tab-location', 'fam-tab-vulnerability', 'fam-tab-household'];
const FAMILY_STEP_TITLES = [
    'Step 1 of 4 • Head & Identity',
    'Step 2 of 4 • Contact & Housing',
    'Step 3 of 4 • Need & Assessment',
    'Step 4 of 4 • Household & Aid'
];
let _currentFamilyStep = 0;
let _lastFamilyDecodedNic = null;
let _selectedFamilyVulnTags = new Set();

function goToFamilyStep(stepIdx) {
    if (stepIdx < 0 || stepIdx >= FAMILY_STEPS.length) return;
    _currentFamilyStep = stepIdx;
    const modal = document.getElementById('familyModal');
    if (!modal) return;

    const targetTabId = FAMILY_STEPS[stepIdx];
    modal.querySelectorAll('.mem-step-tab').forEach((tab, idx) => {
        tab.classList.remove('active', 'completed');
        if (idx === stepIdx) tab.classList.add('active');
        else if (idx < stepIdx) tab.classList.add('completed');
    });

    modal.querySelectorAll('.modal-tab-content').forEach(panel => {
        panel.classList.toggle('active', panel.id === targetTabId);
    });

    const body = modal.querySelector('.mem-modal-body');
    if (body) body.scrollTop = 0;

    const stepText = document.getElementById('famStepFooterText');
    if (stepText) stepText.textContent = FAMILY_STEP_TITLES[stepIdx];

    const prevBtn = document.getElementById('famPrevStepBtn');
    const nextBtn = document.getElementById('famNextStepBtn');
    if (prevBtn) prevBtn.style.display = stepIdx === 0 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = stepIdx === FAMILY_STEPS.length - 1 ? 'none' : 'inline-flex';

    updateFamilyLivePreview();
}

function stepFamilyModal(delta) {
    const nextIdx = _currentFamilyStep + delta;
    if (delta > 0 && _currentFamilyStep === 0) {
        const nameInput = document.getElementById('famHeadNameInput');
        if (nameInput && !nameInput.value.trim()) {
            nameInput.focus();
            showToast('Please enter the Head of Family Full Name before continuing', 'error');
            return;
        }
    }
    goToFamilyStep(nextIdx);
}

function generateFamilyAutoCode() {
    let nextNum = currentFamilies.length + 1;
    let candidate = `EDF-FAM-${String(nextNum).padStart(3, '0')}`;
    while (currentFamilies.some(f => (f.family_code || '').toUpperCase() === candidate)) {
        nextNum++;
        candidate = `EDF-FAM-${String(nextNum).padStart(3, '0')}`;
    }
    const input = document.getElementById('famCodeInput');
    if (input) input.value = candidate;
    updateFamilyLivePreview();
}

function setFamilyModalStatus(status) {
    const s = ['active', 'pending', 'inactive'].includes(status) ? status : 'active';
    const sel = document.getElementById('famStatusSelect');
    if (sel) sel.value = s;
    document.querySelectorAll('#famStatusSeg .mem-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fstatus === s);
    });
    updateFamilyLivePreview();
}

function setFamilyHeadGender(gender) {
    const g = gender === 'female' ? 'female' : 'male';
    const sel = document.getElementById('famGenderSelect');
    if (sel) sel.value = g;
    document.querySelectorAll('#famGenderSeg .mem-seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === g);
    });
    updateFamilyLivePreview();
}

function setFamilyHousingType(housing) {
    const h = housing || 'own';
    const sel = document.getElementById('famHousingSelect');
    if (sel) sel.value = h;
    document.querySelectorAll('#famHousingPills .fam-housing-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.housing === h);
    });
    updateFamilyLivePreview();
}

function setFamilyModalPoverty(pov) {
    const p = ['low', 'medium', 'high'].includes(pov) ? pov : 'medium';
    const sel = document.getElementById('famPovertySelect');
    if (sel) sel.value = p;
    document.querySelectorAll('#familyModal .fam-poverty-card').forEach(card => {
        card.classList.toggle('active', card.dataset.pov === p);
    });
    updateFamilyLivePreview();
}

function setFamilyIncomePreset(amount) {
    const el = document.getElementById('famIncomeInput');
    if (el) el.value = amount;
    updateFamilyLivePreview();
}

function toggleFamilyVulnTag(tag) {
    if (_selectedFamilyVulnTags.has(tag)) _selectedFamilyVulnTags.delete(tag);
    else _selectedFamilyVulnTags.add(tag);
    syncFamilyVulnTagUI();
    updateFamilyLivePreview();
}

function syncFamilyVulnTagUI() {
    document.querySelectorAll('#famVulnPillsWrap .fam-vuln-pill').forEach(btn => {
        btn.classList.toggle('active', _selectedFamilyVulnTags.has(btn.dataset.vtag));
    });
    const hidden = document.getElementById('famVulnerabilityTagsInput');
    if (hidden) hidden.value = [..._selectedFamilyVulnTags].join(',');
}

function onFamilyMaritalChange(val) {
    if (val === 'widowed' && !_selectedFamilyVulnTags.has('widow_headed')) {
        _selectedFamilyVulnTags.add('widow_headed');
        syncFamilyVulnTagUI();
    }
    updateFamilyLivePreview();
}

function onFamilyNicInput(val) {
    const clean = (val || '').trim();
    const currentId = document.getElementById('familyId')?.value ? Number(document.getElementById('familyId').value) : null;

    // 1. Duplicate check across currentFamilies
    const dupBanner = document.getElementById('famNicDupBanner');
    const dupText = document.getElementById('famNicDupText');
    if (clean.length >= 9) {
        const dup = currentFamilies.find(f => f.id !== currentId && (f.nic_number || '').toUpperCase() === clean.toUpperCase());
        if (dup && dupBanner && dupText) {
            dupBanner.style.display = 'flex';
            dupText.textContent = `⚠️ NIC already registered to family head: ${dup.head_name}`;
        } else if (dupBanner) {
            dupBanner.style.display = 'none';
        }
    } else if (dupBanner) {
        dupBanner.style.display = 'none';
    }

    // 2. Smart Sri Lankan NIC Decode (reuses parseSriLankanNIC)
    const decoded = typeof parseSriLankanNIC === 'function' ? parseSriLankanNIC(clean) : null;
    _lastFamilyDecodedNic = decoded;
    const decBanner = document.getElementById('famNicDecodedBanner');
    const decText = document.getElementById('famNicDecodedText');

    if (decoded && decBanner && decText) {
        decBanner.style.display = 'flex';
        decText.textContent = `✨ NIC Decoded: DOB ${decoded.dob} · Age ${decoded.age} yrs · ${decoded.gender === 'female' ? 'Female' : 'Male'}`;
        const dobEl = document.getElementById('famDobInput');
        const ageEl = document.getElementById('famAgeInput');
        if (dobEl && !dobEl.value) dobEl.value = decoded.dob;
        if (ageEl && !ageEl.value) ageEl.value = decoded.age;
        setFamilyHeadGender(decoded.gender);
    } else if (decBanner) {
        decBanner.style.display = 'none';
    }
    updateFamilyLivePreview();
}

function applyFamilyDecodedNic() {
    if (!_lastFamilyDecodedNic) return;
    const dobEl = document.getElementById('famDobInput');
    const ageEl = document.getElementById('famAgeInput');
    if (dobEl) dobEl.value = _lastFamilyDecodedNic.dob;
    if (ageEl) ageEl.value = _lastFamilyDecodedNic.age;
    setFamilyHeadGender(_lastFamilyDecodedNic.gender);
    updateFamilyLivePreview();
    showToast('Applied DOB, Age & Gender from NIC', 'success');
}

function onFamilyDobChange(dobStr) {
    if (!dobStr) return;
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    const ageInput = document.getElementById('famAgeInput');
    if (ageInput && age >= 0 && age <= 120) ageInput.value = age;
    updateFamilyLivePreview();
}

function onFamilyPhoneInput(val) {
    const clean = (val || '').replace(/\s+/g, '');
    const currentId = document.getElementById('familyId')?.value ? Number(document.getElementById('familyId').value) : null;
    const dupBanner = document.getElementById('famPhoneDupBanner');
    const dupText = document.getElementById('famPhoneDupText');
    if (clean.length >= 9) {
        const dup = currentFamilies.find(f => f.id !== currentId && (f.phone || '').replace(/\s+/g, '') === clean);
        if (dup && dupBanner && dupText) {
            dupBanner.style.display = 'flex';
            dupText.textContent = `ℹ️ Phone number is also linked to family: ${dup.head_name}`;
        } else if (dupBanner) {
            dupBanner.style.display = 'none';
        }
    } else if (dupBanner) {
        dupBanner.style.display = 'none';
    }
    updateFamilyLivePreview();
}

function copyFamilyPhoneToWhatsapp() {
    const phone = document.getElementById('famPhoneInput')?.value || '';
    const wa = document.getElementById('famWhatsappInput');
    if (wa) {
        wa.value = phone;
        showToast('Copied primary phone to WhatsApp', 'info');
    }
}

function copyFamilyHeadToBankHolder() {
    const head = document.getElementById('famHeadNameInput')?.value || '';
    const holder = document.getElementById('famAccountHolderInput');
    if (holder) {
        holder.value = head;
        showToast('Used head name as account holder', 'info');
    }
}

function setFamilyPhotoPreview(url) {
    const hidden = document.getElementById('famPhotoUrl');
    const img = document.getElementById('famPhotoPreview');
    const icon = document.getElementById('famPhotoPlaceholderIcon');
    const rmBtn = document.getElementById('famPhotoRemoveBtn');
    const liveImg = document.getElementById('famLiveAvatarImg');
    const liveInit = document.getElementById('famLiveAvatarInitials');

    if (hidden) hidden.value = url || '';
    if (url) {
        if (img) { img.src = url; img.style.display = 'block'; }
        if (icon) icon.style.display = 'none';
        if (rmBtn) rmBtn.style.display = 'inline-block';
        if (liveImg) { liveImg.src = url; liveImg.style.display = 'block'; }
        if (liveInit) liveInit.style.display = 'none';
    } else {
        if (img) { img.src = ''; img.style.display = 'none'; }
        if (icon) icon.style.display = '';
        if (rmBtn) rmBtn.style.display = 'none';
        if (liveImg) { liveImg.src = ''; liveImg.style.display = 'none'; }
        if (liveInit) liveInit.style.display = '';
    }
}

async function uploadFamilyPhotoFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5 MB', 'error');
        return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    try {
        const res = await fetch('/api/edf/families/upload-photo', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok && data.photo_url) {
            setFamilyPhotoPreview(data.photo_url);
            showToast('Household portrait uploaded', 'success');
        } else {
            showToast(data.message || 'Photo upload failed', 'error');
        }
    } catch (err) {
        showToast('Network error uploading photo', 'error');
    }
}

function handleFamilyPhotoSelect(e) {
    const file = e.target?.files?.[0];
    if (file) uploadFamilyPhotoFile(file);
}

function handleFamilyPhotoDrop(e) {
    e.preventDefault();
    e.currentTarget?.classList?.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadFamilyPhotoFile(file);
}

function removeFamilyPhoto(e) {
    if (e) e.stopPropagation();
    const inp = document.getElementById('famPhotoInput');
    if (inp) inp.value = '';
    setFamilyPhotoPreview('');
}

function stepFamilyCompCount(inputId, delta) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const next = Math.max(0, (parseInt(inp.value, 10) || 0) + delta);
    inp.value = next;
    if (inputId === 'famDisabledInput') {
        updateFamilyLivePreview();
    } else {
        syncFamilyTotalMembers();
    }
}

function syncFamilyTotalMembers() {
    const adults = Math.max(0, parseInt(document.getElementById('famAdultsInput')?.value, 10) || 0);
    const children = Math.max(0, parseInt(document.getElementById('famChildrenInput')?.value, 10) || 0);
    const elderly = Math.max(0, parseInt(document.getElementById('famElderlyInput')?.value, 10) || 0);
    const totalEl = document.getElementById('famMemberCountInput');
    if (totalEl) totalEl.value = Math.max(1, adults + children + elderly);
    updateFamilyLivePreview();
}

function toggleFamilyInitAidFields(checked) {
    const wrap = document.getElementById('famInitAidFieldsWrap');
    if (wrap) wrap.style.display = checked ? 'block' : 'none';
}

function addFamilyDependentRow(dep = null) {
    const container = document.getElementById('famDependentsContainer');
    const empty = document.getElementById('famDepEmptyState');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'fam-dep-row';
    row.style.cssText = 'display:grid; grid-template-columns:1.4fr 0.9fr 0.6fr 1.1fr auto; gap:0.55rem; align-items:center; background:var(--input-bg); border:1px solid var(--border-color); border-radius:10px; padding:0.55rem 0.65rem; margin-bottom:0.5rem;';

    const relOpts = ['child', 'spouse', 'parent', 'sibling', 'dependent', 'other'];
    const selRel = dep?.relation || 'child';
    row.innerHTML = `
        <input type="text" class="form-input fam-dep-name" placeholder="Member Full Name" value="${escapeHtml(dep?.name || '')}" oninput="updateFamilyLivePreview()">
        <select class="form-select fam-dep-rel">
            ${relOpts.map(r => `<option value="${r}" ${selRel === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}
        </select>
        <input type="number" class="form-input fam-dep-age" placeholder="Age" min="0" max="120" value="${dep?.age ?? ''}">
        <input type="text" class="form-input fam-dep-note" placeholder="School grade / health note" value="${escapeHtml(dep?.note || dep?.notes || '')}">
        <button type="button" class="fam-action-btn" style="color:#ef4444;" onclick="this.closest('.fam-dep-row').remove(); syncFamilyDependentsEmptyState();" title="Remove Member">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
    `;
    container.appendChild(row);
    if (empty) empty.style.display = 'none';
    if (window.lucide) lucide.createIcons();
    updateFamilyLivePreview();
}

function syncFamilyDependentsEmptyState() {
    const container = document.getElementById('famDependentsContainer');
    const empty = document.getElementById('famDepEmptyState');
    if (!container || !empty) return;
    empty.style.display = container.querySelectorAll('.fam-dep-row').length ? 'none' : 'block';
    updateFamilyLivePreview();
}

function collectFamilyDependents() {
    const rows = Array.from(document.querySelectorAll('#famDependentsContainer .fam-dep-row'));
    return rows.map(r => ({
        name: (r.querySelector('.fam-dep-name')?.value || '').trim(),
        relation: r.querySelector('.fam-dep-rel')?.value || 'dependent',
        age: r.querySelector('.fam-dep-age')?.value ? Number(r.querySelector('.fam-dep-age').value) : null,
        note: (r.querySelector('.fam-dep-note')?.value || '').trim()
    })).filter(d => d.name);
}

function computeFamilyPriorityScore() {
    const pov = document.getElementById('famPovertySelect')?.value || 'medium';
    const housing = document.getElementById('famHousingSelect')?.value || 'own';
    const income = Number(document.getElementById('famIncomeInput')?.value) || 0;
    const elderly = Number(document.getElementById('famElderlyInput')?.value) || 0;
    const disabled = Number(document.getElementById('famDisabledInput')?.value) || 0;

    let score = pov === 'high' ? 45 : (pov === 'medium' ? 25 : 10);
    if (housing === 'homeless') score += 20;
    else if (housing === 'temporary') score += 15;
    else if (housing === 'shared') score += 10;
    else if (housing === 'rented') score += 5;

    if (income <= 0) score += 15;
    else if (income < 15000) score += 10;
    else if (income < 35000) score += 5;

    score += Math.min(20, _selectedFamilyVulnTags.size * 5);
    if (elderly > 0) score += 5;
    if (disabled > 0) score += 5;
    return Math.max(5, Math.min(100, Math.round(score)));
}

function updateFamilyLivePreview() {
    const name = (document.getElementById('famHeadNameInput')?.value || '').trim();
    const code = (document.getElementById('famCodeInput')?.value || '').trim();
    const nic = (document.getElementById('famNicInput')?.value || '').trim();
    const phone = (document.getElementById('famPhoneInput')?.value || '').trim();
    const city = (document.getElementById('famCityInput')?.value || '').trim();
    const members = Math.max(1, parseInt(document.getElementById('famMemberCountInput')?.value, 10) || 1);
    const pov = document.getElementById('famPovertySelect')?.value || 'medium';
    const cat = document.getElementById('famAidCategorySelect')?.value || 'general';
    const status = document.getElementById('famStatusSelect')?.value || 'active';
    const income = Number(document.getElementById('famIncomeInput')?.value) || 0;
    const expenses = Number(document.getElementById('famExpensesInput')?.value) || 0;
    const occ = (document.getElementById('famOccupationInput')?.value || '').trim();
    const addr = (document.getElementById('famAddressInput')?.value || '').trim();
    const priority = computeFamilyPriorityScore();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('famLiveName', name || 'New Household Profile');
    set('famLiveCodeBadge', code || 'EDF-FAM-NEW');
    set('famLiveMetaNic', nic ? `NIC: ${nic}` : 'NIC: Not set');
    set('famLiveMetaPhone', phone ? `Phone: ${phone}` : 'Phone: Not set');
    set('famLiveMetaCity', city ? `Location: ${city}` : 'Location: —');
    set('famLiveMetaMembers', `Members: ${members}`);
    set('famStepDepBadge', members);
    set('famLivePriorityScore', `${priority} / 100`);
    set('famPriorityScoreDisplay', `${priority}/100`);
    set('famLiveIncomeSub', `Income: LKR ${income.toLocaleString()} / mo`);
    set('famLiveCategoryBadge', FAMILY_AID_CATEGORY_LABELS[cat] || cat.replace(/_/g, ' '));

    const hiddenPri = document.getElementById('famPriorityScoreInput');
    if (hiddenPri) hiddenPri.value = priority;

    const meterFill = document.getElementById('famPriorityMeterFill');
    if (meterFill) {
        meterFill.style.width = priority + '%';
        meterFill.style.background = priority >= 70 ? '#ef4444' : priority >= 45 ? '#f59e0b' : '#10b981';
    }
    const priLabel = document.getElementById('famPriorityLabelTag');
    if (priLabel) {
        if (priority >= 70) { priLabel.textContent = 'Critical Priority'; priLabel.style.color = '#ef4444'; }
        else if (priority >= 45) { priLabel.textContent = 'Moderate Priority'; priLabel.style.color = '#f59e0b'; }
        else { priLabel.textContent = 'Standard Priority'; priLabel.style.color = '#10b981'; }
    }

    const netBadge = document.getElementById('famNetBalanceBadge');
    if (netBadge) {
        const diff = income - expenses;
        if (diff < 0) {
            netBadge.textContent = `Deficit LKR ${Math.abs(diff).toLocaleString()}`;
            netBadge.style.color = '#ef4444';
        } else if (diff > 0) {
            netBadge.textContent = `Surplus LKR ${diff.toLocaleString()}`;
            netBadge.style.color = '#10b981';
        } else {
            netBadge.textContent = 'Break-even';
            netBadge.style.color = 'var(--text-muted)';
        }
    }

    const initEl = document.getElementById('famLiveAvatarInitials');
    if (initEl) {
        const parts = (name || 'F').split(/\s+/).filter(Boolean);
        initEl.textContent = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0]?.[0] || 'F').toUpperCase();
    }

    const povBadge = document.getElementById('famLivePovBadge');
    if (povBadge) {
        povBadge.className = `fam-pov-badge fam-pov-${pov}`;
        povBadge.textContent = pov === 'high' ? 'High Need' : pov === 'medium' ? 'Medium Need' : 'Low Need';
    }

    const stDot = document.getElementById('famLiveStatusDot');
    if (stDot) {
        const color = status === 'active' ? '#10b981' : status === 'pending' ? '#f59e0b' : '#ef4444';
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        stDot.style.color = color;
        stDot.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;"></span> ${label}`;
    }

    const checks = [
        Boolean(name), Boolean(nic), Boolean(occ), Boolean(phone),
        Boolean(city || addr), Boolean(document.getElementById('famAccountNoInput')?.value),
        Boolean(income > 0 || pov === 'high'), Boolean(_selectedFamilyVulnTags.size > 0 || document.getElementById('famNotesInput')?.value),
        Boolean(document.getElementById('famVerifiedByInput')?.value), Boolean(members >= 1)
    ];
    const pct = Math.max(15, Math.round((checks.filter(Boolean).length / checks.length) * 100));
    set('famCompletionLabel', `${pct}% Complete`);
    const fill = document.getElementById('famCompletionFill');
    if (fill) fill.style.width = pct + '%';
}

function openRegisterFamilyModal() {
    const form = document.getElementById('familyForm');
    if (form) form.reset();
    document.getElementById('familyId').value = '';
    setFamilyPhotoPreview('');
    _selectedFamilyVulnTags.clear();
    syncFamilyVulnTagUI();

    const depCont = document.getElementById('famDependentsContainer');
    if (depCont) depCont.innerHTML = '';
    syncFamilyDependentsEmptyState();

    ['famNicDecodedBanner', 'famNicDupBanner', 'famPhoneDupBanner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const initCard = document.getElementById('famInitAidSectionCard');
    if (initCard) initCard.style.display = 'block';
    const initToggle = document.getElementById('famRecordInitAidToggle');
    if (initToggle) initToggle.checked = false;
    toggleFamilyInitAidFields(false);

    const anotherBtn = document.getElementById('saveAndAddAnotherFamilyBtn');
    if (anotherBtn) anotherBtn.style.display = 'inline-flex';

    document.getElementById('familyModalTitle').textContent = 'Register New Family';
    document.getElementById('familyModalSubtitle').textContent = 'Record household head, demographics, vulnerability assessment, dependents & humanitarian aid eligibility';
    document.getElementById('familySubmitBtn').innerHTML = '<i data-lucide="check-circle" style="width:16px;height:16px;"></i> <span>Register Family</span>';

    setFamilyHeadGender('male');
    setFamilyModalStatus('active');
    setFamilyHousingType('own');
    setFamilyModalPoverty('medium');
    generateFamilyAutoCode();
    goToFamilyStep(0);
    openModal('familyModal');
    if (window.lucide) lucide.createIcons();
}

function editFamily(id) {
    const f = currentFamilies.find(x => Number(x.id) === Number(id));
    if (!f) return;
    const form = document.getElementById('familyForm');
    if (form) form.reset();

    document.getElementById('familyId').value = f.id;
    document.getElementById('famCodeInput').value = f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`;
    document.getElementById('famHeadNameInput').value = f.head_name || '';
    document.getElementById('famNicInput').value = f.nic_number || '';
    document.getElementById('famOccupationInput').value = f.head_occupation || '';
    document.getElementById('famDobInput').value = f.head_dob ? String(f.head_dob).split('T')[0] : '';
    document.getElementById('famAgeInput').value = f.head_age ?? '';
    document.getElementById('famMaritalSelect').value = f.marital_status || 'married';
    document.getElementById('famSpouseNameInput').value = f.spouse_name || '';
    document.getElementById('famSpouseNicInput').value = f.spouse_nic || '';
    document.getElementById('famSpouseOccInput').value = f.spouse_occupation || '';
    document.getElementById('famPhoneInput').value = f.phone || '';
    document.getElementById('famWhatsappInput').value = f.whatsapp || '';
    document.getElementById('famCityInput').value = f.city || '';
    document.getElementById('famGnInput').value = f.gn_division || '';
    document.getElementById('famAddressInput').value = f.address || '';
    document.getElementById('famBankNameInput').value = f.bank_name || '';
    document.getElementById('famBankBranchInput').value = f.bank_branch || '';
    document.getElementById('famAccountNoInput').value = f.account_number || '';
    document.getElementById('famAccountHolderInput').value = f.account_holder_name || '';
    document.getElementById('famAidCategorySelect').value = f.aid_category || 'general';
    document.getElementById('famIncomeInput').value = f.monthly_income ?? 0;
    document.getElementById('famExpensesInput').value = f.monthly_expenses ?? 0;
    document.getElementById('famVerifiedByInput').value = f.verified_by || '';
    document.getElementById('famVerificationDateInput').value = f.verification_date ? String(f.verification_date).split('T')[0] : '';
    document.getElementById('famNotesInput').value = f.notes || '';
    document.getElementById('famAdultsInput').value = f.adults_count ?? 1;
    document.getElementById('famChildrenInput').value = f.children_count ?? 0;
    document.getElementById('famElderlyInput').value = f.elderly_count ?? 0;
    document.getElementById('famDisabledInput').value = f.disabled_count ?? 0;
    document.getElementById('famMemberCountInput').value = f.member_count || 1;

    setFamilyPhotoPreview(f.photo_url || '');
    setFamilyHeadGender(f.head_gender || 'male');
    setFamilyModalStatus(f.status || 'active');
    setFamilyHousingType(f.housing_type || 'own');
    setFamilyModalPoverty(f.poverty_level || 'medium');

    _selectedFamilyVulnTags = new Set(String(f.vulnerability_tags || '').split(',').map(s => s.trim()).filter(Boolean));
    syncFamilyVulnTagUI();

    const depCont = document.getElementById('famDependentsContainer');
    if (depCont) depCont.innerHTML = '';
    try {
        const deps = typeof f.dependents_json === 'string' ? JSON.parse(f.dependents_json || '[]') : (Array.isArray(f.dependents_json) ? f.dependents_json : []);
        deps.forEach(d => addFamilyDependentRow(d));
    } catch (_) {}
    syncFamilyDependentsEmptyState();

    const initCard = document.getElementById('famInitAidSectionCard');
    if (initCard) initCard.style.display = 'none';
    const anotherBtn = document.getElementById('saveAndAddAnotherFamilyBtn');
    if (anotherBtn) anotherBtn.style.display = 'none';

    document.getElementById('familyModalTitle').textContent = 'Edit Household Profile';
    document.getElementById('familyModalSubtitle').textContent = `Updating ${f.head_name} (${f.family_code || '#' + f.id})`;
    document.getElementById('familySubmitBtn').innerHTML = '<i data-lucide="save" style="width:16px;height:16px;"></i> <span>Save Changes</span>';

    goToFamilyStep(0);
    openModal('familyModal');
    if (window.lucide) lucide.createIcons();
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

async function submitFamilyForm(keepOpen = false) {
    const form = document.getElementById('familyForm');
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.head_name || !String(data.head_name).trim()) {
        goToFamilyStep(0);
        document.getElementById('famHeadNameInput')?.focus();
        showToast('Head of Family Full Name is required', 'error');
        return;
    }

    data.dependents_json = collectFamilyDependents();
    data.vulnerability_tags = [..._selectedFamilyVulnTags].join(',');
    data.priority_score = computeFamilyPriorityScore();

    const isEdit = !!data.id;
    if (!isEdit && document.getElementById('famRecordInitAidToggle')?.checked) {
        data.record_initial_aid = true;
        data.initial_aid_type = document.getElementById('famInitAidType')?.value || 'cash';
        data.initial_aid_amount = Number(document.getElementById('famInitAidAmount')?.value) || 0;
        data.initial_aid_method = document.getElementById('famInitAidMethod')?.value || 'cash';
        data.initial_aid_ref = document.getElementById('famInitAidRef')?.value || '';
        data.initial_aid_description = document.getElementById('famInitAidDesc')?.value || '';
    }

    const url = isEdit ? `/api/edf/families/${data.id}` : '/api/edf/families';
    const method = isEdit ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast(isEdit ? 'Family updated' : 'Family registered', 'success');
            await fetchFamilies();
            fetchStats();
            if (keepOpen && !isEdit) {
                openRegisterFamilyModal();
            } else {
                closeModal('familyModal');
            }
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

document.getElementById('familyForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitFamilyForm(false);
});

async function viewFamily(id) {
    const f = currentFamilies.find(x => Number(x.id) === Number(id));
    if (!f) return;
    const modal = document.getElementById('viewFamilyModal');
    if (!modal) return;

    const code = f.family_code || `EDF-FAM-${String(f.id).padStart(3, '0')}`;
    const initials = (f.head_name || 'F').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatar = document.getElementById('viewFamAvatar');
    if (avatar) {
        avatar.innerHTML = f.photo_url ? `<img src="${f.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : initials;
    }

    const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.textContent = v; };
    set('viewFamHeadName', f.head_name || 'Household');
    set('viewFamCodeBadge', code);

    const povBadge = document.getElementById('viewFamPovBadge');
    const pov = f.poverty_level || 'medium';
    if (povBadge) {
        povBadge.className = `fam-pov-badge fam-pov-${pov}`;
        povBadge.textContent = pov === 'high' ? 'High Need' : pov === 'medium' ? 'Medium Need' : 'Low Need';
    }
    const stBadge = document.getElementById('viewFamStatusBadge');
    const st = f.status || 'active';
    if (stBadge) {
        stBadge.className = `status-badge status-${st === 'active' ? 'active' : 'deactivate'}`;
        stBadge.textContent = st.charAt(0).toUpperCase() + st.slice(1);
    }

    set('viewFamSubMeta', [f.nic_number ? `NIC: ${f.nic_number}` : null, f.phone || null, f.city || f.address || null].filter(Boolean).join(' • ') || 'Registered Household');
    set('viewFamKpiMembers', `${f.member_count || 1} Members`);
    set('viewFamKpiCompSub', `${f.adults_count ?? 1} Adults · ${f.children_count ?? 0} Children`);
    set('viewFamKpiIncome', `LKR ${Number(f.monthly_income || 0).toLocaleString()}`);
    set('viewFamKpiHousingSub', FAMILY_HOUSING_LABELS[f.housing_type || 'own'] || 'Own House');
    set('viewFamKpiPriority', `${f.priority_score ?? 40} / 100`);
    set('viewFamKpiCategorySub', FAMILY_AID_CATEGORY_LABELS[f.aid_category || 'general'] || 'General Welfare');
    set('viewFamKpiTotalAid', `LKR ${Number(f.total_aid_amount || 0).toLocaleString()}`);
    set('viewFamKpiLastAidSub', f.aid_count > 0 ? `${f.aid_count} grant(s)` : 'Never aided');

    const tags = String(f.vulnerability_tags || '').split(',').map(s => s.trim()).filter(Boolean);
    const tagsWrap = document.getElementById('viewFamVulnTagsWrap');
    if (tagsWrap) {
        tagsWrap.innerHTML = tags.length
            ? tags.map(t => `<span class="fam-tag-chip" style="margin-right:0.35rem; margin-bottom:0.3rem;">${escapeHtml(FAMILY_VULN_TAG_LABELS[t] || t.replace(/_/g, ' '))}</span>`).join('')
            : '<span style="font-size:0.78rem; color:var(--text-muted);">No special vulnerability indicators tagged.</span>';
    }

    const grid = document.getElementById('viewFamOverviewGrid');
    if (grid) {
        const items = [
            ['Occupation', f.head_occupation || '—'],
            ['Marital Status', (f.marital_status || 'married')],
            ['Spouse', f.spouse_name ? `${f.spouse_name}${f.spouse_nic ? ' (' + f.spouse_nic + ')' : ''}` : '—'],
            ['Phone / WhatsApp', [f.phone, f.whatsapp].filter(Boolean).join(' / ') || '—'],
            ['Town & GN Division', [f.city, f.gn_division].filter(Boolean).join(' · ') || '—'],
            ['Address', f.address || '—'],
            ['Bank Account', f.account_number ? `${f.bank_name || ''} · ${f.account_number}` : '—'],
            ['Verified By', f.verified_by ? `${f.verified_by}${f.verification_date ? ' (' + String(f.verification_date).split('T')[0] + ')' : ''}` : 'Pending verification']
        ];
        grid.innerHTML = items.map(([k, v]) => `<div class="detail-item"><span class="detail-label">${k}</span><span class="detail-value">${escapeHtml(v)}</span></div>`).join('');
    }

    const notesBox = document.getElementById('viewFamNotesBox');
    if (notesBox) {
        notesBox.innerHTML = f.notes ? `<div style="padding:0.75rem 0.9rem; background:var(--input-bg); border:1px solid var(--border-color); border-radius:10px; font-size:0.82rem;"><strong>Case Notes:</strong> ${escapeHtml(f.notes)}</div>` : '';
    }

    const depsList = document.getElementById('viewFamDependentsList');
    if (depsList) {
        let deps = [];
        try { deps = typeof f.dependents_json === 'string' ? JSON.parse(f.dependents_json || '[]') : (f.dependents_json || []); } catch (_) {}
        depsList.innerHTML = deps.length
            ? deps.map((d, idx) => `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.85rem; background:var(--input-bg); border:1px solid var(--border-color); border-radius:10px;"><div><strong>#${idx + 1} ${escapeHtml(d.name || 'Member')}</strong> · <span style="text-transform:capitalize; color:var(--text-muted);">${escapeHtml(d.relation || '')}</span></div><div style="font-size:0.78rem; color:var(--text-muted);">${d.age != null ? 'Age ' + d.age + ' · ' : ''}${escapeHtml(d.note || d.notes || '')}</div></div>`).join('')
            : '<div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No dependent member rows listed.</div>';
    }

    // Wire modal tabs for viewFamilyModal
    modal.querySelectorAll('.modal-tab[data-modal-tab]').forEach(btn => {
        btn.onclick = () => {
            modal.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.modal-tab-content').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.modalTab)?.classList.add('active');
        };
    });
    modal.querySelector('.modal-tab[data-modal-tab="view-fam-overview"]')?.click();

    const distBtn = document.getElementById('viewFamDistributeAidBtn');
    if (distBtn) distBtn.onclick = () => { closeModal('viewFamilyModal'); openAidModal(f.id, f.head_name); };
    const editBtn = document.getElementById('viewFamEditBtn');
    if (editBtn) editBtn.onclick = () => { closeModal('viewFamilyModal'); editFamily(f.id); };

    const aidBody = document.getElementById('viewFamAidTableBody');
    if (aidBody) aidBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Loading aid records…</td></tr>';
    openModal('viewFamilyModal');
    if (window.lucide) lucide.createIcons();

    try {
        const aidRows = await (await fetch(`/api/edf/families/${f.id}/aid`)).json();
        if (aidBody) {
            aidBody.innerHTML = (Array.isArray(aidRows) && aidRows.length)
                ? aidRows.map(h => `<tr><td>${new Date(h.date).toLocaleDateString()}</td><td style="text-transform:capitalize;">${escapeHtml((h.donation_type || '').replace(/_/g, ' '))}</td><td>${escapeHtml(h.payment_method || 'cash')}${h.reference_no ? ' · ' + escapeHtml(h.reference_no) : ''}</td><td style="font-weight:700;color:#10b981;">LKR ${Number(h.amount || 0).toLocaleString()}</td><td>${escapeHtml(h.description || '—')}</td></tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No aid recorded yet for this household.</td></tr>';
        }
    } catch (_) {}
}

function openAidModal(id, name) {
    document.getElementById('aidFamilyId').value = id;
    document.getElementById('targetFamilyNameAid').textContent = name;
    const dInp = document.getElementById('aidFormDateInput');
    if (dInp && !dInp.value) dInp.value = new Date().toISOString().split('T')[0];
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
        aidHistoryData = Array.isArray(data) ? data : [];
        const total = aidHistoryData.reduce((s, h) => s + (Number(h.amount) || 0), 0);
        const sumEl = document.getElementById('aidHistoryHeaderSummary');
        if (sumEl) sumEl.textContent = `${aidHistoryData.length} record${aidHistoryData.length !== 1 ? 's' : ''} • Total Disbursed: LKR ${total.toLocaleString()}`;

        const tbody = document.getElementById('aidHistoryBody');
        tbody.innerHTML = aidHistoryData.map(h => `
            <tr>
                <td>${new Date(h.date).toLocaleDateString()}</td>
                <td style="text-transform:capitalize">${escapeHtml((h.donation_type || '').replace(/_/g, ' '))}</td>
                <td>${escapeHtml(h.payment_method || 'cash')}${h.reference_no ? ` · <span style="font-family:monospace;">${escapeHtml(h.reference_no)}</span>` : ''}</td>
                <td style="font-weight:600">LKR ${Number(h.amount || 0).toLocaleString()}</td>
                <td>${escapeHtml(h.description || '—')}</td>
                <td style="text-align:right; white-space:nowrap;">
                    <button class="btn" style="padding:0.4rem 0.5rem; background:var(--glow-bg);" onclick="openAidHistoryForm('edit',${h.id})" title="Edit"><i data-lucide="edit-2" style="width:15px;"></i></button>
                    <button class="btn" style="padding:0.4rem 0.5rem; background:#fee2e2; color:#ef4444;" onclick="deleteAidHistoryRecord(${h.id})" title="Delete"><i data-lucide="trash-2" style="width:15px;"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No aid history recorded</td></tr>';
        if (window.lucide) lucide.createIcons();
    } catch (err) { console.error(err); }
}

function openAidHistoryForm(mode, aidId = null) {
    const panel = document.getElementById('aidHistoryFormPanel');
    const title = document.getElementById('aidHistoryFormTitle');
    const submitBtn = document.getElementById('aidHistorySubmitBtn');
    const aidData = aidId ? aidHistoryData.find(h => Number(h.id) === Number(aidId)) : null;

    document.getElementById('aidHistoryRecordId').value = aidData ? aidData.id : '';
    document.getElementById('aidHistoryType').value = aidData ? aidData.donation_type : 'cash';
    const methEl = document.getElementById('aidHistoryMethod');
    if (methEl) methEl.value = aidData ? (aidData.payment_method || 'cash') : 'cash';
    document.getElementById('aidHistoryAmount').value = aidData ? aidData.amount : '';
    const refEl = document.getElementById('aidHistoryRef');
    if (refEl) refEl.value = aidData ? (aidData.reference_no || '') : '';
    document.getElementById('aidHistoryDescription').value = aidData ? (aidData.description || '') : '';
    document.getElementById('aidHistoryDate').value = aidData
        ? new Date(aidData.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    title.textContent = mode === 'edit' ? 'Edit Aid Record' : 'Add New Aid Record';
    submitBtn.innerHTML = mode === 'edit'
        ? '<i data-lucide="save" style="width:14px;"></i> Update Record'
        : '<i data-lucide="save" style="width:14px;"></i> Save Record';
    panel.style.display = 'block';
    if (window.lucide) lucide.createIcons();
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
        payment_method: document.getElementById('aidHistoryMethod')?.value || 'cash',
        amount: document.getElementById('aidHistoryAmount').value,
        reference_no: document.getElementById('aidHistoryRef')?.value.trim() || null,
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

// ---- Donations Management & Record Transaction CRUD ----
let donationData = [];
let _donationTypeFilter = 'all';
let _donationDirectionFilter = 'all';
let _donPage = 1;
let _donPageSize = 15;
let _donLoadingParties = null;

function _donEsc(val) {
    return typeof escapeHtml === 'function'
        ? escapeHtml(val ?? '')
        : String(val ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function _donTxCode(id) {
    return 'EDF-TX-' + String(id || 0).padStart(4, '0');
}

function _donLkr(amt) {
    return 'LKR ' + Number(amt || 0).toLocaleString();
}

function _donInitials(name) {
    const parts = String(name || 'ED').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'ED';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function _donCounterparty(d) {
    const isExp = d.direction === 'expense';
    let name = '';
    let roleLabel = '';
    let meta = d.donor_phone || '';
    if (isExp) {
        if (d.recipient_type === 'beneficiary') {
            name = d.beneficiary_name || `Beneficiary #${d.beneficiary_id || '—'}`;
            roleLabel = 'Beneficiary';
            meta = d.beneficiary_number ? `App #${d.beneficiary_number}` : '';
        } else if (d.recipient_type === 'family') {
            name = d.family_name || `Family #${d.family_id || '—'}`;
            roleLabel = 'Registered Family';
        } else {
            name = d.recipient_name || 'Other Relief Recipient';
            roleLabel = 'Relief Partner';
        }
    } else {
        if (d.donor_type === 'member') {
            name = d.member_name || `Member #${d.member_id || '—'}`;
            roleLabel = 'Registered Member';
        } else {
            name = d.donor_name || 'Legacy Contributor';
            roleLabel = 'Legacy / Non-Member';
        }
    }
    return {
        isExpense: isExp,
        name,
        roleLabel,
        meta,
        initials: _donInitials(name)
    };
}

function _donSetText(id, v) {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
}

async function _ensureDonPartyLists() {
    if (_donLoadingParties) return _donLoadingParties;
    const jobs = [];
    if (typeof currentMembers !== 'undefined' && currentMembers.length === 0 && typeof fetchMembers === 'function') jobs.push(fetchMembers());
    if (typeof currentBeneficiaries !== 'undefined' && currentBeneficiaries.length === 0 && typeof fetchBeneficiaries === 'function') jobs.push(fetchBeneficiaries());
    if (typeof currentFamilies !== 'undefined' && currentFamilies.length === 0 && typeof fetchFamilies === 'function') jobs.push(fetchFamilies());
    if (!jobs.length) return;
    _donLoadingParties = Promise.allSettled(jobs).finally(() => {
        _donLoadingParties = null;
        const q = document.getElementById('donPartyQuickSearch')?.value || '';
        _populateDonPartySelects(q);
        onDonPartySelected();
    });
    return _donLoadingParties;
}

function _populateDonPartySelects(filterQuery = '') {
    const q = String(filterQuery || '').trim().toLowerCase();

    const memSel = document.getElementById('donationMemberId');
    if (memSel) {
        const prev = memSel.value;
        const list = typeof currentMembers !== 'undefined' ? currentMembers : [];
        const matched = q ? list.filter(m =>
            String(m.id) === prev ||
            (m.full_name || '').toLowerCase().includes(q) ||
            (m.phone || '').toLowerCase().includes(q) ||
            (m.member_type || '').toLowerCase().includes(q)
        ) : list;
        memSel.innerHTML = `<option value="">${matched.length ? 'Select Registered Member...' : 'No matching members'}</option>` +
            matched.map(m => {
                const sub = m.phone ? ` · ${m.phone}` : '';
                return `<option value="${m.id}">${_donEsc(m.full_name)}${_donEsc(sub)}</option>`;
            }).join('');
        if (prev) memSel.value = prev;
    }

    const benSel = document.getElementById('donationBeneficiaryId');
    if (benSel) {
        const prev = benSel.value;
        const list = typeof currentBeneficiaries !== 'undefined' ? currentBeneficiaries : [];
        const matched = q ? list.filter(b =>
            String(b.id) === prev ||
            (b.male_head_name || '').toLowerCase().includes(q) ||
            (b.application_number || '').toLowerCase().includes(q) ||
            (b.contact_number || '').toLowerCase().includes(q)
        ) : list;
        benSel.innerHTML = `<option value="">${matched.length ? 'Select Beneficiary...' : 'No matching beneficiaries'}</option>` +
            matched.map(b => `<option value="${b.id}">${_donEsc(b.male_head_name || 'Beneficiary')} (${_donEsc(b.application_number || '#' + b.id)})</option>`).join('');
        if (prev) benSel.value = prev;
    }

    const famSel = document.getElementById('donationFamilyId');
    if (famSel) {
        const prev = famSel.value;
        const list = typeof currentFamilies !== 'undefined' ? currentFamilies : [];
        const matched = q ? list.filter(f =>
            String(f.id) === prev ||
            (f.head_name || '').toLowerCase().includes(q) ||
            (f.contact_number || '').toLowerCase().includes(q)
        ) : list;
        famSel.innerHTML = `<option value="">${matched.length ? 'Select Family...' : 'No matching families'}</option>` +
            matched.map(f => `<option value="${f.id}">${_donEsc(f.head_name || 'Family #' + f.id)}</option>`).join('');
        if (prev) famSel.value = prev;
    }
}

async function fetchDonations() {
    try {
        const res = await fetch('/api/edf/external-donations');
        const data = await res.json();
        donationData = Array.isArray(data) ? data : [];
        _donPage = 1;
        updateDonationStats();
        renderDonations();
    } catch (err) { console.error(err); }
}

function updateDonationStats() {
    const list = Array.isArray(donationData) ? donationData : [];
    const inflowRows = list.filter(d => d.direction !== 'expense');
    const expenseRows = list.filter(d => d.direction === 'expense');

    const inflowTotal = inflowRows.reduce((s, d) => s + Number(d.amount || 0), 0);
    const expenseTotal = expenseRows.reduce((s, d) => s + Number(d.amount || 0), 0);
    const netTotal = inflowTotal - expenseTotal;
    const grandVol = inflowTotal + expenseTotal;

    const sumByCat = (cat) => list
        .filter(d => (d.donation_type || 'other') === cat)
        .reduce((s, d) => s + Number(d.amount || 0), 0);

    const zakat = sumByCat('zakat');
    const sadaqah = sumByCat('sadaqah');
    const fitrana = sumByCat('fitrana');
    const lillah = sumByCat('lillah');
    const other = sumByCat('other');
    const catVol = zakat + sadaqah + fitrana + lillah + other;

    const nowYm = new Date().toISOString().slice(0, 7);
    const thisMonthSum = list
        .filter(d => String(d.date || '').slice(0, 7) === nowYm)
        .reduce((s, d) => s + Number(d.amount || 0), 0);
    const avgAmt = list.length ? Math.round(grandVol / list.length) : 0;

    const pct = (part, whole) => whole > 0 ? Math.round((part / whole) * 100) : 0;

    _donSetText('dStatTotal', _donLkr(inflowTotal));
    _donSetText('dStatInflowSub', `${inflowRows.length} inflow entr${inflowRows.length === 1 ? 'y' : 'ies'}`);
    _donSetText('dPctInflow', `${pct(inflowTotal, grandVol)}%`);

    _donSetText('dStatZakat', _donLkr(zakat));
    _donSetText('dPctZakat', `${pct(zakat, catVol)}%`);

    _donSetText('dStatSadaqah', _donLkr(sadaqah));
    _donSetText('dPctSadaqah', `${pct(sadaqah, catVol)}%`);

    _donSetText('dStatExpense', _donLkr(expenseTotal));
    _donSetText('dStatExpenseSub', `${expenseRows.length} disbursement${expenseRows.length === 1 ? '' : 's'}`);
    _donSetText('dPctExpense', `${pct(expenseTotal, grandVol)}%`);

    _donSetText('dStatCount', list.length);
    _donSetText('dStatThisMonth', `This month: ${_donLkr(thisMonthSum)}`);
    _donSetText('dStatAvgPill', `Avg LKR ${avgAmt.toLocaleString()}`);

    _donSetText('dStatNet', `Net: ${netTotal >= 0 ? '+' : '-'}LKR ${Math.abs(netTotal).toLocaleString()}`);

    const setBar = (id, share) => {
        const b = document.getElementById(id);
        if (b) b.style.width = `${Math.max(0, Math.min(100, share))}%`;
    };
    setBar('dBarInflow', pct(inflowTotal, grandVol));
    setBar('dBarZakat', pct(zakat, catVol));
    setBar('dBarSadaqah', pct(sadaqah, catVol));
    setBar('dBarExpense', pct(expenseTotal, grandVol));

    setBar('donMixZakat', catVol > 0 ? (zakat / catVol) * 100 : 0);
    setBar('donMixSadaqah', catVol > 0 ? (sadaqah / catVol) * 100 : 0);
    setBar('donMixFitrana', catVol > 0 ? (fitrana / catVol) * 100 : 0);
    setBar('donMixLillah', catVol > 0 ? (lillah / catVol) * 100 : 0);
    setBar('donMixOther', catVol > 0 ? (other / catVol) * 100 : 0);

    _donSetText('donMixLblZakat', _donLkr(zakat));
    _donSetText('donMixLblSadaqah', _donLkr(sadaqah));
    _donSetText('donMixLblFitrana', _donLkr(fitrana));
    _donSetText('donMixLblLillah', _donLkr(lillah));
    _donSetText('donMixLblOther', _donLkr(other));

    // Category pill counts
    _donSetText('dCnt-all', list.length);
    ['zakat', 'sadaqah', 'fitrana', 'lillah', 'other'].forEach(c => {
        _donSetText(`dCnt-${c}`, list.filter(d => (d.donation_type || 'other') === c).length);
    });
}

function _getFilteredDonations() {
    const search = (document.getElementById('donationSearchInput')?.value || '').trim().toLowerCase();
    const methodFilter = document.getElementById('donationMethodFilter')?.value || 'all';
    const monthFilter = document.getElementById('donationMonthFilter')?.value || '';
    const sortBy = document.getElementById('donationSortSelect')?.value || 'date_desc';

    const list = (Array.isArray(donationData) ? donationData : []).filter(d => {
        const dir = d.direction === 'expense' ? 'expense' : 'income';
        if (_donationDirectionFilter !== 'all' && dir !== _donationDirectionFilter) return false;
        const cat = d.donation_type || 'other';
        if (_donationTypeFilter !== 'all' && cat !== _donationTypeFilter) return false;
        if (methodFilter !== 'all' && (d.payment_method || 'cash') !== methodFilter) return false;
        if (monthFilter && String(d.date || '').slice(0, 7) !== monthFilter) return false;

        if (search) {
            const cp = _donCounterparty(d);
            const hay = [
                _donTxCode(d.id),
                cp.name,
                cp.roleLabel,
                cp.meta,
                d.donor_name,
                d.recipient_name,
                cat,
                d.payment_method,
                d.description
            ].filter(Boolean).join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    list.sort((a, b) => {
        if (sortBy === 'date_asc') return new Date(a.date || 0) - new Date(b.date || 0);
        if (sortBy === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0);
        if (sortBy === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0);
        return new Date(b.date || 0) - new Date(a.date || 0) || (Number(b.id || 0) - Number(a.id || 0));
    });

    return list;
}

function renderDonations() {
    const tbody = document.getElementById('donationsBody');
    if (!tbody) return;

    const filtered = _getFilteredDonations();
    const totalFilteredSum = filtered.reduce((s, d) => s + Number(d.amount || 0), 0);

    const perPage = _donPageSize === 'all' ? Math.max(1, filtered.length) : Number(_donPageSize || 15);
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    if (_donPage > totalPages) _donPage = totalPages;
    if (_donPage < 1) _donPage = 1;
    const startIdx = (_donPage - 1) * perPage;
    const paged = filtered.slice(startIdx, startIdx + perPage);

    _donSetText(
        'donShowingBadge',
        filtered.length
            ? `Showing ${startIdx + 1}-${startIdx + paged.length} of ${filtered.length} · Filtered Total: ${_donLkr(totalFilteredSum)}`
            : '0 matching entries'
    );

    const methodIcons = { cash: 'banknote', bank: 'landmark', online: 'globe' };

    if (!paged.length) {
        const hasAny = donationData.length > 0;
        tbody.innerHTML = `<tr><td colspan="8" style="padding:0; border:none;">
            <div class="don-empty-box">
                <div class="don-empty-lottie-wrap">
                    <span class="edf-lottie-slot" data-lottie-icon="charity" data-lottie-trigger="loop"></span>
                </div>
                <div style="font-size:0.95rem; font-weight:800; color:var(--text-main);">
                    ${hasAny ? 'No ledger entries match these filters' : 'No treasury transactions recorded yet'}
                </div>
                <div style="font-size:0.78rem; color:var(--text-muted); max-width:420px;">
                    ${hasAny ? 'Try broadening your search, direction switch, month, or fund category filter.' : 'Record member Zakat, Sadaqah, Fitrana, Lillah inflows or aid disbursements cleanly in the ledger.'}
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center; margin-top:0.25rem;">
                    ${hasAny
                        ? `<button type="button" class="don-btn-ghost" onclick="resetDonationFilters()"><i data-lucide="rotate-ccw" style="width:13px;"></i> Reset Filters</button>`
                        : `<button type="button" class="don-btn-primary" onclick="openDonationModal('add', null, 'income')"><i data-lucide="plus-circle" style="width:14px;"></i> Record First Entry</button>`
                    }
                </div>
            </div>
        </td></tr>`;
    } else {
        tbody.innerHTML = paged.map(d => {
            const cp = _donCounterparty(d);
            const txCode = _donTxCode(d.id);
            const cat = (d.donation_type || 'other').toLowerCase();
            const method = (d.payment_method || 'cash').toLowerCase();
            const dateStr = d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const notesStr = (d.description || '').trim();

            return `
            <tr>
                <td>
                    <div class="don-voucher-wrap">
                        <div class="don-voucher-row">
                            <span class="don-voucher-code">${txCode}</span>
                            <button type="button" class="don-copy-btn" onclick="copyDonVoucher('${txCode}')" title="Copy voucher ID ${txCode}">
                                <i data-lucide="copy" style="width:12px;height:12px;"></i>
                            </button>
                        </div>
                        <span class="don-date-sub">${_donEsc(dateStr)}</span>
                    </div>
                </td>
                <td>
                    <span class="don-dir-badge ${cp.isExpense ? 'disbursed' : 'inflow'}">
                        <i data-lucide="${cp.isExpense ? 'arrow-up-right' : 'arrow-down-left'}" style="width:12px;height:12px;"></i>
                        ${cp.isExpense ? 'Disbursed' : 'Inflow'}
                    </span>
                    <span class="don-role-sub">${_donEsc(cp.roleLabel)}</span>
                </td>
                <td>
                    <div class="don-party-cell">
                        <div class="don-avatar ${cp.isExpense ? 'is-expense' : ''}">${_donEsc(cp.initials)}</div>
                        <div style="min-width:0;">
                            <div class="don-party-name pii-sensitive">${_donEsc(cp.name)}</div>
                            ${cp.meta ? `<div class="don-party-meta pii-sensitive">${_donEsc(cp.meta)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td><span class="don-type-pill don-type-${_donEsc(cat)}">${_donEsc(cat)}</span></td>
                <td>
                    <span class="don-method-chip">
                        <i data-lucide="${methodIcons[method] || 'wallet'}" style="width:12px;height:12px;"></i>
                        ${_donEsc(method)}
                    </span>
                </td>
                <td>
                    <div class="don-notes-cell" title="${_donEsc(notesStr || 'No memo')}">${notesStr ? _donEsc(notesStr) : '<span style="opacity:0.45;">—</span>'}</div>
                </td>
                <td class="don-amount-cell ${cp.isExpense ? 'is-expense' : 'is-income'}">
                    ${cp.isExpense ? '-' : '+'} ${_donLkr(d.amount)}
                </td>
                <td style="text-align:right; white-space:nowrap;">
                    <div class="don-act-group">
                        <button type="button" class="don-act-btn" onclick="viewDonationReceipt(${d.id})" title="Print Official Voucher Receipt">
                            <i data-lucide="printer" style="width:14px;height:14px;"></i>
                        </button>
                        <button type="button" class="don-act-btn" onclick="openDonationModal('edit', ${d.id})" title="Edit Transaction">
                            <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                        </button>
                        <button type="button" class="don-act-btn is-danger" onclick="deleteDonation(${d.id})" title="Delete Transaction">
                            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    const pagEl = document.getElementById('donPaginationBar');
    if (pagEl) {
        pagEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span>Rows per page:</span>
                <select class="don-select-mini" style="padding:0.2rem 0.45rem;" onchange="setDonPageSize(this.value)">
                    <option value="10" ${String(_donPageSize) === '10' ? 'selected' : ''}>10</option>
                    <option value="15" ${String(_donPageSize) === '15' ? 'selected' : ''}>15</option>
                    <option value="30" ${String(_donPageSize) === '30' ? 'selected' : ''}>30</option>
                    <option value="all" ${String(_donPageSize) === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div class="don-page-controls">
                <button type="button" class="don-page-btn" ${_donPage <= 1 ? 'disabled' : ''} onclick="changeDonPage(-1)">Prev</button>
                <span style="font-weight:700; color:var(--text-main);">Page ${_donPage} / ${totalPages}</span>
                <button type="button" class="don-page-btn" ${_donPage >= totalPages ? 'disabled' : ''} onclick="changeDonPage(1)">Next</button>
            </div>
        `;
    }

    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    if (window.lucide) lucide.createIcons();
}

function filterDonations() { _donPage = 1; renderDonations(); }

function setDonationTypeFilter(type) {
    _donationTypeFilter = type || 'all';
    document.querySelectorAll('#donationsTab [id^="dType-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`dType-${_donationTypeFilter}`)?.classList.add('active');
    _donPage = 1;
    renderDonations();
}

function setDonationDirectionFilter(dir) {
    _donationDirectionFilter = dir || 'all';
    document.querySelectorAll('#donationsTab [id^="dDir-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`dDir-${_donationDirectionFilter}`)?.classList.add('active');
    _donPage = 1;
    renderDonations();
}

function resetDonationFilters() {
    _donationTypeFilter = 'all';
    _donationDirectionFilter = 'all';
    _donPage = 1;
    const s = document.getElementById('donationSearchInput'); if (s) s.value = '';
    const m = document.getElementById('donationMethodFilter'); if (m) m.value = 'all';
    const mo = document.getElementById('donationMonthFilter'); if (mo) mo.value = '';
    const so = document.getElementById('donationSortSelect'); if (so) so.value = 'date_desc';
    setDonationDirectionFilter('all');
    setDonationTypeFilter('all');
}

function changeDonPage(delta) {
    _donPage += delta;
    renderDonations();
}

function setDonPageSize(val) {
    _donPageSize = val === 'all' ? 'all' : Number(val || 15);
    _donPage = 1;
    renderDonations();
}

function copyDonVoucher(txCode) {
    if (!txCode) return;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(txCode).then(() => showToast(`Copied ${txCode}`, 'success')).catch(() => {});
    } else {
        showToast(txCode, 'info');
    }
}

function _syncDonModalUI() {
    const dir = document.getElementById('donationDirection')?.value || 'income';
    const cat = document.getElementById('donationDonationType')?.value || 'zakat';
    const modal = document.getElementById('donationModal');
    if (modal) {
        modal.classList.toggle('don-modal-income', dir !== 'expense');
        modal.classList.toggle('don-modal-expense', dir === 'expense');
    }

    document.getElementById('donDirCardIncome')?.classList.toggle('active', dir !== 'expense');
    document.getElementById('donDirCardExpense')?.classList.toggle('active', dir === 'expense');

    const titleSpan = document.getElementById('donPartySectionTitle');
    if (titleSpan) {
        titleSpan.innerHTML = dir === 'expense'
            ? '<i data-lucide="heart-handshake" style="width:13px;height:13px;"></i> Aid Recipient Details'
            : '<i data-lucide="users" style="width:13px;height:13px;"></i> Contributor Details';
    }

    _donSetText('donModalModeBadge', `${dir === 'expense' ? 'DISBURSED' : 'INFLOW'} · ${cat.toUpperCase()}`);

    const dType = document.getElementById('donationDonorType')?.value || 'member';
    const rType = document.getElementById('donationRecipientType')?.value || 'beneficiary';
    document.querySelectorAll('#donationModal [id^="donDonorBtn-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`donDonorBtn-${dType}`)?.classList.add('active');
    document.querySelectorAll('#donationModal [id^="donRecBtn-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`donRecBtn-${rType}`)?.classList.add('active');

    const warn = document.getElementById('donOutsiderWarningBanner');
    if (warn) warn.classList.toggle('visible', dir !== 'expense' && dType === 'external');

    const searchWrap = document.getElementById('donPartyQuickSearchWrap');
    if (searchWrap) {
        const needsSelect = (dir !== 'expense' && dType === 'member') || (dir === 'expense' && rType !== 'external');
        searchWrap.style.display = needsSelect ? 'flex' : 'none';
    }

    syncDonModalChips();
    onDonPartySelected();
    updateDonLivePreview();
    if (window.lucide) lucide.createIcons();
}

function selectDonDirection(dir) {
    const sel = document.getElementById('donationDirection');
    if (sel) sel.value = dir === 'expense' ? 'expense' : 'income';
    onDonationDirectionChange();
}

function selectDonDonorType(type) {
    const sel = document.getElementById('donationDonorType');
    if (sel) sel.value = type;
    onDonorTypeChange();
}

function selectDonRecipientType(type) {
    const sel = document.getElementById('donationRecipientType');
    if (sel) sel.value = type;
    onRecipientTypeChange();
}

function filterDonPartySelect(query) {
    _populateDonPartySelects(query);
    updateDonLivePreview();
}

function onDonPartySelected() {
    const dir = document.getElementById('donationDirection')?.value || 'income';
    const dType = document.getElementById('donationDonorType')?.value || 'member';
    const rType = document.getElementById('donationRecipientType')?.value || 'beneficiary';
    const preview = document.getElementById('donSelectedPartyPreview');

    let summaryHtml = '';
    if (dir !== 'expense' && dType === 'member') {
        const mid = document.getElementById('donationMemberId')?.value;
        const m = typeof currentMembers !== 'undefined' ? currentMembers.find(x => String(x.id) === String(mid)) : null;
        if (m) {
            const phoneInp = document.getElementById('donationDonorPhone');
            const mPhone = m.phone || m.whatsapp || '';
            if (phoneInp && mPhone && (!phoneInp.value || phoneInp.value === (phoneInp.dataset?.lastMemberPhone || ''))) {
                phoneInp.value = mPhone;
                if (phoneInp.dataset) phoneInp.dataset.lastMemberPhone = mPhone;
            }
            summaryHtml = `<span><strong>${_donEsc(m.full_name)}</strong> · Member ${(m.member_type || '').toUpperCase()}</span><span>${_donEsc(m.phone || m.home_town || 'Verified Member')}</span>`;
        }
    } else if (dir === 'expense' && rType === 'beneficiary') {
        const bid = document.getElementById('donationBeneficiaryId')?.value;
        const b = typeof currentBeneficiaries !== 'undefined' ? currentBeneficiaries.find(x => String(x.id) === String(bid)) : null;
        if (b) {
            summaryHtml = `<span><strong>${_donEsc(b.male_head_name || 'Beneficiary')}</strong> · App #${_donEsc(b.application_number || b.id)}</span><span>${_donEsc(b.home_town || b.contact_number || 'Approved Household')}</span>`;
        }
    } else if (dir === 'expense' && rType === 'family') {
        const fid = document.getElementById('donationFamilyId')?.value;
        const f = typeof currentFamilies !== 'undefined' ? currentFamilies.find(x => String(x.id) === String(fid)) : null;
        if (f) {
            summaryHtml = `<span><strong>${_donEsc(f.head_name || 'Family #' + f.id)}</strong> · Registered Family</span><span>${_donEsc(f.contact_number || f.home_town || '')}</span>`;
        }
    }

    if (preview) {
        preview.classList.toggle('visible', Boolean(summaryHtml));
        preview.innerHTML = summaryHtml;
    }
    updateDonLivePreview();
}

function setDonQuickAmount(val) {
    const inp = document.getElementById('donationAmount');
    if (inp) {
        inp.value = Number(val || 0);
        updateDonLivePreview();
    }
}

function selectDonCategory(cat) {
    const sel = document.getElementById('donationDonationType');
    if (sel) sel.value = cat;
    _syncDonModalUI();
}

function selectDonMethod(method) {
    const sel = document.getElementById('donationPaymentMethod');
    if (sel) sel.value = method;
    syncDonModalChips();
    updateDonLivePreview();
}

function syncDonModalChips() {
    const cat = document.getElementById('donationDonationType')?.value || 'zakat';
    const meth = document.getElementById('donationPaymentMethod')?.value || 'cash';
    document.querySelectorAll('#donCategoryTiles .don-choice-chip').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
    });
    document.querySelectorAll('#donMethodTiles .don-choice-chip').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-method') === meth);
    });
}

function setDonDateToday() {
    const dt = document.getElementById('donationDate');
    if (dt) {
        dt.value = new Date().toISOString().split('T')[0];
        updateDonLivePreview();
    }
}

function updateDonLivePreview() {
    const dir = document.getElementById('donationDirection')?.value || 'income';
    const amt = Number(document.getElementById('donationAmount')?.value || 0);
    const cat = (document.getElementById('donationDonationType')?.value || 'zakat').toUpperCase();
    const meth = (document.getElementById('donationPaymentMethod')?.value || 'cash').toUpperCase();
    const dType = document.getElementById('donationDonorType')?.value || 'member';
    const rType = document.getElementById('donationRecipientType')?.value || 'beneficiary';

    const amtEl = document.getElementById('donAmountFormattedPreview');
    if (amtEl) {
        amtEl.textContent = amt > 0 ? `LKR ${amt.toLocaleString()}` : 'LKR 0';
        amtEl.style.color = dir === 'expense' ? '#d97706' : '#059669';
    }

    let partyText = 'selected party';
    if (dir === 'income') {
        if (dType === 'member') {
            const sel = document.getElementById('donationMemberId');
            partyText = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text.split(' · ')[0] : 'Registered Member';
        } else {
            partyText = document.getElementById('donationDonorName')?.value.trim() || 'Contributor';
        }
    } else {
        if (rType === 'beneficiary') {
            const sel = document.getElementById('donationBeneficiaryId');
            partyText = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : 'Beneficiary';
        } else if (rType === 'family') {
            const sel = document.getElementById('donationFamilyId');
            partyText = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : 'Registered Family';
        } else {
            partyText = document.getElementById('donationRecipientName')?.value.trim() || 'Relief Recipient';
        }
    }

    const previewEl = document.getElementById('donLivePreviewText');
    if (previewEl) {
        const sign = dir === 'expense' ? '-' : '+';
        const verb = dir === 'expense' ? `Disbursed (${cat}) to` : `Inflow (${cat}) from`;
        previewEl.innerHTML = `<strong>${sign} LKR ${amt.toLocaleString()}</strong> &mdash; ${_donEsc(verb)} <strong>${_donEsc(partyText)}</strong> via ${_donEsc(meth)}`;
    }
}

window.onDonationDirectionChange = function() {
    const dir = document.getElementById('donationDirection').value;
    document.querySelectorAll('.income-field').forEach(el => { el.style.display = dir === 'income' ? '' : 'none'; });
    document.querySelectorAll('.expense-field').forEach(el => { el.style.display = dir === 'expense' ? '' : 'none'; });
    if (dir === 'income') onDonorTypeChange();
    else onRecipientTypeChange();
    _syncDonModalUI();
};

window.onDonorTypeChange = function() {
    const dType = document.getElementById('donationDonorType').value;
    const dir = document.getElementById('donationDirection').value;
    if (dir !== 'income') return;
    document.getElementById('donorMemberContainer').style.display = dType === 'member' ? '' : 'none';
    document.getElementById('donorNameContainer').style.display = dType === 'external' ? '' : 'none';
    _syncDonModalUI();
};

window.onRecipientTypeChange = function() {
    const rType = document.getElementById('donationRecipientType').value;
    const dir = document.getElementById('donationDirection').value;
    if (dir !== 'expense') return;
    document.getElementById('recipientBenContainer').style.display = rType === 'beneficiary' ? '' : 'none';
    document.getElementById('recipientFamContainer').style.display = rType === 'family' ? '' : 'none';
    document.getElementById('recipientNameContainer').style.display = rType === 'external' ? '' : 'none';
    _syncDonModalUI();
};

function openDonationModal(mode, donId = null, presetDirection = null) {
    const don = donId ? donationData.find(d => d.id === donId) : null;
    const qs = document.getElementById('donPartyQuickSearch');
    if (qs) qs.value = '';

    _populateDonPartySelects('');
    _ensureDonPartyLists();

    const defaultDir = don ? (don.direction || 'income') : (presetDirection || 'income');
    document.getElementById('donationRecordId').value = don ? don.id : '';
    document.getElementById('donationDirection').value = defaultDir;

    // Default new inflows to Registered Member (Self-Funded Charter), preserve legacy external on edit
    document.getElementById('donationDonorType').value = don ? (don.donor_type || 'external') : 'member';
    document.getElementById('donationMemberId').value = don ? (don.member_id || '') : '';
    document.getElementById('donationDonorName').value = don ? (don.donor_name || '') : '';
    document.getElementById('donationDonorPhone').value = don ? (don.donor_phone || '') : '';

    document.getElementById('donationRecipientType').value = don ? (don.recipient_type || 'beneficiary') : 'beneficiary';
    document.getElementById('donationBeneficiaryId').value = don ? (don.beneficiary_id || '') : '';
    document.getElementById('donationFamilyId').value = don ? (don.family_id || '') : '';
    document.getElementById('donationRecipientName').value = don ? (don.recipient_name || '') : '';

    document.getElementById('donationAmount').value = don ? don.amount : '';
    document.getElementById('donationDonationType').value = don ? don.donation_type : 'zakat';
    document.getElementById('donationPaymentMethod').value = don ? don.payment_method : 'cash';
    document.getElementById('donationDescription').value = don ? (don.description || '') : '';
    document.getElementById('donationDate').value = don
        ? new Date(don.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    _donSetText('donationModalTitle', mode === 'edit' ? 'Edit Transaction' : 'Record Transaction');
    _donSetText('donModalVoucherChip', don ? _donTxCode(don.id) : 'NEW VOUCHER');

    const saveAnotherBtn = document.getElementById('donSaveAnotherBtn');
    if (saveAnotherBtn) saveAnotherBtn.style.display = mode === 'edit' ? 'none' : 'inline-flex';

    const submitBtn = document.getElementById('donationSubmitBtn');
    if (submitBtn) {
        submitBtn.innerHTML = mode === 'edit'
            ? '<i data-lucide="save"></i> Update Transaction'
            : '<i data-lucide="save"></i> Save Transaction';
    }

    onDonationDirectionChange();
    openModal('donationModal');
    if (typeof window.initEdfLottieIcons === 'function') window.initEdfLottieIcons();
    if (typeof window.refreshEdfLottieState === 'function') window.refreshEdfLottieState();
    lucide.createIcons();
}

async function saveDonation(e, keepOpen = false) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
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

    if (!(Number(payload.amount) > 0)) {
        showToast('Please enter a valid positive LKR amount', 'error');
        document.getElementById('donationAmount')?.focus();
        return;
    }
    if (payload.direction === 'income' && payload.donor_type === 'member' && !payload.member_id) {
        showToast('Please select a registered member', 'error');
        return;
    }
    if (payload.direction === 'income' && payload.donor_type === 'external' && !payload.donor_name) {
        showToast('Please enter the contributor name', 'error');
        return;
    }
    if (payload.direction === 'expense' && payload.recipient_type === 'beneficiary' && !payload.beneficiary_id) {
        showToast('Please select an approved beneficiary', 'error');
        return;
    }
    if (payload.direction === 'expense' && payload.recipient_type === 'family' && !payload.family_id) {
        showToast('Please select a registered family', 'error');
        return;
    }

    const isEdit = !!id;
    const url = isEdit ? `/api/edf/external-donations/${id}` : '/api/edf/external-donations';
    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast(isEdit ? 'Transaction updated' : 'Transaction recorded in treasury ledger', 'success');
            await fetchDonations();
            if (typeof fetchStats === 'function') fetchStats();
            if (keepOpen && !isEdit) {
                document.getElementById('donationAmount').value = '';
                document.getElementById('donationDescription').value = '';
                document.getElementById('donationDonorName').value = '';
                document.getElementById('donationDonorPhone').value = '';
                document.getElementById('donationRecipientName').value = '';
                document.getElementById('donationMemberId').value = '';
                document.getElementById('donationBeneficiaryId').value = '';
                document.getElementById('donationFamilyId').value = '';
                onDonPartySelected();
                document.getElementById('donationAmount')?.focus();
            } else {
                closeModal('donationModal');
            }
        } else {
            const r = await res.json();
            showToast(r.message || 'Save failed', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

async function deleteDonation(id) {
    if (!confirm('Delete this treasury entry? The linked ledger transaction will also be removed.')) return;
    try {
        const res = await fetch(`/api/edf/external-donations/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Transaction deleted', 'success');
            fetchDonations();
            if (typeof fetchStats === 'function') fetchStats();
        } else {
            showToast('Failed to delete transaction', 'error');
        }
    } catch (err) { showToast('Network error', 'error'); }
}

function viewDonationReceipt(id) {
    const d = donationData.find(x => x.id === id);
    if (!d) return;
    const cp = _donCounterparty(d);
    const txCode = _donTxCode(d.id);
    const dateStr = d.date ? new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const w = window.open('', '_blank', 'width=760,height=620');
    if (!w) { showToast('Allow popups to print voucher receipt', 'error'); return; }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><title>${txCode} · EDF Treasury Voucher</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 28px; color: #0f172a; background: #f8fafc; }
        .voucher { max-width: 640px; margin: 0 auto; background: #fff; border: 2px solid #059669; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
        .vhdr { background: linear-gradient(135deg, #064e3b, #059669); color: #fff; padding: 20px 26px; display: flex; justify-content: space-between; align-items: center; }
        .vhdr h2 { margin: 0; font-size: 18px; }
        .vtag { font-family: monospace; background: rgba(245,158,11,0.2); border: 1px solid #f59e0b; color: #fde68a; padding: 4px 10px; border-radius: 8px; font-weight: 800; }
        .vbody { padding: 22px 26px; }
        .vamt { font-size: 28px; font-weight: 800; color: ${cp.isExpense ? '#be123c' : '#047857'}; margin: 8px 0 18px; }
        .vgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 14px 0; }
        .vlbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .vval { font-weight: 700; margin-top: 2px; }
        .vfoot { padding: 16px 26px; background: #f8fafc; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
        @media print { body { margin: 0; background: #fff; } .voucher { box-shadow: none; } }
    </style></head><body>
    <div class="voucher">
        <div class="vhdr">
            <div>
                <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#a7f3d0; font-weight:700;">Equitable Development Foundation · Galgamuwa</div>
                <h2>${cp.isExpense ? 'Official Aid Disbursement Voucher' : 'Official Treasury Contribution Receipt'}</h2>
            </div>
            <div class="vtag">${txCode}</div>
        </div>
        <div class="vbody">
            <div style="font-size:12px; text-transform:uppercase; font-weight:700; color:#64748b;">Verified Amount</div>
            <div class="vamt">${cp.isExpense ? 'DISBURSED' : 'RECEIVED'}: ${_donLkr(d.amount)}</div>
            <div class="vgrid">
                <div><div class="vlbl">${cp.isExpense ? 'Recipient' : 'Contributor'}</div><div class="vval">${_donEsc(cp.name)}</div></div>
                <div><div class="vlbl">Party Category</div><div class="vval">${_donEsc(cp.roleLabel)}</div></div>
                <div><div class="vlbl">Fund Classification</div><div class="vval" style="text-transform:uppercase;">${_donEsc(d.donation_type || 'other')}</div></div>
                <div><div class="vlbl">Payment Method</div><div class="vval" style="text-transform:uppercase;">${_donEsc(d.payment_method || 'cash')}</div></div>
                <div><div class="vlbl">Transaction Date</div><div class="vval">${_donEsc(dateStr)}</div></div>
                <div><div class="vlbl">Contact / Ref</div><div class="vval">${_donEsc(cp.meta || '—')}</div></div>
                <div style="grid-column:span 2;"><div class="vlbl">Memo / Notes</div><div class="vval">${_donEsc(d.description || 'Internal EDF Treasury Record')}</div></div>
            </div>
        </div>
        <div class="vfoot">
            <span>Member-Sustained · Zero Outsider Funds</span>
            <span>Authorized Signatory: _______________________</span>
        </div>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 180);</script></body></html>`);
    w.document.close();
}

function exportDonationsExcel() {
    const rows = _getFilteredDonations();
    if (!rows.length) { showToast('No transactions to export', 'error'); return; }
    const mapped = rows.map(d => {
        const cp = _donCounterparty(d);
        return {
            'Voucher ID': _donTxCode(d.id),
            'Date': d.date ? String(d.date).slice(0, 10) : '',
            'Direction': cp.isExpense ? 'Disbursed (Expense)' : 'Inflow (Income)',
            'Party Type': cp.roleLabel,
            'Party Name': cp.name,
            'Phone / Ref': cp.meta || '',
            'Fund Category': (d.donation_type || 'other').toUpperCase(),
            'Method': (d.payment_method || 'cash').toUpperCase(),
            'Amount (LKR)': Number(d.amount || 0),
            'Notes': d.description || ''
        };
    });

    if (typeof XLSX !== 'undefined' && XLSX.utils) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(mapped);
        XLSX.utils.book_append_sheet(wb, ws, 'Treasury Ledger');
        XLSX.writeFile(wb, `EDF-Treasury-Ledger-${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast(`Exported ${rows.length} voucher(s) to Excel`, 'success');
    } else {
        const headers = Object.keys(mapped[0]);
        const csv = [headers.join(','), ...mapped.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `EDF-Treasury-Ledger-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        showToast(`Exported ${rows.length} voucher(s) to CSV`, 'success');
    }
}

function printDonationsReport() {
    const rows = _getFilteredDonations();
    if (!rows.length) { showToast('No ledger entries to print', 'error'); return; }
    const inflow = rows.filter(d => d.direction !== 'expense').reduce((s, d) => s + Number(d.amount || 0), 0);
    const expense = rows.filter(d => d.direction === 'expense').reduce((s, d) => s + Number(d.amount || 0), 0);
    const w = window.open('', '_blank', 'width=940,height=720');
    if (!w) { showToast('Allow popups to print ledger', 'error'); return; }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><title>EDF Treasury & Donations Statement</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 24px; color: #0f172a; }
        .hdr { background: linear-gradient(135deg, #064e3b, #059669); color: #fff; padding: 16px 22px; border-radius: 12px; display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px; }
        .kpi { display:flex; gap:12px; margin-bottom:14px; }
        .kcard { flex:1; border:1px solid #cbd5e1; border-radius:10px; padding:10px 14px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        th { background:#f1f5f9; text-align:left; padding:8px; border-bottom:2px solid #cbd5e1; font-size:11px; text-transform:uppercase; }
        td { padding:7px 8px; border-bottom:1px solid #e2e8f0; }
    </style></head><body>
    <div class="hdr">
        <div><h2 style="margin:0;">EDF Galgamuwa — Treasury &amp; Donations Ledger</h2><div style="font-size:12px;opacity:0.85;">Member-Sustained Charter · Filtered Audit Statement</div></div>
        <div style="font-size:12px;text-align:right;">Generated ${new Date().toLocaleDateString()}</div>
    </div>
    <div class="kpi">
        <div class="kcard"><div style="font-size:11px;color:#64748b;">INFLOW</div><strong style="color:#059669;font-size:16px;">LKR ${inflow.toLocaleString()}</strong></div>
        <div class="kcard"><div style="font-size:11px;color:#64748b;">DISBURSED</div><strong style="color:#e11d48;font-size:16px;">LKR ${expense.toLocaleString()}</strong></div>
        <div class="kcard"><div style="font-size:11px;color:#64748b;">NET BALANCE</div><strong style="color:#d97706;font-size:16px;">LKR ${(inflow - expense).toLocaleString()}</strong></div>
        <div class="kcard"><div style="font-size:11px;color:#64748b;">VOUCHERS</div><strong style="font-size:16px;">${rows.length}</strong></div>
    </div>
    <table><thead><tr><th>Voucher</th><th>Date</th><th>Direction</th><th>Party</th><th>Category</th><th>Method</th><th style="text-align:right;">Amount (LKR)</th></tr></thead><tbody>
    ${rows.map(d => {
        const cp = _donCounterparty(d);
        return `<tr>
            <td style="font-family:monospace;font-weight:700;">${_donTxCode(d.id)}</td>
            <td>${d.date ? new Date(d.date).toLocaleDateString() : ''}</td>
            <td>${cp.isExpense ? 'Disbursed' : 'Inflow'}</td>
            <td>${_donEsc(cp.name)}</td>
            <td style="text-transform:uppercase;">${_donEsc(d.donation_type || 'other')}</td>
            <td style="text-transform:uppercase;">${_donEsc(d.payment_method || 'cash')}</td>
            <td style="text-align:right;font-weight:700;color:${cp.isExpense ? '#be123c' : '#047857'};">${cp.isExpense ? '-' : '+'} ${Number(d.amount || 0).toLocaleString()}</td>
        </tr>`;
    }).join('')}
    </tbody></table>
    <script>window.onload = () => setTimeout(() => window.print(), 180);</script></body></html>`);
    w.document.close();
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

let _umAllUsers        = [];
let _umFilteredUsers   = [];
let _umOnlinePollTimer = null;
let _umPresenceFilter  = '';
const _umSelectedIds   = new Set();
let _umConfirmCallback = null;
let _umInspectTab      = 'events';
let _umInspectData     = null;

const UM_ALL_PERMISSIONS = [
    { key: 'members',        label: 'Members',       desc: 'Member & relatives registry',      icon: 'users' },
    { key: 'beneficiaries',  label: 'Beneficiaries', desc: 'Aid, families & SMS dispatch',     icon: 'hand-heart' },
    { key: 'finance',        label: 'Finance',       desc: 'Donations, ledger & subscriptions',icon: 'banknote' },
    { key: 'volunteers',     label: 'Volunteers',    desc: 'Volunteer force management',       icon: 'heart-handshake' },
    { key: 'courses',        label: 'Programs',      desc: 'Academy courses & customizer',     icon: 'graduation-cap' },
    { key: 'ramadan',        label: 'Ramadan',       desc: 'Token quota & shop relief',        icon: 'moon' },
    { key: 'reports',        label: 'Reports',       desc: 'Analytics & CSV/PDF exports',      icon: 'bar-chart-2' },
    { key: 'settings',       label: 'Settings',      desc: 'Workspace & SMS gateways',         icon: 'settings-2' },
    { key: 'users',          label: 'User Mgmt',     desc: 'Staff accounts & access control',  icon: 'shield-check' },
];

const UM_ROLE_META = {
    user:       { label: 'User',       color: '#64748b', desc: 'Standard baseline portal access' },
    viewer:     { label: 'Viewer',     color: '#64748b', desc: 'Read-only directory & reports audit' },
    editor:     { label: 'Editor',     color: '#0284c7', desc: 'Manage members, relief & programs' },
    manager:    { label: 'Manager',    color: '#059669', desc: 'Operations, finance & reporting lead' },
    super_user: { label: 'Super User', color: '#d97706', desc: 'Full module access + staff admin' },
    admin:      { label: 'Admin',      color: '#ef4444', desc: 'Unrestricted governance & data control' }
};

const UM_ROLE_DEFAULTS = {
    admin:      ['members','beneficiaries','finance','volunteers','courses','ramadan','reports','settings','users'],
    super_user: ['members','beneficiaries','finance','volunteers','courses','ramadan','reports','settings','users'],
    manager:    ['members','beneficiaries','finance','volunteers','courses','ramadan','reports'],
    editor:     ['members','beneficiaries','volunteers','courses','ramadan'],
    viewer:     ['members','beneficiaries','finance','volunteers','courses','ramadan','reports'],
    user:       [],
};

// ── Fetch all users ────────────────────────────────────────────────────────
async function fetchAdminUsers(manual = false) {
    try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) return;
        _umAllUsers = await res.json();

        // Keep selection valid across background polls
        const validIds = new Set(_umAllUsers.map(u => u.id));
        for (const sid of [..._umSelectedIds]) {
            if (!validIds.has(sid)) _umSelectedIds.delete(sid);
        }

        umFilterUsers();
        umRenderOnlineBar();
        umUpdateStats();
        const el = document.getElementById('umLastSynced');
        if (el) el.textContent = 'Synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (window.initEdfLottieIcons) window.initEdfLottieIcons();
        if (manual) showToast('User directory refreshed', 'success');
    } catch (err) { console.error('fetchAdminUsers:', err); }
}

// ── Quick filters & search ─────────────────────────────────────────────────
function umQuickRoleFilter(role) {
    const sel = document.getElementById('umRoleFilter');
    if (sel) sel.value = role || '';
    document.querySelectorAll('#umRolePills .um-filter-pill').forEach(btn => {
        btn.classList.toggle('active', (btn.getAttribute('data-role') || '') === (role || ''));
    });
    umFilterUsers();
}

function umQuickPresence(mode) {
    _umPresenceFilter = mode || '';
    const sel = document.getElementById('umStatusFilter');
    if (sel) sel.value = (mode === 'active' || mode === 'blocked') ? mode : '';
    document.querySelectorAll('#umStatusSeg .um-status-seg-btn').forEach(btn => {
        btn.classList.toggle('active', (btn.getAttribute('data-presence') || '') === _umPresenceFilter);
    });
    umFilterUsers();
}

function umResetFilters() {
    const search = document.getElementById('umSearch');
    if (search) search.value = '';
    umQuickRoleFilter('');
    umQuickPresence('');
}

function umFilterUsers() {
    const q      = (document.getElementById('umSearch')?.value      || '').toLowerCase();
    const role   = document.getElementById('umRoleFilter')?.value   || '';
    const status = document.getElementById('umStatusFilter')?.value || '';

    _umFilteredUsers = _umAllUsers.filter(u => {
        const matchQ = !q ||
            (u.full_name || '').toLowerCase().includes(q) ||
            (u.username  || '').toLowerCase().includes(q) ||
            (u.email     || '').toLowerCase().includes(q) ||
            (u.phone     || '').toLowerCase().includes(q) ||
            (u.bio       || '').toLowerCase().includes(q);
        const matchR = !role || u.role === role;
        let matchS = !status || u.status === status;
        if (_umPresenceFilter === 'online') matchS = u.is_online === 1;
        return matchQ && matchR && matchS;
    });

    umRenderTable(_umFilteredUsers);
}

function umRenderTable(users) {
    const tbody = document.getElementById('umTableBody');
    if (!tbody) return;
    const me = _currentUser;

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="um-empty-box">
            <div style="font-weight:700;color:var(--text-main);margin-bottom:0.25rem;">No matching operator accounts</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Try clearing your search or role filters, or create a new user account.</div>
        </td></tr>`;
        umUpdateBulkBar();
        if (window.lucide) lucide.createIcons();
        return;
    }

    tbody.innerHTML = users.map(u => {
        const isMe      = me && u.username === me.username;
        const isOnline  = u.is_online === 1;
        const isChecked = _umSelectedIds.has(u.id);
        const displayName = u.full_name || u.username;
        const avatarHtml = u.avatar_url
            ? `<img class="um-avatar-img" src="${_esc(u.avatar_url)}" alt="${_esc(displayName)}">`
            : `<span>${(displayName || '?')[0].toUpperCase()}</span>`;

        const lastLogin = u.last_login ? _umRelTime(u.last_login) : 'Never';
        const lastSeen  = isOnline ? 'Active now' : (u.last_seen ? `Seen ${_umRelTime(u.last_seen)}` : 'No heartbeat');
        const permCount = (u.permissions || []).length;
        const onlineBadge = isOnline
            ? `<span class="um-status-online"><span class="um-status-dot online"></span>Online</span>`
            : `<span class="um-status-offline"><span class="um-status-dot offline"></span>Offline</span>`;

        const blockedNote = u.status === 'blocked' && u.blocked_by_name
            ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">By ${_esc(u.blocked_by_name)}</div>` : '';

        const blockBtn = isMe ? '' : (u.status === 'active'
            ? `<button class="um-btn warn" onclick="umBlockUser(${u.id})" title="Block user"><i data-lucide="ban" style="width:13px;"></i></button>`
            : `<button class="um-btn success" onclick="umUnblockUser(${u.id})" title="Unblock user"><i data-lucide="check-circle" style="width:13px;"></i></button>`);

        const forceBtn = (isMe || !isOnline) ? '' :
            `<button class="um-btn warn um-signout-live" onclick="umForceLogout(${u.id})" title="Force sign out live session"><i data-lucide="log-out" style="width:13px;"></i> Sign Out</button>`;

        const chPassBtn = isMe ? '' :
            `<button class="um-btn" onclick="umOpenChangePassword(${u.id}, '${_esc(displayName)}')" title="Reset password"><i data-lucide="key" style="width:13px;"></i></button>`;

        const delBtn = isMe ? '' :
            `<button class="um-btn danger" onclick="umDeleteUser(${u.id}, '${_esc(displayName)}')" title="Delete user"><i data-lucide="trash-2" style="width:13px;"></i></button>`;

        return `<tr class="${isChecked ? 'is-selected' : ''}">
            <td>
                <input type="checkbox" ${isMe ? 'disabled title="Cannot bulk-select own account"' : ''} ${isChecked ? 'checked' : ''}
                    onchange="umToggleSelectUser(${u.id}, this.checked)">
            </td>
            <td>
                <div class="um-user-cell">
                    <div class="um-avatar" style="background:${umRoleColor(u.role)};">
                        ${avatarHtml}
                        <span class="${isOnline ? 'um-online-dot' : 'um-offline-dot'}"></span>
                    </div>
                    <div>
                        <div class="um-user-name">
                            ${_esc(displayName)}
                            ${isMe ? '<span class="um-you-pill">You</span>' : ''}
                        </div>
                        ${u.bio ? `<div class="um-user-title">${_esc(u.bio)}</div>` : ''}
                        <div class="um-user-sub">@${_esc(u.username)} &bull; ${_esc(u.email)}${u.phone ? ' &bull; ' + _esc(u.phone) : ''}</div>
                    </div>
                </div>
            </td>
            <td><span class="role-badge role-${u.role}">${(UM_ROLE_META[u.role]?.label || u.role).replace('_', ' ')}</span></td>
            <td>
                <div style="display:flex;flex-direction:column;gap:0.26rem;align-items:flex-start;">
                    <span class="${u.status === 'active' ? 'status-active' : 'status-blocked'}">${u.status === 'active' ? 'Active' : 'Blocked'}</span>
                    ${onlineBadge}
                    ${blockedNote}
                </div>
            </td>
            <td class="um-last-seen">
                <div style="font-weight:600;color:var(--text-main);">${lastLogin}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">${lastSeen}</div>
            </td>
            <td>
                <button type="button" class="um-perm-pill" onclick="umInspectUser(${u.id})" title="Inspect permissions & audit activity">
                    <i data-lucide="layers" style="width:12px;height:12px;"></i>
                    ${(u.role === 'admin' || u.role === 'super_user') ? 'Full Access' : `${permCount} / ${UM_ALL_PERMISSIONS.length}`}
                </button>
            </td>
            <td>
                <div class="um-actions">
                    <button class="um-btn inspect" onclick="umInspectUser(${u.id})" title="Inspect security dossier & logs"><i data-lucide="eye" style="width:13px;"></i></button>
                    <button class="um-btn" onclick="openUserModal(${u.id})" title="Edit user"><i data-lucide="edit-2" style="width:13px;"></i> Edit</button>
                    ${blockBtn}
                    ${forceBtn}
                    ${chPassBtn}
                    ${delBtn}
                </div>
            </td>
        </tr>`;
    }).join('');

    umUpdateBulkBar();
    if (window.lucide) lucide.createIcons();
}

function umRoleColor(role) {
    return UM_ROLE_META[role]?.color || '#64748b';
}

function umUpdateStats() {
    const total   = _umAllUsers.length;
    const online  = _umAllUsers.filter(u => u.is_online === 1).length;
    const blocked = _umAllUsers.filter(u => u.status === 'blocked').length;
    const active  = total - blocked;
    const admins  = _umAllUsers.filter(u => u.role === 'admin' || u.role === 'super_user').length;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    s('umTotalCount',   total);
    s('umOnlineCount',  online);
    s('umBlockedCount', blocked);
    s('umAdminCount',   admins);
    s('umActiveRatioMeta', `${active} active · ${blocked} blocked`);

    const countByRole = (r) => _umAllUsers.filter(u => u.role === r).length;
    s('umRoleCntAll', total);
    s('umRoleCntAdmin', countByRole('admin'));
    s('umRoleCntSuper', countByRole('super_user'));
    s('umRoleCntManager', countByRole('manager'));
    s('umRoleCntEditor', countByRole('editor'));
    s('umRoleCntViewer', countByRole('viewer'));
    s('umRoleCntUser', countByRole('user'));
}

function umRenderOnlineBar() {
    const onlineUsers = _umAllUsers.filter(u => u.is_online === 1);
    const el = document.getElementById('umOnlineChips');
    if (!el) return;
    if (!onlineUsers.length) {
        el.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">No operators currently active online</span>`;
        return;
    }
    el.innerHTML = onlineUsers.map(u => `
        <span class="um-online-chip" onclick="umInspectUser(${u.id})" title="Click to inspect live session">
            <span class="pulse-dot"></span>
            ${_esc(u.full_name || u.username)}
            <span style="opacity:0.7;font-size:0.66rem;">${(UM_ROLE_META[u.role]?.label || u.role).replace('_', ' ')}</span>
        </span>`).join('');
}

// ── Bulk Selection Helpers ─────────────────────────────────────────────────
function umToggleSelectUser(id, checked) {
    if (checked) _umSelectedIds.add(id);
    else _umSelectedIds.delete(id);
    umUpdateBulkBar();
    document.querySelectorAll('#umTableBody tr').forEach(tr => {
        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) tr.classList.toggle('is-selected', cb.checked);
    });
}

function umToggleSelectAll(checked) {
    const me = _currentUser;
    _umFilteredUsers.forEach(u => {
        if (me && u.username === me.username) return;
        if (checked) _umSelectedIds.add(u.id);
        else _umSelectedIds.delete(u.id);
    });
    umRenderTable(_umFilteredUsers);
}

function umClearSelection() {
    _umSelectedIds.clear();
    const headerCb = document.getElementById('umSelectAllCb');
    if (headerCb) headerCb.checked = false;
    umRenderTable(_umFilteredUsers);
}

function umUpdateBulkBar() {
    const bar = document.getElementById('umBulkBar');
    const lbl = document.getElementById('umBulkCountLabel');
    const headerCb = document.getElementById('umSelectAllCb');
    if (bar) bar.classList.toggle('visible', _umSelectedIds.size > 0);
    if (lbl) lbl.textContent = `${_umSelectedIds.size} operator${_umSelectedIds.size === 1 ? '' : 's'} selected`;
    if (headerCb) {
        const selectable = _umFilteredUsers.filter(u => !(_currentUser && u.username === _currentUser.username));
        headerCb.checked = selectable.length > 0 && selectable.every(u => _umSelectedIds.has(u.id));
    }
}

function umExecuteBulk(action) {
    const ids = [..._umSelectedIds];
    if (!ids.length) return;
    const labels = {
        block: { title: 'Block Selected Accounts', text: `Suspend login access and terminate active sessions for ${ids.length} selected account(s)?`, btn: 'Block Accounts', danger: true },
        unblock: { title: 'Restore Selected Accounts', text: `Restore login access for ${ids.length} selected account(s)?`, btn: 'Unblock Accounts', danger: false },
        force_logout: { title: 'Force Sign Out Sessions', text: `Terminate live sessions for ${ids.length} selected user(s)?`, btn: 'Sign Out All', danger: true }
    }[action];
    if (!labels) return;

    umConfirmAction({
        title: labels.title,
        sub: `${ids.length} accounts queued`,
        message: labels.text,
        btnText: labels.btn,
        danger: labels.danger,
        onConfirm: async () => {
            const res = await fetch('/api/admin/users/bulk-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_ids: ids, action })
            });
            const r = await res.json();
            showToast(r.message || 'Done', res.ok ? 'success' : 'error');
            if (res.ok) {
                umClearSelection();
                fetchAdminUsers();
            }
        }
    });
}

// ── Export Filtered Directory CSV ──────────────────────────────────────────
function umExportUsersCsv() {
    const rows = _umFilteredUsers.length ? _umFilteredUsers : _umAllUsers;
    if (!rows.length) { showToast('No users to export', 'info'); return; }
    const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'Username', 'Full Name', 'Email', 'Phone', 'Title/Notes', 'Role', 'Status', 'Online', 'Last Login', 'Modules'];
    const lines = [headers.join(',')].concat(rows.map(u => [
        u.id,
        escCsv(u.username),
        escCsv(u.full_name || ''),
        escCsv(u.email || ''),
        escCsv(u.phone || ''),
        escCsv(u.bio || ''),
        escCsv(u.role),
        escCsv(u.status || 'active'),
        u.is_online === 1 ? 'Online' : 'Offline',
        escCsv(u.last_login || ''),
        escCsv((u.permissions || []).join('; '))
    ].join(',')));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edf-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} user records`, 'success');
}

// Relative time helper
function _umRelTime(dt) {
    if (!dt) return '—';
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

// ── Modal: Open Add / Edit User ────────────────────────────────────────────
function openUserModal(userId) {
    const isEdit = !!userId;
    document.getElementById('userModalTitle').textContent = isEdit ? 'Edit User Account' : 'Add New User Account';
    const sub = document.getElementById('umUserModalSubtitle');
    if (sub) sub.textContent = isEdit ? 'Update operator identity, role tier, status, and module entitlements.' : 'Provision a new staff operator with role-based permissions.';
    document.getElementById('umSaveBtnText').textContent  = isEdit ? 'Save Changes' : 'Create User';
    document.getElementById('umEditId').value = userId || '';
    document.getElementById('umPasswordHint').style.display = isEdit ? 'inline' : 'none';
    document.getElementById('umPasswordLabel').innerHTML = isEdit
        ? 'New Password (optional)'
        : 'Password <span style="color:#ef4444;">*</span>';
    document.getElementById('umPassword').value = '';
    const statusWrap = document.getElementById('umStatusFieldWrap');
    if (statusWrap) statusWrap.style.display = isEdit ? 'flex' : 'none';

    _umBuildRoleCards();
    _umBuildPermGrid();

    if (isEdit) {
        const u = _umAllUsers.find(x => x.id === userId);
        if (!u) return;
        document.getElementById('umFullName').value = u.full_name || '';
        document.getElementById('umUsername').value = u.username  || '';
        document.getElementById('umEmail').value    = u.email     || '';
        document.getElementById('umPhone').value    = u.phone     || '';
        document.getElementById('umBio').value      = u.bio       || '';
        document.getElementById('umRole').value     = u.role      || 'user';
        const stSel = document.getElementById('umAccountStatus');
        if (stSel) stSel.value = u.status || 'active';

        const userPerms = new Set(u.permissions || []);
        document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => {
            cb.checked = userPerms.has(cb.value);
        });
        _umHighlightRoleCard(u.role || 'user');
    } else {
        document.getElementById('umFullName').value = '';
        document.getElementById('umUsername').value = '';
        document.getElementById('umEmail').value    = '';
        document.getElementById('umPhone').value    = '';
        document.getElementById('umBio').value      = '';
        document.getElementById('umRole').value     = 'user';
        const stSel = document.getElementById('umAccountStatus');
        if (stSel) stSel.value = 'active';
        _umHighlightRoleCard('user');
        umApplyRoleDefaults();
    }

    umUpdatePasswordStrength('umPassword', 'umStrength');
    umUpdatePermCount();
    umUpdateModalPreview();
    openModal('userModal');
    if (window.initEdfLottieIcons) window.initEdfLottieIcons();
    if (window.lucide) lucide.createIcons();
}

function _umBuildRoleCards() {
    const grid = document.getElementById('umRoleCardsGrid');
    if (!grid) return;
    const canAssignAdmin = !_currentUser || _currentUser.role === 'admin';
    grid.innerHTML = Object.entries(UM_ROLE_META).map(([key, meta]) => {
        const locked = !canAssignAdmin && (key === 'admin' || key === 'super_user');
        return `<button type="button" class="um-role-card" data-role-card="${key}" ${locked ? 'disabled title="Only full administrators can assign this tier"' : ''} onclick="umSelectRoleCard('${key}')">
            <span class="um-role-card-title">
                <span>${meta.label}</span>
                <span class="role-badge role-${key}" style="font-size:0.58rem;padding:0.1rem 0.38rem;">${locked ? 'Admin Only' : (UM_ROLE_DEFAULTS[key] || []).length + ' mods'}</span>
            </span>
            <span class="um-role-card-desc">${meta.desc}</span>
        </button>`;
    }).join('');
}

function _umHighlightRoleCard(role) {
    document.querySelectorAll('#umRoleCardsGrid .um-role-card').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-role-card') === role);
    });
}

function umSelectRoleCard(role) {
    const sel = document.getElementById('umRole');
    if (sel) sel.value = role;
    _umHighlightRoleCard(role);
    const isEdit = !!document.getElementById('umEditId')?.value;
    if (!isEdit) {
        umApplyRoleDefaults();
    } else {
        umUpdateModalPreview();
    }
}

function umHandleRoleSelectChange() {
    const role = document.getElementById('umRole')?.value || 'user';
    _umHighlightRoleCard(role);
    umApplyRoleDefaults();
}

function _umBuildPermGrid() {
    const grid = document.getElementById('umPermGrid');
    if (!grid) return;
    grid.innerHTML = UM_ALL_PERMISSIONS.map(p => `
        <label class="perm-chip">
            <input type="checkbox" value="${p.key}" onchange="umUpdatePermCount(); umUpdateModalPreview();">
            <div>
                <div class="perm-chip-title">
                    <i data-lucide="${p.icon}" style="width:13px;height:13px;flex-shrink:0;color:#059669;"></i>
                    <span>${p.label}</span>
                </div>
                <div class="perm-chip-desc">${p.desc}</div>
            </div>
        </label>`).join('');
    if (window.lucide) lucide.createIcons();
}

function umApplyRoleDefaults() {
    const role = document.getElementById('umRole')?.value || 'user';
    const defaults = new Set(UM_ROLE_DEFAULTS[role] || []);
    document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => {
        cb.checked = defaults.has(cb.value);
    });
    umUpdatePermCount();
    umUpdateModalPreview();
}

function umSelectAllPerms(checked) {
    document.querySelectorAll('#umPermGrid input[type=checkbox]').forEach(cb => { cb.checked = checked; });
    umUpdatePermCount();
    umUpdateModalPreview();
}

function umUpdatePermCount() {
    const count = document.querySelectorAll('#umPermGrid input[type=checkbox]:checked').length;
    const total = UM_ALL_PERMISSIONS.length;
    const b1 = document.getElementById('umPermCountBadge');
    const b2 = document.getElementById('umPreviewPerms');
    if (b1) b1.textContent = `${count} / ${total}`;
    if (b2) b2.textContent = `${count} / ${total} modules`;
}

function umUpdateModalPreview() {
    const fullName = document.getElementById('umFullName')?.value.trim() || '';
    const username = document.getElementById('umUsername')?.value.trim() || '';
    const email    = document.getElementById('umEmail')?.value.trim() || '';
    const role     = document.getElementById('umRole')?.value || 'user';

    const avatar = document.getElementById('umPreviewAvatar');
    const nameEl = document.getElementById('umPreviewName');
    const subEl  = document.getElementById('umPreviewSub');
    const badge  = document.getElementById('umPreviewRoleBadge');

    if (avatar) {
        avatar.textContent = (fullName || username || 'U')[0].toUpperCase();
        avatar.style.background = umRoleColor(role);
    }
    if (nameEl) nameEl.textContent = fullName || username || 'New Operator Account';
    if (subEl)  subEl.textContent  = `${username ? '@' + username : '@username'} • ${email || 'email pending'}`;
    if (badge) {
        badge.className = `role-badge role-${role}`;
        badge.textContent = UM_ROLE_META[role]?.label || role;
    }
}

function umSuggestUsername() {
    const fullName = document.getElementById('umFullName')?.value.trim() || '';
    if (!fullName) { showToast('Enter Full Name first to auto-suggest a username', 'info'); return; }
    const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    const inp = document.getElementById('umUsername');
    if (inp && slug) {
        inp.value = slug;
        umUpdateModalPreview();
    }
}

// ── Password UX Helpers ────────────────────────────────────────────────────
function umTogglePasswordEye(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    if (btn) btn.textContent = isHidden ? 'Hide' : 'Show';
}

function umUpdatePasswordStrength(inputId, prefix) {
    const val = document.getElementById(inputId)?.value || '';
    const bars = document.getElementById(`${prefix}Bars`);
    const lbl  = document.getElementById(`${prefix}Label`);
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    if (!val.length) score = 0;

    if (bars) {
        bars.querySelectorAll('.um-strength-seg').forEach((seg, idx) => {
            seg.className = 'um-strength-seg' + (idx < score ? ` lvl-${score}` : '');
        });
    }
    if (lbl) {
        const labels = ['Minimum 8 characters required', 'Weak — add numbers & uppercase', 'Fair — add symbols for strength', 'Good password', 'Strong sanctuary credential'];
        lbl.textContent = labels[score];
    }
}

function umGenerateStrongPassword(inputId, prefix, confirmId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    const inp = document.getElementById(inputId);
    if (inp) {
        inp.value = pwd;
        inp.type = 'text';
        const btn = inp.parentElement?.querySelector('.um-pass-eye');
        if (btn) btn.textContent = 'Hide';
    }
    if (confirmId) {
        const cInp = document.getElementById(confirmId);
        if (cInp) cInp.value = pwd;
        umCheckPasswordMatch();
    }
    umUpdatePasswordStrength(inputId, prefix);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pwd).catch(() => {});
    }
    showToast('Strong password generated & copied to clipboard', 'success');
}

function umCheckPasswordMatch() {
    const p1 = document.getElementById('cpNewPassword')?.value || '';
    const p2 = document.getElementById('cpConfirmPassword')?.value || '';
    const msg = document.getElementById('cpMatchText');
    if (!msg) return;
    if (!p2) { msg.textContent = ''; return; }
    if (p1 === p2) {
        msg.style.color = '#10b981';
        msg.textContent = 'Passwords match';
    } else {
        msg.style.color = '#ef4444';
        msg.textContent = 'Passwords do not match yet';
    }
}

// ── Save user (create or update) ───────────────────────────────────────────
async function saveUser() {
    const id       = document.getElementById('umEditId').value;
    const isEdit   = !!id;
    const username = document.getElementById('umUsername').value.trim();
    const email    = document.getElementById('umEmail').value.trim();
    const fullName = document.getElementById('umFullName').value.trim();
    const phone    = document.getElementById('umPhone')?.value.trim() || '';
    const bio      = document.getElementById('umBio')?.value.trim() || '';
    const role     = document.getElementById('umRole').value;
    const status   = document.getElementById('umAccountStatus')?.value || 'active';
    const password = document.getElementById('umPassword').value;
    const permissions = Array.from(
        document.querySelectorAll('#umPermGrid input[type=checkbox]:checked')
    ).map(cb => cb.value);

    if (!username || !email) { showToast('Username and email are required', 'error'); return; }
    if (!isEdit && !password) { showToast('Password is required', 'error'); return; }
    if (password && password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }

    const body = { username, email, full_name: fullName, phone, bio, role, permissions };
    if (isEdit) body.status = status;
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

// ── Branded Governance Confirmation Modal ──────────────────────────────────
function umConfirmAction({ title, sub, message, btnText, danger = true, onConfirm }) {
    _umConfirmCallback = onConfirm;
    document.getElementById('umConfirmTitle').textContent   = title || 'Confirm Action';
    document.getElementById('umConfirmSub').textContent     = sub || 'Administrative verification';
    document.getElementById('umConfirmMsg').textContent     = message || '';
    document.getElementById('umConfirmBtnText').textContent = btnText || 'Confirm';
    const btn = document.getElementById('umConfirmExecBtn');
    if (btn) btn.className = danger ? 'um-btn-danger' : 'um-btn-emerald';
    openModal('umConfirmModal');
    if (window.initEdfLottieIcons) window.initEdfLottieIcons();
}

async function umRunConfirmedAction() {
    const fn = _umConfirmCallback;
    _umConfirmCallback = null;
    closeModal('umConfirmModal');
    if (typeof fn === 'function') await fn();
}

// ── Block / Unblock / Force Logout / Delete ────────────────────────────────
async function umBlockUser(id) {
    const u = _umAllUsers.find(x => x.id === id);
    if (!u) return;
    umConfirmAction({
        title: 'Block User Account',
        sub: `@${u.username}`,
        message: `Block account for "${u.full_name || u.username}"? Active sessions will terminate immediately and login access will be suspended.`,
        btnText: 'Block Account',
        danger: true,
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/users/${id}/block`, { method: 'POST' });
                const r   = await res.json();
                showToast(r.message, res.ok ? 'success' : 'error');
                if (res.ok) fetchAdminUsers();
            } catch { showToast('Network error', 'error'); }
        }
    });
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

async function umForceLogout(id) {
    const u = _umAllUsers.find(x => x.id === id);
    if (!u) return;
    umConfirmAction({
        title: 'Terminate Live Session',
        sub: `@${u.username}`,
        message: `Force sign out "${u.full_name || u.username}"? Their current browser session will be invalidated right away.`,
        btnText: 'Force Sign Out',
        danger: true,
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/users/${id}/force-logout`, { method: 'POST' });
                const r   = await res.json();
                showToast(r.message, res.ok ? 'success' : 'error');
                if (res.ok) fetchAdminUsers();
            } catch { showToast('Network error', 'error'); }
        }
    });
}

// ── Change password (admin resets another user's password) ─────────────────
function umOpenChangePassword(id, name) {
    document.getElementById('cpUserId').value   = id;
    document.getElementById('cpUserName').textContent = name;
    document.getElementById('cpNewPassword').value    = '';
    document.getElementById('cpConfirmPassword').value = '';
    umUpdatePasswordStrength('cpNewPassword', 'cpStrength');
    const msg = document.getElementById('cpMatchText');
    if (msg) msg.textContent = '';
    openModal('changePasswordModal');
    if (window.initEdfLottieIcons) window.initEdfLottieIcons();
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

async function umDeleteUser(id, name) {
    umConfirmAction({
        title: 'Delete User Account',
        sub: 'Permanent removal',
        message: `Permanently delete user "${name}"? Permissions and profile credentials will be removed and cannot be recovered.`,
        btnText: 'Delete Account',
        danger: true,
        onConfirm: async () => {
            try {
                const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
                const r   = await res.json();
                showToast(r.message, res.ok ? 'success' : 'error');
                if (res.ok) fetchAdminUsers();
            } catch { showToast('Network error', 'error'); }
        }
    });
}

// ── Inspect User Security Dossier Modal ────────────────────────────────────
async function umInspectUser(id) {
    _umInspectTab = 'events';
    _umInspectData = null;
    const body = document.getElementById('umInspectBody');
    const ftr  = document.getElementById('umInspectFooter');
    if (body) body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Loading security telemetry…</div>`;
    openModal('userInspectModal');
    if (window.initEdfLottieIcons) window.initEdfLottieIcons();

    try {
        const res = await fetch(`/api/admin/users/${id}/activity`);
        if (!res.ok) {
            if (body) body.innerHTML = `<div style="padding:1.5rem;color:#ef4444;">Failed to load user dossier.</div>`;
            return;
        }
        _umInspectData = await res.json();
        _umRenderInspectModal();
    } catch (err) {
        if (body) body.innerHTML = `<div style="padding:1.5rem;color:#ef4444;">Network error loading telemetry.</div>`;
    }
    if (ftr && _umInspectData?.user) {
        const u = _umInspectData.user;
        const isMe = _currentUser && u.username === _currentUser.username;
        ftr.innerHTML = `
            <span style="font-size:0.74rem;color:var(--text-muted);">Joined ${u.created_at ? new Date(String(u.created_at).endsWith('Z') ? u.created_at : u.created_at + 'Z').toLocaleDateString() : '—'}</span>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                ${!isMe && u.is_online === 1 ? `<button type="button" class="um-btn-outline" onclick="closeModal('userInspectModal'); umForceLogout(${u.id})">Force Sign Out</button>` : ''}
                ${!isMe ? `<button type="button" class="um-btn-outline" onclick="closeModal('userInspectModal'); umOpenChangePassword(${u.id}, '${_esc(u.full_name || u.username)}')">Reset Password</button>` : ''}
                <button type="button" class="um-btn-emerald" onclick="closeModal('userInspectModal'); openUserModal(${u.id})">Edit Account</button>
            </div>`;
    }
}

function umSwitchInspectTab(tab) {
    _umInspectTab = tab;
    _umRenderInspectModal();
}

function _umRenderInspectModal() {
    const body = document.getElementById('umInspectBody');
    if (!body || !_umInspectData) return;
    const { user: u, loginEvents = [], auditLogs = [] } = _umInspectData;
    const displayName = u.full_name || u.username;
    const perms = u.permissions || [];
    const permPills = perms.length
        ? perms.map(p => `<span class="um-perm-pill" style="cursor:default;font-size:0.7rem;">${_esc(p)}</span>`).join('')
        : `<span style="font-size:0.76rem;color:var(--text-muted);">No module permissions assigned</span>`;

    const eventsHtml = loginEvents.length
        ? loginEvents.map(ev => `
            <div class="um-feed-item">
                <div style="display:flex;align-items:center;gap:0.55rem;">
                    <span class="um-feed-badge ${_esc(ev.event_type)}">${_esc(ev.event_type).replace('_', ' ')}</span>
                    <span style="color:var(--text-main);font-weight:600;">${ev.ip_address ? _esc(ev.ip_address) : 'Local / Web Session'}</span>
                </div>
                <span style="color:var(--text-muted);font-size:0.72rem;">${_umRelTime(ev.created_at)}</span>
            </div>`).join('')
        : `<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:0.8rem;">No recorded login events yet.</div>`;

    const auditHtml = auditLogs.length
        ? auditLogs.map(log => `
            <div class="um-feed-item">
                <div>
                    <strong style="color:var(--text-main);">${_esc(log.action)}</strong>
                    <span style="color:#059669;font-weight:700;margin-left:0.3rem;">${_esc(log.entity)}</span>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${_esc(log.details || '')}</div>
                </div>
                <span style="color:var(--text-muted);font-size:0.72rem;white-space:nowrap;">${_umRelTime(log.created_at)}</span>
            </div>`).join('')
        : `<div style="padding:1.25rem;text-align:center;color:var(--text-muted);font-size:0.8rem;">No recent module actions logged.</div>`;

    body.innerHTML = `
        <div class="um-inspect-hero">
            <div style="display:flex;align-items:center;gap:0.85rem;">
                <div class="um-preview-avatar" style="background:${umRoleColor(u.role)};width:48px;height:48px;">
                    ${u.avatar_url ? `<img src="${_esc(u.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">` : _esc((displayName || 'U')[0].toUpperCase())}
                </div>
                <div>
                    <div style="font-size:0.98rem;font-weight:800;color:var(--text-main);">${_esc(displayName)}</div>
                    <div style="font-size:0.76rem;color:var(--text-muted);">@${_esc(u.username)} &bull; ${_esc(u.email)}</div>
                    ${u.bio ? `<div style="font-size:0.74rem;color:#059669;font-weight:600;margin-top:0.15rem;">${_esc(u.bio)}</div>` : ''}
                </div>
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <span class="role-badge role-${u.role}">${_esc(UM_ROLE_META[u.role]?.label || u.role)}</span>
                <span class="${u.is_online === 1 ? 'um-status-online' : 'um-status-offline'}">
                    <span class="um-status-dot ${u.is_online === 1 ? 'online' : 'offline'}"></span>
                    ${u.is_online === 1 ? 'Online' : 'Offline'}
                </span>
            </div>
        </div>

        <div class="um-inspect-meta-grid">
            <div class="um-inspect-stat"><div class="k">Account Status</div><div class="v">${u.status === 'blocked' ? `Blocked${u.blocked_by_name ? ' by ' + _esc(u.blocked_by_name) : ''}` : 'Active & Permitted'}</div></div>
            <div class="um-inspect-stat"><div class="k">Last Sign-In</div><div class="v">${u.last_login ? _umRelTime(u.last_login) : 'Never logged in'}</div></div>
            <div class="um-inspect-stat"><div class="k">Phone / Contact</div><div class="v">${_esc(u.phone || 'Not provided')}</div></div>
        </div>

        <div class="um-form-section">
            <div class="um-section-hdr">
                <span class="um-section-title">Entitled Modules (${(u.role === 'admin' || u.role === 'super_user') ? 'All Bypassed' : perms.length})</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">${permPills}</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.65rem;">
            <div class="um-inspect-tabs">
                <button type="button" class="um-inspect-tab ${_umInspectTab === 'events' ? 'active' : ''}" onclick="umSwitchInspectTab('events')">Session Events (${loginEvents.length})</button>
                <button type="button" class="um-inspect-tab ${_umInspectTab === 'audit' ? 'active' : ''}" onclick="umSwitchInspectTab('audit')">System Audit Trail (${auditLogs.length})</button>
            </div>
            <div class="um-feed-list">${_umInspectTab === 'events' ? eventsHtml : auditHtml}</div>
        </div>
    `;
}

// Volunteer Registry module is managed in /js/volunteers.js

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

    // Bind Mark All Read handlers
    document.getElementById('markAllReadBtn')?.addEventListener('click', (e) => { e.stopPropagation(); markAllNotificationsAsRead(); });
    document.getElementById('markAllReadPageBtn')?.addEventListener('click', markAllNotificationsAsRead);

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
            const setBrandPreviewLogo = document.getElementById('setBrandPreviewLogo');
            if (setBrandPreviewLogo) {
                setBrandPreviewLogo.innerHTML = `<img src="${config.logo_url}" style="width:100%; height:100%; object-fit:contain;">`;
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
        if (typeof syncBrandPreview === 'function') syncBrandPreview();
    } catch (e) {
        console.error('Failed to load branding:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BENEFICIARY DIRECT AIDS, EQUIPMENT, HOME RECONSTRUCTION & FIELD LOGS MODULE
// ═══════════════════════════════════════════════════════════════════════════════
let _activeViewBenId = null;
let _activeViewBenRecord = null;
let _vbenHelpsCatFilter = 'all';
let _benHelpsHubState = {
    helps: [],
    logs: [],
    summary: null,
    categoryFilter: 'all',
    loaded: false
};

const BEN_HELP_CAT_META = {
    money: {
        label: 'Cash / Money Aid',
        short: 'Cash Aid',
        icon: 'banknote',
        titleLabel: 'Aid Purpose / Disbursement Title *',
        titlePh: 'e.g., Monthly Living Stipend / Emergency Medical Cash Grant',
        amountLabel: 'Cash Amount (LKR)',
        scopeLabel: 'Purpose / Breakdown',
        scopePh: 'e.g., Direct household living support / urgent prescription bills',
        contractorLabel: 'Disbursing Officer / Branch',
        lottie: 'aidcash'
    },
    equipment: {
        label: 'Equipment & Tools',
        short: 'Equipment',
        icon: 'wrench',
        titleLabel: 'Equipment / Provision Name *',
        titlePh: 'e.g., Heavy-Duty Sewing Machine / School Uniforms & Laptop',
        amountLabel: 'Purchase Value (LKR)',
        scopeLabel: 'Equipment Specs / Model Details',
        scopePh: 'e.g., Juki DDL-8100e Motor + Table + Accessory Kit',
        contractorLabel: 'Vendor / Supplier / Store',
        lottie: 'toolbox'
    },
    home_reconstruction: {
        label: 'Home Reconstruction',
        short: 'Home Rebuild',
        icon: 'home',
        titleLabel: 'Reconstruction Project Title *',
        titlePh: 'e.g., Two-Room Brick House Rebuild / Complete Flood Rebuild',
        amountLabel: 'Project Budget / Spent (LKR)',
        scopeLabel: 'Structural & Construction Scope',
        scopePh: 'e.g., Foundation, 12x18ft masonry walls, lintel & roofing sheets',
        contractorLabel: 'Lead Mason / Contractor',
        lottie: 'homecare'
    },
    building_repair: {
        label: 'Building Repair',
        short: 'Building Repair',
        icon: 'hammer',
        titleLabel: 'Repair / Renovation Title *',
        titlePh: 'e.g., Roof Sheet Replacement & Wall Plastering / Bathroom Repair',
        amountLabel: 'Repair Cost (LKR)',
        scopeLabel: 'Repair Scope & Materials',
        scopePh: 'e.g., 18 asbestos sheets, ridge caps, cement bags & labor',
        contractorLabel: 'Technician / Hardware & Mason',
        lottie: 'repairhammer'
    },
    other: {
        label: 'Other Support',
        short: 'Other Support',
        icon: 'package-plus',
        titleLabel: 'Support Title *',
        titlePh: 'e.g., Clean Water Filter & Rainwater Tank / Solar Lamp Kit',
        amountLabel: 'Support Value (LKR)',
        scopeLabel: 'Support Specifications',
        scopePh: 'e.g., 500L storage tank with piping and fittings',
        contractorLabel: 'Supplier / Coordinator',
        lottie: 'aidpackage'
    }
};

const BEN_HELP_STATUS_LABELS = {
    planned: 'Planned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
};

const BEN_HELP_LOG_ACTION_LABELS = {
    created: 'Recorded Help',
    updated: 'Updated Details',
    status_change: 'Status Update',
    field_visit: 'Field Visit',
    delivery: 'Delivery Handover',
    inspection: 'Site Inspection',
    milestone: 'Work Milestone',
    note: 'Field Note'
};

function escapeBhHtml(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatBhLkr(v) {
    const n = Number(v || 0) || 0;
    return `LKR ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
}

function formatBhDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return escapeBhHtml(dt);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBhDateOnly(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return escapeBhHtml(dt);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _getBenHelpMeta(cat) {
    return BEN_HELP_CAT_META[cat] || BEN_HELP_CAT_META.other;
}

function _buildBenRowHelpsBadgeHtml(b) {
    const cnt = Number(b?.helps_count || 0);
    if (cnt <= 0) {
        return `<button type="button" class="ben-helps-add-chip" onclick="event.stopPropagation(); openBeneficiaryHelpModal(null, ${Number(b.id)})" title="Record Money, Equipment, Home Reconstruction or Repair"><i data-lucide="plus" style="width:11px;height:11px;"></i> Add Help</button>`;
    }
    const activeCnt = Number(b.active_helps_count || 0);
    const totalVal = Number(b.helps_total_value || 0);
    const valStr = totalVal > 0 ? ` · ${formatBhLkr(totalVal)}` : '';
    const actStr = activeCnt > 0 ? ` · ${activeCnt} Active` : '';
    return `<button type="button" class="ben-helps-cell-chip ${activeCnt > 0 ? 'has-active' : ''}" onclick="event.stopPropagation(); openBenHelpsTab(${Number(b.id)})" title="Click to manage ${cnt} helps & chronological logs">${cnt} ${cnt === 1 ? 'Help' : 'Helps'}${valStr}${actStr}</button>`;
}

function openBenHelpsTab(benId) {
    if (!benId) return;
    viewBeneficiary(benId, 'vben-helps');
}

function _renderHelpCardHtml(h, opts = {}) {
    const showBeneficiaryLink = Boolean(opts.showBeneficiaryLink);
    const cat = h.help_category && BEN_HELP_CAT_META[h.help_category] ? h.help_category : 'other';
    const meta = _getBenHelpMeta(cat);
    const status = h.status && BEN_HELP_STATUS_LABELS[h.status] ? h.status : 'planned';
    const progress = Math.max(0, Math.min(100, Number(h.progress_pct || 0)));
    const amountVal = Number(h.amount || 0) || 0;
    const isCancelled = status === 'cancelled';
    const isActive = status === 'in_progress' || status === 'planned';

    const metaBits = [];
    if (h.quantity) metaBits.push(`<span><i data-lucide="hash" style="width:11px;height:11px;vertical-align:middle;"></i> Qty: <strong>${escapeBhHtml(h.quantity)}</strong></span>`);
    if (h.item_or_scope) metaBits.push(`<span><i data-lucide="file-text" style="width:11px;height:11px;vertical-align:middle;"></i> ${escapeBhHtml(h.item_or_scope)}</span>`);
    if (h.contractor_or_supplier) metaBits.push(`<span><i data-lucide="building-2" style="width:11px;height:11px;vertical-align:middle;"></i> ${escapeBhHtml(h.contractor_or_supplier)}</span>`);
    if (h.payment_method) metaBits.push(`<span><i data-lucide="wallet" style="width:11px;height:11px;vertical-align:middle;"></i> ${escapeBhHtml(String(h.payment_method).replace('_', ' '))}</span>`);
    if (h.reference_no) metaBits.push(`<span><i data-lucide="tag" style="width:11px;height:11px;vertical-align:middle;"></i> Ref: <strong>${escapeBhHtml(h.reference_no)}</strong></span>`);
    if (h.provided_by) metaBits.push(`<span><i data-lucide="user-check" style="width:11px;height:11px;vertical-align:middle;"></i> By: ${escapeBhHtml(h.provided_by)}</span>`);

    const prioHtml = h.priority === 'urgent'
        ? `<span class="bh-prio-urgent">Urgent</span>`
        : (h.priority === 'high' ? `<span class="bh-prio-high">High</span>` : '');

    const benHeaderHtml = showBeneficiaryLink
        ? `<div style="font-size:0.74rem; color:var(--text-muted); margin-top:0.12rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                <span style="font-weight:700; color:#10b981; cursor:pointer;" onclick="openBenHelpsTab(${Number(h.beneficiary_id)})">${escapeBhHtml(h.beneficiary_name || 'Beneficiary #' + h.beneficiary_id)}</span>
                ${h.application_number ? `<span class="fam-code-badge" style="font-size:0.65rem; padding:0.04rem 0.36rem;">${escapeBhHtml(h.application_number)}</span>` : ''}
                ${h.home_town ? `<span>· ${escapeBhHtml(h.home_town)}</span>` : ''}
           </div>`
        : '';

    return `
    <div class="bh-help-card cat-${cat}">
        <div class="bh-help-card-top">
            <div style="min-width:0; flex:1;">
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.25rem;">
                    <span class="bh-cat-pill bh-cat-${cat}">
                        <i data-lucide="${meta.icon}" style="width:12px;height:12px;"></i>
                        <span>${meta.short}</span>
                    </span>
                    <span class="bh-status-pill bh-status-${status}">${BEN_HELP_STATUS_LABELS[status]}</span>
                    ${prioHtml}
                    ${Number(h.sync_transaction) === 1 ? `<span title="Synced to Treasury Expenses" style="font-size:0.65rem; font-weight:700; padding:0.08rem 0.38rem; border-radius:6px; background:rgba(16,185,129,0.1); color:#059669;">Treasury Linked</span>` : ''}
                </div>
                <div style="font-weight:800; font-size:0.9rem; color:var(--text-main); line-height:1.3;">${escapeBhHtml(h.title)}</div>
                ${benHeaderHtml}
            </div>
            <div style="text-align:right; flex-shrink:0;">
                <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); font-variant-numeric:tabular-nums;">${amountVal > 0 ? formatBhLkr(amountVal) : 'In-Kind / Goods'}</div>
                <div style="font-size:0.69rem; color:var(--text-muted); margin-top:0.1rem;">${formatBhDateOnly(h.help_date || h.created_at)}${h.completion_date ? ' -> ' + formatBhDateOnly(h.completion_date) : ''}</div>
            </div>
        </div>

        ${metaBits.length ? `<div class="bh-help-meta-grid">${metaBits.join('')}</div>` : ''}
        ${h.description ? `<div style="font-size:0.77rem; color:var(--text-muted); line-height:1.42;">${escapeBhHtml(h.description)}</div>` : ''}

        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; font-weight:700; color:var(--text-muted); margin-bottom:0.24rem;">
                <span>Completion Progress</span>
                <span style="color:${isCancelled ? '#ef4444' : '#10b981'}; font-variant-numeric:tabular-nums;">${progress}%</span>
            </div>
            <div class="bh-progress-track">
                <div class="bh-progress-fill ${isCancelled ? 'is-cancelled' : (isActive ? 'is-active' : '')}" style="width:${progress}%;"></div>
            </div>
        </div>

        <div class="bh-help-card-actions">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">
                <i data-lucide="history" style="width:12px;height:12px;vertical-align:middle;"></i> ${Number(h.logs_count || 0)} log entries
            </span>
            <div style="display:flex; align-items:center; gap:0.32rem; flex-wrap:wrap;">
                ${!showBeneficiaryLink ? `<button type="button" class="btn btn-outline" style="padding:0.26rem 0.55rem; font-size:0.71rem;" onclick="focusVbenQuickLog(${Number(h.id)})" title="Write a progress/visit log on this item"><i data-lucide="message-square-plus" style="width:12px;height:12px;"></i> Log</button>` : `<button type="button" class="btn btn-outline" style="padding:0.26rem 0.55rem; font-size:0.71rem;" onclick="openBenHelpsTab(${Number(h.beneficiary_id)})"><i data-lucide="folder-open" style="width:12px;height:12px;"></i> Dossier</button>`}
                ${status !== 'completed' && !isCancelled ? `<button type="button" class="btn" style="padding:0.26rem 0.55rem; font-size:0.71rem; background:rgba(16,185,129,0.13); color:#059669; border:1px solid rgba(16,185,129,0.28); font-weight:700;" onclick="quickCompleteBenHelp(${Number(h.id)})" title="Mark 100% Completed"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> Complete</button>` : ''}
                <button type="button" class="btn" style="padding:0.26rem 0.5rem; font-size:0.71rem; background:var(--glow-bg);" onclick="openBeneficiaryHelpModal(${Number(h.id)}, ${Number(h.beneficiary_id)})" title="Edit Help Record"><i data-lucide="edit-2" style="width:12px;height:12px;"></i></button>
                <button type="button" class="btn" style="padding:0.26rem 0.5rem; font-size:0.71rem; background:rgba(239,68,68,0.12); color:#ef4444;" onclick="deleteBeneficiaryHelp(${Number(h.id)}, ${Number(h.beneficiary_id)})" title="Delete Help Record"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
            </div>
        </div>
    </div>`;
}

function _renderHelpLogItemHtml(lg, showBenName = false) {
    const act = lg.action_type || 'note';
    const actLabel = BEN_HELP_LOG_ACTION_LABELS[act] || act;
    const snapBits = [];
    if (lg.status_snapshot) snapBits.push(`<span class="bh-status-pill bh-status-${escapeBhHtml(lg.status_snapshot)}" style="font-size:0.64rem; padding:0.08rem 0.42rem;">${escapeBhHtml(BEN_HELP_STATUS_LABELS[lg.status_snapshot] || lg.status_snapshot)}</span>`);
    if (lg.progress_snapshot != null && lg.progress_snapshot !== '') snapBits.push(`<span style="font-size:0.66rem; font-weight:700; color:#10b981;">${Number(lg.progress_snapshot)}%</span>`);

    return `
    <div class="bh-timeline-item">
        <span class="bh-timeline-dot act-${escapeBhHtml(act)}"></span>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.22rem;">
            <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                <span style="font-size:0.72rem; font-weight:800; color:var(--text-main);">${escapeBhHtml(actLabel)}</span>
                ${snapBits.join('')}
            </div>
            <span style="font-size:0.67rem; color:var(--text-muted);">${formatBhDateTime(lg.created_at)}</span>
        </div>
        ${lg.help_title ? `<div style="font-size:0.73rem; font-weight:700; color:#059669; margin-bottom:0.18rem;">${escapeBhHtml(lg.help_title)}${showBenName && lg.beneficiary_name ? ` — <span style="color:var(--text-main); cursor:pointer;" onclick="openBenHelpsTab(${Number(lg.beneficiary_id)})">${escapeBhHtml(lg.beneficiary_name)}</span>` : ''}</div>` : ''}
        <div style="font-size:0.77rem; color:var(--text-main); line-height:1.4;">${escapeBhHtml(lg.note)}</div>
        <div style="font-size:0.67rem; color:var(--text-muted); margin-top:0.22rem;">Logged by: <strong>${escapeBhHtml(lg.logged_by || 'Admin')}</strong></div>
    </div>`;
}

// ── Global Directory Helps Hub (#benHelpsHubPanel) ──────────────────────────
function toggleBenHelpsHub(forceState) {
    const panel = document.getElementById('benHelpsHubPanel');
    const btn = document.getElementById('benHelpsHubToggleBtn');
    if (!panel) return;
    const shouldShow = typeof forceState === 'boolean' ? forceState : (panel.style.display === 'none' || !panel.style.display);
    panel.style.display = shouldShow ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', shouldShow);
    if (shouldShow) {
        fetchBenHelpsHub(false);
        if (typeof initEdfLottieIcons === 'function') initEdfLottieIcons();
        if (window.lucide) lucide.createIcons();
    }
}

async function fetchBenHelpsHub(showToastOnDone = false) {
    try {
        const res = await fetch('/api/edf/beneficiary-helps');
        if (!res.ok) throw new Error('Failed to load beneficiary helps');
        const data = await res.json();
        _benHelpsHubState.helps = Array.isArray(data.helps) ? data.helps : [];
        _benHelpsHubState.logs = Array.isArray(data.logs) ? data.logs : [];
        _benHelpsHubState.summary = data.summary || null;
        _benHelpsHubState.loaded = true;
        renderBenHelpsHub();
        if (showToastOnDone) showToast('Beneficiary Helps & Logs refreshed', 'success');
    } catch (err) {
        console.error('fetchBenHelpsHub error:', err);
        if (showToastOnDone) showToast('Failed to load helps tracker', 'error');
    }
}

function setBenHelpsHubCategory(cat) {
    _benHelpsHubState.categoryFilter = cat || 'all';
    const sel = document.getElementById('bhubCatSelect');
    if (sel) sel.value = _benHelpsHubState.categoryFilter;
    document.querySelectorAll('#bhubKpiGrid .bhub-kpi-card').forEach(card => {
        card.classList.toggle('active', card.dataset.bhubCat === _benHelpsHubState.categoryFilter);
    });
    renderBenHelpsHub();
}

function renderBenHelpsHub() {
    const helps = _benHelpsHubState.helps || [];
    const logs = _benHelpsHubState.logs || [];
    const sum = _benHelpsHubState.summary || { total_value: 0, non_cancelled_count: 0, active_count: 0, families_helped: 0, by_category: {} };
    const byCat = sum.by_category || {};
    const money = byCat.money || { count: 0, value: 0 };
    const equip = byCat.equipment || { count: 0, value: 0 };
    const home = byCat.home_reconstruction || { count: 0, value: 0 };
    const repair = byCat.building_repair || { count: 0, value: 0 };
    const other = byCat.other || { count: 0, value: 0 };

    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setEl('benHeroHelpsBadge', sum.total_count != null ? sum.total_count : helps.length);
    setEl('bhubActiveBadge', `${sum.active_count || 0} Active`);
    setEl('bhubKpiAllVal', formatBhLkr(sum.total_value || 0));
    setEl('bhubKpiAllSub', `${sum.non_cancelled_count || 0} cases · ${sum.families_helped || 0} families`);
    setEl('bhubKpiMoneyVal', formatBhLkr(money.value || 0));
    setEl('bhubKpiMoneySub', `${money.count || 0} cash disbursements`);
    setEl('bhubKpiEquipVal', formatBhLkr(equip.value || 0));
    setEl('bhubKpiEquipSub', `${equip.count || 0} tool & equipment kits`);
    setEl('bhubKpiHomeVal', formatBhLkr(home.value || 0));
    setEl('bhubKpiHomeSub', `${home.count || 0} house builds`);
    setEl('bhubKpiRepairVal', formatBhLkr((repair.value || 0) + (other.value || 0)));
    setEl('bhubKpiRepairSub', `${(repair.count || 0) + (other.count || 0)} repairs & other aids`);

    const searchQ = (document.getElementById('bhubSearchInput')?.value || '').trim().toLowerCase();
    const catFilter = _benHelpsHubState.categoryFilter || document.getElementById('bhubCatSelect')?.value || 'all';
    const statFilter = document.getElementById('bhubStatusSelect')?.value || 'all';

    const filtered = helps.filter(h => {
        if (catFilter !== 'all' && h.help_category !== catFilter) return false;
        if (statFilter !== 'all' && h.status !== statFilter) return false;
        if (searchQ) {
            const hay = `${h.title} ${h.beneficiary_name || ''} ${h.application_number || ''} ${h.home_town || ''} ${h.item_or_scope || ''} ${h.contractor_or_supplier || ''} ${h.reference_no || ''}`.toLowerCase();
            if (!hay.includes(searchQ)) return false;
        }
        return true;
    });

    const listEl = document.getElementById('bhubHelpsList');
    if (listEl) {
        listEl.innerHTML = filtered.length
            ? filtered.map(h => _renderHelpCardHtml(h, { showBeneficiaryLink: true })).join('')
            : `<div style="text-align:center; padding:2.2rem 1rem; color:var(--text-muted);">
                    <i data-lucide="hand-helping" style="width:28px;height:28px;opacity:0.45;margin-bottom:0.4rem;"></i>
                    <div style="font-weight:700; color:var(--text-main); font-size:0.86rem;">No Matching Help Records Yet</div>
                    <div style="font-size:0.75rem; margin-top:0.2rem;">Record money grants, equipment kits, home reconstructions, or building repairs via "Record Help / Project".</div>
               </div>`;
    }

    const feedEl = document.getElementById('bhubLogsFeed');
    setEl('bhubLogsCountBadge', `${logs.length} ${logs.length === 1 ? 'log' : 'logs'}`);
    if (feedEl) {
        feedEl.innerHTML = logs.length
            ? `<div class="bh-timeline-list">${logs.map(lg => _renderHelpLogItemHtml(lg, true)).join('')}</div>`
            : `<div style="text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:0.78rem;">No activity logs recorded yet.</div>`;
    }

    if (window.lucide) lucide.createIcons();
}

// ── Individual Beneficiary Modal 6th Tab (#vben-helps) ──────────────────────
function setVbenHelpsFilter(cat, btn) {
    _vbenHelpsCatFilter = cat || 'all';
    const wrap = document.getElementById('vbenHelpsCatPills');
    if (wrap) {
        wrap.querySelectorAll('.filter-pill').forEach(p => p.classList.toggle('active', p.dataset.vbhCat === _vbenHelpsCatFilter));
    }
    if (_activeViewBenRecord) renderVbenHelpsTab(_activeViewBenRecord);
}

function renderVbenHelpsTab(b) {
    if (!b) return;
    _activeViewBenId = Number(b.id);
    _activeViewBenRecord = b;

    const helps = Array.isArray(b.helps) ? b.helps : [];
    const logs = Array.isArray(b.help_logs) ? b.help_logs : [];

    const tabBadge = document.getElementById('vbenHelpsTabBadge');
    if (tabBadge) tabBadge.textContent = String(helps.length);

    // Individual Category KPI Summary
    const nonCancelled = helps.filter(h => h.status !== 'cancelled');
    const sumBy = (cats) => nonCancelled.filter(h => cats.includes(h.help_category)).reduce((s, h) => s + (Number(h.amount || 0) || 0), 0);
    const cntBy = (cats) => nonCancelled.filter(h => cats.includes(h.help_category)).length;
    const activeCnt = helps.filter(h => h.status === 'planned' || h.status === 'in_progress').length;
    const completedCnt = helps.filter(h => h.status === 'completed').length;

    const kpisEl = document.getElementById('vbenHelpsKpis');
    if (kpisEl) {
        kpisEl.innerHTML = `
            <div class="vben-helps-kpi">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Cash / Money Aid</div>
                <div style="font-size:1.05rem; font-weight:800; color:#10b981; margin-top:0.15rem;">${formatBhLkr(sumBy(['money']))}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${cntBy(['money'])} cash grants</div>
            </div>
            <div class="vben-helps-kpi">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Equipment &amp; Tools</div>
                <div style="font-size:1.05rem; font-weight:800; color:#3b82f6; margin-top:0.15rem;">${formatBhLkr(sumBy(['equipment', 'other']))}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${cntBy(['equipment', 'other'])} items provided</div>
            </div>
            <div class="vben-helps-kpi">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Housing &amp; Repairs</div>
                <div style="font-size:1.05rem; font-weight:800; color:#f59e0b; margin-top:0.15rem;">${formatBhLkr(sumBy(['home_reconstruction', 'building_repair']))}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${cntBy(['home_reconstruction', 'building_repair'])} works tracked</div>
            </div>
            <div class="vben-helps-kpi">
                <div style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Work Status</div>
                <div style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin-top:0.15rem;">${activeCnt} Active · ${completedCnt} Done</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${logs.length} audit logs recorded</div>
            </div>`;
    }

    // Populate Quick Log Help Selector
    const logHelpSel = document.getElementById('vbenQuickLogHelpId');
    if (logHelpSel) {
        logHelpSel.innerHTML = helps.length
            ? helps.map(h => `<option value="${h.id}">${escapeBhHtml(h.title)} (${BEN_HELP_STATUS_LABELS[h.status] || h.status})</option>`).join('')
            : `<option value="">No helps yet — add a help first</option>`;
    }

    const filteredHelps = _vbenHelpsCatFilter === 'all'
        ? helps
        : helps.filter(h => h.help_category === _vbenHelpsCatFilter);

    const listEl = document.getElementById('vbenHelpsList');
    if (listEl) {
        listEl.innerHTML = filteredHelps.length
            ? filteredHelps.map(h => _renderHelpCardHtml(h, { showBeneficiaryLink: false })).join('')
            : `<div style="text-align:center; padding:1.85rem 1rem; border:1px dashed var(--border-color); border-radius:14px; color:var(--text-muted);">
                    <i data-lucide="package-open" style="width:26px;height:26px;opacity:0.45;margin-bottom:0.35rem;"></i>
                    <div style="font-weight:700; color:var(--text-main); font-size:0.84rem;">No help records in this view</div>
                    <div style="font-size:0.74rem; margin-top:0.15rem;">Click "Add Help / Aid" to record money aid, equipment, home reconstruction, or repairs for ${escapeBhHtml(b.male_head_name || 'this family')}.</div>
               </div>`;
    }

    const tlEl = document.getElementById('vbenHelpLogsTimeline');
    if (tlEl) {
        tlEl.innerHTML = logs.length
            ? `<div class="bh-timeline-list">${logs.map(lg => _renderHelpLogItemHtml(lg, false)).join('')}</div>`
            : `<div style="text-align:center; padding:1.4rem 0.9rem; border:1px dashed var(--border-color); border-radius:12px; color:var(--text-muted); font-size:0.76rem;">Log entries appear automatically when helps are created or updated, or post a field note above.</div>`;
    }

    if (window.lucide) lucide.createIcons();
}

function focusVbenQuickLog(helpId) {
    const sel = document.getElementById('vbenQuickLogHelpId');
    if (sel && helpId) sel.value = String(helpId);
    const inp = document.getElementById('vbenQuickLogNote');
    if (inp) {
        inp.focus();
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

async function submitVbenQuickLog() {
    const helpId = document.getElementById('vbenQuickLogHelpId')?.value;
    const action_type = document.getElementById('vbenQuickLogAction')?.value || 'note';
    const status_update = document.getElementById('vbenQuickLogStatus')?.value || '';
    const progress_update = document.getElementById('vbenQuickLogProgress')?.value;
    const note = (document.getElementById('vbenQuickLogNote')?.value || '').trim();

    if (!helpId) {
        showToast('Please add a help record before posting a log entry', 'warning');
        return;
    }
    if (!note) {
        showToast('Please enter a log note or observation', 'warning');
        document.getElementById('vbenQuickLogNote')?.focus();
        return;
    }

    try {
        const res = await fetch(`/api/edf/beneficiary-helps/${helpId}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type,
                note,
                status_update: status_update || undefined,
                progress_update: progress_update !== '' && progress_update != null ? Number(progress_update) : undefined
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to record log');

        document.getElementById('vbenQuickLogNote').value = '';
        document.getElementById('vbenQuickLogStatus').value = '';
        document.getElementById('vbenQuickLogProgress').value = '';
        showToast('Field & support log recorded', 'success');

        await _refreshAfterBenHelpChange(_activeViewBenId);
    } catch (err) {
        console.error('submitVbenQuickLog error:', err);
        showToast(err.message || 'Failed to post log', 'error');
    }
}

// ── Add / Edit Help Modal (#beneficiaryHelpModal) ───────────────────────────
function updateBenHelpLiveStrip() {
    const cleanCat = document.getElementById('bhCategoryInput')?.value || 'money';
    const meta = _getBenHelpMeta(cleanCat);
    const amt = Number(document.getElementById('bhAmountInput')?.value || 0) || 0;
    const status = document.getElementById('bhStatusSelect')?.value || 'planned';
    const priority = document.getElementById('bhPrioritySelect')?.value || 'normal';
    const prog = Math.max(0, Math.min(100, Number(document.getElementById('bhProgressSlider')?.value || 0)));
    const syncTx = !!document.getElementById('bhSyncTxCheckbox')?.checked;

    const catPill = document.getElementById('bhLiveCatPill');
    if (catPill) catPill.textContent = meta.label;

    const secTag = document.getElementById('bhSmartSectionCatTag');
    if (secTag) secTag.textContent = meta.label;

    const statusPill = document.getElementById('bhLiveStatusPill');
    if (statusPill) {
        const stLabel = BEN_HELP_STATUS_LABELS[status] || status;
        const priSuffix = priority !== 'normal' ? ` · ${priority === 'urgent' ? 'Urgent' : 'High'}` : '';
        statusPill.setAttribute('data-status', status);
        statusPill.textContent = `${stLabel} · ${prog}%${priSuffix}`;
    }

    const costEl = document.getElementById('bhLiveCostDisplay');
    if (costEl) costEl.textContent = formatBhLkr(amt);

    const syncTag = document.getElementById('bhLiveSyncTag');
    if (syncTag) syncTag.style.display = (syncTx && amt > 0) ? 'inline-flex' : 'none';

    document.querySelectorAll('#beneficiaryHelpModal .bh-preset-chip[data-bh-amt]').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.bhAmt) === amt);
    });
    document.querySelectorAll('#beneficiaryHelpModal .bh-preset-chip[data-bh-prog]').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.bhProg) === prog);
    });
}

function setBenHelpAmountPreset(amount) {
    const inp = document.getElementById('bhAmountInput');
    if (inp) inp.value = String(Number(amount) || 0);
    updateBenHelpLiveStrip();
}

function setBenHelpProgressPreset(pct) {
    const val = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const slider = document.getElementById('bhProgressSlider');
    const badge = document.getElementById('bhProgressValBadge');
    if (slider) slider.value = String(val);
    if (badge) badge.textContent = `${val}%`;
    updateBenHelpLiveStrip();
}

function setBenHelpDateToday(inputId) {
    const el = document.getElementById(inputId);
    if (el) el.value = new Date().toISOString().slice(0, 10);
}

function selectBenHelpCategory(cat) {
    const cleanCat = BEN_HELP_CAT_META[cat] ? cat : 'other';
    const inp = document.getElementById('bhCategoryInput');
    if (inp) inp.value = cleanCat;

    document.querySelectorAll('#bhCatTilesGrid .bh-cat-tile').forEach(tile => {
        tile.classList.toggle('active', tile.dataset.bhCat === cleanCat);
    });

    const meta = _getBenHelpMeta(cleanCat);
    const setLbl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const setPh = (id, ph) => { const el = document.getElementById(id); if (el) el.placeholder = ph; };

    setLbl('bhTitleLabel', meta.titleLabel);
    setPh('bhTitleInput', meta.titlePh);
    setLbl('bhAmountLabel', meta.amountLabel);
    setLbl('bhScopeLabel', meta.scopeLabel);
    setPh('bhItemScopeInput', meta.scopePh);
    setLbl('bhContractorLabel', meta.contractorLabel);

    const slot = document.getElementById('bhModalLottieSlot');
    if (slot) {
        slot.setAttribute('data-lottie-icon', meta.lottie);
        delete slot.dataset.lottieBound;
        slot.innerHTML = '';
        if (typeof initEdfLottieIcons === 'function') initEdfLottieIcons();
    }
    if (typeof refreshEdfLottieState === 'function') refreshEdfLottieState();
    updateBenHelpLiveStrip();
}

function onBenHelpStatusChange() {
    const status = document.getElementById('bhStatusSelect')?.value;
    const slider = document.getElementById('bhProgressSlider');
    const compDate = document.getElementById('bhCompletionDateInput');
    if (status === 'completed') {
        if (slider && Number(slider.value) < 100) {
            setBenHelpProgressPreset(100);
        }
        if (compDate && !compDate.value) {
            compDate.value = new Date().toISOString().slice(0, 10);
        }
    }
    updateBenHelpLiveStrip();
}

async function openBeneficiaryHelpModal(helpId = null, presetBenId = null) {
    if (Array.isArray(currentBeneficiaries) && currentBeneficiaries.length === 0 && typeof fetchBeneficiaries === 'function') {
        await fetchBeneficiaries();
    }

    const sel = document.getElementById('bhBeneficiarySelect');
    const lockedCard = document.getElementById('bhLockedBenCard');
    const lockedAvatar = document.getElementById('bhLockedBenAvatar');
    const lockedLbl = document.getElementById('bhLockedBenLabel');
    const lockedApp = document.getElementById('bhLockedBenApp');
    const titleEl = document.getElementById('bhModalTitle');
    const submitBtn = document.getElementById('bhSaveSubmitBtn');

    if (sel) {
        const list = Array.isArray(currentBeneficiaries) ? currentBeneficiaries : [];
        sel.innerHTML = `<option value="">-- Select Beneficiary Family --</option>` + list.map(b =>
            `<option value="${b.id}">${escapeBhHtml(b.male_head_name || 'Beneficiary')} (${escapeBhHtml(b.application_number || 'No App #')}${b.home_town ? ' · ' + escapeBhHtml(b.home_town) : ''})</option>`
        ).join('');
    }

    // Locate existing record from active dossier or hub state if editing
    let existing = null;
    if (helpId) {
        existing = (_activeViewBenRecord?.helps || []).find(x => Number(x.id) === Number(helpId))
            || (_benHelpsHubState.helps || []).find(x => Number(x.id) === Number(helpId));
        if (!existing && presetBenId) {
            try {
                const res = await fetch(`/api/edf/beneficiaries/${presetBenId}/helps`);
                if (res.ok) {
                    const d = await res.json();
                    existing = (d.helps || []).find(x => Number(x.id) === Number(helpId));
                }
            } catch (_) {}
        }
    }

    const targetBenId = existing ? Number(existing.beneficiary_id) : (presetBenId ? Number(presetBenId) : null);
    if (sel) sel.value = targetBenId ? String(targetBenId) : '';

    if (targetBenId && (presetBenId || existing)) {
        const matchedBen = (currentBeneficiaries || []).find(x => Number(x.id) === targetBenId) || _activeViewBenRecord;
        const benName = matchedBen?.male_head_name || existing?.beneficiary_name || `Beneficiary #${targetBenId}`;
        if (lockedCard && sel) {
            lockedCard.style.display = 'flex';
            if (lockedAvatar) {
                const parts = String(benName).trim().split(/\s+/).filter(Boolean);
                lockedAvatar.textContent = ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || 'BH';
            }
            if (lockedLbl) lockedLbl.textContent = `${benName}${matchedBen?.home_town ? ' — ' + matchedBen.home_town : ''}`;
            if (lockedApp) lockedApp.textContent = matchedBen?.application_number || existing?.application_number || `ID #${targetBenId}`;
            sel.style.display = 'none';
        }
    } else if (lockedCard && sel) {
        lockedCard.style.display = 'none';
        sel.style.display = 'block';
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    document.getElementById('bhHelpId').value = existing ? String(existing.id) : '';
    document.getElementById('bhTitleInput').value = existing?.title || '';
    document.getElementById('bhAmountInput').value = existing ? Number(existing.amount || 0) : 0;
    document.getElementById('bhItemScopeInput').value = existing?.item_or_scope || '';
    document.getElementById('bhQuantityInput').value = existing?.quantity || '';
    document.getElementById('bhPaymentMethodSelect').value = existing?.payment_method || 'cash';
    document.getElementById('bhContractorInput').value = existing?.contractor_or_supplier || '';
    document.getElementById('bhRefNoInput').value = existing?.reference_no || '';
    document.getElementById('bhProvidedByInput').value = existing?.provided_by || '';
    document.getElementById('bhStatusSelect').value = existing?.status || 'planned';
    document.getElementById('bhPrioritySelect').value = existing?.priority || 'normal';
    document.getElementById('bhHelpDateInput').value = (existing?.help_date || todayIso).slice(0, 10);
    document.getElementById('bhCompletionDateInput').value = existing?.completion_date ? String(existing.completion_date).slice(0, 10) : '';
    const prog = existing ? Math.max(0, Math.min(100, Number(existing.progress_pct || 0))) : 0;
    setBenHelpProgressPreset(prog);
    document.getElementById('bhDescInput').value = existing?.description || '';
    document.getElementById('bhLogNoteInput').value = '';
    document.getElementById('bhSyncTxCheckbox').checked = existing ? Number(existing.sync_transaction) === 1 : false;

    selectBenHelpCategory(existing?.help_category || 'money');

    if (titleEl) titleEl.textContent = existing ? `Edit Help: ${existing.title}` : 'Record Beneficiary Help / Project';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = existing ? '<i data-lucide="save"></i> Update Help &amp; Log' : '<i data-lucide="save"></i> Save Help Record';
    }

    openModal('beneficiaryHelpModal');
    const modalBody = document.querySelector('#beneficiaryHelpModal .bh-modal-body');
    if (modalBody) modalBody.scrollTop = 0;
    if (typeof initEdfLottieIcons === 'function') initEdfLottieIcons();
    if (typeof refreshEdfLottieState === 'function') refreshEdfLottieState();
    if (window.lucide) lucide.createIcons();
}

async function saveBeneficiaryHelp(event) {
    if (event) event.preventDefault();
    const helpId = document.getElementById('bhHelpId')?.value;
    const beneficiary_id = Number(document.getElementById('bhBeneficiarySelect')?.value || 0);
    const title = (document.getElementById('bhTitleInput')?.value || '').trim();

    if (!beneficiary_id) {
        showToast('Please select a beneficiary household', 'warning');
        return;
    }
    if (!title) {
        showToast('Help title is required', 'warning');
        return;
    }

    const payload = {
        beneficiary_id,
        help_category: document.getElementById('bhCategoryInput')?.value || 'money',
        title,
        amount: Number(document.getElementById('bhAmountInput')?.value || 0) || 0,
        item_or_scope: (document.getElementById('bhItemScopeInput')?.value || '').trim(),
        quantity: (document.getElementById('bhQuantityInput')?.value || '').trim(),
        payment_method: document.getElementById('bhPaymentMethodSelect')?.value || 'cash',
        contractor_or_supplier: (document.getElementById('bhContractorInput')?.value || '').trim(),
        reference_no: (document.getElementById('bhRefNoInput')?.value || '').trim(),
        provided_by: (document.getElementById('bhProvidedByInput')?.value || '').trim(),
        status: document.getElementById('bhStatusSelect')?.value || 'planned',
        priority: document.getElementById('bhPrioritySelect')?.value || 'normal',
        help_date: document.getElementById('bhHelpDateInput')?.value || '',
        completion_date: document.getElementById('bhCompletionDateInput')?.value || '',
        progress_pct: Number(document.getElementById('bhProgressSlider')?.value || 0),
        description: (document.getElementById('bhDescInput')?.value || '').trim(),
        log_note: (document.getElementById('bhLogNoteInput')?.value || '').trim(),
        sync_transaction: document.getElementById('bhSyncTxCheckbox')?.checked ? 1 : 0
    };

    const submitBtn = document.getElementById('bhSaveSubmitBtn');
    const prevHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Saving Record...';
        if (window.lucide) lucide.createIcons();
    }

    try {
        const url = helpId ? `/api/edf/beneficiary-helps/${helpId}` : '/api/edf/beneficiary-helps';
        const method = helpId ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to save help record');

        closeModal('beneficiaryHelpModal');
        showToast(helpId ? 'Help record updated & logged' : 'Help record created & logged', 'success');

        await _refreshAfterBenHelpChange(beneficiary_id);
        if (payload.sync_transaction && typeof fetchDonations === 'function') {
            fetchDonations();
        }
    } catch (err) {
        console.error('saveBeneficiaryHelp error:', err);
        showToast(err.message || 'Failed to save beneficiary help', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = prevHtml || (helpId ? '<i data-lucide="save"></i> Update Help &amp; Log' : '<i data-lucide="save"></i> Save Help Record');
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function quickCompleteBenHelp(helpId) {
    try {
        const res = await fetch(`/api/edf/beneficiary-helps/${helpId}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: 'milestone',
                note: 'Marked completed (100%)',
                status_update: 'completed',
                progress_update: 100
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to complete help record');
        showToast('Help marked 100% completed & logged', 'success');
        await _refreshAfterBenHelpChange(data.help?.beneficiary_id || _activeViewBenId);
    } catch (err) {
        console.error('quickCompleteBenHelp error:', err);
        showToast(err.message || 'Failed to update status', 'error');
    }
}

async function deleteBeneficiaryHelp(helpId, benId) {
    if (!confirm('Delete this help record and its log history permanently?')) return;
    try {
        const res = await fetch(`/api/edf/beneficiary-helps/${helpId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to delete help record');
        showToast('Help record removed', 'success');
        await _refreshAfterBenHelpChange(benId || _activeViewBenId);
    } catch (err) {
        console.error('deleteBeneficiaryHelp error:', err);
        showToast(err.message || 'Failed to delete record', 'error');
    }
}

async function _refreshAfterBenHelpChange(benId) {
    if (typeof fetchBeneficiaries === 'function') await fetchBeneficiaries();
    const vm = document.getElementById('viewBeneficiaryModal');
    if (vm && (vm.style.display === 'flex' || vm.classList.contains('active')) && benId && Number(_activeViewBenId) === Number(benId)) {
        try {
            const res = await fetch(`/api/edf/beneficiaries/${benId}`);
            if (res.ok) {
                const updatedBen = await res.json();
                renderVbenHelpsTab(updatedBen);
            }
        } catch (_) {}
    }
    const bhm = document.getElementById('beneficiaryHistoryModal');
    if (bhm && (bhm.style.display === 'flex' || bhm.classList.contains('active')) && benId && Number(_bhmState.benId) === Number(benId)) {
        await openBeneficiaryHistoryModal(benId, true);
    }
}

function exportBeneficiaryHelpsCSV() {
    const helps = _benHelpsHubState.helps || [];
    if (!helps.length) {
        showToast('No help records loaded to export', 'warning');
        return;
    }
    const headers = ['ID', 'App #', 'Beneficiary Name', 'Town', 'Category', 'Title', 'Status', 'Priority', 'Progress %', 'Cost (LKR)', 'Quantity', 'Specs / Work Scope', 'Contractor / Supplier', 'Payment Method', 'Ref No', 'Start Date', 'Completion Date', 'Provided By'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = helps.map(h => [
        h.id, h.application_number, h.beneficiary_name, h.home_town,
        _getBenHelpMeta(h.help_category).label, h.title,
        BEN_HELP_STATUS_LABELS[h.status] || h.status, h.priority, h.progress_pct,
        Number(h.amount || 0), h.quantity, h.item_or_scope, h.contractor_or_supplier,
        h.payment_method, h.reference_no, h.help_date, h.completion_date, h.provided_by
    ].map(esc).join(','));

    const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EDF-Beneficiary-Helps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function printBeneficiaryHelpsReport(benId) {
    if (!benId) return;
    try {
        const res = await fetch(`/api/edf/beneficiaries/${benId}/helps`);
        if (!res.ok) throw new Error('Failed to load dossier data');
        const { beneficiary: b, helps, logs, summary } = await res.json();

        const win = window.open('', '_blank', 'width=920,height=780');
        if (!win) { showToast('Please allow pop-ups to print report', 'warning'); return; }

        const helpsRows = (helps || []).map((h, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${escapeBhHtml(_getBenHelpMeta(h.help_category).label)}</td>
                <td><strong>${escapeBhHtml(h.title)}</strong><br><small style="color:#475569;">${escapeBhHtml(h.item_or_scope || '')}</small></td>
                <td>${escapeBhHtml(h.contractor_or_supplier || h.payment_method || '—')}${h.quantity ? ' · ' + escapeBhHtml(h.quantity) : ''}</td>
                <td>${escapeBhHtml(BEN_HELP_STATUS_LABELS[h.status] || h.status)} (${Number(h.progress_pct || 0)}%)</td>
                <td style="text-align:right;font-weight:700;">${Number(h.amount || 0) > 0 ? formatBhLkr(h.amount) : 'In-Kind'}</td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#64748b;">No helps recorded yet.</td></tr>';

        const logRows = (logs || []).map(l => `
            <tr>
                <td style="white-space:nowrap;">${formatBhDateTime(l.created_at)}</td>
                <td>${escapeBhHtml(BEN_HELP_LOG_ACTION_LABELS[l.action_type] || l.action_type)}</td>
                <td>${escapeBhHtml(l.help_title || '—')}</td>
                <td>${escapeBhHtml(l.note)}</td>
                <td>${escapeBhHtml(l.logged_by || 'Admin')}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No chronological logs yet.</td></tr>';

        win.document.write(`<!DOCTYPE html><html><head><title>Beneficiary Helps Dossier — ${escapeBhHtml(b.male_head_name || '')}</title>
            <style>
                body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;padding:28px;font-size:13px;}
                .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #059669;padding-bottom:14px;margin-bottom:18px;}
                .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
                .kpi{border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#f8fafc;}
                table{width:100%;border-collapse:collapse;margin-bottom:20px;}
                th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left;vertical-align:top;}
                th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#334155;}
                @media print{body{padding:10px;}}
            </style></head><body>
            <div class="hdr">
                <div>
                    <div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;">Educational &amp; Development Foundation (EDF Galgamuwa)</div>
                    <h2 style="margin:4px 0;">Beneficiary Direct Aid, Equipment &amp; Reconstruction Dossier</h2>
                    <div>Household: <strong>${escapeBhHtml(b.male_head_name || 'N/A')}</strong> · App #: <strong>${escapeBhHtml(b.application_number || 'N/A')}</strong> · Town: ${escapeBhHtml(b.home_town || 'N/A')}</div>
                </div>
                <div style="text-align:right;font-size:12px;color:#475569;">Printed: ${new Date().toLocaleDateString('en-GB')}<br>Contact: ${escapeBhHtml(b.contact_number || 'N/A')}</div>
            </div>
            <div class="kpis">
                <div class="kpi"><small>TOTAL SUPPORT VALUE</small><div style="font-size:16px;font-weight:800;">${formatBhLkr(summary.total_value)}</div></div>
                <div class="kpi"><small>CASH AID</small><div style="font-size:16px;font-weight:800;">${formatBhLkr(summary.by_category.money?.value || 0)} (${summary.by_category.money?.count || 0})</div></div>
                <div class="kpi"><small>EQUIPMENT</small><div style="font-size:16px;font-weight:800;">${formatBhLkr(summary.by_category.equipment?.value || 0)} (${summary.by_category.equipment?.count || 0})</div></div>
                <div class="kpi"><small>HOME REBUILD &amp; REPAIRS</small><div style="font-size:16px;font-weight:800;">${formatBhLkr((summary.by_category.home_reconstruction?.value || 0) + (summary.by_category.building_repair?.value || 0))}</div></div>
            </div>
            <h3>1. Assistance, Equipment &amp; Construction Records (${(helps || []).length})</h3>
            <table><thead><tr><th>#</th><th>Category</th><th>Title &amp; Scope</th><th>Vendor / Qty</th><th>Status &amp; Progress</th><th style="text-align:right;">Value</th></tr></thead><tbody>${helpsRows}</tbody></table>
            <h3>2. Chronological Field Visits &amp; Audit Logs (${(logs || []).length})</h3>
            <table><thead><tr><th>Date &amp; Time</th><th>Action</th><th>Help Item</th><th>Log Remarks</th><th>Logged By</th></tr></thead><tbody>${logRows}</tbody></table>
            <script>window.onload = () => setTimeout(() => window.print(), 250);</script>
        </body></html>`);
        win.document.close();
    } catch (err) {
        console.error('printBeneficiaryHelpsReport error:', err);
        showToast('Failed to generate printable dossier', 'error');
    }
}

/* ============================================================================
 * Beneficiary Donations & Helps History Modal (#beneficiaryHistoryModal)
 * ============================================================================ */
const _bhmState = {
    benId: null,
    beneficiary: null,
    records: [],
    summary: null,
    source: 'all',
    search: '',
    category: 'all',
    status: 'all',
    method: 'all',
    year: 'all',
    sortBy: 'date',
    sortDir: 'desc',
    page: 1,
    pageSize: 10
};

function _bhmCapLabel(str) {
    return String(str || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase())
        .trim() || '—';
}

function _bhmFormatDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return escapeBhHtml(String(val));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _bhmStatusBadgeClass(st) {
    const s = String(st || '').toLowerCase();
    if (s === 'completed' || s === 'collected' || s === 'redeemed' || s === 'disbursed' || s === 'approved') {
        return 'bh-status-completed';
    }
    if (s === 'in_progress' || s === 'issued' || s === 'ongoing') {
        return 'bh-status-in_progress';
    }
    if (s === 'cancelled' || s === 'absent' || s === 'rejected') {
        return 'bh-status-cancelled';
    }
    return 'bh-status-planned';
}

function _bhmSourceMatch(rec, source) {
    if (!source || source === 'all') return true;
    if (source === 'help') return rec.source_type === 'help';
    if (source === 'donations') return rec.source_type === 'donation' || rec.source_type === 'family_donation';
    if (source === 'ramadan') return rec.source_type === 'ramadan';
    return rec.source_type === source;
}

async function openBeneficiaryHistoryModal(benId, preserveFilters = false) {
    if (!benId) return;
    _bhmState.benId = Number(benId);

    if (!preserveFilters) {
        _bhmState.source = 'all';
        _bhmState.search = '';
        _bhmState.category = 'all';
        _bhmState.status = 'all';
        _bhmState.method = 'all';
        _bhmState.year = 'all';
        _bhmState.sortBy = 'date';
        _bhmState.sortDir = 'desc';
        _bhmState.page = 1;
        const sizeEl = document.getElementById('bhmPageSize');
        _bhmState.pageSize = sizeEl ? (Number(sizeEl.value) || 10) : 10;

        const searchEl = document.getElementById('bhmSearchInput');
        if (searchEl) searchEl.value = '';
        const sortSel = document.getElementById('bhmSortSelect');
        if (sortSel) sortSel.value = 'date:desc';
        document.querySelectorAll('#bhmSourceTabs .bhm-src-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.bhmSrc === 'all');
        });
    }

    const loadingEl = document.getElementById('bhmLoading');
    const emptyEl = document.getElementById('bhmEmpty');
    const tableEl = document.getElementById('bhmTable');
    if (loadingEl) loadingEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableEl) tableEl.style.display = 'none';

    openModal('beneficiaryHistoryModal');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const res = await fetch(`/api/edf/beneficiaries/${benId}/history`);
        if (!res.ok) throw new Error('Failed to fetch beneficiary history');
        const data = await res.json();
        _bhmState.beneficiary = data.beneficiary || null;
        _bhmState.records = Array.isArray(data.records) ? data.records : [];
        _bhmState.summary = data.summary || {};

        _bhmRenderHeroAndStats();
        _bhmPopulateFilters();
        bhmRender();
    } catch (err) {
        console.error('openBeneficiaryHistoryModal error:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            const et = document.getElementById('bhmEmptyTitle');
            const es = document.getElementById('bhmEmptySub');
            if (et) et.textContent = 'Unable to load history ledger';
            if (es) es.textContent = err.message || 'Please check connection and try again.';
        }
        showToast(err.message || 'Failed to load beneficiary history', 'error');
    }
}

function _bhmRenderHeroAndStats() {
    const b = _bhmState.beneficiary || {};
    const s = _bhmState.summary || {};

    const name = b.male_head_name || b.female_head_name || `Beneficiary #${_bhmState.benId}`;
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || 'BN';

    const avEl = document.getElementById('bhmAvatar');
    if (avEl) {
        avEl.innerHTML = b.photo_url
            ? `<img src="${escapeBhHtml(b.photo_url)}" alt="${escapeBhHtml(name)}">`
            : escapeBhHtml(initials);
    }

    const nameEl = document.getElementById('bhmBenName');
    if (nameEl) nameEl.textContent = name;

    const appEl = document.getElementById('bhmAppBadge');
    if (appEl) appEl.textContent = b.application_number || `APP-${b.id || _bhmState.benId}`;

    const catEl = document.getElementById('bhmBenCatBadge');
    if (catEl) catEl.textContent = _bhmCapLabel(b.beneficiary_type || b.category || 'Beneficiary');

    const stText = b.approval_status || b.status || 'approved';
    const stEl = document.getElementById('bhmStatusBadge');
    if (stEl) {
        stEl.className = `bh-status-pill ${_bhmStatusBadgeClass(stText)}`;
        stEl.textContent = _bhmCapLabel(stText);
    }

    const metaParts = [
        b.home_town ? `Town: ${escapeBhHtml(b.home_town)}` : '',
        b.nic_number ? `NIC: ${escapeBhHtml(b.nic_number)}` : '',
        b.contact_number ? `Tel: ${escapeBhHtml(b.contact_number)}` : '',
        b.family_size ? `Household: ${Number(b.family_size)} members` : ''
    ].filter(Boolean);
    const metaEl = document.getElementById('bhmMetaStrip');
    if (metaEl) metaEl.innerHTML = metaParts.join(' &middot; ') || 'Registered EDF Beneficiary Household';

    const addBtn = document.getElementById('bhmAddHelpBtn');
    if (addBtn) addBtn.onclick = () => openBeneficiaryHelpModal(null, _bhmState.benId);

    const dosBtn = document.getElementById('bhmOpenDossierBtn');
    if (dosBtn) dosBtn.onclick = () => printBeneficiaryHelpsReport(_bhmState.benId);

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('bhmStatTotalVal', formatBhLkr(s.active_value || 0));
    setTxt('bhmStatTotalSub', `${Number(s.active_count || 0)} active · ${Number(s.cancelled_count || 0)} cancelled`);
    setTxt('bhmStatCount', String(Number(s.total_records || 0)));
    setTxt('bhmStatCountSub', `Helps ${s.helps_count || 0} · Grants ${s.donations_count || 0} · Ramadan ${s.ramadan_count || 0}`);
    setTxt('bhmStatAvg', formatBhLkr(s.avg_amount || 0));
    setTxt('bhmStatLast', s.last_aid_date ? _bhmFormatDate(s.last_aid_date) : '—');
    setTxt('bhmStatFirst', s.first_aid_date ? `First aid: ${_bhmFormatDate(s.first_aid_date)}` : 'First aid: —');

    const totalRecs = Number(s.total_records || 0);
    const compRecs = Number(s.completed_count || 0);
    const pendRecs = Number(s.pending_count || 0);
    const rate = totalRecs > 0 ? Math.round((compRecs / totalRecs) * 100) : 0;
    setTxt('bhmStatRate', `${rate}%`);
    setTxt('bhmStatRateSub', `${compRecs} completed · ${pendRecs} pending`);

    setTxt('bhmCntAll', String(totalRecs));
    setTxt('bhmCntHelp', String(Number(s.helps_count || 0)));
    setTxt('bhmCntDonations', String(Number(s.donations_count || 0)));
    setTxt('bhmCntRamadan', String(Number(s.ramadan_count || 0)));
}

function _bhmPopulateFilters() {
    const recs = _bhmState.records || [];

    const fillSelect = (elId, defaultLabel, items, currentVal) => {
        const sel = document.getElementById(elId);
        if (!sel) return;
        sel.innerHTML = `<option value="all">${escapeBhHtml(defaultLabel)}</option>` +
            items.map(it => `<option value="${escapeBhHtml(it.value)}">${escapeBhHtml(it.label)}</option>`).join('');
        if (items.some(it => it.value === currentVal)) {
            sel.value = currentVal;
        } else {
            sel.value = 'all';
        }
    };

    const catMap = new Map();
    const statusSet = new Set();
    const methodSet = new Set();
    const yearSet = new Set();

    recs.forEach(r => {
        if (r.category) catMap.set(r.category, r.category_label || _bhmCapLabel(r.category));
        if (r.status) statusSet.add(String(r.status).toLowerCase());
        if (r.payment_method) methodSet.add(String(r.payment_method).toLowerCase());
        const y = String(r.record_date || '').slice(0, 4);
        if (/^\d{4}$/.test(y)) yearSet.add(y);
    });

    const catItems = Array.from(catMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const statusItems = Array.from(statusSet)
        .sort()
        .map(v => ({ value: v, label: BEN_HELP_STATUS_LABELS[v] || _bhmCapLabel(v) }));
    const methodItems = Array.from(methodSet)
        .sort()
        .map(v => ({ value: v, label: _bhmCapLabel(v) }));
    const yearItems = Array.from(yearSet)
        .sort((a, b) => b.localeCompare(a))
        .map(v => ({ value: v, label: v }));

    fillSelect('bhmCategoryFilter', 'All Categories', catItems, _bhmState.category);
    fillSelect('bhmStatusFilter', 'All Statuses', statusItems, _bhmState.status);
    fillSelect('bhmMethodFilter', 'All Methods', methodItems, _bhmState.method);
    fillSelect('bhmYearFilter', 'All Years', yearItems, _bhmState.year);
}

function _bhmGetFilteredSorted() {
    const q = (_bhmState.search || '').trim().toLowerCase();
    const filtered = (_bhmState.records || []).filter(r => {
        if (!_bhmSourceMatch(r, _bhmState.source)) return false;
        if (_bhmState.category !== 'all' && r.category !== _bhmState.category) return false;
        if (_bhmState.status !== 'all' && String(r.status || '').toLowerCase() !== _bhmState.status) return false;
        if (_bhmState.method !== 'all' && String(r.payment_method || '').toLowerCase() !== _bhmState.method) return false;
        if (_bhmState.year !== 'all' && String(r.record_date || '').slice(0, 4) !== _bhmState.year) return false;

        if (q) {
            const haystack = [
                r.title, r.description, r.category_label, r.source_label,
                r.reference_no, r.provider, r.payment_method, r.status, r.quantity, r.record_date
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    const dir = _bhmState.sortDir === 'asc' ? 1 : -1;
    const field = _bhmState.sortBy || 'date';

    filtered.sort((a, b) => {
        if (field === 'amount') {
            const diff = (Number(a.amount || 0) - Number(b.amount || 0)) * dir;
            if (diff !== 0) return diff;
        } else if (field === 'category') {
            const cmp = String(a.category_label || a.category || '').localeCompare(String(b.category_label || b.category || '')) * dir;
            if (cmp !== 0) return cmp;
        } else if (field === 'title') {
            const cmp = String(a.title || '').localeCompare(String(b.title || '')) * dir;
            if (cmp !== 0) return cmp;
        } else if (field === 'status') {
            const cmp = String(a.status || '').localeCompare(String(b.status || '')) * dir;
            if (cmp !== 0) return cmp;
        } else {
            const da = a.record_date || '';
            const dbStr = b.record_date || '';
            if (da !== dbStr) return da.localeCompare(dbStr) * dir;
        }
        const dateFallback = String(b.record_date || '').localeCompare(String(a.record_date || ''));
        if (dateFallback !== 0) return dateFallback;
        return Number(b.record_id || 0) - Number(a.record_id || 0);
    });

    return filtered;
}

function bhmSetSource(src) {
    _bhmState.source = src || 'all';
    _bhmState.page = 1;
    document.querySelectorAll('#bhmSourceTabs .bhm-src-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bhmSrc === _bhmState.source);
    });
    bhmRender();
}

function bhmFilterChanged() {
    _bhmState.search = document.getElementById('bhmSearchInput')?.value || '';
    _bhmState.category = document.getElementById('bhmCategoryFilter')?.value || 'all';
    _bhmState.status = document.getElementById('bhmStatusFilter')?.value || 'all';
    _bhmState.method = document.getElementById('bhmMethodFilter')?.value || 'all';
    _bhmState.year = document.getElementById('bhmYearFilter')?.value || 'all';
    _bhmState.page = 1;
    bhmRender();
}

function _bhmSyncSortControls() {
    const sortSel = document.getElementById('bhmSortSelect');
    const combo = `${_bhmState.sortBy}:${_bhmState.sortDir}`;
    if (sortSel) {
        const hasOpt = Array.from(sortSel.options).some(o => o.value === combo);
        if (hasOpt) sortSel.value = combo;
    }
    document.querySelectorAll('#bhmTable .bhm-th-sort').forEach(btn => {
        const active = btn.dataset.bhmCol === _bhmState.sortBy;
        btn.classList.toggle('is-active', active);
        const ind = btn.querySelector('.bhm-sort-ind');
        if (ind) ind.textContent = active ? (_bhmState.sortDir === 'asc' ? '↑' : '↓') : '';
    });
}

function bhmToggleColSort(field) {
    if (_bhmState.sortBy === field) {
        _bhmState.sortDir = _bhmState.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        _bhmState.sortBy = field;
        _bhmState.sortDir = (field === 'date' || field === 'amount') ? 'desc' : 'asc';
    }
    _bhmState.page = 1;
    bhmRender();
}

function bhmOnSortSelectChange() {
    const val = document.getElementById('bhmSortSelect')?.value || 'date:desc';
    const [field, dir] = val.split(':');
    _bhmState.sortBy = field || 'date';
    _bhmState.sortDir = dir === 'asc' ? 'asc' : 'desc';
    _bhmState.page = 1;
    bhmRender();
}

function bhmPageSizeChanged() {
    _bhmState.pageSize = Math.max(1, Number(document.getElementById('bhmPageSize')?.value) || 10);
    _bhmState.page = 1;
    bhmRender();
}

function bhmGoPage(page) {
    const target = Number(page);
    if (!Number.isFinite(target) || target < 1) return;
    _bhmState.page = target;
    bhmRender();
}

function bhmResetFilters() {
    _bhmState.source = 'all';
    _bhmState.search = '';
    _bhmState.category = 'all';
    _bhmState.status = 'all';
    _bhmState.method = 'all';
    _bhmState.year = 'all';
    _bhmState.sortBy = 'date';
    _bhmState.sortDir = 'desc';
    _bhmState.page = 1;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('bhmSearchInput', '');
    setVal('bhmCategoryFilter', 'all');
    setVal('bhmStatusFilter', 'all');
    setVal('bhmMethodFilter', 'all');
    setVal('bhmYearFilter', 'all');
    setVal('bhmSortSelect', 'date:desc');

    document.querySelectorAll('#bhmSourceTabs .bhm-src-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bhmSrc === 'all');
    });
    bhmRender();
}

function _bhmBuildPaginationButtons(page, totalPages) {
    if (totalPages <= 1) {
        return `<button type="button" class="bhm-pg-btn active" disabled>1</button>`;
    }
    const pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
    }

    return [
        `<button type="button" class="bhm-pg-btn" ${page <= 1 ? 'disabled' : ''} onclick="bhmGoPage(${page - 1})" title="Previous page" aria-label="Previous page">&lsaquo;</button>`,
        ...pages.map(p => p === '...'
            ? `<span style="padding:0 0.25rem; color:var(--text-muted); font-size:0.74rem;">…</span>`
            : `<button type="button" class="bhm-pg-btn ${p === page ? 'active' : ''}" onclick="bhmGoPage(${p})">${p}</button>`
        ),
        `<button type="button" class="bhm-pg-btn" ${page >= totalPages ? 'disabled' : ''} onclick="bhmGoPage(${page + 1})" title="Next page" aria-label="Next page">&rsaquo;</button>`
    ].join('');
}

function bhmRender() {
    _bhmSyncSortControls();

    const loadingEl = document.getElementById('bhmLoading');
    const emptyEl = document.getElementById('bhmEmpty');
    const tableEl = document.getElementById('bhmTable');
    const tbody = document.getElementById('bhmTableBody');
    const infoEl = document.getElementById('bhmPaginationInfo');
    const chipEl = document.getElementById('bhmFilteredTotalChip');
    const btnsEl = document.getElementById('bhmPaginationBtns');

    if (loadingEl) loadingEl.style.display = 'none';

    const items = _bhmGetFilteredSorted();
    const total = items.length;
    const size = Math.max(1, Number(_bhmState.pageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(total / size));
    if (_bhmState.page > totalPages) _bhmState.page = totalPages;
    if (_bhmState.page < 1) _bhmState.page = 1;

    const startIdx = (total === 0) ? 0 : (_bhmState.page - 1) * size;
    const slice = items.slice(startIdx, startIdx + size);

    const includeCancelledInSum = (_bhmState.status === 'cancelled' || _bhmState.status === 'absent');
    const filteredValue = items.reduce((sum, r) => {
        const st = String(r.status || '').toLowerCase();
        if (!includeCancelledInSum && (st === 'cancelled' || st === 'absent')) return sum;
        return sum + (Number(r.amount || 0) || 0);
    }, 0);

    if (infoEl) {
        infoEl.textContent = total === 0
            ? 'Showing 0 of 0 entries'
            : `Showing ${startIdx + 1}–${Math.min(startIdx + size, total)} of ${total} entries (Page ${_bhmState.page}/${totalPages})`;
    }
    if (chipEl) {
        chipEl.textContent = `Filtered: ${formatBhLkr(filteredValue)}`;
    }
    if (btnsEl) {
        btnsEl.innerHTML = _bhmBuildPaginationButtons(_bhmState.page, totalPages);
    }

    if (total === 0) {
        if (tableEl) tableEl.style.display = 'none';
        if (tbody) tbody.innerHTML = '';
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            const et = document.getElementById('bhmEmptyTitle');
            const es = document.getElementById('bhmEmptySub');
            const hasAny = (_bhmState.records || []).length > 0;
            if (et) et.textContent = hasAny ? 'No records match current filters' : 'No aid or donation history yet';
            if (es) es.textContent = hasAny
                ? 'Clear search or adjust Category / Status / Method / Year filters to see records.'
                : 'Use Record Aid above to record cash assistance, equipment, or reconstruction support.';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (tableEl) tableEl.style.display = 'table';

    if (tbody) {
        tbody.innerHTML = slice.map(r => {
            const st = String(r.status || 'planned').toLowerCase();
            const stLabel = BEN_HELP_STATUS_LABELS[st] || _bhmCapLabel(st);
            const srcClass = `src-${escapeBhHtml(r.source_type || 'help')}`;
            const isHelp = r.source_type === 'help';
            const catPillClass = isHelp
                ? `bh-cat-${escapeBhHtml(r.category || 'other')}`
                : 'bh-cat-other';
            const amt = Number(r.amount || 0) || 0;
            const prog = Math.max(0, Math.min(100, Number(r.progress_pct || 0)));

            return `
                <tr>
                    <td style="white-space:nowrap;">
                        <div style="font-weight:700; color:var(--text-main);">${_bhmFormatDate(r.record_date)}</div>
                        <div style="font-size:0.69rem; color:var(--text-muted); margin-top:2px;">${escapeBhHtml(_bhmCapLabel(r.payment_method || 'cash'))}</div>
                    </td>
                    <td>
                        <div><span class="bhm-src-pill ${srcClass}">${escapeBhHtml(r.source_label || _bhmCapLabel(r.source_type))}</span></div>
                        <div><span class="bh-cat-pill ${catPillClass}" style="font-size:0.66rem; padding:0.12rem 0.48rem;">${escapeBhHtml(r.category_label || _bhmCapLabel(r.category))}</span></div>
                    </td>
                    <td style="max-width:300px;">
                        <div style="font-weight:800; color:var(--text-main); line-height:1.3;">${escapeBhHtml(r.title || 'Aid Record')}</div>
                        ${r.description ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px; line-height:1.35;">${escapeBhHtml(r.description)}</div>` : ''}
                        <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:3px;">
                            ${r.quantity ? `<span style="font-size:0.66rem; padding:0.08rem 0.42rem; border-radius:999px; background:rgba(148,163,184,0.14); color:var(--text-muted); font-weight:700;">Qty: ${escapeBhHtml(r.quantity)}</span>` : ''}
                            ${Number(r.logs_count || 0) > 0 ? `<span style="font-size:0.66rem; padding:0.08rem 0.42rem; border-radius:999px; background:rgba(16,185,129,0.12); color:#059669; font-weight:700;">${Number(r.logs_count)} audit log${Number(r.logs_count) > 1 ? 's' : ''}</span>` : ''}
                        </div>
                    </td>
                    <td>
                        <div style="font-weight:700; font-size:0.76rem; color:var(--text-main);">${escapeBhHtml(r.provider || 'EDF Office')}</div>
                        <div style="font-size:0.69rem; font-family:monospace; color:var(--text-muted); margin-top:2px;">${escapeBhHtml(r.reference_no || `#${r.record_id}`)}</div>
                    </td>
                    <td>
                        <span class="bh-status-pill ${_bhmStatusBadgeClass(st)}">${escapeBhHtml(stLabel)}</span>
                        <div class="bhm-mini-prog" title="Progress ${prog}%"><span style="width:${prog}%;"></span></div>
                    </td>
                    <td class="bhm-amt-cell">
                        ${amt > 0
                            ? `<span>${formatBhLkr(amt)}</span>`
                            : `<span style="color:var(--text-muted); font-weight:600; font-size:0.74rem;">In-Kind</span>`}
                    </td>
                </tr>`;
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function bhmExportCSV() {
    const rowsData = _bhmGetFilteredSorted();
    if (!rowsData.length) {
        showToast('No filtered history records to export', 'warning');
        return;
    }
    const b = _bhmState.beneficiary || {};
    const appNo = (b.application_number || `BEN-${_bhmState.benId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const headers = ['Date', 'Source', 'Category', 'Title', 'Description', 'Provider / Donor', 'Reference', 'Method', 'Quantity', 'Status', 'Progress %', 'Amount (LKR)'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

    const lines = rowsData.map(r => [
        r.record_date || '',
        r.source_label || r.source_type,
        r.category_label || r.category,
        r.title || '',
        r.description || '',
        r.provider || '',
        r.reference_no || '',
        r.payment_method || '',
        r.quantity || '',
        BEN_HELP_STATUS_LABELS[r.status] || _bhmCapLabel(r.status),
        Number(r.progress_pct || 0),
        Number(r.amount || 0)
    ].map(esc).join(','));

    const csv = '\uFEFF' + [headers.map(esc).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EDF-Beneficiary-History-${appNo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rowsData.length} history record${rowsData.length > 1 ? 's' : ''} to CSV`, 'success');
}


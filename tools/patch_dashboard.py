"""
Patch dashboard.html:
  1. Add sidebar.css link
  2. Restructure sidebar with sidebar-inner wrapper, brand-info, brand-subtitle, status-dot
  3. Update notification bell to use class-based notif-dot
  4. Clean inline styles from user profile section
"""
import re

FILE = r'd:\Freelance\EDF\public\dashboard.html'

with open(FILE, 'r', encoding='utf-8') as f:
    html = f.read()

# ─── 1. Add sidebar.css link after style.css ──────────────────────────────────
html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    '<link rel="stylesheet" href="css/style.css">\n    <link rel="stylesheet" href="css/sidebar.css">'
)

# ─── 2. Replace the entire <aside class="sidebar"> block ──────────────────────
OLD_SIDEBAR = '''        <aside class="sidebar">
            <div class="brand-section">
                <div class="logo-container">
                    <i data-lucide="shield-check"></i>
                </div>
                <h1 class="brand-text">EDF PORTAL</h1>
            </div>

            <nav class="nav-menu" id="mainNav">
                <ul style="list-style: none;">
                    <li class="nav-item">
                        <a href="#" class="nav-link active" data-tab="overview">
                            <i data-lucide="layout-dashboard"></i>
                            <span class="nav-text">Overview</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="members">
                            <i data-lucide="users"></i>
                            <span class="nav-text">Members</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="families">
                            <i data-lucide="home"></i>
                            <span class="nav-text">Family Registry</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="beneficiaries" id="beneficiariesMenu">
                            <i data-lucide="heart-handshake"></i>
                            <span class="nav-text">Beneficiaries</span>
                            <i data-lucide="chevron-down" class="menu-arrow"></i>
                        </a>
                        <ul class="nav-submenu" id="beneficiariesSubmenu">
                            <li>
                                <a href="#" class="nav-submenu-link" data-tab="beneficiaries">
                                    <i data-lucide="list"></i> All Records
                                </a>
                            </li>
                            <li>
                                <a href="#" class="nav-submenu-link" onclick="openAddBeneficiaryModal()">
                                    <i data-lucide="user-plus"></i> Register New
                                </a>
                            </li>
                            <li>
                                <a href="#" class="nav-submenu-link" onclick="openBeneficiaryCategories()">
                                    <i data-lucide="tag"></i> Beneficiary Categories
                                </a>
                            </li>
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="courses">
                            <i data-lucide="graduation-cap"></i>
                            <span class="nav-text">Programs</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="subscriptions">
                            <i data-lucide="credit-card"></i>
                            <span class="nav-text">Subscriptions</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="donations">
                            <i data-lucide="heart"></i>
                            <span class="nav-text">Donations</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link" data-tab="volunteers">
                            <i data-lucide="user-plus"></i>
                            <span class="nav-text">Volunteers</span>
                        </a>
                    </li>
                </ul>
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-card">
                    <h4><i data-lucide="zap" style="width: 14px; color: var(--accent);"></i> System Status</h4>
                    <p>All services are operational. Last sync: Just now.</p>
                </div>
            </div>

        </aside>'''

NEW_SIDEBAR = '''        <aside class="sidebar">
            <div class="sidebar-inner">

                <!-- Brand -->
                <div class="brand-section">
                    <div class="logo-container">
                        <i data-lucide="shield-check"></i>
                    </div>
                    <div class="brand-info">
                        <h1 class="brand-text">EDF Portal</h1>
                        <span class="brand-subtitle">Galgamuwa</span>
                    </div>
                </div>

                <!-- Navigation -->
                <nav class="nav-menu" id="mainNav">
                    <ul>
                        <li class="nav-item">
                            <a href="#" class="nav-link active" data-tab="overview">
                                <i data-lucide="layout-dashboard"></i>
                                <span class="nav-text">Overview</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="members">
                                <i data-lucide="users"></i>
                                <span class="nav-text">Members</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="families">
                                <i data-lucide="home"></i>
                                <span class="nav-text">Family Registry</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="beneficiaries" id="beneficiariesMenu">
                                <i data-lucide="heart-handshake"></i>
                                <span class="nav-text">Beneficiaries</span>
                                <i data-lucide="chevron-down" class="menu-arrow"></i>
                            </a>
                            <ul class="nav-submenu" id="beneficiariesSubmenu">
                                <li>
                                    <a href="#" class="nav-submenu-link" data-tab="beneficiaries">
                                        <i data-lucide="list"></i> All Records
                                    </a>
                                </li>
                                <li>
                                    <a href="#" class="nav-submenu-link" onclick="openAddBeneficiaryModal()">
                                        <i data-lucide="user-plus"></i> Register New
                                    </a>
                                </li>
                                <li>
                                    <a href="#" class="nav-submenu-link" onclick="openBeneficiaryCategories()">
                                        <i data-lucide="tag"></i> Categories
                                    </a>
                                </li>
                            </ul>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="courses">
                                <i data-lucide="graduation-cap"></i>
                                <span class="nav-text">Programs</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="subscriptions">
                                <i data-lucide="credit-card"></i>
                                <span class="nav-text">Subscriptions</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="donations">
                                <i data-lucide="heart"></i>
                                <span class="nav-text">Donations</span>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="#" class="nav-link" data-tab="volunteers">
                                <i data-lucide="user-plus"></i>
                                <span class="nav-text">Volunteers</span>
                            </a>
                        </li>
                    </ul>
                </nav>

                <!-- Footer / Status Card -->
                <div class="sidebar-footer">
                    <div class="sidebar-card">
                        <h4>
                            <span class="status-dot"></span>
                            System Status
                        </h4>
                        <p>All services operational &mdash; synced just now.</p>
                    </div>
                </div>

            </div><!-- /.sidebar-inner -->
        </aside>'''

if OLD_SIDEBAR.replace('\r\n', '\n') in html.replace('\r\n', '\n'):
    html = html.replace('\r\n', '\n')  # normalise
    html = html.replace(OLD_SIDEBAR.replace('\r\n', '\n'), NEW_SIDEBAR)
    print("✓ Sidebar replaced")
else:
    print("✗ Sidebar block NOT found — check whitespace/indentation")

# ─── 3. Update notification bell ──────────────────────────────────────────────
html = re.sub(
    r'<div class="notification-bell">\s*<i data-lucide="bell"[^>]*></i>\s*<span[^>]*></span>\s*</div>',
    '''<div class="notification-bell" title="Notifications">
                        <i data-lucide="bell"></i>
                        <span class="notif-dot"></span>
                    </div>''',
    html
)
print("✓ Notification bell updated")

# ─── 4. Clean inline styles from user profile ─────────────────────────────────
html = re.sub(r'<div id="userFullName"[^>]*>', '<div id="userFullName">', html)
html = re.sub(r'<div id="userRole"[^>]*>', '<div id="userRole">', html)
print("✓ User profile inline styles cleaned")

# ─── 5. Clean inline width styles from dropdown icons ─────────────────────────
html = re.sub(r'(<i data-lucide="(?:user|settings|log-out)")(\s+style="width:\d+px;")>', r'\1>', html)
print("✓ Dropdown icon inline styles cleaned")

# ─── 6. Write output ──────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(html)

print("\nDone! dashboard.html updated successfully.")

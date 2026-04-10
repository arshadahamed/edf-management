/* ═══════════════════════════════════════════════════════════════════════════
   i18n.js — UI Language / Locale switching for EDF Dashboard
   Supported: English (en) · Sinhala (si) · Tamil (ta)
   ═══════════════════════════════════════════════════════════════════════════ */

const I18N = {

    /* ── English ─────────────────────────────────────────────────────────── */
    en: {
        nav: {
            overview:       'Overview',
            members:        'Members',
            families:       'Family Registry',
            beneficiaries:  'Beneficiaries',
            allRecords:     'All Records',
            registerNew:    'Register New',
            categories:     'Categories',
            subscriptions:  'Subscriptions',
            donations:      'Donations',
            ramadan:        'Ramadan Tokens',
            volunteers:     'Volunteers',
            programs:       'Programs',
            allPrograms:    'All Programs',
            customizer:     'App Customizer',
            users:          'User Accounts',
            logs:           'System Logs',
            profile:        'My Profile',
            settings:       'Settings',
            notifications:  'Notifications',
        },
        sidebar: {
            systemStatus:   'System Status',
            operational:    'All services operational \u2014 synced just now.',
        },
        settings: {
            languageTitle:  'Language & Region',
            languageSub:    'Set your preferred language and date format',
        },
    },

    /* ── සිංහල (Sinhala) ────────────────────────────────────────────────── */
    si: {
        nav: {
            overview:       'දළ විශ්ලේෂණය',
            members:        'සාමාජිකයින්',
            families:       'පවුල් ලේඛනය',
            beneficiaries:  'ප්‍රතිලාභීන්',
            allRecords:     'සියලු වාර්තා',
            registerNew:    'නව ලියාපදිංචිය',
            categories:     'ප්‍රවර්ග',
            subscriptions:  'දායකත්ව',
            donations:      'පරිත්‍යාග',
            ramadan:        'රමාදාන් ටෝකන්',
            volunteers:     'ස්වේච්ඡා සේවකයින්',
            programs:       'වැඩසටහන්',
            allPrograms:    'සියලු වැඩසටහන්',
            customizer:     'යෙදුම් අභිරුචිකාරකය',
            users:          'පරිශීලක ගිණුම්',
            logs:           'පද්ධති ලොග්',
            profile:        'මගේ පැතිකඩ',
            settings:       'සැකසීම්',
            notifications:  'දැනුම්දීම්',
        },
        sidebar: {
            systemStatus:   'පද්ධති තත්ත්වය',
            operational:    'සියලු සේවාවන් ක්‍රියාත්මකයි.',
        },
        settings: {
            languageTitle:  'භාෂාව සහ කලාපය',
            languageSub:    'ඔබ කැමති භාෂාව සහ දිනය ආකෘතිය සකසන්න',
        },
    },

    /* ── தமிழ் (Tamil) ──────────────────────────────────────────────────── */
    ta: {
        nav: {
            overview:       'கண்ணோட்டம்',
            members:        'உறுப்பினர்கள்',
            families:       'குடும்ப பதிவேடு',
            beneficiaries:  'பயனாளிகள்',
            allRecords:     'அனைத்து பதிவுகள்',
            registerNew:    'புதிய பதிவு',
            categories:     'வகைகள்',
            subscriptions:  'சந்தாக்கள்',
            donations:      'நன்கொடைகள்',
            ramadan:        'ரமதான் டோக்கன்கள்',
            volunteers:     'தன்னார்வலர்கள்',
            programs:       'திட்டங்கள்',
            allPrograms:    'அனைத்து திட்டங்கள்',
            customizer:     'பயன்பாட்டு தனிப்பயனாக்கி',
            users:          'பயனர் கணக்குகள்',
            logs:           'கணினி பதிவுகள்',
            profile:        'என் சுயவிவரம்',
            settings:       'அமைப்புகள்',
            notifications:  'அறிவிப்புகள்',
        },
        sidebar: {
            systemStatus:   'கணினி நிலை',
            operational:    'அனைத்து சேவைகளும் செயல்படுகின்றன.',
        },
        settings: {
            languageTitle:  'மொழி மற்றும் பகுதி',
            languageSub:    'உங்கள் விருப்பமான மொழி மற்றும் தேதி வடிவமைப்பை அமைக்கவும்',
        },
    },
};

/* ── Google Fonts for non-Latin scripts ─────────────────────────────────── */
const _I18N_FONTS = {
    si: {
        href:   'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700&display=swap',
        family: '"Noto Sans Sinhala", sans-serif',
    },
    ta: {
        href:   'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap',
        family: '"Noto Sans Tamil", sans-serif',
    },
};

function _i18nLoadFont(lang) {
    // Remove previously injected font link + override style
    document.querySelectorAll('link[data-i18n-font]').forEach(l => l.remove());
    const prev = document.getElementById('i18n-font-override');
    if (prev) prev.remove();

    const def = _I18N_FONTS[lang];
    if (!def) return; // English — system fonts are fine

    // Inject Google Fonts stylesheet
    const link = Object.assign(document.createElement('link'), {
        rel: 'stylesheet', href: def.href,
    });
    link.setAttribute('data-i18n-font', lang);
    document.head.appendChild(link);

    // Override font-family only on translated text nodes so icons/numbers are unaffected
    const style = document.createElement('style');
    style.id = 'i18n-font-override';
    style.textContent = `
        [data-i18n],
        .nav-text,
        #currentTabTitle {
            font-family: ${def.family} !important;
        }
    `;
    document.head.appendChild(style);
}

/* ── Resolve a dot-path key against a translation object ─────────────────── */
function _i18nGet(obj, dotPath) {
    return dotPath.split('.').reduce((o, k) => o?.[k], obj);
}

/* ── Main apply function ─────────────────────────────────────────────────── */
function applyLanguage(lang) {
    const t = I18N[lang] || I18N.en;

    // 1. html[lang] attribute (helps browser pick correct fonts + hyphenation)
    document.documentElement.lang = lang;

    // 2. Load language-specific font
    _i18nLoadFont(lang);

    // 3. Main nav items — each has a unique data-tab + .nav-text
    const mainNavMap = {
        overview:      t.nav.overview,
        members:       t.nav.members,
        families:      t.nav.families,
        subscriptions: t.nav.subscriptions,
        donations:     t.nav.donations,
        ramadan:       t.nav.ramadan,
        volunteers:    t.nav.volunteers,
        users:         t.nav.users,
        logs:          t.nav.logs,
        profile:       t.nav.profile,
        settings:      t.nav.settings,
    };
    Object.entries(mainNavMap).forEach(([tab, text]) => {
        const el = document.querySelector(`#mainNav a[data-tab="${tab}"] .nav-text`);
        if (el) el.textContent = text;
    });

    // Parent nav items that share data-tab with their submenu
    const benParent = document.querySelector('#mainNav a.nav-link[data-tab="beneficiaries"] .nav-text');
    if (benParent) benParent.textContent = t.nav.beneficiaries;

    const progParent = document.querySelector('#mainNav a.nav-link[data-tab="courses"] .nav-text');
    if (progParent) progParent.textContent = t.nav.programs;

    // 4. All [data-i18n] elements (submenu labels, footer, settings labels, etc.)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const val = _i18nGet(t, el.getAttribute('data-i18n'));
        if (val !== undefined) el.textContent = val;
    });

    // 5. Sync the topbar page title to whatever the active nav item now reads
    const activeNavText = document.querySelector('#mainNav a.active .nav-text');
    const titleEl = document.getElementById('currentTabTitle');
    if (activeNavText && titleEl) {
        titleEl.textContent = activeNavText.textContent;
    }
}

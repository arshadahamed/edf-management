const translations = {
    "en": {
        "sidebar.dashboard": "Overview",
        "sidebar.members": "Members",
        "sidebar.families": "Family Registry",
        "sidebar.beneficiaries": "Beneficiaries",
        "sidebar.programs": "Programs",
        "sidebar.subscriptions": "Subscriptions",
        "sidebar.zakat": "Zakat Tools",
        "sidebar.donations": "Donation Board",
        "sidebar.ramadan": "Ramadan Tokens",
        "sidebar.inventory": "Inventory & Assets",
        "sidebar.volunteers": "Volunteers",
        "sidebar.reports": "Smart Reports",
        "sidebar.profile": "My Profile",
        "sidebar.users": "User Accounts",
        "sidebar.syslogs": "System Logs",
        "sidebar.settings": "Settings",
        "sidebar.logout": "Sign Out",
        "sidebar.systemStatus": "System Status",
        "sidebar.operational": "All services operational — synced just now.",
        "nav.allRecords": "All Records",
        "nav.registerNew": "Register New",
        "nav.categories": "Categories",
        "nav.allPrograms": "All Programs",
        "nav.customizer": "App Customizer",
        "settings.languageTitle": "Language & Region",
        "settings.languageSub": "Set your preferred language and date format",
        "topbar.search": "Search members, programs...",
        "dashboard.welcome": "Welcome",
        "lang.change": "Change Language"
    },
    "ta": {
        "sidebar.dashboard": "கண்ணோட்டம்",
        "sidebar.members": "உறுப்பினர்கள்",
        "sidebar.families": "குடும்பப் பதிவேடு",
        "sidebar.beneficiaries": "பயனாளிகள்",
        "sidebar.programs": "திட்டங்கள்",
        "sidebar.subscriptions": "சந்தாக்கள்",
        "sidebar.zakat": "ஜகாத் கருவிகள்",
        "sidebar.donations": "நன்கொடை பலகை",
        "sidebar.ramadan": "ரமலான் டோக்கன்கள்",
        "sidebar.inventory": "கையிருப்பு",
        "sidebar.volunteers": "தன்னார்வலர்கள்",
        "sidebar.reports": "அறிக்கைகள்",
        "sidebar.profile": "எனது சுயவிவரம்",
        "sidebar.users": "பயனர் கணக்குகள்",
        "sidebar.syslogs": "கணினி பதிவுகள்",
        "sidebar.settings": "அமைப்புகள்",
        "sidebar.logout": "வெளியேறு",
        "sidebar.systemStatus": "கணினி நிலை",
        "sidebar.operational": "அனைத்து சேவைகளும் செயல்படுகின்றன — தற்பொழுது ஒத்திசைக்கப்பட்டது.",
        "nav.allRecords": "அனைத்து பதிவுகள்",
        "nav.registerNew": "புதிய பதிவு",
        "nav.categories": "வகைகள்",
        "nav.allPrograms": "அனைத்து திட்டங்கள்",
        "nav.customizer": "பயன்பாட்டு தனிப்பயனாக்கி",
        "settings.languageTitle": "மொழி & பிராந்தியம்",
        "settings.languageSub": "உங்கள் விருப்பமான மொழி மற்றும் தேதி வடிவமைப்பை அமைக்கவும்",
        "topbar.search": "தேடுக...",
        "dashboard.welcome": "வரவேற்கிறோம்",
        "lang.change": "மொழியை மாற்று"
    },
    "si": {
        "sidebar.dashboard": "දළ විශ්ලේෂණය",
        "sidebar.members": "සාමාජිකයින්",
        "sidebar.families": "පවුල් ලියාපදිංචිය",
        "sidebar.beneficiaries": "ප්‍රතිලාභීන්",
        "sidebar.programs": "වැඩසටහන්",
        "sidebar.subscriptions": "දායකත්ව",
        "sidebar.zakat": "සකාත් මෙවලම්",
        "sidebar.donations": "පරිත්‍යාග පුවරුව",
        "sidebar.ramadan": "රාමසාන් ටෝකන්",
        "sidebar.inventory": "බඩුතොග සහ වත්කම්",
        "sidebar.volunteers": "ස්වේච්ඡා සේවකයන්",
        "sidebar.reports": "වාර්තා",
        "sidebar.profile": "මගේ පැතිකඩ",
        "sidebar.users": "පරිශීලක ගිණුම්",
        "sidebar.syslogs": "පද්ධති ලොග්",
        "sidebar.settings": "සැකසුම්",
        "sidebar.logout": "ඉවත් වන්න",
        "sidebar.systemStatus": "පද්ධති තත්ත්වය",
        "sidebar.operational": "සියලුම සේවා ක්‍රියාකාරීයි — දැන් සමමුහුර්ත විය.",
        "nav.allRecords": "සියලු වාර්තා",
        "nav.registerNew": "නව ලියාපදිංචිය",
        "nav.categories": "ප්‍රවර්ග",
        "nav.allPrograms": "සියලු වැඩසටහන්",
        "nav.customizer": "යෙදුම් අභිරුචිකාරකය",
        "settings.languageTitle": "භාෂාව සහ කලාපය",
        "settings.languageSub": "ඔබ කැමති භාෂාව සහ දිනය ආකෘතිය සකසන්න",
        "topbar.search": "සොයන්න...",
        "dashboard.welcome": "සාදරයෙන් පිළිගනිමු",
        "lang.change": "භාෂාව වෙනස් කරන්න"
    }
};

let currentLang = localStorage.getItem('edf_lang') || 'en';

function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('edf_lang', lang);
    
    // Update topbar label
    document.getElementById('currentLangLbl').textContent = lang.toUpperCase();
    
    updateTranslations();
}

function updateTranslations() {
    // Basic text content translation
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang] && translations[currentLang][key]) {
            el.placeholder = translations[currentLang][key];
        }
    });

    // Complex strings
    if (window._currentUser) {
        const welcomeEl = document.getElementById('welcomeUser');
        if (welcomeEl && translations[currentLang]['dashboard.welcome']) {
            welcomeEl.textContent = `${translations[currentLang]['dashboard.welcome']}, ${window._currentUser.full_name.split(' ')[0]}`;
        }
    }
}

// Clock updates
function updateDateTime() {
    const el = document.getElementById('datetimeStr');
    if (!el) return;
    const now = new Date();
    
    // Example format: 12 Oct 2024, 02:45 PM
    const options = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
    el.textContent = now.toLocaleString(undefined, options);
}

document.addEventListener('DOMContentLoaded', () => {
    // Init Language
    setLanguage(currentLang);

    // Init Clock
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

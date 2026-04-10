const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const htmlPath = path.join(__dirname, '..', 'public', 'dashboard.html');

let css = fs.readFileSync(cssPath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Theme Configuration in CSS
// Replace the current :root with light/dark variables.
const themeVars = `
:root {
    /* Light Theme (Default) */
    --primary: #6366f1;
    --primary-light: #818cf8;
    --primary-dark: #4338ca;
    --secondary: #0d9488;
    --accent: #f59e0b;
    --success: #10b981;
    --danger: #ef4444;
    --bg-main: #f8fafc;
    --bg-sidebar: rgba(255, 255, 255, 0.95);
    --sidebar-glass: rgba(255, 255, 255, 0.95);
    --bg-card: #ffffff;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --text-on-dark: #0f172a;
    --sidebar-width: 280px;
    --topbar-height: 80px;
    --border-radius: 24px;
    --border-color: #e2e8f0;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --shadow-premium: 0 0 50px rgba(0, 0, 0, 0.05);
    --transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    
    /* Button Base Colors */
    --btn-bg: #111111;
    --btn-text: #ffffff;
    --btn-hover: #333333;
    
    --glow-bg: rgba(99, 102, 241, 0.03);
    
    /* Input Fields */
    --input-bg: #f8fafc;
    --input-focus-bg: #ffffff;
    --input-focus-border: var(--primary);
    
    --modal-bg: #ffffff;
}

[data-theme="dark"] {
    /* Dark Theme */
    --primary: #ffffff;
    --primary-light: rgba(255, 255, 255, 0.5);
    --primary-dark: #cccccc;
    --secondary: #a1a1aa;
    --accent: #ffffff;
    --success: #10b981;
    --danger: #ef4444;
    --bg-main: #000000;
    --bg-sidebar: rgba(255, 255, 255, 0.02);
    --sidebar-glass: rgba(255, 255, 255, 0.02);
    --bg-card: rgba(255, 255, 255, 0.02);
    --text-main: #ffffff;
    --text-muted: rgba(255, 255, 255, 0.5);
    --text-on-dark: #ffffff;
    --border-color: rgba(255, 255, 255, 0.08);
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.5);
    --shadow-premium: 0 0 60px rgba(0, 0, 0, 0.4);
    
    /* Button Base Colors */
    --btn-bg: #ffffff;
    --btn-text: #000000;
    --btn-hover: #e6e6e6;
    
    --glow-bg: rgba(255, 255, 255, 0.03);
    
    /* Input Fields */
    --input-bg: rgba(255, 255, 255, 0.04);
    --input-focus-bg: rgba(255, 255, 255, 0.08);
    --input-focus-border: rgba(255, 255, 255, 0.5);
    
    --modal-bg: #0a0a0a;
}
`;

css = css.replace(/:root\s*{[\s\S]*?}/, themeVars);

// Fix hardcoded dark colors dynamically using variables
css = css.replace(/background:\s*#0a0a0a;/g, 'background: var(--bg-main);');
css = css.replace(/background-color:\s*#0a0a0a;/g, 'background-color: var(--bg-main);');
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.02\);/g, 'background: var(--bg-card);');
css = css.replace(/color:\s*#ffffff;/g, 'color: var(--text-main);');
css = css.replace(/color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/g, 'color: var(--text-muted);');

css = css.replace(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/g, 'background: var(--sidebar-glass);');
css = css.replace(/\.modal-content\s*{[^}]*background:\s*#0a0a0a;[\s\S]*?}/, `.modal-content {
    background: var(--modal-bg);
    width: 95%; max-width: 600px; max-height: 92vh; border-radius: 32px; position: relative; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden; border: 1px solid var(--border-color);
}`);

css = css.replace(/\.form-input,\s*\.form-select\s*{[\s\S]*?}/, `.form-input,\n.form-select {\n    width: 100%;\n    padding: 0.875rem 1.25rem;\n    border: 1px solid var(--border-color);\n    border-radius: 9999px;\n    font-family: inherit;\n    background: var(--input-bg);\n    color: var(--text-main);\n    transition: all 0.3s ease;\n}\n\n.form-input:focus, .form-select:focus {\n    background: var(--input-focus-bg);\n    border-color: var(--input-focus-border);\n    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);\n    outline: none;\n}`);

css = css.replace(/\.btn-primary\s*{[^}]*}/, `.btn-primary { background: var(--btn-bg); color: var(--btn-text); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); }`);
css = css.replace(/\.btn-primary:hover\s*{[^}]*}/, `.btn-primary:hover { background: var(--btn-hover); transform: translateY(-2px); box-shadow: var(--shadow-md); color: var(--btn-text); }`);

css = css.replace(/\.btn-outline\s*{[^}]*}/, `.btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); }`);

// Redesign modal of 'Register New Beneficiary'
css += `
/* Clear View Beneficiary Modal Overrides */
#beneficiaryModal .modal-content {
    background: var(--modal-bg);
}
.stepper-tabs {
    background: transparent;
    border-bottom: 1px solid var(--border-color);
}
.stepper-item::after { background: var(--border-color); }
.step-circle {
    background: var(--bg-card); border-color: var(--border-color); color: var(--text-main);
}
.stepper-item.active .step-circle { background: var(--primary); color: var(--bg-main); border-color: var(--primary); }
.premium-input { background: var(--input-bg); border-color: var(--border-color); color: var(--text-main); }
.premium-input:focus { background: var(--input-focus-bg); border-color: var(--input-focus-border); box-shadow: none; }
.premium-input-group label { color: var(--text-main); font-weight: 500; font-size: 0.85rem; }
.section-title { color: var(--text-main); border-bottom-color: var(--border-color); }
.switch-group { background: var(--input-bg); border-color: var(--border-color); }
.switch-label { color: var(--text-main); }
.dynamic-card { background: var(--input-bg); border-color: var(--border-color); }
.dynamic-card:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
`;

fs.writeFileSync(cssPath, css);


// Add theme toggle in navbar
let htmlMod = html.replace(/<div class="top-bar-right">/, `<div class="top-bar-right">
                    <!-- Theme Toggle -->
                    <button class="top-bar-toggle" id="themeToggleBtn" title="Toggle Theme">
                        <i data-lucide="moon" id="themeIcon"></i>
                    </button>`);

// Add ambient glow variable handling
htmlMod = htmlMod.replace(/<body>\s*<!-- Ambient Glow --><div[^>]*><\/div>/, `<body>
    <!-- Ambient Glow -->
    <div id="ambientGlow" style="position: fixed; top: 0; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: var(--glow-bg); z-index: 0; pointer-events: none; border-radius: 50%;"></div>`);

// Also update dark element colors inside index elements.
htmlMod = htmlMod.replace(/color:\s*#ffffff;/ig, 'color: var(--text-main);');
htmlMod = htmlMod.replace(/color:\s*rgba\(255,255,255,0\.5\);/ig, 'color: var(--text-muted);');
htmlMod = htmlMod.replace(/background:\s*rgba\(255,255,255,0\.05\);/ig, 'background: var(--bg-card);');
htmlMod = htmlMod.replace(/border:\s*1px solid rgba\(255,255,255,0\.1\);/ig, 'border: 1px solid var(--border-color);');

// Add inline script at the end to handle theme
htmlMod = htmlMod.replace(/<\/body>/, `<script>
        const themeBtn = document.getElementById('themeToggleBtn');
        const themeIcon = document.getElementById('themeIcon');
        const currentTheme = localStorage.getItem('theme') || 'dark'; // default to dark
        
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateIcon(currentTheme);

        themeBtn.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            let newTheme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateIcon(newTheme);
        });

        function updateIcon(theme) {
            if (theme === 'dark') {
                themeIcon.setAttribute('data-lucide', 'sun');
            } else {
                themeIcon.setAttribute('data-lucide', 'moon');
            }
            if(window.lucide) {
                window.lucide.createIcons();
            }
        }
    </script>
</body>`);

fs.writeFileSync(htmlPath, htmlMod);

console.log('Successfully updated clear view UI and themes!');

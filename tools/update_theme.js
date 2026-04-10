const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const htmlPath = path.join(__dirname, '..', 'public', 'dashboard.html');

// --- 1. Update style.css ---
let css = fs.readFileSync(cssPath, 'utf8');

// Replace fonts
css = css.replace(/@import url\('.*?'\);/, "@import url('https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap');");
css = css.replace(/font-family:\s*'Inter',\s*sans-serif;/g, "font-family: 'General Sans', sans-serif;");
css = css.replace(/font-family:\s*'Outfit',\s*sans-serif;/g, "font-family: 'General Sans', sans-serif;");

// Update :root variables
css = css.replace(/:root\s*{[\s\S]*?}/, `:root {
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
    --sidebar-width: 280px;
    --topbar-height: 80px;
    --border-radius: 24px;
    --border-color: rgba(255, 255, 255, 0.08);
    --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.5);
    --shadow-premium: 0 0 60px rgba(0, 0, 0, 0.6);
    --transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}`);

// Hardcoded background colors to transparent/dark
css = css.replace(/background:\s*#fff(?:fff)?;/ig, 'background: #0a0a0a;');
css = css.replace(/background:\s*#f[81]+[a-f0-9]*;/ig, 'background: rgba(255, 255, 255, 0.02);');
css = css.replace(/background-color:\s*#fff(?:fff)?;/ig, 'background-color: #0a0a0a;');

// Hardcoded text colors
css = css.replace(/color:\s*#94a3b8;/ig, 'color: rgba(255, 255, 255, 0.5);');

// Borders
css = css.replace(/border:.*?#e2e8f0/g, 'border: 1px solid var(--border-color)');
css = css.replace(/border:.*?#f1f5f9/g, 'border: 1px solid var(--border-color)');
css = css.replace(/border-bottom:.*?(?:#f1f5f9|#e2e8f0|rgba\(255, 255, 255, 1\))/g, 'border-bottom: 1px solid var(--border-color)');
css = css.replace(/border-top:.*?#f1f5f9/g, 'border-top: 1px solid var(--border-color)');
css = css.replace(/border-color:.*?#e2e8f0/g, 'border-color: var(--border-color)');
css = css.replace(/border-color:.*?#f1f5f9/g, 'border-color: var(--border-color)');

// Top bar
css = css.replace(/background:\s*rgba\(255, 255, 255, 0\.8\);/g, 'background: rgba(0, 0, 0, 0.5);');

// .card
css = css.replace(/\.card\s*{[\s\S]*?}/, `.card {
    background: var(--bg-card);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-md);
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}`);

// Button base
css = css.replace(/\.btn\s*{[\s\S]*?}/, `.btn {
    padding: 0.625rem 1.25rem;
    border-radius: 9999px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: var(--transition);
}`);

// Button Primary
css = css.replace(/\.btn-primary\s*{[\s\S]*?}/, `.btn-primary {
    background: #ffffff;
    color: #000000;
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
    border: 0.6px solid #ffffff;
}`);

css = css.replace(/\.btn-primary:hover\s*{[\s\S]*?}/, `.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
    background: #e6e6e6;
}`);

// Button Outline
css = css.replace(/\.btn-outline\s*{[\s\S]*?}/, `.btn-outline {
    background: transparent;
    border: 0.6px solid #ffffff;
    color: #ffffff;
}`);

// Brand text gradient removal
css = css.replace(/\.brand-text\s*{[\s\S]*?}/, `.brand-text {
    font-size: 1.25rem;
    letter-spacing: 1px;
    color: #ffffff;
    font-weight: 600;
}`);

// Logo container update
css = css.replace(/\.logo-container\s*{[\s\S]*?}/, `.logo-container {
    width: 45px;
    height: 45px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
}`);

// Nav links hover/active
css = css.replace(/\.nav-link:hover\s*{[\s\S]*?}/, `.nav-link:hover {
    color: white;
    background: rgba(255, 255, 255, 0.05);
    transform: translateX(5px);
}`);

css = css.replace(/\.nav-link\.active\s*{[\s\S]*?}/, `.nav-link.active {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.05);
}`);

// Top bar toggle
css = css.replace(/\.top-bar-toggle\s*{[\s\S]*?}/, `.top-bar-toggle {
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    cursor: pointer;
    color: var(--text-main);
    margin-right: 1.5rem;
    transition: var(--transition);
}`);

// User dropdown
css = css.replace(/\.user-dropdown\s*{[\s\S]*?}/, `.user-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 200px;
    background: #0a0a0a;
    border: 1px solid var(--border-color);
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
    padding: 0.5rem;
    display: none;
    z-index: 100;
    animation: slideUp 0.3s ease;
}`);

// Search input
css = css.replace(/\.search-input\s*{[\s\S]*?}/, `.search-input {
    width: 280px;
    padding: 0.625rem 1rem 0.625rem 2.75rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-color);
    border-radius: 9999px;
    font-size: 0.875rem;
    transition: var(--transition);
    color: white;
}`);
css = css.replace(/\.search-input:focus\s*{[\s\S]*?}/, `.search-input:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);
    outline: none;
}`);

// Tables
css = css.replace(/th\s*{[\s\S]*?}/, `th {
    text-align: left;
    padding: 1rem 1.5rem;
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 500;
}`);
css = css.replace(/td\s*{[\s\S]*?}/, `td {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.875rem;
}`);

// Modals
css = css.replace(/\.modal-content\s*{[\s\S]*?}/, `.modal-content {
    background: #0a0a0a;
    width: 95%;
    max-width: 600px;
    max-height: 92vh;
    border-radius: 32px;
    position: relative;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
    border: 1px solid var(--border-color);
}`);

css = css.replace(/\.modal-header\s*{[\s\S]*?}/, `.modal-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
    border-radius: 32px 32px 0 0;
}`);

css = css.replace(/\.modal-footer\s*{[\s\S]*?}/, `.modal-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    background: transparent;
    border-radius: 0 0 32px 32px;
}`);

css = css.replace(/\.modal-tabs\s*{[\s\S]*?}/, `.modal-tabs {
    display: flex;
    gap: 1.5rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    position: sticky;
    top: 0;
    z-index: 10;
}`);

// Form Group Components
css = css.replace(/\.form-input,\s*\.form-select\s*{[\s\S]*?}/, `.form-input,\n.form-select {\n    width: 100%;\n    padding: 0.875rem 1.25rem;\n    border: 1px solid var(--border-color);\n    border-radius: 9999px;\n    font-family: inherit;\n    background: rgba(255, 255, 255, 0.04);\n    color: #ffffff;\n    transition: all 0.3s ease;\n}\n\n.form-input:focus, .form-select:focus {\n    background: rgba(255, 255, 255, 0.08);\n    border-color: rgba(255, 255, 255, 0.5);\n    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05);\n    outline: none;\n}`);

css = css.replace(/\.btn-close\s*{[\s\S]*?}/, `.btn-close {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-muted);
    cursor: pointer;
    transition: var(--transition);
}`);

// Add glowing pill button class just in case we need it
css += `\n
.btn-pill {
    position: relative;
    display: inline-flex;
    border-radius: 9999px;
    border: 0.6px solid #ffffff;
    text-decoration: none;
    overflow: hidden;
    background: none;
    cursor: pointer;
    padding: 0;
}
.btn-glow {
    position: absolute;
    top: 0;
    left: 15%;
    width: 70%;
    height: 6px;
    background: radial-gradient(ellipse at top, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 70%);
    filter: blur(2px);
    z-index: 1;
    pointer-events: none;
}
.btn-inner {
    padding: 10px 24px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    position: relative;
    z-index: 2;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: none;
    outline: none;
    cursor: pointer;
}
.btn-pill-solid .btn-inner {
    background-color: #ffffff;
    color: #000000;
}
.btn-pill-solid:hover .btn-inner {
    background-color: #f2f2f2;
}
`;

fs.writeFileSync(cssPath, css);


// --- 2. Update dashboard.html inline styles ---
let html = fs.readFileSync(htmlPath, 'utf8');

// The stat cards have inline specific background colors:
// e.g. `<div class="stat-icon-wrapper" style="background: #e0f2fe; color: #0ea5e9;">`
// We'll replace them with neutral dark mode glassy blocks:
html = html.replace(/<div class="stat-icon-wrapper"[^>]*>/g, '<div class="stat-icon-wrapper" style="background: rgba(255,255,255,0.05); color: #ffffff; border: 1px solid rgba(255,255,255,0.1);">');

// We also want to fix the inline styles using `color: var(--text-main)` or `var(--text-muted)`
// These are mostly fine since we redefined those CSS vars!
// Let's add the ambient glow background to body.
html = html.replace(/<body>/, '<body>\n    <!-- Ambient Glow --><div style="position: fixed; top: 0; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, rgba(0, 0, 0, 0) 70%); z-index: 0; pointer-events: none;"></div>');

html = html.replace(/<div class="dashboard-container">/, '<div class="dashboard-container" style="position: relative; z-index: 1;">');

// Save HTML
fs.writeFileSync(htmlPath, html);

console.log("Theme update complete!");

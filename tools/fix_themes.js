const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const updatedTheme = `
:root {
    /* Premium Monochromatic Light Theme */
    --primary: #000000;
    --primary-light: rgba(0, 0, 0, 0.5);
    --primary-dark: #333333;
    --secondary: #666666;
    --accent: #000000;
    --success: #10b981;
    --danger: #ef4444;
    --bg-main: #ffffff;
    --bg-sidebar: #fcfcfc;
    --bg-card: #ffffff;
    --sidebar-glass: rgba(255, 255, 255, 0.95);
    --text-main: #000000;
    --text-muted: #666666;
    --text-on-dark: #000000;
    --sidebar-width: 280px;
    --topbar-height: 80px;
    --border-radius: 24px;
    --border-color: #e5e5e5;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --shadow-premium: 0 0 50px rgba(0, 0, 0, 0.05);
    --transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    
    /* Button Base Colors */
    --btn-bg: #000000;
    --btn-text: #ffffff;
    --btn-hover: #333333;
    
    --glow-bg: rgba(0, 0, 0, 0.03);
    
    /* Input Fields */
    --input-bg: #f9f9f9;
    --input-focus-bg: #ffffff;
    --input-focus-border: var(--primary);
    
    --modal-bg: #ffffff;
}

[data-theme="dark"] {
    /* Premium Monochromatic Dark Theme */
    --primary: #ffffff;
    --primary-light: rgba(255, 255, 255, 0.5);
    --primary-dark: #cccccc;
    --secondary: #a1a1aa;
    --accent: #ffffff;
    --success: #10b981;
    --danger: #ef4444;
    --bg-main: #000000;
    --bg-sidebar: #050505;
    --bg-card: #0a0a0a;
    --sidebar-glass: rgba(0, 0, 0, 0.85);
    --text-main: #ffffff;
    --text-muted: rgba(255, 255, 255, 0.6);
    --text-on-dark: #ffffff;
    --border-color: rgba(255, 255, 255, 0.1);
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
    
    --modal-bg: #0f0f0f;
}
`;

// Replace existing themes
css = css.replace(/:root\s*{[\s\S]*?\[data-theme="dark"\]\s*{[\s\S]*?--modal-bg: #0a0a0a;[^}]*}/, updatedTheme);
css = css.replace(/:root\s*{[\s\S]*?\[data-theme="dark"\]\s*{[\s\S]*?--modal-bg: #0f0f0f;[^}]*}/, updatedTheme);

// Fix the input-with-icon icon alignment issue
const oldIconCSS = /\.input-with-icon i\s*{[\s\S]*?}/g;
const newIconCSS = `.input-with-icon i, .input-with-icon svg.lucide {
    position: absolute;
    left: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    color: var(--text-muted);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
}`;

if (css.match(oldIconCSS)) {
    css = css.replace(oldIconCSS, newIconCSS);
} else {
    css += '\\n' + newIconCSS;
}

// Ensure the form inputs have consistent padding to accomodate the newly sized fixed icon
css = css.replace(/\.input-with-icon \.form-input\s*{[^}]*}/g, '.input-with-icon .form-input { padding-left: 3.25rem; }');

// Make sure dashboard titles and icons use primary colors gracefully
css += `
.card-header h3 { color: var(--text-main); }
.wizard-title i { color: var(--text-main); } /* Overwrite any old bright primary colors to match monochrome */
.modern-section-title { color: var(--text-main); }
.modern-section-title i { color: var(--text-main); width: 20px; height: 20px; margin-right: 8px; }
.card i.lucide { 
    stroke: currentColor; 
}
`;

fs.writeFileSync(cssPath, css);
console.log('Fixed themes and icon alignments!');

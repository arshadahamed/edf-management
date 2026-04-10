const fs = require('fs');
const text = fs.readFileSync('d:/Freelance/EDF/public/dashboard.html', 'utf8');
const s = '<style type="text/tailwindcss">';
const start = text.indexOf(s);
if (start !== -1) {
    const end = text.indexOf('</style>', start);
    const style = text.substring(start + s.length, end);
    fs.writeFileSync('d:/Freelance/EDF/tools/test_tw.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' + style);
    console.log('Extracted valid CSS block');
} else {
    console.log('Not found');
}

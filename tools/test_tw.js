const fs = require('fs');
const tailwind = require('tailwindcss');
const postcss = require('postcss');

const content = fs.readFileSync('public/dashboard.html', 'utf8');
const styleMatch = content.match(/<style type="text\/tailwindcss">([\s\S]*?)<\/style>/);

if (styleMatch) {
  const css = "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n" + styleMatch[1];
  postcss([tailwind({
    content: [{ raw: content, extension: 'html' }]
  })]).process(css, { from: 'style.css' })
    .then(res => console.log('Tailwind Compilation Successful!'))
    .catch(err => {
        console.error('ERROR ENCOUNTERED:', err.message);
        process.exit(1);
    });
} else {
  console.log('No style block found');
}

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('src/db/database.sqlite');
db.all("SELECT name FROM sqlite_master WHERE type='table' and name not like 'sqlite_%'", (err, rows) => {
  if (err) throw err;
  const names = rows.map(r => r.name);
  console.log('Tables in DB:', names.join(', '));
  
  if (names.includes('courses')) {
      db.all("PRAGMA table_info(courses)", (err, columns) => {
          console.log('Courses columns:', columns.map(c => c.name).join(', '));
      });
  }
  if (names.includes('program_applications')) {
      db.all("PRAGMA table_info(program_applications)", (err, columns) => {
          console.log('Applications columns:', columns.map(c => c.name).join(', '));
      });
  }
  if (names.includes('form_templates')) {
      console.log('form_templates exists');
  } else {
      console.log('form_templates MISSING');
  }
  
  setTimeout(() => db.close(), 1000);
});

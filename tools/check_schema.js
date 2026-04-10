const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('src/db/database.sqlite');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) throw err;
  console.log('Tables:', rows.map(r => r.name).join(', '));
  db.all("PRAGMA table_info(courses)", (err, columns) => {
    if (err) throw err;
    console.log('Courses columns:', columns.map(c => c.name).join(', '));
    db.all("PRAGMA table_info(program_applications)", (err, columns) => {
        if (err) throw err;
        console.log('Applications columns:', columns.map(c => c.name).join(', '));
        db.close();
    });
  });
});

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('src/db/database.sqlite');
db.all('SELECT * FROM courses', [], (err, rows) => {
  if (err) throw err;
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});

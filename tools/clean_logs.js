const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('src/db/database.sqlite');
db.run('DELETE FROM system_logs WHERE entity = "AUTH" AND action = "POST" AND details LIKE "%heartbeat%"', (err) => {
    console.log(err || 'done');
});

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
    const dbPath = path.join(__dirname, '..', 'src', 'db', 'database.sqlite');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const hashedPassword = await bcrypt.hash('admin@123', 10);
    await db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin']);
    
    console.log('Admin password updated to admin@123');
    await db.close();
}

updateAdminPassword().catch(console.error);

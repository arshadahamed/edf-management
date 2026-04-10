const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

async function updatePassword() {
    const db = await open({
        filename: path.join(__dirname, '../src/db/database.sqlite'),
        driver: sqlite3.Database
    });

    const hashedPassword = await bcrypt.hash('admin', 10);
    await db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin']);
    console.log('Password updated successfully.');
}

updatePassword();

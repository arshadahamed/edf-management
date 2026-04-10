const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function resetProgramsData() {
    const db = await open({
        filename: path.join(__dirname, '..', 'src', 'db', 'database.sqlite'),
        driver: sqlite3.Database
    });

    try {
        console.log('Clearing educational programs data...');
        await db.run('DELETE FROM program_applications');
        await db.run('DELETE FROM batches');
        await db.run('DELETE FROM courses');
        await db.run('DELETE FROM form_templates');
        
        // Reset autoincrement
        await db.run("DELETE FROM sqlite_sequence WHERE name IN ('program_applications', 'batches', 'courses', 'form_templates')");
        
        console.log('All data in Educational Programs has been cleared.');
    } catch (err) {
        console.error('Error clearing data:', err);
    } finally {
        await db.close();
    }
}

resetProgramsData();

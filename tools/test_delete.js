const fetch = require('node-fetch');
async function test() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login cookie:', cookie);

  const delRes = await fetch('http://localhost:5000/api/programs/programs/1', {
    method: 'DELETE',
    headers: { 'Cookie': cookie }
  });
  console.log('Delete status:', delRes.status);
  console.log('Delete body:', await delRes.text());
}
test();

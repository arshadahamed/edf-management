const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // UI State: Loading
        loginBtn.disabled = true;
        const originalBtnContent = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span>Signing in...</span>';
        errorMessage.style.display = 'none';

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Redirect on success
                window.location.href = '/dashboard';
            } else {
                errorMessage.textContent = data.message || 'Login failed. Please try again.';
                errorMessage.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalBtnContent;
                lucide.createIcons(); // Re-render icons after innerHTML change
            }
        } catch (err) {
            console.error('Login error:', err);
            errorMessage.textContent = 'A network error occurred. Please try again later.';
            errorMessage.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnContent;
            lucide.createIcons();
        }
    });
}

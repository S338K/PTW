import '../theme.js';

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signupForm');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Minimal client-side validation
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value.trim();
        if (!email || !password) {
            alert('Please provide email and password');
            return;
        }

        // Call backend signup endpoint
        try {
            const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            if (!res.ok) throw new Error('Signup failed');
            alert('Account created. Redirecting to login...');
            setTimeout(() => { window.location.href = '../login/index.html'; }, 1200);
        } catch (err) {
            console.error(err);
            alert('Failed to create account');
        }
    });
});

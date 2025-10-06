import '../theme.js';

function toggleVisibility(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}

function checkStrength(pw) {
    if (!pw) return 'Too short';
    let score = 0;
    if (pw.length > 7) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return ['Weak', 'Fair', 'Good', 'Strong'][Math.max(0, Math.min(3, score - 1))] || 'Weak';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('resetBtn').addEventListener('click', async () => {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const msg = document.getElementById('message');
        if (!newPassword || newPassword !== confirmPassword) {
            msg.textContent = 'Passwords do not match';
            return;
        }
        // Call backend reset endpoint (token handled server-side)
        const res = await fetch('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) });
        if (res.ok) {
            msg.textContent = 'Password reset. Redirecting to login...';
            setTimeout(() => window.location.href = '/login/', 1500);
        } else {
            msg.textContent = 'Failed to reset password';
        }
    });
});

window.toggleVisibility = toggleVisibility;

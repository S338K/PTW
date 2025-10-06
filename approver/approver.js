import { checkSession, initIdleTimer, logoutUser } from '../session.js';
import { formatLastLogin } from '../date-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkSession();
    if (!user) return window.location.href = '/login/';
    initIdleTimer();
    document.getElementById('userFullName').textContent = user.fullName || user.username || '';
    document.getElementById('approverContent').textContent = 'Welcome ' + (user.fullName || user.username || '');
    document.getElementById('logoutBtn').addEventListener('click', () => logoutUser());
});

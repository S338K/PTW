import { checkSession, initIdleTimer } from '../session.js';
import { formatLastLogin } from '../date-utils.js';

async function loadProfile() {
    await checkSession();
    const res = await fetch('/auth/profile');
    if (!res.ok) return window.location.href = '/login/';
    const data = await res.json();
    const el = document.getElementById('profileDetails');
    const lastLogin = data.lastLogin ? formatLastLogin(new Date(data.lastLogin)) : 'Never';
    el.innerHTML = `
    <p><strong>Name:</strong> ${data.fullName || data.name || ''}</p>
    <p><strong>Email:</strong> ${data.corpEmailId || data.email || ''}</p>
    <p><strong>Role:</strong> ${data.role || ''}</p>
    <p><strong>Last Login:</strong> ${lastLogin}</p>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
    initIdleTimer();
    loadProfile();
});

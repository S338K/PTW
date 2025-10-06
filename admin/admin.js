import { checkSession, initIdleTimer, logoutUser } from '../session.js';
import { formatDate24, formatLastLogin } from '../date-utils.js';

// Small admin page script: session check, load users/permits/stats, basic UI wiring
const API_BASE_META = document.querySelector('meta[name="api-base"]')?.content || '';
const API_BASE = API_BASE_META ? API_BASE_META.replace(/\/$/, '') : '';

function apiUrl(path) {
    if (!path.startsWith('/')) path = '/' + path;
    return API_BASE ? API_BASE + path : path;
}

function showToast(message, timeout = 4000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.style.visibility = 'visible';
    t.style.opacity = '1';
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => (t.style.visibility = 'hidden'), 300);
    }, timeout);
}

function toggleDetails(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    if (btn) btn.textContent = el.style.display === 'block' ? 'Collapse' : 'Expand';
}

window.toggleDetails = toggleDetails; // used by inline onclick in HTML

async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
        const res = await fetch(apiUrl('/admin/users'), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch users');
        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        users.forEach((u) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
				<td>${(u.username || u.fullName || '—')}</td>
				<td>${u.role || '—'}</td>
				<td>${u.status || '—'}</td>
				<td>${formatDate24(u.registered || u.createdAt || null) || '—'}</td>
				<td>${formatLastLogin(u.lastLogin) || '—'}</td>
				<td>
					<button class="btn small" data-id="${u.id}" onclick="viewProfile('${u.id}')">View</button>
					<button class="btn small" data-id="${u.id}" onclick="toggleStatus('${u.id}')">Toggle</button>
				</td>
			`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('loadUsers error', err);
        tbody.innerHTML = '<tr><td colspan="6">Error loading users</td></tr>';
    }
}

async function loadPermits() {
    const tbody = document.querySelector('#permitsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
    try {
        const res = await fetch(apiUrl('/permit'), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch permits');
        const permits = await res.json();
        if (!Array.isArray(permits) || permits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No permits found</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        permits.forEach((p) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
				<td>${p._id || '—'}</td>
				<td>${p.permitTitle || p.title || '—'}</td>
				<td>${p.permitNumber || '—'}</td>
				<td>${formatDate24(p.createdAt || p.startDateTime) || '—'}</td>
				<td>${(p.requester && (p.requester.username || p.requester.fullName)) || '—'}</td>
				<td>${p.status || '—'}</td>
				<td><button class="btn small" onclick="viewPermit('${p._id}')">View</button></td>
			`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('loadPermits error', err);
        tbody.innerHTML = '<tr><td colspan="7">Error loading permits</td></tr>';
    }
}

async function loadStats() {
    try {
        const res = await fetch(apiUrl('/admin/stats'), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const s = await res.json();
        document.getElementById('statUsers').textContent = s.totalUsers ?? '—';
        document.getElementById('statActiveUsers').textContent = s.activeUsers ?? '—';
        document.getElementById('statInactiveUsers').textContent = s.inactiveUsers ?? '—';
        document.getElementById('statPermits').textContent = s.totalPermits ?? s.totalUsers ?? '—';
        document.getElementById('statPending').textContent = s.pending ?? '—';
        document.getElementById('statInProgress').textContent = s.inProgress ?? '—';
        document.getElementById('statApproved').textContent = s.approved ?? '—';
        document.getElementById('statRejected').textContent = s.rejected ?? '—';
    } catch (err) {
        console.error('loadStats error', err);
    }
}

function viewProfile(id) {
    if (!id) return;
    // Frontend profile page
    window.location.href = '../profile/profile.html?id=' + encodeURIComponent(id);
}

function viewPermit(id) {
    if (!id) return;
    window.location.href = '../permit/permit.html?id=' + encodeURIComponent(id);
}

async function toggleStatus(id) {
    if (!id) return;
    try {
        const res = await fetch(apiUrl('/admin/toggle-status/' + id), {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to toggle');
        const data = await res.json();
        showToast(data.message || 'Status updated');
        await loadUsers();
    } catch (err) {
        console.error('toggleStatus error', err);
        showToast('Failed to update status');
    }
}

async function registerUser(formData) {
    try {
        const body = Object.fromEntries(formData.entries());
        const res = await fetch(apiUrl('/admin/register-user'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Register failed');
        showToast('User registered');
        document.getElementById('userModal')?.classList.remove('open');
        await loadUsers();
    } catch (err) {
        console.error('registerUser error', err);
        showToast(err.message || 'Failed to register user');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Ensure session is valid and initialize idle timer
    await checkSession();
    initIdleTimer();

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => {
        document.getElementById('userModal')?.classList.add('open');
    });

    const closeSpan = document.querySelector('#userModal .close');
    if (closeSpan) closeSpan.addEventListener('click', () => document.getElementById('userModal')?.classList.remove('open'));

    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(userForm);
            registerUser(fd);
        });
    }

    // Initial loads
    loadUsers();
    loadPermits();
    loadStats();
});

export { loadUsers, loadPermits, loadStats };

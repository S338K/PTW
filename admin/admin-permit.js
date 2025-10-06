import { API_BASE } from '../config.js';
import { checkSession, initIdleTimer, logoutUser } from '../session.js';
import { formatDate24 } from '../date-utils.js';

function getPermitId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function renderKV(container, label, value) {
    const l = document.createElement('div'); l.className = 'label'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'value'; v.textContent = value ?? '—';
    container.appendChild(l); container.appendChild(v);
}

async function loadPermit() {
    const id = getPermitId();
    const box = document.getElementById('permitContainer');
    if (!id || !box) return;
    box.innerHTML = '';
    try {
        const res = await fetch(`${API_BASE}/api/permit/${encodeURIComponent(id)}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load permit');
        const p = await res.json();
        renderKV(box, 'Permit Title', p.permitTitle);
        renderKV(box, 'Permit Number', p.permitNumber || 'Not generated');
        renderKV(box, 'Status', p.status);
        renderKV(box, 'Submitted', formatDate24(p.createdAt));
        renderKV(box, 'Requester', `${p.fullName || ''} ${p.lastName || ''}`.trim());
        renderKV(box, 'Contact', p.contactDetails);
        renderKV(box, 'Designation', p.designation);
        renderKV(box, 'Start', p.startDateTime ? formatDate24(p.startDateTime) : '—');
        renderKV(box, 'End', p.endDateTime ? formatDate24(p.endDateTime) : '—');
    } catch (err) {
        box.textContent = 'Error loading permit details';
    }
}

async function downloadPdf() {
    const id = getPermitId();
    if (!id) return;
    try {
        const res = await fetch(`${API_BASE}/api/permit/${encodeURIComponent(id)}/pdf`, { credentials: 'include' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.message || 'Failed to generate PDF');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `permit-${id}.pdf`; a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Error generating/downloading PDF');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkSession();
    if (!user) return;
    initIdleTimer();

    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => window.location.href = 'admin.html');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logoutUser());

    const dlBtn = document.getElementById('downloadPdfBtn');
    if (dlBtn) dlBtn.addEventListener('click', downloadPdf);

    await loadPermit();
});

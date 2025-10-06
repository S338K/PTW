import { initIdleTimer, checkSession } from '../session.js';
import { formatLastLogin, formatDate24 } from '../date-utils.js';

async function fetchPending() {
    await checkSession();
    const res = await fetch('/permits/pending');
    if (!res.ok) return console.error('Failed to load pending permits');
    const data = await res.json();
    const tbody = document.querySelector('#preApproverPermitTable tbody');
    tbody.innerHTML = '';
    data.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${formatDate24(new Date(p.createdAt))}</td>
      <td>${p.permitTitle || ''}</td>
      <td>${p.requesterName || p.fullName || ''}</td>
      <td>${p.status || ''}</td>
      <td><button data-id="${p._id}" class="viewBtn">View</button></td>
    `;
        tbody.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initIdleTimer();
    fetchPending();
});

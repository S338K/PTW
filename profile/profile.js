import { checkSession, initIdleTimer, logoutUser } from "../session.js";
import { formatDate24, formatLastLogin } from "../date-utils.js";
import { API_BASE } from '../config.js';

document.addEventListener('DOMContentLoaded', async function () {
  console.log("✅ profile.js loaded");

  const user = await checkSession();
  if (!user) return;
  initIdleTimer();

  /* ===== Populate Profile Card ===== */
  const fullNameEl = document.getElementById("profileFullName");
  if (fullNameEl) fullNameEl.textContent = user.fullName || user.username || "—";

  const emailEl = document.getElementById("profileEmail");
  if (emailEl) emailEl.textContent = user.email || "—";

  const companyEl = document.getElementById("profileCompany");
  if (companyEl) companyEl.textContent = user.company || "—";

  /* ===== Welcome + Last Login ===== */
  const lastLoginDiv = document.getElementById('profileLastLogin');
  if (lastLoginDiv) {
    const welcomeName = user.fullName || user.username || "User";

    // 24-hour formatter
    function formatDate24(d) {
      if (!d) return "";
      const date = (d instanceof Date) ? d : new Date(d);
      const fmtOptions = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      return date.toLocaleString(undefined, fmtOptions);
    }

    let message;
    if (user.prevLogin) {
      message = `Welcome: ${welcomeName} || Last login at ${formatLastLogin(user.prevLogin)}`;
    } else if (user.lastLogin) {
      message = `Welcome: ${welcomeName} || Last login at ${formatLastLogin(user.lastLogin)}`;
    } else {
      message = `Welcome: ${welcomeName} || First time login`;
    }

    lastLoginDiv.textContent = message;
  }

  /* ===== Load Submitted Permit Details table ===== */
  if (document.getElementById('permitTable')) {
    try {
      const res = await fetch(`${API_BASE}/api/permit`, { credentials: 'include' });
      if (res.ok) {
        const permits = await res.json();
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        permits.forEach((permit, index) => {
          const row = document.createElement('tr');

          // Serial number
          const serialTd = document.createElement('td');
          serialTd.textContent = index + 1;

          // Submitted date/time
          const submittedTd = document.createElement('td');
          submittedTd.textContent = formatDate24(permit.createdAt);

          // Permit title
          const titleTd = document.createElement('td');
          titleTd.textContent = permit.permitTitle || '—';

          // Status with badge
          const statusTd = document.createElement('td');
          const badge = document.createElement('span');
          badge.textContent = permit.status || 'Pending';
          badge.classList.add('status-badge', (permit.status || 'pending').toLowerCase());
          statusTd.appendChild(badge);

          // Permit number (download link if approved)
          const numberTd = document.createElement('td');
          if (permit.status === 'Approved' && permit.permitNumber) {
            const link = document.createElement('a');
            link.href = `${API_BASE}/api/permit/${permit._id}/pdf`;
            link.textContent = permit.permitNumber;
            link.title = "Click to download";

            link.addEventListener('click', (e) => {
              handlePermitClick(e, permit._id, permit.permitNumber);
            });

            numberTd.appendChild(link);
          } else {
            numberTd.textContent = '—';
          }

          row.appendChild(serialTd);
          row.appendChild(submittedTd);
          row.appendChild(titleTd);
          row.appendChild(statusTd);
          row.appendChild(numberTd);

          tbody.appendChild(row);
        });

      } else {
        console.warn('Failed to load permits');
      }
    } catch (err) {
      console.warn('Error fetching permits:', err);
    }
  }

  //===============PDF Download============//
  async function handlePermitClick(e, permitId, permitNumber) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
      return;
    }
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/api/permit/${permitId}/pdf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) {
        let message = 'Failed to download PDF';
        try {
          const data = await res.json();
          if (data.message) message = data.message;
        } catch (_) { }
        alert(message);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${permitNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Error downloading PDF');
    }
  }

  /* ===== Redirect to mainpage.html ===== */
  const submitPtw = document.getElementById('sbmtptw');
  if (submitPtw) {
    submitPtw.addEventListener('click', function () {
      window.location.href = 'mainpage.html';
    });
  }

  // ===== Logout button =====
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logoutUser();
    });
  }

  // ===== Session overlay =====
  (function createSessionOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.bottom = '10px';
    overlay.style.right = '10px';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.color = '#fff';
    overlay.style.padding = '10px 14px';
    overlay.style.borderRadius = '8px';
    overlay.style.fontSize = '14px';
    overlay.style.zIndex = '9999';
    overlay.style.fontFamily = 'monospace';
    overlay.textContent = '🔍 Checking session...';
    document.body.appendChild(overlay);

    async function updateOverlay() {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          overlay.textContent = `🟢 Session Active\nUser: ${data.user.username || data.user.email}`;
        } else {
          overlay.textContent = '🔴 Session Expired';
        }
      } catch (err) {
        overlay.textContent = '⚠️ Network Error';
      }
    }

    updateOverlay();
  })();

});

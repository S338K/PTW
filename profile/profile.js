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
    // Pattern: Welcome: Full Name || Last Login: Today at HH:MM:SS
    // Use formatLastLogin utility to render time; ensure wording matches pattern
    let lastLoginText;
    if (user.prevLogin) {
      lastLoginText = formatLastLogin(user.prevLogin);
    } else if (user.lastLogin) {
      lastLoginText = formatLastLogin(user.lastLogin);
    } else {
      lastLoginText = 'First time login';
    }
    lastLoginDiv.textContent = `Welcome: ${welcomeName} || Last Login: ${lastLoginText}`;
  }

  /* ===== Load Submitted Permit Details table ===== */
  if (document.getElementById('permitTable')) {
    try {
      const res = await fetch(`${API_BASE}/api/permit`, { credentials: 'include' });
      if (res.ok) {
        const permits = await res.json();
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        let stats = { Approved: 0, Pending: 0, Rejected: 0 };
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
            numberTd.textContent = 'Permit no not yet generated';
          }

          row.appendChild(serialTd);
          row.appendChild(submittedTd);
          row.appendChild(titleTd);
          row.appendChild(statusTd);
          row.appendChild(numberTd);

          tbody.appendChild(row);

          // accumulate stats by status (case-insensitive)
          const st = (permit.status || 'Pending');
          if (stats[st] === undefined) stats[st] = 0;
          stats[st]++;
        });

        // Render Chart.js summary in Card 1
        const ctx = document.getElementById('profileStatsChart');
        if (ctx && window.Chart) {
          const labels = Object.keys(stats);
          const data = labels.map(k => stats[k]);
          // destroy previous chart if any
          if (ctx._chartInstance) {
            ctx._chartInstance.destroy();
          }
          const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data,
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d'],
                borderWidth: 0,
              }]
            },
            options: {
              plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12 } },
                tooltip: { enabled: true }
              },
              cutout: '58%',
              animation: { duration: 500 }
            }
          });
          ctx._chartInstance = chart;
        }

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
      window.location.href = '../mainpage/mainpage.html';
    });
  }

  // ===== Logout button =====
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logoutUser();
    });
  }

  // removed old session overlay (replaced by idle warning modal in session.js)

});

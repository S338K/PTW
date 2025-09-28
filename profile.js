document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';


  /* ===== SESSION CHECK ===== */
  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { credentials: 'include' }); // 🔹 include session cookie
      if (!res.ok) {
        window.location.href = 'index.html'; // redirect if session expired
        return null;
      }
      const data = await res.json();
      return data.user; // logged-in user info
    } catch (err) {
      console.error('Session check failed:', err);
      window.location.href = 'index.html';
      return null;
    }
  }

  const user = await checkSession();
  if (!user) return; // stop execution if not logged in

  // 🔹 Retrieve previous login from sessionStorage
  const prevLoginISO = sessionStorage.getItem('previousLogin') || '';

  // 🔹 Helper to format last login
  function formatLastLogin(dateString) {
    if (!dateString) return 'First login';

    const date = new Date(dateString);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // 🔹 Update the single div with both Welcome + Last Login
  const lastLoginDiv = document.getElementById('profileLastLogin');
  if (lastLoginDiv) {
    lastLoginDiv.textContent = `Welcome : ${user.username} | Last login: ${formatLastLogin(prevLoginISO)}`;
  }


  /* ===== IDLE TIMEOUT SETUP ===== */
  const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes
  let idleTimer;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(logoutUser, IDLE_LIMIT);
  }

  async function logoutUser() {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      alert('Session expired, please login again');
      window.location.href = 'index.html';
    });
  }

  ['mousemove', 'keydown', 'click'].forEach(evt => document.addEventListener(evt, resetIdleTimer));
  resetIdleTimer(); // start timer

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
          submittedTd.textContent = new Date(permit.createdAt).toLocaleString();

          // Permit title (work description)
          const titleTd = document.createElement('td');
          titleTd.textContent = permit.workDescription || '—';

          // Status with badge
          const statusTd = document.createElement('td');
          const badge = document.createElement('span');
          badge.textContent = permit.status || 'Pending';
          badge.classList.add('status-badge', (permit.status || 'pending').toLowerCase());
          statusTd.appendChild(badge);

          // Permit number (clickable if approved)
          const numberTd = document.createElement('td');
          if (permit.status === 'Approved' && permit.permitNumber) {
            const link = document.createElement('a');
            link.href = `${API_BASE}/api/permit/${permit._id}/pdf`;
            link.textContent = permit.permitNumber;
            link.target = '_blank';
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

  /* ===== Redirect to mainpage.html ===== */
  const submitPtw = document.getElementById('sbmtptw');
  if (submitPtw) {
    submitPtw.addEventListener('click', function () {
      window.location.href = 'mainpage.html';
    });
  }

  /* ===== Logout Button ===== */
  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) {
    logoutButton.addEventListener('click', async function () {
      await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = 'index.html';
    });
  }

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
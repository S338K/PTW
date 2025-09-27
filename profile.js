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
      const res = await fetch(`${API_BASE}/api/permits`, { credentials: 'include' });
      if (res.ok) {
        const permits = await res.json();
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        permits.forEach((permit, index) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${new Date(permit.submittedAt).toLocaleString()}</td>
            <td>${permit.permitNumber}</td>
            <td>${permit.title}</td>
            <td><span class="status ${permit.status.toLowerCase().replace(/\s+/g, '')}">${permit.status}</span></td>
          `;
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
document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  /* ===== FORMATTER FOR LAST LOGIN ===== */
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

  /* ===== INITIAL PROFILE LOAD (MERGED SESSION CHECK) ===== */
  async function initProfile() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { credentials: 'include' });
      if (!res.ok) throw new Error('Unauthorized');

      const data = await res.json();
      const user = data.user;

      const fullName = user.fullName || user.username || user.email;
      const lastLoginText = formatLastLogin(user.lastLogin);

      document.getElementById('profileInfo').textContent =
        `Welcome : ${fullName} | Last Login : ${lastLoginText}`;

      return user;
    } catch (err) {
      console.error('Profile/session check failed:', err);
      window.location.href = 'index.html';
      return null;
    }
  }

  const user = await initProfile();
  if (!user) return; // stop if not logged in

  /* ===== IDLE TIMEOUT ===== */
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

  ['mousemove', 'keydown', 'click'].forEach(evt =>
    document.addEventListener(evt, resetIdleTimer)
  );
  resetIdleTimer();

  /* ===== PERMITS TABLE ===== */
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
            <td><span class="status ${permit.status.toLowerCase().replace(/\s+/g, '')}">
              ${permit.status}
            </span></td>
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

  /* ===== Session Overlay (Debug) ===== */
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

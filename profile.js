document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';
  const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

  // ====== BACKEND SESSION CHECK ======
  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!res.ok) {
        window.location.href = 'index.html';
        return null;
      }
      const data = await res.json();

      if (data.user) {
        localStorage.setItem('fullName', data.user.username || '');
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('company', data.user.company || '');
        localStorage.setItem('lastLogin', new Date(data.user.lastLogin).toLocaleString() || '');
      }

      resetIdleTimer(); // reset timer after session check
      return data.user;
    } catch (err) {
      console.warn('Session check failed:', err);
      window.location.href = 'index.html';
      return null;
    }
  }

  await checkSession();

  // ====== LOGOUT FUNCTION ======
  function logoutUser() {
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('company');
    localStorage.removeItem('lastLogin');
    localStorage.removeItem('lastActivity');

    fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => window.location.href = 'index.html');
  }

  // ====== MULTI-TAB IDLE TIMER ======
  function resetIdleTimer() {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
  }

  function checkIdleTime() {
    const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    if (!last || Date.now() - last > IDLE_LIMIT_MS) {
      logoutUser();
    }
  }

  // Listen to user activity
  ['click','mousemove','keypress','scroll','focus','touchstart','touchmove']
    .forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));

  // Listen for activity in other tabs
  window.addEventListener('storage', e => {
    if (e.key === 'lastActivity') {
      console.log('Activity detected in another tab');
    }
  });

  // Run idle check every 05 minutes
  setInterval(checkIdleTime, 5 * 60 * 1000);
  resetIdleTimer();

  // ====== KEEP SESSION ALIVE (PING) ======
  setInterval(() => {
    fetch(`${API_BASE}/api/ping`, { method: "GET", credentials: "include" })
      .then(res => res.ok ? res.json() : Promise.reject('Ping failed'))
      .then(data => console.log("Ping:", data))
      .catch(err => console.warn("Ping request error:", err));
  }, 5 * 60 * 1000); // every 5 minutes

  // ====== SHOW PROFILE DETAILS ======
  document.getElementById('profileWelcome').textContent = `Welcome : ${localStorage.getItem('fullName') || '-'}`;
  document.getElementById('profileFullName').textContent = localStorage.getItem('fullName') || '-';
  document.getElementById('profileEmail').textContent = localStorage.getItem('email') || '-';
  document.getElementById('profileCompany').textContent = localStorage.getItem('company') || '-';
  document.getElementById('profileLastLogin').textContent = `Last login: ${localStorage.getItem('lastLogin') || '-'}`;

  // ====== GO TO MAINPAGE BUTTON ======
  const submitPTWBtn = document.getElementById('sbmtptw');
  if (submitPTWBtn) {
    submitPTWBtn.addEventListener('click', e => {
      e.preventDefault(); // prevent form submission if inside a form
      window.location.href = 'mainpage.html';
    });
  }

  // ====== LOGOUT BUTTON ======
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }

  // ====== VISUAL IDLE COUNTDOWN (optional) ======
  const idleCountdownEl = document.getElementById('idleCountdown');
  function updateIdleCountdown() {
    const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    const remaining = Math.max(0, IDLE_LIMIT_MS - (Date.now() - last));
    const minutes = String(Math.floor(remaining / 60000)).padStart(2, '0');
    const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
    if (idleCountdownEl) {
      idleCountdownEl.textContent = `Idle time remaining: ${minutes}:${seconds}`;
    }
  }
  setInterval(updateIdleCountdown, 1000);
  updateIdleCountdown();
});
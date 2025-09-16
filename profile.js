document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';

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

      resetIdleTimer(); // 🔹 reset timer after session check
      return data.user;
    } catch (err) {
      console.warn('Session check failed:', err);
      window.location.href = 'index.html';
      return null;
    }
  }

  await checkSession();

  // ====== IDLE TIMEOUT (15 MINUTES) ======
  function logoutUser() {
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('company');
    localStorage.removeItem('lastLogin');
    sessionStorage.removeItem('lastActivity');

    fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => window.location.href = 'index.html');
  }

  function resetIdleTimer() {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  }

  function checkIdleTime() {
    const last = parseInt(sessionStorage.getItem('lastActivity') || '0', 10);
    if (!last || Date.now() - last > 15 * 60 * 1000) { // 15 min
      logoutUser();
    }
  }

  // Reset idle timer on user interaction
  ['click','mousemove','keypress','scroll','focus','touchstart','touchmove']
    .forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));

  setInterval(checkIdleTime, 30000); // check every 30 sec
  resetIdleTimer(); // 🔹 reset immediately on page load

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
      e.preventDefault(); // 🔹 prevent default form submission
      window.location.href = 'mainpage.html';
    });
  }

  // ====== LOGOUT BUTTON ======
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }
});
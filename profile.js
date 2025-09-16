document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';
  const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  const LOGIN_TTL_MS = 60 * 60 * 1000; // 60 minutes TTL

  function resetIdleTimer() {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
  }

  // Initialize lastActivity and loginTime if missing
  if (!localStorage.getItem('lastActivity')) resetIdleTimer();
  if (!localStorage.getItem('loginTime')) localStorage.setItem('loginTime', Date.now().toString());

  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!res.ok) {
        logoutUser(); // centralized logout
        return null;
      }
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('fullName', data.user.username || '');
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('company', data.user.company || '');
        localStorage.setItem('lastLogin', new Date(data.user.lastLogin).toLocaleString() || '');
        localStorage.setItem('loginTime', Date.now().toString()); // store login timestamp
      }
      resetIdleTimer();
      return data.user;
    } catch (err) {
      console.warn('Session check failed:', err);
      logoutUser();
      return null;
    }
  }

  await checkSession();

  function logoutUser() {
    ['fullName','email','company','lastLogin','lastActivity','loginTime'].forEach(k => localStorage.removeItem(k));
    fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => window.location.href = 'index.html');
  }

  function checkIdleTime() {
    const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    const loginTime = parseInt(localStorage.getItem('loginTime') || '0', 10);

    if (!last || Date.now() - last > IDLE_LIMIT_MS) logoutUser();
    if (!loginTime || Date.now() - loginTime > LOGIN_TTL_MS) logoutUser();
  }

  ['click','mousemove','keypress','scroll','focus','touchstart','touchmove']
    .forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));

  window.addEventListener('storage', e => {
    if (e.key === 'lastActivity') resetIdleTimer();
  });

  setInterval(checkIdleTime, 60 * 1000); // check every 1 minute
});
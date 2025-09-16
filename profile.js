document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';
  const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Skip session management on login/signup pages
  if (window.location.pathname.includes('index.html') || window.location.pathname.includes('signup.html')) {
    return;
  }

  function resetIdleTimer() {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
  }

  function logoutUser() {
    ['fullName','email','company','lastActivity'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('logoutEvent', Date.now()); // notify other tabs
    fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
      .finally(() => window.location.href = 'index.html');
  }

  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'GET',
        credentials: 'include'
      });
      if (!res.ok) {
        logoutUser();
        return null;
      }
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('fullName', data.user.username || '');
        localStorage.setItem('email', data.user.email || '');
        localStorage.setItem('company', data.user.company || '');
        localStorage.setItem('lastLogin', new Date(data.user.lastLogin).toLocaleString() || '');
      }
      resetIdleTimer();
      return data.user;
    } catch (err) {
      console.warn('Session check failed:', err);
      logoutUser();
      return null;
    }
  }

  async function pingBackend() {
    try {
      await fetch(`${API_BASE}/api/ping`, { method: 'GET', credentials: 'include' });
    } catch (err) {
      console.warn('Ping failed:', err);
    }
  }

  function checkIdleTime() {
    const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
    if (!last || Date.now() - last > IDLE_LIMIT_MS) logoutUser();
  }

  // Activity listeners
  ['click','mousemove','keypress','scroll','focus','touchstart','touchmove']
    .forEach(evt => document.addEventListener(evt, resetIdleTimer, { passive: true }));

  // Multi-tab sync
  window.addEventListener('storage', e => {
    if (e.key === 'lastActivity') resetIdleTimer();
    if (e.key === 'logoutEvent') logoutUser();
  });

  // Initial session check
  await checkSession();

  // Periodic idle and ping checks
  setInterval(() => {
    checkIdleTime();
    pingBackend();
  }, PING_INTERVAL_MS);
});
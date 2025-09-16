document.addEventListener('DOMContentLoaded', async function () {
  // ====== BACKEND SESSION CHECK ======
  try {
    const res = await fetch('http://localhost:5000/api/profile', {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) {
      window.location.href = 'index.html';
      return;
    }
  } catch (err) {
    console.warn('Session check failed:', err);
    window.location.href = 'index.html';
    return;
  }

  // ====== IDLE TIMEOUT (5 MINUTES) ======
  function logoutUser() {
    // Clear only auth-related keys
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('company');
    localStorage.removeItem('lastLogin');
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('lastActivity');

    fetch('http://localhost:5000/api/logout', {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      window.location.href = 'index.html';
    });
  }

  function resetIdleTimer() {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  }

  function checkIdleTime() {
    const last = parseInt(sessionStorage.getItem('lastActivity') || '0', 10);
    if (!last || Date.now() - last > 5 * 60 * 1000) { // 5 minutes
      logoutUser();
    }
  }

  ['click', 'mousemove', 'keypress', 'scroll', 'touchstart', 'touchmove'].forEach(evt =>
    document.addEventListener(evt, resetIdleTimer, { passive: true })
  );
  setInterval(checkIdleTime, 30000);
  resetIdleTimer();

  // ====== SHOW WELCOME MESSAGE & PROFILE DETAILS ======
  const fullName = localStorage.getItem('fullName');
  const email = localStorage.getItem('email');
  const company = localStorage.getItem('company');
  const profileWelcomeEl = document.getElementById('profileWelcome');

  if (fullName && profileWelcomeEl) {
    profileWelcomeEl.textContent = `Welcome : ${fullName}`;
  } else {
    window.location.href = 'index.html';
    return;
  }

  const profileFullNameEl = document.getElementById('profileFullName');
  const profileEmailEl = document.getElementById('profileEmail');
  const profileCompanyEl = document.getElementById('profileCompany');

  if (profileFullNameEl) profileFullNameEl.textContent = fullName || '-';
  if (profileEmailEl) profileEmailEl.textContent = email || '-';
  if (profileCompanyEl) profileCompanyEl.textContent = company || '-';

  // ====== LAST LOGIN ======
  const lastLoginEl = document.getElementById('profileLastLogin');
  let lastLogin = localStorage.getItem('lastLogin');

  try {
    const res = await fetch('http://localhost:5000/api/profile', {
      method: 'GET',
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user?.lastLogin) {
        lastLogin = new Date(data.user.lastLogin).toLocaleString();
        localStorage.setItem('lastLogin', lastLogin);
      }
    }
  } catch (err) {
    console.warn('Unable to fetch last login:', err);
  }

  if (lastLoginEl) {
    lastLoginEl.textContent = `Last login: ${lastLogin || '-'}`;
  }

  // ====== GO TO MAIN PAGE BUTTON ======
  const submitPTWBtn = document.getElementById('sbmtptw');
  if (submitPTWBtn) {
    submitPTWBtn.addEventListener('click', () => {
      window.location.href = 'mainpage.html';
    });
  }

  // ====== LOGOUT BUTTON ======
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }
});
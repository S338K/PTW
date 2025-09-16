document.addEventListener('DOMContentLoaded', async function () {
  // ====== BACKEND SESSION CHECK ======
  try {
    const res = await fetch('https://ptw-yu8u.onrender.com/api/profile', {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) {
      window.location.href = 'index.html';
      return;
    }
    const data = await res.json();

    // Set user details from backend
    if (data.user) {
      localStorage.setItem('fullName', data.user.username || '');
      localStorage.setItem('email', data.user.email || '');
      localStorage.setItem('company', data.user.company || '');
      localStorage.setItem('lastLogin', new Date(data.user.lastLogin).toLocaleString() || '');
    }
  } catch (err) {
    console.warn('Session check failed:', err);
    window.location.href = 'index.html';
    return;
  }

  // ====== IDLE TIMEOUT (5 MINUTES) ======
  function logoutUser() {
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');
    localStorage.removeItem('company');
    localStorage.removeItem('lastLogin');
    sessionStorage.removeItem('lastActivity');

    fetch('https://ptw-yu8u.onrender.com/api/logout', {
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

  // Reset idle timer on any user interaction
  ['click', 'mousemove', 'keypress', 'scroll', 'touchstart', 'touchmove'].forEach(evt =>
    document.addEventListener(evt, resetIdleTimer, { passive: true })
  );
  setInterval(checkIdleTime, 30000); // check every 30 seconds
  resetIdleTimer();

  // ====== KEEP SESSION ALIVE ======
  setInterval(() => {
    fetch("https://ptw-yu8u.onrender.com/api/ping", {
      method: "GET",
      credentials: "include"
    }).catch(err => console.log("Ping failed:", err));
  }, 2 * 60 * 1000); // every 2 minutes

  // ====== SHOW PROFILE DETAILS ======
  document.getElementById('profileWelcome').textContent = `Welcome : ${localStorage.getItem('fullName') || '-'}`;
  document.getElementById('profileFullName').textContent = localStorage.getItem('fullName') || '-';
  document.getElementById('profileEmail').textContent = localStorage.getItem('email') || '-';
  document.getElementById('profileCompany').textContent = localStorage.getItem('company') || '-';
  document.getElementById('profileLastLogin').textContent = `Last login: ${localStorage.getItem('lastLogin') || '-'}`;

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
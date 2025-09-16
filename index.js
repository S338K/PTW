document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');
  const headerContainer = document.querySelector('.header-container'); // FIXED: it's a class
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  /* ===== HEADER: Live Date/Time ===== */
  function updateDateTime() {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const time = now.toLocaleTimeString('en-US', { hour12: true });

    if (dateTimeEl) {
      dateTimeEl.textContent = `${month} ${day}, ${year} | ${time}`;
    } else if (headerContainer) {
      const el = headerContainer.querySelector('#dateTimeDisplay');
      if (el) el.textContent = `${month} ${day}, ${year} | ${time}`;
    }
  }

  if (dateTimeEl || headerContainer) {
    updateDateTime();
    setInterval(updateDateTime, 1000);
  }

  /* ===== HEADER: Weather Fetch ===== */
  async function fetchWeather() {
    const targetEl = weatherEl || headerContainer?.querySelector('#tempDisplay');
    if (!targetEl) return;

    const city = 'Doha';
    try {
      const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        targetEl.textContent = 'Weather unavailable';
        return;
      }
      const data = await res.json();
      targetEl.textContent = data.formatted || 'Weather unavailable';
    } catch (err) {
      console.error('Weather fetch failed:', err);
      targetEl.textContent = 'Weather fetch failed';
    }
  }
  fetchWeather();

  /* ===== LOGIN FUNCTIONALITY ===== */
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();

      if (!email || !password) {
        alert('Please enter email and password.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || 'Login failed');
          return;
        }

        // ===== STORE SESSION + USER DETAILS =====
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('lastActivity', Date.now().toString());
        if (data.user) {
          localStorage.setItem('fullName', data.user.username || '');
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('company', data.user.company || '');
          localStorage.setItem('lastLogin', data.user.lastLogin || '');
        }

        // Redirect to profile
        window.location.href = 'profile.html';
      } catch (err) {
        console.error('Network error during login:', err);
        alert('Network error. Please try again.');
      }
    });
  }
});
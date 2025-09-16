document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');
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
    }
  }
  if (dateTimeEl) {
    updateDateTime();
    setInterval(updateDateTime, 1000);
  }

  /* ===== HEADER: Weather Fetch ===== */
  async function fetchWeather() {
    if (!weatherEl) return;
    const city = 'Doha';
    try {
      const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        weatherEl.textContent = 'Weather unavailable';
        return;
      }
      const data = await res.json();
      weatherEl.textContent = data.formatted || 'Weather unavailable';
      setDynamicBackground(data.formatted);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      weatherEl.textContent = 'Weather fetch failed';
    }
  }
  fetchWeather();

  /* ===== HEADER: Dynamic Background ===== */
  function setDynamicBackground(weatherString) {
    if (!weatherString) return;
    const lower = weatherString.toLowerCase();
    let bgUrl = '';

    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;

    if (lower.includes('clear')) {
      bgUrl = isDay
        ? 'url(https://images.unsplash.com/photo-1501973801540-537f08ccae7b)'
        : 'url(https://images.unsplash.com/photo-1502082553048-f009c37129b9)';
    } else if (lower.includes('cloud')) {
      bgUrl = 'url(https://images.unsplash.com/photo-1506744038136-46273834b3fb)';
    } else if (lower.includes('rain')) {
      bgUrl = 'url(https://images.unsplash.com/photo-1501594907352-04cda38ebc29)';
    } else {
      bgUrl = 'url(https://images.unsplash.com/photo-1503264116251-35a269479413)';
    }

    document.body.style.backgroundImage = bgUrl;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.transition = 'background-image 1s ease-in-out';
  }

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
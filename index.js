document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');

  // API base URL: local vs deploy
  const API_BASE = location.hostname.includes('localhost')
    ? 'http://localhost:5000'
    : 'https://ptw-yu8u.onrender.com';

  // ====== HEADER: Live Date/Time ======
  function updateDateTime() {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const time = now.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    if (dateTimeEl) {
      dateTimeEl.textContent = `${month}, ${day}, ${year} | ${time}`;
    }
  }
  if (dateTimeEl) {
    updateDateTime();
    setInterval(updateDateTime, 1000);
  }

  // ====== HEADER: Weather Fetch ======
  async function fetchWeather() {
    if (!weatherEl) return;
    const city = 'Doha';
    try {
      const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        weatherEl.textContent = 'Weather data unavailable';
        return;
      }
      const data = await res.json();
      weatherEl.textContent = data.formatted || 'Weather data unavailable';
    } catch (err) {
      console.error('Weather fetch failed:', err);
      weatherEl.textContent = 'Weather fetch failed';
    }
  }
  fetchWeather();

  // ====== LOGIN FORM HANDLING ======
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
    console.log('Sending payload:', { email, password });

    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Login failed');
      return;
    }

    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('fullName', data.user?.username || '');

    window.location.href = 'profile.html';
  } catch (err) {
    console.error('Network error during login:', err);
    alert('Network error. Please try again.');
  }
});

  }
});

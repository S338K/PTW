document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');

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
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // ====== HEADER: Weather Fetch ======
  async function fetchWeather() {
  const weatherEl = document.getElementById('tempDisplay');
  const city = 'Doha';

  try {
    const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`, {
      credentials: 'include'
    });

    if (!res.ok) {
      console.error(`Weather API error: ${res.status} ${res.statusText}`);
      if (weatherEl) weatherEl.textContent = 'Weather data unavailable';
      return;
    }

    const data = await res.json();
    if (data.formatted) {
      if (weatherEl) weatherEl.textContent = data.formatted;
    } else {
      if (weatherEl) weatherEl.textContent = 'Weather data unavailable';
    }
  } catch (err) {
    console.error('Weather fetch error:', err);
    if (weatherEl) weatherEl.textContent = 'Weather fetch failed';
  }
}

fetchWeather();

  // ====== LOGIN FORM HANDLING ======
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      console.log(data);

      if (res.ok) {
        if (data.user) {
          localStorage.setItem('fullName', data.user.username);
          localStorage.setItem('email', data.user.email);
          localStorage.setItem('company', data.user.company || '');
          localStorage.setItem('lastLogin', data.user.lastLogin
            ? new Date(data.user.lastLogin).toLocaleString()
            : new Date().toLocaleString()
          );
        }
        alert('Login successful!');
        window.location.href = 'profile.html';
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Something went wrong. Please try again.');
    }
  });
});

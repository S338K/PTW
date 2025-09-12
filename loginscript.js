document.addEventListener('DOMContentLoaded', function () {
  // ====== HEADER: Live Date/Time ======
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');

function updateDateTime() {
  const now = new Date();

  // Full month name
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();

  // Time with seconds in 12-hour format
  const time = now.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Final format: September, 12, 2025 | 07:15:25 AM
  const formatted = `${month}, ${day}, ${year} | ${time}`;

  const dateTimeEl = document.getElementById('dateTimeDisplay');
  if (dateTimeEl) {
    dateTimeEl.textContent = formatted;
  }
}

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // ====== HEADER: Weather Fetch ======
  async function fetchWeather() {
    try {
      const city = 'Doha'; // Default city
      const res = await fetch(`http://localhost:5000/api/weather?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (res.ok && data.formatted) {
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
      const res = await fetch('http://localhost:5000/api/login', {
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

      // ✅ Save user info in localStorage
      if (data.user) {
        localStorage.setItem('fullName', data.user.username);
        localStorage.setItem('email', data.user.email);
        localStorage.setItem('company', data.user.company || '');

        // ✅ First-time vs Repeat login handling
        if (data.user.lastLogin) {
          // Repeat user → pichla login time show hoga
          localStorage.setItem('lastLogin', new Date(data.user.lastLogin).toLocaleString());
        } else {
          // First-time user → abhi ka time show hoga
          const now = new Date().toLocaleString();
          localStorage.setItem('lastLogin', now);
        }
      }

      alert(data.message || 'Login successful!');
      window.location.href = 'profile.html';
    } catch (err) {
      console.error('Login error:', err);
      alert('Something went wrong. Please try again.');
    }
  });
});

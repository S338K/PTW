document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');
  const headerEl = document.querySelector('.header-container');

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

  // ====== HEADER: Weather Fetch + Background Class ======
  async function fetchWeather() {
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

      // 🔹 Weather condition ke hisaab se header background class lagana
      if (data.condition) {
        const condition = data.condition.toLowerCase();
        headerEl?.classList.remove('sunny', 'cloudy', 'rainy', 'snowy');
        if (condition.includes('cloud')) {
          headerEl?.classList.add('cloudy');
        } else if (condition.includes('rain')) {
          headerEl?.classList.add('rainy');
        } else if (condition.includes('snow')) {
          headerEl?.classList.add('snowy');
        } else {
          headerEl?.classList.add('sunny');
        }
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

          // 🔹 Session variables for guard + idle timer
          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('fullName', data.user.username || email.split('@')[0]);
          sessionStorage.setItem('lastActivity', Date.now().toString());
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

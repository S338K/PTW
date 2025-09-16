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
    const dateStr = `${month} ${day}, ${year}`;
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true });

    if (dateTimeEl) {
      dateTimeEl.innerHTML = `
        <div style="text-align:center; font-weight:bold;">
          ${dateStr} &nbsp;||&nbsp; ${timeStr}
        </div>
      `;
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

      if (data.formatted) {
        weatherEl.innerHTML = `
          <div style="text-align:center; margin-top:5px;">
            <span><img src="${data.icons.temperature}" alt="Temp" style="width:20px;height:20px;vertical-align:middle;"> Temp: ${data.temperature}°C</span> &nbsp;|&nbsp;
            <span><img src="${data.icons.humidity}" alt="Humidity" style="width:20px;height:20px;vertical-align:middle;"> Humidity: ${data.humidity}</span> &nbsp;|&nbsp;
            <span><img src="${data.icons.visibility}" alt="Visibility" style="width:20px;height:20px;vertical-align:middle;"> Visibility: ${data.visibility}</span> &nbsp;|&nbsp;
            <span><img src="${data.icons.windSpeed}" alt="Wind" style="width:20px;height:20px;vertical-align:middle;"> Wind Speed: ${data.windSpeed}</span> &nbsp;|&nbsp;
            <span><img src="${data.icons.airQuality}" alt="Air Quality" style="width:20px;height:20px;vertical-align:middle;"> Air Quality: ${data.airQualityStatus}</span> &nbsp;|&nbsp;
            <span><img src="${data.icons.poNumber}" alt="PO" style="width:20px;height:20px;vertical-align:middle;"> PO Number: ${data.poNumber}</span>
          </div>
        `;
      } else {
        const temp = data.temperature ?? data?.main?.temp;
        const cond = data.condition ?? data?.weather?.[0]?.description;
        if (temp != null && cond) {
          weatherEl.textContent = `${temp}°C | ${cond}`;
        } else {
          weatherEl.textContent = 'Weather unavailable';
        }
      }
    } catch (err) {
      console.error('Weather fetch failed:', err);
      weatherEl.textContent = 'Weather fetch failed';
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

        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('lastActivity', Date.now().toString());
        sessionStorage.setItem('loginTime', Date.now().toString());

        if (data.user) {
          localStorage.setItem('fullName', data.user.username || '');
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('company', data.user.company || '');
          localStorage.setItem('lastLogin', data.user.lastLogin || '');
        }

        window.location.href = 'profile.html';
      } catch (err) {
        console.error('Network error during login:', err);
        alert('Network error. Please try again.');
      }
    });
  }
});
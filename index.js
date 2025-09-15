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
  if (dateTimeEl) {
    updateDateTime();
    setInterval(updateDateTime, 1000);
  }

  // ====== HEADER: Weather Fetch ======
  async function fetchWeather() {
    if (!weatherEl) return; // ✅ Run only if weather element exists
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

      // Optional: background class change if API returns condition
      if (data.condition) {
        const header = document.querySelector('.header-container');
        if (header) {
          header.classList.remove('sunny', 'cloudy', 'rainy', 'snowy');
          const cond = data.condition.toLowerCase();
          if (cond.includes('cloud')) header.classList.add('cloudy');
          else if (cond.includes('rain')) header.classList.add('rainy');
          else if (cond.includes('snow')) header.classList.add('snowy');
          else header.classList.add('sunny');
        }
      }
    } catch {
      weatherEl.textContent = 'Weather fetch failed';
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
      const
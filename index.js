document.addEventListener('DOMContentLoaded', function () {
  const dateTimeEl = document.getElementById('dateTimeDisplay');
  const weatherEl = document.getElementById('tempDisplay');
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  /* ===== HEADER: Live Date/Time ===== */
  function updateDateTime() {
    if (!dateTimeEl) return;
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${month} ${day}, ${year}`;
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true });
    dateTimeEl.textContent = `${dateStr} | ${timeStr}`;
  }

  async function fetchWeather() {
    if (!weatherEl) return;
    const city = 'Doha';
    try {
      const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`);
      if (!res.ok) {
        weatherEl.textContent = 'Weather unavailable';
        return;
      }
      const data = await res.json();
      weatherEl.innerHTML = `${data.detailsLine}`;
    } catch (err) {
      console.error('Weather fetch error:', err);
      weatherEl.textContent = 'Weather fetch failed';
    }
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);
  fetchWeather();
  setInterval(fetchWeather, 600000); // every 10 minutes

  /* ===== LOGIN FUNCTIONALITY ===== */
  const form = document.getElementById('loginForm');
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');

  function showError(inputEl, message) {
    const group = inputEl.closest('.form-group');
    if (!group) return;
    let span = group.querySelector('.error-message');
    if (!span) {
      span = document.createElement('span');
      span.className = 'error-message';
      span.setAttribute('aria-live', 'polite');
      group.appendChild(span);
    }
    span.textContent = message || '';
    if (message) {
      inputEl.classList.add('invalid');
      inputEl.classList.remove('valid');
    } else {
      inputEl.classList.remove('invalid');
      inputEl.classList.add('valid');
    }
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function validatePassword(value) {
    return value.trim().length >= 8;
  }

  function validateField(inputEl) {
    let isValid = true;
    switch (inputEl.id) {
      case 'email':
        isValid = validateEmail(inputEl.value);
        showError(inputEl, isValid ? '' : 'Enter a valid email address 📧.');
        break;
      case 'password':
        isValid = validatePassword(inputEl.value);
        showError(inputEl, isValid ? '' : 'Enter valid password 🔑.');
        break;
    }
    return isValid;
  }

  function validateForm() {
    let valid = true;
    [emailEl, passwordEl].forEach(input => {
      if (!validateField(input)) valid = false;
    });
    return valid;
  }

  [emailEl, passwordEl].forEach(input => {
    input.addEventListener('input', () => validateField(input));
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateForm()) {
        const firstInvalid = form.querySelector('.invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const email = emailEl.value.trim();
      const password = passwordEl.value.trim();

      try {
        const res = await fetch(`${API_BASE}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include' // 🔹 important: include session cookie
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.message && data.message.toLowerCase().includes('email')) {
            showError(emailEl, data.message);
          } else if (data.message && data.message.toLowerCase().includes('password')) {
            showError(passwordEl, data.message);
          } else {
            showError(emailEl, data.message || 'Login failed.');
          }
          return;
        }

        sessionStorage.setItem('previousLogin', data.user.lastLogin || '');


        // 🔹 Session cookie is now set by backend; no manual storage needed

        loginBtn.style.transition = 'background-color 0.4s ease, color 0.4s ease';
        loginBtn.textContent = 'Logged in Successfully';
        loginBtn.style.backgroundColor = '#28a745';
        loginBtn.style.borderColor = '#28a745';
        loginBtn.style.color = '#fff';
        loginBtn.disabled = true;

        loginBtn.animate([
          { boxShadow: '0 0 0 rgba(40, 167, 69, 0.7)' },
          { boxShadow: '0 0 15px rgba(40, 167, 69, 0.9)' },
          { boxShadow: '0 0 0 rgba(40, 167, 69, 0.7)' }
        ], {
          duration: 1200,
          iterations: 3
        });

        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 2000);
      } catch {
        showError(passwordEl, 'Network error. Please try again.');
      }
    });
  }

  /* ===== Forgot Password Link ===== */
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.open(
        'forgot-password.html',
        'ForgotPassword',
        'width=500,height=600,top=100,left=100,resizable=yes,scrollbars=yes'
      );
    });
  }
});
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('signupForm');
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  const usernameEl = document.getElementById('signupName');
  const companyEl = document.getElementById('companyName');
  const emailEl = document.getElementById('signupEmail');
  const passwordEl = document.getElementById('signupPassword');
  const confirmPasswordEl = document.getElementById('signupConfirmPassword');
  const submitBtn = document.getElementById('signupBtn');

  // Create error message spans
  [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl].forEach(input => {
    const span = document.createElement('span');
    span.className = 'error-message';
    span.style.color = 'red';
    span.style.fontSize = '0.85em';
    span.style.display = 'block';
    span.style.marginTop = '4px';
    input.parentNode.appendChild(span);
  });

  const errorEls = document.querySelectorAll('.error-message');

  function validateName(value) {
    return value.trim().length > 0;
  }

  function validateCompany(value) {
    return value.trim().length > 0;
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validatePassword(value) {
    // Same regex as backend
    return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value);
  }

  function validateConfirmPassword(pass, confirm) {
    return pass === confirm && confirm.length > 0;
  }

  function showError(inputEl, message) {
    const span = inputEl.parentNode.querySelector('.error-message');
    span.textContent = message || '';
  }

  function checkAllFields() {
    let valid = true;

    if (!validateName(usernameEl.value)) {
      showError(usernameEl, 'Full name is required.');
      valid = false;
    } else {
      showError(usernameEl, '');
    }

    if (!validateCompany(companyEl.value)) {
      showError(companyEl, 'Company name is required.');
      valid = false;
    } else {
      showError(companyEl, '');
    }

    if (!validateEmail(emailEl.value)) {
      showError(emailEl, 'Enter a valid email address.');
      valid = false;
    } else {
      showError(emailEl, '');
    }

    if (!validatePassword(passwordEl.value)) {
      showError(passwordEl, 'Min 8 chars, 1 letter, 1 number, 1 special char.');
      valid = false;
    } else {
      showError(passwordEl, '');
    }

    if (!validateConfirmPassword(passwordEl.value, confirmPasswordEl.value)) {
      showError(confirmPasswordEl, 'Passwords do not match.');
      valid = false;
    } else {
      showError(confirmPasswordEl, '');
    }

    submitBtn.disabled = !valid;
    return valid;
  }

  // Real-time validation listeners
  [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl].forEach(input => {
    input.addEventListener('input', checkAllFields);
  });

  // Initial disable
  submitBtn.disabled = true;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkAllFields()) return;

      const username = usernameEl.value.trim();
      const company = companyEl.value.trim();
      const email = emailEl.value.trim();
      const password = passwordEl.value.trim();

      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, company, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || 'Sign up failed.');
          return;
        }

        alert('Account created successfully! Please log in.');
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Network error during signup:', err);
        alert('Network error. Please try again.');
      }
    });
  }
});
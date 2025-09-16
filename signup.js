document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('signupForm');
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  const usernameEl = document.getElementById('signupName');
  const companyEl = document.getElementById('companyName');
  const emailEl = document.getElementById('signupEmail');
  const passwordEl = document.getElementById('signupPassword');
  const confirmPasswordEl = document.getElementById('signupConfirmPassword');
  const submitBtn = document.getElementById('signupBtn');

  // Create error spans with ARIA live for accessibility
  [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl].forEach(input => {
    const span = document.createElement('span');
    span.className = 'error-message';
    span.setAttribute('aria-live', 'polite');
    input.parentNode.appendChild(span);
  });

  // Validation rules
  function validateName(value) {
    return /^[A-Za-z\s]{2,25}$/.test(value.trim());
  }
  function validateCompany(value) {
    return /^[A-Za-z0-9\s]{2,25}$/.test(value.trim());
  }
  function validateEmail(value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  }
  function validatePassword(value, name, email) {
    const strongPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPattern.test(value)) return false;
    const lowerPass = value.toLowerCase();
    if (name && lowerPass.includes(name.toLowerCase())) return false;
    if (email && lowerPass.includes(email.split('@')[0].toLowerCase())) return false;
    return true;
  }
  function validateConfirmPassword(pass, confirm) {
    return pass === confirm && confirm.length > 0;
  }

  function showError(inputEl, message) {
    const span = inputEl.parentNode.querySelector('.error-message');
    span.textContent = message || '';
    if (message) {
      inputEl.classList.add('invalid');
      inputEl.classList.remove('valid');
    } else {
      inputEl.classList.remove('invalid');
      inputEl.classList.add('valid');
    }
  }

  function checkAllFields() {
    let valid = true;

    if (!validateName(usernameEl.value)) {
      showError(usernameEl, 'Name: letters only, 2–25 chars.');
      valid = false;
    } else showError(usernameEl, '');

    if (!validateCompany(companyEl.value)) {
      showError(companyEl, 'Company: letters/numbers, 2–25 chars.');
      valid = false;
    } else showError(companyEl, '');

    if (!validateEmail(emailEl.value)) {
      showError(emailEl, 'Enter a valid email address.');
      valid = false;
    } else showError(emailEl, '');

    if (!validatePassword(passwordEl.value, usernameEl.value, emailEl.value)) {
      showError(passwordEl, 'Min 8 chars, 1 letter, 1 number, 1 special char, no name/email.');
      valid = false;
    } else showError(passwordEl, '');

    if (!validateConfirmPassword(passwordEl.value, confirmPasswordEl.value)) {
      showError(confirmPasswordEl, 'Passwords do not match.');
      valid = false;
    } else showError(confirmPasswordEl, '');

    submitBtn.disabled = !valid;
    submitBtn.title = valid ? '' : 'Please fix errors before submitting';
    return valid;
  }

  // Real-time validation
  [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl].forEach(input => {
    input.addEventListener('input', checkAllFields);
  });

  submitBtn.disabled = true;

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkAllFields()) {
        const firstInvalid = form.querySelector('.invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

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
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('signupForm');
  const API_BASE = 'https://ptw-yu8u.onrender.com';
  const formMessage = document.getElementById('formMessage');

  const usernameEl = document.getElementById('signupName');
  const companyEl = document.getElementById('companyName');
  const emailEl = document.getElementById('signupEmail');
  const passwordEl = document.getElementById('signupPassword');
  const confirmPasswordEl = document.getElementById('signupConfirmPassword');
  const termsEl = document.getElementById('termsCheckbox');
  const signupBtn = document.getElementById('signupBtn');

  // Helper to show custom messages
  function showFormMessage(type, text) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = 'block';
  }

  // Validation rules
  function validateName(value) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,25}$/.test(value.trim());
  }
  function validateCompany(value) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]{2,25}$/.test(value.trim());
  }
  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function validatePassword(value, name, email) {
    const strongPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPattern.test(value)) return false;
    const lowerPass = value.toLowerCase();
    if (name && lowerPass.includes(name.toLowerCase())) return false;
    if (validateEmail(email) && lowerPass.includes(email.split('@')[0].toLowerCase())) return false;
    return true;
  }
  function validateConfirmPassword(pass, confirm) {
    return pass === confirm && confirm.length > 0;
  }
  function validateTerms(checked) {
    return checked;
  }

  function showError(inputEl, message) {
    const group = inputEl.closest('.form-group');
    if (!group) return;
    const span = group.querySelector('.error-message');
    if (!span) return;
    span.textContent = message || '';
    if (message) {
      inputEl.classList.add('invalid');
      inputEl.classList.remove('valid');
    } else {
      inputEl.classList.remove('invalid');
      inputEl.classList.add('valid');
    }
  }

  function validateField(inputEl) {
    let isValid = true;
    switch (inputEl.id) {
      case 'signupName':
        isValid = validateName(inputEl.value);
        showError(inputEl, isValid ? '' : 'Letters only, 2–25 chars.');
        break;
      case 'companyName':
        isValid = validateCompany(inputEl.value);
        showError(inputEl, isValid ? '' : 'Letters/numbers, 2–25 chars.');
        break;
      case 'signupEmail':
        isValid = validateEmail(inputEl.value);
        showError(inputEl, isValid ? '' : 'Enter a valid email address.');
        break;
      case 'signupPassword':
        isValid = validatePassword(inputEl.value, usernameEl.value, emailEl.value);
        showError(inputEl, isValid ? '' : 'Min 8 chars, 1 letter, 1 number, 1 special char, no name/email.');
        break;
      case 'signupConfirmPassword':
        isValid = validateConfirmPassword(passwordEl.value, inputEl.value);
        showError(inputEl, isValid ? '' : 'Passwords do not match.');
        break;
      case 'termsCheckbox':
        isValid = validateTerms(inputEl.checked);
        showError(inputEl, isValid ? '' : 'Please accept the terms and conditions.');
        break;
    }
    return isValid;
  }

  function validateForm() {
    let valid = true;
    [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl, termsEl].forEach(input => {
      if (!validateField(input)) valid = false;
    });
    return valid;
  }

  [usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl].forEach(input => {
    input.addEventListener('input', () => validateField(input));
  });
  termsEl.addEventListener('change', () => validateField(termsEl));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm()) {
        const firstInvalid = form.querySelector('.invalid') || form.querySelector('#termsCheckbox:not(:checked)');
        if (firstInvalid) firstInvalid.focus();
        showFormMessage('error', 'Please fix the errors above before submitting.');
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
          showFormMessage('error', data.message || 'Sign up failed.');
          return;
        }

        // Success state
        signupBtn.style.transition = 'background-color 0.4s ease, color 0.4s ease';
        signupBtn.textContent = 'Form submitted successfully';
        signupBtn.style.backgroundColor = '#28a745';
        signupBtn.style.borderColor = '#28a745';
        signupBtn.style.color = '#fff';
        signupBtn.disabled = true;

        // Pulse glow animation
        signupBtn.animate([
          { boxShadow: '0 0 0 rgba(40, 167, 69, 0.7)' },
          { boxShadow: '0 0 15px rgba(40, 167, 69, 0.9)' },
          { boxShadow: '0 0 0 rgba(40, 167, 69, 0.7)' }
        ], {
          duration: 1200,
          iterations: 3
        });

        showFormMessage('success', 'Account created successfully! Redirecting to login...');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);

      } catch (err) {
        showFormMessage('error', 'Network error. Please try again.');
      }
    });
  }
});
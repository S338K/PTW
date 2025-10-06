import { API_BASE } from '../config.js';

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('signupForm');

    const usernameEl = document.getElementById('signupName');
    const companyEl = document.getElementById('companyName');
    const emailEl = document.getElementById('signupEmail');
    const passwordEl = document.getElementById('signupPassword');
    const confirmPasswordEl = document.getElementById('signupConfirmPassword');
    const termsEl = document.getElementById('termsCheckbox');
    const signupBtn = document.getElementById('signupBtn');

    // Office Address fields
    const buildingNoEl = document.getElementById('buildingNo');
    const floorNoEl = document.getElementById('floorNo');
    const streetNoEl = document.getElementById('streetNo');
    const zoneEl = document.getElementById('zone');
    const cityEl = document.getElementById('city');
    const countryEl = document.getElementById('country');
    const poBoxEl = document.getElementById('poBox');

    // Validation rules
    function validateName(value) {
        return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,50}$/.test(value.trim());
    }
    function validateCompany(value) {
        return /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]{2,50}$/.test(value.trim());
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
    function validateBuildingNo(value) {
        return /^\d{1,2}$/.test(value);
    }
    function validateFloorNo(value) {
        return /^\d{1,2}$/.test(value);
    }
    function validateStreetNo(value) {
        return /^\d{1,3}$/.test(value);
    }
    function validateZone(value) {
        return /^\d{1,2}$/.test(value);
    }
    function validateCity(value) {
        return /^[A-Za-z\s]+$/.test(value.trim());
    }
    function validateCountry(value) {
        return /^[A-Za-z\s]+$/.test(value.trim());
    }
    function validatePoBox(value) {
        return /^\d{1,6}$/.test(value);
    }

    // Show error under the field
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

    // Validate a single field
    function validateField(inputEl) {
        let isValid = true;
        switch (inputEl.id) {
            case 'signupName':
                isValid = validateName(inputEl.value);
                showError(inputEl, isValid ? '' : 'Letters only (2–50 chars).');
                break;
            case 'companyName':
                isValid = validateCompany(inputEl.value);
                showError(inputEl, isValid ? '' : 'Letters/numbers only (2–50 chars).');
                break;
            case 'signupEmail':
                isValid = validateEmail(inputEl.value);
                showError(inputEl, isValid ? '' : 'Enter a valid email address 📧.');
                break;
            case 'signupPassword':
                isValid = validatePassword(inputEl.value, usernameEl.value, emailEl.value);
                showError(inputEl, isValid ? '' : 'Min 8 chars, 1 letter, 1 number, 1 special char. Name/Email not allowed.');
                break;
            case 'signupConfirmPassword':
                isValid = validateConfirmPassword(passwordEl.value, inputEl.value);
                showError(inputEl, isValid ? '' : 'Passwords do not match 🔑.');
                break;
            case 'buildingNo':
                isValid = validateBuildingNo(inputEl.value);
                showError(inputEl, isValid ? '' : 'Building No. should be 1–2 digits.');
                break;
            case 'floorNo':
                isValid = validateFloorNo(inputEl.value);
                showError(inputEl, isValid ? '' : 'Floor No. should be 1–2 digits.');
                break;
            case 'streetNo':
                isValid = validateStreetNo(inputEl.value);
                showError(inputEl, isValid ? '' : 'Street No. should be 1–3 digits.');
                break;
            case 'zone':
                isValid = validateZone(inputEl.value);
                showError(inputEl, isValid ? '' : 'Zone should be 1–2 digits.');
                break;
            case 'city':
                isValid = validateCity(inputEl.value);
                showError(inputEl, isValid ? '' : 'City should be alphabetic.');
                break;
            case 'country':
                isValid = validateCountry(inputEl.value);
                showError(inputEl, isValid ? '' : 'Country should be alphabetic.');
                break;
            case 'poBox':
                isValid = validatePoBox(inputEl.value);
                showError(inputEl, isValid ? '' : 'P.O. Box should be 1–6 digits.');
                break;
            case 'termsCheckbox':
                isValid = validateTerms(inputEl.checked);
                showError(inputEl, isValid ? '' : 'Please accept the terms and conditions 📝.');
                break;
        }
        return isValid;
    }

    // Validate all fields on submit
    function validateForm() {
        let valid = true;
        [
            usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl, termsEl,
            buildingNoEl, floorNoEl, streetNoEl, zoneEl, cityEl, countryEl, poBoxEl
        ].forEach(input => {
            if (!validateField(input)) valid = false;
        });
        return valid;
    }

    // Real-time validation
    [
        usernameEl, companyEl, emailEl, passwordEl, confirmPasswordEl,
        buildingNoEl, floorNoEl, streetNoEl, zoneEl, cityEl, countryEl, poBoxEl
    ].forEach(input => {
        input.addEventListener('input', () => validateField(input));
    });
    termsEl.addEventListener('change', () => validateField(termsEl));

    // Submit validation
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validateForm()) {
                const firstInvalid = form.querySelector('.invalid') || form.querySelector('#termsCheckbox:not(:checked)');
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            const username = usernameEl.value.trim();
            const company = companyEl.value.trim();
            const email = emailEl.value.trim();
            const password = passwordEl.value.trim();
            const buildingNo = buildingNoEl.value.trim();
            const floorNo = floorNoEl.value.trim();
            const streetNo = streetNoEl.value.trim();
            const zone = zoneEl.value.trim();
            const city = cityEl.value.trim();
            const country = countryEl.value.trim();
            const poBox = poBoxEl.value.trim();

            try {
                const res = await fetch(`${API_BASE}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        username, company, email, password,
                        buildingNo, floorNo, streetNo, zone, city, country, poBox
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    if (data.message && data.message.toLowerCase().includes('email')) {
                        showError(emailEl, data.message);
                    } else {
                        alert(data.message || 'Sign up failed.');
                    }
                    return;
                }

                signupBtn.style.transition = 'background-color 0.4s ease, color 0.4s ease';
                signupBtn.textContent = 'Registration Successful.';
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

                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);

            } catch (err) {
                alert('Network error. Please try again.');
            }
        });
    }
});

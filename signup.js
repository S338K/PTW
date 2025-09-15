// signup.js: Handles signup form logic for signup.html
document.addEventListener('DOMContentLoaded', function () {
  
  const signupForm = document.getElementById('signupForm');
  const API_BASE = 'https://ptw-yu8u.onrender.com'; // change if needed
  if (!signupForm) return;
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const company = document.getElementById('companyName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    // ====== Basic Validation ======
    if (!username || !company || !email || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    // Password strength check
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
    if (!passwordRegex.test(password)) {
      alert('Password must be at least 10 characters long and include at least one letter, one number, and one special character.');
      return;
    }

    // Confirm password match
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // ====== API Call ======
    try {
      console.log('Sending signup request to:', `${API_BASE}/api/register`);
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // send cookies if backend uses session
        body: JSON.stringify({
          username: name,
          company: company,
          email: email,
          password: password
        })
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        console.warn('Signup failed:', res.status, data);
        alert(data.message || 'Registration failed');
        return;
      }

      console.log('Signup successful. Redirecting to Login page...', data);
      alert(data.message || 'Account created successfully!');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Network error during signup:', err);
      alert('Please verify all the fields and try again.');
    }
  });
});

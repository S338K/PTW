document.addEventListener('DOMContentLoaded', function () {
  const signupForm = document.getElementById('signupForm');
  const API_BASE = location.hostname.includes('localhost')
    ? 'http://localhost:5000'
    : 'https://ptw-yu8u.onrender.com';

  if (!signupForm) return;

  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('signupName').value.trim();
    const company = document.getElementById('companyName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!username || !company || !email || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      alert('Password must be at least 8 characters long and include at least one letter, one number, and one special character.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      console.log('Sending payload:', { username, company, email, password });

      console.log('Sending signup request to:', `${API_BASE}/api/register`);
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username, // ✅ backend ke expected key
          company,
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        console.warn('Signup failed:', res.status, data);
        alert(data.message || 'Registration failed');
        return;
      }

      console.log('Signup successful', data);
      alert(data.message || 'Account created successfully! Redirecting to Login page...');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Network error during signup:', err);
      alert('Please verify all the fields and try again.');
    }
  });
});

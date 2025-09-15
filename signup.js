document.addEventListener('DOMContentLoaded', function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  const form = document.getElementById('signupForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('signupName').value.trim();
      const company = document.getElementById('companyName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupConfirmPassword').value;

      if (!username || !company || !email || !password || !confirmPassword) {
        alert('Please fill in all fields.');
        return;
      }

      const passwordRegex =
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        alert('Password must be at least 8 characters and include a letter, a number, and a special character.');
        return;
      }

      if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, company, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || 'Registration failed');
          return;
        }

        alert(data.message || 'Registration successful. Redirecting to login…');
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Signup network error:', err);
        alert('Network error. Please try again.');
      }
    });
  }
});

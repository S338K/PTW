// signup.js: Handles signup form logic for signup.html

document.addEventListener('DOMContentLoaded', function() {
  const signupForm = document.getElementById('signupForm');
  if (!signupForm) return;

  signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const company = document.getElementById('companyName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    // Basic empty field check
    if (!name || !company || !email || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    // ✅ Password validation (same as backend)
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

    try {
      const res = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // important for session cookies
        body: JSON.stringify({
          username: name,
          company: company,   // backend expects 'company'
          email: email,
          password: password,
      
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Registration failed');
        return;
      }

      alert(data.message || 'Account created successfully!');
      window.location.href = 'login.html';
    } catch (err) {
      console.error('Signup error:', err);
      alert('Something went wrong. Please try again.');
    }
  });
});

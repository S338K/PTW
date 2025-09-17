// forgot-password.js
document.addEventListener('DOMContentLoaded', () => {
  const forgotLink = document.getElementById('forgot-link');
  const popup = document.getElementById('reset-popup');
  const sendTokenBtn = document.getElementById('send-token');
  const tokenSection = document.getElementById('token-section');
  const updatePasswordBtn = document.getElementById('update-password');

  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    popup.style.display = 'block';
  });

  sendTokenBtn.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) return alert('Please enter your email');

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Token generated: ' + data.token); // For testing only
        tokenSection.style.display = 'block';
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error sending token:', err);
      alert('Error sending token');
    }
  });

  updatePasswordBtn.addEventListener('click', async () => {
    const token = document.getElementById('reset-token').value.trim();
    const newPassword = document.getElementById('new-password').value.trim();
    if (!token || !newPassword) return alert('Please fill in all fields');

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      alert(data.message);
      if (res.ok) {
        popup.style.display = 'none';
      }
    } catch (err) {
      console.error('Error updating password:', err);
      alert('Error updating password');
    }
  });
});
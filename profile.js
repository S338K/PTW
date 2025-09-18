document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  // ===== Load Submitted Permit Details table on profile.html =====
  if (document.getElementById('permitTable')) {
    try {
      const res = await fetch(`${API_BASE}/api/permits`);
      if (res.ok) {
        const permits = await res.json();
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        permits.forEach((permit, index) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${new Date(permit.submittedAt).toLocaleString()}</td>
            <td>${permit.permitNumber}</td>
            <td>${permit.title}</td>
            <td><span class="status ${permit.status.toLowerCase().replace(/\s+/g, '')}">${permit.status}</span></td>
          `;
          tbody.appendChild(row);
        });
      } else {
        console.warn('Failed to load permits');
      }
    } catch (err) {
      console.warn('Error fetching permits:', err);
    }
  }

  // ===== Redirect to mainpage.html when user is on profile page =====
  if (window.location.pathname === '/profile.html') {
    const redirectToMainPageButton = document.getElementById('sbmtptw');
    if (redirectToMainPageButton) {
      redirectToMainPageButton.addEventListener('click', function () {
        window.location.href = 'mainpage.html';
      });
    }
  }

  // ===== Logout and redirect to index.html =====
  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
      // Add any logout logic here if needed, like clearing sessionStorage or localStorage
      window.location.href = 'index.html';
    });
  }

});

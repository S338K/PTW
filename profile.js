document.addEventListener('DOMContentLoaded', async function () {
    // ====== SHOW WELCOME MESSAGE & PROFILE DETAILS ======
    const fullName = localStorage.getItem('fullName');
    const email = localStorage.getItem('email');
    const company = localStorage.getItem('company');

    const profileWelcomeEl = document.getElementById('profileWelcome');
    if (fullName && profileWelcomeEl) {
        profileWelcomeEl.textContent = `Welcome : ${fullName}`;
    } else {
        // Agar naam nahi mila to login page pe redirect
        window.location.href = 'login.html';
        return;
    }

    // Profile card details
    document.getElementById('profileFullName').textContent = fullName || '-';
    document.getElementById('profileEmail').textContent = email || '-';
    document.getElementById('profileCompany').textContent = company || '-';

    // ====== LAST LOGIN ======
    const lastLoginEl = document.getElementById('profileLastLogin');
    let lastLogin = localStorage.getItem('lastLogin'); // fallback from login.js

    try {
        // Backend se profile fetch karo (lastLogin ke liye)
        const res = await fetch('http://localhost:5000/api/profile', {
            method: 'GET',
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            if (data.user?.lastLogin) {
                // Backend se aaya hua lastLogin (pichla login time ya first-time ka current time)
                lastLogin = new Date(data.user.lastLogin).toLocaleString();
                localStorage.setItem('lastLogin', lastLogin);
            }
            // Agar backend null bheje to kuch mat karo — localStorage ka fallback use hoga
        }
    } catch (err) {
        console.warn('Backend se lastLogin fetch nahi ho paya:', err);
    }

    // UI update
    if (lastLogin && lastLoginEl) {
        lastLoginEl.textContent = `Last login: ${lastLogin}`;
    } else if (lastLoginEl) {
        lastLoginEl.textContent = `Last login: -`;
    }

    // ====== GO TO MAIN PAGE BUTTON ======
    document.getElementById('sbmtptw')?.addEventListener('click', function () {
        window.location.href = 'mainpage.html';
    });

    // ====== LOGOUT HANDLING ======
    document.getElementById('logoutBtn')?.addEventListener('click', function () {
        // Local storage clear
        localStorage.clear();

        // Backend logout call
        fetch('http://localhost:5000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).finally(() => {
            window.location.href = 'login.html';
        });
    });
});

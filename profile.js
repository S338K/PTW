document.addEventListener('DOMContentLoaded', async function () {
    // ====== SESSION GUARD ======
    // Agar session nahi hai to logout/redirect
    if (!sessionStorage.getItem('isLoggedIn')) {
        window.location.href = 'index.html';
        return;
    }

    // ====== IDLE TIMEOUT (5 MINUTES) ======
    function logoutUser() {
        localStorage.clear();
        sessionStorage.clear();
        fetch('http://localhost:5000/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).finally(() => {
            window.location.href = 'index.html';
        });
    }

    function resetIdleTimer() {
        sessionStorage.setItem('lastActivity', Date.now());
    }

    function checkIdleTime() {
        const last = parseInt(sessionStorage.getItem('lastActivity') || '0', 10);
        if (!last || Date.now() - last > 5 * 60 * 1000) {
            logoutUser();
        }
    }

    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart', 'touchmove'].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer, { passive: true })
    );
    setInterval(checkIdleTime, 30000);
    resetIdleTimer();

    // ====== SHOW WELCOME MESSAGE & PROFILE DETAILS ======
    const fullName = localStorage.getItem('fullName');
    const email = localStorage.getItem('email');
    const company = localStorage.getItem('company');

    const profileWelcomeEl = document.getElementById('profileWelcome');
    if (fullName && profileWelcomeEl) {
        profileWelcomeEl.textContent = `Welcome : ${fullName}`;
    } else {
        // Agar naam nahi mila to login page pe redirect
        window.location.href = 'index.html';
        return;
    }

    // Profile card details
    document.getElementById('profileFullName').textContent = fullName || '-';
    document.getElementById('profileEmail').textContent = email || '-';
    document.getElementById('profileCompany').textContent = company || '-';

    // ====== LAST LOGIN ======
    const lastLoginEl = document.getElementById('profileLastLogin');
    let lastLogin = localStorage.getItem('lastLogin');

    try {
        const res = await fetch('http://localhost:5000/api/profile', {
            method: 'GET',
            credentials: 'include'
        });
        if (res.ok) {
            const data = await res.json();
            if (data.user?.lastLogin) {
                lastLogin = new Date(data.user.lastLogin).toLocaleString();
                localStorage.setItem('lastLogin', lastLogin);
            }
        }
    } catch (err) {
        console.warn('Backend se lastLogin fetch nahi ho paya:', err);
    }

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
    document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
});

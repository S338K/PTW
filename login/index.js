// use shared/layout.js for theme toggle and other shared utilities

import { API_BASE } from '../config.js';

// Consolidated and cleaned login page script
document.addEventListener('DOMContentLoaded', () => {

    // ========== CAROUSEL MESSAGES SYSTEM ==========
    let carouselMessages = [];
    let currentSlide = 0;
    let carouselInterval = null;

    async function fetchWeatherData() {
        try {
            const res = await fetch(`${API_BASE}/api/weather`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                return {
                    icon: 'fa-temperature-half',
                    title: `${data.location || 'Doha'} Weather`,
                    message: `${data.temperature || '--'}°C, ${data.condition || 'Loading...'}`
                };
            }
        } catch (e) {
            console.warn('Weather fetch failed:', e);
        }
        return {
            icon: 'fa-temperature-half',
            title: 'Doha Weather',
            message: 'Temperature data unavailable'
        };
    }

    async function fetchSystemMessages() {
        try {
            const res = await fetch(`${API_BASE}/api/system-messages`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data
                        .filter(msg => msg.isActive)
                        .map(msg => ({
                            icon: msg.icon || 'fa-bullhorn',
                            title: msg.title || 'Announcement',
                            message: msg.message || ''
                        }));
                }
            }
        } catch (e) {
            console.warn('System messages fetch failed:', e);
        }
        return [];
    }

    async function initializeCarousel() {
        // Fetch weather (always first slide)
        const weatherData = await fetchWeatherData();

        // Fetch admin messages
        const adminMessages = await fetchSystemMessages();

        // Combine: weather first, then admin messages
        carouselMessages = [weatherData, ...adminMessages];

        renderCarousel();
        renderMarquee();
        startCarousel();
    }

    function renderCarousel() {
        const container = document.getElementById('carouselContainer');

        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Render slides
        carouselMessages.forEach((msg, index) => {
            const slide = document.createElement('div');
            slide.className = 'carousel-slide min-w-full h-full flex items-center justify-center gap-3 text-[var(--text-primary)] px-4';
            slide.innerHTML = `
                <i class="fas ${msg.icon} text-xl flex-shrink-0"></i>
                <div class="text-center">
                    <span class="font-semibold text-base">${msg.title}:</span>
                    <span class="ml-2 text-base">${msg.message}</span>
                </div>
            `;
            container.appendChild(slide);
        });
    }

    function renderMarquee() {
        const marqueeContainer = document.getElementById('marqueeContainer');

        if (!marqueeContainer) return;

        // Create a continuous scrolling text with all messages duplicated for seamless loop
        const messagesHTML = carouselMessages.map(msg => `
            <span class="inline-flex items-center gap-2 text-[var(--text-primary)] px-6">
                <i class="fas ${msg.icon} text-lg"></i>
                <span class="font-semibold text-sm">${msg.title}:</span>
                <span class="text-sm">${msg.message}</span>
            </span>
        `).join(' • ');

        // Duplicate content for seamless scrolling
        marqueeContainer.innerHTML = messagesHTML + ' • ' + messagesHTML;
    }

    function goToSlide(index) {
        currentSlide = index;
        const container = document.getElementById('carouselContainer');

        if (!container) return;

        // Update slide position
        container.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % carouselMessages.length;
        goToSlide(currentSlide);
    }

    function startCarousel() {
        // Auto-advance every 5 seconds if there's more than one slide
        if (carouselMessages.length > 1) {
            carouselInterval = setInterval(nextSlide, 5000);
        }
    }

    function stopCarousel() {
        if (carouselInterval) {
            clearInterval(carouselInterval);
            carouselInterval = null;
        }
    }

    // Pause carousel on hover
    const carouselContainer = document.getElementById('carouselContainer');
    if (carouselContainer) {
        carouselContainer.addEventListener('mouseenter', stopCarousel);
        carouselContainer.addEventListener('mouseleave', startCarousel);
    }

    // Initialize carousel
    initializeCarousel();

    // ========== DYNAMIC BACKGROUND IMAGE SYSTEM ==========
    let backgroundImages = [];
    let currentBgIndex = 0;
    let bgInterval = null;
    const BG_CHANGE_INTERVAL = 5000; // Change every 5 seconds

    async function loadAvailableBackgrounds() {
        try {
            // Fetch list of images from the images folder
            const res = await fetch(`${API_BASE}/api/images`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                // Filter out logo images (Logo.png, MATAR_logo.png, HIA_logo.png)
                backgroundImages = data
                    .filter(img => !img.toLowerCase().includes('logo'))
                    .map(img => `../images/${img}`);
            }
        } catch (e) {
            console.warn('Failed to fetch image list, using fallback images:', e);
            // Fallback: Common image names without logo
            const fallbackImages = [
                'Hamad-Exterior-01-1900.jpg',
                'HIA ORCHARD.JPG',
                'North_Node.jpg',
                'orchard.jpg',
                'Orchard_PTC.jpg',
                'PTC_Landscape.jpg',
                'SBD.jpg',
                'Terminal.jpg',
                'Transit.jpg',
                'waiting_area.jpg'
            ].map(img => `../images/${img}`);
            backgroundImages = fallbackImages;
        }

        if (backgroundImages.length > 0) {
            startBackgroundCarousel();
        }
    }

    function preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }

    async function changeBackground() {
        if (backgroundImages.length === 0) return;

        const bgLayer = document.getElementById('backgroundLayer');
        if (!bgLayer) return;

        // Find next available image
        let attempts = 0;
        while (attempts < backgroundImages.length) {
            const imageUrl = backgroundImages[currentBgIndex];

            try {
                await preloadImage(imageUrl);
                // Successfully loaded, fade out current image
                bgLayer.style.opacity = '0';

                // After fade out, change image and fade back in
                setTimeout(() => {
                    bgLayer.style.backgroundImage = `url('${imageUrl}')`;
                    // Lighter overlay in light theme (0.8), darker overlay in dark theme (0.5)
                    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
                    bgLayer.style.opacity = isDarkTheme ? '0.5' : '0.8';
                }, 500); // Wait for fade out to complete (500ms)

                currentBgIndex = (currentBgIndex + 1) % backgroundImages.length;
                break;
            } catch (e) {
                console.warn(`Background image not found or failed to load: ${imageUrl}`);
                // Move to next image if current fails
                currentBgIndex = (currentBgIndex + 1) % backgroundImages.length;
                attempts++;
            }
        }
    }

    function startBackgroundCarousel() {
        if (backgroundImages.length > 1) {
            // Change background immediately and then every interval
            changeBackground();
            bgInterval = setInterval(changeBackground, BG_CHANGE_INTERVAL);
        } else if (backgroundImages.length === 1) {
            changeBackground();
        }
    }

    function stopBackgroundCarousel() {
        if (bgInterval) {
            clearInterval(bgInterval);
            bgInterval = null;
        }
    }

    // Initialize background carousel
    loadAvailableBackgrounds();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopCarousel();
        stopBackgroundCarousel();
    });

    // ========== REST OF LOGIN PAGE CODE ==========

    // Deduplicate any duplicate password toggle
    setTimeout(() => {
        const passwordField = document.getElementById('password');
        if (passwordField) {
            const parent = passwordField.parentElement;
            if (parent) {
                const toggles = parent.querySelectorAll('#togglePassword');
                if (toggles.length > 1) toggles.forEach((b, i) => { if (i > 0) b.remove(); });
            }
        }
    }, 0);

    // Header/background image carousels removed per requirement

    // Theme toggle handled by shared/layout.js via [data-theme-toggle]

    // Login form handlers (kept intact)
    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');

    // Error display removed for login page (inline error UI was intentionally removed)

    // --- Shared toast helpers (use shared/toast.js) ---
    const showToast = (type, message, opts = {}) => {
        if (window.showToast) return window.showToast(type, message, opts);
        console.warn('Toast:', type, message);
        return null;
    };
    const dismissToast = (el) => {
        if (window.dismissToast) return window.dismissToast(el);
        if (el && el.remove) el.remove();
    };

    function validateEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function validatePassword(v) { return v.trim().length >= 8; }

    function validateField(el) {
        if (!el) return true;
        if (el.id === 'email') {
            return validateEmail(el.value);
        }
        if (el.id === 'password') {
            return validatePassword(el.value);
        }
        return true;
    }

    [emailEl, passwordEl].forEach(i => { if (i) i.addEventListener('input', () => validateField(i)); });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Validate each field and show errors for every failed validation via toast
            const errors = [];
            const emailOk = validateField(emailEl);
            const passwordOk = validateField(passwordEl);
            if (!emailOk) errors.push('Please enter a valid email address.');
            if (!passwordOk) errors.push('Password must be at least 8 characters.');
            if (errors.length) { showToast('error', errors.join('<br>')); return; }

            const email = emailEl.value.trim();
            const password = passwordEl.value.trim();
            const originalButtonHTML = `<span class="relative z-10 flex items-center justify-center" style="color: #ffffff !important;"><i class="fas fa-sign-in-alt mr-2" style="color: #ffffff !important;"></i>Sign in to your account</span>`;

            loginBtn.disabled = true;
            loginBtn.innerHTML = `<span class="flex items-center justify-center" style="color: #ffffff !important;"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Checking...</span>`;

            // Helper to perform login (with optional force flag)
            async function performLogin(force = false) {
                const res = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, ...(force ? { force: true } : {}) }),
                    credentials: 'include'
                });
                const data = await res.json().catch(() => ({}));
                return { res, data };
            }

            try {
                let { res, data } = await performLogin(false);
                if (!res.ok) {
                    // Handle single active-session conflict (409)
                    if (res.status === 409 && data && data.code === 'ACTIVE_SESSION') {
                        const modal = document.getElementById('sessionConflictModal');
                        const msgEl = document.getElementById('sessionConflictMessage');
                        const btnYes = document.getElementById('sessionConflictConfirm');
                        const btnNo = document.getElementById('sessionConflictCancel');
                        if (msgEl) {
                            const name = (data.user && (data.user.displayName || data.user.username)) || 'this account';
                            msgEl.textContent = `You're already signed in as ${name} on another device or browser. Continue here to sign out there and use this device instead?`;
                        }
                        const closeModal = () => { if (modal) modal.classList.add('hidden'); };
                        const openModal = () => { if (modal) modal.classList.remove('hidden'); };
                        openModal();

                        // Wire once for this attempt
                        const onNo = (ev) => {
                            ev.preventDefault();
                            closeModal();
                            loginBtn.disabled = false;
                            loginBtn.innerHTML = originalButtonHTML;
                            btnNo && btnNo.removeEventListener('click', onNo);
                            btnYes && btnYes.removeEventListener('click', onYes);
                        };
                        const onYes = async (ev) => {
                            ev.preventDefault();
                            btnYes.disabled = true;
                            try {
                                const forced = await performLogin(true);
                                if (!forced.res.ok) {
                                    showToast('error', forced.data && forced.data.message ? forced.data.message : 'Unable to switch this account here.');
                                    btnYes.disabled = false;
                                    return;
                                }
                                data = forced.data;
                                closeModal();
                            } catch (err) {
                                btnYes.disabled = false;
                                showToast('error', 'Network error while switching session.');
                                return;
                            } finally {
                                btnNo && btnNo.removeEventListener('click', onNo);
                                btnYes && btnYes.removeEventListener('click', onYes);
                            }

                            // proceed to success flow below using updated data
                            finalizeSuccess(data);
                        };

                        btnNo && btnNo.addEventListener('click', onNo, { once: true });
                        btnYes && btnYes.addEventListener('click', onYes, { once: true });
                        return; // wait for user choice
                    }

                    // Generic error fallback
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalButtonHTML;
                    showToast('error', data && data.message ? data.message : 'Sign in failed. Please check your credentials.');
                    console.warn('Login failed:', data && data.message);
                    return;
                }
                // success
                finalizeSuccess(data);
            } catch (e) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalButtonHTML;
                showToast('error', 'Network error during login. Please try again.');
                console.warn('Network error during login:', e);
            }
        });
    }

    // forgot password link
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); window.open('../forgot-password/forgot-password.html', 'ForgotPassword', 'width=500,height=600,top=100,left=100,resizable=yes,scrollbars=yes'); });

    // small UX enhancements
    [emailEl, passwordEl].forEach(input => { if (input) { input.addEventListener('focus', () => { input.parentElement.classList.add('transform', 'scale-[1.02]'); }); input.addEventListener('blur', () => { input.parentElement.classList.remove('transform', 'scale-[1.02]'); }); } });

    function finalizeSuccess(data) {
        try { sessionStorage.setItem('previousLogin', (data && data.user && data.user.lastLogin) || ''); } catch (_) { }
        showToast('success', 'Signed in successfully');
        setTimeout(() => {
            const role = data && data.user && data.user.role;
            switch (role) {
                case 'PreApprover': window.location.href = '../preapprover/preapprover.html'; break;
                case 'Approver': window.location.href = '../approver/approver.html'; break;
                case 'Admin': window.location.href = '../admin/admin.html'; break;
                default: window.location.href = '../profile/profile.html';
            }
        }, 700);
    }

});

import '../theme.js';

import { API_BASE } from '../config.js';

// Consolidated and cleaned login page script
document.addEventListener('DOMContentLoaded', () => {
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

    // Carousel slides
    const slides = Array.from(document.querySelectorAll('.carousel-slide'));
    let currentSlide = 0;
    let carouselInterval = null;
    const SLIDE_DURATION = 6000;

    async function fetchAdminMessage() {
        try {
            const res = await fetch(`${API_BASE}/system-message`);
            if (!res.ok) throw new Error('No message');
            const data = await res.json();
            return data.message || '';
        } catch (e) {
            return '';
        }
    }

    async function updateCarouselContent() {
        const mainEl = document.getElementById('mainMessage');
        const weatherEl = document.getElementById('weatherMessage');
        const adminEl = document.getElementById('adminMessage');

        if (mainEl) mainEl.textContent = 'Welcome to HIA Baggage Handling System - Your gateway to access the BHS';

        // Load weather and format strictly as requested. Works in dev & prod because API_BASE adapts.
        try {
            const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent('Doha')}`);
            if (!res.ok) throw new Error('Weather unavailable');
            const data = await res.json();

            const temp = data.temperature !== undefined ? Math.round(data.temperature) : 'N/A';
            const feels = data.feelsLike !== undefined ? Math.round(data.feelsLike) : temp;
            const condition = data.condition ? `${data.condition.charAt(0).toUpperCase()}${data.condition.slice(1)}` : 'N/A';
            const humidity = data.humidity !== undefined ? data.humidity : 'N/A';
            const visibility = data.visibility !== undefined ? data.visibility : 'N/A';
            const wind = data.windSpeed !== undefined ? Math.round(data.windSpeed) : 'N/A';
            const aqi = data.aqi !== undefined ? data.aqi : 'N/A';
            const quality = data.aqiStatus || 'N/A';

            const weatherText = `Temperature: ${temp}°C (feels like ${feels}°C) | Weather Condition: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility}km | Wind Speed: ${wind}km/h | AQI: ${aqi} | Air Quality: ${quality}`;
            if (weatherEl) weatherEl.textContent = weatherText;
        } catch (err) {
            if (weatherEl) weatherEl.textContent = 'Weather data unavailable';
            console.error('Carousel weather error:', err && err.message);
        }

        if (adminEl) adminEl.textContent = await fetchAdminMessage();
    }

    function showSlide(idx) {
        if (!slides.length) return;
        slides.forEach((s, i) => {
            s.setAttribute('aria-hidden', i !== idx);
            s.style.transform = `translateY(${(i - idx) * 100}%)`;
            s.style.transition = 'transform 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.7s cubic-bezier(0.4,0,0.2,1)';
        });
        currentSlide = idx;
    }

    function nextSlide() { showSlide((currentSlide + 1) % slides.length); }
    function prevSlide() { showSlide((currentSlide - 1 + slides.length) % slides.length); }

    function startCarousel() {
        if (carouselInterval) clearInterval(carouselInterval);
        carouselInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    // keyboard support
    const headerCarousel = document.querySelector('.header-carousel');
    if (headerCarousel) {
        headerCarousel.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') { prevSlide(); startCarousel(); }
            if (e.key === 'ArrowDown') { nextSlide(); startCarousel(); }
        });
    }

    // init
    showSlide(0);
    updateCarouselContent();
    setInterval(updateCarouselContent, 60000);
    startCarousel();

    // Background carousel (kept simple)
    class BackgroundCarousel {
        constructor() {
            this.container = document.getElementById('backgroundCarousel');
            this.images = ['Hamad-Exterior-01-1900.jpg', 'orchard.jpg'];
            this.currentIndex = 0; this.slides = []; this.intervalId = null;
            this.init();
        }
        async init() {
            if (!this.container || !this.images.length) return;
            this.images = await this.filterAvailableImages();
            if (!this.images.length) return;
            this.createSlides();
            this.startCarousel();
        }
        async filterAvailableImages() {
            const out = [];
            for (const name of this.images) {
                try { const r = await fetch(`../images/${name}`, { method: 'HEAD' }); if (r.ok) out.push(name); } catch (e) { }
            }
            return out;
        }
        createSlides() { this.container.innerHTML = ''; this.slides = []; this.images.forEach((img, i) => { const el = document.createElement('div'); el.className = 'bg-slide' + (i === 0 ? ' active' : ''); el.style.backgroundImage = `url('../images/${img}')`; this.container.appendChild(el); this.slides.push(el); }); }
        next() { if (this.slides.length <= 1) return; this.slides[this.currentIndex].classList.remove('active'); this.currentIndex = (this.currentIndex + 1) % this.slides.length; this.slides[this.currentIndex].classList.add('active'); }
        startCarousel() { if (this.slides.length <= 1) return; this.intervalId = setInterval(() => this.next(), 5000); }
    }
    const bg = new BackgroundCarousel();
    window.backgroundCarousel = bg;

    // Theme toggle wiring (uses existing theme.js)
    function initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        if (!themeToggle || !themeIcon) return;
        function update() { const isDark = document.documentElement.getAttribute('data-theme') === 'dark'; themeIcon.className = isDark ? 'fas fa-sun text-lg' : 'fas fa-moon text-lg'; }
        update();
        new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        themeToggle.addEventListener('mouseenter', () => themeToggle.style.transform = 'translateY(-1px) scale(1.05)');
        themeToggle.addEventListener('mouseleave', () => themeToggle.style.transform = 'translateY(0) scale(1)');
    }
    initThemeToggle();

    // Login form handlers (kept intact)
    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');

    function showError(el, msg) {
        if (!el) return;
        const g = el.closest('.form-group') || el.parentElement;
        let span = g.querySelector('.error-message');
        if (!span) { span = document.createElement('span'); span.className = 'error-message modern-error-message'; span.setAttribute('aria-live', 'polite'); g.appendChild(span); }
        span.textContent = msg || '';
        if (msg) { el.classList.add('invalid'); span.style.opacity = 1; span.style.display = 'block'; } else { el.classList.remove('invalid'); span.style.display = 'none'; }
    }

    function validateEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function validatePassword(v) { return v.trim().length >= 8; }

    function validateField(el) { if (!el) return true; if (el.id === 'email') { const ok = validateEmail(el.value); showError(el, ok ? '' : 'Enter a valid email address 📧'); return ok; } if (el.id === 'password') { const ok = validatePassword(el.value); showError(el, ok ? '' : 'Enter a valid password 🔑'); return ok; } return true; }

    [emailEl, passwordEl].forEach(i => { if (i) i.addEventListener('input', () => validateField(i)); });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateField(emailEl) || !validateField(passwordEl)) return;
            const email = emailEl.value.trim();
            const password = passwordEl.value.trim();
            loginBtn.disabled = true; loginBtn.innerHTML = `<span class="flex items-center justify-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Signing in...</span>`;
            try {
                const res = await fetch(`${API_BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' });
                const data = await res.json();
                if (!res.ok) { loginBtn.disabled = false; loginBtn.innerHTML = `<span class="relative z-10 flex items-center justify-center"><i class="fas fa-sign-in-alt mr-2"></i>Sign in to your account</span>`; if (data.message && data.message.toLowerCase().includes('email')) showError(emailEl, data.message); else if (data.message && data.message.toLowerCase().includes('password')) showError(passwordEl, data.message); else showError(emailEl, data.message || 'Login failed.'); return; }
                sessionStorage.setItem('previousLogin', data.user.lastLogin || '');
                setTimeout(() => { switch (data.user.role) { case 'PreApprover': window.location.href = '../preapprover/preapprover.html'; break; case 'Approver': window.location.href = '../approver/approver.html'; break; case 'Admin': window.location.href = '../admin/admin.html'; break; default: window.location.href = '../profile/profile.html'; } }, 500);
            } catch (e) { loginBtn.disabled = false; showError(passwordEl, 'Network error. Please try again.'); }
        });
    }

    // forgot password link
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); window.open('../forgot-password/forgot-password.html', 'ForgotPassword', 'width=500,height=600,top=100,left=100,resizable=yes,scrollbars=yes'); });

    // small UX enhancements
    [emailEl, passwordEl].forEach(input => { if (input) { input.addEventListener('focus', () => { input.parentElement.classList.add('transform', 'scale-[1.02]'); }); input.addEventListener('blur', () => { input.parentElement.classList.remove('transform', 'scale-[1.02]'); }); } });

});

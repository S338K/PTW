import '../theme.js';

import { API_BASE } from '../config.js';

document.addEventListener('DOMContentLoaded', function () {
    // Remove any duplicate password toggle buttons/eye icons if present
    setTimeout(() => {
        const passwordField = document.getElementById('password');
        if (passwordField) {
            const parent = passwordField.parentElement;
            if (parent) {
                const toggles = parent.querySelectorAll('#togglePassword');
                if (toggles.length > 1) {
                    // Keep only the first toggle button
                    toggles.forEach((btn, idx) => { if (idx > 0) btn.remove(); });
                }
            }
        }
    }, 0);
    // --- Accessible Login Carousel Logic ---
    const slides = Array.from(document.querySelectorAll('.carousel-slide'));
    const dots = Array.from(document.querySelectorAll('.carousel-dot'));
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    // Elements used by legacy helpers (may be absent in the rebuilt carousel)
    const dateTimeEl = document.getElementById('dateTimeDisplay');
    const weatherEl = document.getElementById('tempDisplay');
    let currentSlide = 0;
    let carouselInterval = null;
    const SLIDE_DURATION = 6000;


    // Personalization: Greeting based on time (looping)
    function getGreeting() {
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'Hello';
        if (hour >= 0 && hour < 12) greeting = 'Good Morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
        else greeting = 'Good Evening';
        return `${greeting}! It's ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }

    // (Removed stray top-level await fetch)
    async function fetchWeather() {
        try {
            const res = await fetch(`${API_BASE}/api/weather`);
            if (!res.ok) throw new Error('Weather unavailable');
            const data = await res.json();
            return {
                city: 'Doha',
                temp: data.temperature,
                desc: data.condition,
                icon: data.icons?.condition || 'https://openweathermap.org/img/wn/01d.png'
            };
        } catch {
            return {
                city: 'Doha',
                temp: '--',
                desc: 'Weather unavailable',
                icon: 'https://openweathermap.org/img/wn/01d.png'
            };
        }
    }

    // Admin message: fetch from backend
    async function fetchAdminMessage() {
        try {
            const res = await fetch(`${API_BASE}/system-message`);
            if (!res.ok) throw new Error('No message');
            const data = await res.json();
            return data.message || '';
        } catch {
            return '';
        }
    }

    // Inject content into slides
    async function updateCarouselContent() {
        document.getElementById('greetingMessage').textContent = getGreeting();
        const weather = await fetchWeather();
        document.getElementById('weatherMessage').innerHTML =
            `<img src="${weather.icon}" alt="${weather.desc}" class="inline w-6 h-6 align-middle mr-2" />`
            + `Today's weather in <b>${weather.city}</b> is ${weather.desc}, ${weather.temp}&deg;C.`;
        document.getElementById('adminMessage').textContent = await fetchAdminMessage();
    }

    // Carousel logic (vertical auto-slide)
    function showSlide(idx) {
        slides.forEach((slide, i) => {
            slide.setAttribute('aria-hidden', i !== idx);
            slide.style.transform = `translateY(${(i - idx) * 100}%)`;
            slide.style.transition = 'transform 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.7s cubic-bezier(0.4,0,0.2,1)';
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === idx);
        });
        currentSlide = idx;
    }

    function nextSlide() {
        showSlide((currentSlide + 1) % slides.length);
    }
    function prevSlide() {
        showSlide((currentSlide - 1 + slides.length) % slides.length);
    }


    function startCarousel() {
        if (carouselInterval) clearInterval(carouselInterval);
        carouselInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    // Manual controls
    // Manual arrow controls removed
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => { showSlide(i); startCarousel(); });
    });

    // Keyboard navigation
    document.querySelector('.header-carousel').addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') { prevSlide(); startCarousel(); }
        if (e.key === 'ArrowDown') { nextSlide(); startCarousel(); }
    });

    // Init
    showSlide(0);
    updateCarouselContent();
    setInterval(updateCarouselContent, 60000); // update greeting/weather every minute
    startCarousel();

    // Dynamic Background Image Carousel System
    class BackgroundCarousel {
        constructor() {
            this.container = document.getElementById('backgroundCarousel');
            this.images = [
                'Hamad-Exterior-01-1900.jpg',
                'orchard.jpg'
                // Add or remove images here - system will automatically adapt
            ];
            this.currentIndex = 0;
            this.slides = [];
            this.intervalId = null;

            this.init();
        }

        async init() {
            if (!this.container || this.images.length === 0) return;

            // Filter out images that don't exist (dynamic detection)
            this.images = await this.filterAvailableImages();

            if (this.images.length === 0) {
                console.log('No background images found');
                return;
            }

            this.createSlides();
            this.startCarousel();
        }

        async filterAvailableImages() {
            const availableImages = [];

            for (const imageName of this.images) {
                try {
                    const response = await fetch(`../images/${imageName}`, { method: 'HEAD' });
                    if (response.ok) {
                        availableImages.push(imageName);
                    }
                } catch (error) {
                    console.log(`Image ${imageName} not available`);
                }
            }

            return availableImages;
        }

        createSlides() {
            this.container.innerHTML = ''; // Clear existing slides
            this.slides = [];

            this.images.forEach((imageName, index) => {
                const slide = document.createElement('div');
                slide.className = 'bg-slide';
                slide.style.backgroundImage = `url('../images/${imageName}')`;

                if (index === 0) {
                    slide.classList.add('active');
                }

                this.container.appendChild(slide);
                this.slides.push(slide);
            });
        }

        nextSlide() {
            if (this.slides.length <= 1) return;

            // Hide current slide
            this.slides[this.currentIndex].classList.remove('active');

            // Move to next slide
            this.currentIndex = (this.currentIndex + 1) % this.slides.length;

            // Show next slide
            this.slides[this.currentIndex].classList.add('active');
        }

        startCarousel() {
            if (this.slides.length <= 1) return;

            // Change background every 5 seconds
            this.intervalId = setInterval(() => {
                this.nextSlide();
            }, 5000);
        }

        // Method to dynamically add new images
        addImage(imageName) {
            if (!this.images.includes(imageName)) {
                this.images.push(imageName);
                this.refreshCarousel();
            }
        }

        // Method to dynamically remove images
        removeImage(imageName) {
            const index = this.images.indexOf(imageName);
            if (index > -1) {
                this.images.splice(index, 1);
                this.refreshCarousel();
            }
        }

        async refreshCarousel() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }

            this.images = await this.filterAvailableImages();
            this.currentIndex = 0;
            this.createSlides();
            this.startCarousel();
        }
    }

    // Initialize dynamic background carousel
    const bgCarousel = new BackgroundCarousel();

    // Expose carousel methods globally for dynamic management
    window.backgroundCarousel = bgCarousel;

    function updateDateTime() {
        if (!dateTimeEl) return;
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'long' });
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${month} ${day}, ${year}`;
        const timeStr = now.toLocaleTimeString('en-US', { hour12: true });

        const textElement = dateTimeEl.querySelector('.carousel-text');
        if (textElement) {
            textElement.textContent = `${dateStr} | ${timeStr}`;
        }
    }

    async function fetchWeather() {
        if (!weatherEl) return;
        const city = 'Doha';
        try {
            console.log('Fetching weather from:', `${API_BASE}/api/weather?city=${encodeURIComponent(city)}`);
            const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(city)}`);
            console.log('Weather response status:', res.status);

            if (!res.ok) {
                console.error('Weather API error:', res.status, res.statusText);
                const textElement = weatherEl.querySelector('.carousel-text');
                if (textElement) {
                    textElement.textContent = `Weather unavailable (${res.status})`;
                }
                return;
            }
            const data = await res.json();
            console.log('Weather API Response:', data); // Debug log to see what we receive
            console.log('Available fields:', Object.keys(data)); // Show what fields are available

            const textElement = weatherEl.querySelector('.carousel-text');
            if (textElement && data) {
                // Display weather data in the exact format requested
                let weatherText = '';

                if (data.temperature !== undefined && data.condition) {
                    // Format: Temperature: value (feels like value) | Weather Status: fetch live weather status | Humidity: value | Visibility: value | Wind Speed: value | AQI: value | Quality: value

                    const temp = Math.round(data.temperature);
                    const feelsLike = data.feelsLike ? Math.round(data.feelsLike) : temp;
                    const condition = data.condition.charAt(0).toUpperCase() + data.condition.slice(1);
                    const humidity = data.humidity || 'N/A';
                    const visibility = data.visibility || 'N/A';
                    const windSpeed = data.windSpeed ? Math.round(data.windSpeed) : 'N/A';
                    const aqi = data.aqi || 'N/A';
                    const quality = data.aqiStatus || 'N/A';

                    // Check screen width for responsive formatting
                    const isMobile = window.innerWidth < 768;
                    const isTablet = window.innerWidth < 1024;

                    if (isMobile) {
                        // Mobile: Shorter format with line breaks
                        weatherText = `Temp: ${temp}°C (feels ${feelsLike}°C) | ${condition} | Humidity: ${humidity}% | Wind: ${windSpeed}m/s | AQI: ${aqi}`;
                    } else if (isTablet) {
                        // Tablet: Medium format
                        weatherText = `Temperature: ${temp}°C (feels like ${feelsLike}°C) | ${condition} | Humidity: ${humidity}% | Wind: ${windSpeed}m/s | AQI: ${aqi}`;
                    } else {
                        // Desktop: Full format
                        weatherText = `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather Status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility}km | Wind Speed: ${windSpeed}m/s | AQI: ${aqi} | Quality: ${quality}`;
                    }

                    console.log('Complete weather display:', weatherText);
                } else {
                    weatherText = 'Weather data unavailable';
                }

                textElement.textContent = weatherText;
            }
        } catch (err) {
            console.error('Weather fetch error:', err);
            console.error('Error details:', err.message);
            const textElement = weatherEl.querySelector('.carousel-text');
            if (textElement) {
                textElement.textContent = `Weather error: ${err.message}`;
            }
        }
    }

    function initCarousel() {
        const items = document.querySelectorAll('.header-carousel .carousel-item');
        const dots = document.querySelectorAll('.carousel-dot');
        if (!items.length) return;

        let currentIndex = 0;
        let isTransitioning = false; // Prevent overlapping transitions

        function showSlide(index) {
            if (isTransitioning || index === currentIndex) return;

            isTransitioning = true;
            const currentItem = items[currentIndex];
            const nextItem = items[index];

            // Clear all animation classes first
            items.forEach(item => {
                item.classList.remove('active', 'entering', 'exiting');
            });

            // Start exit animation for current item
            if (currentItem) {
                currentItem.classList.add('active', 'exiting');
            }

            // Wait for exit animation to finish, then start enter animation
            setTimeout(() => {
                if (currentItem) {
                    currentItem.classList.remove('active', 'exiting');
                }

                // Start enter animation for new item
                nextItem.classList.add('active', 'entering');

                // Update indicators
                dots.forEach((dot, i) => {
                    dot.classList.toggle('active-dot', i === index);
                });

                // Clean up entering class after animation completes
                setTimeout(() => {
                    nextItem.classList.remove('entering');

                    // Add 5-second delay before allowing next transition
                    setTimeout(() => {
                        isTransitioning = false;
                    }, 5000); // 5-second delay as requested

                }, 1200); // Match the 1.2s enter animation

            }, 600); // Wait for exit animation to complete (0.6s)

            currentIndex = index;
        }

        function nextSlide() {
            if (isTransitioning) return; // Prevent overlapping
            const nextIndex = (currentIndex + 1) % items.length;
            showSlide(nextIndex);
        }

        // Initialize first slide
        items[0].classList.add('active');
        if (dots.length > 0) {
            dots[0].classList.add('active-dot');
        }

        // Add hover pause functionality
        const carousel = document.querySelector('.header-carousel');
        let isPaused = false;
        let intervalId;

        function startCarousel() {
            if (!isPaused) {
                // Total cycle time: 5 seconds delay + 1.8 seconds for transitions = 6.8 seconds
                intervalId = setInterval(nextSlide, 6800);
            }
        }

        function pauseCarousel() {
            clearInterval(intervalId);
            isPaused = true;
        }

        function resumeCarousel() {
            isPaused = false;
            startCarousel();
        }

        carousel.addEventListener('mouseenter', pauseCarousel);
        carousel.addEventListener('mouseleave', resumeCarousel);

        startCarousel();
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);

    fetchWeather();
    setInterval(fetchWeather, 600000);

    initCarousel();

    // Initialize theme toggle
    initThemeToggle();

    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const togglePasswordBtn = document.getElementById('togglePassword');

    // Password toggle functionality
    if (togglePasswordBtn && passwordEl) {
        togglePasswordBtn.addEventListener('click', function () {
            const isPassword = passwordEl.type === 'password';
            passwordEl.type = isPassword ? 'text' : 'password';

            const icon = togglePasswordBtn.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');

            // Add visual feedback
            togglePasswordBtn.style.transform = 'scale(1.1)';
            setTimeout(() => {
                togglePasswordBtn.style.transform = 'scale(1)';
            }, 150);
        });
    }

    function showError(inputEl, message) {
        const group = inputEl.closest('.form-group');
        if (!group) return;
        let span = group.querySelector('.error-message');
        if (!span) {
            span = document.createElement('span');
            span.className = 'error-message modern-error-message';
            span.setAttribute('aria-live', 'polite');
            group.appendChild(span);
        }
        span.textContent = message || '';
        if (message) {
            inputEl.classList.add('invalid');
            inputEl.classList.remove('valid');
            span.style.opacity = 1;
            span.style.transform = 'translateY(0) scale(1.05)';
            span.style.display = 'block';
            setTimeout(() => {
                span.style.transform = 'translateY(0) scale(1)';
            }, 100);
        } else {
            inputEl.classList.remove('invalid');
            inputEl.classList.add('valid');
            span.style.opacity = 0;
            span.style.display = 'none';
        }
    }

    // Modern error message CSS (inject if not present)
    if (!document.getElementById('modern-error-style')) {
        const style = document.createElement('style');
        style.id = 'modern-error-style';
        style.textContent = `
        .modern-error-message {
            background: linear-gradient(90deg, #f87171 0%, #fbbf24 100%);
            color: #fff;
            border-radius: 0.5rem;
            padding: 0.5rem 1rem;
            margin-top: 0.25rem;
            font-size: 0.95em;
            font-weight: 600;
            box-shadow: 0 2px 8px 0 rgba(249, 115, 22, 0.08);
            opacity: 0;
            display: none;
            transition: opacity 0.3s, transform 0.2s;
            position: relative;
            z-index: 2;
        }
        .invalid {
            border-color: #f87171 !important;
            box-shadow: 0 0 0 2px #f8717133;
        }
        `;
        document.head.appendChild(style);
    }

    function resetLoginButton() {
        if (!loginBtn) return;
        loginBtn.disabled = false;
        loginBtn.classList.remove('success', 'success-animation');
        loginBtn.style.background = '';
        loginBtn.innerHTML = `
            <span class="relative z-10 flex items-center justify-center">
                <i class="fas fa-sign-in-alt mr-2"></i>
                Sign in to your account
            </span>
        `;
    }

    function validateEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
    function validatePassword(value) {
        return value.trim().length >= 8;
    }

    function validateField(inputEl) {
        let isValid = true;
        switch (inputEl.id) {
            case 'email':
                isValid = validateEmail(inputEl.value);
                showError(inputEl, isValid ? '' : 'Enter a valid email address 📧');
                break;
            case 'password':
                isValid = validatePassword(inputEl.value);
                showError(passwordEl, isValid ? '' : 'Enter a valid password 🔑');
                break;
        }
        return isValid;
    }

    function validateForm() {
        let valid = true;
        [emailEl, passwordEl].forEach(input => {
            if (!validateField(input)) valid = false;
        });
        return valid;
    }

    [emailEl, passwordEl].forEach(input => {
        input.addEventListener('input', () => validateField(input));
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm()) {
                const firstInvalid = form.querySelector('.invalid');
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            const email = emailEl.value.trim();
            const password = passwordEl.value.trim();

            // Show loading state
            setLoginLoading(true);

            try {
                const res = await fetch(`${API_BASE}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include'
                });

                const data = await res.json();

                if (!res.ok) {
                    resetLoginButton();
                    if (data.message && data.message.toLowerCase().includes('email')) {
                        showError(emailEl, data.message);
                    } else if (data.message && data.message.toLowerCase().includes('password')) {
                        showError(passwordEl, data.message);
                    } else {
                        showError(emailEl, data.message || 'Login failed.');
                    }
                    return;
                }

                sessionStorage.setItem('previousLogin', data.user.lastLogin || '');

                // No animation or success styling, just redirect after login
                setTimeout(() => {
                    switch (data.user.role) {
                        case 'PreApprover':
                            window.location.href = '../preapprover/preapprover.html';
                            break;
                        case 'Approver':
                            window.location.href = '../approver/approver.html';
                            break;
                        case 'Admin':
                            window.location.href = '../admin/admin.html';
                            break;
                        default:
                            window.location.href = '../profile/profile.html';
                    }
                }, 500);

            } catch {
                resetLoginButton();
                showError(passwordEl, 'Network error. Please try again.');
            }
        });
    }

    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.open(
                '../forgot-password/forgot-password.html',
                'ForgotPassword',
                'width=500,height=600,top=100,left=100,resizable=yes,scrollbars=yes'
            );
        });
    }

    // Confetti effect for successful login
    function createConfettiEffect(x, y) {
        const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
        const particles = 15;

        for (let i = 0; i < particles; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.left = x + 'px';
            confetti.style.top = y + 'px';
            confetti.style.width = '6px';
            confetti.style.height = '6px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = '50%';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '9999';

            const angle = (Math.PI * 2 * i) / particles;
            const velocity = 100 + Math.random() * 50;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity - 200;

            confetti.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${vx}px, ${vy + 400}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 1000 + Math.random() * 500,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }).onfinish = () => confetti.remove();

            document.body.appendChild(confetti);
        }
    }

    // Enhanced input focus effects
    [emailEl, passwordEl].forEach(input => {
        if (input) {
            input.addEventListener('focus', function () {
                this.parentElement.classList.add('transform', 'scale-[1.02]');
            });

            input.addEventListener('blur', function () {
                this.parentElement.classList.remove('transform', 'scale-[1.02]');
            });
        }
    });

    // Add loading animation to login button
    function setLoginLoading(loading) {
        if (loading) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `
            <span class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing in...
            </span>
        `;
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
            <span class="relative z-10 flex items-center justify-center">
                <i class="fas fa-sign-in-alt mr-2"></i>
                Sign in to your account
            </span>
        `;
        }
    }

    // Theme toggle initialization function
    function initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');

        if (!themeToggle || !themeIcon) return;

        // Update icon based on current theme
        function updateThemeIcon() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const isDark = currentTheme === 'dark';

            themeIcon.className = isDark ? 'fas fa-sun text-lg' : 'fas fa-moon text-lg';
        }

        // Initialize icon
        updateThemeIcon();

        // Watch for theme changes (from theme.js)
        const observer = new MutationObserver(updateThemeIcon);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        // Add hover effect
        themeToggle.addEventListener('mouseenter', () => {
            themeToggle.style.transform = 'translateY(-1px) scale(1.05)';
        });

        themeToggle.addEventListener('mouseleave', () => {
            themeToggle.style.transform = 'translateY(0) scale(1)';
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    if (!toggle) return;

    // === THEME LOGIC ===
    const savedTheme = sessionStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
        root.setAttribute("data-theme", savedTheme);
    } else {
        root.removeAttribute("data-theme");
    }

    // Apply system preference if no override
    if (!savedTheme) {
        root.setAttribute("data-theme", media.matches ? "dark" : "light");
    }

    // Listen for system changes if no override
    function systemChange(e) {
        if (!sessionStorage.getItem("theme")) {
            root.setAttribute("data-theme", e.matches ? "dark" : "light");
        }
    }
    media.addEventListener?.("change", systemChange);

    // Manual toggle
    function updateIconForTheme(theme) {
        if (!icon) return;
        if (theme === 'dark') {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    function setTheme(newTheme, persist = true) {
        root.setAttribute('data-theme', newTheme);
        if (persist) sessionStorage.setItem('theme', newTheme);
        updateIconForTheme(newTheme);
        // Accessibility: update aria attributes on the toggle button
        if (toggle) {
            const pressed = newTheme === 'dark';
            toggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            toggle.setAttribute('aria-label', pressed ? 'Switch to light theme' : 'Switch to dark theme');
            // animate icon rotation
            if (icon) {
                icon.classList.add('rotate-icon');
                // remove rotation after animation completes
                setTimeout(() => icon.classList.remove('rotate-icon'), 450);
            }
        }
    }

    if (toggle) {
        toggle.addEventListener("click", () => {
            const currentTheme = root.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            setTheme(newTheme, true);
        });
    }

    // === RESTORE POSITION ===
    const savedPos = localStorage.getItem("togglePos");
    if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        if (toggle) {
            toggle.style.left = left + "px";
            toggle.style.top = top + "px";
            toggle.style.right = "auto";
            toggle.style.bottom = "auto";
        }
    }
    // Sync initial icon
    const initialTheme = root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
    updateIconForTheme(initialTheme);
    // Set initial aria state on toggle
    if (toggle) {
        const pressed = initialTheme === 'dark';
        toggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        toggle.setAttribute('aria-label', pressed ? 'Switch to light theme' : 'Switch to dark theme');
    }
    // Expose setTheme globally for other scripts if needed
    window.setTheme = setTheme;
});

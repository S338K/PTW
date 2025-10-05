document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    // Initialize based on system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    toggle.checked = prefersDark;

    // Apply saved override if exists
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        root.setAttribute("data-theme", savedTheme);
        toggle.checked = savedTheme === "dark";
    }

    // Listen for system changes (only if no manual override)
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
        if (!localStorage.getItem("theme")) {
            const isDark = e.matches;
            toggle.checked = isDark;
            root.removeAttribute("data-theme"); // let system CSS apply
        }
    });

    // Manual toggle
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            root.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
        } else {
            root.setAttribute("data-theme", "light");
            localStorage.setItem("theme", "light");
        }
    });
});

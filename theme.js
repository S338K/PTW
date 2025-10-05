document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");

    // Initialize based on system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    toggle.checked = prefersDark;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");

    // Listen for system changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
        const isDark = e.matches;
        toggle.checked = isDark;
        root.setAttribute("data-theme", isDark ? "dark" : "light");
    });

    // Manual toggle
    toggle.addEventListener("change", () => {
        const newTheme = toggle.checked ? "dark" : "light";
        root.setAttribute("data-theme", newTheme);
    });
});

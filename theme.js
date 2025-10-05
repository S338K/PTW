document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    if (!toggle) return;

    // Apply saved override from sessionStorage, or system if none
    const saved = sessionStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
        root.setAttribute("data-theme", saved);
        toggle.checked = saved === "dark";
    } else {
        root.removeAttribute("data-theme"); // system decides
        toggle.checked = media.matches;
    }

    // Listen for system changes (only if no override)
    function systemChange(e) {
        if (!sessionStorage.getItem("theme")) {
            root.removeAttribute("data-theme");
            toggle.checked = e.matches;
        }
    }
    if (media.addEventListener) {
        media.addEventListener("change", systemChange);
    } else if (media.addListener) {
        media.addListener(systemChange); // legacy fallback
    }

    // Manual toggle
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            root.setAttribute("data-theme", "dark");
            sessionStorage.setItem("theme", "dark");
        } else {
            root.setAttribute("data-theme", "light");
            sessionStorage.setItem("theme", "light");
        }
    });
});

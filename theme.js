document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggle = document.getElementById("themeToggle");
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
    toggle.addEventListener("click", () => {
        const currentTheme = root.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", newTheme);
        sessionStorage.setItem("theme", newTheme);
    });

    // === RESTORE POSITION ===
    const savedPos = localStorage.getItem("togglePos");
    if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        toggle.style.left = left + "px";
        toggle.style.top = top + "px";
        toggle.style.right = "auto";
        toggle.style.bottom = "auto";
    }
});

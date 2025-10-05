document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const toggleBtn = document.getElementById("themeToggle");

    if (!toggleBtn) return;

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
        root.setAttribute("data-theme", savedTheme);
        toggleBtn.textContent = savedTheme === "dark" ? "🌞" : "🌙";
    } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        toggleBtn.textContent = prefersDark ? "🌞" : "🌙";
    }

    toggleBtn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        toggleBtn.textContent = next === "dark" ? "🌞" : "🌙";
    });
});

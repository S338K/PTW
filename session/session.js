// session.js
// Centralized session management for all protected pages

const API_BASE = "https://ptw-yu8u.onrender.com";

/* ===== Check if session is valid ===== */
export async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/api/profile`, {
            method: "GET",
            credentials: "include" // send cookies/session
        });

        if (!res.ok) {
            // Session invalid → redirect to login
            window.location.href = "index.html";
            return null;
        }

        const user = await res.json();
        console.log("✅ Session valid:", user);
        return user;
    } catch (err) {
        console.error("❌ Session check failed:", err);
        window.location.href = "index.html";
        return null;
    }
}

/* ===== Idle Timeout Auto‑Logout ===== */
const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes
let idleTimer;

export function initIdleTimer() {
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(logoutUser, IDLE_LIMIT);
    }

    ["mousemove", "keydown", "click", "scroll"].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer)
    );

    resetIdleTimer();
}

/* ===== Logout Helper ===== */
export async function logoutUser() {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            method: "POST",
            credentials: "include"
        });
    } catch (err) {
        console.error("Logout request failed:", err);
    } finally {
        alert("Session expired or logged out. Please login again.");
        window.location.href = "index.html";
    }
}

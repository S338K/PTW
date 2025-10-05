// session.js
// Centralized session management for all protected pages

const API_BASE = "https://ptw-yu8u.onrender.com";

/* ===== Check if session is valid ===== */

export async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/api/profile`, {
            method: "GET",
            credentials: "include"
        });

        // ✅ Only redirect if truly unauthorized
        if (res.status === 401 || res.status === 403) {
            window.location.href = "index.html";
            return null;
        }

        if (!res.ok) {
            console.error("Unexpected error from /api/profile:", res.status);
            return null; // don’t redirect on other errors
        }

        return await res.json();
    } catch (err) {
        console.error("Session check failed:", err);
        return null; // don’t redirect on network error
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

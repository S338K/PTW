// session.js
// Centralized session management for all protected pages

import { API_BASE } from './config.js';

/* ===== Check if session is valid ===== */

// session/session.js
function getLoginUrl() {
    // Handle GitHub Pages project sites (e.g., https://<user>.github.io/<repo>/...)
    // by prefixing the repo segment to the login path. Locally, this stays root-relative.
    try {
        const { hostname, pathname } = window.location;
        let prefix = '';
        if (hostname.endsWith('github.io')) {
            const segments = pathname.split('/').filter(Boolean);
            if (segments.length > 0) prefix = `/${segments[0]}`; // '/<repo>'
        }
        return `${prefix}/login/index.html`;
    } catch (_) {
        return '/login/index.html';
    }
}

export async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/api/profile`, { credentials: "include" });

        if (res.status === 401 || res.status === 403) {
            window.location.assign(getLoginUrl());
            return null;
        }

        if (!res.ok) {
            console.error("Unexpected error from /api/profile:", res.status);
            return null;
        }

        const data = await res.json();
        // Flatten: return user fields + role from session and include clientIp if provided
        const merged = { ...data.user, role: data.session.role };
        if (data.clientIp) merged.clientIp = data.clientIp;
        return merged;
    } catch (err) {
        console.error("Session check failed:", err);
        return null;
    }
}



/* ===== Idle Timeout Auto‑Logout ===== */
const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes total
// Show warning when 3 minutes remain
const WARNING_TIME = 3 * 60 * 1000; // 3 minutes warning
let idleTimer;
let warningTimer;
let countdownInterval;

export function initIdleTimer() {
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        hideIdleWarning();
        // Schedule warning when WARNING_TIME remains
        const warningDelay = IDLE_LIMIT - WARNING_TIME; // e.g., 7 minutes of activity before a 3-minute warning
        warningTimer = setTimeout(showIdleWarning, warningDelay);
        // Auto-logout will be triggered if the countdown reaches zero without user action
        idleTimer = null;
    }

    // Track user activity to reset timers. When the warning modal is showing we ignore activity
    ["mousemove", "keydown", "click", "scroll"].forEach(evt =>
        document.addEventListener(evt, (e) => {
            // If warning modal visible, do not reset timers until user explicitly chooses to continue
            if (document.getElementById('idleWarningModal') && document.getElementById('idleWarningModal').style.display === 'flex') {
                return;
            }
            resetIdleTimer(e);
        })
    );

    resetIdleTimer();
}

/* ===== Idle warning UI ===== */
function createIdleWarning() {
    // Modal exists in the page markup (admin.html). No dynamic element creation here.
    return;
}

function showIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    const countdownEl = document.getElementById('idleWarningCountdown');
    const textEl = document.getElementById('idleWarningText');
    if (!modal || !countdownEl || !textEl) return;

    // remaining time starts at WARNING_TIME (3 minutes)
    let remainingMs = WARNING_TIME;

    // Prevent any scheduled auto-logout while modal is visible
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }

    // show modal and blur background
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    textEl.textContent = 'Your session is about to expire due to inactivity. Please choose on "Continue" to stay logged in or you will be logged out automatically.';

    // Wire buttons (idempotent)
    const extendBtn = document.getElementById('idleExtendBtn');
    const logoutBtn = document.getElementById('idleLogoutBtn');

    const cleanup = () => {
        clearInterval(countdownInterval);
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
    };

    if (extendBtn) {
        extendBtn.onclick = async () => {
            try {
                await fetch(`${API_BASE}/api/ping`, { credentials: 'include' });
            } catch (err) {
                console.warn('Keepalive ping failed', err);
            }
            // reset timers by dispatching an artificial activity event
            const ev = new Event('mousemove');
            document.dispatchEvent(ev);
            cleanup();
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            cleanup();
            logoutUser();
        };
    }

    function update() {
        if (remainingMs <= 0) {
            // Auto-logout immediately when timer reaches zero
            countdownEl.textContent = '0:00';
            clearInterval(countdownInterval);
            logoutUser();
            return;
        }
        const totalSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        remainingMs -= 1000;
    }

    update();
    countdownInterval = setInterval(update, 1000);
}

function hideIdleWarning() {
    const modal = document.getElementById('idleWarningModal');
    if (!modal) return;
    modal.style.display = 'none';
    clearInterval(countdownInterval);
    // Restore scroll/interactions
    if (document.body.dataset.prevOverflow !== undefined) {
        document.body.style.overflow = document.body.dataset.prevOverflow;
        delete document.body.dataset.prevOverflow;
    }
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
        window.location.assign(getLoginUrl());
    }
}

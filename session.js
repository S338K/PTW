// session.js
// Centralized session management for all protected pages

import { API_BASE } from './config.js';

/* ===== Check if session is valid ===== */
// session/session.js

export async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/api/profile`, { credentials: "include" });

        if (res.status === 401 || res.status === 403) {
            window.location.href = "/login/index.html";
            return null;
        }

        if (!res.ok) {
            console.error("Unexpected error from /api/profile:", res.status);
            return null;
        }

        const data = await res.json();
        // Flatten: return user fields + role from session
        return { ...data.user, role: data.session.role };
    } catch (err) {
        console.error("Session check failed:", err);
        return null;
    }
}



/* ===== Idle Timeout Auto‑Logout ===== */
const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes
let idleTimer;
let warningTimer;
let countdownInterval;

export function initIdleTimer() {
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        hideIdleWarning();
        // schedule warning 3 minutes before logout
        const reminderBeforeMs = 3 * 60 * 1000; // 3 minutes
        const warningDelay = Math.max(IDLE_LIMIT - reminderBeforeMs, Math.floor(IDLE_LIMIT * 0.5));
        warningTimer = setTimeout(showIdleWarning, warningDelay);
        idleTimer = setTimeout(logoutUser, IDLE_LIMIT);
    }

    ["mousemove", "keydown", "click", "scroll"].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer)
    );

    resetIdleTimer();
}

/* ===== Idle warning UI ===== */
function createIdleWarning() {
    if (document.getElementById('idleWarningModal')) return;

    const modal = document.createElement('div');
    modal.id = 'idleWarningModal';
    modal.className = '';
    Object.assign(modal.style, {
        position: 'fixed', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', zIndex: '99999', backdropFilter: 'blur(3px)'
    });

    const box = document.createElement('div');
    box.className = 'iw-box';
    Object.assign(box.style, {
        background: '#fff', color: '#111', padding: '20px 24px', borderRadius: '12px', width: 'min(520px, 92vw)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    });

    const title = document.createElement('h3');
    title.textContent = 'Session Expiration Warning';
    title.style.marginTop = '0';

    const msg = document.createElement('p');
    msg.id = 'idleWarningMsg';
    msg.textContent = '';

    const countdown = document.createElement('p');
    countdown.id = 'idleWarningCountdown';
    countdown.style.fontWeight = '600';

    const btnRow = document.createElement('div');
    btnRow.className = 'iw-btn-row';
    Object.assign(btnRow.style, { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' });

    const extendBtn = document.createElement('button');
    extendBtn.textContent = 'Extend Session';
    extendBtn.className = 'iw-btn extend';
    Object.assign(extendBtn.style, { padding: '8px 14px', borderRadius: '8px', border: '1px solid #28a745', background: '#28a745', color: '#fff', cursor: 'pointer' });
    extendBtn.onclick = async () => {
        try {
            // call backend to touch session
            await fetch(`${API_BASE}/api/ping`, { credentials: 'include' });
        } catch (err) {
            console.warn('Keepalive ping failed', err);
        }
        // reset timers and close modal
        const ev = new Event('mousemove');
        document.dispatchEvent(ev);
        hideIdleWarning();
    };

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Logout Now';
    logoutBtn.className = 'iw-btn logout';
    Object.assign(logoutBtn.style, { padding: '8px 14px', borderRadius: '8px', border: '1px solid #dc3545', background: '#dc3545', color: '#fff', cursor: 'pointer' });
    logoutBtn.onclick = () => {
        hideIdleWarning();
        logoutUser();
    };

    btnRow.appendChild(extendBtn);
    btnRow.appendChild(logoutBtn);

    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(countdown);
    box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
}

function showIdleWarning() {
    createIdleWarning();
    const modal = document.getElementById('idleWarningModal');
    const countdownEl = document.getElementById('idleWarningCountdown');
    const msgEl = document.getElementById('idleWarningMsg');
    if (!modal || !countdownEl || !msgEl) return;

    // Time until logout from now: compute remaining from idleTimer
    // We'll re-use IDLE_LIMIT to show remaining up to 3 minutes
    // Always show a 3-minute countdown window before auto logout
    let remainingMs = Math.min(3 * 60 * 1000, IDLE_LIMIT);

    modal.style.display = 'flex';
    // Block page scroll/interactions while visible
    const prevOverflow = document.body.style.overflow;
    document.body.dataset.prevOverflow = prevOverflow;
    document.body.style.overflow = 'hidden';
    msgEl.textContent = 'Your session will expire soon. Would you like to extend it?';

    function update() {
        if (remainingMs <= 0) {
            countdownEl.textContent = 'Expired';
            clearInterval(countdownInterval);
            // enforce logout to be safe
            logoutUser();
            return;
        }
        const s = Math.floor((remainingMs / 1000) % 60).toString().padStart(2, '0');
        const m = Math.floor((remainingMs / (1000 * 60)) % 60).toString().padStart(2, '0');
        countdownEl.textContent = `${m}:${s} remaining`;
        remainingMs -= 1000;
    }

    // start immediate update and interval
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
        window.location.href = "/login/index.html";
    }
}

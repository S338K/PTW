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
        // Flatten: return user fields + role from session
        return { ...data.user, role: data.session.role };
    } catch (err) {
        console.error("Session check failed:", err);
        return null;
    }
}



/* ===== Idle Timeout Auto‑Logout ===== */
const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes total
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes warning
let idleTimer;
let warningTimer;
let countdownInterval;

export function initIdleTimer() {
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        hideIdleWarning();
        // schedule warning 5 minutes before logout
        const warningDelay = IDLE_LIMIT - WARNING_TIME; // 10 minutes of activity before warning
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
        background: 'rgba(0,0,0,0.7)', zIndex: '99999', backdropFilter: 'blur(8px)', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    });

    const box = document.createElement('div');
    box.className = 'iw-box';
    Object.assign(box.style, {
        background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
        color: '#1f2937',
        padding: '32px',
        borderRadius: '20px',
        width: 'min(480px, 90vw)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        textAlign: 'center',
        animation: 'modalSlideIn 0.4s ease-out'
    });

    // Add CSS animation
    if (!document.querySelector('#modalAnimation')) {
        const style = document.createElement('style');
        style.id = 'modalAnimation';
        style.textContent = `
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            @keyframes pulseRed {
                0%, 100% { background-color: #ef4444; }
                50% { background-color: #dc2626; }
            }
            .pulse-warning {
                animation: pulseRed 1s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    // Warning Icon
    const icon = document.createElement('div');
    icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    Object.assign(icon.style, {
        fontSize: '3rem',
        color: '#f59e0b',
        marginBottom: '16px'
    });

    const title = document.createElement('h3');
    title.textContent = 'Session Expiring Soon';
    Object.assign(title.style, {
        margin: '0 0 12px 0',
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#1f2937'
    });

    const msg = document.createElement('p');
    msg.id = 'idleWarningMsg';
    msg.textContent = 'You will be automatically logged out due to inactivity.';
    Object.assign(msg.style, {
        margin: '0 0 20px 0',
        fontSize: '1rem',
        color: '#6b7280',
        lineHeight: '1.5'
    });

    const countdown = document.createElement('div');
    countdown.id = 'idleWarningCountdown';
    Object.assign(countdown.style, {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#ef4444',
        margin: '20px 0',
        padding: '16px 24px',
        background: '#fef2f2',
        border: '2px solid #fecaca',
        borderRadius: '12px',
        fontFamily: 'monospace'
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'iw-btn-row';
    Object.assign(btnRow.style, {
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        marginTop: '24px'
    });

    const extendBtn = document.createElement('button');
    extendBtn.innerHTML = '<i class="fas fa-clock mr-2"></i>Continue Session';
    extendBtn.className = 'iw-btn extend';
    Object.assign(extendBtn.style, {
        padding: '12px 24px',
        borderRadius: '12px',
        border: '2px solid #10b981',
        background: '#10b981',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    extendBtn.onmouseenter = () => {
        extendBtn.style.background = '#059669';
        extendBtn.style.transform = 'translateY(-1px)';
        extendBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.3)';
    };

    extendBtn.onmouseleave = () => {
        extendBtn.style.background = '#10b981';
        extendBtn.style.transform = 'translateY(0)';
        extendBtn.style.boxShadow = 'none';
    };

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
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Logout Now';
    logoutBtn.className = 'iw-btn logout';
    Object.assign(logoutBtn.style, {
        padding: '12px 24px',
        borderRadius: '12px',
        border: '2px solid #ef4444',
        background: '#ef4444',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    logoutBtn.onmouseenter = () => {
        logoutBtn.style.background = '#dc2626';
        logoutBtn.style.transform = 'translateY(-1px)';
        logoutBtn.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.3)';
    };

    logoutBtn.onmouseleave = () => {
        logoutBtn.style.background = '#ef4444';
        logoutBtn.style.transform = 'translateY(0)';
        logoutBtn.style.boxShadow = 'none';
    };

    logoutBtn.onclick = () => {
        hideIdleWarning();
        logoutUser();
    };

    btnRow.appendChild(extendBtn);
    btnRow.appendChild(logoutBtn);

    box.appendChild(icon);
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

    // Show 5-minute countdown (WARNING_TIME)
    let remainingMs = WARNING_TIME; // 5 minutes

    modal.style.display = 'flex';
    // Block page scroll/interactions while visible
    const prevOverflow = document.body.style.overflow;
    document.body.dataset.prevOverflow = prevOverflow;
    document.body.style.overflow = 'hidden';
    msgEl.textContent = 'You will be automatically logged out due to inactivity.';

    function update() {
        if (remainingMs <= 0) {
            countdownEl.textContent = 'Session Expired';
            countdownEl.style.background = '#fee2e2';
            countdownEl.style.borderColor = '#fca5a5';
            countdownEl.style.color = '#dc2626';
            clearInterval(countdownInterval);
            // enforce logout to be safe
            logoutUser();
            return;
        }

        const totalSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Add pulsing effect when under 1 minute
        if (remainingMs <= 60000) {
            countdownEl.classList.add('pulse-warning');
        }

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
        window.location.assign(getLoginUrl());
    }
}

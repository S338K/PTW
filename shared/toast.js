// Shared toast helper used across pages (login and pages using shared layout)
// Exposes window.showToast(type, message, opts?) and window.dismissToast(el)
(function () {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        // already present, do nothing
        return;
    }

    // Track the currently displayed toast to ensure only one is visible at a time
    let currentToast = null;

    function ensureToastContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            c.setAttribute('aria-live', 'polite');
            c.style.position = 'fixed';
            c.style.top = '16px';
            c.style.right = '16px';
            c.style.zIndex = '9999';
            c.style.display = 'flex';
            c.style.flexDirection = 'column';
            c.style.gap = '8px';
            c.style.pointerEvents = 'none';
            document.body.appendChild(c);
        }
        return c;
    }

    function dismissToast(el) {
        if (!el) return;
        if (currentToast === el) currentToast = null;
        // use opacity/transform transition for exit so CSS can control colors
        try {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
        } catch (e) { }
        setTimeout(() => { try { el.remove(); } catch (e) { } }, 220);
    }

    function makeToastEl(type, message) {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        // Do not set colors here — leave coloring to shared layout stylesheet (.toast--<type>)
        toast.style.padding = '12px 14px';
        toast.style.borderRadius = '10px';
        toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        toast.style.display = 'flex';
        toast.style.gap = '10px';
        toast.style.alignItems = 'center';
        toast.style.pointerEvents = 'auto';
        toast.style.minWidth = '220px';
        toast.style.maxWidth = '420px';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 160ms ease, transform 200ms cubic-bezier(.2,.9,.2,1)';
        toast.style.transform = 'translateY(-6px)';

        toast.innerHTML = `
            <div style="flex:0 0 auto; font-size:18px;line-height:1">${type === 'success' ? '<i class="fas fa-check-circle"></i>' : (type === 'info' ? '<i class="fas fa-info-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>')}</div>
            <div style="flex:1 1 auto; font-size:14px; line-height:1.2">${String(message)}</div>
            <button style="flex:0 0 auto; background:transparent; border:none; color:inherit; font-size:18px; cursor:pointer;" class="toast-close" aria-label="Dismiss">&times;</button>
        `;
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => dismissToast(toast));
        // Use transitionend for our fade-out fallback
        toast.addEventListener('transitionend', (ev) => { if (ev.propertyName === 'opacity' && toast.style.opacity === '0') toast.remove(); });
        return toast;
    }

    function showToast(type, message, opts = {}) {
        try {
            const container = ensureToastContainer();
            // Remove any existing toast immediately to enforce singleton behavior
            if (currentToast && currentToast.parentNode) {
                try { currentToast.remove(); } catch (_) { /* ignore */ }
                currentToast = null;
            } else {
                // As a safety net, remove any lingering .toast elements
                Array.from(container.querySelectorAll('.toast')).forEach(el => { try { el.remove(); } catch (_) { } });
            }

            const t = makeToastEl(type, message);
            currentToast = t;
            container.insertBefore(t, container.firstChild);
            // trigger enter transition
            requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
            const timeout = opts.timeout || (type === 'success' ? 2200 : 4800);
            let to = setTimeout(() => dismissToast(t), timeout);
            t.addEventListener('mouseenter', () => { if (to) { clearTimeout(to); to = null; } });
            t.addEventListener('mouseleave', () => { if (!to) { to = setTimeout(() => dismissToast(t), 1600); } });
            t.addEventListener('removed', () => { if (currentToast === t) currentToast = null; });
            return t;
        } catch (e) { /* ignore */ }
    }

    window.showToast = showToast;
    window.dismissToast = dismissToast;
})();

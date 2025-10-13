// config.js
// config.js
// Dynamically select API base at runtime so local testing can target a local
// backend while production pages use the Render-hosted backend.
// Resolution order (highest -> lowest):
// 1. window.__API_BASE__ (set in DevTools or page before modules load)
// 2. localStorage.API_BASE (useful for quick overrides)
// 3. localhost / 127.0.0.1 => http://127.0.0.1:5000
// 4. default production endpoint

const DEFAULT_PROD = 'https://ptw-yu8u.onrender.com';

function detectApiBase() {
    try {
        if (typeof window === 'undefined') return DEFAULT_PROD;
        const globalOverride = (window.__API_BASE__ || '').toString().trim();
        if (globalOverride) return globalOverride;
        const storage = localStorage.getItem('API_BASE');
        if (storage && storage.trim()) return storage.trim();

        const host = window.location.hostname;
        // common local dev hosts
        if (host === '127.0.0.1' || host === 'localhost') return 'http://127.0.0.1:5000';
        // file:// or unknown hosts fall back to production
        return DEFAULT_PROD;
    } catch (e) {
        return DEFAULT_PROD;
    }
}

const API_BASE = detectApiBase();

export { API_BASE };

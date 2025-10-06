// config.js
let API_BASE;

if (window.location.hostname === "127.0.0.1") {
    // Match 127.0.0.1 origin to keep cookies same-site
    API_BASE = "http://127.0.0.1:5000";
} else if (window.location.hostname === "localhost") {
    // Local development backend on localhost
    API_BASE = "http://localhost:5000";
} else {
    // Production backend (Render)
    API_BASE = "https://ptw-yu8u.onrender.com";
}

export { API_BASE };

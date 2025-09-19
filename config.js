// config.js
let API_BASE;

if (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
) {
    // Local development backend
    API_BASE = "http://localhost:3000";
} else {
    // Production backend (Render)
    API_BASE = "https://ptw-yu8u.onrender.com";
}

export { API_BASE };

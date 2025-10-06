import { checkSession, initIdleTimer, logoutUser } from "../session.js";
import { formatDate24, formatLastLogin } from "../date-utils.js";
import { API_BASE } from '../config.js';

/* ===== Constants ===== */

/* ===== Role normalization (fix Pre-Approver mismatch) =====
   Adjust the right-hand values to match your backend enum if needed.
   If your backend expects "PreApprover" (no hyphen), this mapping ensures compatibility.
*/
const ROLE_MAP = {
    "admin": "Admin",
    "approver": "Approver",
    "pre-approver": "PreApprover",
    "preapprover": "PreApprover",
    "pre approver": "PreApprover",
    "requester": "Requester",
    "user": "User",
};

/* ===== Toast ===== */
function showToast(message, type = "success", duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) {
        console[type === "error" ? "error" : "log"](message);
        return;
    }
    // reset
    toast.textContent = message;
    toast.classList.remove("error", "success", "warning", "show");
    // force reflow to restart animation
    void toast.offsetWidth;
    toast.classList.add("show", type);
    // remove show after duration
    setTimeout(() => {
        toast.classList.remove("show");
    }, duration);
}

/* ===== Validation helpers ===== */
function showFieldError(input, message) {
    const msgEl = input.nextElementSibling;
    if (msgEl && msgEl.classList.contains("error-msg")) {
        msgEl.textContent = message;
        msgEl.classList.add("active");
        input.classList.add("error");
    }
}
function clearFieldError(input) {
    const msgEl = input.nextElementSibling;
    if (msgEl && msgEl.classList.contains("error-msg")) {
        msgEl.textContent = "";
        msgEl.classList.remove("active");
        input.classList.remove("error");
    }
}
function validateField(form, input) {
    const value = input.value.trim();
    const label = form?.querySelector(`label[for="${input.id}"]`)?.textContent || input.name;

    if (input.hasAttribute("required") && !value) {
        showFieldError(input, `${label} is required`);
        return false;
    }
    if (input.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        showFieldError(input, `Please enter a valid ${label}`);
        return false;
    }
    if (input.name === "mobile" && value && !/^[0-9]{8,15}$/.test(value)) {
        showFieldError(input, `Please enter a valid ${label} (8–15 digits)`);
        return false;
    }
    if (input.name === "confirmPassword") {
        const pw = form?.querySelector('[name="password"]')?.value || "";
        if (value && value !== pw) {
            showFieldError(input, "Passwords do not match");
            return false;
        }
    }
    clearFieldError(input);
    return true;
}

/* ===== Count-up animation ===== */
function countUp(el, target, duration = 800) {
    if (!el) return;
    const start = Number(el.textContent) || 0;
    const startTime = performance.now();
    const diff = target - start;

    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const value = Math.round(start + diff * progress);
        el.textContent = String(value);
        el.setAttribute("data-value", String(value));
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

/* ===== Theme colors for charts ===== */
function getThemeColors() {
    const root = document.documentElement;
    const getVar = (name) => getComputedStyle(root).getPropertyValue(name).trim() || "";
    return {
        text: getVar("--text-primary") || "#273172",
        primary: getVar("--button-bg") || "#273172",
        surface: getVar("--bg-surface") || "#ffffff",
    };
}

// Format a Date in 24-hour format consistently across the UI
function formatDate24(d) {
    if (!d) return "";
    const date = (d instanceof Date) ? d : new Date(d);
    const fmtOptions = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return date.toLocaleString(undefined, fmtOptions);
}

/* ===== Wait for Chart.js (since HTML loads it after admin.js) ===== */
function waitForChart(maxWaitMs = 3000) {
    return new Promise((resolve, reject) => {
        const started = performance.now();
        (function check() {
            if (window.Chart) return resolve(window.Chart);
            if (performance.now() - started > maxWaitMs) return resolve(null);
            setTimeout(check, 50);
        })();
    });
}

/* ===== Users table ===== */
async function loadUsers() {
    const table = document.getElementById("usersTable");
    const tbody = table?.querySelector("tbody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    tbody.innerHTML = "";
    const headers = Array.from(thead.querySelectorAll("th")).map((th) =>
        th.textContent.trim().toLowerCase()
    );

    try {
        const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load users");
        const users = await res.json();

        users.forEach((u) => {
            const tr = document.createElement("tr");
            headers.forEach((h) => {
                const td = document.createElement("td");
                switch (h) {
                    case "name":
                        td.textContent = u.fullName || u.username || "—";
                        break;
                    case "role":
                        td.textContent = u.role || "—";
                        break;
                    case "status":
                        td.textContent = u.status || "—";
                        break;
                    case "registered":
                        td.textContent = u.registered
                            ? formatDate24(u.registered)
                            : u.createdAt
                                ? formatDate24(u.createdAt)
                                : "—";
                        break;
                    case "last login":
                        td.textContent = u.lastLogin ? formatLastLogin(u.lastLogin) : "—";
                        break;
                    case "actions":
                        td.classList.add("actions");
                        const idAttr = u.id || u._id;
                        td.innerHTML = `
              <button class="btn reset" data-id="${idAttr}">Reset Password</button>
              <button class="btn view" data-id="${idAttr}">View Profile</button>
              <button class="btn toggle" data-id="${idAttr}" data-status="${u.status || ""}">
                ${u.status === "Active" ? "Disable" : "Enable"}
              </button>`;
                        break;
                    default:
                        td.textContent = "—";
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        // Wire actions
        tbody.querySelectorAll(".btn.reset").forEach((b) =>
            b.addEventListener("click", () => resetPassword(b.dataset.id))
        );
        tbody.querySelectorAll(".btn.view").forEach((b) =>
            b.addEventListener("click", () => viewProfile(b.dataset.id))
        );
        tbody.querySelectorAll(".btn.toggle").forEach((b) =>
            b.addEventListener("click", () => toggleUser(b.dataset.id, b.dataset.status))
        );
    } catch (err) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="${thead.querySelectorAll("th").length}">Failed to load users</td>`;
        tbody.appendChild(tr);
        showToast("⚠️ Failed to load users", "error");
    }
}

/* ===== Permits table ===== */
async function loadPermits() {
    const table = document.getElementById("permitsTable");
    const tbody = table?.querySelector("tbody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    tbody.innerHTML = "";
    const headers = Array.from(thead.querySelectorAll("th")).map((th) =>
        th.textContent.trim().toLowerCase()
    );

    try {
        const res = await fetch(`${API_BASE}/admin/permits`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load permits");
        const permits = await res.json();

        permits.forEach((p) => {
            const tr = document.createElement("tr");
            headers.forEach((h) => {
                const td = document.createElement("td");
                switch (h) {
                    case "id":
                        td.textContent = p.id || p._id || "—";
                        break;
                    case "title":
                        td.textContent = p.title || p.permitTitle || "—";
                        break;
                    case "permit no.":
                        td.textContent = p.permitNumber || "—";
                        break;
                    case "submitted":
                        td.textContent = p.submitted
                            ? formatDate24(p.submitted)
                            : p.createdAt
                                ? formatDate24(p.createdAt)
                                : "—";
                        break;
                    case "requester name":
                        td.textContent = p.requesterName || p.requester || "—";
                        break;
                    case "status":
                        td.textContent = p.status || "—";
                        break;
                    case "actions":
                        td.classList.add("actions");
                        td.innerHTML = `<button class="btn view" data-id="${p.id || p._id}">View</button>`;
                        break;
                    default:
                        td.textContent = "—";
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll(".btn.view").forEach((b) =>
            b.addEventListener("click", () => viewPermit(b.dataset.id))
        );
    } catch (err) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="${thead.querySelectorAll("th").length}">Failed to load permits</td>`;
        tbody.appendChild(tr);
        showToast("⚠️ Failed to load permits", "error");
    }
}

/* ===== Stats + Charts ===== */
let charts = {
    userStatusChart: null,
    userRoleChart: null,
    permitStatusChart: null,
};

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/stats`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load stats");
        const stats = await res.json();

        // Ensure numeric defaults to avoid NaN and chart errors
        stats.totalUsers = Number(stats.totalUsers || 0);
        stats.totalPermits = Number(stats.totalPermits || 0);
        stats.activeUsers = Number(stats.activeUsers || 0);
        stats.requesters = Number(stats.requesters || 0);
        stats.preApprovers = Number(stats.preApprovers || 0);
        stats.approvers = Number(stats.approvers || 0);
        stats.pending = Number(stats.pending || 0);
        stats.inProgress = Number(stats.inProgress || 0);
        stats.approved = Number(stats.approved || 0);
        stats.rejected = Number(stats.rejected || 0);
        stats.closedPermits = Number(stats.closedPermits || 0);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = val;
            el.setAttribute("data-value", val);
        };

        // Totals (with count-up)
        const totalUsersEl = document.getElementById("statUsers");
        if (totalUsersEl) {
            totalUsersEl.setAttribute("data-value", stats.totalUsers);
            countUp(totalUsersEl, stats.totalUsers);
        }

        const totalPermitsEl = document.getElementById("statPermits");
        if (totalPermitsEl) {
            totalPermitsEl.setAttribute("data-value", stats.totalPermits);
            countUp(totalPermitsEl, stats.totalPermits);
        }

        // Breakdown
        setVal("statActiveUsers", stats.activeUsers);
        setVal("statInactiveUsers", stats.totalUsers - stats.activeUsers);
        setVal("statPending", stats.pending);
        setVal("statInProgress", stats.inProgress);
        setVal("statApproved", stats.approved);
        setVal("statRejected", stats.rejected);

        // Wait for Chart.js (HTML loads it after admin.js)
        const ChartLib = await waitForChart();
        const theme = getThemeColors();

        // User Status doughnut
        const userStatusCanvas = document.getElementById("userStatusChart");
        if (userStatusCanvas) {
            if (charts.userStatusChart?.destroy) charts.userStatusChart.destroy();
            const ChartCtor = ChartLib || window.Chart;
            if (!ChartCtor) throw new Error('Chart.js not available');
            charts.userStatusChart = new ChartCtor(userStatusCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Active", "Inactive"],
                    datasets: [
                        {
                            data: [stats.activeUsers, stats.totalUsers - stats.activeUsers],
                            backgroundColor: ["#1a7f37", "#b42318"],
                            borderColor: theme.surface,
                            borderWidth: 2,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: "bottom", labels: { color: theme.text } } },
                },
            });
        }

        // User Roles bar
        const userRoleCanvas = document.getElementById("userRoleChart");
        if (userRoleCanvas) {
            if (charts.userRoleChart?.destroy) charts.userRoleChart.destroy();
            const ChartCtor2 = ChartLib || window.Chart;
            if (!ChartCtor2) throw new Error('Chart.js not available');
            charts.userRoleChart = new ChartCtor2(userRoleCanvas, {
                type: "bar",
                data: {
                    labels: ["Requester", "Pre‑Approver", "Approver"],
                    datasets: [
                        {
                            label: "Users",
                            data: [stats.requesters, stats.preApprovers, stats.approvers],
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: theme.text } },
                        y: { ticks: { color: theme.text } },
                    },
                },
            });
        }

        // Permit Status bar
        const permitStatusCanvas = document.getElementById("permitStatusChart");
        if (permitStatusCanvas) {
            if (charts.permitStatusChart?.destroy) charts.permitStatusChart.destroy();
            const ChartCtor3 = ChartLib || window.Chart;
            if (!ChartCtor3) throw new Error('Chart.js not available');
            charts.permitStatusChart = new ChartCtor3(permitStatusCanvas, {
                type: "bar",
                data: {
                    labels: ["Pending", "In Progress", "Approved", "Rejected", "Closed"],
                    datasets: [
                        {
                            label: "Permits",
                            data: [stats.pending, stats.inProgress, stats.approved, stats.rejected, stats.closedPermits],
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: theme.text } },
                        y: { ticks: { color: theme.text } },
                    },
                },
            });
        }
    } catch (err) {
        showToast("⚠️ Failed to load stats", "error");
    }
}

/* ===== Expand/Collapse Panels (exposed globally for inline onclick) ===== */
function toggleDetails(id, btn) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const isOpening = !panel.classList.contains("open");

    if (btn) {
        btn.classList.toggle("active", isOpening);
        btn.textContent = isOpening ? "Collapse" : "Expand";
        btn.setAttribute("aria-expanded", isOpening ? "true" : "false");
    }

    if (isOpening) {
        panel.classList.add("open");
        panel.style.opacity = "1";
        panel.style.maxHeight = "0px";
        panel.offsetHeight; // force reflow
        panel.style.maxHeight = `${panel.scrollHeight}px`;

        panel.addEventListener("transitionend", function onEnd(e) {
            if (e.propertyName === "max-height") {
                panel.style.maxHeight = "none";
                panel.removeEventListener("transitionend", onEnd);
            }
        });
    } else {
        if (getComputedStyle(panel).maxHeight === "none") {
            panel.style.maxHeight = `${panel.scrollHeight}px`;
        }
        panel.offsetHeight;
        panel.style.maxHeight = "0px";
        panel.style.opacity = "0";

        panel.addEventListener("transitionend", function onEnd(e) {
            if (e.propertyName === "max-height") {
                panel.classList.remove("open");
                panel.removeEventListener("transitionend", onEnd);
            }
        });
    }
}
// Expose globally for inline HTML onclick
window.toggleDetails = toggleDetails;

/* ===== Actions ===== */
function viewProfile(userId) {
    // Your HTML expects a server-side profile route; keep as provided
    window.location.href = `${API_BASE}/admin/users/${encodeURIComponent(userId)}`;
}
function viewPermit(permitId) {
    if (!permitId) return;
    window.location.href = `admin-permit.html?id=${encodeURIComponent(permitId)}`;
}

// Try POST toggle endpoint first; fallback to PATCH if needed
async function toggleUser(userId, currentStatus) {
    if (!userId) return;
    try {
        const res = await fetch(`${API_BASE}/admin/toggle-status/${userId}`, {
            method: "POST",
            credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(`Status updated: ${data.status || "OK"}`, "success");
            await loadUsers();
            return;
        }
        // Fallback
        const newStatus = currentStatus === "Active" ? "Disabled" : "Active";
        const res2 = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: newStatus }),
        });
        if (res2.ok) {
            showToast(`User ${newStatus}`, "success");
            await loadUsers();
        } else {
            const msg = await res2.text().catch(() => "");
            showToast(msg || "Failed to update user status", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("⚠️ Error toggling status", "error");
    }
}

async function resetPassword(userId) {
    const newPassword = prompt("Enter new password for this user:");
    if (!newPassword) return;

    try {
        const res = await fetch(`${API_BASE}/admin/reset-password/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(data.message || "Password reset", "success");
        } else {
            showToast(data.error || "Failed to reset password", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("⚠️ Error resetting password", "error");
    }
}

/* ===== DOMContentLoaded init ===== */
document.addEventListener("DOMContentLoaded", async () => {
    // Session and role guard
    const user = await checkSession();
    if (!user) return;
    initIdleTimer();
    if ((user.role || "").toLowerCase() !== "admin") {
        window.location.href = "index.html";
        return;
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => logoutUser());

    console.log("✅ Admin page loaded for:", user.fullName || user.username || "Admin");

    // Modal elements
    const modal = document.getElementById("userModal");
    const btn = document.getElementById("addUserBtn");
    const closeBtn = modal ? modal.querySelector(".close") : null;
    const form = document.getElementById("userForm");

    // Start closed breakdown panels
    document.querySelectorAll(".breakdown").forEach((panel) => {
        panel.style.maxHeight = "0";
        panel.style.opacity = "0";
        panel.classList.remove("open");
    });

    // Validation bindings
    if (form) {
        form.querySelectorAll("input, select").forEach((input) => {
            input.addEventListener("input", () => validateField(form, input));
            input.addEventListener("blur", () => validateField(form, input));
        });

        // Submit handler with role normalization
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            let valid = true;
            form.querySelectorAll("input, select").forEach((input) => {
                if (!validateField(form, input)) valid = false;
            });
            if (!valid) {
                showToast("Please fix the highlighted errors", "warning");
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            if (data.role) {
                const key = String(data.role).trim().toLowerCase();
                data.role = ROLE_MAP[key] || data.role;
            }

            try {
                const res = await fetch(`${API_BASE}/admin/register-user`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                    credentials: "include",
                });
                if (res.ok) {
                    showToast("User registered successfully!", "success");
                    if (modal) {
                        modal.classList.remove("open");
                        setTimeout(() => {
                            modal.style.display = "none";
                            // reset form fields/errors
                            form.reset();
                            form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
                            form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
                        }, 300);
                    }
                    await loadUsers();
                } else {
                    const errText = await res.text().catch(() => "");
                    showToast(errText || "Error registering user", "error");
                }
            } catch {
                showToast("Network error. Please try again.", "error");
            }
        });
    }

    // Open/close modal
    if (btn && modal) {
        btn.onclick = () => {
            // reset form state
            if (form) {
                form.reset();
                form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
                form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
            }
            modal.style.display = "block";
            setTimeout(() => modal.classList.add("open"), 10);
        };
    }
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.classList.remove("open");
            setTimeout(() => {
                modal.style.display = "none";
                if (form) {
                    form.reset();
                    form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
                    form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
                }
            }, 300);
        };
    }
    if (modal) {
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("open");
                setTimeout(() => {
                    modal.style.display = "none";
                    if (form) {
                        form.reset();
                        form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
                        form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
                    }
                }, 300);
            }
        });
    }

    // Initialize dashboard
    await loadUsers();
    await loadPermits();
    await loadStats();
});

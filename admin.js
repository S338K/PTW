import { checkSession, initIdleTimer, logoutUser } from "./session.js";

document.addEventListener("DOMContentLoaded", async () => {
    // ===== Session and role guard =====
    const user = await checkSession();
    if (!user) return; // session.js should redirect if invalid
    initIdleTimer();

    // Case-insensitive admin-only access
    if ((user.role || "").toLowerCase() !== "admin") {
        window.location.href = "index.html";
        return;
    }

    // Wire logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => logoutUser());
    }

    console.log("✅ Admin page loaded for:", user.fullName || user.username || "Admin");

    // ===== Ensure dashboard content mounts after auth =====
    await safeInitDashboard();
});

// 🔹 Base API URL
const API_BASE = "https://ptw-yu8u.onrender.com";

/* =========================
   Drawer / Modal elements
========================= */
const modal = document.getElementById("userModal");
const btn = document.getElementById("addUserBtn");
const closeBtn = modal ? modal.querySelector(".close") : null;
const form = document.getElementById("userForm");

/* =========================
   Toast helper
========================= */
function showToast(message, type = "success", duration = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) {
        console[type === "error" ? "error" : "log"](message);
        return;
    }
    toast.textContent = message;
    toast.className = "";
    toast.classList.add("show", type);
    setTimeout(() => {
        toast.className = toast.className.replace("show", "").trim();
    }, duration);
}

/* =========================
   Inline validation
========================= */
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
function validateField(input) {
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

/* =========================
   Real-time listeners
========================= */
if (form) {
    form.querySelectorAll("input, select").forEach((input) => {
        input.addEventListener("input", () => validateField(input));
        input.addEventListener("blur", () => validateField(input));
    });
}

/* =========================
   Reset form
========================= */
function resetForm() {
    if (!form) return;
    form.reset();
    form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
    form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
}

/* =========================
   Open/close modal
========================= */
if (btn && modal) {
    btn.onclick = () => {
        resetForm();
        modal.style.display = "block";
        setTimeout(() => modal.classList.add("open"), 10);
    };
}
if (closeBtn && modal) {
    closeBtn.onclick = () => {
        modal.classList.remove("open");
        setTimeout(() => {
            modal.style.display = "none";
            resetForm();
        }, 300);
    };
}
if (modal) {
    window.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.remove("open");
            setTimeout(() => {
                modal.style.display = "none";
                resetForm();
            }, 300);
        }
    });
}

/* =========================
   Role normalization (fix Pre-Approver mismatch)
========================= */
const ROLE_MAP = {
    admin: "Admin",
    approver: "Approver",
    "pre-approver": "Pre-Approver", // normalize hyphenated UI to canonical string
    preapprover: "Pre-Approver",
    "pre approver": "Pre-Approver",
    requester: "Requester",
    user: "User",
};

/* =========================
   Submit handler
========================= */
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        let valid = true;
        form.querySelectorAll("input, select").forEach((input) => {
            if (!validateField(input)) valid = false;
        });
        if (!valid) {
            showToast("Please fix the highlighted errors", "warning");
            return;
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Normalize role to backend enum
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
                modal?.classList.remove("open");
                setTimeout(() => {
                    if (modal) modal.style.display = "none";
                    resetForm();
                }, 300);
                await loadUsers(); // refresh list so “nothing after login” isn’t a thing
            } else {
                const errText = await res.text().catch(() => "");
                showToast(errText || "Error registering user", "error");
            }
        } catch {
            showToast("Network error. Please try again.", "error");
        }
    });
}

/* =========================
   Backend data rendering
========================= */
async function loadUsers() {
    const table = document.getElementById("usersTable");
    const tbody = table?.querySelector("tbody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    tbody.innerHTML = "";
    const headers = Array.from(thead.querySelectorAll("th")).map((th) => th.textContent.trim().toLowerCase());

    try {
        const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load users");
        const users = await res.json();

        users.forEach((u) => {
            const tr = document.createElement("tr");
            headers.forEach((h) => {
                const td = document.createElement("td");
                switch (h) {
                    case "username":
                        td.textContent = u.username || u.fullName || "—";
                        break;
                    case "role":
                        td.textContent = u.role || "—";
                        break;
                    case "status":
                        td.textContent = u.status || "—";
                        break;
                    case "registered":
                        td.textContent = u.registered
                            ? new Date(u.registered).toLocaleString()
                            : u.createdAt
                                ? new Date(u.createdAt).toLocaleString()
                                : "—";
                        break;
                    case "last login":
                        td.textContent = u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—";
                        break;
                    case "actions":
                        td.classList.add("actions");
                        td.innerHTML = `
              <button class="btn reset" data-id="${u.id || u._id}">Reset Password</button>
              <button class="btn view" data-id="${u.id || u._id}">View Profile</button>
              <button class="btn toggle" data-id="${u.id || u._id}" data-status="${u.status || ""}">
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

        // Wire row actions
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
        tr.innerHTML = `<td colspan="${headers.length}">Failed to load users</td>`;
        tbody.appendChild(tr);
        showToast("⚠️ Failed to load users", "error");
    }
}

async function loadPermits() {
    const table = document.getElementById("permitsTable");
    const tbody = table?.querySelector("tbody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    tbody.innerHTML = "";
    const headers = Array.from(thead.querySelectorAll("th")).map((th) => th.textContent.trim().toLowerCase());

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
                    case "permit number":
                        td.textContent = p.permitNumber || "—";
                        break;
                    case "submitted":
                        td.textContent = p.submitted
                            ? new Date(p.submitted).toLocaleString()
                            : p.createdAt
                                ? new Date(p.createdAt).toLocaleString()
                                : "—";
                        break;
                    case "requester":
                        td.textContent = p.requester || p.requesterName || "—";
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

        // Wire view buttons
        tbody.querySelectorAll(".btn.view").forEach((b) =>
            b.addEventListener("click", () => viewPermit(b.dataset.id))
        );
    } catch (err) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="${headers.length}">Failed to load permits</td>`;
        tbody.appendChild(tr);
        showToast("⚠️ Failed to load permits", "error");
    }
}

/* =========================
   Stats + charts
========================= */
async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/stats`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load stats");
        const stats = await res.json();

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

        // Theme-aware colors
        const theme = getThemeColors();

        // Charts
        const userStatusCanvas = document.getElementById("userStatusChart");
        if (userStatusCanvas) {
            destroyChart(charts.userStatusChart);
            charts.userStatusChart = new Chart(userStatusCanvas, {
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

        const userRoleCanvas = document.getElementById("userRoleChart");
        if (userRoleCanvas) {
            destroyChart(charts.userRoleChart);
            charts.userRoleChart = new Chart(userRoleCanvas, {
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

        const permitStatusCanvas = document.getElementById("permitStatusChart");
        if (permitStatusCanvas) {
            destroyChart(charts.permitStatusChart);
            charts.permitStatusChart = new Chart(permitStatusCanvas, {
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
    } catch {
        showToast("⚠️ Failed to load stats", "error");
    }
}

/* =========================
   Expand/Collapse Panels
========================= */
document.querySelectorAll(".breakdown").forEach((panel) => {
    panel.style.maxHeight = "0";
    panel.style.opacity = "0";
    panel.classList.remove("open");
});

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

/* =========================
   Actions
========================= */
// Keep your original viewProfile (API route). If you use a page view, swap the URL.
function viewProfile(userId) {
    window.location.href = `${API_BASE}/admin/users/${encodeURIComponent(userId)}`;
}

function viewPermit(permitId) {
    if (!permitId) return;
    window.location.href = `admin-permit.html?id=${encodeURIComponent(permitId)}`;
}

// Dual-strategy toggle to avoid backend mismatch; tries Part 2 endpoint first, falls back to PATCH.
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
        // Fallback to PATCH style if first fails
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
    // Keep both flows: prompt + API call as provided
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

/* =========================
   Modal + Registration wiring
========================= */
function resetForm(form) {
    if (!form) return;
    form.reset();
    form.querySelectorAll("input, select").forEach((el) => el.classList.remove("error"));
    form.querySelectorAll(".error-msg").forEach((el) => el.classList.remove("active"));
}

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

    // Real-time validation
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
                            resetForm(form);
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
            resetForm(form);
            modal.style.display = "block";
            setTimeout(() => modal.classList.add("open"), 10);
        };
    }
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.classList.remove("open");
            setTimeout(() => {
                modal.style.display = "none";
                resetForm(form);
            }, 300);
        };
    }
    if (modal) {
        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("open");
                setTimeout(() => {
                    modal.style.display = "none";
                    resetForm(form);
                }, 300);
            }
        });
    }

    // Init dashboard only after guard passes
    await loadUsers();
    await loadPermits();
    await loadStats();
});
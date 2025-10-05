import { checkSession, initIdleTimer, logoutUser } from "./session.js";

document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkSession();
    if (!user) return;
    initIdleTimer();

    // Extra guard: only Admins allowed
    if (user.role !== "Admin") {
        window.location.href = "index.html";
        return;
    }

    // 🔹 Base API URL
    const API_BASE = 'https://ptw-yu8u.onrender.com';


    // Drawer elements
    const modal = document.getElementById("userModal");
    const btn = document.getElementById("addUserBtn");
    const closeBtn = modal.querySelector(".close");
    const form = document.getElementById("userForm");

    // Toast helper
    function showToast(message, type = "success", duration = 3000) {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.className = "";
        toast.classList.add("show", type);
        setTimeout(() => {
            toast.className = toast.className.replace("show", "").trim();
        }, duration);
    }

    // Inline validation
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
        const label = form.querySelector(`label[for="${input.id}"]`)?.textContent || input.name;

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
            const pw = form.querySelector('[name="password"]').value;
            if (value && value !== pw) {
                showFieldError(input, "Passwords do not match");
                return false;
            }
        }
        clearFieldError(input);
        return true;
    }

    // Real-time listeners
    form.querySelectorAll("input, select").forEach(input => {
        input.addEventListener("input", () => validateField(input));
        input.addEventListener("blur", () => validateField(input));
    });

    // Reset form
    function resetForm() {
        form.reset();
        form.querySelectorAll("input, select").forEach(el => el.classList.remove("error"));
        form.querySelectorAll(".error-msg").forEach(el => el.classList.remove("active"));
    }

    // Open/close modal
    btn.onclick = () => { resetForm(); modal.style.display = "block"; setTimeout(() => modal.classList.add("open"), 10); };
    closeBtn.onclick = () => { modal.classList.remove("open"); setTimeout(() => { modal.style.display = "none"; resetForm(); }, 300); };
    window.addEventListener("click", e => { if (e.target === modal) { modal.classList.remove("open"); setTimeout(() => { modal.style.display = "none"; resetForm(); }, 300); } });

    // Submit handler
    form.addEventListener("submit", async e => {
        e.preventDefault();
        let valid = true;
        form.querySelectorAll("input, select").forEach(input => { if (!validateField(input)) valid = false; });
        if (!valid) { showToast("Please fix the highlighted errors", "warning"); return; }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch(`${API_BASE}/admin/register-user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include"
            });
            if (res.ok) {
                showToast("User registered successfully!", "success");
                modal.classList.remove("open");
                setTimeout(() => { modal.style.display = "none"; resetForm(); }, 300);
                loadUsers();
            } else {
                const errText = await res.text().catch(() => "");
                showToast(errText || "Error registering user", "error");
            }
        } catch { showToast("Network error. Please try again.", "error"); }
    });

    /* -----------------------
       Backend data rendering
    ------------------------ */
    async function loadUsers() {
        const tbody = document.querySelector("#usersTable tbody");
        tbody.innerHTML = "";
        const headers = Array.from(document.querySelectorAll("#usersTable thead th")).map(th => th.textContent.trim().toLowerCase());

        try {
            const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load users");
            const users = await res.json();

            users.forEach(u => {
                const tr = document.createElement("tr");
                headers.forEach(h => {
                    const td = document.createElement("td");
                    switch (h) {
                        case "username": td.textContent = u.username ?? "—"; break;
                        case "role": td.textContent = u.role ?? "—"; break;
                        case "status": td.textContent = u.status ?? "—"; break;
                        case "registered": td.textContent = u.registered ?? "—"; break;
                        case "last login": td.textContent = u.lastLogin ?? "—"; break;
                        case "actions":
                            td.classList.add("actions");
                            td.innerHTML = `
                          <button class="btn reset" data-id="${u.id}">Reset Password</button>
                          <button class="btn view" data-id="${u.id}">View Profile</button>
                          <button class="btn toggle" data-id="${u.id}">
                            ${u.status === "Active" ? "Disable" : "Enable"}
                          </button>`;
                            break;
                        default: td.textContent = "—";
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll(".btn.reset").forEach(b => b.addEventListener("click", () => resetPassword(b.dataset.id)));
            tbody.querySelectorAll(".btn.view").forEach(b => b.addEventListener("click", () => viewProfile(b.dataset.id)));
            tbody.querySelectorAll(".btn.toggle").forEach(b => b.addEventListener("click", () => toggleUser(b.dataset.id)));

        } catch {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="6">Failed to load users</td>`;
            tbody.appendChild(tr);
            showToast("⚠️ Failed to load users", "error");
        }
    }

    async function loadPermits() {
        const tbody = document.querySelector("#permitsTable tbody");
        tbody.innerHTML = "";
        const headers = Array.from(document.querySelectorAll("#permitsTable thead th")).map(th => th.textContent.trim().toLowerCase());

        try {
            const res = await fetch(`${API_BASE}/admin/permits`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load permits");
            const permits = await res.json();

            permits.forEach(p => {
                const tr = document.createElement("tr");
                headers.forEach(h => {
                    const td = document.createElement("td");
                    switch (h) {
                        case "id": td.textContent = p.id ?? "—"; break;
                        case "title": td.textContent = p.title ?? "—"; break;
                        case "permit #":
                        case "permit number": td.textContent = p.permitNumber ?? "—"; break;
                        case "submitted": td.textContent = p.submitted ?? "—"; break;
                        case "requester": td.textContent = p.requester ?? "—"; break;
                        case "status": td.textContent = p.status ?? "—"; break;
                        case "actions":
                            td.classList.add("actions");
                            td.innerHTML = `<button class="btn view" data-id="${p.id}">View</button>`;
                            break;
                        default: td.textContent = "—";
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        } catch {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="7">Failed to load permits</td>`;
            tbody.appendChild(tr);
            showToast("⚠️ Failed to load permits", "error");
        }
    }

    // Stats + charts
    async function loadStats() {
        try {
            const res = await fetch(`${API_BASE}/admin/stats`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load stats");
            const stats = await res.json();

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                el.textContent = val;
                el.setAttribute("data-value", val);
            };

            // Totals (with count-up)
            const totalUsersEl = document.getElementById("statUsers");
            totalUsersEl.setAttribute("data-value", stats.totalUsers);
            countUp(totalUsersEl, stats.totalUsers);

            const totalPermitsEl = document.getElementById("statPermits");
            totalPermitsEl.setAttribute("data-value", stats.totalPermits);
            countUp(totalPermitsEl, stats.totalPermits);

            // Breakdown
            setVal("statActiveUsers", stats.activeUsers);
            setVal("statInactiveUsers", stats.totalUsers - stats.activeUsers);
            setVal("statPending", stats.pending);
            setVal("statInProgress", stats.inProgress);
            setVal("statApproved", stats.approved);
            setVal("statRejected", stats.rejected);

            // Charts
            new Chart(document.getElementById("userStatusChart"), {
                type: "doughnut",
                data: {
                    labels: ["Active", "Inactive"],
                    datasets: [{
                        data: [stats.activeUsers, stats.totalUsers - stats.activeUsers],
                        backgroundColor: ["#1a7f37", "#b42318"],
                        borderColor: "#fff",
                        borderWidth: 2
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: "bottom", labels: { color: "#273172" } } } }
            });

            new Chart(document.getElementById("userRoleChart"), {
                type: "bar",
                data: {
                    labels: ["Requester", "Pre‑Approver", "Approver"],
                    datasets: [{
                        label: "Users",
                        data: [stats.requesters, stats.preApprovers, stats.approvers],
                        backgroundColor: "#273172",
                        borderColor: "#273172",
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });

            new Chart(document.getElementById("permitStatusChart"), {
                type: "bar",
                data: {
                    labels: ["Pending", "In Progress", "Approved", "Rejected", "Closed"],
                    datasets: [{
                        label: "Permits",
                        data: [stats.pending, stats.inProgress, stats.approved, stats.rejected, stats.closedPermits],
                        backgroundColor: "#273172",
                        borderColor: "#273172",
                        borderWidth: 1
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        } catch {
            showToast("⚠️ Failed to load stats", "error");
        }
    }

    /* -----------------------
       Expand/Collapse Panels
    ------------------------ */
    document.querySelectorAll(".breakdown").forEach(panel => {
        panel.style.maxHeight = "0";
        panel.style.opacity = "0";
        panel.classList.remove("open");
    });

    function toggleDetails(id, btn) {
        const panel = document.getElementById(id);
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

    /* -----------------------
       Actions
    ------------------------ */
    function viewProfile(userId) {
        window.location.href = `${API_BASE}/admin/users/${encodeURIComponent(userId)}`;
    }

    async function toggleUser(userId) {
        try {
            const res = await fetch(`${API_BASE}/admin/toggle-status/${userId}`, {
                method: "POST",
                credentials: "include"
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`Status updated: ${data.status}`, "success");
                loadUsers();
            } else {
                showToast(data.error || "Failed to update status", "error");
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
                body: JSON.stringify({ newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, "success");
            } else {
                showToast(data.error || "Failed to reset password", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("⚠️ Error resetting password", "error");
        }
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            logoutUser();
        });
    }

    // Init dashboard
    loadUsers();
    loadPermits();
    loadStats();
});

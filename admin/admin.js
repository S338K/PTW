// ===== Skeleton loader helpers =====
function showSkeleton(tableId, show = true) {
    const skeleton = document.getElementById(tableId + 'Skeleton');
    const body = document.getElementById(tableId + 'Body');
    if (skeleton) skeleton.style.display = show ? '' : 'none';
    if (body) body.style.display = show ? 'none' : '';
}

// ===== Status chip rendering =====
function statusChip(status) {
    if (!status) return '';
    const norm = String(status).toLowerCase();
    let chipClass = 'status-chip';
    if (norm === 'active') chipClass += ' active';
    else if (norm === 'disabled') chipClass += ' disabled';
    else if (norm === 'pending') chipClass += ' pending';
    else if (norm === 'in progress' || norm === 'inprogress') chipClass += ' inprogress';
    else if (norm === 'expired') chipClass += ' expired';
    return `<span class="${chipClass}">${status}</span>`;
}
import { checkSession, initIdleTimer, logoutUser } from "../session.js";
import { formatDate24, formatLastLogin } from "../date-utils.js";
import { API_BASE } from '../config.js';

/* ===== Constants ===== */

/* ===== Role normalization (fix Pre-Approver mismatch) =====
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
    let toast = document.getElementById("toast");
    if (!toast) toast = ensureToast();
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
        success: getVar("--success-color") || '#10b981',
        error: getVar("--error-color") || '#ef4444',
        warning: getVar("--warning-color") || '#f59e0b',
        inprogress: getVar("--inprogress-color") || '#9333ea',
        muted: getVar("--text-secondary") || '#6b7280',
    };
}

/* ===== Compatibility helper =====
   Returns the first existing element for a list of id alternatives.
   Usage: const el = $id('pdName', 'hoverName', 'profileDisplayName');
*/
function $id(...ids) {
    for (const id of ids) {
        if (!id) continue;
        const el = document.getElementById(id);
        if (el) return el;
    }
    return null;
}

// ...existing code...

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

// Simple in-memory cache of the most recently loaded users to avoid refetching and
// to ensure identity comparisons match the table dataset ids.
let usersCache = [];
// store original user for cancel revert
let modalOriginalUser = null;
let modalEditMode = false;

function setModalEditable(enable) {
    const ids = ['view_fullName', 'view_email', 'view_mobile', 'view_company', 'view_department', 'view_designation', 'view_role'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (enable) {
            el.removeAttribute('disabled');
        } else {
            el.setAttribute('disabled', '');
        }
    });
    // no dedicated save button: Update Profile handles submit when in edit mode
}

function enterEditMode() {
    modalEditMode = true;
    setModalEditable(true);
    const editBtn = document.getElementById('viewEditBtn');
    if (editBtn) { editBtn.textContent = 'Cancel'; editBtn.classList.add('bg-red-600'); }
}

function exitEditMode() {
    modalEditMode = false;
    setModalEditable(false);
    const editBtn = document.getElementById('viewEditBtn');
    if (editBtn) { editBtn.textContent = 'Edit'; editBtn.classList.remove('bg-red-600'); }
    // revert values from original user snapshot
    if (modalOriginalUser) populateViewModal(modalOriginalUser);
}

function toggleEditMode() {
    if (modalEditMode) exitEditMode();
    else enterEditMode();
}

/* ===== Users table ===== */
async function loadUsers() {
    const table = document.getElementById("usersTable");
    const tbody = document.getElementById("usersTableBody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    showSkeleton('usersTable', true);
    tbody.innerHTML = "";
    // Read header keys: prefer explicit data-key attribute, otherwise normalize the header text
    const headers = Array.from(thead.querySelectorAll("th")).map((th) => {
        const dk = th.getAttribute('data-key');
        if (dk) return dk.trim().toLowerCase();
        const txt = th.textContent.trim().toLowerCase();
        const normalized = txt.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        // common mappings
        if (normalized.includes('serial') || normalized === 'id') return 'serial';
        if (normalized.includes('submitted')) return 'submitted';
        if (normalized.includes('title')) return 'title';
        if (normalized.includes('status')) return 'status';
        if (normalized.includes('permit') && (normalized.includes('no') || normalized.includes('number') || normalized.includes('permitnumber') || normalized.includes('permit-number'))) return 'permit-number';
        if (normalized.includes('action')) return 'actions';
        return normalized;
    });

    try {
        const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load users");
        const users = await res.json();
        // store into cache for faster single-user loads
        usersCache = Array.isArray(users) ? users : [];

        showSkeleton('usersTable', false);
        users.forEach((u) => {
            const tr = document.createElement("tr");
            headers.forEach((h) => {
                const td = document.createElement("td");
                switch (h) {
                    case "name":
                        td.textContent = u.fullName || u.username || "—";
                        break;
                    case "email":
                        td.textContent = u.email || u.contactEmail || u.username || "—";
                        break;
                    case "phone":
                        td.textContent = u.phone || u.mobile || u.contact || "—";
                        break;
                    case "role":
                        td.textContent = u.role || "—";
                        break;
                    case "status":
                        td.innerHTML = statusChip(u.status || "—");
                        break;
                    case "registered": {
                        const regVal = u.registered || u.createdAt || u.registeredAt || u.created_at;
                        if (regVal && typeof regVal === 'string' && regVal.trim() !== '—') {
                            const parsed = new Date(regVal);
                            if (!isNaN(parsed.getTime())) td.textContent = formatLastLogin(parsed);
                            else td.textContent = String(regVal);
                        } else if (regVal instanceof Date) {
                            td.textContent = formatLastLogin(regVal);
                        } else {
                            td.textContent = "—";
                        }
                        break;
                    }
                    case "last login":
                    case "last-login": {
                        const lastVal = u.lastLogin || u.last_login || u.lastSeen || u.last_seen || u.lastActivity || u.last_activity;
                        if (lastVal && typeof lastVal === 'string' && lastVal.trim() !== '—') {
                            const parsed = new Date(lastVal);
                            if (!isNaN(parsed.getTime())) td.textContent = formatLastLogin(parsed);
                            else td.textContent = String(lastVal);
                        } else if (lastVal instanceof Date) {
                            td.textContent = formatLastLogin(lastVal);
                        } else {
                            td.textContent = "—";
                        }
                        break;
                    }
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
        showSkeleton('usersTable', false);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="${thead.querySelectorAll("th").length}">Failed to load users</td>`;
        tbody.appendChild(tr);
        showToast("⚠️ Failed to load users", "error");
    }
}

/* ===== Fetch roles dynamically and populate role select ===== */
async function loadRolesIntoSelect() {
    const roleSelect = document.getElementById('role');
    if (!roleSelect) return;
    try {
        const res = await fetch(`${API_BASE}/admin/roles`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load roles');
        const roles = await res.json();
        roleSelect.innerHTML = '';
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.value;
            opt.textContent = r.label;
            roleSelect.appendChild(opt);
        });
    } catch (err) {
        // fallback to existing options
        console.warn('Could not fetch roles, using defaults');
    }
}

/* ===== Modal accessibility: focus trap and ESC close ===== */
function trapFocus(modal) {
    const focusable = Array.from(modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return () => { };
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function keyHandler(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        } else if (e.key === 'Escape') {
            closeUserModal();
        }
    }
    document.addEventListener('keydown', keyHandler);
    // focus first element
    setTimeout(() => first.focus(), 10);
    return () => document.removeEventListener('keydown', keyHandler);
}

let releaseFocusTrap = null;
function openUserModal() {
    const modal = document.getElementById('userModal');
    if (!modal) return;
    // Always force show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.classList.add('show');
    // Remove any lingering 'hidden' class from parent chain
    let parent = modal.parentElement;
    while (parent) {
        if (parent.classList && parent.classList.contains('hidden')) {
            parent.classList.remove('hidden');
        }
        parent = parent.parentElement;
    }
    // Debug log
    console.debug('[openUserModal] Modal should now be visible');
    releaseFocusTrap = trapFocus(modal);
}
function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    if (typeof releaseFocusTrap === 'function') releaseFocusTrap();
}

/* ===== Toast wrapper for DOM creation if missing ===== */
function ensureToast() {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    return toast;
}

/* ===== Permits table ===== */
async function loadPermits() {
    const table = document.getElementById("permitsTable");
    const tbody = document.getElementById("permitsTableBody");
    const thead = table?.querySelector("thead");
    if (!table || !tbody || !thead) return;

    showSkeleton('permitsTable', true);
    tbody.innerHTML = "";
    const headers = Array.from(thead.querySelectorAll("th")).map((th) => {
        const dk = th.getAttribute('data-key');
        if (dk) return dk.trim().toLowerCase();
        return th.textContent.trim().toLowerCase();
    });

    try {
        const res = await fetch(`${API_BASE}/api/permits`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load permits");
        const payload = await res.json();
        // backend may return either an array or an object { permits, pagination }
        const permits = Array.isArray(payload) ? payload : (Array.isArray(payload?.permits) ? payload.permits : []);

        showSkeleton('permitsTable', false);
        if (!permits || permits.length === 0) {
            const trEmpty = document.createElement('tr');
            trEmpty.innerHTML = `<td colspan="${thead.querySelectorAll('th').length}">No permits found</td>`;
            tbody.appendChild(trEmpty);
        } else {
            permits.forEach((p) => {
                const tr = document.createElement("tr");
                headers.forEach((h) => {
                    const td = document.createElement("td");
                    td.classList.add('px-4', 'py-2');
                    switch (h) {
                        case 'serial':
                            td.textContent = p.serial || p.id || p._id || '—';
                            break;
                        case 'title':
                            td.textContent = p.title || p.permitTitle || '—';
                            break;
                        case 'permit-number':
                            td.textContent = p.permitNumber || '—';
                            break;
                        case 'submitted':
                            td.textContent = p.submitted
                                ? formatDate24(p.submitted)
                                : p.createdAt
                                    ? formatDate24(p.createdAt)
                                    : '—';
                            break;
                        case 'status':
                            td.innerHTML = statusChip(p.status || '—');
                            break;
                        case 'actions':
                            td.classList.add('actions');
                            td.innerHTML = `<button class="btn view" data-id="${p.id || p._id}">View</button>`;
                            break;
                        default:
                            td.textContent = '—';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }

        tbody.querySelectorAll(".btn.view").forEach((b) =>
            b.addEventListener("click", () => viewPermit(b.dataset.id))
        );
    } catch (err) {
        showSkeleton('permitsTable', false);
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
    monthlyTrendChart: null,
};

/**
 * Update existing Chart.js instances to use current theme colors.
 * Called when theme changes so charts update without page refresh.
 */
function updateChartTheme() {
    try {
        const theme = getThemeColors();

        // monthlyTrendChart (line)
        const m = charts.monthlyTrendChart;
        if (m) {
            if (m.data && m.data.datasets) {
                if (m.data.datasets[0]) {
                    m.data.datasets[0].borderColor = theme.primary;
                    m.data.datasets[0].backgroundColor = theme.primary;
                }
                if (m.data.datasets[1]) {
                    m.data.datasets[1].borderColor = theme.success;
                    m.data.datasets[1].backgroundColor = theme.success;
                }
            }
            if (m.options) {
                if (m.options.plugins && m.options.plugins.legend && m.options.plugins.legend.labels) m.options.plugins.legend.labels.color = theme.text;
                if (m.options.scales) {
                    if (m.options.scales.x && m.options.scales.x.ticks) m.options.scales.x.ticks.color = theme.text;
                    if (m.options.scales.y && m.options.scales.y.ticks) m.options.scales.y.ticks.color = theme.text;
                }
            }
            m.update();
        }

        // userStatusChart (doughnut)
        const us = charts.userStatusChart;
        if (us) {
            if (us.data && us.data.datasets && us.data.datasets[0]) {
                us.data.datasets[0].backgroundColor = [theme.success, theme.error];
                us.data.datasets[0].borderColor = theme.surface;
            }
            if (us.options && us.options.plugins && us.options.plugins.legend && us.options.plugins.legend.labels) us.options.plugins.legend.labels.color = theme.text;
            us.update();
        }

        // userRoleChart (bar)
        const ur = charts.userRoleChart;
        if (ur) {
            if (ur.data && ur.data.datasets && ur.data.datasets[0]) {
                ur.data.datasets[0].backgroundColor = theme.primary;
                ur.data.datasets[0].borderColor = theme.primary;
            }
            if (ur.options && ur.options.scales) {
                if (ur.options.scales.x && ur.options.scales.x.ticks) ur.options.scales.x.ticks.color = theme.text;
                if (ur.options.scales.y && ur.options.scales.y.ticks) ur.options.scales.y.ticks.color = theme.text;
            }
            ur.update();
        }

        // permitStatusChart (bar)
        const ps = charts.permitStatusChart;
        if (ps) {
            if (ps.data && ps.data.datasets && ps.data.datasets[0]) {
                ps.data.datasets[0].backgroundColor = [theme.warning, theme.inprogress, theme.success, theme.error, theme.muted];
                ps.data.datasets[0].borderColor = theme.surface;
            }
            if (ps.options && ps.options.scales) {
                if (ps.options.scales.x && ps.options.scales.x.ticks) ps.options.scales.x.ticks.color = theme.text;
                if (ps.options.scales.y && ps.options.scales.y.ticks) ps.options.scales.y.ticks.color = theme.text;
            }
            ps.update();
        }

        // userTypeChart (doughnut)
        const ut = charts.userTypeChart;
        if (ut) {
            if (ut.data && ut.data.datasets && ut.data.datasets[0]) {
                ut.data.datasets[0].backgroundColor = [theme.primary, theme.inprogress, theme.success];
                ut.data.datasets[0].borderColor = theme.surface;
            }
            if (ut.options && ut.options.plugins && ut.options.plugins.legend && ut.options.plugins.legend.labels) ut.options.plugins.legend.labels.color = theme.text;
            ut.update();
        }
    } catch (err) {
        // non-fatal
        console.debug('updateChartTheme error', err);
    }
}

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

        // --- Fetch permit list to compute accurate permit-related stats (status breakdown) and monthly trend
        let permitsList = [];
        try {
            const pRes = await fetch(`${API_BASE}/api/permits?limit=10000&page=1`, { credentials: 'include' });
            if (pRes.ok) {
                const pPayload = await pRes.json();
                permitsList = Array.isArray(pPayload) ? pPayload : (Array.isArray(pPayload?.permits) ? pPayload.permits : []);
                // compute counts by status
                const permitCounts = { Pending: 0, 'In Progress': 0, Approved: 0, Rejected: 0, Closed: 0 };
                permitsList.forEach(p => {
                    const st = String(p.status || '').trim();
                    if (!st) return;
                    if (/pending/i.test(st)) permitCounts.Pending += 1;
                    else if (/in\s*progress/i.test(st) || /inprogress/i.test(st)) permitCounts['In Progress'] += 1;
                    else if (/approved/i.test(st)) permitCounts.Approved += 1;
                    else if (/rejected/i.test(st)) permitCounts.Rejected += 1;
                    else if (/closed/i.test(st)) permitCounts.Closed += 1;
                    else {
                        // categorize unknown as Pending to ensure totals match
                        permitCounts.Pending += 1;
                    }
                });

                // merge into stats (prefer computed counts)
                stats.pending = permitCounts.Pending;
                stats.inProgress = permitCounts['In Progress'];
                stats.approved = permitCounts.Approved;
                stats.rejected = permitCounts.Rejected;
                stats.closedPermits = permitCounts.Closed;
                // total permits: prefer pagination total if present
                const totalPermitsFromPayload = Number(pPayload?.pagination?.total || pPayload?.total || permitsList.length || 0);
                stats.totalPermits = totalPermitsFromPayload || permitsList.length;
            }
        } catch (err) {
            // non-fatal, keep server-provided values
            console.debug('[stats-debug] could not fetch permits for breakdown', err);
        }

        // Build monthlyTrend (last 6 months) from permitsList: submitted and approved counts per month
        try {
            if (!stats.monthlyTrend || !Array.isArray(stats.monthlyTrend) || stats.monthlyTrend.length === 0) {
                const now = new Date();
                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    months.push({
                        label: d.toLocaleString(undefined, { month: 'short' }),
                        year: d.getFullYear(),
                        month: d.getMonth(),
                        submitted: 0,
                        approved: 0,
                    });
                }

                permitsList.forEach(p => {
                    const created = p.createdAt ? new Date(p.createdAt) : (p.submitted ? new Date(p.submitted) : null);
                    const approvedAt = p.approvedAt ? new Date(p.approvedAt) : null;
                    if (created && !isNaN(created.getTime())) {
                        const m = months.find(x => x.year === created.getFullYear() && x.month === created.getMonth());
                        if (m) m.submitted += 1;
                    }
                    if (approvedAt && !isNaN(approvedAt.getTime())) {
                        const m2 = months.find(x => x.year === approvedAt.getFullYear() && x.month === approvedAt.getMonth());
                        if (m2) m2.approved += 1;
                    }
                });

                stats.monthlyTrend = months.map(m => ({ label: m.label, submitted: m.submitted, approved: m.approved }));
            }
        } catch (err) {
            console.debug('[stats-debug] could not compute monthlyTrend', err);
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = val;
            el.setAttribute("data-value", val);
        };

        // Derive role counts robustly (support different backend payload shapes)
        const roleCounts = {
            Admin: Number(stats.admins || stats.adminsCount || 0),
            Approver: Number(stats.approvers || stats.approversCount || 0),
            PreApprover: Number(stats.preApprovers || stats.preApproversCount || 0),
            Requester: Number(stats.requesters || stats.requestersCount || stats.requesterCount || 0),
        };

        // If server returned a breakdown object (roles, roleCounts, userRoles, etc.), merge it
        const breakdownSources = stats.roles || stats.roleCounts || stats.userRoles || stats.roleBreakdown || stats.userRoleCounts;
        if (breakdownSources && typeof breakdownSources === 'object') {
            Object.entries(breakdownSources).forEach(([k, v]) => {
                const key = String(k || '').trim().toLowerCase();
                const mapped = ROLE_MAP[key] || key;
                // normalize mapped to our keys
                if (mapped.toLowerCase().includes('admin')) roleCounts.Admin = Number(v || 0);
                else if (mapped.toLowerCase().includes('approver') && mapped.toLowerCase().includes('pre')) roleCounts.PreApprover = Number(v || 0);
                else if (mapped.toLowerCase().includes('approver')) roleCounts.Approver = Number(v || 0);
                else if (mapped.toLowerCase().includes('requester') || mapped.toLowerCase().includes('user')) roleCounts.Requester = Number(v || 0);
            });
        }

        // If totalUsers is missing or zero, derive from sum of roleCounts
        const sumRoles = Object.values(roleCounts).reduce((a, b) => a + Number(b || 0), 0);
        if (!stats.totalUsers && sumRoles > 0) stats.totalUsers = sumRoles;
        // If Requester count not provided, derive from totalUsers minus known roles
        if (!roleCounts.Requester || Number(roleCounts.Requester) === 0) {
            const inferred = Number(stats.totalUsers || 0) - Number(roleCounts.Admin || 0) - Number(roleCounts.Approver || 0) - Number(roleCounts.PreApprover || 0);
            roleCounts.Requester = Math.max(0, Number(roleCounts.Requester || 0) || inferred);
        }

        // Write derived counts back into stats so other code paths stay consistent
        stats.admins = Number(roleCounts.Admin || 0);
        stats.approvers = Number(roleCounts.Approver || 0);
        stats.preApprovers = Number(roleCounts.PreApprover || 0);
        stats.requesters = Number(roleCounts.Requester || 0);

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

        // User-type specific stats (use derived roleCounts)
        const adminsEl = document.getElementById('statAdmins');
        if (adminsEl) { adminsEl.setAttribute('data-value', Number(roleCounts.Admin || 0)); countUp(adminsEl, Number(roleCounts.Admin || 0)); }
        const approversEl = document.getElementById('statApprovers');
        if (approversEl) { approversEl.setAttribute('data-value', Number(roleCounts.Approver || 0)); countUp(approversEl, Number(roleCounts.Approver || 0)); }
        const preApproversEl = document.getElementById('statPreApprovers');
        if (preApproversEl) { preApproversEl.setAttribute('data-value', Number(roleCounts.PreApprover || 0)); countUp(preApproversEl, Number(roleCounts.PreApprover || 0)); }
        const requestersEl = document.getElementById('statRequesters');
        if (requestersEl) { requestersEl.setAttribute('data-value', Number(roleCounts.Requester || 0)); countUp(requestersEl, Number(roleCounts.Requester || 0)); }

        // Breakdown with count-up animation for each stat
        // Compute active/inactive robustly: prefer explicit fields, else derive and clamp
        let computedActive = Number(stats.activeUsers || stats.active || 0);
        let computedInactive = Number(stats.inactiveUsers ?? (Number(stats.totalUsers || 0) - computedActive));
        if (isNaN(computedInactive) || computedInactive < 0) computedInactive = 0;
        // If the server stats disagree with the actual user records, prefer the authoritative user list.
        try {
            const usersRes = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
            if (usersRes.ok) {
                const usersList = await usersRes.json();
                const activeFromList = Array.isArray(usersList)
                    ? usersList.reduce((acc, u) => acc + ((String(u.status || '').toLowerCase() === 'active') ? 1 : 0), 0)
                    : 0;
                if (typeof activeFromList === 'number' && activeFromList >= 0 && activeFromList !== computedActive) {
                    console.debug('[stats-debug] active mismatch, using user list count', { computedActive, activeFromList });
                    computedActive = activeFromList;
                    computedInactive = Math.max(0, Number(stats.totalUsers || 0) - computedActive);
                }
            }
        } catch (err) {
            // non-fatal — keep server-provided values
            console.debug('[stats-debug] failed to fetch users for authoritative active count', err);
        }

        // reflect computed active/inactive in stats for consistency
        stats.activeUsers = Number(computedActive);
        stats.inactiveUsers = Number(computedInactive);

        // Debug: helpful during development — remove or guard in production if desired
        console.debug('[stats-debug] roleCounts:', roleCounts, 'computedActive:', computedActive, 'computedInactive:', computedInactive, 'stats.totalUsers:', stats.totalUsers);

        const activeEl = document.getElementById('statActiveUsers');
        if (activeEl) { activeEl.setAttribute('data-value', computedActive); countUp(activeEl, computedActive); }
        const inactiveEl = document.getElementById('statInactiveUsers');
        if (inactiveEl) { inactiveEl.setAttribute('data-value', computedInactive); countUp(inactiveEl, computedInactive); }

        const pendingEl = document.getElementById('statPending');
        if (pendingEl) { pendingEl.setAttribute('data-value', stats.pending); countUp(pendingEl, stats.pending); }
        const inProgressEl = document.getElementById('statInProgress');
        if (inProgressEl) { inProgressEl.setAttribute('data-value', stats.inProgress); countUp(inProgressEl, stats.inProgress); }
        const approvedEl = document.getElementById('statApproved');
        if (approvedEl) { approvedEl.setAttribute('data-value', stats.approved); countUp(approvedEl, stats.approved); }
        const rejectedEl = document.getElementById('statRejected');
        if (rejectedEl) { rejectedEl.setAttribute('data-value', stats.rejected); countUp(rejectedEl, stats.rejected); }

        // Wait for Chart.js (HTML loads it after admin.js)
        const ChartLib = await waitForChart();
        const theme = getThemeColors();

        // Monthly Trend Chart
        const monthlyCtx = document.getElementById('monthlyTrendChart');
        if (monthlyCtx) {
            if (charts.monthlyTrendChart?.destroy) charts.monthlyTrendChart.destroy();
            const ChartCtorMonth = ChartLib || window.Chart;
            if (!ChartCtorMonth) throw new Error('Chart.js not available');

            // Prefer server-provided monthly trend if available
            let labels = null;
            let submittedData = null;
            let approvedData = null;
            if (stats.monthlyTrend && Array.isArray(stats.monthlyTrend) && stats.monthlyTrend.length > 0) {
                // Expect stats.monthlyTrend = [{ label: 'Jan', submitted: 5, approved: 4 }, ...]
                labels = stats.monthlyTrend.map(m => m.label);
                submittedData = stats.monthlyTrend.map(m => Number(m.submitted || 0));
                approvedData = stats.monthlyTrend.map(m => Number(m.approved || 0));
            } else {
                // Fallback: generate last 6 month labels and zero data so charts render empty state
                const now = new Date();
                const months = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    months.push(d.toLocaleString(undefined, { month: 'short' }));
                }
                labels = months;
                submittedData = Array(labels.length).fill(0);
                approvedData = Array(labels.length).fill(0);
            }

            charts.monthlyTrendChart = new ChartCtorMonth(monthlyCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Permits Submitted',
                            data: submittedData,
                            borderColor: theme.primary,
                            backgroundColor: theme.primary,
                            tension: 0.35,
                            fill: false,
                            pointRadius: 3,
                        },
                        {
                            label: 'Permits Approved',
                            data: approvedData,
                            borderColor: theme.success,
                            backgroundColor: theme.success,
                            tension: 0.35,
                            fill: false,
                            pointRadius: 3,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'top', labels: { color: theme.text } } },
                    scales: {
                        x: { ticks: { color: theme.text } },
                        y: { ticks: { color: theme.text }, beginAtZero: true }
                    }
                }
            });
        }

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
                            data: [computedActive, computedInactive],
                            backgroundColor: [theme.success, theme.error],
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

        // User Roles bar (include Admins as well)
        const userRoleCanvas = document.getElementById("userRoleChart");
        if (userRoleCanvas) {
            if (charts.userRoleChart?.destroy) charts.userRoleChart.destroy();
            const ChartCtor2 = ChartLib || window.Chart;
            if (!ChartCtor2) throw new Error('Chart.js not available');
            charts.userRoleChart = new ChartCtor2(userRoleCanvas, {
                type: "bar",
                data: {
                    labels: ["Admin", "Approver", "Pre‑Approver", "Requester"],
                    datasets: [
                        {
                            label: "Users",
                            data: [roleCounts.Admin, roleCounts.Approver, roleCounts.PreApprover, roleCounts.Requester],
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
                            backgroundColor: [theme.warning, theme.inprogress, theme.success, theme.error, theme.muted],
                            borderColor: theme.surface,
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

        // User Type Distribution (doughnut) — replaces former permit stats
        const userTypeCanvas = document.getElementById('userTypeChart');
        if (userTypeCanvas) {
            if (charts.userTypeChart?.destroy) charts.userTypeChart.destroy();
            const ChartUser = ChartLib || window.Chart;
            if (!ChartUser) throw new Error('Chart.js not available');

            // Use derived roleCounts (ensures Requester is included)
            const adminsCount = Number(roleCounts.Admin || 0);
            const preApprovers = Number(roleCounts.PreApprover || 0);
            const approvers = Number(roleCounts.Approver || 0);
            const approverCount = preApprovers + approvers;
            const requestersCount = Number(roleCounts.Requester || 0);

            charts.userTypeChart = new ChartUser(userTypeCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Admins', 'Approvers', 'Requesters'],
                    datasets: [{
                        data: [adminsCount, approverCount, requestersCount],
                        backgroundColor: [theme.primary, theme.inprogress, theme.success],
                        borderColor: theme.surface,
                        borderWidth: 1,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'bottom', labels: { color: theme.text } } }
                }
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
        // Keep buttons icon-only; do not inject text content here.
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
    // Keep backward-compatible: open modal view in admin dashboard
    if (!userId) return;
    openViewUserModal(userId);
}

// Fetch a single user by id by requesting /admin/users and filtering (server returns arrays)
async function getUserById(userId) {
    // prefer cache
    if (usersCache && usersCache.length) {
        const found = usersCache.find(x => String(x.id) === String(userId) || String(x._id) === String(userId));
        if (found) return found;
    }
    try {
        const res = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
        if (!res.ok) {
            console.error('getUserById: failed to fetch users', res.status);
            return null;
        }
        const users = await res.json();
        usersCache = Array.isArray(users) ? users : [];
        const u = usersCache.find(x => String(x.id) === String(userId) || String(x._id) === String(userId));
        return u || null;
    } catch (err) {
        console.error('getUserById error', err);
        return null;
    }
}

function populateViewModal(user) {
    if (!user) return;
    // keep a snapshot for cancel
    modalOriginalUser = JSON.parse(JSON.stringify(user));
    document.getElementById('view_userId').value = user.id || user._id || '';
    document.getElementById('view_fullName').value = user.fullName || user.username || '';
    document.getElementById('view_displayName').textContent = user.fullName || user.username || '—';
    document.getElementById('view_email').value = user.email || '';
    document.getElementById('view_displayEmail').textContent = user.email || '';
    document.getElementById('view_mobile').value = user.phone || user.mobile || '';
    document.getElementById('view_company').value = user.company || '';
    document.getElementById('view_department').value = user.department || '';
    document.getElementById('view_designation').value = user.designation || '';
    // normalize role
    const r = (user.role || '').toString().toLowerCase();
    if (r.includes('admin')) document.getElementById('view_role').value = 'admin';
    else if (r.includes('pre')) document.getElementById('view_role').value = 'pre-approver';
    else if (r.includes('approver')) document.getElementById('view_role').value = 'approver';
    else document.getElementById('view_role').value = 'requester';

    const status = user.status || user.userStatus || '';
    const statusEl = document.getElementById('view_status');
    if (statusEl) statusEl.value = status;
    // status badge (primary visual)
    const badge = document.getElementById('view_statusBadge');
    if (badge) badge.innerHTML = statusChip(status) || '';
    // update toggle/status button label + tooltip
    const toggleBtn = document.getElementById('viewToggleBtn');
    const tooltip = document.getElementById('viewToggleTooltip');
    if (toggleBtn) {
        const enabled = String(status).toLowerCase() === 'active' || String(status).toLowerCase() === 'enabled';
        toggleBtn.textContent = enabled ? 'Enabled' : 'Disabled';
        toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        // adjust subtle style for disabled state
        toggleBtn.style.opacity = enabled ? '1' : '0.9';
    }
    if (tooltip) {
        const enabled = String(status).toLowerCase() === 'active' || String(status).toLowerCase() === 'enabled';
        tooltip.textContent = enabled ? 'Account is active — click to disable' : 'Account is disabled — click to enable';
    }

    // format dates using helpers if available
    const reg = user.registered || user.createdAt || '';
    const last = user.lastLogin || user.last_login || '';
    // Helper: validate and format date input safely into local timezone
    function isValidDate(value) {
        if (!value) return false;
        const d = (value instanceof Date) ? value : new Date(value);
        return !isNaN(d.getTime());
    }
    function safeFormatDate(value) {
        if (!value) return '—';
        try {
            if (!isValidDate(value)) return '—';
            return formatDate24(value);
        } catch (err) {
            return '—';
        }
    }

    document.getElementById('view_registered').textContent = safeFormatDate(reg);
    document.getElementById('view_lastLogin').textContent = safeFormatDate(last);
}

function openViewUserModal(userId) {
    const modal = document.getElementById('viewUserModal');
    if (!modal) return;
    // show modal and a temporary loading state
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    // put placeholders
    const nameEl = document.getElementById('view_displayName');
    const emailEl = document.getElementById('view_displayEmail');
    if (nameEl) nameEl.textContent = 'Loading…';
    if (emailEl) emailEl.textContent = '';

    // fetch user details and populate; don't auto-close modal on failure
    getUserById(userId).then(user => {
        if (!user) {
            showToast('User not found (check server / permissions)', 'error');
            console.error('openViewUserModal: user not found for id', userId);
            if (nameEl) nameEl.textContent = 'User not found';
            return;
        }
        populateViewModal(user);
    }).catch(err => {
        console.error('openViewUserModal error', err);
        showToast('Failed to load user (see console)', 'error');
        if (nameEl) nameEl.textContent = 'Failed to load';
    });
}

function closeViewUserModal() {
    const modal = document.getElementById('viewUserModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

// Save updates - backend currently exposes POST /admin/register-user for creation; no explicit update route
// We'll attempt PATCH /admin/users/:id and fallback to POST /admin/register-user if not available.
async function updateUserProfile() {
    const id = document.getElementById('view_userId').value;
    if (!id) return showToast('Missing user id', 'error');
    const payload = {
        fullName: document.getElementById('view_fullName').value,
        email: document.getElementById('view_email').value,
        mobile: document.getElementById('view_mobile').value,
        company: document.getElementById('view_company').value,
        department: document.getElementById('view_department').value,
        designation: document.getElementById('view_designation').value,
        role: document.getElementById('view_role').value,
    };
    try {
        // Try PATCH first
        let res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            showToast('User updated', 'success');
            await loadUsers();
            closeViewUserModal();
            return;
        }
        // Fallback: server may not support PATCH; notify user
        const txt = await res.text().catch(() => '');
        showToast(txt || 'Failed to update user (server does not support inline update)', 'warning');
    } catch (err) {
        console.error(err);
        showToast('Error updating user', 'error');
    }
}

async function deleteUser() {
    const id = document.getElementById('view_userId').value;
    if (!id) return showToast('Missing user id', 'error');
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (res.ok) {
            showToast('User deleted', 'success');
            await loadUsers();
            closeViewUserModal();
            return;
        }
        const txt = await res.text().catch(() => '');
        showToast(txt || 'Failed to delete user', 'error');
    } catch (err) {
        console.error(err);
        showToast('Error deleting user', 'error');
    }
}

async function resetUserPassword() {
    const id = document.getElementById('view_userId').value;
    if (!id) return showToast('Missing user id', 'error');
    const newPassword = prompt('Enter new password for this user:');
    if (!newPassword) return;
    try {
        const res = await fetch(`${API_BASE}/admin/reset-password/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(data.message || 'Password reset', 'success');
            return;
        }
        showToast(data.error || 'Failed to reset password', 'error');
    } catch (err) {
        console.error(err);
        showToast('Error resetting password', 'error');
    }
}

async function toggleUserFromModal() {
    const id = document.getElementById('view_userId').value;
    if (!id) return showToast('Missing user id', 'error');
    try {
        const res = await fetch(`${API_BASE}/admin/toggle-status/${encodeURIComponent(id)}`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            showToast(data.message || 'Status updated', 'success');
            await loadUsers();
            // update status field in modal (if present) and badge
            const statusEl = document.getElementById('view_status');
            if (statusEl) statusEl.value = data.status || statusEl.value;
            const badgeEl = document.getElementById('view_statusBadge');
            if (badgeEl) badgeEl.innerHTML = statusChip(data.status || '') || '';
            return;
        }
        showToast('Failed to toggle status', 'error');
    } catch (err) {
        console.error(err);
        showToast('Error toggling status', 'error');
    }
}

// wire modal buttons when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const close = document.getElementById('viewUserClose');
    if (close) close.addEventListener('click', closeViewUserModal);
    // Update Profile button doubles as edit trigger and save action when in edit mode
    const edit = document.getElementById('viewEditBtn');
    if (edit) edit.addEventListener('click', toggleEditMode);
    const up = document.getElementById('viewUpdateProfileBtn');
    if (up) up.addEventListener('click', () => {
        if (!modalEditMode) {
            showToast('Click Edit to enable changes, then click Update Profile to save.', 'warning');
            return;
        }
        updateUserProfile();
    });
    const del = document.getElementById('viewDeleteBtn');
    if (del) del.addEventListener('click', deleteUser);
    const rst = document.getElementById('viewResetBtn');
    if (rst) rst.addEventListener('click', resetUserPassword);
    const tog = document.getElementById('viewToggleBtn');
    if (tog) tog.addEventListener('click', toggleUserFromModal);
});

// expose for inline use if necessary
window.openViewUserModal = openViewUserModal;
window.closeViewUserModal = closeViewUserModal;
function viewPermit(permitId) {
    if (!permitId) return;
    openViewPermitModal(permitId);
}

// Fetch a single permit by id (with approval chain, files, comments)
async function getPermitById(permitId) {
    try {
        const res = await fetch(`${API_BASE}/api/permits/${encodeURIComponent(permitId)}`, { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        console.error('getPermitById error', err);
        return null;
    }
}

function populatePermitModal(permit) {
    if (!permit) return;
    // Defensive: support both flat and nested shapes, fallback to '—' for missing
    const get = (...paths) => {
        for (const path of paths) {
            let val = permit;
            for (const key of path.split('.')) {
                if (val && typeof val === 'object' && key in val) val = val[key];
                else { val = undefined; break; }
            }
            if (val !== undefined && val !== null && val !== '') return val;
        }
        return undefined;
    };
    document.getElementById('permit_id').value = get('id', '_id') || '';
    document.getElementById('permit_title').textContent = get('title', 'permitTitle') || '—';
    document.getElementById('permit_number').textContent = get('permitNumber', 'number') || '—';
    document.getElementById('permit_status').textContent = get('status') || '—';
    // Submitted: prefer submitted, then createdAt
    const submitted = get('submitted', 'createdAt');
    document.getElementById('permit_submitted').textContent = submitted ? formatDate24(submitted) : '—';

    // Requester details
    const requesterName = get('requesterName', 'requester.fullName', 'requester.username', 'requester.name');
    document.getElementById('permit_requester_name').textContent = requesterName || '—';
    // Requester submitted time: prefer submitted, then requester.submitted, then createdAt
    const requesterTime = get('submitted', 'requester.submitted', 'createdAt');
    document.getElementById('permit_requester_time').textContent = requesterTime ? formatDate24(requesterTime) : '—';
    // Requester comments
    document.getElementById('permit_requester_comments').textContent = get('requesterComments', 'requester.comments', 'requester.comment') || '—';

    // Pre-Approver details
    const preApproverName = get('preApproverName', 'preApprover.fullName', 'preApprover.username', 'preApprover.name');
    document.getElementById('permit_preapprover_name').textContent = preApproverName || '—';
    const preApproverTime = get('preApproverTime', 'preApprover.date', 'preApprover.time');
    document.getElementById('permit_preapprover_time').textContent = preApproverTime ? formatDate24(preApproverTime) : '—';
    document.getElementById('permit_preapprover_comments').textContent = get('preApproverComments', 'preApprover.comments', 'preApprover.comment') || '—';

    // Approver details
    const approverName = get('approverName', 'approver.fullName', 'approver.username', 'approver.name');
    document.getElementById('permit_approver_name').textContent = approverName || '—';
    const approverTime = get('approverTime', 'approver.date', 'approver.time');
    document.getElementById('permit_approver_time').textContent = approverTime ? formatDate24(approverTime) : '—';
    document.getElementById('permit_approver_comments').textContent = get('approverComments', 'approver.comments', 'approver.comment') || '—';

    // Files
    const filesDiv = document.getElementById('permit_files');
    filesDiv.innerHTML = '';
    const files = get('files');
    if (Array.isArray(files) && files.length) {
        files.forEach(f => {
            const a = document.createElement('a');
            a.href = f.url || f.path || '#';
            a.textContent = f.name || f.filename || 'File';
            a.target = '_blank';
            a.className = 'underline text-blue-600 hover:text-blue-800';
            filesDiv.appendChild(a);
        });
    } else {
        filesDiv.textContent = '—';
    }
}

function openViewPermitModal(permitId) {
    const modal = document.getElementById('viewPermitModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    // Clear all fields and disable action buttons
    document.getElementById('permit_id').value = '';
    document.getElementById('permit_title').textContent = 'Loading…';
    document.getElementById('permit_number').textContent = '';
    document.getElementById('permit_status').textContent = '';
    document.getElementById('permit_submitted').textContent = '';
    document.getElementById('permit_requester_name').textContent = '';
    document.getElementById('permit_requester_time').textContent = '';
    document.getElementById('permit_preapprover_name').textContent = '';
    document.getElementById('permit_preapprover_time').textContent = '';
    document.getElementById('permit_preapprover_comments').textContent = '';
    document.getElementById('permit_approver_name').textContent = '';
    document.getElementById('permit_approver_time').textContent = '';
    document.getElementById('permit_approver_comments').textContent = '';
    const filesDiv = document.getElementById('permit_files');
    if (filesDiv) filesDiv.innerHTML = '';
    // Disable action buttons until loaded
    ['permitApproveBtn', 'permitRejectBtn', 'permitUpdateBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.setAttribute('disabled', '');
    });
    getPermitById(permitId).then(permit => {
        if (!permit) {
            document.getElementById('permit_title').textContent = 'Permit not found';
            showToast('Permit not found', 'error');
            return;
        }
        populatePermitModal(permit);
        // Enable action buttons if permit loaded and has id
        if (permit.id || permit._id) {
            ['permitApproveBtn', 'permitRejectBtn', 'permitUpdateBtn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.removeAttribute('disabled');
            });
        }
    }).catch(err => {
        document.getElementById('permit_title').textContent = 'Failed to load';
        showToast('Failed to load permit', 'error');
    });
}

function closeViewPermitModal() {
    const modal = document.getElementById('viewPermitModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

// Approve/Reject/Update Permit handlers (stubbed, to be implemented)
async function approvePermit() {
    const id = document.getElementById('permit_id').value;
    if (!id) {
        showToast('Permit ID missing. Please reload the permit details.', 'error');
        return;
    }
    // TODO: Implement API call to approve permit
    showToast('Approve Permit: Not yet implemented', 'warning');
}
async function rejectPermit() {
    const id = document.getElementById('permit_id').value;
    if (!id) {
        showToast('Permit ID missing. Please reload the permit details.', 'error');
        return;
    }
    // TODO: Implement API call to reject permit
    showToast('Reject Permit: Not yet implemented', 'warning');
}
async function updatePermit() {
    const id = document.getElementById('permit_id').value;
    if (!id) {
        showToast('Permit ID missing. Please reload the permit details.', 'error');
        return;
    }
    // TODO: Implement API call to update permit
    showToast('Update Permit: Not yet implemented', 'warning');
}

// Wire permit modal buttons
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const permitClose = document.getElementById('viewPermitClose');
        if (permitClose) permitClose.addEventListener('click', closeViewPermitModal);
        const approveBtn = document.getElementById('permitApproveBtn');
        if (approveBtn) approveBtn.addEventListener('click', approvePermit);
        const rejectBtn = document.getElementById('permitRejectBtn');
        if (rejectBtn) rejectBtn.addEventListener('click', rejectPermit);
        const updateBtn = document.getElementById('permitUpdateBtn');
        if (updateBtn) updateBtn.addEventListener('click', updatePermit);
    });
})();

// Expose for inline use if necessary
window.openViewPermitModal = openViewPermitModal;
window.closeViewPermitModal = closeViewPermitModal;

/* ===== DOMContentLoaded init ===== */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // basic init
        const user = await checkSession();
        await loadRolesIntoSelect();

        // attach header buttons
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.addEventListener('click', () => {
            openUserModal();
        });
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => logoutUser());

        // Theme toggle initialization (round icon in header)
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        function applyTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (themeIcon) { themeIcon.className = 'fa-solid fa-sun'; }
                if (themeToggle) {
                    themeToggle.setAttribute('aria-pressed', 'true');
                    themeToggle.classList.remove('light');
                }
                // update charts to reflect new theme colors
                updateChartTheme();
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                if (themeIcon) { themeIcon.className = 'fa-solid fa-moon'; }
                if (themeToggle) {
                    themeToggle.setAttribute('aria-pressed', 'false');
                    themeToggle.classList.add('light');
                }
                // update charts to reflect new theme colors
                updateChartTheme();
            }
        }
        const saved = localStorage.getItem('ptw_theme');
        if (saved) applyTheme(saved);
        else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        }
        if (themeToggle) themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('ptw_theme', next);
        });

        // wire modal close handlers
        document.querySelectorAll('#userModal .close').forEach(b => b.addEventListener('click', closeUserModal));
        // clicking backdrop closes modal
        const modal = document.getElementById('userModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeUserModal(); });

        // viewUserModal backdrop handling
        const viewModal = document.getElementById('viewUserModal');
        if (viewModal) viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeViewUserModal(); });

        if (user) {
            initIdleTimer();
            if ((user.role || '').toLowerCase() !== 'admin') {
                window.location.href = 'index.html';
                return;
            }
        }

        // initialize data
        await loadUsers();
        await loadPermits();
        await loadStats();
    } catch (err) {
        console.debug('Initialization error (non-fatal):', err?.message || err);
    }
});

function markAsAdminPage() {
  try {
    const layoutWrapper = document.querySelector("[data-layout-wrapper]");
    if (layoutWrapper) {
      layoutWrapper.classList.remove("container");
      layoutWrapper.classList.add("w-full");
    }

    const mainContent = document.getElementById("main-content");
    if (mainContent) {
      mainContent.classList.remove("admin-full-width");
    }

    // Also ensure the page <main> element is full width
    const mainElement = document.querySelector("main");
    if (mainElement) {
      // ensure the inner <main> has full width utilities but allow the shared layout to control shifting
      mainElement.classList.add("w-full");
      mainElement.classList.remove("admin-full-width");
    }
  } catch (e) {
    console.warn("markAsAdminPage failed:", e);
  }
}

// Load users list and admin stats, populate the users table
function resolveApiBase() {
  try {
    // Prefer globally exposed helpers
    if (typeof getApiBase === "function") return getApiBase();
    if (typeof window.getApiBase === "function") return window.getApiBase();

    // LocalStorage override
    try {
      const ls = localStorage.getItem("API_BASE");
      if (ls && ls.trim()) return ls.trim();
    } catch (_) {}

    // Meta tag injection
    try {
      const meta = document.querySelector('meta[name="api-base"]');
      if (meta && meta.content && meta.content.trim())
        return meta.content.trim();
    } catch (_) {}

    // Fallback: same-origin (avoid returning empty which leads to malformed URLs)
    const { protocol, hostname, port } = window.location;
    const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    return origin;
  } catch (e) {
    // Absolute safest fallback: current origin
    try {
      return window.location.origin;
    } catch (_) {
      return ""; // last resort
    }
  }
}
// last fetched users cache (for modal lookups)
let _lastUsers = [];
let _usersCurrentPage = 1;
let _usersPerPage = 10;
let _usersSortField = null;
let _usersSortOrder = "asc";

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  try {
    tbody.innerHTML =
      '<tr><td colspan="7" class="p-8 text-center"><div class="flex items-center justify-center gap-2 text-[var(--text-secondary)]"><i class="fas fa-spinner fa-spin"></i><span>Loading users...</span></div></td></tr>';

    const base = resolveApiBase();
    const usersEndpoint = `${base.replace(/\/$/, "")}/admin/users`;
    // Guard: if base accidentally resolved to 'null' or an empty string, log and abort early
    if (!base || base === "null") {
      console.error("[Admin Debug] Invalid API base resolved:", base);
      if (typeof window.showToast === "function") {
        window.showToast(
          "error",
          "Invalid API base; set localStorage.API_BASE to http://localhost:5000"
        );
      }
      tbody.innerHTML =
        '<tr><td colspan="7" class="p-4 text-center text-sm text-red-600">Invalid API base. Open DevTools console for instructions.</td></tr>';
      return;
    }
    const res = await fetch(usersEndpoint, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    const users = await res.json();
    _lastUsers = users || [];

    // Default: sort users alphabetically by username for consistent display
    try {
      _lastUsers.sort((a, b) => {
        const aName = (a.username || a.fullName || "").toLowerCase();
        const bName = (b.username || b.fullName || "").toLowerCase();
        if (aName < bName) return -1;
        if (aName > bName) return 1;
        return 0;
      });
    } catch (e) {
      // ignore sort failures
    }

    // Load stats
    try {
      const statsRes = await fetch(`${resolveApiBase()}/admin/stats`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        const n = (v) => (typeof v === "number" ? v : v || "—");
        document.getElementById("statUsers")?.textContent &&
          (document.getElementById("statUsers").textContent = n(
            stats.totalUsers
          ));
        document.getElementById("statActiveUsers")?.textContent &&
          (document.getElementById("statActiveUsers").textContent = n(
            stats.activeUsers
          ));
        document.getElementById("statInactiveUsers")?.textContent &&
          (document.getElementById("statInactiveUsers").textContent = n(
            stats.inactiveUsers
          ));
        document.getElementById("statAdmins")?.textContent &&
          (document.getElementById("statAdmins").textContent = n(stats.admins));
        document.getElementById("statApprovers")?.textContent &&
          (document.getElementById("statApprovers").textContent = n(
            stats.approvers || 0
          ));
        document.getElementById("statPreApprovers")?.textContent &&
          (document.getElementById("statPreApprovers").textContent = n(
            stats.preApprovers || 0
          ));

        // Calculate requesters
        const requesters =
          stats.totalUsers -
          stats.admins -
          (stats.approvers || 0) -
          (stats.preApprovers || 0);
        document.getElementById("statRequesters")?.textContent &&
          (document.getElementById("statRequesters").textContent = n(
            requesters > 0 ? requesters : 0
          ));
      }
    } catch (err) {
      console.warn("Failed to load user stats:", err);
    }

    renderUsersTable();
    setupUsersFilters();
  } catch (err) {
    console.error("Failed to load users:", err);
    if (typeof window.showToast === "function")
      window.showToast("error", "Failed to load users");
    tbody.innerHTML =
      '<tr><td colspan="7" class="p-4 text-center text-sm text-red-600">Error loading users</td></tr>';
  }
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  // Apply filters
  const searchTerm =
    document.getElementById("usersSearchInput")?.value.toLowerCase() || "";
  const roleFilter = document.getElementById("usersRoleFilter")?.value || "";
  const statusFilter =
    document.getElementById("usersStatusFilter")?.value || "";

  let filtered = _lastUsers.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      (u.username && u.username.toLowerCase().includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm)) ||
      (u.role && u.role.toLowerCase().includes(searchTerm));

    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Apply sorting
  if (_usersSortField) {
    filtered.sort((a, b) => {
      // Map sortable field names from headers to actual object properties
      const field = _usersSortField;
      let aVal = "";
      let bVal = "";

      if (field === "registered") {
        aVal =
          a.registered && a.registered !== "—"
            ? new Date(a.registered).getTime()
            : 0;
        bVal =
          b.registered && b.registered !== "—"
            ? new Date(b.registered).getTime()
            : 0;
      } else {
        // header 'name' corresponds to username/fullName
        if (field === "name") {
          aVal = (a.username || a.fullName || "").toString().toLowerCase();
          bVal = (b.username || b.fullName || "").toString().toLowerCase();
        } else if (field === "email") {
          aVal = (a.email || "").toString().toLowerCase();
          bVal = (b.email || "").toString().toLowerCase();
        } else if (field === "role") {
          aVal = (a.role || "").toString().toLowerCase();
          bVal = (b.role || "").toString().toLowerCase();
        } else if (field === "status") {
          aVal = (a.status || "").toString().toLowerCase();
          bVal = (b.status || "").toString().toLowerCase();
        } else {
          aVal = String(a[field] || "").toLowerCase();
          bVal = String(b[field] || "").toLowerCase();
        }
      }

      if (aVal < bVal) return _usersSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return _usersSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / _usersPerPage);
  const start = (_usersCurrentPage - 1) * _usersPerPage;
  const end = start + _usersPerPage;
  const paginated = filtered.slice(start, end);

  // Update counts
  document.getElementById("usersShowingCount").textContent = paginated.length;
  document.getElementById("usersTotalCount").textContent = total;

  if (paginated.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="p-8 text-center text-sm text-[var(--text-secondary)]"><i class="fas fa-inbox text-3xl mb-2 opacity-30"></i><div>No users found</div></td></tr>';
  } else {
    tbody.innerHTML = paginated
      .map((u) => {
        const registered =
          u.registered && u.registered !== "—"
            ? new Date(u.registered).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—";
        const phone = u.phone || "—";
        const role = u.role || "—";
        const status = u.status || "—";
        const name = u.username || "—";

        // Role badge colors
        let roleBadge =
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
        if (role === "Admin")
          roleBadge =
            "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300";
        else if (role === "Approver")
          roleBadge =
            "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
        else if (role === "PreApprover")
          roleBadge =
            "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300";
        else if (role === "Requester")
          roleBadge =
            "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300";

        // Status badge
        const statusBadge =
          status === "Active"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

        return `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
            <td data-label="Name" class="px-4 py-3.5">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full avatar-accent flex items-center justify-center text-white font-semibold text-xs">
                  ${escapeHtml(name.charAt(0).toUpperCase())}
                </div>
                <div class="font-medium text-[var(--text-primary)]">${escapeHtml(
                  name
                )}</div>
              </div>
            </td>
            <td data-label="Email" class="px-4 py-3.5 text-sm text-[var(--text-secondary)]">${escapeHtml(
              u.email || "—"
            )}</td>
            <td data-label="Phone" class="px-4 py-3.5 text-sm text-[var(--text-secondary)]">
              <div class="flex items-center gap-1.5">
                <i class="fas fa-phone text-xs"></i>
                ${escapeHtml(phone)}
              </div>
            </td>
            <td data-label="Role" class="px-4 py-3.5">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadge}">
                ${escapeHtml(role)}
              </span>
            </td>
            <td data-label="Status" class="px-4 py-3.5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge}">
                <i class="fas ${
                  status === "Active" ? "fa-check-circle" : "fa-times-circle"
                } text-xs"></i>
                ${escapeHtml(status)}
              </span>
            </td>
            <td data-label="Registered" class="px-4 py-3.5 text-sm text-[var(--text-secondary)]">
              <div class="flex items-center gap-1.5">
                <i class="far fa-calendar text-xs"></i>
                ${registered}
              </div>
            </td>
            <td data-label="Actions" class="px-4 py-3.5 text-center min-w-[100px]">
              <button class="user-details-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5" data-user-id="${
                u.id
              }" title="View Details">
                <i class="fas fa-eye"></i>
                <span>Details</span>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Render pagination
  renderUsersPagination(totalPages);
}

function renderUsersPagination(totalPages) {
  const container = document.getElementById("usersPagination");
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = [];

  // Previous button
  html.push(`
    <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium transition-colors ${
      _usersCurrentPage === 1
        ? "opacity-50 cursor-not-allowed"
        : "hover:bg-[var(--input-bg)]"
    }" 
      ${_usersCurrentPage === 1 ? "disabled" : ""} 
      onclick="changeUsersPage(${_usersCurrentPage - 1})">
      <i class="fas fa-chevron-left text-xs"></i>
    </button>
  `);

  // Page numbers
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html.push(`
      <button class="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
        i === _usersCurrentPage
          ? "bg-hia-blue text-white border-hia-blue"
          : "border-[var(--input-border)] hover:bg-[var(--input-bg)]"
      }" 
        onclick="changeUsersPage(${i})">
        ${i}
      </button>
    `);
  }

  if (totalPages > 5) {
    html.push('<span class="px-2 text-[var(--text-secondary)]">...</span>');
    html.push(`
      <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium hover:bg-[var(--input-bg)] transition-colors" 
        onclick="changeUsersPage(${totalPages})">
        ${totalPages}
      </button>
    `);
  }

  // Next button
  html.push(`
    <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium transition-colors ${
      _usersCurrentPage === totalPages
        ? "opacity-50 cursor-not-allowed"
        : "hover:bg-[var(--input-bg)]"
    }" 
      ${_usersCurrentPage === totalPages ? "disabled" : ""} 
      onclick="changeUsersPage(${_usersCurrentPage + 1})">
      <i class="fas fa-chevron-right text-xs"></i>
    </button>
  `);

  container.innerHTML = html.join("");
}

function changeUsersPage(page) {
  _usersCurrentPage = page;
  renderUsersTable();
}

function setupUsersFilters() {
  // Search input
  const searchInput = document.getElementById("usersSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      _usersCurrentPage = 1;
      renderUsersTable();
    });
  }

  // Role filter
  const roleFilter = document.getElementById("usersRoleFilter");
  if (roleFilter) {
    roleFilter.addEventListener("change", () => {
      _usersCurrentPage = 1;
      renderUsersTable();
    });
  }

  // Status filter
  const statusFilter = document.getElementById("usersStatusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      _usersCurrentPage = 1;
      renderUsersTable();
    });
  }

  // Sortable headers
  document.querySelectorAll("#usersTable th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (_usersSortField === field) {
        _usersSortOrder = _usersSortOrder === "asc" ? "desc" : "asc";
      } else {
        _usersSortField = field;
        _usersSortOrder = "asc";
      }

      // Update sort icons
      document
        .querySelectorAll("#usersTable th[data-sort] i")
        .forEach((icon) => {
          icon.className = "fas fa-sort text-[var(--text-secondary)] text-xs";
        });

      const icon = th.querySelector("i");
      if (icon) {
        icon.className = `fas fa-sort-${
          _usersSortOrder === "asc" ? "up" : "down"
        } text-hia-blue text-xs`;
      }
      // Re-render table with new sort
      renderUsersTable();
    });
  });
}

// ===== User Detail Modal Logic (global) =====
function openUserModal(userId) {
  const modal = document.getElementById("user-detail-modal");
  if (!modal) return;

  const user = _lastUsers.find((u) => String(u.id) === String(userId));
  if (!user) return;

  setUserModalStaticFields(user);
  populateEditForm(user);

  const idInput = document.getElementById("userModalId");
  if (idInput) idInput.value = user.id;

  const avatar = document.getElementById("userModalAvatar");
  if (avatar) {
    avatar.textContent = (user.username || user.fullName || "U")
      .charAt(0)
      .toUpperCase();
  }

  const subtitle = document.getElementById("userModalSubtitle");
  if (subtitle) {
    subtitle.textContent = `${user.role || "—"} • ${
      user.status || user.userStatus || "—"
    }`;
  }

  setUserModalEditMode(false);
  updateStatusButton(user);

  modal.classList.remove("hidden");
}

function setUserModalStaticFields(user) {
  const safe = (v) => escapeHtml(v || "—");
  document.getElementById("userField_fullName").innerHTML = safe(
    user.username || user.fullName
  );
  document.getElementById("userField_email").innerHTML = safe(user.email);
  document.getElementById("userField_phone").innerHTML = safe(
    user.phone || user.mobile || "—"
  );
  document.getElementById("userField_company").innerHTML = safe(user.company);
  document.getElementById("userField_department").innerHTML = safe(
    user.department
  );
  document.getElementById("userField_designation").innerHTML = safe(
    user.designation
  );
  document.getElementById("userField_role").innerHTML = safe(user.role);

  const status = user.status || user.userStatus || "Active";
  const statusBadge =
    status === "Active"
      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  document.getElementById(
    "userField_status"
  ).innerHTML = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusBadge}"><i class="fas ${
    status === "Active" ? "fa-check-circle" : "fa-times-circle"
  }"></i> ${escapeHtml(status)}</span>`;

  const regEl = document.getElementById("userField_registered");
  const loginEl = document.getElementById("userField_lastLogin");
  const registered =
    user.registered && user.registered !== "—"
      ? new Date(user.registered).toLocaleString()
      : "—";
  const lastLogin =
    user.lastLogin && user.lastLogin !== "—"
      ? new Date(user.lastLogin).toLocaleString()
      : "—";
  if (regEl) regEl.textContent = registered;
  if (loginEl) loginEl.textContent = lastLogin;
}

function populateEditForm(user) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  setVal("userInput_fullName", user.username || user.fullName || "");
  setVal("userInput_email", user.email || "");
  setVal("userInput_phone", user.phone || user.mobile || "");
  setVal("userInput_company", user.company || "");
  setVal("userInput_department", user.department || "");
  setVal("userInput_designation", user.designation || "");
  const roleSelect = document.getElementById("userInput_role");
  if (roleSelect) roleSelect.value = user.role || "Requester";
  const statusEl = document.getElementById("userEdit_status");
  if (statusEl) {
    statusEl.innerHTML = document.getElementById("userField_status").innerHTML;
  }
}

function setUserModalEditMode(edit) {
  const form = document.getElementById("userEditForm");
  const fieldsContainer = document.getElementById("userModalFields");
  const editBtn = document.getElementById("userModalEditSaveBtn");
  if (!form || !fieldsContainer || !editBtn) return;

  if (edit) {
    form.classList.remove("hidden");
    fieldsContainer.classList.add("hidden");
    editBtn.querySelector("i").className = "fas fa-save mr-2";
    editBtn.querySelector("span").textContent = "Save";
  } else {
    form.classList.add("hidden");
    fieldsContainer.classList.remove("hidden");
    editBtn.querySelector("i").className = "fas fa-edit mr-2";
    editBtn.querySelector("span").textContent = "Edit";
  }
  editBtn.dataset.editing = edit ? "1" : "0";
}

function updateStatusButton(user) {
  const btn = document.getElementById("userModalStatusBtn");
  if (!btn) return;
  const status = user.status || user.userStatus || "Active";
  const active = status === "Active";
  btn.innerHTML = `<i class="fas fa-toggle-${
    active ? "on" : "off"
  } mr-2"></i><span>${active ? "Set Inactive" : "Set Active"}</span>`;
  btn.dataset.active = active ? "1" : "0";
}

async function toggleUserStatus(userId) {
  try {
    const res = await fetch(
      `${resolveApiBase()}/admin/toggle-status/${userId}`,
      { method: "POST", credentials: "include" }
    );
    if (!res.ok) throw new Error("Failed to toggle status");
    if (typeof window.showToast === "function") {
      window.showToast("success", "Status updated");
    }
    await loadUsers();
    openUserModal(userId);
  } catch (e) {
    console.error(e);
    if (typeof window.showToast === "function") {
      window.showToast("error", "Failed to update status");
    }
  }
}

async function saveUserEdits() {
  const userId = document.getElementById("userModalId").value;
  const updates = {
    fullName: document.getElementById("userInput_fullName").value.trim(),
    email: document.getElementById("userInput_email").value.trim(),
    mobile: document.getElementById("userInput_phone").value.trim(),
    company: document.getElementById("userInput_company").value.trim(),
    department: document.getElementById("userInput_department").value.trim(),
    designation: document.getElementById("userInput_designation").value.trim(),
    role: document.getElementById("userInput_role").value.trim(),
  };
  try {
    await updateUser(userId, updates);
    if (typeof window.showToast === "function") {
      window.showToast("success", "User updated");
    }
    await loadUsers();
    openUserModal(userId);
  } catch (e) {
    console.error(e);
    if (typeof window.showToast === "function") {
      window.showToast("error", "Failed to update user");
    }
  }
}

async function deleteUserFromModal() {
  const userId = document.getElementById("userModalId").value;
  if (!confirm("Delete this user? This action cannot be undone.")) return;
  try {
    await deleteUser(userId);
    if (typeof window.showToast === "function") {
      window.showToast("success", "User deleted");
    }
    document.getElementById("user-detail-modal").classList.add("hidden");
    await loadUsers();
  } catch (e) {
    console.error(e);
    if (typeof window.showToast === "function") {
      window.showToast("error", "Failed to delete user");
    }
  }
}

// Event delegation for opening modal
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".user-details-btn");
  if (!btn) return;
  const id = btn.getAttribute("data-user-id");
  if (!id) return;
  openUserModal(id);
});

// Modal close (header X, footer Close, backdrop)
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest("#userModalClose");
  const isOverlay = e.target.hasAttribute("data-user-modal-overlay");
  if (!closeBtn && !isOverlay) return;

  const modal = document.getElementById("user-detail-modal");
  if (modal) modal.classList.add("hidden");
});

document
  .getElementById("userModalEditSaveBtn")
  ?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const editing = btn.dataset.editing === "1";
    if (!editing) {
      setUserModalEditMode(true);
    } else {
      saveUserEdits();
    }
  });

document.getElementById("userModalStatusBtn")?.addEventListener("click", () => {
  const idInput = document.getElementById("userModalId");
  const userId = idInput ? idInput.value : null;
  if (userId) toggleUserStatus(userId);
});

document
  .getElementById("userModalDeleteBtn")
  ?.addEventListener("click", () => deleteUserFromModal());

// Expose for potential external usage
window.openUserModal = openUserModal;

async function deleteUser(id) {
  const res = await fetch(`${resolveApiBase()}/admin/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) errMsg = j.error;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return true;
}

// Update user via PATCH
async function updateUser(id, updates) {
  const res = await fetch(`${resolveApiBase()}/admin/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// Small HTML escape helper to avoid injection from backend strings
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Permits data and state
let _lastPermits = [];
let _permitsCurrentPage = 1;
let _permitsPerPage = 15;
let _permitsSortField = null;
let _permitsSortOrder = "desc";

// Load permits list and populate the permits table
async function loadPermits() {
  const tbody = document.getElementById("permitsTableBody");
  const skeleton = document.getElementById("permitsTableSkeleton");
  if (!tbody) return;

  try {
    // Show skeleton
    if (skeleton) skeleton.classList.remove("hidden");
    if (tbody) tbody.classList.add("hidden");

    // Use AbortController to avoid an indefinite loading state
    const controller = new AbortController();
    const timeoutMs = 10000; // 10s
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${resolveApiBase()}/api/permits?limit=500`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    const data = await res.json();
    _lastPermits = data.permits || [];

    // Default: sort permits by submitted date (newest first)
    try {
      _lastPermits.sort((a, b) => {
        const aTime = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // newest first
      });
    } catch (e) {
      // ignore sort failures
    }

    // Hide skeleton, show table body
    if (skeleton) skeleton.classList.add("hidden");
    if (tbody) tbody.classList.remove("hidden");

    renderPermitsTable();
    setupPermitsFilters();

    // Load permit stats
    await loadPermitStats();
  } catch (err) {
    console.error("Failed to load permits:", err);
    const isAbort =
      err && (err.name === "AbortError" || err.code === "ECONNABORTED");
    if (typeof window.showToast === "function")
      window.showToast(
        "error",
        isAbort ? "Timed out loading permits" : "Failed to load permits"
      );

    if (skeleton) skeleton.classList.add("hidden");
    if (tbody) {
      tbody.classList.remove("hidden");
      tbody.innerHTML =
        '<tr><td colspan="7" class="p-8 text-center text-sm text-red-600"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><div>Error loading permits</div></td></tr>';
    }
  }
}

async function loadPermitStats() {
  try {
    const pending = _lastPermits.filter((p) => p.status === "Pending").length;
    const inProgress = _lastPermits.filter(
      (p) => p.status === "In Progress"
    ).length;
    const approved = _lastPermits.filter((p) => p.status === "Approved").length;
    const rejected = _lastPermits.filter((p) => p.status === "Rejected").length;

    document.getElementById("statPending")?.textContent &&
      (document.getElementById("statPending").textContent = pending);
    document.getElementById("statInProgress")?.textContent &&
      (document.getElementById("statInProgress").textContent = inProgress);
    document.getElementById("statApproved")?.textContent &&
      (document.getElementById("statApproved").textContent = approved);
    document.getElementById("statRejected")?.textContent &&
      (document.getElementById("statRejected").textContent = rejected);
  } catch (err) {
    console.warn("Failed to update permit stats:", err);
  }
}

function renderPermitsTable() {
  const tbody = document.getElementById("permitsTableBody");
  if (!tbody) return;

  // Apply filters
  const searchTerm =
    document.getElementById("permitsSearchInput")?.value.toLowerCase() || "";
  const statusFilter =
    document.getElementById("permitsStatusFilter")?.value || "";

  let filtered = _lastPermits.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      (p.permitTitle && p.permitTitle.toLowerCase().includes(searchTerm)) ||
      (p.permitNumber && p.permitNumber.toLowerCase().includes(searchTerm)) ||
      (p.requester?.username &&
        p.requester.username.toLowerCase().includes(searchTerm)) ||
      (p.requester?.fullName &&
        p.requester.fullName.toLowerCase().includes(searchTerm));

    const matchesStatus = !statusFilter || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Apply sorting
  if (_permitsSortField) {
    filtered.sort((a, b) => {
      let aVal, bVal;

      if (_permitsSortField === "submitted") {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (_permitsSortField === "title") {
        aVal = (a.permitTitle || "").toLowerCase();
        bVal = (b.permitTitle || "").toLowerCase();
      } else if (_permitsSortField === "status") {
        aVal = (a.status || "").toLowerCase();
        bVal = (b.status || "").toLowerCase();
      } else {
        aVal = (a[_permitsSortField] || "").toString().toLowerCase();
        bVal = (b[_permitsSortField] || "").toString().toLowerCase();
      }

      if (aVal < bVal) return _permitsSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return _permitsSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  } else {
    // Default sort by submitted date (newest first)
    filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  // Pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / _permitsPerPage);
  const start = (_permitsCurrentPage - 1) * _permitsPerPage;
  const end = start + _permitsPerPage;
  const paginated = filtered.slice(start, end);

  // Update counts
  document.getElementById("permitsShowingCount").textContent = paginated.length;
  document.getElementById("permitsTotalCount").textContent = total;

  if (paginated.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="p-8 text-center text-sm text-[var(--text-secondary)]"><i class="fas fa-inbox text-3xl mb-2 opacity-30"></i><div>No permits found</div></td></tr>';
  } else {
    tbody.innerHTML = paginated
      .map((permit, index) => {
        const globalIndex = start + index + 1;
        const submittedDate = permit.createdAt
          ? new Date(permit.createdAt).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—";
        const title = permit.permitTitle || "—";
        const status = permit.status || "—";
        const permitNumber = permit.permitNumber || "—";
        const requester =
          permit.requester?.fullName || permit.requester?.username || "—";

        // Status badge color with icons
        let statusBadge =
          "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
        let statusIcon = "fa-circle";

        if (status === "Approved") {
          statusBadge =
            "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
          statusIcon = "fa-check-circle";
        } else if (status === "Rejected") {
          statusBadge =
            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
          statusIcon = "fa-times-circle";
        } else if (status === "Pending") {
          statusBadge =
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
          statusIcon = "fa-clock";
        } else if (status === "In Progress") {
          statusBadge =
            "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
          statusIcon = "fa-spinner";
        }

        return `
          <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
            <td data-label="#" class="px-4 py-3.5 text-sm font-semibold text-[var(--text-secondary)]">
              #${globalIndex}
            </td>
            <td data-label="Submitted" class="px-4 py-3.5 text-sm text-[var(--text-secondary)]">
              <div class="flex items-center gap-1.5">
                <i class="far fa-clock text-xs"></i>
                <span class="whitespace-nowrap">${escapeHtml(
                  submittedDate
                )}</span>
              </div>
            </td>
            <td data-label="Title" class="px-4 py-3.5">
              <div class="font-medium text-[var(--text-primary)] line-clamp-2" title="${escapeHtml(
                title
              )}">
                ${escapeHtml(title)}
              </div>
            </td>
            <td data-label="Requester" class="px-4 py-3.5 text-sm">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full avatar-accent flex items-center justify-center text-white font-semibold text-xs">
                  ${escapeHtml(requester.charAt(0).toUpperCase())}
                </div>
                <span class="text-[var(--text-secondary)]">${escapeHtml(
                  requester
                )}</span>
              </div>
            </td>
            <td data-label="Status" class="px-4 py-3.5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge}">
                <i class="fas ${statusIcon} text-xs"></i>
                ${escapeHtml(status)}
              </span>
            </td>
            <td data-label="Permit No" class="px-4 py-3.5 text-sm">
              <div class="font-mono text-[var(--text-secondary)]">${escapeHtml(
                permitNumber
              )}</div>
            </td>
            <td data-label="Actions" class="px-4 py-3.5 text-center">
              <button 
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-hia-soft font-medium text-sm transition-all"
                onclick="viewPermitDetails('${permit._id}')"
                title="View permit details"
              >
                <i class="fas fa-eye text-xs"></i>
                <span>View</span>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // Render pagination
  renderPermitsPagination(totalPages);
}

function renderPermitsPagination(totalPages) {
  const container = document.getElementById("permitsPagination");
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = [];

  // Previous button
  html.push(`
    <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium transition-colors ${
      _permitsCurrentPage === 1
        ? "opacity-50 cursor-not-allowed"
        : "hover:bg-[var(--input-bg)]"
    }" 
      ${_permitsCurrentPage === 1 ? "disabled" : ""} 
      onclick="changePermitsPage(${_permitsCurrentPage - 1})">
      <i class="fas fa-chevron-left text-xs"></i>
    </button>
  `);

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, _permitsCurrentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html.push(`
      <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium hover:bg-[var(--input-bg)] transition-colors" 
        onclick="changePermitsPage(1)">1</button>
    `);
    if (startPage > 2) {
      html.push('<span class="px-2 text-[var(--text-secondary)]">...</span>');
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html.push(`
      <button class="px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
        i === _permitsCurrentPage
          ? "bg-hia-blue text-white border-hia-blue"
          : "border-[var(--input-border)] hover:bg-[var(--input-bg)]"
      }" 
        onclick="changePermitsPage(${i})">${i}</button>
    `);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html.push('<span class="px-2 text-[var(--text-secondary)]">...</span>');
    }
    html.push(`
      <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium hover:bg-[var(--input-bg)] transition-colors" 
        onclick="changePermitsPage(${totalPages})">${totalPages}</button>
    `);
  }

  // Next button
  html.push(`
    <button class="px-3 py-1.5 rounded-lg border border-[var(--input-border)] text-sm font-medium transition-colors ${
      _permitsCurrentPage === totalPages
        ? "opacity-50 cursor-not-allowed"
        : "hover:bg-[var(--input-bg)]"
    }" 
      ${_permitsCurrentPage === totalPages ? "disabled" : ""} 
      onclick="changePermitsPage(${_permitsCurrentPage + 1})">
      <i class="fas fa-chevron-right text-xs"></i>
    </button>
  `);

  container.innerHTML = html.join("");
}

function changePermitsPage(page) {
  _permitsCurrentPage = page;
  renderPermitsTable();
}

function setupPermitsFilters() {
  // Search input
  const searchInput = document.getElementById("permitsSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      _permitsCurrentPage = 1;
      renderPermitsTable();
    });
  }

  // Status filter
  const statusFilter = document.getElementById("permitsStatusFilter");
  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      _permitsCurrentPage = 1;
      renderPermitsTable();
    });
  }

  // Sortable headers
  document.querySelectorAll("#permitsTable th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (_permitsSortField === field) {
        _permitsSortOrder = _permitsSortOrder === "asc" ? "desc" : "asc";
      } else {
        _permitsSortField = field;
        _permitsSortOrder = "asc";
      }

      // Update sort icons
      document
        .querySelectorAll("#permitsTable th[data-sort] i")
        .forEach((icon) => {
          icon.className = "fas fa-sort text-[var(--text-secondary)] text-xs";
        });

      const icon = th.querySelector("i");
      if (icon) {
        icon.className = `fas fa-sort-${
          _permitsSortOrder === "asc" ? "up" : "down"
        } text-hia-blue text-xs`;
      }

      renderPermitsTable();
    });
  });
}

// View permit details (placeholder function)
function viewPermitDetails(permitId) {
  const permit = _lastPermits.find((p) => String(p._id) === String(permitId));
  if (!permit) {
    if (typeof window.showToast === "function") {
      window.showToast("error", "Permit not found");
    }
    return;
  }

  const modal = document.getElementById("permit-detail-modal");
  if (!modal) return;

  // Core fields
  const title = permit.permitTitle || "—";
  const number = permit.permitNumber || "—";
  const status = permit.status || "—";
  const requesterName =
    permit.requester?.fullName || permit.requester?.username || "—";
  const location = permit.location || permit.workLocation || "—";
  const createdAt = permit.createdAt
    ? new Date(permit.createdAt).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  // Header
  const titleEl = document.getElementById("permitModalTitle");
  if (titleEl) titleEl.textContent = title || "Permit Details";

  const subtitleEl = document.getElementById("permitModalSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${number}  b7 ${status}`;

  const idInput = document.getElementById("permitModalId");
  if (idInput) idInput.value = permit._id || "";

  // Status badge
  const statusBadgeEl = document.getElementById("permitModalStatusBadge");
  if (statusBadgeEl) {
    let badgeClasses =
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    let icon = "fa-circle";
    if (status === "Approved") {
      badgeClasses =
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      icon = "fa-check-circle";
    } else if (status === "Rejected") {
      badgeClasses =
        "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      icon = "fa-times-circle";
    } else if (status === "Pending") {
      badgeClasses =
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      icon = "fa-clock";
    } else if (status === "In Progress") {
      badgeClasses =
        "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      icon = "fa-spinner";
    }
    statusBadgeEl.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badgeClasses}`;
    statusBadgeEl.innerHTML = `<i class="fas ${icon} text-xs"></i><span>${escapeHtml(
      status
    )}</span>`;
  }

  // Core detail fields
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "—";
  };

  setText("permitField_title", title);
  setText("permitField_number", number);
  setText("permitField_status", status);
  setText("permitField_submitted", createdAt);
  setText("permitField_requester", requesterName);
  setText("permitField_location", location);

  // Pre-approver details (structure depends on backend; using common fields if present)
  const preName =
    permit.preApprover?.fullName ||
    permit.preApprover?.username ||
    permit.preApproverName ||
    "—";
  const preDateRaw =
    permit.preApprovedAt || permit.preApprover?.approvedAt || null;
  const preDate = preDateRaw
    ? new Date(preDateRaw).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const preComments =
    permit.preApproverComments || permit.preApprover?.comments || "—";

  setText("permitField_preName", preName);
  setText("permitField_preDate", preDate);
  setText("permitField_preComments", preComments);

  // Approver details
  const appName =
    permit.approver?.fullName ||
    permit.approver?.username ||
    permit.approverName ||
    "—";
  const appDateRaw = permit.approvedAt || permit.approver?.approvedAt || null;
  const appDate = appDateRaw
    ? new Date(appDateRaw).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const appComments =
    permit.approverComments || permit.approver?.comments || "—";

  setText("permitField_appName", appName);
  setText("permitField_appDate", appDate);
  setText("permitField_appComments", appComments);

  modal.classList.remove("hidden");
}

// Expose to global so shared/layout.js and other modules can call it
window.loadUsers = loadUsers;
window.loadPermits = loadPermits;
window.viewPermitDetails = viewPermitDetails;

// Close permit modal on X or backdrop click
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest("#permitModalClose");
  const isOverlay = e.target.hasAttribute("data-permit-modal-overlay");
  if (!closeBtn && !isOverlay) return;

  const modal = document.getElementById("permit-detail-modal");
  if (modal) modal.classList.add("hidden");
});

// Apply admin marker on load and also when the shared layout mounts
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", markAsAdminPage);
} else {
  markAsAdminPage();
}

// Layout may mount asynchronously; ensure we re-apply when it does
window.addEventListener("layout:mounted", markAsAdminPage);

// Section toggle functionality for accordion sections
document.addEventListener("click", function (e) {
  const button = e.target.closest('[data-action="toggleSection"]');
  if (!button) return;

  const section = button.getAttribute("data-section");
  const content = document.getElementById(`${section}Content`);
  const icon = document.getElementById(`${section}Icon`);

  if (!content || !icon) return;

  // Toggle content visibility
  content.classList.toggle("hidden");

  // Smooth rotate the chevron using Tailwind rotate utility
  const expanded = !content.classList.contains("hidden");
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
  icon.classList.add(
    "transform",
    "transition-transform",
    "duration-300",
    "ease-in-out"
  );
  if (expanded) {
    icon.classList.add("rotate-180");
  } else {
    icon.classList.remove("rotate-180");
  }
});

// Prevent double submissions on permit action buttons
document.addEventListener("click", function (e) {
  const btn = e.target.closest(
    "#permitApproveBtn, #permitRejectBtn, #permitUpdateBtn"
  );
  if (!btn) return;

  // If already submitting, ignore further clicks
  if (btn.dataset.__submitting === "1") {
    e.preventDefault();
    return;
  }

  // Mark as submitting and apply visual state
  try {
    btn.dataset.__submitting = "1";
    btn.disabled = true;
    btn.classList.add("loading");
  } catch (err) {
    /* ignore UI failures */
  }

  // Fallback: if action doesn't clear state, reset after 6s to avoid permanently disabled buttons
  setTimeout(() => {
    try {
      btn.dataset.__submitting = "0";
      btn.disabled = false;
      btn.classList.remove("loading");
    } catch (e) {}
  }, 6000);
});

// --- Announcement Modal Management ---
(function initAnnouncementModal() {
  // Function to set up modal once it exists
  function setupModal() {
    const modal = document.getElementById("announcement-modal");
    const closeBtn = document.getElementById("announcementModalClose");
    const saveBtn = document.getElementById("announcementSaveBtn");
    const newBtn = document.getElementById("announcementNewBtn");

    if (!modal) {
      console.warn("Announcement modal not found, will retry...");
      return false;
    }

    console.log("Setting up announcement modal...");

    // Close modal
    function closeModal() {
      modal.classList.add("hidden");
      // Remove body-level overlay if present
      try {
        const bodyOv = document.querySelector(
          "[data-announcement-body-overlay]"
        );
        if (bodyOv) bodyOv.remove();
      } catch (e) {
        /* ignore */
      }
    }

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Close on overlay click
    modal.addEventListener("click", (e) => {
      if (
        e.target === modal ||
        e.target.classList.contains("bg-[var(--overlay-bg)]")
      ) {
        closeModal();
      }
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        closeModal();
      }
    });

    // New button - clear form
    if (newBtn) {
      newBtn.addEventListener("click", () => {
        document.getElementById("announcement_id").value = "";
        document.getElementById("announcement_title").value = "";
        document.getElementById("announcement_editor").textContent = "";
        document.getElementById("announcement_message").value = "";

        // Clear flatpickr dates
        const startInput = document.getElementById("announcement_start");
        const endInput = document.getElementById("announcement_end");
        if (startInput?._flatpickr) startInput._flatpickr.clear();
        if (endInput?._flatpickr) endInput._flatpickr.clear();

        document.getElementById("announcement_active").checked = true;
      });
    }

    // Save button - create or update announcement
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        try {
          const id = document.getElementById("announcement_id").value;
          const title = document.getElementById("announcement_title").value;
          const editor = document.getElementById("announcement_editor");
          const message = editor.textContent || editor.innerText;
          const start = document.getElementById("announcement_start").value;
          const end = document.getElementById("announcement_end").value;
          const active = document.getElementById("announcement_active").checked;

          // Validate
          if (!message.trim()) {
            if (typeof window.showToast === "function") {
              window.showToast("error", "Message is required");
            } else {
              alert("Message is required");
            }
            return;
          }

          const payload = {
            title: title || "Announcement",
            message: message.trim(),
            icon: "fa-bullhorn",
            isActive: active,
          };

          if (start) payload.startAt = start;
          if (end) payload.endAt = end;

          let response;
          if (id) {
            // Update existing
            response = await fetch(`${getApiBase()}/api/system-message/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
          } else {
            // Create new
            response = await fetch(`${getApiBase()}/api/system-message`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          if (typeof window.showToast === "function") {
            window.showToast(
              "success",
              id
                ? "Announcement updated successfully"
                : "Announcement created successfully"
            );
          }

          // Reload list
          await loadAnnouncements();

          // Clear form
          document.getElementById("announcement_id").value = "";
          document.getElementById("announcement_title").value = "";
          document.getElementById("announcement_editor").textContent = "";
          document.getElementById("announcement_message").value = "";

          // Clear flatpickr dates
          const startInput = document.getElementById("announcement_start");
          const endInput = document.getElementById("announcement_end");
          if (startInput?._flatpickr) startInput._flatpickr.clear();
          if (endInput?._flatpickr) endInput._flatpickr.clear();

          document.getElementById("announcement_active").checked = true;

          // Close modal after save
          closeModal();
        } catch (err) {
          console.error("Failed to save announcement:", err);
          if (typeof window.showToast === "function") {
            window.showToast("error", "Failed to save announcement");
          }
        }
      });
    }

    return true;
  }

  // Try to set up immediately
  if (!setupModal()) {
    // If modal doesn't exist yet, wait for layout to load
    window.addEventListener("layout:mounted", setupModal);
    // Fallback: try again after delay
    setTimeout(setupModal, 1000);
  }

  // Initialize flatpickr for date/time inputs
  function initDatePickers() {
    if (!window.flatpickr) {
      console.warn("Flatpickr library not loaded");
      return;
    }

    const startInput = document.getElementById("announcement_start");
    const endInput = document.getElementById("announcement_end");

    if (startInput && !startInput._flatpickr) {
      const startPicker = window.flatpickr(startInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        allowInput: false,
        minDate: "today",
        minuteIncrement: 1,
        onOpen: function (selectedDates, dateStr, instance) {
          // Always set minDate to current time when opening
          instance.set("minDate", new Date());
        },
        onChange: function (selectedDates) {
          if (endInput._flatpickr && selectedDates[0]) {
            const startDate = selectedDates[0];
            // Set end date minimum to start date
            endInput._flatpickr.set("minDate", startDate);

            // If end date is before start date, clear it
            const endDate = endInput._flatpickr.selectedDates[0];
            if (endDate && endDate < startDate) {
              endInput._flatpickr.clear();
            }
          }
        },
      });
    }

    if (endInput && !endInput._flatpickr) {
      const endPicker = window.flatpickr(endInput, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        allowInput: false,
        minDate: "today",
        minuteIncrement: 1,
        onOpen: function (selectedDates, dateStr, instance) {
          // Set minDate based on start date if available
          const startDate = startInput._flatpickr?.selectedDates[0];
          if (startDate) {
            instance.set("minDate", startDate);
          } else {
            instance.set("minDate", new Date());
          }
        },
      });
    }
  }

  // Load announcements list
  async function loadAnnouncements() {
    const list = document.getElementById("announcementList");
    if (!list) return;

    try {
      list.innerHTML =
        '<div class="text-sm text-[var(--text-secondary)] p-4">Loading...</div>';

      // Use dev-aware base to avoid 5500 -> 404; map to 5000 locally
      const apiUrl = `${getApiBase()}/api/admin/system-messages`;
      console.log("Fetching announcements from:", apiUrl);

      const response = await fetch(apiUrl, {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const announcements = await response.json();
      console.log("Loaded announcements:", announcements.length);

      if (!announcements || announcements.length === 0) {
        list.innerHTML =
          '<div class="flex flex-col items-center justify-center py-12 text-center"><i class="fas fa-inbox text-4xl text-[var(--text-secondary)] opacity-50 mb-3"></i><p class="text-sm text-[var(--text-secondary)]">No announcements yet</p></div>';
        return;
      }

      // Render announcements
      list.innerHTML = announcements
        .map(
          (ann) => `
        <div class="announcement-item group rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] hover:border-indigo-500/50 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer" data-id="${
          ann.id
        }">
          <!-- Header -->
          <div class="px-4 py-3 border-b border-[var(--input-border)] section-header-gradient">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <div class="w-8 h-8 rounded-full bg-hia-blue-10 flex items-center justify-center flex-shrink-0">
                  <i class="fas fa-bullhorn text-hia-blue text-xs"></i>
                </div>
                <h4 class="text-sm font-semibold text-[var(--text-primary)] truncate">
                  ${ann.title || "Announcement"}
                </h4>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${
                ann.isActive
                  ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                  : "bg-gray-500/20 text-gray-600 dark:text-gray-400 border border-gray-500/30"
              }">
                ${ann.isActive ? "● Published" : "○ Draft"}
              </span>
            </div>
          </div>
          
          <!-- Content -->
          <div class="px-4 py-3">
            <p class="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-3">
              ${ann.message ? ann.message.substring(0, 120) : "No message"}${
            ann.message && ann.message.length > 120 ? "..." : ""
          }
            </p>
            
            <!-- Meta Information -->
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <i class="far fa-calendar text-indigo-500"></i>
                <span>Created: ${new Date(ann.createdAt).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }
                )}</span>
              </div>
              ${
                ann.startAt || ann.endAt
                  ? `
              <div class="text-xs text-[var(--text-secondary)] bg-indigo-500/5 rounded-lg px-3 py-2 border border-indigo-500/20">
                <div class="flex items-start gap-2">
                  <i class="far fa-clock text-indigo-500 mt-0.5"></i>
                  <div class="flex-1 space-y-1">
                    ${
                      ann.startAt
                        ? `<div><span class="font-medium text-[var(--text-primary)]">Start:</span> ${new Date(
                            ann.startAt
                          ).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</div>`
                        : ""
                    }
                    ${
                      ann.endAt
                        ? `<div><span class="font-medium text-[var(--text-primary)]">End:</span> ${new Date(
                            ann.endAt
                          ).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</div>`
                        : ""
                    }
                  </div>
                </div>
              </div>
              `
                  : ""
              }
            </div>
          </div>
          
          <!-- Actions -->
          <div class="px-4 py-3 border-t border-[var(--input-border)] bg-[var(--input-bg)]/50">
            <div class="flex items-center gap-2">
              <button class="toggle-publish flex-1 text-xs px-4 py-2 rounded-lg font-semibold transition-all ${
                ann.isActive
                  ? "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 dark:text-gray-400 border border-gray-500/30"
                  : "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400 border border-green-500/30"
              }" data-id="${ann.id}" data-active="${ann.isActive}">
                <i class="fas ${
                  ann.isActive ? "fa-eye-slash" : "fa-eye"
                } mr-1.5"></i>${ann.isActive ? "Unpublish" : "Publish"}
              </button>
              <button class="delete-announcement text-xs px-4 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 font-semibold transition-all border border-red-500/30" data-id="${
                ann.id
              }">
                <i class="fas fa-trash mr-1.5"></i>Delete
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join("");

      // Add click handlers for editing
      list.querySelectorAll(".announcement-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          if (e.target.closest(".delete-announcement")) return;
          const id = item.dataset.id;
          const announcement = announcements.find((a) => a.id === id);
          if (announcement) {
            loadAnnouncementIntoForm(announcement);
          }
        });
      });

      // Add click handlers for publish/unpublish
      list.querySelectorAll(".toggle-publish").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const isActive = btn.dataset.active === "true";
          openPublishConfirm(id, !isActive);
        });
      });

      // Add click handlers for delete buttons
      list.querySelectorAll(".delete-announcement").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (confirm("Are you sure you want to delete this announcement?")) {
            await deleteAnnouncement(id);
          }
        });
      });
    } catch (err) {
      console.error("Failed to load announcements:", err);
      list.innerHTML =
        '<div class="text-sm text-red-500 p-4">Failed to load announcements</div>';
    }
  }

  // Load announcement into form for editing
  function loadAnnouncementIntoForm(announcement) {
    document.getElementById("announcement_id").value = announcement.id;
    document.getElementById("announcement_title").value =
      announcement.title || "";
    document.getElementById("announcement_editor").textContent =
      announcement.message || "";
    document.getElementById("announcement_message").value =
      announcement.message || "";

    // Format dates for flatpickr (convert ISO to local datetime string)
    const startInput = document.getElementById("announcement_start");
    const endInput = document.getElementById("announcement_end");

    if (announcement.startAt) {
      const startDate = new Date(announcement.startAt);
      if (startInput._flatpickr) {
        startInput._flatpickr.setDate(startDate, false);
      } else {
        startInput.value = formatDateTimeLocal(startDate);
      }
    } else {
      if (startInput._flatpickr) {
        startInput._flatpickr.clear();
      } else {
        startInput.value = "";
      }
    }

    if (announcement.endAt) {
      const endDate = new Date(announcement.endAt);
      if (endInput._flatpickr) {
        endInput._flatpickr.setDate(endDate, false);
      } else {
        endInput.value = formatDateTimeLocal(endDate);
      }
    } else {
      if (endInput._flatpickr) {
        endInput._flatpickr.clear();
      } else {
        endInput.value = "";
      }
    }

    document.getElementById("announcement_active").checked =
      announcement.isActive;
  }

  // Helper function to format date to "YYYY-MM-DD HH:mm" format
  function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  // Open publish/unpublish confirmation modal (from shared layout)
  function openPublishConfirm(id, newState) {
    const modal = document.getElementById("publish-confirm-modal");
    const msgEl = document.getElementById("publish-confirm-message");
    const confirmBtn = document.getElementById("publishConfirmBtn");
    const cancelBtn = document.getElementById("publishCancelBtn");

    // Fallback if modal not present
    if (!modal || !confirmBtn || !cancelBtn) {
      togglePublish(id, newState);
      return;
    }

    if (msgEl) {
      msgEl.textContent = newState
        ? "Publish this announcement?"
        : "Unpublish this announcement?";
    }

    const cleanup = () => {
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      modal.classList.add("hidden");
    };

    cancelBtn.onclick = cleanup;
    confirmBtn.onclick = async () => {
      try {
        await togglePublish(id, newState);
      } finally {
        cleanup();
      }
    };

    modal.classList.remove("hidden");
  }

  // Toggle publish state via API
  async function togglePublish(id, isActive) {
    try {
      const response = await fetch(`${getApiBase()}/api/system-message/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (typeof window.showToast === "function") {
        window.showToast("success", isActive ? "Published" : "Unpublished");
      }
      await loadAnnouncements();
    } catch (err) {
      console.error("Failed to change publish state:", err);
      if (typeof window.showToast === "function") {
        window.showToast("error", "Failed to update publish state");
      }
    }
  }

  // Delete announcement
  async function deleteAnnouncement(id) {
    try {
      const response = await fetch(`${getApiBase()}/api/system-message/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (typeof window.showToast === "function") {
        window.showToast("success", "Announcement deleted successfully");
      }

      // Reload list
      await loadAnnouncements();
    } catch (err) {
      console.error("Failed to delete announcement:", err);
      if (typeof window.showToast === "function") {
        window.showToast("error", "Failed to delete announcement");
      }
    }
  }

  // Load on init
  loadAnnouncements();

  // Also load users list on init
  try {
    if (typeof window.loadUsers === "function") window.loadUsers();
  } catch (e) {}

  // Load permits list on init
  try {
    if (typeof window.loadPermits === "function") window.loadPermits();
  } catch (e) {}

  // Wait for layout to be mounted before initializing date pickers
  // Listen for the custom event that layout.mount.js dispatches
  window.addEventListener("layout:mounted", () => {
    console.log("Layout mounted, initializing date pickers...");
    initDatePickers();
    try {
      if (typeof window.loadUsers === "function") window.loadUsers();
    } catch (e) {}
    try {
      if (typeof window.loadPermits === "function") window.loadPermits();
    } catch (e) {}
  });

  // Also try to initialize after a short delay as fallback
  setTimeout(() => {
    if (!document.getElementById("announcement_start")?._flatpickr) {
      console.log("Fallback: initializing date pickers...");
      initDatePickers();
    }
    try {
      if (typeof window.loadUsers === "function") window.loadUsers();
    } catch (e) {}
    try {
      if (typeof window.loadPermits === "function") window.loadPermits();
    } catch (e) {}
  }, 1000);

  // Compute API base similar to shared/layout.js so dev ports map to 5000
  function getApiBase() {
    try {
      if (
        window.__API_BASE__ &&
        typeof window.__API_BASE__ === "string" &&
        window.__API_BASE__.trim()
      ) {
        return window.__API_BASE__.trim();
      }
      try {
        const ls = localStorage.getItem("API_BASE");
        if (ls && ls.trim()) return ls.trim();
      } catch (_) {}
      try {
        const meta = document.querySelector('meta[name="api-base"]');
        if (meta && meta.content && meta.content.trim())
          return meta.content.trim();
      } catch (_) {}

      const DEFAULT_PROD = "https://ptw-yu8u.onrender.com";
      const { protocol, hostname, port } = window.location;
      if (hostname === "127.0.0.1" || hostname === "localhost") {
        const devToBackend = new Set(["5500", "3000", "8080"]);
        if (port && devToBackend.has(port))
          return `${protocol}//${hostname}:5000`;
        return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
      }
      if (!hostname || window.location.protocol === "file:")
        return DEFAULT_PROD;
      try {
        const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
        if (origin === DEFAULT_PROD) return origin;
      } catch (_) {}
      return DEFAULT_PROD;
    } catch (_) {
      return "";
    }
  }
})();

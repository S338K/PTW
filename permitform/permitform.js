import { checkSession, initIdleTimer, logoutUser } from "../session.js";
import { formatDate24, formatLastLogin } from "../date-utils.js";
import { API_BASE } from '../config.js';

// ========== ENHANCED DROPDOWN MANAGEMENT SYSTEM ==========
function toggleProfileDropdown(event) {
  console.log('🔴 toggleProfileDropdown CALLED');

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const dropdown = document.getElementById('profileDropdown');
  const button = document.getElementById('profileDropdownBtn');

  if (!dropdown || !button) {
    console.error('Dropdown elements not found');
    return;
  }

  const isHidden = dropdown.classList.contains('hidden');

  // Close notification dropdown first
  const notificationDropdown = document.getElementById('notificationDropdown');
  if (notificationDropdown) {
    notificationDropdown.classList.add('hidden');
  }

  // Toggle profile dropdown
  if (isHidden) {
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }

  console.log('✅ Profile dropdown toggled, new state:', isHidden ? 'visible' : 'hidden');
}

function toggleNotifications(event) {
  console.log('🔔 toggleNotifications CALLED');

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const dropdown = document.getElementById('notificationDropdown');
  const button = document.getElementById('notificationBtn');

  if (!dropdown || !button) {
    console.error('Notification elements not found');
    return;
  }

  const isHidden = dropdown.classList.contains('hidden');

  // Close profile dropdown first
  const profileDropdown = document.getElementById('profileDropdown');
  if (profileDropdown) {
    profileDropdown.classList.add('hidden');
  }

  // Toggle notification dropdown
  if (isHidden) {
    dropdown.classList.remove('hidden');
    loadNotifications();
  } else {
    dropdown.classList.add('hidden');
  }

  console.log('✅ Notifications dropdown toggled, new state:', isHidden ? 'visible' : 'hidden');
}

function setupDropdownCloseHandlers() {
  document.addEventListener('click', function (e) {
    const profileButton = document.getElementById('profileDropdownBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const notificationButton = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');

    // Check if click is outside profile dropdown
    if (profileDropdown && !profileDropdown.contains(e.target) && profileButton && !profileButton.contains(e.target)) {
      if (!profileDropdown.classList.contains('hidden')) {
        console.log('Closing profile dropdown via outside click');
        profileDropdown.classList.add('hidden');
      }
    }

    // Check if click is outside notification dropdown
    if (notificationDropdown && !notificationDropdown.contains(e.target) && notificationButton && !notificationButton.contains(e.target)) {
      if (!notificationDropdown.classList.contains('hidden')) {
        console.log('Closing notification dropdown via outside click');
        notificationDropdown.classList.add('hidden');
      }
    }
  });

  // Close dropdowns when pressing Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const profileDropdown = document.getElementById('profileDropdown');
      const notificationDropdown = document.getElementById('notificationDropdown');

      if (profileDropdown) profileDropdown.classList.add('hidden');
      if (notificationDropdown) notificationDropdown.classList.add('hidden');
    }
  });
}

// ========== DEBUGGING HELPER ==========
function testDropdowns() {
  console.log('=== DROPDOWN DEBUG INFO ===');
  console.log('Profile button:', document.getElementById('profileDropdownBtn'));
  console.log('Profile dropdown:', document.getElementById('profileDropdown'));
  console.log('Notification button:', document.getElementById('notificationBtn'));
  console.log('Notification dropdown:', document.getElementById('notificationDropdown'));
  console.log('toggleProfileDropdown function:', typeof toggleProfileDropdown);
  console.log('toggleNotifications function:', typeof toggleNotifications);

  // Test CSS classes
  const profileDropdown = document.getElementById('profileDropdown');
  if (profileDropdown) {
    console.log('Profile dropdown classes:', profileDropdown.className);
    console.log('Profile dropdown hidden:', profileDropdown.classList.contains('hidden'));
  }
}
window.testDropdowns = testDropdowns;

document.addEventListener('DOMContentLoaded', async function () {
  console.log("✅ profile.js loaded");

  // ========== DROPDOWN EVENT LISTENER SETUP ==========
  console.log('Setting up dropdown event listeners...');

  // Setup dropdown close handlers
  setupDropdownCloseHandlers();

  // Setup profile dropdown
  const profileBtn = document.getElementById('profileDropdownBtn');
  if (profileBtn) {
    console.log('✅ Setting up profile dropdown handler');
    profileBtn.addEventListener('click', toggleProfileDropdown);
  } else {
    console.error('❌ Profile button not found');
  }

  // Setup notification dropdown
  const notificationBtn = document.getElementById('notificationBtn');
  if (notificationBtn) {
    console.log('✅ Setting up notification dropdown handler');
    notificationBtn.addEventListener('click', toggleNotifications);
  } else {
    console.error('❌ Notification button not found');
  }

  const user = await checkSession();
  if (!user) return;
  initIdleTimer();

  /* ===== Populate Profile Card ===== */
  const fullNameEl = document.getElementById("profileFullName");
  if (fullNameEl) fullNameEl.textContent = user.fullName || user.username || "—";

  const emailEl = document.getElementById("profileEmail");
  if (emailEl) emailEl.textContent = user.email || "—";

  const companyEl = document.getElementById("profileCompany");
  // company display removed from profile overview

  /* ===== Populate Avatar and Display Names ===== */
  const profileInitials = (user.fullName || user.username || "U").charAt(0).toUpperCase();

  // Update main profile avatar
  const profileInitialsEl = document.getElementById("profileInitials");
  if (profileInitialsEl) profileInitialsEl.textContent = profileInitials;

  // Update large avatar in profile card
  const profileAvatarLarge = document.getElementById("profileAvatarLarge");
  if (profileAvatarLarge) profileAvatarLarge.textContent = profileInitials;

  // Update main display name
  const profileDisplayName = document.getElementById("profileDisplayName");
  if (profileDisplayName) profileDisplayName.textContent = `Welcome, ${user.fullName || user.username || "User"}`;

  const profileDisplayNameMain = document.getElementById("profileDisplayNameMain");
  if (profileDisplayNameMain) profileDisplayNameMain.textContent = user.fullName || user.username || "User";

  /* ===== Populate Hover Tooltip Elements ===== */
  const hoverInitials = document.getElementById("hoverInitials");
  if (hoverInitials) hoverInitials.textContent = profileInitials;

  const hoverName = document.getElementById("hoverName");
  if (hoverName) hoverName.textContent = user.fullName || user.username || "User";

  const hoverRole = document.getElementById("hoverRole");
  if (hoverRole) hoverRole.textContent = "System User";

  const hoverEmail = document.getElementById("hoverEmail");
  if (hoverEmail) hoverEmail.textContent = user.email || "—";

  // company removed from profile overview

  const hoverPhone = document.getElementById("hoverPhone");
  // Accept mobile, mobileNumber, phoneNumber, contact objects
  const phoneVal = user.mobile || user.mobileNumber || user.phone || user.phoneNumber || (user.contact && (user.contact.mobile || user.contact.phone)) || "Not provided";
  if (hoverPhone) hoverPhone.textContent = phoneVal;

  const hoverJoinDate = document.getElementById("hoverJoinDate");
  if (hoverJoinDate) {
    // Prefer createdAt from user record and format as 'Month Year'
    const created = user.createdAt || user.created_at || user.joinDate || user.registeredAt;
    if (created) {
      const d = new Date(created);
      try {
        const monthYear = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
        hoverJoinDate.textContent = `Member since ${monthYear}`;
      } catch (e) {
        hoverJoinDate.textContent = `Member since ${d.getFullYear()}`;
      }
    } else {
      hoverJoinDate.textContent = 'Member since Unknown';
    }
  }

  // Populate IP address (server should send client IP on session)
  const hoverIp = document.getElementById('hoverIp');
  if (hoverIp) {
    // Prefer server-provided client IP fields if available
    let ip = user.clientIp || user.ip || user.ipAddress || user.ip_address || user.remoteAddress || null;
    if (ip) {
      hoverIp.textContent = `IP Address: ${ip}`;
    } else {
      // Try a backend endpoint that returns the client IP (non-blocking)
      fetch(`${API_BASE}/api/client-ip`, { credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error('no-ip-endpoint');
          return res.json();
        })
        .then(data => {
          if (data && (data.ip || data.clientIp)) {
            hoverIp.textContent = `IP Address: ${data.ip || data.clientIp}`;
          }
        })
        .catch(() => {
          // Optional public fallback. If you prefer not to call external services, remove this block
          fetch('https://api.ipify.org?format=json')
            .then(r => r.json())
            .then(d => { if (d && d.ip) hoverIp.textContent = `IP Address: ${d.ip}`; })
            .catch(() => { hoverIp.textContent = 'IP Address: Unknown'; });
        });
    }
  }

  // Set active/inactive status badge
  const hoverStatusBadge = document.getElementById('hoverStatusBadge');
  const hoverStatusText = document.getElementById('hoverStatusText');
  const hoverStatusDot = document.getElementById('hoverStatusDot');
  const statusVal = (user.userStatus || user.status || user.user_status || user.userState || 'Active');
  if (hoverStatusText) hoverStatusText.textContent = statusVal === 'Inactive' ? 'Inactive' : 'Active User';
  if (hoverStatusBadge) {
    if (statusVal === 'Inactive') {
      hoverStatusBadge.classList.remove('bg-green-100');
      hoverStatusBadge.classList.add('bg-red-100');
      if (hoverStatusText) hoverStatusText.classList.remove('text-green-700');
      if (hoverStatusText) hoverStatusText.classList.add('text-red-600');
    } else {
      hoverStatusBadge.classList.remove('bg-red-100');
      hoverStatusBadge.classList.add('bg-green-100');
      if (hoverStatusText) hoverStatusText.classList.remove('text-red-600');
      if (hoverStatusText) hoverStatusText.classList.add('text-green-700');
    }
  }

  /* ===== Welcome + Last Login ===== */
  // Compute last login text
  let lastLoginText = 'Never';
  if (user.prevLogin) {
    lastLoginText = formatLastLogin(user.prevLogin);
  } else if (user.lastLogin) {
    lastLoginText = formatLastLogin(user.lastLogin);
  } else if (user.last_login) {
    lastLoginText = formatLastLogin(user.last_login);
  }

  const lastLoginDiv = document.getElementById('profileLastLogin');
  if (lastLoginDiv) {
    lastLoginDiv.textContent = `Last Login: ${lastLoginText}`;
  }

  // Also populate hover tooltip last login in format: Last Login at <time> on <day>
  const hoverLastLogin = document.getElementById("hoverLastLogin");
  if (hoverLastLogin) {
    // Determine source date value
    let sourceDate = null;
    if (user.prevLogin) sourceDate = new Date(user.prevLogin);
    else if (user.lastLogin) sourceDate = new Date(user.lastLogin);
    else if (user.last_login) sourceDate = new Date(user.last_login);

    if (sourceDate && !isNaN(sourceDate.getTime())) {
      const now = new Date();
      const timePart = sourceDate.toLocaleTimeString(undefined, { hour12: false });
      const isSameDay = sourceDate.getFullYear() === now.getFullYear() && sourceDate.getMonth() === now.getMonth() && sourceDate.getDate() === now.getDate();
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      const isYesterday = sourceDate.getFullYear() === yesterday.getFullYear() && sourceDate.getMonth() === yesterday.getMonth() && sourceDate.getDate() === yesterday.getDate();

      let dayPart;
      if (isSameDay) dayPart = 'Today';
      else if (isYesterday) dayPart = 'Yesterday';
      else dayPart = sourceDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

      hoverLastLogin.textContent = `Last Login at ${timePart} on ${dayPart}`;
    } else {
      hoverLastLogin.textContent = 'Last Login: Never';
    }
  }

  /* ===== Load Submitted Permit Details table ===== */
  if (document.getElementById('permitTable')) {
    try {
      const res = await fetch(`${API_BASE}/api/permit`, { credentials: 'include' });
      if (res.ok) {
        const permits = await res.json();
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        let stats = { Approved: 0, Pending: 0, Rejected: 0 };
        permits.forEach((permit, index) => {
          const row = document.createElement('tr');

          // Serial number
          const serialTd = document.createElement('td');
          serialTd.textContent = index + 1;

          // Submitted date/time
          const submittedTd = document.createElement('td');
          submittedTd.textContent = formatDate24(permit.createdAt);

          // Permit title
          const titleTd = document.createElement('td');
          titleTd.textContent = permit.permitTitle || '—';

          // Status with badge
          const statusTd = document.createElement('td');
          const badge = document.createElement('span');
          badge.textContent = permit.status || 'Pending';
          badge.classList.add('status-badge', (permit.status || 'pending').toLowerCase());
          statusTd.appendChild(badge);

          // Permit number (download link if approved)
          const numberTd = document.createElement('td');
          if (permit.status === 'Approved' && permit.permitNumber) {
            const link = document.createElement('a');
            link.href = `${API_BASE}/api/permit/${permit._id}/pdf`;
            link.textContent = permit.permitNumber;
            link.title = "Click to download";

            link.addEventListener('click', (e) => {
              handlePermitClick(e, permit._id, permit.permitNumber);
            });

            numberTd.appendChild(link);
          } else {
            numberTd.textContent = 'Permit no not yet generated';
          }

          row.appendChild(serialTd);
          row.appendChild(submittedTd);
          row.appendChild(titleTd);
          row.appendChild(statusTd);
          row.appendChild(numberTd);

          tbody.appendChild(row);

          // accumulate stats by status (case-insensitive)
          const st = (permit.status || 'Pending');
          if (stats[st] === undefined) stats[st] = 0;
          stats[st]++;
        });

        // Initialize profile stats chart with permit data
        initializeProfileStatsChart(stats);

        // Update permit analytics
        updatePermitAnalytics(stats, permits);

      } else {
        console.warn('Failed to load permits');
      }
    } catch (err) {
      console.warn('Error fetching permits:', err);
    }
  }

  //===============PDF Download============//
  async function handlePermitClick(e, permitId, permitNumber) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
      return;
    }
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/api/permit/${permitId}/pdf`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) {
        let message = 'Failed to download PDF';
        try {
          const data = await res.json();
          if (data.message) message = data.message;
        } catch (_) { }
        alert(message);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${permitNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Error downloading PDF');
    }
  }

  /* ===== Redirect to permitform.html ===== */
  const submitPtw = document.getElementById('sbmtptw');
  if (submitPtw) {
    submitPtw.addEventListener('click', function () {
      // Log activity
      if (typeof logUserActivity === 'function') {
        logUserActivity('navigation', 'Navigated to permitform', 'User clicked Submit PTW button');
      }

      window.location.href = '../permitform/permitform.html';
    });
  }

  // ===== Logout button =====
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Log activity before logout
      if (typeof logUserActivity === 'function') {
        logUserActivity('logout', 'User logged out', 'User manually logged out from profile page');
      }

      logoutUser();
    });
  }

  // Enhanced Profile Display Updates
  updateEnhancedProfileDisplay(user);

  // Theme Toggle Handler
  setupThemeToggle();

  // Setup activity tracking
  setupActivityTracking();

  // Modal Form Handlers
  setupModalForms();

  // Initialize charts
  createPermitCharts();

  // Initialize notifications
  updateNotificationCount();

  // Cleanup function for page unload
  window.addEventListener('beforeunload', () => {
    // Destroy all chart instances
    Object.keys(window.chartInstances || {}).forEach(chartId => {
      destroyChart(chartId);
    });
  });
});

// Enhanced Profile Display Function
function updateEnhancedProfileDisplay(user) {
  // Update header profile info
  const profileInitials = document.getElementById('profileInitials');
  const profilePhone = document.getElementById('profilePhone');
  const profileJoinDate = document.getElementById('profileJoinDate');

  // Update hover card elements
  const hoverInitials = document.getElementById('hoverInitials');
  const hoverName = document.getElementById('hoverName');
  const hoverRole = document.getElementById('hoverRole');
  const hoverEmail = document.getElementById('hoverEmail');
  const hoverLastLogin = document.getElementById('hoverLastLogin');

  // Update profile initials in both places
  if (profileInitials || hoverInitials) {
    const name = user.fullName || user.username || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (profileInitials) profileInitials.textContent = initials;
    if (hoverInitials) hoverInitials.textContent = initials;
  }

  // Update hover card information
  if (hoverName) {
    hoverName.textContent = user.fullName || user.username || 'User Name';
  }

  if (hoverRole) {
    hoverRole.textContent = user.role || 'System User';
  }

  // Update status badge inside enhanced display as well
  const hoverStatusBadge = document.getElementById('hoverStatusBadge');
  const hoverStatusText = document.getElementById('hoverStatusText');
  const hoverStatusDot = document.getElementById('hoverStatusDot');
  const statusVal = (user.userStatus || user.status || user.user_status || 'Active');
  if (hoverStatusText) hoverStatusText.textContent = statusVal === 'Inactive' ? 'Inactive' : 'Active User';
  if (hoverStatusBadge) {
    if (statusVal === 'Inactive') {
      hoverStatusBadge.classList.remove('bg-green-100');
      hoverStatusBadge.classList.add('bg-red-100');
      if (hoverStatusText) hoverStatusText.classList.remove('text-green-700');
      if (hoverStatusText) hoverStatusText.classList.add('text-red-600');
    } else {
      hoverStatusBadge.classList.remove('bg-red-100');
      hoverStatusBadge.classList.add('bg-green-100');
      if (hoverStatusText) hoverStatusText.classList.remove('text-red-600');
      if (hoverStatusText) hoverStatusText.classList.add('text-green-700');
    }
  }

  if (hoverEmail) {
    hoverEmail.textContent = user.email || 'user@hia.gov.ae';
  }

  // company removed from enhanced display

  // Populate phone/mobile in update flow
  const hoverPhone = document.getElementById('hoverPhone');
  const phoneVal = user.mobile || user.mobileNumber || user.phone || user.phoneNumber || (user.contact && (user.contact.mobile || user.contact.phone)) || 'Not provided';
  if (hoverPhone) hoverPhone.textContent = phoneVal;

  // Populate IP if available in user object
  const hoverIp = document.getElementById('hoverIp');
  if (hoverIp) {
    const ipFromUser = user.clientIp || user.ip || user.ipAddress || user.ip_address || user.remoteAddress || null;
    if (ipFromUser) hoverIp.textContent = `IP Address: ${ipFromUser}`;
  }

  if (hoverLastLogin) {
    // Build 'Last Login at <time> on <day>'
    let sourceDate = null;
    if (user.prevLogin) sourceDate = new Date(user.prevLogin);
    else if (user.lastLogin) sourceDate = new Date(user.lastLogin);
    else if (user.last_login) sourceDate = new Date(user.last_login);

    if (sourceDate && !isNaN(sourceDate.getTime())) {
      const now = new Date();
      const timePart = sourceDate.toLocaleTimeString(undefined, { hour12: false });
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      const isSameDay = sourceDate.getFullYear() === now.getFullYear() && sourceDate.getMonth() === now.getMonth() && sourceDate.getDate() === now.getDate();
      const isYesterday = sourceDate.getFullYear() === yesterday.getFullYear() && sourceDate.getMonth() === yesterday.getMonth() && sourceDate.getDate() === yesterday.getDate();

      let dayPart;
      if (isSameDay) dayPart = 'Today';
      else if (isYesterday) dayPart = 'Yesterday';
      else dayPart = sourceDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

      hoverLastLogin.textContent = `Last Login at ${timePart} on ${dayPart}`;
    } else {
      hoverLastLogin.textContent = 'Last Login: Never';
    }
  }

  // Update other profile elements
  if (profilePhone) {
    profilePhone.textContent = user.phone || 'Not provided';
  }

  if (profileJoinDate) {
    const joinDate = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();
    profileJoinDate.textContent = joinDate.toString();
  }
}

// Theme Toggle Setup
function setupThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeTooltipText = document.getElementById('themeTooltipText');

  if (themeToggleBtn && themeToggleIcon) {
    // Initialize icon and tooltip based on current theme
    const currentTheme = document.documentElement.getAttribute('data-theme');
    updateThemeIcon(currentTheme, themeToggleIcon, themeTooltipText);

    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      // Log activity
      if (typeof logUserActivity === 'function') {
        logUserActivity('theme_changed', `Theme switched to ${newTheme}`, `User changed theme from ${currentTheme} to ${newTheme}`);
      }

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      updateThemeIcon(newTheme, themeToggleIcon, themeTooltipText);
    });
  }
}

function updateThemeIcon(theme, iconElement, tooltipElement) {
  if (theme === 'dark') {
    iconElement.className = 'fas fa-sun text-sm';
    if (tooltipElement) tooltipElement.textContent = 'Click to switch to light theme';
  } else {
    iconElement.className = 'fas fa-moon text-sm';
    if (tooltipElement) tooltipElement.textContent = 'Click to switch to dark theme';
  }
}

// Modal Functions
function showProfileSettings() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('modal_opened', 'Opened profile settings', 'User accessed profile settings menu');
  }

  const modal = document.getElementById('profileSettingsModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideProfileSettings() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('modal_closed', 'Closed profile settings', 'User closed profile settings modal');
  }

  const modal = document.getElementById('profileSettingsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function showUpdatePasswordModal() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('modal_opened', 'Opened password change modal', 'User initiated password update');
  }

  const modal = document.getElementById('updatePasswordModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideUpdatePasswordModal() {
  const modal = document.getElementById('updatePasswordModal');
  if (modal) {
    modal.classList.add('hidden');
    // Clear form
    document.getElementById('updatePasswordForm').reset();
  }
}

function downloadActivity() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('download_attempted', 'Attempted activity download', 'User clicked to download activity report');
  }

  // Placeholder for download functionality
  alert('Download feature coming soon!');
}

// Setup Modal Forms
function setupModalForms() {
  // Profile update form removed from HTML; no client-side handler required here

  // Password Update Form
  const passwordForm = document.getElementById('updatePasswordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (newPassword !== confirmPassword) {
        alert('New passwords do not match!');
        return;
      }

      try {
        // Log activity
        if (typeof logUserActivity === 'function') {
          logUserActivity('password_changed', 'Password changed', 'User updated account password for security');
        }

        // Here you would make API call to update password
        console.log('Updating password');

        hideUpdatePasswordModal();
        alert('Password updated successfully!');
      } catch (error) {
        console.error('Password update error:', error);
        alert('Error updating password. Please try again.');
      }
    });
  }
}

// Permit Analytics Functions
function updatePermitAnalytics(stats, permits) {
  // Update analytics numbers
  const total = permits.length;
  const approved = stats.Approved || 0;
  const pending = stats.Pending || 0;

  const totalPermitsEl = document.getElementById('totalPermits');
  const approvedPermitsEl = document.getElementById('approvedPermits');
  const pendingPermitsEl = document.getElementById('pendingPermits');

  if (totalPermitsEl) totalPermitsEl.textContent = total;
  if (approvedPermitsEl) approvedPermitsEl.textContent = approved;
  if (pendingPermitsEl) pendingPermitsEl.textContent = pending;

  // Update approval time analytics
  updateApprovalTimeAnalytics(permits);

  // Load and update recent activity (including user actions)
  loadRecentActivity();
}

// Enhanced Activity Tracking System
async function loadRecentActivity() {
  try {
    // Get user session for current login tracking
    const user = await checkSession();
    if (!user) return;

    // Load various activity types
    const activities = await Promise.all([
      loadUserActivities(),
      loadPermitActivities(),
      loadSessionActivities()
    ]);

    // Combine and sort all activities by timestamp
    const allActivities = activities.flat().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Take only the most recent 10 activities
    const recentActivities = allActivities.slice(0, 10);

    updateRecentActivityDisplay(recentActivities);
  } catch (error) {
    console.error('Error loading recent activity:', error);
    const activityList = document.getElementById('recentActivityList');
    if (activityList) {
      activityList.innerHTML = `
        <div class="text-center py-8 text-[var(--text-primary)] opacity-60">
          <i class="fas fa-exclamation-triangle text-xl mb-2"></i>
          <p>Error loading activity</p>
        </div>
      `;
    }
  }
}

async function loadUserActivities() {
  const activities = [];

  // Add current session activity
  const loginTime = sessionStorage.getItem('loginTime') || localStorage.getItem('lastLoginTime');
  if (loginTime) {
    activities.push({
      type: 'login',
      title: 'Logged in to system',
      description: 'Started new session',
      timestamp: loginTime,
      icon: 'fas fa-sign-in-alt text-green-500',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    });
  }

  // Track profile page visit
  activities.push({
    type: 'page_visit',
    title: 'Viewed profile dashboard',
    description: 'Accessed profile analytics',
    timestamp: new Date().toISOString(),
    icon: 'fas fa-user text-blue-500',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  });

  return activities;
}

async function loadPermitActivities() {
  try {
    const res = await fetch(`${API_BASE}/api/permit`, { credentials: 'include' });
    if (!res.ok) return [];

    const permits = await res.json();
    const activities = [];

    permits.forEach(permit => {
      // Permit submission
      if (permit.submittedAt) {
        activities.push({
          type: 'permit_submitted',
          title: `Submitted permit: ${permit.permitTitle || 'Permit Request'}`,
          description: `Permit #${permit.permitNumber || 'Pending'}`,
          timestamp: permit.submittedAt,
          icon: 'fas fa-file-upload text-blue-500',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        });
      }

      // Status changes
      if (permit.status === 'Approved' && permit.approvedAt) {
        activities.push({
          type: 'permit_approved',
          title: `Permit approved: ${permit.permitTitle || 'Permit Request'}`,
          description: `Permit #${permit.permitNumber}`,
          timestamp: permit.approvedAt,
          icon: 'fas fa-check-circle text-green-500',
          color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
        });
      }

      if (permit.status === 'Rejected' && permit.rejectedAt) {
        activities.push({
          type: 'permit_rejected',
          title: `Permit rejected: ${permit.permitTitle || 'Permit Request'}`,
          description: `Permit #${permit.permitNumber} - ${permit.rejectionReason || 'No reason provided'}`,
          timestamp: permit.rejectedAt,
          icon: 'fas fa-times-circle text-red-500',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        });
      }
    });

    return activities;
  } catch (error) {
    console.error('Error loading permit activities:', error);
    return [];
  }
}

async function loadSessionActivities() {
  const activities = [];

  // Check for recent logout (from localStorage)
  const lastLogout = localStorage.getItem('lastLogoutTime');
  if (lastLogout) {
    const logoutDate = new Date(lastLogout);
    const now = new Date();
    const hoursSinceLogout = (now - logoutDate) / (1000 * 60 * 60);

    // Show logout if it was within the last 24 hours
    if (hoursSinceLogout < 24) {
      activities.push({
        type: 'logout',
        title: 'Logged out of system',
        description: 'Session ended',
        timestamp: lastLogout,
        icon: 'fas fa-sign-out-alt text-gray-500',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
      });
    }
  }

  return activities;
}

function updateRecentActivityDisplay(activities) {
  const activityList = document.getElementById('recentActivityList');
  if (!activityList) return;

  if (activities.length === 0) {
    activityList.innerHTML = `
      <div class="text-center py-8 text-[var(--text-primary)] opacity-60">
        <i class="fas fa-inbox text-2xl mb-2"></i>
        <p>No recent activity</p>
      </div>
    `;
    return;
  }

  activityList.innerHTML = activities.map(activity => {
    const timeAgo = getTimeAgo(new Date(activity.timestamp));

    return `
      <div class="flex items-start gap-3 p-3 bg-[var(--input-border)]/10 rounded-lg hover:bg-[var(--input-border)]/20 transition-colors duration-200">
        <div class="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 flex-shrink-0 mt-0.5">
          <i class="${activity.icon} text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-[var(--text-primary)] font-medium text-sm truncate">${activity.title}</h4>
          <p class="text-[var(--text-primary)] opacity-60 text-xs mt-1">${activity.description}</p>
          <p class="text-[var(--text-primary)] opacity-50 text-xs mt-1">${timeAgo}</p>
        </div>
        <div class="flex-shrink-0">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${activity.color}">
            ${activity.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Approval Time Analytics
function updateApprovalTimeAnalytics(permits) {
  const approvedPermits = permits.filter(p => p.status === 'Approved' && p.submittedAt && p.approvedAt);

  if (approvedPermits.length === 0) {
    updateApprovalMetrics('--', '--');
    createApprovalTimeChart([]);
    return;
  }

  // Calculate approval times in hours
  const approvalTimes = approvedPermits.map(permit => {
    const submitted = new Date(permit.submittedAt);
    const approved = new Date(permit.approvedAt);
    return Math.round((approved - submitted) / (1000 * 60 * 60)); // Convert to hours
  });

  // Calculate metrics
  const avgTime = Math.round(approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length);
  const fastestTime = Math.min(...approvalTimes);

  updateApprovalMetrics(
    avgTime < 24 ? `${avgTime}h` : `${Math.round(avgTime / 24)}d`,
    fastestTime < 24 ? `${fastestTime}h` : `${Math.round(fastestTime / 24)}d`
  );

  // Create trend chart
  createApprovalTimeChart(approvedPermits);
}

function updateApprovalMetrics(avgTime, fastestTime) {
  const avgEl = document.getElementById('avgApprovalTime');
  const fastestEl = document.getElementById('fastestApproval');

  if (avgEl) avgEl.textContent = avgTime;
  if (fastestEl) fastestEl.textContent = fastestTime;
}

function createApprovalTimeChart(approvedPermits) {
  console.log('createApprovalTimeChart called with permits:', approvedPermits);
  const ctx = document.getElementById('approvalTimeChart');
  console.log('Approval chart canvas element:', ctx);
  console.log('Chart.js available for approval chart:', !!window.Chart);

  if (!ctx) {
    console.warn('Cannot create approval chart - missing canvas element');
    return;
  }

  const initApprovalChart = () => {
    if (window.Chart) {
      console.log('Initializing approval time chart...');

      // Destroy existing chart using unified system
      destroyChart('approvalTime');      // Prepare data for last 30 days
      const last30Days = [];
      const today = new Date();

      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last30Days.push({
          date: date.toISOString().split('T')[0],
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          approvals: []
        });
      }

      // Map approvals to dates
      approvedPermits.forEach(permit => {
        const approvedDate = new Date(permit.approvedAt).toISOString().split('T')[0];
        const dayData = last30Days.find(d => d.date === approvedDate);
        if (dayData) {
          const submitted = new Date(permit.submittedAt);
          const approved = new Date(permit.approvedAt);
          const hours = Math.round((approved - submitted) / (1000 * 60 * 60));
          dayData.approvals.push(hours);
        }
      });

      // Calculate average for each day
      const chartData = last30Days.map(day => {
        if (day.approvals.length === 0) return null;
        return Math.round(day.approvals.reduce((a, b) => a + b, 0) / day.approvals.length);
      });

      window.chartInstances.approvalTime = new Chart(ctx, {
        type: 'line',
        data: {
          labels: last30Days.map(d => d.label),
          datasets: [{
            label: 'Avg Approval Time (hours)',
            data: chartData,
            borderColor: '#273172',
            backgroundColor: 'rgba(39, 49, 114, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#273172',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 0,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function (context) {
                  if (context.parsed.y === null) return 'No approvals';
                  return `Avg: ${context.parsed.y} hours`;
                }
              }
            }
          },
          onResize: function (chart, size) {
            chart.canvas.style.height = '120px';
            chart.canvas.style.maxHeight = '120px';
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 45 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.1)' },
              ticks: {
                callback: function (value) {
                  return value + 'h';
                }
              }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      });

      console.log('Approval time chart created successfully');
    } else {
      console.warn('Chart.js not available for approval chart, retrying in 100ms...');
      setTimeout(initApprovalChart, 100);
    }
  };

  initApprovalChart();
}

// Function to show all activities (for the "View All" button)
function showAllActivities() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('view_expanded', 'Viewed all activities', 'User clicked to view complete activity history');
  }

  // This could open a modal or navigate to a dedicated activities page
  alert('Full activity history feature coming soon!');
}

// Activity logging functions (for real-time tracking)
function logUserActivity(type, title, description) {
  const activity = {
    type,
    title,
    description,
    timestamp: new Date().toISOString(),
    userId: sessionStorage.getItem('userId')
  };

  // Store locally for immediate display
  let recentActivities = JSON.parse(localStorage.getItem('recentActivities') || '[]');
  recentActivities.unshift(activity);
  recentActivities = recentActivities.slice(0, 50); // Keep last 50 activities
  localStorage.setItem('recentActivities', JSON.stringify(recentActivities));

  // In a real app, this would also send to the backend
  console.log('Activity logged:', activity);

  // Refresh activity display
  loadRecentActivity();
}

// Set up activity tracking for user actions
function setupActivityTracking() {
  // Track login time
  if (!sessionStorage.getItem('loginTime')) {
    sessionStorage.setItem('loginTime', new Date().toISOString());
    logUserActivity('login', 'Logged in to system', 'Started new session');
  }

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logUserActivity('page_blur', 'Navigated away', 'Page lost focus');
    } else {
      logUserActivity('page_focus', 'Returned to page', 'Page regained focus');
    }
  });

  // Track logout
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('lastLogoutTime', new Date().toISOString());
  });
}

// Expand/Collapse Section Functionality
function toggleSection(sectionId) {
  const content = document.getElementById(`${sectionId}Content`);
  const icon = document.getElementById(`${sectionId}Icon`);

  if (content && icon) {
    const isCollapsed = content.classList.contains('hidden');

    if (isCollapsed) {
      content.classList.remove('hidden');
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');

      // Log activity
      if (typeof logUserActivity === 'function') {
        logUserActivity('section_expanded', `Expanded ${sectionId} section`, `User expanded ${sectionId} for better visibility`);
      }
    } else {
      content.classList.add('hidden');
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');

      // Log activity
      if (typeof logUserActivity === 'function') {
        logUserActivity('section_collapsed', `Collapsed ${sectionId} section`, `User collapsed ${sectionId} to save space`);
      }
    }
  }
}

// Submit New Request Function
function submitNewRequest() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('request_initiated', 'New request submission started', 'User clicked submit new request from tooltip');
  }

  // Redirect to permit form or show request form
  window.location.href = '../permitform/permitform.html';
}

// Toggle Theme in Tooltip
function toggleTooltipTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  const iconElement = document.getElementById('tooltipThemeIcon');

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  // Update icon
  if (iconElement) {
    if (newTheme === 'dark') {
      iconElement.className = 'fas fa-sun text-lg group-hover:scale-110 transition-transform';
    } else {
      iconElement.className = 'fas fa-moon text-lg group-hover:scale-110 transition-transform';
    }
  }

  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('theme_changed', `Theme switched to ${newTheme} via tooltip`, `User changed theme from ${currentTheme} to ${newTheme} using tooltip`);
  }
}

// Global chart instances to prevent duplicates
window.chartInstances = window.chartInstances || {};

// Unified Chart Management System
function destroyChart(chartId) {
  if (window.chartInstances[chartId]) {
    window.chartInstances[chartId].destroy();
    delete window.chartInstances[chartId];
    console.log(`Destroyed chart: ${chartId}`);
  }
}

function initializeProfileStatsChart(stats) {
  console.log('Initializing profile stats chart with data:', stats);
  const ctx = document.getElementById('profileStatsChart');

  if (!ctx) {
    console.error('Profile stats chart canvas not found');
    return;
  }

  // Destroy existing chart
  destroyChart('profileStats');

  if (!window.Chart) {
    console.warn('Chart.js not available');
    return;
  }

  const labels = Object.keys(stats);
  const data = labels.map(k => stats[k]);

  window.chartInstances.profileStats = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 0,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12 }
        },
        tooltip: { enabled: true }
      },
      cutout: '58%',
      animation: { duration: 500 },
      onResize: function (chart, size) {
        chart.canvas.style.height = '160px';
        chart.canvas.style.maxHeight = '160px';
      }
    }
  });

  console.log('Profile stats chart created successfully');
}

// Create Charts for Permit Statistics
function createPermitCharts() {
  console.log('Creating additional permit charts...');

  // Status Distribution Chart
  const statusCtx = document.getElementById('permitStatusChart');
  if (statusCtx) {
    destroyChart('statusChart');

    if (!window.Chart) return;

    window.chartInstances.statusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Approved', 'Pending', 'Rejected', 'In Review'],
        datasets: [{
          data: [12, 8, 3, 5],
          backgroundColor: [
            '#10b981', // green
            '#f59e0b', // yellow
            '#ef4444', // red
            '#3b82f6'  // blue
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              }
            }
          }
        }
      }
    });
  }

  // Monthly Trend Chart
  const trendCtx = document.getElementById('monthlyTrendChart');
  if (trendCtx) {
    destroyChart('trendChart');

    if (!window.Chart) return;

    window.chartInstances.trendChart = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Permits Submitted',
          data: [5, 8, 12, 9, 15, 18],
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f6',
          fill: false,
          tension: 0.4
        }, {
          label: 'Permits Approved',
          data: [4, 7, 10, 8, 13, 16],
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          fill: false,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 2
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }
}

// Notification System
let notifications = [
  {
    id: 1,
    title: 'Permit Approved',
    message: 'Your PTW request #12345 has been approved by the safety officer.',
    type: 'success',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
    read: false,
    details: {
      permitId: '12345',
      approvedBy: 'John Smith',
      approvalDate: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  },
  {
    id: 2,
    title: 'Document Required',
    message: 'Additional safety certificate required for permit #12344.',
    type: 'warning',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    read: false,
    details: {
      permitId: '12344',
      requiredDocument: 'Safety Certificate Level 2',
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  },
  {
    id: 3,
    title: 'System Maintenance',
    message: 'Scheduled maintenance tonight from 2:00 AM to 4:00 AM.',
    type: 'info',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    read: true,
    details: {
      maintenanceWindow: '2:00 AM - 4:00 AM',
      affectedServices: ['Permit Submission', 'Document Upload'],
      contact: 'IT Support: +974-1234-5678'
    }
  }
];

function loadNotifications() {
  const notificationList = document.getElementById('notificationList');
  if (!notificationList) return;

  // Sort notifications by timestamp (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  notificationList.innerHTML = '';

  if (sortedNotifications.length === 0) {
    notificationList.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i class="fas fa-bell-slash text-2xl mb-2"></i>
        <p class="text-sm">No notifications</p>
      </div>
    `;
    return;
  }

  sortedNotifications.forEach(notification => {
    const timeAgo = getTimeAgo(new Date(notification.timestamp));
    const typeIcon = getNotificationIcon(notification.type);
    const typeColor = getNotificationColor(notification.type);

    const notificationEl = document.createElement('div');
    notificationEl.className = `p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${notification.read ? 'opacity-60' : ''}`;
    notificationEl.onclick = () => showNotificationDetails(notification.id);

    notificationEl.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full ${typeColor} flex items-center justify-center flex-shrink-0 mt-0.5">
          <i class="${typeIcon} text-white text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <h5 class="text-gray-800 font-semibold text-sm truncate">${notification.title}</h5>
            ${!notification.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>' : ''}
          </div>
          <p class="text-gray-600 text-xs line-clamp-2 mb-1">${notification.message}</p>
          <p class="text-gray-400 text-xs">${timeAgo}</p>
        </div>
      </div>
    `;

    notificationList.appendChild(notificationEl);
  });

  // Update notification count
  updateNotificationCount();
}

function getNotificationIcon(type) {
  switch (type) {
    case 'success': return 'fas fa-check';
    case 'warning': return 'fas fa-exclamation-triangle';
    case 'error': return 'fas fa-times';
    case 'info': return 'fas fa-info';
    default: return 'fas fa-bell';
  }
}

function getNotificationColor(type) {
  switch (type) {
    case 'success': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'error': return 'bg-red-500';
    case 'info': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

function getTimeAgo(date) {
  // Ensure we have a valid Date object
  const dateObj = (date instanceof Date) ? date : new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date passed to getTimeAgo:', date);
    return 'Unknown time';
  }

  const now = new Date();
  const diffMs = now - dateObj;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return dateObj.toLocaleDateString();
}

function showNotificationDetails(notificationId) {
  const notification = notifications.find(n => n.id === notificationId);
  if (!notification) return;

  // Mark as read
  notification.read = true;
  updateNotificationCount();
  loadNotifications();

  // Create modal for notification details
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4';
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };

  const typeColor = getNotificationColor(notification.type);
  const typeIcon = getNotificationIcon(notification.type);

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] overflow-y-auto">
      <div class="bg-gradient-to-r from-hia-blue/10 to-hia-light-blue/10 px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${typeColor} flex items-center justify-center">
              <i class="${typeIcon} text-white"></i>
            </div>
            <h3 class="text-gray-800 font-bold text-lg">${notification.title}</h3>
          </div>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      <div class="p-6">
        <p class="text-gray-700 mb-4">${notification.message}</p>
        
        <div class="text-sm text-gray-500 mb-4">
          <i class="fas fa-clock mr-1"></i>
          ${new Date(notification.timestamp).toLocaleString()}
        </div>

        ${notification.details ? `
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Details</h4>
            ${Object.entries(notification.details).map(([key, value]) => `
              <div class="flex justify-between py-1">
                <span class="text-gray-600 capitalize">${key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span class="text-gray-800 font-medium">${typeof value === 'string' && value.includes('T') ? new Date(value).toLocaleString() : value}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="border-t border-gray-200 px-6 py-4">
        <button onclick="this.closest('.fixed').remove()" 
                class="w-full px-4 py-2 bg-hia-blue hover:bg-hia-light-blue text-white rounded-lg font-medium transition-colors">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('notification_viewed', `Viewed notification: ${notification.title}`, `User opened notification details for ${notification.title}`);
  }
}

function markAllAsRead() {
  notifications.forEach(n => n.read = true);
  updateNotificationCount();
  loadNotifications();

  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('notifications_marked_read', 'Marked all notifications as read', 'User marked all notifications as read');
  }
}

function showAllNotifications() {
  // Log activity
  if (typeof logUserActivity === 'function') {
    logUserActivity('all_notifications_viewed', 'Viewed all notifications', 'User requested to view all notifications');
  }

  alert('Full notifications page feature coming soon!');
}

function updateNotificationCount() {
  console.log('updateNotificationCount called');
  const countEl = document.getElementById('notificationCount');
  console.log('Notification count element:', countEl);
  if (!countEl) {
    console.warn('Notification count element not found');
    return;
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  console.log('Unread notifications count:', unreadCount);
  console.log('Total notifications:', notifications.length);

  if (unreadCount > 0) {
    countEl.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
    countEl.classList.remove('hidden');
    console.log('Showing notification count:', countEl.textContent);
  } else {
    countEl.classList.add('hidden');
    console.log('Hiding notification count (no unread)');
  }
}

// Reset dropdown states function for debugging
function resetDropdownStates() {
  console.log('Resetting all dropdown states...');
  const profileDropdown = document.getElementById('profileDropdown');
  const notificationDropdown = document.getElementById('notificationDropdown');

  if (profileDropdown) {
    profileDropdown.classList.add('hidden');
    profileDropdown.style.display = 'none';
    profileDropdown.style.opacity = '0';
    profileDropdown.style.transform = 'translateY(4px)';
  }

  if (notificationDropdown) {
    notificationDropdown.classList.add('hidden');
    notificationDropdown.style.display = 'none';
    notificationDropdown.style.opacity = '0';
    notificationDropdown.style.transform = 'translateY(4px)';
  }

  console.log('Dropdown states reset');
}

// Add keyboard shortcut to reset dropdowns (Ctrl+Shift+R)
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    resetDropdownStates();
  }
});

// ========== GLOBAL FUNCTION EXPORTS ==========
window.toggleProfileDropdown = toggleProfileDropdown;
window.toggleNotifications = toggleNotifications;
window.setupDropdownCloseHandlers = setupDropdownCloseHandlers;
window.showProfileSettings = showProfileSettings;
window.hideProfileSettings = hideProfileSettings;
window.showUpdatePasswordModal = showUpdatePasswordModal;
window.hideUpdatePasswordModal = hideUpdatePasswordModal;
window.downloadActivity = downloadActivity;
window.showAllActivities = showAllActivities;
window.logUserActivity = logUserActivity;
window.toggleSection = toggleSection;
window.submitNewRequest = submitNewRequest;
window.toggleTooltipTheme = toggleTooltipTheme;
window.markAllAsRead = markAllAsRead;
window.showAllNotifications = showAllNotifications;
window.resetDropdownStates = resetDropdownStates;
window.testDropdowns = testDropdowns;
// Ensure logoutUser is available globally for inline onclick handlers
try {
  if (typeof logoutUser === 'function') {
    window.logoutUser = logoutUser;
  }
} catch (e) {
  console.warn('logoutUser not available to expose on window yet', e);
}

// Attach a safe click handler to the Sign Out button in case inline onclick is unreliable
setTimeout(() => {
  const logoutBtn = document.getElementById('hoverLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      try {
        if (typeof window.logoutUser === 'function') {
          window.logoutUser();
        } else if (typeof logoutUser === 'function') {
          logoutUser();
        } else {
          console.error('Logout function not found');
        }
      } catch (err) {
        console.error('Error calling logoutUser:', err);
      }
    });
  }
}, 100);
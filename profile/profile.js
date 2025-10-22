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

  // ========== CENTRAL EVENT DELEGATION FOR [data-action] ========== 
  document.addEventListener('click', function (e) {
    let el = e.target;
    // Traverse up to find [data-action] (in case of icon inside button, etc)
    while (el && el !== document) {
      if (el.dataset && el.dataset.action) {
        // Support multiple actions in data-action (space/comma separated)
        const actions = el.dataset.action.split(/[ ,]+/);
        const section = el.dataset.section;
        const actionMap = {
          'toggleSection': (sectionId) => toggleSection(sectionId),
          'toggle-section': (sectionId) => toggleSection(sectionId),
          'submitNewRequest': () => submitNewRequest(),
          'submit-new-request': () => submitNewRequest(),
          'downloadActivity': () => downloadActivity(),
          'download-activity': () => downloadActivity(),
          'showUpdatePasswordModal': () => showUpdatePasswordModal(),
          'show-update-password-modal': () => showUpdatePasswordModal(),
          'logoutUser': () => logoutUser(),
          'logout-user': () => logoutUser(),
          'markAllAsRead': () => markAllAsRead(),
          'mark-all-as-read': () => markAllAsRead(),
          'showAllNotifications': () => showAllNotifications(),
          'show-all-notifications': () => showAllNotifications(),
          'hideProfileSettings': () => hideProfileSettings(),
          'hide-profile-settings': () => hideProfileSettings(),
          'showProfileSettings': () => showProfileSettings(),
          'show-profile-settings': () => showProfileSettings(),
          'toggleTheme': () => setupThemeToggle && setupThemeToggle(),
          'toggle-theme': () => setupThemeToggle && setupThemeToggle(),
        };
        let handled = false;
        for (const action of actions) {
          if (actionMap[action]) {
            e.preventDefault();
            e.stopPropagation();
            if (action === 'toggleSection' || action === 'toggle-section') {
              actionMap[action](section);
            } else {
              actionMap[action]();
            }
            handled = true;
          }
        }
        if (handled) break;
      }
      el = el.parentElement;
    }
  });
  // Ensure all toggle sections start collapsed visually (icons reset)
  try {
    const toggleIcons = ['permitAnalyticsIcon', 'approvalAnalyticsIcon', 'permitStatisticsIcon'];
    toggleIcons.forEach(id => {
      const ic = document.getElementById(id);
      if (ic) {
        ic.style.transform = 'rotate(0deg)';
        // slightly longer, smoother transition for chevrons
        ic.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
        // ensure it shows chevron-down class if FontAwesome variants used
        ic.classList.remove('fa-chevron-up');
        ic.classList.add('fa-chevron-down');
      }
    });
  } catch (e) {
    console.warn('Error initializing toggle icons', e);
  }

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

  // Attach safe handlers for inline-onclick buttons (module scope can make inline handlers fail)
  function attachInlineHandlers() {
    // mapping: attribute substring -> function to call
    const map = {
      'submitNewRequest': submitNewRequest,
      'downloadActivity': downloadActivity,
      'toggleSection': toggleSection,
      'showUpdatePasswordModal': showUpdatePasswordModal,
      'logoutUser': logoutUser,
      'markAllAsRead': markAllAsRead,
      'showAllNotifications': showAllNotifications,
      'hideProfileSettings': hideProfileSettings
    };

    Object.keys(map).forEach(key => {
      try {
        const els = document.querySelectorAll(`[onclick*="${key}"]`);
        els.forEach(el => {
          // avoid double-binding
          if (!el.dataset.boundInline) {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              try { map[key](); } catch (err) { console.error('inline handler error', key, err); }
            });
            el.dataset.boundInline = '1';
          }
        });
      } catch (err) {
        console.warn('attachInlineHandlers error for', key, err);
      }
    });
  }

  attachInlineHandlers();

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

  // Header display name moved into dropdown; ensure main header element is not modified here
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
        const data = await res.json();
        // support both array responses and { permits } envelope
        const list = Array.isArray(data) ? data : (data.permits || []);
        const tbody = document.querySelector('#permitTable tbody');
        tbody.innerHTML = '';

        // determine current user id from session user object
        const currentUserId = user && (user._id || user.id || user.userId || user._id) || sessionStorage.getItem('userId');

        // filter permits to only those submitted by current user
        const userPermits = list.filter(p => {
          if (!p) return false;
          // check common requester shapes: object or id
          if (p.requester) {
            if (typeof p.requester === 'object') {
              const rid = p.requester._id || p.requester.id || p.requester;
              return String(rid) === String(currentUserId);
            }
            return String(p.requester) === String(currentUserId);
          }
          if (p.requesterId) return String(p.requesterId) === String(currentUserId);
          if (p.owner) return String(p.owner) === String(currentUserId);
          return false;
        });

        let stats = { Approved: 0, Pending: 0, Rejected: 0 };
        userPermits.forEach((permit, index) => {
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

        // Initialize or register profile stats chart data
        try {
          const statsHandler = () => initializeProfileStatsChart(stats);
          // If the permitStatistics section is already visible, initialize immediately
          const permStatsContent = document.getElementById('permitStatisticsContent');
          if (permStatsContent && !permStatsContent.classList.contains('hidden')) {
            statsHandler();
            lazyInitCalled.add('permitStatistics');
          } else {
            // register lazy init so it will run when the section is expanded
            lazyInitMap['permitStatistics'] = statsHandler;
          }

          // Update permit analytics with filtered permits
          updatePermitAnalytics(stats, userPermits);
        } catch (e) {
          console.warn('Error registering/initializing profile stats chart', e);
        }

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
        credentials: 'include',
        headers: { Accept: 'application/pdf' }
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const err = await res.json();
          alert(err.message || 'Server error while generating PDF');
          return;
        }
        throw new Error('Server returned ' + res.status);
      }

      if (contentType.includes('application/json')) {
        const err = await res.json();
        alert(err.message || 'Unable to download PDF');
        return;
      }

      const blob = await res.blob();

      // derive filename from Content-Disposition if present
      let filename = `${permitNumber || permitId}.pdf`;
      const cd = res.headers.get('content-disposition');
      if (cd) {
        const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        if (m) filename = decodeURIComponent(m[1] || m[2]);
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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
      // navigation to permitform

      window.location.href = '../permitform/permitform.html';
    });
  }

  // ===== Logout button =====
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // logout

      logoutUser();
    });
  }

  // Enhanced Profile Display Updates (optional helper defined in permitform.js)
  if (typeof updateEnhancedProfileDisplay === 'function') {
    try {
      updateEnhancedProfileDisplay(user);
    } catch (e) {
      console.warn('updateEnhancedProfileDisplay threw an error:', e);
    }
  }

  // Theme Toggle Handler
  setupThemeToggle();

  // Activity tracking removed from profile page (handled on admin/permitform pages)

  // Modal Form Handlers
  setupModalForms();

  // Initialize charts
  createPermitCharts();



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

        // theme changed

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
    const modal = document.getElementById('profileSettingsModal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function hideProfileSettings() {
    const modal = document.getElementById('profileSettingsModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function showUpdatePasswordModal() {
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
    // Placeholder UI action — admin will implement server-side export
    alert('Download feature coming soon!');
  }
  // Setup Modal Forms
  function setupModalForms() {
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
          // password changed (no activity logging on profile page)

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
  }

  // Recent activity UI and rendering removed from profile.js per request

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

  // Activity logging removed from profile.js (moved to admin/permitform)

  // Expand/Collapse Section Functionality
  function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}Content`);
    const icon = document.getElementById(`${sectionId}Icon`);

    if (content && icon) {
      const isCollapsed = content.classList.contains('hidden');

      // Animate chevron rotation
      icon.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
      if (isCollapsed) {
        content.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        icon.style.transform = 'rotate(180deg)';

        // run lazy init for this section if present and not yet called
        try {
          if (lazyInitMap[sectionId] && !lazyInitCalled.has(sectionId)) {
            lazyInitMap[sectionId]();
            lazyInitCalled.add(sectionId);
          }
        } catch (err) {
          console.warn('Lazy init for', sectionId, 'failed', err);
        }

      } else {
        content.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        icon.style.transform = 'rotate(0deg)';
      }
    }
  }

  // Submit New Request Function
  function submitNewRequest() {
    // request initiated

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

    // theme switched via tooltip
  }

  // Global chart instances to prevent duplicates
  window.chartInstances = window.chartInstances || {};

  // Lazy init registry: map a sectionId to a function that initializes charts/content when opened
  const lazyInitMap = {
    'permitAnalytics': () => createPermitCharts(),
    'permitStatistics': () => {
      // profile stats chart is initialized when permit data is loaded; placeholder
    },
    'approvalAnalytics': () => {
      // approval time chart initializes when permits data arrives; placeholder
    }
  };

  // Track which lazy inits have already run
  const lazyInitCalled = new Set();

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

    // notification viewed (no activity logging)
  }

  function markAllAsRead() {
    notifications.forEach(n => n.read = true);
    updateNotificationCount();
    loadNotifications();

    // notifications marked read
  }

  function showAllNotifications() {
    // all notifications viewed

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
  window.toggleSection = toggleSection;
  window.submitNewRequest = submitNewRequest;
  window.toggleTooltipTheme = toggleTooltipTheme;
  window.markAllAsRead = markAllAsRead;
  window.showAllNotifications = showAllNotifications;
  window.resetDropdownStates = resetDropdownStates;
  window.testDropdowns = testDropdowns;
  window.downloadActivity = downloadActivity;
  // expose some helpers used by inline onclicks
  window.logoutUser = (typeof logoutUser === 'function') ? logoutUser : window.logoutUser;
  window.showProfileSettings = (typeof showProfileSettings === 'function') ? showProfileSettings : window.showProfileSettings;
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

});
import { checkSession, initIdleTimer, logoutUser } from "../session.js";
import { formatDate24, formatLastLogin } from "../date-utils.js";
import { API_BASE } from '../config.js';

document.addEventListener('DOMContentLoaded', async function () {

  // Keep the latest data in memory for charts/toggles
  let latestUserPermits = [];
  let latestStats = { Approved: 0, Pending: 0, Rejected: 0 };

  // Global chart instances to prevent duplicates
  window.chartInstances = window.chartInstances || {};

  // Track which lazy inits have already run
  const lazyInitCalled = new Set();

  // Lazy init registry: map a sectionId to a function that initializes charts/content when opened
  const lazyInitMap = {
    'permitAnalytics': () => createPermitCharts(),
    'approvalAnalytics': () => {
      // approval time chart initializes when permits data arrives; placeholder
    }
  };

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
          'hideProfileSettings': () => hideProfileSettings(),
          'hide-profile-settings': () => hideProfileSettings(),
          'showProfileSettings': () => showProfileSettings(),
          'show-profile-settings': () => showProfileSettings(),
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
  // Ensure toggle icons reflect current expanded/collapsed state
  try {
    const toggleTargets = [
      { iconId: 'submittedPermitsIcon', contentId: 'submittedPermitsContent' },
      { iconId: 'approvalTrendIcon', contentId: 'approvalTrendContent' },
      { iconId: 'fastestTrendIcon', contentId: 'fastestTrendContent' }
    ];

    toggleTargets.forEach(({ iconId, contentId }) => {
      const icon = document.getElementById(iconId);
      if (!icon) return;

      const content = contentId ? document.getElementById(contentId) : null;
      const isExpanded = content ? !content.classList.contains('hidden') : false;

      icon.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
      icon.classList.toggle('fa-chevron-up', isExpanded);
      icon.classList.toggle('fa-chevron-down', !isExpanded);
      icon.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  } catch (e) {
    console.warn('Error initializing toggle icons', e);
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
        console.log('API Response:', data); // Debug log
        // support both array responses and { permits } envelope
        const list = Array.isArray(data) ? data : (data.permits || []);
        console.log('Permits list:', list); // Debug log
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

        console.log('User permits:', userPermits); // Debug log

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
          // Fix the title column width so the text stays on one line with ellipsis
          titleTd.className = 'w-[320px] md:w-[420px] lg:w-[520px]';
          const titleText = permit.permitTitle || '—';
          const titleWrap = document.createElement('span');
          // Truncate to a single line inside the fixed-width cell
          titleWrap.className = 'truncate block w-full';
          titleWrap.textContent = titleText;
          titleWrap.title = titleText;
          titleTd.appendChild(titleWrap);

          // Requester name (from populated requester or fields on permit)
          const requesterTd = document.createElement('td');
          const requesterName = (permit.requester && (permit.requester.fullName || permit.requester.username))
            || [permit.fullName, permit.lastName].filter(Boolean).join(' ') || '—';
          requesterTd.textContent = requesterName;

          // Status with badge
          const statusTd = document.createElement('td');
          const badge = document.createElement('span');
          const statusValue = permit.status || 'Pending';
          badge.textContent = statusValue;
          // Sanitize status for CSS class: replace spaces with hyphens and lowercase
          const statusClass = statusValue.toLowerCase().replace(/\s+/g, '-');
          badge.classList.add('status-badge', statusClass);
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
          } else if (permit.status === 'Rejected') {
            // Show rejection message with reason
            const rejectionReason = permit.approverComments || permit.preApproverComments || 'incomplete or incorrect information';
            const msg = document.createElement('span');
            msg.style.color = '#ef4444';
            msg.style.fontSize = '0.875rem';
            msg.style.fontStyle = 'italic';
            msg.textContent = `Request rejected: ${rejectionReason}. Please submit a new request with correct details.`;
            numberTd.appendChild(msg);
          } else {
            // For Pending, In Progress, or any other status - show em dash
            numberTd.textContent = '—';
          }

          // Approvals data
          const preApproverTd = document.createElement('td');
          preApproverTd.textContent = (permit.preApprovedBy && (permit.preApprovedBy.fullName || permit.preApprovedBy.username)) || '—';

          const preApproveTimeTd = document.createElement('td');
          preApproveTimeTd.textContent = permit.preApprovedAt ? formatDate24(permit.preApprovedAt) : '—';

          const approverTd = document.createElement('td');
          approverTd.textContent = (permit.approvedBy && (permit.approvedBy.fullName || permit.approvedBy.username)) || '—';

          const approveTimeTd = document.createElement('td');
          approveTimeTd.textContent = permit.approvedAt ? formatDate24(permit.approvedAt) : '—';

          const preApproverCommentTd = document.createElement('td');
          preApproverCommentTd.textContent = permit.preApproverComments || '—';

          const approverCommentTd = document.createElement('td');
          approverCommentTd.textContent = permit.approverComments || '—';

          row.appendChild(serialTd);                 // Serial Number
          row.appendChild(submittedTd);              // Submitted On
          row.appendChild(requesterTd);              // Name
          row.appendChild(titleTd);                  // Permit Title
          row.appendChild(preApproverTd);            // Pre Approver Name
          row.appendChild(preApproveTimeTd);         // Pre Approved On
          row.appendChild(preApproverCommentTd);     // Comments (Pre-Approver)
          row.appendChild(approverTd);               // Approver Name
          row.appendChild(approveTimeTd);            // Approved On
          row.appendChild(approverCommentTd);        // Comments (Approver)
          row.appendChild(statusTd);                 // Status
          row.appendChild(numberTd);                 // Permit Number

          tbody.appendChild(row);

          // accumulate stats by status (case-insensitive)
          const st = (permit.status || 'Pending');
          if (stats[st] === undefined) stats[st] = 0;
          stats[st]++;
        });

        // Save latest data for live charts
        latestUserPermits = userPermits;
        latestStats = stats;

        // Update permit analytics with filtered permits
        updatePermitAnalytics(stats, userPermits);
        // Build permit analytics charts (status distribution, monthly trends)
        createPermitCharts();

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

  /* ===== Open shared permit modal (no redirect) ===== */
  function openPermitModal() {
    try {
      const trigger = document.querySelector('[data-action="submit-new-request"]');
      if (trigger) {
        trigger.click();
        return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  }

  const submitPtw = document.getElementById('sbmtptw');
  if (submitPtw) {
    submitPtw.addEventListener('click', function (e) {
      e.preventDefault();
      // Use shared layout modal instead of navigation
      openPermitModal();
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

  // Activity tracking removed from profile page (handled on admin/permitform pages)

  // Modal Form Handlers
  setupModalForms();

  // Initialize charts
  createPermitCharts();

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
    // Delegate to shared layout's global opener
    if (window.openUpdatePasswordModal) {
      window.openUpdatePasswordModal();
    } else {
      // fallback: try to click any shared trigger if present
      const t = document.querySelector('[data-update-password-trigger]');
      if (t) t.click();
    }
  }

  function hideUpdatePasswordModal() {
    // Close the shared modal if open
    const m = document.getElementById('update-password-modal');
    if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
  }

  function downloadActivity() {
    // Placeholder UI action — admin will implement server-side export
    alert('Download feature coming soon!');
  }
  // Setup Modal Forms
  function setupModalForms() {
    // Password update logic moved to shared layout; no per-page wiring needed here
  }

  // Permit Analytics Functions
  function updatePermitAnalytics(stats, permits) {
    // Update analytics numbers
    const total = permits.length;
    const approved = stats.Approved || 0;
    const pending = stats.Pending || 0;
    // Try common variants for in-progress status
    const inProgress = (
      stats['In Progress'] || stats['In progress'] || stats['in progress'] ||
      stats.InProgress || stats['In Review'] || stats['In review'] || stats['in review'] || 0
    );
    const rejected = stats.Rejected || 0;

    const totalPermitsEl = document.getElementById('totalPermits');
    const approvedPermitsEl = document.getElementById('approvedPermits');
    const pendingPermitsEl = document.getElementById('pendingPermits');
    const inProgressPermitsEl = document.getElementById('inProgressPermits');
    const rejectedPermitsEl = document.getElementById('rejectedPermits');

    if (totalPermitsEl) totalPermitsEl.textContent = total;
    if (approvedPermitsEl) approvedPermitsEl.textContent = approved;
    if (pendingPermitsEl) pendingPermitsEl.textContent = pending;
    if (inProgressPermitsEl) inProgressPermitsEl.textContent = inProgress;
    if (rejectedPermitsEl) rejectedPermitsEl.textContent = rejected;

    // Update approval time analytics
    updateApprovalTimeAnalytics(permits);
  }

  // Recent activity UI and rendering removed from profile.js per request

  // Approval Time Analytics
  function updateApprovalTimeAnalytics(permits) {
    // Use createdAt as a fallback for submittedAt when computing durations
    const approvedPermits = permits.filter(p => p && p.status === 'Approved' && p.approvedAt && (p.submittedAt || p.createdAt));

    if (approvedPermits.length === 0) {
      updateApprovalMetrics('--', '--');
      createApprovalTimeChart([]);
      return;
    }

    // Calculate approval times in hours
    const approvalTimes = approvedPermits.map(permit => {
      const submitted = new Date(permit.submittedAt || permit.createdAt);
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
    const averageCtx = document.getElementById('approvalTimeChart');
    const fastestCtx = document.getElementById('fastestApprovalChart');

    if (!averageCtx && !fastestCtx) {
      console.warn('Cannot create approval charts - missing canvas elements');
      return;
    }

    const showNoDataMessage = (canvas, message) => {
      if (!canvas || !canvas.parentElement) return;
      let note = canvas.parentElement.querySelector('[data-no-data-message]');
      if (!note) {
        note = document.createElement('p');
        note.dataset.noDataMessage = 'true';
        note.className = 'text-sm text-center text-gray-500 py-6';
        canvas.parentElement.appendChild(note);
      }
      note.textContent = message;
      note.classList.remove('hidden');
      canvas.classList.add('hidden');
    };

    const hideNoDataMessage = (canvas) => {
      if (!canvas || !canvas.parentElement) return;
      const note = canvas.parentElement.querySelector('[data-no-data-message]');
      if (note) {
        note.classList.add('hidden');
      }
      canvas.classList.remove('hidden');
    };

    const updateTrendLabel = (labelId, baseText, days) => {
      const labelEl = document.getElementById(labelId);
      if (!labelEl) return;
      const safeDays = Math.max(1, days);
      labelEl.textContent = `${baseText} (Last ${safeDays} Day${safeDays === 1 ? '' : 's'})`;
    };

    const DEFAULT_DAYS = 7;
    const MAX_DAYS = 30;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const today = new Date();

    const ensureChartsReady = () => {
      if (!window.Chart) {
        console.warn('Chart.js not available for approval charts, retrying in 100ms...');
        setTimeout(ensureChartsReady, 100);
        return;
      }

      if (!Array.isArray(approvedPermits)) approvedPermits = [];

      const buildTimelineData = (days) => {
        const timeline = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          timeline.push({
            iso: date.toISOString().split('T')[0],
            label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            approvals: []
          });
        }

        approvedPermits.forEach(permit => {
          if (!permit.approvedAt || !permit.submittedAt) return;
          const approvedDate = new Date(permit.approvedAt);
          if (Number.isNaN(approvedDate.getTime())) return;
          const approvedIso = approvedDate.toISOString().split('T')[0];
          const entry = timeline.find(day => day.iso === approvedIso);
          if (!entry) return;
          const submittedDate = new Date(permit.submittedAt);
          if (Number.isNaN(submittedDate.getTime())) return;
          const hours = Math.round((approvedDate - submittedDate) / (1000 * 60 * 60));
          entry.approvals.push(hours);
        });

        const averageData = timeline.map(day => {
          if (!day.approvals.length) return null;
          const sum = day.approvals.reduce((acc, hours) => acc + hours, 0);
          return Math.round(sum / day.approvals.length);
        });

        const fastestData = timeline.map(day => {
          if (!day.approvals.length) return null;
          return Math.min(...day.approvals);
        });

        const hasAverageData = averageData.some(value => value !== null);
        const hasFastestData = fastestData.some(value => value !== null);

        return { timeline, averageData, fastestData, hasAverageData, hasFastestData };
      };

      destroyChart('approvalTime');
      destroyChart('fastestApproval');

      let windowDays = DEFAULT_DAYS;
      let dataBundle = buildTimelineData(windowDays);

      if (approvedPermits.length > 0 && dataBundle && !dataBundle.hasAverageData && !dataBundle.hasFastestData) {
        const earliestApproved = approvedPermits.reduce((earliest, permit) => {
          if (!permit.approvedAt) return earliest;
          const approvedDate = new Date(permit.approvedAt);
          if (Number.isNaN(approvedDate.getTime())) return earliest;
          if (!earliest || approvedDate < earliest) return approvedDate;
          return earliest;
        }, null);

        if (earliestApproved) {
          const diffDays = Math.floor((today - earliestApproved) / MS_PER_DAY) + 1;
          const expandedWindow = Math.min(MAX_DAYS, Math.max(windowDays, diffDays));
          if (expandedWindow > windowDays) {
            windowDays = expandedWindow;
            dataBundle = buildTimelineData(windowDays);
          }
        }
      }

      if (!dataBundle) {
        console.warn('Unable to compute approval time data');
        return;
      }

      const { timeline, averageData, fastestData, hasAverageData, hasFastestData } = dataBundle;

      updateTrendLabel('approvalTrendLabel', 'Approval Time Trend', windowDays);
      updateTrendLabel('fastestTrendLabel', 'Fastest Approval Time Trend', windowDays);

      const commonOptions = (tooltipFormatter) => ({
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
                return tooltipFormatter(context.parsed.y);
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        onResize: function (chart) {
          chart.canvas.style.height = '100%';
          chart.canvas.style.maxHeight = '100%';
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
                return `${value}h`;
              }
            }
          }
        }
      });

      if (averageCtx) {
        if (!hasAverageData) {
          showNoDataMessage(averageCtx, 'No approvals recorded in this period.');
        } else {
          hideNoDataMessage(averageCtx);
          window.chartInstances.approvalTime = new Chart(averageCtx, {
            type: 'line',
            data: {
              labels: timeline.map(day => day.label),
              datasets: [{
                label: 'Avg Approval Time (hours)',
                data: averageData,
                borderColor: '#273172',
                backgroundColor: 'rgba(39, 49, 114, 0.12)',
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
            options: commonOptions(value => `Avg: ${value} hours`)
          });
        }
      }

      if (fastestCtx) {
        if (!hasFastestData) {
          showNoDataMessage(fastestCtx, 'No approvals recorded in this period.');
        } else {
          hideNoDataMessage(fastestCtx);
          window.chartInstances.fastestApproval = new Chart(fastestCtx, {
            type: 'line',
            data: {
              labels: timeline.map(day => day.label),
              datasets: [{
                label: 'Fastest Approval Time (hours)',
                data: fastestData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0f766e',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
              }]
            },
            options: commonOptions(value => `Fastest: ${value} hours`)
          });
        }
      }

      console.log('Approval time charts created successfully');
    };

    ensureChartsReady();
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
          if (typeof lazyInitMap !== 'undefined' && lazyInitMap[sectionId] && typeof lazyInitCalled !== 'undefined' && !lazyInitCalled.has(sectionId)) {
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
  function submitNewRequest(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // Use shared layout modal instead of redirecting
    if (!openPermitModal()) {
      console.warn('Permit modal trigger not found in shared layout.');
    }
  }

  // Unified Chart Management System
  function destroyChart(chartId) {
    if (!window.chartInstances) {
      window.chartInstances = {};
      return;
    }
    if (window.chartInstances[chartId]) {
      window.chartInstances[chartId].destroy();
      delete window.chartInstances[chartId];
      console.log(`Destroyed chart: ${chartId}`);
    }
  }

  // Create Charts for Permit Statistics
  function createPermitCharts() {
    console.log('Creating permit analytics charts from live data...');

    const statusCtx = document.getElementById('permitStatusChart');
    const trendCtx = document.getElementById('monthlyTrendChart');

    // Status Distribution (live)
    if (statusCtx) {
      destroyChart('statusChart');
      if (!window.Chart) return;

      // Count statuses from latestUserPermits (normalize)
      // Initialize with common statuses to ensure they always appear
      const statusCounts = {
        'Pending': 0,
        'In Progress': 0,
        'Approved': 0,
        'Rejected': 0
      };

      (latestUserPermits || []).forEach(p => {
        const s = (p && p.status) ? String(p.status) : 'Pending';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      // Filter out statuses with 0 count (optional: remove this filter to always show all statuses)
      const labels = Object.keys(statusCounts).filter(key => statusCounts[key] > 0);
      const data = labels.map(l => statusCounts[l]);

      // Color mapping with sensible defaults
      const colorMap = {
        'Approved': '#10b981',
        'Pending': '#f59e0b',
        'Rejected': '#ef4444',
        'In Review': '#3b82f6',
        'In Progress': '#0ea5e9'
      };
      const palette = ['#06b6d4', '#8b5cf6', '#f43f5e', '#22c55e', '#eab308', '#3b82f6', '#f97316'];
      const bgColors = labels.map((l, i) => colorMap[l] || palette[i % palette.length]);

      window.chartInstances.statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#ffffff' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 1,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 15, usePointStyle: true, font: { size: 12 } }
            },
            tooltip: { enabled: true }
          },
          animation: { duration: 400 },
          layout: {
            padding: 0
          }
        }
      });
    }

    // Monthly Trends (live: submitted vs approved vs rejected counts per recent months)
    if (trendCtx) {
      destroyChart('trendChart');
      if (!window.Chart) return;

      const monthsBack = 6; // show last 6 months including current
      const now = new Date();
      const monthKeys = [];
      const labels = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(key);
        labels.push(d.toLocaleString(undefined, { month: 'short' }));
      }

      const submittedCounts = monthKeys.map(() => 0);
      const approvedCounts = monthKeys.map(() => 0);
      const rejectedCounts = monthKeys.map(() => 0);

      (latestUserPermits || []).forEach(p => {
        if (!p) return;
        // Submitted by createdAt
        if (p.createdAt) {
          const dc = new Date(p.createdAt);
          if (!isNaN(dc)) {
            const key = `${dc.getFullYear()}-${String(dc.getMonth() + 1).padStart(2, '0')}`;
            const idx = monthKeys.indexOf(key);
            if (idx !== -1) submittedCounts[idx] += 1;
          }
        }
        // Approved by approvedAt
        if (p.status === 'Approved' && p.approvedAt) {
          const da = new Date(p.approvedAt);
          if (!isNaN(da)) {
            const keyA = `${da.getFullYear()}-${String(da.getMonth() + 1).padStart(2, '0')}`;
            const idxA = monthKeys.indexOf(keyA);
            if (idxA !== -1) approvedCounts[idxA] += 1;
          }
        }
        // Rejected by rejectedAt or updatedAt if status is Rejected
        if (p.status === 'Rejected') {
          const dr = new Date(p.rejectedAt || p.updatedAt);
          if (!isNaN(dr)) {
            const keyR = `${dr.getFullYear()}-${String(dr.getMonth() + 1).padStart(2, '0')}`;
            const idxR = monthKeys.indexOf(keyR);
            if (idxR !== -1) rejectedCounts[idxR] += 1;
          }
        }
      });

      window.chartInstances.trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Permits Submitted',
              data: submittedCounts,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.15)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#3b82f6',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Permits Approved',
              data: approvedCounts,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16,185,129,0.15)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#10b981',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Permits Rejected',
              data: rejectedCounts,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.15)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#ef4444',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 2,
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.08)' } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { padding: 20, usePointStyle: true, font: { size: 11 } }
            }
          },
          animation: { duration: 400 },
          layout: {
            padding: 0
          }
        }
      });
    }
  }

  // ========== GLOBAL FUNCTION EXPORTS ==========
  window.showProfileSettings = showProfileSettings;
  window.hideProfileSettings = hideProfileSettings;
  window.showUpdatePasswordModal = showUpdatePasswordModal;
  window.hideUpdatePasswordModal = hideUpdatePasswordModal;
  window.toggleSection = toggleSection;
  window.submitNewRequest = submitNewRequest;
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

});
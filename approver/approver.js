
import { checkSession, initIdleTimer, logoutUser } from '../session.js';
import { formatDate24 } from '../date-utils.js';
import { API_BASE } from '../config.js';

let allPermits = [];
let allActivities = [];
let currentUser = null;

// Small toast notification helper (used when fetches fail)
function showNotification(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'secondary'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    toastContainer.appendChild(toast);
    if (window.bootstrap && bootstrap.Toast) {
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
    setTimeout(() => toast.remove(), 6000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1055';
    document.body.appendChild(container);
    return container;
}

function updateStats(permits) {
    let approved = 0, rejected = 0, pending = 0, inProgress = 0, returnedForInfo = 0;
    permits.forEach(p => {
        const status = (p.status || '').toLowerCase();
        if (status === 'approved') approved++;
        else if (status === 'rejected') rejected++;
        else if (status === 'in progress') inProgress++;
        else if (status === 'pending') pending++;
        else if (status === 'returned for info') returnedForInfo++;
    });

    const total = permits.length;

    // Calculate percentages (avoid division by zero)
    const approvedPercentage = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;
    const rejectedPercentage = total > 0 ? ((rejected / total) * 100).toFixed(1) : 0;
    const pendingPercentage = total > 0 ? ((pending / total) * 100).toFixed(1) : 0;
    const returnedPercentage = total > 0 ? ((returnedForInfo / total) * 100).toFixed(1) : 0;

    // Update dashboard cards with real data
    const totalElement = document.getElementById('totalPermitsCount');
    const pendingElement = document.getElementById('pendingPermitsCount');
    const approvedElement = document.getElementById('approvedPermitsCount');
    const rejectedElement = document.getElementById('rejectedPermitsCount');
    const returnedForInfoElement = document.getElementById('returnedForInfoCount');

    // Update percentage elements
    const approvedPercentageElement = document.getElementById('approvedPercentage');
    const rejectedPercentageElement = document.getElementById('rejectedPercentage');
    const pendingPercentageElement = document.getElementById('pendingPercentage');
    const returnedPercentageElement = document.getElementById('returnedPercentage');

    // Update counts
    if (totalElement) totalElement.textContent = total;
    if (pendingElement) pendingElement.textContent = pending;
    if (approvedElement) approvedElement.textContent = approved;
    if (rejectedElement) rejectedElement.textContent = rejected;
    if (returnedForInfoElement) returnedForInfoElement.textContent = returnedForInfo;

    // Update percentages
    if (approvedPercentageElement) approvedPercentageElement.textContent = approvedPercentage + '%';
    if (rejectedPercentageElement) rejectedPercentageElement.textContent = rejectedPercentage + '%';
    if (pendingPercentageElement) pendingPercentageElement.textContent = pendingPercentage + '%';
    if (returnedPercentageElement) returnedPercentageElement.textContent = returnedPercentage + '%';

    // Update task progress based on permit processing (completed, inProgress, pending)
    updateTaskProgress(approved, inProgress, pending);
}

function updateTaskProgress(completed, inProgress, upcoming) {
    // Calculate total tasks and progress percentage
    const totalTasks = completed + inProgress + upcoming;
    const progressPercentage = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    // Update task progress elements
    const taskProgressElement = document.getElementById('taskProgressPercentage');
    const completedElement = document.getElementById('completedTasksCount');
    const inProgressElement = document.getElementById('inProgressTasksCount');
    const pendingElement = document.getElementById('pendingTasksCount');

    if (taskProgressElement) taskProgressElement.textContent = progressPercentage + '%';
    if (completedElement) completedElement.textContent = completed;
    if (inProgressElement) inProgressElement.textContent = inProgress;
    if (pendingElement) pendingElement.textContent = upcoming;

    // Update the progress bars
    const progressBarContainer = document.querySelector('.progress-bar-container .progress');
    if (progressBarContainer) {
        const progressBars = progressBarContainer.querySelectorAll('.progress-bar');
        if (progressBars.length >= 3 && totalTasks > 0) {
            const completedWidth = (completed / totalTasks) * 100;
            const inProgressWidth = (inProgress / totalTasks) * 100;
            const upcomingWidth = (upcoming / totalTasks) * 100;

            progressBars[0].style.width = completedWidth + '%';
            progressBars[1].style.width = inProgressWidth + '%';
            progressBars[2].style.width = upcomingWidth + '%';
        }
    }
}

function renderPermits(permits) {
    // This function is kept for compatibility but actual rendering is done in updatePermitTables
    console.log('renderPermits called with', permits.length, 'permits');
}

function renderActivityLog(activities) {
    const log = document.getElementById('activityLog');
    log.innerHTML = '';
    if (!activities.length) {
        log.innerHTML = '<li class="text-gray-400">No recent activity.</li>';
        return;
    }
    activities.forEach(act => {
        log.innerHTML += `<li>${act}</li>`;
    });
}

function filterPermits(query) {
    query = query.trim().toLowerCase();
    if (!query) return allPermits;
    return allPermits.filter(p =>
        (p.permitTitle || '').toLowerCase().includes(query) ||
        (p.requester?.username || '').toLowerCase().includes(query) ||
        (p.status || '').toLowerCase().includes(query) ||
        (p._id || '').toLowerCase().includes(query)
    );
}

async function fetchPermits() {
    let isUsingMockData = false;
    try {
        const res = await fetch(`${API_BASE}/api/permits`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch permits');
        const data = await res.json();
        allPermits = data.permits || data || [];
    } catch (err) {
        console.error('Error fetching permits:', err);
        allPermits = [];
        showNotification('Unable to load permits from server. Showing empty list.', 'error');
    }

    renderPermits(allPermits);

    // Only update stats if we got real data from API
    // If using mock data, preserve the real database stats from fetchDashboardStats()
    if (!isUsingMockData) {
        updateStats(allPermits);
    }

    // Update specific table sections with real data
    updatePermitTables();
}

// Function to update all permit tables with real data
function updatePermitTables() {
    const pendingPermits = allPermits.filter(p => ['Pending', 'In Progress'].includes(p.status));
    const approvedPermits = allPermits.filter(p => p.status === 'Approved');
    const rejectedPermits = allPermits.filter(p => p.status === 'Rejected');

    // Update table bodies with real data if they exist
    updateTableBody('pendingPermitsTable', pendingPermits, 'pending');
    updateTableBody('approvedPermitsTable', approvedPermits, 'approved');
    updateTableBody('rejectedPermitsTable', rejectedPermits, 'rejected');
}

// Generic function to update table bodies
function updateTableBody(tableId, permits, type) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (permits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">No ${type} permits found</td></tr>`;
        return;
    }

    permits.forEach((permit, index) => {
        const row = createPermitRow(permit, type, index + 1);
        tbody.appendChild(row);
    });
}

// Create table row for permit data
function createPermitRow(permit, type, index = 0) {
    const row = document.createElement('tr');

    // Format dates
    const submittedDate = permit.createdAt ? new Date(permit.createdAt).toLocaleDateString() + ', ' + new Date(permit.createdAt).toLocaleTimeString() : '-';
    const preApproverDate = permit.preApprovedAt ? new Date(permit.preApprovedAt).toLocaleDateString() + ', ' + new Date(permit.preApprovedAt).toLocaleTimeString() : '-';
    const approverDate = permit.approvedAt ? new Date(permit.approvedAt).toLocaleDateString() + ', ' + new Date(permit.approvedAt).toLocaleTimeString() : '-';

    // Get status badge
    const getStatusBadge = (status, decision) => {
        if (decision === 'Approved') return '<span class="badge bg-success">Approved</span>';
        if (decision === 'Rejected') return '<span class="badge bg-danger">Rejected</span>';
        if (decision === 'Pending') return '<span class="badge bg-warning">Pending</span>';
        return '<span class="badge bg-secondary">-</span>';
    };

    if (type === 'pending') {
        // Prefer fullName, then username, then fallback
        let preApproverName = '-';
        if (permit.preApprovedBy) {
            preApproverName = permit.preApprovedBy.fullName || permit.preApprovedBy.username || '-';
        } else if (permit.preApproverName) {
            preApproverName = permit.preApproverName;
        }
        row.innerHTML = `
            <td class="small">${permit._id || '-'}</td>
            <td class="small fw-medium">${permit.permitTitle || '-'}</td>
            <td class="small">${submittedDate}</td>
            <td class="small">${preApproverName}</td>
            <td class="small">${permit.preApproverComments || '-'}</td>
            <td class="small">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm" onclick="viewPermitDetails('${permit._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
    } else if (type === 'approved') {
        row.innerHTML = `
            <td class="text-center">${index}</td>
            <td class="text-center">
                <a href="#" class="permit-number-link" onclick="viewPermitDetails('${permit._id}')">${permit._id || permit.serialNo || '-'}</a>
            </td>
            <td class="text-left">${permit.permitTitle || '-'}</td>
            <td class="text-center small text-muted">${submittedDate}</td>
        `;
    } else if (type === 'rejected') {
        const rejectedDate = permit.rejectedAt || permit.approvedAt;
        const rejectedDateFormatted = rejectedDate ? new Date(rejectedDate).toLocaleDateString() + ', ' + new Date(rejectedDate).toLocaleTimeString() : '-';

        row.innerHTML = `
            <td class="text-center">${index}</td>
            <td class="text-center">
                <a href="#" class="permit-number-link" onclick="viewPermitDetails('${permit._id}')">${permit._id || permit.serialNo || '-'}</a>
            </td>
            <td class="text-left">${permit.permitTitle || '-'}</td>
            <td class="text-center small text-muted">${rejectedDateFormatted}</td>
        `;
    }

    return row;
}

function fetchActivityLog() {
    // Try to fetch activity log from API, otherwise show empty state
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/activity`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch activity log');
            const data = await res.json();
            allActivities = data.activities || data || [];
        } catch (err) {
            console.error('Error fetching activity log:', err);
            allActivities = [];
            // Non-critical: show a small notification
            showNotification('Could not load recent activity.', 'error');
        }
        renderActivityLog(allActivities);
    })();
}

// Fetch and display real profile data
async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/api/profile`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        // DEBUG: log profile response so we can verify clientIp presence in the browser
        console.debug('[fetchUserProfile] profile response:', data);
        // data.user contains ISO strings for profileUpdatedAt/passwordUpdatedAt (or null)
        const userObj = { ...data.user, role: data.session.role };
        // parse ISO timestamps into Date objects for frontend formatting
        if (userObj.profileUpdatedAt) userObj.profileUpdatedAt = new Date(userObj.profileUpdatedAt);
        if (userObj.passwordUpdatedAt) userObj.passwordUpdatedAt = new Date(userObj.passwordUpdatedAt);
        // attach server-provided client IP if present
        if (data.clientIp) userObj.clientIp = data.clientIp;

        currentUser = userObj;

        // Update profile section with real data
        updateProfileDisplay(currentUser);

        // Display client IP under last-login if provided by server
        if (currentUser.clientIp) {
            const normalizeIp = (ip) => {
                if (!ip) return ip;
                // IPv6 loopback
                if (ip === '::1') return '127.0.0.1';
                // IPv6-mapped IPv4 like ::ffff:127.0.0.1
                if (ip.startsWith('::ffff:')) return ip.split(':').pop();
                return ip;
            };

            const existing = document.getElementById('clientIp');
            const displayIp = normalizeIp(currentUser.clientIp);
            if (existing) existing.textContent = `IP Address: ${displayIp}`;
            else {
                const lastLogin = document.querySelector('.last-login');
                if (lastLogin) {
                    const ipEl = document.createElement('p');
                    ipEl.className = 'mb-1 text-muted small';
                    ipEl.id = 'clientIp';
                    ipEl.textContent = `IP Address: ${displayIp}`;
                    // Keep raw IP available on hover
                    ipEl.title = `Raw IP: ${currentUser.clientIp}`;
                    lastLogin.insertAdjacentElement('afterend', ipEl);
                }
            }
        }

        return currentUser;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}

// Update profile display with real user data
function updateProfileDisplay(user) {
    if (!user) return;

    // Update profile name (prefer fullName, fallback to username)
    const displayName = user.fullName || user.username || user.fullname || 'User';
    const profileName = document.querySelector('.profile-name');
    if (profileName) {
        profileName.textContent = displayName;
    }

    // Update profile email
    const profileEmail = document.querySelector('.profile-email');
    if (profileEmail) {
        profileEmail.textContent = user.email || '';
    }
    // Also update the dropdown email shown in the floating sidebar/header
    const dropdownEmail = document.getElementById('dropdownEmail');
    if (dropdownEmail) dropdownEmail.textContent = user.email || '';

    // Update profile contact (if available)
    const profileContact = document.querySelector('.profile-contact');
    if (profileContact && user.phone) {
        profileContact.textContent = user.phone;
    } else if (profileContact) {
        profileContact.style.display = 'none';
    }

    // Update avatar initials from the display name
    const avatarCircle = document.querySelector('.avatar-circle');
    if (avatarCircle && displayName) {
        const initials = displayName.split(' ')
            .map(name => name.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
        avatarCircle.textContent = initials;
    }

    // Update last login and normalize font to match other profile details
    const lastLogin = document.querySelector('.last-login');
    if (lastLogin && user.lastLogin) {
        // Format: MMMM, DD, YYYY at HH:MM (24hrs)
        const loginDate = new Date(user.lastLogin);
        const pad = (n) => String(n).padStart(2, '0');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const formatted = `${monthNames[loginDate.getMonth()]}, ${pad(loginDate.getDate())}, ${loginDate.getFullYear()} at ${pad(loginDate.getHours())}:${pad(loginDate.getMinutes())}`;
        lastLogin.textContent = `Last Login: ${formatted}`;
        lastLogin.dataset.raw = loginDate.toISOString();
        // use same small muted styling as email/phone for uniform font
        lastLogin.className = 'mb-1 text-muted small last-login';
    }

    // Update header and dropdown usernames (use first name for header)
    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername) {
        const firstName = displayName.split(' ')[0];
        headerUsername.textContent = firstName;
    }
    const dropdownUsername = document.getElementById('dropdownUsername');
    if (dropdownUsername) dropdownUsername.textContent = displayName;
}


// Fetch real dashboard statistics
async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_BASE}/api/dashboard/stats`, {
            credentials: 'include'
        });

        if (response.ok) {
            const stats = await response.json();
            updateDashboardCards(stats);
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

// Update dashboard cards with real data
function updateDashboardCards(stats) {
    const cards = {
        pending: document.getElementById('pendingPermitsCount'),
        approved: document.getElementById('approvedPermitsCount'),
        rejected: document.getElementById('rejectedPermitsCount'),
        total: document.getElementById('totalPermitsCount')
    };

    if (stats) {
        if (cards.pending) cards.pending.textContent = stats.pending || '0';
        if (cards.approved) cards.approved.textContent = stats.approved || '0';
        if (cards.rejected) cards.rejected.textContent = stats.rejected || '0';
        if (cards.total) cards.total.textContent = stats.total || '0';
    }
} // Initialize theme system early
function initializeTheme() {
    const savedTheme = localStorage.getItem('approver-theme') || 'light';
    const body = document.body;

    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
    } else {
        body.removeAttribute('data-theme');
    }
}

// Apply theme immediately to prevent flash
initializeTheme();

document.addEventListener('DOMContentLoaded', async () => {
    // Floating sidebar hover logic
    const avatar = document.querySelector('.dasher-user-avatar');
    const floatingSidebar = document.getElementById('floatingSidebar');
    let sidebarHover = false, avatarHover = false;
    if (avatar && floatingSidebar) {
        function showSidebar() {
            floatingSidebar.classList.add('visible');
        }
        function hideSidebar() {
            if (!sidebarHover && !avatarHover) floatingSidebar.classList.remove('visible');
        }
        avatar.addEventListener('mouseenter', () => {
            avatarHover = true;
            showSidebar();
        });
        avatar.addEventListener('mouseleave', () => {
            avatarHover = false;
            setTimeout(hideSidebar, 100);
        });
        floatingSidebar.addEventListener('mouseenter', () => {
            sidebarHover = true;
            showSidebar();
        });
        floatingSidebar.addEventListener('mouseleave', () => {
            sidebarHover = false;
            setTimeout(hideSidebar, 100);
        });
    }
    const user = await checkSession();
    if (!user) return;

    // Fetch and display real profile data
    await fetchUserProfile();

    // Fetch dashboard statistics
    await fetchDashboardStats();

    initIdleTimer();

    await fetchPermits();
    fetchActivityLog();

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', e => {
        renderPermits(filterPermits(e.target.value));
        updateStats(filterPermits(e.target.value));
    });

    // Action buttons (event delegation) - guard if element is missing
    const permitTableBody = document.getElementById('permitTableBody');
    if (permitTableBody) {
        permitTableBody.addEventListener('click', e => {
            if (e.target.classList.contains('action-btn')) {
                const id = e.target.dataset.id;
                const action = e.target.dataset.action;
                if (action === 'approve') {
                    alert(`Approve permit ${id}`);
                } else if (action === 'reject') {
                    alert(`Reject permit ${id}`);
                } else if (action === 'info') {
                    alert(`Return permit ${id} for more info`);
                }
            }
        });
    }

    // Sidebar toggle (mobile)
    const sidebar = document.querySelector('.dasher-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        // Optional: close sidebar on outside click
        document.addEventListener('click', e => {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
});

// Sidebar and Theme functionality
document.addEventListener('DOMContentLoaded', function () {
    var sidebar = document.getElementById('sidebar');
    var trigger = document.getElementById('sidebarTrigger');
    var body = document.body;

    // Show sidebar
    function openSidebar() {
        sidebar.classList.add('active');
        body.classList.add('sidebar-open');
    }

    // Hide sidebar
    function closeSidebar() {
        sidebar.classList.remove('active');
        body.classList.remove('sidebar-open');
    }

    if (trigger) {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (sidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    // Hide sidebar on ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });

    // Optional: close sidebar if clicking outside
    document.addEventListener('click', function (e) {
        if (!sidebar.contains(e.target) && !trigger.contains(e.target)) {
            closeSidebar();
        }
    });

    // Tooltip for trigger
    if (window.bootstrap && trigger) {
        var tooltip = new bootstrap.Tooltip(trigger);
    }

    // Enhanced Theme System with localStorage persistence
    const themeSlider = document.getElementById('themeSlider');
    const lightTheme = document.getElementById('lightTheme');
    const darkTheme = document.getElementById('darkTheme');

    if (themeSlider && lightTheme && darkTheme) {
        // Get saved theme or default to light
        const savedTheme = localStorage.getItem('approver-theme') || 'light';

        function applyTheme(theme) {
            const body = document.body;

            if (theme === 'light') {
                body.removeAttribute('data-theme');
                themeSlider.classList.remove('dark');
                themeSlider.classList.add('light');
                lightTheme.classList.add('active');
                darkTheme.classList.remove('active');
            } else {
                body.setAttribute('data-theme', 'dark');
                themeSlider.classList.remove('light');
                themeSlider.classList.add('dark');
                lightTheme.classList.remove('active');
                darkTheme.classList.add('active');
            }

            // Save theme preference
            localStorage.setItem('approver-theme', theme);

            // Dispatch custom event for other components
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
        }

        // Apply saved theme on page load
        applyTheme(savedTheme);

        // Theme switching event listeners
        lightTheme.addEventListener('click', (e) => {
            e.preventDefault();
            applyTheme('light');
        });

        darkTheme.addEventListener('click', (e) => {
            e.preventDefault();
            applyTheme('dark');
        });

        themeSlider.addEventListener('click', (e) => {
            // Prevent double triggering from child elements
            if (e.target === themeSlider) {
                const rect = themeSlider.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const centerX = rect.width / 2;

                if (clickX < centerX) {
                    applyTheme('light');
                } else {
                    applyTheme('dark');
                }
            }
        });

        // Add keyboard support
        themeSlider.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const currentTheme = localStorage.getItem('approver-theme') || 'light';
                applyTheme(currentTheme === 'light' ? 'dark' : 'light');
            }
        });

        // Make slider focusable for accessibility
        themeSlider.setAttribute('tabindex', '0');
        themeSlider.setAttribute('role', 'switch');
        themeSlider.setAttribute('aria-label', 'Toggle dark/light theme');
    }
});

// Export and Print Functions - Global scope for HTML onclick access
window.exportToCSV = function () {
    const table = document.getElementById('pendingPermitsTable');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    let csvContent = '';

    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('th, td');
        const rowData = [];
        cells.forEach((cell, cellIndex) => {
            // Skip the Actions column (last column)
            if (cellIndex < cells.length - 1) {
                let cellText = cell.textContent.trim();
                // Escape quotes and wrap in quotes if contains comma
                if (cellText.includes(',') || cellText.includes('"')) {
                    cellText = '"' + cellText.replace(/"/g, '""') + '"';
                }
                rowData.push(cellText);
            }
        });
        csvContent += rowData.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pending_permits.csv';
    a.click();
    window.URL.revokeObjectURL(url);
};

window.exportToExcel = function () {
    const table = document.getElementById('pendingPermitsTable');
    if (!table || !window.XLSX) return;

    const wb = XLSX.utils.book_new();

    // Create worksheet from table
    const ws = XLSX.utils.table_to_sheet(table, {
        raw: false,
        dateNF: 'yyyy-mm-dd'
    });

    // Remove Actions column from worksheet
    const range = XLSX.utils.decode_range(ws['!ref']);
    const lastCol = range.e.c;

    // Delete the last column (Actions)
    for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: lastCol });
        delete ws[cellAddress];
    }

    // Update the range
    ws['!ref'] = XLSX.utils.encode_range({
        s: { r: range.s.r, c: range.s.c },
        e: { r: range.e.r, c: lastCol - 1 }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Pending Permits');
    XLSX.writeFile(wb, 'pending_permits.xlsx');
};

window.printTable = function () {
    const table = document.getElementById('pendingPermitsTable');
    if (!table) return;

    const printWindow = window.open('', '', 'height=600,width=800');

    printWindow.document.write('<html><head><title>Pending Permits Report</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 20px; }');
    printWindow.document.write('h1 { color: #333; text-align: center; margin-bottom: 30px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin: 20px 0; }');
    printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
    printWindow.document.write('th { background-color: #f5f5f5; font-weight: bold; }');
    printWindow.document.write('tr:nth-child(even) { background-color: #f9f9f9; }');
    printWindow.document.write('.actions-col { display: none; }'); // Hide actions column
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Total Pending Permits Report</h1>');

    // Clone table and remove actions column
    const tableClone = table.cloneNode(true);
    const actionCells = tableClone.querySelectorAll('th:last-child, td:last-child');
    actionCells.forEach(cell => cell.style.display = 'none');

    printWindow.document.write(tableClone.outerHTML);
    printWindow.document.write('<div style="margin-top: 30px; font-size: 12px; color: #666;">');
    printWindow.document.write('Generated on: ' + new Date().toLocaleString());
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
};

// Export and Print Functions for Approved Permits Table
window.exportApprovedToCSV = function () {
    exportTableToCSV('approvedPermitsTable', 'approved_permits.csv');
};

window.exportApprovedToExcel = function () {
    exportTableToExcel('approvedPermitsTable', 'approved_permits.xlsx');
};

window.printApprovedTable = function () {
    printTableById('approvedPermitsTable', 'Approved Permits Report');
};

// Export and Print Functions for Rejected Permits Table
window.exportRejectedToCSV = function () {
    exportTableToCSV('rejectedPermitsTable', 'rejected_permits.csv');
};

window.exportRejectedToExcel = function () {
    exportTableToExcel('rejectedPermitsTable', 'rejected_permits.xlsx');
};

window.printRejectedTable = function () {
    printTableById('rejectedPermitsTable', 'Rejected Permits Report');
};

// Generic table export functions
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    let csvContent = '';

    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('th, td');
        const rowData = [];
        cells.forEach((cell, cellIndex) => {
            let cellText = cell.textContent.trim();
            // Escape quotes and wrap in quotes if contains comma
            if (cellText.includes(',') || cellText.includes('"')) {
                cellText = '"' + cellText.replace(/"/g, '""') + '"';
            }
            rowData.push(cellText);
        });
        csvContent += rowData.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table || !window.XLSX) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table, {
        raw: false,
        dateNF: 'yyyy-mm-dd'
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Permits');
    XLSX.writeFile(wb, filename);
}

function printTableById(tableId, reportTitle) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const printWindow = window.open('', '', 'height=600,width=800');

    printWindow.document.write('<html><head><title>' + reportTitle + '</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 20px; }');
    printWindow.document.write('h1 { color: #333; text-align: center; margin-bottom: 30px; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin: 20px 0; }');
    printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
    printWindow.document.write('th { background-color: #f5f5f5; font-weight: bold; }');
    printWindow.document.write('tr:nth-child(even) { background-color: #f9f9f9; }');
    printWindow.document.write('.badge { padding: 2px 6px; border-radius: 3px; font-size: 11px; }');
    printWindow.document.write('.bg-success { background-color: #28a745; color: white; }');
    printWindow.document.write('.bg-danger { background-color: #dc3545; color: white; }');
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>' + reportTitle + '</h1>');
    printWindow.document.write(table.outerHTML);
    printWindow.document.write('<div style="margin-top: 30px; font-size: 12px; color: #666;">');
    printWindow.document.write('Generated on: ' + new Date().toLocaleString());
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Dynamic Table Header Functionality
document.addEventListener('DOMContentLoaded', function () {
    initializeDynamicTable();
});

function initializeDynamicTable() {
    const table = document.getElementById('pendingPermitsTable');
    if (!table) return;

    const headers = table.querySelectorAll('.table-header-dynamic');
    let sortDirection = {};

    headers.forEach(header => {
        const field = header.getAttribute('data-field');
        sortDirection[field] = 'asc';

        header.addEventListener('click', function () {
            sortTable(field, sortDirection[field]);
            sortDirection[field] = sortDirection[field] === 'asc' ? 'desc' : 'asc';
            updateSortIndicators(header, sortDirection[field] === 'asc' ? 'desc' : 'asc');
        });
    });
}

function sortTable(field, direction) {
    const table = document.getElementById('pendingPermitsTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const fieldIndex = getFieldIndex(field);
    if (fieldIndex === -1) return;

    rows.sort((a, b) => {
        const aValue = a.cells[fieldIndex].textContent.trim();
        const bValue = b.cells[fieldIndex].textContent.trim();

        // Handle different data types
        let comparison = 0;
        if (field === 'serialNo') {
            const aNum = aValue.replace('PTW-', '');
            const bNum = bValue.replace('PTW-', '');
            comparison = parseInt(aNum) - parseInt(bNum);
        } else if (field === 'submittedDateTime') {
            comparison = new Date(aValue) - new Date(bValue);
        } else {
            comparison = aValue.localeCompare(bValue);
        }

        return direction === 'asc' ? comparison : -comparison;
    });

    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
}

function getFieldIndex(field) {
    const fieldMap = {
        'serialNo': 0,
        'permitTitle': 1,
        'submittedDateTime': 2,
        'preApproverName': 3,
        'preApproverRemarks': 4,
        'actions': 5
    };
    return fieldMap[field] || -1;
}

function updateSortIndicators(activeHeader, direction) {
    // Remove all existing sort indicators
    document.querySelectorAll('.table-header-dynamic').forEach(header => {
        const icon = header.querySelector('i');
        icon.className = icon.className.replace(/fa-sort.*/, '');

        // Reset to original icon based on field
        const field = header.getAttribute('data-field');
        const originalIcons = {
            'serialNo': 'fas fa-hashtag',
            'permitTitle': 'fas fa-file-contract',
            'submittedDateTime': 'fas fa-calendar-alt',
            'preApproverName': 'fas fa-user-check',
            'preApproverRemarks': 'fas fa-comment-alt',
            'actions': 'fas fa-cogs'
        };
        icon.className = originalIcons[field] + ' me-2';
    });

    // Add sort indicator to active header
    const icon = activeHeader.querySelector('i');
    const sortIcon = direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
    icon.className = `fas ${sortIcon} me-2`;
}

// Password and Profile Modal Functions
function showUpdatePasswordModal() {
    const modal = new bootstrap.Modal(document.getElementById('updatePasswordModal'));
    document.getElementById('updatePasswordForm').reset();
    document.getElementById('passwordUpdateMessage').style.display = 'none';
    modal.show();
}

function showUpdateProfileModal() {
    const modal = new bootstrap.Modal(document.getElementById('updateProfileModal'));

    // Populate form with current user data
    if (currentUser) {
        document.getElementById('profileUsername').value = currentUser.username || '';
        document.getElementById('profileEmail').value = currentUser.email || '';
        document.getElementById('profileCompany').value = currentUser.company || '';
        document.getElementById('profilePhone').value = currentUser.phone || '';
        // Populate timestamps if available
        const pUpdated = document.getElementById('profileUpdatedAt');
        const passUpdated = document.getElementById('passwordUpdatedAt');
        const pad = (n) => String(n).padStart(2, '0');
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (pUpdated) {
            if (currentUser.profileUpdatedAt) {
                const d = new Date(currentUser.profileUpdatedAt);
                pUpdated.textContent = `${monthNames[d.getMonth()]}, ${pad(d.getDate())}, ${d.getFullYear()} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } else pUpdated.textContent = '-';
        }
        if (passUpdated) {
            if (currentUser.passwordUpdatedAt) {
                const d2 = new Date(currentUser.passwordUpdatedAt);
                passUpdated.textContent = `${monthNames[d2.getMonth()]}, ${pad(d2.getDate())}, ${d2.getFullYear()} at ${pad(d2.getHours())}:${pad(d2.getMinutes())}`;
            } else passUpdated.textContent = '-';
        }
    }

    document.getElementById('profileUpdateMessage').style.display = 'none';
    modal.show();
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function validatePasswordStrength(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: (password.match(/[A-Z]/g) || []).length >= 2,
        lowercase: (password.match(/[a-z]/g) || []).length >= 2,
        numbers: (password.match(/[0-9]/g) || []).length >= 2,
        special: (password.match(/[^A-Za-z0-9]/g) || []).length >= 2
    };

    const strengthDiv = document.getElementById('passwordStrength');
    let strength = 0;
    let html = '<div class="password-requirements">';

    Object.keys(requirements).forEach(key => {
        const met = requirements[key];
        if (met) strength++;

        const labels = {
            length: 'At least 8 characters',
            uppercase: '2+ uppercase letters',
            lowercase: '2+ lowercase letters',
            numbers: '2+ numbers',
            special: '2+ special characters'
        };

        html += `<div class="${met ? 'text-success' : 'text-danger'}">
            <i class="fas fa-${met ? 'check' : 'times'} me-1"></i>
            ${labels[key]}
        </div>`;
    });

    html += '</div>';

    const strengthColors = ['danger', 'danger', 'warning', 'warning', 'info', 'success'];
    const strengthText = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];

    html += `<div class="mt-2">
        <small class="text-${strengthColors[strength]}">
            Password Strength: ${strengthText[strength]}
        </small>
    </div>`;

    strengthDiv.innerHTML = html;

    return strength === 5;
}

async function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('passwordUpdateMessage');

    // Reset message
    messageDiv.style.display = 'none';

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage(messageDiv, 'Please fill in all fields', 'danger');
        return;
    }

    if (!validatePasswordStrength(newPassword)) {
        showMessage(messageDiv, 'Password does not meet security requirements', 'danger');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage(messageDiv, 'New passwords do not match', 'danger');
        return;
    }

    try {
        const remarkEl = document.getElementById('profileRemark');
        const remark = remarkEl ? remarkEl.value.trim() : '';
        if (!remark) {
            showMessage(messageDiv, 'Please add a remark before updating password', 'danger');
            return;
        }

        const response = await fetch(`${API_BASE}/api/auth/update-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                currentPassword,
                newPassword,
                remark
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(messageDiv, 'Password updated successfully', 'success');

            // Update profile section with password update timestamp
            updatePasswordTimestamp();

            // Clear form
            document.getElementById('updatePasswordForm').reset();

            // Close modal after delay
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('updatePasswordModal')).hide();
            }, 2000);
        } else {
            showMessage(messageDiv, data.message || 'Failed to update password', 'danger');
        }
    } catch (error) {
        console.error('Error updating password:', error);
        showMessage(messageDiv, 'Network error. Please try again.', 'danger');
    }
}

async function updateProfile() {
    const username = document.getElementById('profileUsername').value;
    const email = document.getElementById('profileEmail').value;
    const company = document.getElementById('profileCompany').value;
    const phone = document.getElementById('profilePhone').value;
    const messageDiv = document.getElementById('profileUpdateMessage');

    // Reset message
    messageDiv.style.display = 'none';

    // Validate inputs - remark required for audit
    const remarkEl = document.getElementById('profileRemark');
    const remark = remarkEl ? remarkEl.value.trim() : '';
    if (!remark) {
        showMessage(messageDiv, 'Please provide a remark explaining this update', 'danger');
        return;
    }

    try {
        // Send remark for audit trail; backend will enforce which fields are allowed to change
        const response = await fetch(`${API_BASE}/api/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username,
                email,
                company,
                phone,
                remark
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(messageDiv, 'Profile updated successfully', 'success');

            // Update current user data
            currentUser = { ...currentUser, ...data.user };

            // Update profile display
            updateProfileDisplay(currentUser);

            // Close modal after delay
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('updateProfileModal')).hide();
            }, 2000);
        } else {
            showMessage(messageDiv, data.message || 'Failed to update profile', 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage(messageDiv, 'Network error. Please try again.', 'danger');
    }
}

function showMessage(messageDiv, text, type) {
    messageDiv.className = `alert alert-${type}`;
    messageDiv.textContent = text;
    messageDiv.style.display = 'block';
}

function updatePasswordTimestamp() {
    const lastLogin = document.querySelector('.last-login');
    if (lastLogin) {
        const now = new Date();
        const passwordInfo = document.createElement('p');
        passwordInfo.className = 'password-update mb-0 text-muted';
        passwordInfo.style.fontSize = '11px';
        passwordInfo.textContent = `Password updated: ${now.toLocaleDateString()}, at ${now.toLocaleTimeString()}`;

        // Remove existing password update info if any
        const existing = document.querySelector('.password-update');
        if (existing) {
            existing.remove();
        }

        lastLogin.parentNode.appendChild(passwordInfo);
    }
}

// Add password strength validation on input
document.addEventListener('DOMContentLoaded', function () {
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function () {
            if (this.value.length > 0) {
                validatePasswordStrength(this.value);
            } else {
                document.getElementById('passwordStrength').innerHTML = '';
            }
        });
    }
});

// Permit action handler
async function handlePermitAction(permitId, action) {
    // Require comments from modal textarea instead of prompt
    try {
        const commentsEl = document.getElementById('modal_approvalComments');
        const comments = commentsEl ? commentsEl.value.trim() : '';
        if (!comments) {
            alert('Please enter approval comments before proceeding.');
            if (commentsEl) commentsEl.focus();
            return;
        }

        const payload = { action, comments };
        const response = await fetch(`${API_BASE}/api/permits/${encodeURIComponent(permitId)}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showNotification(`Permit ${action}ed successfully`, 'success');
            // close modal
            const modalEl = document.getElementById('permitDetailsModal');
            if (modalEl) {
                const bs = bootstrap.Modal.getInstance(modalEl);
                if (bs) bs.hide();
            }
            // Refresh permits data and stats
            await fetchPermits();
            await fetchDashboardStats();
        } else {
            const data = await response.json().catch(() => ({}));
            showNotification(`Failed to ${action} permit: ${data.message || 'server error'}`, 'error');
        }
    } catch (error) {
        console.error(`Error ${action}ing permit:`, error);
        showNotification(`Network error while ${action}ing permit`, 'error');
    }
}

// Enhanced logout with proper session cleanup
async function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // Call logout API to clean up server session
            const response = await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            // Clear client-side storage regardless of API response
            sessionStorage.clear();
            localStorage.clear();

            // Redirect to login page
            window.location.href = '../login/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Still redirect even if API call fails
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = '../login/index.html';
        }
    }
}

// View permit details function
async function viewPermitDetails(permitId) {
    try {
        const response = await fetch(`${API_BASE}/api/permits/${encodeURIComponent(permitId)}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch permit details');
        }
        const permit = await response.json();
        // If the endpoint returns { permit: {...} } normalize
        const payload = permit.permit || permit;
        showPermitDetailsModal(payload);
    } catch (error) {
        console.error('Error fetching permit details:', error);
        showNotification('Failed to load permit details. Please try again.', 'error');
    }
}

function showPermitDetailsModal(permit) {
    try {
        const modalEl = document.getElementById('permitDetailsModal');
        const modal = new bootstrap.Modal(modalEl);
        // Defensive: clear all modal fields first
        const form = document.getElementById('permitDetailsForm');
        if (form) form.reset();
        document.getElementById('modal_approvalComments').value = '';

        // Helper to get nested fields robustly
        const get = (obj, ...paths) => {
            for (const p of paths) {
                const parts = p.split('.');
                let cur = obj;
                let ok = true;
                for (const k of parts) {
                    if (cur && typeof cur === 'object' && (k in cur)) cur = cur[k];
                    else { ok = false; break; }
                }
                if (ok && cur !== undefined && cur !== null) return cur;
            }
            return '';
        };

        // Basic requester
        document.getElementById('modal_permitId').value = get(permit, '_id', 'id');
        document.getElementById('modal_fullName').value = get(permit, 'fullName', 'requester.fullName', 'requester.username');
        document.getElementById('modal_lastName').value = get(permit, 'lastName', 'requester.lastName');
        document.getElementById('modal_corpEmailId').value = get(permit, 'corpEmailId', 'requester.email');
        document.getElementById('modal_contactDetails').value = get(permit, 'contactDetails', 'requester.phone');
        if (document.getElementById('modal_altContactDetails')) document.getElementById('modal_altContactDetails').value = get(permit, 'altContactDetails');

        // Work details
        if (document.getElementById('modal_permitTitle')) document.getElementById('modal_permitTitle').value = get(permit, 'permitTitle', 'title');
        if (document.getElementById('modal_terminal')) document.getElementById('modal_terminal').value = get(permit, 'terminal');
        if (document.getElementById('modal_facility')) document.getElementById('modal_facility').value = get(permit, 'facility');
        if (document.getElementById('modal_specifyTerminal')) document.getElementById('modal_specifyTerminal').value = get(permit, 'specifyTerminal');
        if (document.getElementById('modal_specifyFacility')) document.getElementById('modal_specifyFacility').value = get(permit, 'specifyFacility');
        if (document.getElementById('modal_impact')) document.getElementById('modal_impact').value = get(permit, 'impact');
        if (document.getElementById('modal_levelOfImpact')) document.getElementById('modal_levelOfImpact').value = get(permit, 'levelOfImpact');
        if (document.getElementById('modal_equipmentTypeInput')) document.getElementById('modal_equipmentTypeInput').value = get(permit, 'equipmentTypeInput');
        if (document.getElementById('modal_impactDetailsInput')) document.getElementById('modal_impactDetailsInput').value = get(permit, 'impactDetailsInput');
        if (document.getElementById('modal_natureOfWork')) document.getElementById('modal_natureOfWork').value = get(permit, 'natureOfWork');
        if (document.getElementById('modal_workDescription')) document.getElementById('modal_workDescription').value = get(permit, 'workDescription');

        // Documents
        if (document.getElementById('modal_ePermit')) document.getElementById('modal_ePermit').value = get(permit, 'ePermit');
        if (document.getElementById('modal_ePermitReason')) document.getElementById('modal_ePermitReason').value = get(permit, 'ePermitReason');
        if (document.getElementById('modal_fmmWorkorder')) document.getElementById('modal_fmmWorkorder').value = get(permit, 'fmmWorkorder');
        if (document.getElementById('modal_noFmmWorkorder')) document.getElementById('modal_noFmmWorkorder').value = get(permit, 'noFmmWorkorder');
        if (document.getElementById('modal_hseRisk')) document.getElementById('modal_hseRisk').value = get(permit, 'hseRisk');
        if (document.getElementById('modal_noHseRiskAssessmentReason')) document.getElementById('modal_noHseRiskAssessmentReason').value = get(permit, 'noHseRiskAssessmentReason');
        if (document.getElementById('modal_opRisk')) document.getElementById('modal_opRisk').value = get(permit, 'opRisk');
        if (document.getElementById('modal_noOpsRiskAssessmentReason')) document.getElementById('modal_noOpsRiskAssessmentReason').value = get(permit, 'noOpsRiskAssessmentReason');

        // Files
        const filesDiv = document.getElementById('modal_files');
        if (filesDiv) {
            filesDiv.innerHTML = '';
            const files = get(permit, 'files') || [];
            if (Array.isArray(files) && files.length) {
                files.forEach(f => {
                    const a = document.createElement('a');
                    a.href = f.url || f.path || (`/api/permits/${permit._id}/file/${f._id}`);
                    a.textContent = f.originalName || f.name || f.filename || 'File';
                    a.target = '_blank';
                    a.className = 'd-block';
                    filesDiv.appendChild(a);
                });
            } else {
                filesDiv.textContent = 'No files attached';
            }
        }

        // Date & Time
        if (document.getElementById('modal_startDateTime')) document.getElementById('modal_startDateTime').value = permit.startDateTime ? new Date(permit.startDateTime).toLocaleString() : '';
        if (document.getElementById('modal_endDateTime')) document.getElementById('modal_endDateTime').value = permit.endDateTime ? new Date(permit.endDateTime).toLocaleString() : '';

        // Signature
        if (document.getElementById('modal_signName')) document.getElementById('modal_signName').value = get(permit, 'signName');
        if (document.getElementById('modal_signDate')) document.getElementById('modal_signDate').value = get(permit, 'signDate');
        if (document.getElementById('modal_signTime')) document.getElementById('modal_signTime').value = get(permit, 'signTime');
        if (document.getElementById('modal_designation')) document.getElementById('modal_designation').value = get(permit, 'designation');

        // Approval comments prefill if present
        document.getElementById('modal_approvalComments').value = get(permit, 'preApproverComments', 'approverComments', 'preApprover.comments') || '';

        // Wire approve/reject buttons
        const approveBtn = document.getElementById('modalApproveBtn');
        const rejectBtn = document.getElementById('modalRejectBtn');
        if (approveBtn) {
            approveBtn.onclick = () => handlePermitAction(get(permit, '_id', 'id'), 'approve');
        }
        if (rejectBtn) {
            rejectBtn.onclick = () => handlePermitAction(get(permit, '_id', 'id'), 'reject');
        }

        modal.show();
    } catch (err) {
        showNotification('Failed to load permit details. Please try again.', 'error');
        console.error('Error populating permit modal:', err);
    }
}

// Make functions globally available
window.showUpdatePasswordModal = showUpdatePasswordModal;
window.showUpdateProfileModal = showUpdateProfileModal;
window.togglePassword = togglePassword;
window.updatePassword = updatePassword;
window.updateProfile = updateProfile;
window.handlePermitAction = handlePermitAction;
window.confirmLogout = confirmLogout;
window.viewPermitDetails = viewPermitDetails;

import { checkSession, initIdleTimer, logoutUser } from '../session.js';
import { formatDate24 } from '../date-utils.js';
import { API_BASE } from '../config.js';

let allPermits = [];
let allActivities = [];
let currentUser = null;
let currentPermitId = null;

// Update dashboard statistics (cards only)
function updateStats(permits = []) {
    try {
        const userId = currentUser && (currentUser.id || currentUser._id);

        const normalized = permits.map(p => ({
            status: (p.status || '').toLowerCase(),
            preApprovedBy: p.preApprovedBy,
        }));

        const total = normalized.length;
        const pending = normalized.filter(p => p.status === 'pending').length;
        const inProgress = normalized.filter(p => p.status === 'in progress').length;
        const rejected = normalized.filter(p => p.status === 'rejected').length;

        // Scoped to current user
        const preApprovedByMe = normalized.filter(p => p.status === 'in progress' && p.preApprovedBy === userId).length;
        const rejectedByMe = normalized.filter(p => p.status === 'rejected' && p.preApprovedBy === userId).length;

        // Update DOM counters if present
        const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
        setText('totalPermitsCount', total);
        setText('pendingReviewCount', pending);
        setText('preApprovedCount', preApprovedByMe);
        setText('rejectedByMeCount', rejectedByMe);
        setText('inProgressCount', inProgress);

        const myDecisions = preApprovedByMe + rejectedByMe;
        const rate = myDecisions ? Math.round((preApprovedByMe / myDecisions) * 100) : 0;
        const rateEl = document.getElementById('approvalRate');
        if (rateEl) rateEl.textContent = `${rate}%`;
    } catch (err) {
        console.error('Failed to update stats', err);
    }
}

// Fetch permits for pre-approver
async function fetchPermits() {
    try {
        const res = await fetch(`${API_BASE}/api/permits`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch permits');
        const data = await res.json();
        allPermits = Array.isArray(data) ? data : (data.permits || []);
    } catch (err) {
        console.error('Error fetching permits:', err);
        allPermits = [];
        showNotification('Unable to load permits from server.', 'error');
    }

    // Update dashboard with latest data
    updateStats(allPermits);
    updatePermitTables();
}
function initializeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var trigger = document.getElementById('sidebarTrigger');
    var body = document.body;

    // No sidebar or trigger present: safely no-op
    if (!sidebar || !trigger) {
        return;
    }

    function openSidebar() {
        try { sidebar.classList.add('active'); } catch (_) { }
        try { body.classList.add('sidebar-open'); } catch (_) { }
    }

    function closeSidebar() {
        try { sidebar.classList.remove('active'); } catch (_) { }
        try { body.classList.remove('sidebar-open'); } catch (_) { }
    }

    trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (sidebar.classList.contains('active')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });

    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !trigger.contains(e.target)) {
                closeSidebar();
            }
        }
    });

    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            try { sidebar.classList.remove('active'); } catch (_) { }
            try { body.classList.remove('sidebar-open'); } catch (_) { }
        }
    });
}
function updatePermitTables() {
    const pendingPermits = allPermits.filter(p => (p.status || '').toLowerCase() === 'pending');
    const preApprovedPermits = allPermits.filter(p =>
        p.preApprovedBy === (currentUser?.id || 'current-user') ||
        (p.status || '').toLowerCase() === 'in progress'
    );

    updateTableBody('pendingPermitsTable', pendingPermits, 'pending');
    updateTableBody('preApprovedPermitsTable', preApprovedPermits, 'preapproved');
}

// Generic function to update table bodies
function updateTableBody(tableId, permits, type) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (permits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">No ${type === 'pending' ? 'pending' : 'pre-approved'} permits found</td></tr>`;
        return;
    }

    permits.forEach(permit => {
        const row = createPermitRow(permit, type);
        tbody.appendChild(row);
    });
}

// Create table row for permit data
function createPermitRow(permit, type) {
    const row = document.createElement('tr');

    // Format dates
    const submittedDate = permit.createdAt ? formatDate24(new Date(permit.createdAt)) : '-';
    const preApprovedDate = permit.preApprovedAt ? formatDate24(new Date(permit.preApprovedAt)) : '-';

    // Get priority badge
    const getPriorityBadge = (priority) => {
        const p = (priority || '').toLowerCase();
        if (p === 'high') return '<span class="badge bg-danger">High</span>';
        if (p === 'medium') return '<span class="badge bg-warning">Medium</span>';
        if (p === 'low') return '<span class="badge bg-success">Low</span>';
        return '<span class="badge bg-secondary">-</span>';
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'pending') return '<span class="badge bg-warning">Pending</span>';
        if (s === 'in progress') return '<span class="badge bg-info">In Progress</span>';
        if (s === 'approved') return '<span class="badge bg-success">Approved</span>';
        if (s === 'rejected') return '<span class="badge bg-danger">Rejected</span>';
        return '<span class="badge bg-secondary">-</span>';
    };

    if (type === 'pending') {
        row.innerHTML = `
            <td class="small">${permit._id || '-'}</td>
            <td class="small fw-medium">${permit.permitTitle || '-'}</td>
            <td class="small">${permit.requester?.username || '-'}</td>
            <td class="small">${submittedDate}</td>
            <td class="small">${getPriorityBadge(permit.priority)}</td>
            <td class="small">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm" onclick="viewPermitDetails('${permit._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="handlePermitAction('${permit._id}', 'preapprove')" title="Pre-Approve">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="handlePermitAction('${permit._id}', 'reject')" title="Reject">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
    } else if (type === 'preapproved') {
        row.innerHTML = `
            <td class="small">${permit._id || '-'}</td>
            <td class="small fw-medium">${permit.permitTitle || '-'}</td>
            <td class="small">${permit.requester?.username || '-'}</td>
            <td class="small">${preApprovedDate}</td>
            <td class="small">${permit.preApproverComments || '-'}</td>
            <td class="small">${getStatusBadge(permit.status)}</td>
            <td class="small">
                <button class="btn btn-outline-primary btn-sm" onclick="viewPermitDetails('${permit._id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
    }

    return row;
}

// Fetch activity log
function fetchActivityLog() {
    allActivities = [
        `Pre-approved permit P-003 for Fire Safety Equipment Check`,
        `Reviewed permit P-002 for HVAC System Inspection`,
        `Permit P-001 submitted for electrical maintenance work`
    ];
    renderActivityLog(allActivities);
}

// Render activity log
function renderActivityLog(activities) {
    const log = document.getElementById('activityLog');
    if (!log) return;

    log.innerHTML = '';
    if (!activities.length) {
        log.innerHTML = '<div class="text-muted">No recent activity.</div>';
        return;
    }

    activities.forEach((activity, index) => {
        const timeAgo = index === 0 ? '2 hours ago' : index === 1 ? '1 day ago' : '2 days ago';
        log.innerHTML += `
            <div class="activity-item d-flex align-items-center mb-3">
                <div class="activity-icon bg-warning text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                    <i class="fas fa-user-check"></i>
                </div>
                <div class="activity-content">
                    <p class="mb-1">${activity}</p>
                    <small class="text-muted">${timeAgo}</small>
                </div>
            </div>
        `;
    });
}

// View permit details
function viewPermitDetails(permitId) {
    const permit = allPermits.find(p => p._id === permitId);
    if (!permit) return;

    currentPermitId = permitId;

    const modalContent = document.getElementById('permitDetailsContent');
    if (!modalContent) return;

    const submittedDate = permit.createdAt ? formatDate24(new Date(permit.createdAt)) : '-';
    const startDate = permit.workStartDateTime ? formatDate24(new Date(permit.workStartDateTime)) : '-';
    const endDate = permit.workEndDateTime ? formatDate24(new Date(permit.workEndDateTime)) : '-';

    modalContent.innerHTML = `
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold">Basic Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Permit ID:</strong></td><td>${permit._id}</td></tr>
                        <tr><td><strong>Title:</strong></td><td>${permit.permitTitle}</td></tr>
                        <tr><td><strong>Status:</strong></td><td><span class="badge bg-warning">${permit.status}</span></td></tr>
                        <tr><td><strong>Priority:</strong></td><td>${permit.priority || '-'}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold">Requester Information</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Name:</strong></td><td>${permit.requester?.username || '-'}</td></tr>
                        <tr><td><strong>Email:</strong></td><td>${permit.requester?.email || '-'}</td></tr>
                        <tr><td><strong>Submitted:</strong></td><td>${submittedDate}</td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6 class="fw-bold">Work Details</h6>
                    <table class="table table-sm">
                        <tr><td><strong>Description:</strong></td><td>${permit.description || '-'}</td></tr>
                        <tr><td><strong>Start Date:</strong></td><td>${startDate}</td></tr>
                        <tr><td><strong>End Date:</strong></td><td>${endDate}</td></tr>
                    </table>
                </div>
            </div>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('permitDetailsModal'));
    modal.show();
}

// Handle permit actions (pre-approve/reject)
function handlePermitAction(permitId, action) {
    currentPermitId = permitId;

    if (action === 'preapprove') {
        showApproveModal();
    } else if (action === 'reject') {
        showRejectModal();
    }
}

// Show approve modal
function showApproveModal() {
    const modal = new bootstrap.Modal(document.getElementById('approveModal'));
    modal.show();
}

// Show reject modal
function showRejectModal() {
    const modal = new bootstrap.Modal(document.getElementById('rejectModal'));
    modal.show();
}

// Pre-approve permit
async function preApprovePermit(permitId, comments) {
    try {
        const res = await fetch(`${API_BASE}/preapprover/approve/${permitId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ comments })
        });

        if (!res.ok) {
            throw new Error('Failed to pre-approve permit');
        }

        const result = await res.json();

        // Update local data
        const permitIndex = allPermits.findIndex(p => p._id === permitId);
        if (permitIndex !== -1) {
            allPermits[permitIndex] = {
                ...allPermits[permitIndex],
                status: 'In Progress',
                preApprovedBy: currentUser?.id || 'current-user',
                preApprovedAt: new Date(),
                preApproverComments: comments
            };
        }

        // Refresh tables
        updatePermitTables();
        updateStats(allPermits);

        // Show success message
        showNotification('Permit pre-approved successfully', 'success');

    } catch (error) {
        console.error('Error pre-approving permit:', error);
        showNotification('Error pre-approving permit', 'error');
    }
}

// Reject permit
async function rejectPermit(permitId, reason) {
    try {
        const res = await fetch(`${API_BASE}/preapprover/reject/${permitId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason })
        });

        if (!res.ok) {
            throw new Error('Failed to reject permit');
        }

        const result = await res.json();

        // Update local data
        const permitIndex = allPermits.findIndex(p => p._id === permitId);
        if (permitIndex !== -1) {
            allPermits[permitIndex] = {
                ...allPermits[permitIndex],
                status: 'Rejected',
                preApprovedBy: currentUser?.id || 'current-user',
                preApprovedAt: new Date(),
                preApproverComments: reason
            };
        }

        // Refresh tables
        updatePermitTables();
        updateStats(allPermits);

        // Show success message
        showNotification('Permit rejected successfully', 'success');

    } catch (error) {
        console.error('Error rejecting permit:', error);
        showNotification('Error rejecting permit', 'error');
    }
}

// Show notification
function showNotification(message, type) {
    // Create toast notification
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();

    // Remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1055';
    document.body.appendChild(container);
    return container;
}

// Profile management functions
function showUpdateProfileModal() {
    if (currentUser) {
        document.getElementById('profileUsername').value = currentUser.username || '';
        document.getElementById('profileEmailInput').value = currentUser.email || '';
        document.getElementById('profilePhoneInput').value = currentUser.phone || '';
    }

    const modal = new bootstrap.Modal(document.getElementById('profileModal'));
    modal.show();
}

function showUpdatePasswordModal() {
    const modal = new bootstrap.Modal(document.getElementById('passwordModal'));
    modal.show();
}

async function updateProfile() {
    const username = document.getElementById('profileUsername').value;
    const email = document.getElementById('profileEmailInput').value;
    const phone = document.getElementById('profilePhoneInput').value;

    try {
        const res = await fetch(`${API_BASE}/api/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, phone })
        });

        if (!res.ok) throw new Error('Failed to update profile');

        const result = await res.json();

        // Update current user data
        if (currentUser) {
            currentUser.username = username;
            currentUser.email = email;
            currentUser.phone = phone;
            updateUserInterface();
        }

        showNotification('Profile updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();

    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'error');
    }
}

async function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/update-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!res.ok) throw new Error('Failed to update password');

        showNotification('Password updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('passwordModal')).hide();

        // Clear form
        document.getElementById('passwordForm').reset();

    } catch (error) {
        console.error('Error updating password:', error);
        showNotification('Error updating password', 'error');
    }
}

// Update user interface with current user data
function updateUserInterface() {
    if (currentUser) {
        // Update profile section
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profilePhone = document.getElementById('profilePhone');
        const profileInitials = document.getElementById('profileInitials');
        const headerUsername = document.getElementById('headerUsername');
        const dropdownUsername = document.getElementById('dropdownUsername');
        const dropdownEmail = document.getElementById('dropdownEmail');

        if (profileName) profileName.textContent = currentUser.username || 'Pre-Approver';
        if (profileEmail) profileEmail.textContent = currentUser.email || 'preapprover@hia.gov.ae';
        if (profilePhone) profilePhone.textContent = currentUser.phone || '+971 50 123 4567';
        if (headerUsername) headerUsername.textContent = currentUser.username || 'Pre-Approver';
        if (dropdownUsername) dropdownUsername.textContent = currentUser.username || 'Pre-Approver';
        if (dropdownEmail) dropdownEmail.textContent = currentUser.email || 'preapprover@example.com';

        if (profileInitials) {
            const initials = (currentUser.username || 'Pre Approver').split(' ').map(n => n[0]).join('').toUpperCase();
            profileInitials.textContent = initials;
        }

        // Update last login
        const lastLogin = document.getElementById('lastLogin');
        if (lastLogin && currentUser.lastLogin) {
            lastLogin.textContent = `Last Login: ${formatDate24(new Date(currentUser.lastLogin))}`;
        }
    }
}

// Logout confirmation
function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser();
    }
}

// Export functions
function exportToCSV() {
    const permits = allPermits.filter(p => (p.status || '').toLowerCase() === 'pending');
    if (permits.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    const headers = ['Permit ID', 'Title', 'Requester', 'Submitted Date', 'Priority', 'Status'];
    const csvContent = [
        headers.join(','),
        ...permits.map(p => [
            p._id,
            `"${p.permitTitle}"`,
            p.requester?.username || '',
            p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
            p.priority || '',
            p.status || ''
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preapprover-permits-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportToExcel() {
    const permits = allPermits.filter(p => (p.status || '').toLowerCase() === 'pending');
    if (permits.length === 0) {
        showNotification('No data to export', 'error');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(permits.map(p => ({
        'Permit ID': p._id,
        'Title': p.permitTitle,
        'Requester': p.requester?.username || '',
        'Submitted Date': p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
        'Priority': p.priority || '',
        'Status': p.status || ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Permits');
    XLSX.writeFile(workbook, `preapprover-permits-${new Date().toISOString().split('T')[0]}.xlsx`);
}

function printTable() {
    const table = document.getElementById('pendingPermitsTable');
    if (!table) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Pre-Approver Permits</title>
            <style>
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h2>Pre-Approver Permits - ${new Date().toLocaleDateString()}</h2>
            ${table.outerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filteredPermits = allPermits.filter(p =>
                (p.permitTitle || '').toLowerCase().includes(query) ||
                (p.requester?.username || '').toLowerCase().includes(query) ||
                (p._id || '').toLowerCase().includes(query)
            );

            // Update tables with filtered data
            const pendingFiltered = filteredPermits.filter(p => (p.status || '').toLowerCase() === 'pending');
            updateTableBody('pendingPermitsTable', pendingFiltered, 'pending');
        });
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Check session and get user data
        const sessionData = await checkSession();
        if (sessionData && sessionData.user) {
            currentUser = sessionData.user;
            updateUserInterface();
        }

        // Initialize idle timer
        initIdleTimer();

        // Fetch initial data
        await fetchPermits();
        fetchActivityLog();

        // Set up search
        setupSearch();

        // Initialize sidebar
        initializeSidebar();

        // Set up modal event handlers
        setupModalHandlers();

    } catch (error) {
        console.error('Failed to initialize dashboard:', error);

        // For development: Don't redirect if backend is down
        console.log('Backend server may be down - continuing with offline mode');

        // Still initialize sidebar and basic functionality
        try {
            initializeSidebar();
            setupModalHandlers();

            // Show a notification that backend is offline
            const offlineMsg = document.createElement('div');
            offlineMsg.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 9999;
                background: orange; color: white; padding: 10px; border-radius: 5px;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px;
            `;
            offlineMsg.textContent = 'Backend server offline - limited functionality';
            document.body.appendChild(offlineMsg);

            setTimeout(() => offlineMsg.remove(), 5000);
        } catch (e) {
            console.error('Error initializing offline mode:', e);
        }
    }
}

// Setup modal event handlers
function setupModalHandlers() {
    // Approve modal confirm button
    const confirmApprove = document.getElementById('confirmApprove');
    if (confirmApprove) {
        confirmApprove.addEventListener('click', () => {
            const comments = document.getElementById('approveComments').value;
            if (currentPermitId) {
                preApprovePermit(currentPermitId, comments);
                bootstrap.Modal.getInstance(document.getElementById('approveModal')).hide();
                document.getElementById('approveComments').value = '';
            }
        });
    }

    // Reject modal confirm button
    const confirmReject = document.getElementById('confirmReject');
    if (confirmReject) {
        confirmReject.addEventListener('click', () => {
            const reason = document.getElementById('rejectReason').value;
            if (reason.trim() && currentPermitId) {
                rejectPermit(currentPermitId, reason);
                bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
                document.getElementById('rejectReason').value = '';
            } else {
                showNotification('Please provide a reason for rejection', 'error');
            }
        });
    }
}

// Make functions globally available
window.viewPermitDetails = viewPermitDetails;
window.handlePermitAction = handlePermitAction;
window.showApproveModal = showApproveModal;
window.showRejectModal = showRejectModal;
window.showUpdateProfileModal = showUpdateProfileModal;
window.showUpdatePasswordModal = showUpdatePasswordModal;
window.updateProfile = updateProfile;
window.updatePassword = updatePassword;
window.confirmLogout = confirmLogout;
window.exportToCSV = exportToCSV;
window.exportToExcel = exportToExcel;
window.printTable = printTable;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

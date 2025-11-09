// Initialize admin page after shared layout is mounted.
// admin-specific behaviors when the layout is available.
function initAdmin() {
    try {
        if (typeof checkSession === 'function') checkSession();
        if (typeof initIdleTimer === 'function') initIdleTimer();
    } catch (err) {
        console.warn('session/initIdleTimer error', err);
    }

    // Defer loading of page data — loadUsers and loadRolesIntoSelect are
    // declared later in this file (function declarations are hoisted).
    try { if (typeof loadUsers === 'function') loadUsers(); } catch (e) { console.warn('loadUsers failed', e); }
    try { if (typeof loadRolesIntoSelect === 'function') loadRolesIntoSelect(); } catch (e) { console.warn('loadRolesIntoSelect failed', e); }
    try { if (typeof setupAnnouncementHandlers === 'function') setupAnnouncementHandlers(); } catch (e) { console.warn('setupAnnouncementHandlers failed', e); }
}

// Ensure cards start collapsed when their content is hidden (runs once)
(function applyInitialCollapsedState() {
    try {
        document.querySelectorAll('[data-action="toggleSection"]').forEach(btn => {
            try {
                const section = btn.dataset.section;
                const card = btn.closest('.section-card');
                const content = document.getElementById(`${section}Content`);
                if (card) card.classList.toggle('collapsed', !!(content && content.classList.contains('hidden')));
            } catch (e) { /* ignore per-item */ }
        });
    } catch (e) { /* ignore */ }
})();

if (document.querySelector('[data-layout-wrapper]')) {
    // Layout already present (maybe pre-mounted) — run on next frame.
    window.requestAnimationFrame(initAdmin);
} else {
    // Wait for the shared layout to be injected by layout.mount.js
    window.addEventListener('layout:mounted', initAdmin, { once: true });
}
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
    // Prefer shared global toast if available (signature: showToast(type, message, opts))
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        try {
            window.showToast(type, message, { timeout: duration });
            return;
        } catch (e) {
            // fall through to local fallback
            console.warn('shared showToast failed, falling back', e);
        }
    }

    // Local fallback (simple inline element)
    // Create a lightweight toast container and element similar to shared/toast.js
    const ensureContainer = () => {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            c.setAttribute('aria-live', 'polite');
            Object.assign(c.style, {
                position: 'fixed', top: '16px', right: '16px', zIndex: '9999', display: 'flex',
                flexDirection: 'column', gap: '8px', pointerEvents: 'none'
            });
            document.body.appendChild(c);
        }
        return c;
    };

    const container = ensureContainer();
    // remove existing toasts
    Array.from(container.querySelectorAll('.toast')).forEach(el => { try { el.remove(); } catch (_) { } });

    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    Object.assign(t.style, {
        padding: '12px 14px', borderRadius: '10px', boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto', minWidth: '220px',
        maxWidth: '420px', opacity: '0', transition: 'opacity 160ms ease, transform 200ms cubic-bezier(.2,.9,.2,1)', transform: 'translateY(-6px)'
    });
    t.innerHTML = `
        <div style="flex:0 0 auto; font-size:18px;line-height:1">${type === 'success' ? '<i class="fas fa-check-circle"></i>' : (type === 'info' ? '<i class="fas fa-info-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>')}</div>
        <div style="flex:1 1 auto; font-size:14px; line-height:1.2">${String(message)}</div>
        <button style="flex:0 0 auto; background:transparent; border:none; color:inherit; font-size:18px; cursor:pointer;" class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    const closeBtn = t.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => { try { t.remove(); } catch (_) { } });
    container.insertBefore(t, container.firstChild);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    const timeout = duration || (type === 'success' ? 2200 : 4800);
    let to = setTimeout(() => { try { t.remove(); } catch (_) { } }, timeout);
    t.addEventListener('mouseenter', () => { if (to) { clearTimeout(to); to = null; } });
    t.addEventListener('mouseleave', () => { if (!to) { to = setTimeout(() => { try { t.remove(); } catch (_) { } }, 1600); } });
}

/* ===== Shared confirmation modal helper =====
   Uses the existing `publish-confirm-modal` element (shared in layout)
   to show a title/message and optional input. Returns a Promise that
   resolves to an object: { confirmed: boolean, value?: string }
*/
function showConfirmModal({ title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', input = null } = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('publish-confirm-modal');
        if (!modal) {
            // No shared modal available — do not use native confirm; resolve as not confirmed
            return resolve({ confirmed: false });
        }

        const titleEl = modal.querySelector('#publish-confirm-title');
        const msgEl = modal.querySelector('#publish-confirm-message');
        const confirmBtn = modal.querySelector('#publishConfirmBtn');
        const cancelBtn = modal.querySelector('#publishCancelBtn');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) {
            msgEl.textContent = '';
            if (message) msgEl.appendChild(document.createTextNode(message));
        }

        // If an input is requested, insert it into the message area
        let inputEl = null;
        if (input && msgEl) {
            inputEl = document.createElement('input');
            inputEl.type = input.type || 'text';
            inputEl.placeholder = input.placeholder || '';
            inputEl.className = 'mt-2 w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-[var(--text-primary)]';
            msgEl.appendChild(document.createElement('br'));
            msgEl.appendChild(inputEl);
            // focus on next frame
            setTimeout(() => { try { inputEl.focus(); } catch (_) { } }, 50);
        }

        if (confirmBtn) confirmBtn.textContent = confirmText;
        if (cancelBtn) cancelBtn.textContent = cancelText;

        const cleanup = () => {
            modal.classList.add('hidden');
            // remove any input we added
            if (inputEl && inputEl.parentNode) {
                try { inputEl.parentNode.removeChild(inputEl); } catch (_) { }
            }
        };

        const onConfirm = () => {
            cleanup();
            resolve({ confirmed: true, value: inputEl ? inputEl.value : undefined });
        };

        const onCancel = () => {
            cleanup();
            resolve({ confirmed: false });
        };

        // Attach handlers once
        if (confirmBtn) confirmBtn.addEventListener('click', onConfirm, { once: true });
        if (cancelBtn) cancelBtn.addEventListener('click', onCancel, { once: true });

        // show modal
        modal.classList.remove('hidden');
    });
}

/* ===== Announcements (Admin UI) ===== */
async function fetchAdminAnnouncements() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/system-messages`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json();
    } catch (err) {
        console.warn('fetchAdminAnnouncements failed', err);
        return [];
    }
}

// Translation removed — no client-side translateText function anymore

function debounce(fn, wait = 300) {
    let t = null;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Detect presence of strong RTL characters (Arabic, Hebrew ranges)
function containsRTL(s) {
    if (!s) return false;
    return /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(String(s));
}

function renderAnnouncementList(items = []) {
    const list = document.getElementById('announcementList');
    if (!list) return;
    list.innerHTML = '';
    if (!items || items.length === 0) {
        list.innerHTML = '<div class="text-sm text-[var(--text-secondary)]">No announcements yet.</div>';
        return;
    }
    items.forEach(it => {
        const el = document.createElement('div');
        el.className = 'p-3 border rounded hover-lite';
        const defaultMsg = (it.message || '').slice(0, 240);
        el.innerHTML = `
            <div>
                <div class="text-sm font-semibold">${(it.title || '').slice(0, 80)}</div>
                <div class="text-sm text-[var(--text-secondary)] whitespace-pre-line">${defaultMsg}</div>
                <div class="mt-2 flex items-center gap-2">
                    <button data-action="edit" data-id="${it.id}" class="text-xs text-[var(--link-color)]">Edit</button>
                    <button data-action="delete" data-id="${it.id}" class="text-xs text-red-600">Delete</button>
                    <button data-action="toggle" data-id="${it.id}" class="text-xs">${it.isActive ? 'Unpublish' : 'Publish'}</button>
                    <span class="ml-auto text-xs text-[var(--text-secondary)]">${new Date(it.updatedAt || it.createdAt).toLocaleString()}</span>
                </div>
            </div>
        `;
        list.appendChild(el);
    });
}

function openAnnouncementModal(data = null) {
    const modal = document.getElementById('announcement-modal');
    if (!modal) return;
    const id = document.getElementById('announcement_id');
    const title = document.getElementById('announcement_title');
    const editor = document.getElementById('announcement_editor');
    const hiddenMsg = document.getElementById('announcement_message');
    const active = document.getElementById('announcement_active');

    if (data) {
        id.value = data.id || '';
        title.value = data.title || '';
        if (editor) editor.innerHTML = data.message || '';
        if (hiddenMsg) hiddenMsg.value = data.message || '';
        // icons removed from modal; ignore any existing icon field
        active.checked = !!data.isActive;
    } else {
        id.value = '';
        title.value = '';
        if (editor) editor.innerHTML = '';
        if (hiddenMsg) hiddenMsg.value = '';
        // icons removed
        active.checked = true;
    }
    modal.classList.remove('hidden');

    // Setup editor live translation and icon select
    try {
        // Ensure handlers are wired and apply language orientation for existing data
        setupAnnouncementHandlers();
        // If we have a language stored on the message use it, otherwise detect from content
        try {
            const langSel = document.getElementById('announcement_lang');
            const titleEl = document.getElementById('announcement_title');
            const editorEl = document.getElementById('announcement_editor');
            if (langSel) {
                if (data && data.lang) {
                    langSel.value = data.lang;
                } else {
                    // infer from content
                    const sample = (data && (data.message || data.title)) || '';
                    langSel.value = containsRTL(sample) ? 'ar' : 'en';
                }
                // apply orientation
                const applyLang = (l) => {
                    const isAr = String(l) === 'ar';
                    const dir = isAr ? 'rtl' : 'ltr';
                    if (titleEl) { titleEl.dir = dir; titleEl.style.textAlign = isAr ? 'right' : 'left'; }
                    if (editorEl) { editorEl.dir = dir; editorEl.style.textAlign = isAr ? 'right' : 'left'; }
                    const hidden = document.getElementById('announcement_message'); if (hidden) hidden.dir = dir;
                };
                applyLang(langSel.value);
            }
        } catch (e) { /* ignore */ }
    } catch (e) { console.debug('setupAnnouncementHandlers', e); }
}

function closeAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}

async function saveAnnouncement() {
    const id = document.getElementById('announcement_id').value;
    const title = document.getElementById('announcement_title').value.trim();
    const message = (document.getElementById('announcement_editor')?.innerHTML || document.getElementById('announcement_message')?.value || '').trim();
    // keep hidden textarea in sync (for progressive enhancement)
    const hiddenMsgEl = document.getElementById('announcement_message');
    if (hiddenMsgEl) hiddenMsgEl.value = message;
    const isActive = document.getElementById('announcement_active').checked;
    const lang = document.getElementById('announcement_lang') ? document.getElementById('announcement_lang').value : 'en';
    const start = document.getElementById('announcement_start') ? document.getElementById('announcement_start').value.trim() : '';
    const end = document.getElementById('announcement_end') ? document.getElementById('announcement_end').value.trim() : '';

    // Normalize message: strip HTML and check visible text to avoid saving empty content like <br> or &nbsp;
    const getPlainTextFromHtml = (html) => {
        try {
            const tmp = document.createElement('div');
            tmp.innerHTML = html || '';
            return (tmp.textContent || tmp.innerText || '').replace(/\u00A0/g, '');
        } catch (e) { return String(html || '').replace(/<[^>]*>/g, ''); }
    };
    const plainMessage = getPlainTextFromHtml(message).trim();
    if (!plainMessage) { showToast('Message is required', 'error'); return; }

    // Date validation: ensure start/end (if provided) are future dates and end >= start
    const parseLocalDateTime = (s) => {
        if (!s) return null;
        // convert 'YYYY-MM-DD HH:mm' to 'YYYY-MM-DDTHH:mm' for reliable parsing
        const iso = s.replace(' ', 'T');
        const d = new Date(iso);
        return isNaN(d.getTime()) ? null : d;
    };

    const now = new Date();
    if (start) {
        const sd = parseLocalDateTime(start);
        if (!sd) { showToast('Start date format is invalid', 'error'); return; }
        if (sd <= now) { showToast('Start date must be in the future', 'error'); return; }
    }
    if (end) {
        const ed = parseLocalDateTime(end);
        if (!ed) { showToast('End date format is invalid', 'error'); return; }
        if (ed <= now) { showToast('End date must be in the future', 'error'); return; }
        if (start) {
            const sd = parseLocalDateTime(start);
            if (sd && ed < sd) { showToast('End date must be the same as or after start date', 'error'); return; }
        }
    }

    try {
        const payload = {
            title,
            message,
            isActive,
            lang
        };
        if (start) payload.startAt = start;
        if (end) payload.endAt = end;

        if (id) {
            const res = await fetch(`${API_BASE}/api/system-message/${id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Update failed');
            showToast('Announcement updated', 'success');
        } else {
            const res = await fetch(`${API_BASE}/api/system-message`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Create failed');
            showToast('Announcement created', 'success');
        }
        // refresh list
        await loadAnnouncementsIntoModal();
        closeAnnouncementModal();
    } catch (err) {
        console.error('saveAnnouncement error', err);
        showToast('Failed to save announcement', 'error');
    }
}

async function deleteAnnouncement(id) {
    // confirmation should be handled by the caller (UI delegate) via modal.
    // If called directly, show the shared confirm modal as a fallback.
    const resp = await showConfirmModal({ title: 'Confirm delete', message: 'Delete this announcement? This action cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!resp || !resp.confirmed) return;
    try {
        const res = await fetch(`${API_BASE}/api/system-message/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('Announcement deleted', 'success');
        await loadAnnouncementsIntoModal();
    } catch (err) {
        console.error('deleteAnnouncement error', err);
        showToast('Failed to delete announcement', 'error');
    }
}

async function toggleAnnouncement(id, publish) {
    try {
        const res = await fetch(`${API_BASE}/api/system-message/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: publish })
        });
        if (!res.ok) throw new Error('Toggle failed');
        showToast(publish ? 'Announcement published' : 'Announcement unpublished', 'success');
        await loadAnnouncementsIntoModal();
    } catch (err) {
        console.error('toggleAnnouncement error', err);
        showToast('Failed to update status', 'error');
    }
}

async function loadAnnouncementsIntoModal() {
    const items = await fetchAdminAnnouncements();
    renderAnnouncementList(items);
}

function setupAnnouncementHandlers() {
    // navbar button
    const btn = document.getElementById('announcement-button');
    if (btn) btn.addEventListener('click', async (e) => {
        // Admin page will open modal; non-admins will get 403 from API if they try to save
        await loadAnnouncementsIntoModal();
        openAnnouncementModal(null);
    });

    // modal close
    const closeBtn = document.getElementById('announcementModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeAnnouncementModal);

    // new button
    const newBtn = document.getElementById('announcementNewBtn');
    if (newBtn) newBtn.addEventListener('click', () => openAnnouncementModal(null));

    // save
    const saveBtn = document.getElementById('announcementSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveAnnouncement);

    // language select: set orientation of title/editor based on selected language
    try {
        const langSel = document.getElementById('announcement_lang');
        const titleEl = document.getElementById('announcement_title');
        const editorEl = document.getElementById('announcement_editor');
        const hidden = document.getElementById('announcement_message');
        if (langSel) {
            const applyLang = (l) => {
                const isAr = String(l) === 'ar';
                const dir = isAr ? 'rtl' : 'ltr';
                if (titleEl) { titleEl.dir = dir; titleEl.style.textAlign = isAr ? 'right' : 'left'; }
                if (editorEl) { editorEl.dir = dir; editorEl.style.textAlign = isAr ? 'right' : 'left'; }
                if (hidden) hidden.dir = dir;
            };
            langSel.addEventListener('change', (ev) => { try { applyLang(langSel.value); } catch (_) { } });
            // apply initial value
            applyLang(langSel.value);
        }
    } catch (e) { /* ignore */ }

    // rich-text toolbar
    try {
        const toolbar = document.getElementById('announcement_toolbar');
        const editor = document.getElementById('announcement_editor');
        if (toolbar && editor) {
            toolbar.addEventListener('click', (ev) => {
                const btn = ev.target.closest('button[data-cmd]');
                if (!btn) return;
                const cmd = btn.getAttribute('data-cmd');
                try { document.execCommand(cmd); } catch (e) { /* ignore */ }
                editor.focus();
            });
        }
    } catch (e) { /* ignore */ }

    // initialize flatpickr for schedule inputs if available
    try {
        if (window.flatpickr) {
            const s = document.getElementById('announcement_start');
            const e = document.getElementById('announcement_end');
            // Use minDate:'today' to prevent selecting past dates and use dropdown
            // month selector for a consistent UX. Flatpickr will render month/year
            // controls which we theme via CSS.
            if (s && !s._flatpickr) flatpickr(s, { enableTime: true, dateFormat: 'Y-m-d H:i', minDate: 'today', monthSelectorType: 'dropdown' });
            if (e && !e._flatpickr) flatpickr(e, { enableTime: true, dateFormat: 'Y-m-d H:i', minDate: 'today', monthSelectorType: 'dropdown' });
        }
    } catch (e) { /* ignore */ }

    // Icon select and live translation wiring
    try {
        // icons removed from modal; skip icon select wiring

        // Translation removed — no live translation wiring
    } catch (e) { /* ignore */ }

    // delegate list actions
    const list = document.getElementById('announcementList');
    if (list) {
        let pendingPublish = null;

        list.addEventListener('click', (ev) => {
            const a = ev.target.closest('button[data-action]');
            if (!a) return;
            const action = a.getAttribute('data-action');
            const id = a.getAttribute('data-id');
            if (action === 'edit') {
                // find item data from DOM by id via list of announcements
                (async () => {
                    try {
                        const items = await fetchAdminAnnouncements();
                        const it = items.find(x => String(x.id) === String(id));
                        if (it) openAnnouncementModal(it);
                    } catch (e) { console.warn(e); }
                })();
            } else if (action === 'delete') {
                // Use shared confirmation modal if available for a consistent UX
                (async () => {
                    const confirmModal = document.getElementById('publish-confirm-modal');
                    if (confirmModal) {
                        const titleEl = confirmModal.querySelector('#publish-confirm-title');
                        const msg = confirmModal.querySelector('#publish-confirm-message');
                        const confirmBtn = confirmModal.querySelector('#publishConfirmBtn');
                        const cancelBtn = confirmModal.querySelector('#publishCancelBtn');
                        if (titleEl) titleEl.textContent = 'Confirm delete';
                        if (msg) msg.textContent = 'Delete this announcement? This action cannot be undone.';
                        confirmModal.classList.remove('hidden');
                        const onConfirm = async () => {
                            confirmModal.classList.add('hidden');
                            try { await deleteAnnouncement(id); } catch (e) { console.error(e); }
                        };
                        const onCancel = () => { confirmModal.classList.add('hidden'); };
                        if (confirmBtn) confirmBtn.addEventListener('click', onConfirm, { once: true });
                        if (cancelBtn) cancelBtn.addEventListener('click', onCancel, { once: true });
                    } else {
                        // fallback to simple confirm
                        deleteAnnouncement(id);
                    }
                })();
            } else if (action === 'toggle') {
                (async () => {
                    const items = await fetchAdminAnnouncements();
                    const it = items.find(x => String(x.id) === String(id));
                    if (!it) return;
                    const publish = !it.isActive;
                    pendingPublish = { id, publish };

                    // Resolve modal elements fresh at click time (shared layout may be mounted later)
                    const publishModal = document.getElementById('publish-confirm-modal');
                    if (publishModal) {
                        const msg = publishModal.querySelector('#publish-confirm-message');
                        if (msg) msg.textContent = publish ? 'Publish this announcement and make it visible on the login carousel?' : 'Unpublish this announcement and hide it from the login carousel?';
                        // show modal
                        publishModal.classList.remove('hidden');

                        const confirmBtn = publishModal.querySelector('#publishConfirmBtn');
                        const cancelBtn = publishModal.querySelector('#publishCancelBtn');

                        const cleanup = () => { pendingPublish = null; };

                        if (confirmBtn) {
                            const onConfirm = async () => {
                                publishModal.classList.add('hidden');
                                try { await toggleAnnouncement(id, publish); } catch (e) { console.error(e); }
                                cleanup();
                            };
                            confirmBtn.addEventListener('click', onConfirm, { once: true });
                        }
                        if (cancelBtn) {
                            const onCancel = () => { publishModal.classList.add('hidden'); cleanup(); };
                            cancelBtn.addEventListener('click', onCancel, { once: true });
                        }
                    } else {
                        // fallback: act immediately
                        await toggleAnnouncement(id, publish);
                        pendingPublish = null;
                    }
                })();
            }
        });
    }
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
        // Attach per-tab Authorization header if we have an access token so this tab remains authenticated even if the browser session cookie is replaced by another tab.
        const reqHeaders = {};
        try {
            const at = sessionStorage.getItem('accessToken');
            if (at) reqHeaders['Authorization'] = `Bearer ${at}`;
        } catch (_) { }
        let res = await fetch(`${API_BASE}/admin/users`, { credentials: "include", headers: reqHeaders });

        if (res && (res.status === 401 || res.status === 403)) {
            try {

                if (typeof window.ptwRefreshToken === 'function') {
                    const ok = await window.ptwRefreshToken();
                    if (ok) {
                        try {
                            const at = sessionStorage.getItem('accessToken');
                            if (at) reqHeaders['Authorization'] = `Bearer ${at}`;
                        } catch (_) { }
                        res = await fetch(`${API_BASE}/admin/users`, { credentials: 'include', headers: reqHeaders });
                    }
                }
            } catch (_) { /* ignore refresh errors */ }
        }

        if (!res.ok) {
            // Handle 403 (not authorized) with a friendly inline message
            if (res.status === 403) {
                showSkeleton('usersTable', false);
                const tr = document.createElement("tr");
                tr.innerHTML = `<td colspan="${thead.querySelectorAll('th').length}">
                    <div class="py-6 text-center text-sm text-[var(--text-secondary)]">
                      You must be signed in as an administrator to view this data. 
                      <a href="/login/index.html" class="text-[var(--link-color)] underline">Sign in</a>
                    </div>
                  </td>`;
                tbody.appendChild(tr);
                return;
            }
            throw new Error("Failed to load users");
        }
        const users = await res.json();
        // store into cache for faster single-user loads
        usersCache = Array.isArray(users) ? users : [];

        showSkeleton('usersTable', false);
        users.forEach((u) => {
            const tr = document.createElement("tr");
            tr.classList.add("border-b", "border-[var(--input-border)]");
            headers.forEach((h) => {
                const td = document.createElement("td");
                td.classList.add("border", "border-[var(--input-border)]", "px-4", "py-2");
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
                            <button class="btn btn-sm btn-outline reset" data-id="${idAttr}" title="Reset password">Reset</button>
                            <button class="btn btn-sm btn-primary view" data-id="${idAttr}" title="View profile">View</button>
                            <button class="btn btn-sm btn-warning toggle" data-id="${idAttr}" data-status="${u.status || ""}" title="${u.status === "Active" ? "Disable" : "Enable"}">
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
        showToast("Failed to load users", "error");
    }
}

/* ===== Live polling for users (secure, uses global fetch wrapper) =====
   Polls `/admin/users` periodically and triggers a UI refresh when the
   dataset changes. Uses the existing fetch override which attaches
   Authorization from sessionStorage and performs silent refreshes.
*/
let __liveUsersPollingId = null;
function startLiveUsersPolling(intervalMs = 30000) {
    try {
        if (__liveUsersPollingId) return; // already running
        __liveUsersPollingId = setInterval(async () => {
            try {
                // light-weight fetch to check for changes
                const res = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
                if (!res || !res.ok) return;
                const data = await res.json().catch(() => []);
                const arr = Array.isArray(data) ? data : [];
                // quick change detection: length or id mismatch
                const old = Array.isArray(usersCache) ? usersCache : [];
                let changed = false;
                if (arr.length !== old.length) changed = true;
                else {
                    for (let i = 0; i < arr.length; i++) {
                        const aId = String(arr[i]?.id || arr[i]?._id || '');
                        const oId = String(old[i]?.id || old[i]?._id || '');
                        if (aId !== oId) { changed = true; break; }
                    }
                }
                if (changed) {
                    // update cache and re-render (use existing rendering path)
                    usersCache = arr;
                    try { await loadUsers(); } catch (_) { /* best-effort */ }
                }
            } catch (e) {
                // non-fatal; just log in debug
                try { console.debug('[live-users] poll error', e); } catch (_) { }
            }
        }, Number(intervalMs) || 30000);
    } catch (e) { console.debug('[live-users] start failed', e); }
}

function stopLiveUsersPolling() {
    try {
        if (!__liveUsersPollingId) return;
        clearInterval(__liveUsersPollingId);
        __liveUsersPollingId = null;
    } catch (e) { console.debug('[live-users] stop failed', e); }
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
        // Prefer per-tab access token if available to avoid cookie clobbering across tabs.
        const pHeaders = {};
        try {
            const at = sessionStorage.getItem('accessToken');
            if (at) pHeaders['Authorization'] = `Bearer ${at}`;
        } catch (_) { }
        let res = await fetch(`${API_BASE}/api/permits`, { credentials: "include", headers: pHeaders });
        if (res && (res.status === 401 || res.status === 403)) {
            try {
                if (typeof window.ptwRefreshToken === 'function') {
                    const ok = await window.ptwRefreshToken();
                    if (ok) {
                        try {
                            const at = sessionStorage.getItem('accessToken');
                            if (at) pHeaders['Authorization'] = `Bearer ${at}`;
                        } catch (_) { }
                        res = await fetch(`${API_BASE}/api/permits`, { credentials: 'include', headers: pHeaders });
                    }
                }
            } catch (_) { }
        }

        if (!res.ok) {
            if (res.status === 403) {
                showSkeleton('permitsTable', false);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="${thead.querySelectorAll('th').length}">
                    <div class="py-6 text-center text-sm text-[var(--text-secondary)]">
                      You must be signed in to view permits. <a href="/login/index.html" class="text-[var(--link-color)] underline">Sign in</a>
                    </div>
                  </td>`;
                tbody.appendChild(tr);
                return;
            }
            throw new Error("Failed to load permits");
        }
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
                    td.classList.add('border', 'border-[var(--input-border)]', 'px-4', 'py-2');
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
                            td.innerHTML = `<button class="btn btn-sm btn-primary view" data-id="${p.id || p._id}" title="View permit">View</button>`;
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
                const roleColorsUpdate = [theme.primary, theme.inprogress || '#7c3aed', theme.success, theme.muted || '#f97373'];
                ur.data.datasets[0].backgroundColor = roleColorsUpdate;
                ur.data.datasets[0].borderColor = roleColorsUpdate;
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

        // userTypeChart removed — nothing to update
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
                    maintainAspectRatio: false,
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
                    maintainAspectRatio: false,
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
            // Use a multi-color palette for each role so bars are visually distinct
            const roleColors = [theme.primary, theme.inprogress || '#7c3aed', theme.success, theme.muted || '#f97373'];
            charts.userRoleChart = new ChartCtor2(userRoleCanvas, {
                type: "bar",
                data: {
                    labels: ["Admin", "Approver", "Pre‑Approver", "Requester"],
                    datasets: [
                        {
                            label: "Users",
                            data: [roleCounts.Admin, roleCounts.Approver, roleCounts.PreApprover, roleCounts.Requester],
                            backgroundColor: roleColors,
                            borderColor: roleColors,
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: theme.text } },
                        y: { ticks: { color: theme.text } },
                    },
                },
            });
        }

        // userTypeChart removed from UI; no initialization
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
        // Update chevron icon inside the button (make behavior match profile.toggleSection)
        try {
            const icon = btn.querySelector('i') || btn.querySelector('.chevron-icon');
            if (icon) {
                icon.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
                if (isOpening) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                    icon.style.transform = 'rotate(0deg)';
                }
            }
        } catch (e) { console.debug('toggleDetails icon update failed', e); }
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
// Initialize any existing .expandBtn icons to reflect current aria-expanded state
(function initExpandBtns() {
    try {
        const btns = document.querySelectorAll('.expandBtn');
        btns.forEach(btn => {
            try {
                const icon = btn.querySelector('i') || btn.querySelector('.chevron-icon');
                if (!icon) return;
                icon.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
                const expanded = btn.getAttribute('aria-expanded') === 'true' || btn.classList.contains('active');
                // Sync icon
                if (expanded) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                    icon.style.transform = 'rotate(180deg)';
                    btn.classList.add('active');
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                    icon.style.transform = 'rotate(0deg)';
                    btn.classList.remove('active');
                }

                // If the button declares a target panel, ensure the panel's maxHeight/opacity reflect the state
                try {
                    const target = btn.dataset && btn.dataset.target;
                    if (target) {
                        const panel = document.getElementById(target);
                        if (panel) {
                            if (expanded) {
                                panel.classList.add('open');
                                panel.style.opacity = '1';
                                // set explicit maxHeight so the transition can run and the panel remains open
                                panel.style.maxHeight = panel.scrollHeight ? `${panel.scrollHeight}px` : 'none';
                            } else {
                                panel.style.maxHeight = '0px';
                                panel.style.opacity = '0';
                                panel.classList.remove('open');
                            }
                        }
                    }
                } catch (e) { /* ignore */ }
            } catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
})();
window.toggleDetails = toggleDetails;

// Delegated toggleSection handler (profile-style)
document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action="toggleSection"]');
    if (!btn) return;
    e.preventDefault();
    const section = btn.dataset.section;
    if (section) toggleSection(section);
});

function toggleSection(sectionId) {
    try {
        const content = document.getElementById(`${sectionId}Content`);
        const icon = document.getElementById(`${sectionId}Icon`);
        if (!content) return;

        const isCollapsed = content.classList.contains('hidden') || getComputedStyle(content).display === 'none' || content.style.maxHeight === '0px';

        // Update aria-expanded on the control (if any)
        const controller = document.querySelector(`[data-action="toggleSection"][data-section="${sectionId}"]`);
        if (controller) controller.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');

        // Toggle a `.collapsed` helper on the containing card so CSS can
        // completely hide the panel area (removes leftover spacing when
        // collapsed). The controller sits inside the header which is inside
        // the card element we annotated with `.section-card` in the HTML.
        try {
            const card = controller ? controller.closest('.section-card') : null;
            if (card) card.classList.toggle('collapsed', !isCollapsed);
        } catch (e) { /* ignore */ }

        // animate chevron
        if (icon) {
            icon.style.transition = 'transform 0.3s cubic-bezier(0.4,0,0.2,1)';
            if (isCollapsed) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                icon.style.transform = 'rotate(180deg)';
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                icon.style.transform = 'rotate(0deg)';
            }
        }

        // animate content (use maxHeight to match other panel behavior)
        if (isCollapsed) {
            content.classList.remove('hidden');
            content.style.opacity = '1';
            content.style.maxHeight = '0px';
            // force reflow
            content.offsetHeight;
            content.style.maxHeight = `${content.scrollHeight}px`;
            content.addEventListener('transitionend', function onEnd(e) {
                if (e.propertyName === 'max-height') {
                    content.style.maxHeight = 'none';
                    content.removeEventListener('transitionend', onEnd);
                }
            });

            // lazy loaders
            try {
                if (sectionId === 'users' && typeof loadUsers === 'function') loadUsers();
                if (sectionId === 'permits' && typeof loadPermits === 'function') loadPermits();
                if ((sectionId === 'userStats' || sectionId === 'permitStats') && typeof loadStats === 'function') loadStats();
            } catch (err) { console.debug('loader error', err); }

            // Give Chart.js a moment to initialize when panels open; some charts are
            // created while hidden which can lead to clipped legends. Resize/refresh
            // charts after the panel is visible.
            try {
                setTimeout(() => {
                    try {
                        Object.values(charts).forEach(c => {
                            if (!c) return;
                            if (typeof c.resize === 'function') try { c.resize(); } catch (e) { /* ignore */ }
                            else if (typeof c.update === 'function') try { c.update(); } catch (e) { /* ignore */ }
                        });
                    } catch (e) { /* ignore */ }
                }, 350);
            } catch (e) { /* ignore */ }

        } else {
            if (getComputedStyle(content).maxHeight === 'none') content.style.maxHeight = `${content.scrollHeight}px`;
            // force reflow
            content.offsetHeight;
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.addEventListener('transitionend', function onEnd(e) {
                if (e.propertyName === 'max-height') {
                    content.classList.add('hidden');
                    content.removeEventListener('transitionend', onEnd);
                }
            });
        }
    } catch (err) {
        console.debug('toggleSection error', err);
    }
}

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
    const el_userId = document.getElementById('view_userId');
    const el_fullName = document.getElementById('view_fullName');
    const el_displayName = document.getElementById('view_displayName');
    const el_email = document.getElementById('view_email');
    const el_displayEmail = document.getElementById('view_displayEmail');
    const el_mobile = document.getElementById('view_mobile');
    const el_company = document.getElementById('view_company');
    const el_department = document.getElementById('view_department');
    const el_designation = document.getElementById('view_designation');
    if (el_userId) el_userId.value = user.id || user._id || '';
    if (el_fullName) el_fullName.value = user.fullName || user.username || '';
    if (el_displayName) el_displayName.textContent = user.fullName || user.username || '—';
    if (el_email) el_email.value = user.email || '';
    if (el_displayEmail) el_displayEmail.textContent = user.email || '';
    if (el_mobile) el_mobile.value = user.phone || user.mobile || '';
    if (el_company) el_company.value = user.company || '';
    if (el_department) el_department.value = user.department || '';
    if (el_designation) el_designation.value = user.designation || '';
    // normalize role
    const r = (user.role || '').toString().toLowerCase();
    const el_role = document.getElementById('view_role');
    if (el_role) {
        if (r.includes('admin')) el_role.value = 'admin';
        else if (r.includes('pre')) el_role.value = 'pre-approver';
        else if (r.includes('approver')) el_role.value = 'approver';
        else el_role.value = 'requester';
    }

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

    const regEl = document.getElementById('view_registered');
    const lastEl = document.getElementById('view_lastLogin');
    if (regEl) regEl.textContent = safeFormatDate(reg);
    if (lastEl) lastEl.textContent = safeFormatDate(last);
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
    // Use shared confirm modal instead of native confirm
    const resp = await showConfirmModal({ title: 'Confirm delete', message: 'Are you sure you want to permanently delete this user?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!resp || !resp.confirmed) return;
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
    // Use shared modal to collect new password instead of native prompt
    const resp = await showConfirmModal({ title: 'Reset password', message: 'Enter new password for this user:', confirmText: 'Reset', cancelText: 'Cancel', input: { type: 'password', placeholder: 'New password' } });
    if (!resp || !resp.confirmed) return;
    const newPassword = (resp.value || '').trim();
    if (!newPassword) return showToast('Password cannot be empty', 'error');
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

/* ===== Run main initialization after shared layout is mounted ===== */
async function mainInit() {
    try {
        // header buttons and UI require the layout to be present; bind them now
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) addUserBtn.addEventListener('click', () => openUserModal());
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => logoutUser());

        // Theme toggle initialization (round icon in header)
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        function applyTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (themeIcon) { themeIcon.className = 'fa-solid fa-sun'; }
                if (themeToggle) { themeToggle.setAttribute('aria-pressed', 'true'); themeToggle.classList.remove('light'); }
                updateChartTheme();
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                if (themeIcon) { themeIcon.className = 'fa-solid fa-moon'; }
                if (themeToggle) { themeToggle.setAttribute('aria-pressed', 'false'); themeToggle.classList.add('light'); }
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
        const modal = document.getElementById('userModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeUserModal(); });

        const viewModal = document.getElementById('viewUserModal');
        if (viewModal) viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeViewUserModal(); });

        // initialize data (loadUsers, loadPermits, loadStats are function declarations below)
        await loadUsers();
        // start live polling to fetch fresh data from DB periodically while
        // preserving security (global fetch wrapper handles Authorization + refresh)
        try { startLiveUsersPolling(); } catch (e) { console.debug('startLiveUsersPolling failed', e); }
        await loadPermits();
        await loadStats();
    } catch (err) {
        console.debug('Initialization error (non-fatal):', err?.message || err);
    }
}

if (document.querySelector('[data-layout-wrapper]')) {
    window.requestAnimationFrame(() => { mainInit(); });
} else {
    window.addEventListener('layout:mounted', mainInit, { once: true });
}

// Clean up polling when the page unloads to avoid timers running in background
try { window.addEventListener('beforeunload', () => { try { stopLiveUsersPolling(); } catch (_) { } }); } catch (_) { }

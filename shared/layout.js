// Minimal, robust layout scripting: theme + hamburger/sidebar behavior
(function () {
  // Toast helpers are now in shared/toast.js; keep a defensive guard in case it's not loaded.
  try {
    if (typeof window.showToast !== 'function') {
      window.showToast = function (_type, _message) { /* no-op fallback */ };
    }
    if (typeof window.dismissToast !== 'function') {
      window.dismissToast = function (_el) { /* no-op fallback */ };
    }
  } catch (_) { /* ignore */ }
  // --- Global fetch interceptor for revoked sessions ---
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (...args) {
      const res = await origFetch(...args);
      try {
        if (res && (res.status === 440 || (res.status === 401))) {
          // Try to detect our specific code
          let code = '';
          try {
            const cloned = res.clone();
            const data = await cloned.json().catch(() => ({}));
            code = data && data.code;
          } catch (_) { /* ignore */ }
          if (res.status === 440 || code === 'SESSION_REVOKED') {
            // Notify user and redirect to login
            try { showSessionEndedNotice(); } catch (_) { /* ignore */ }
            try { if (window.showToast) window.showToast('error', 'Your session ended because it was used on another device. Please sign in again.'); } catch (_) { /* ignore */ }
            // Clear theme hints and redirect
            try { localStorage.removeItem('theme'); } catch (_) { }
            try { sessionStorage.removeItem('theme'); } catch (_) { }
            setTimeout(() => { window.location.href = getLoginUrl ? getLoginUrl() : '/login/index.html'; }, 800);
          }
        }
      } catch (_) { /* ignore */ }
      return res;
    };
  } catch (_) { /* ignore */ }
  // --- Theme init & toggle ---
  try {
    const STORAGE_KEY = 'theme';
    const root = document.documentElement;
    // Prefer localStorage but fall back to sessionStorage (other scripts may use it)
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      } catch (e) {
        try { return sessionStorage.getItem(STORAGE_KEY); } catch (_e) { return null; }
      }
    })();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = stored ? stored === 'dark' : prefersDark;
    root.classList.toggle('dark', useDark);
    root.setAttribute('data-theme', useDark ? 'dark' : 'light');
    // also set on body for any code that checks body[data-theme]
    try { document.body.setAttribute('data-theme', useDark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
    // initialization complete
    // Force body styles on initial load
    try {
      document.body.style.backgroundColor = 'var(--bg-surface)';
      document.body.style.color = 'var(--text-primary)';
    } catch (e) { /* ignore */ }
  } catch (e) {
    /* ignore */
  }

  function applyThemeStyles() {
    // Force body styles to update using CSS variables
    document.body.style.backgroundColor = 'var(--bg-surface)';
    document.body.style.color = 'var(--text-primary)';
  }

  // Compute API base URL depending on where the page is served from (dev vs prod)
  function getApiBase() {
    try {
      const { protocol, hostname, port } = window.location;
      // Live Server default port is 5500; backend runs on 5000
      if (port === '5500') {
        return `${protocol}//${hostname}:5000`;
      }
      return '';
    } catch (_) {
      return '';
    }
  }

  function apiUrl(path) {
    const base = getApiBase();
    if (!base) return path; // same-origin
    // ensure single slash join
    return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
      // also write to sessionStorage for compatibility with other scripts
      try { sessionStorage.setItem('theme', theme); } catch (_e) { /* ignore */ }
    } catch (_e) { }
  }

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.classList.contains('dark') ? 'light' : 'dark';
    root.classList.toggle('dark', next === 'dark');
    root.setAttribute('data-theme', next);
    try { document.body.setAttribute('data-theme', next); } catch (e) { /* ignore */ }
    persistTheme(next);
    applyThemeStyles(); // Force styles to update
    // dispatch a custom event so other scripts can react and for debugging
    try {
      window.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: next } }));
    } catch (e) { /* ignore */ }
    // Update any theme-toggle icons so they reflect the new state
    try { updateThemeToggleIcons(); } catch (e) { /* ignore */ }
  }

  // Update icons inside elements with [data-theme-toggle] to reflect current theme
  function updateThemeToggleIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
      // If the control already has FontAwesome moon/sun icons (desktop), leave them
      // to be handled by CSS. Otherwise create/update a single icon element.
      const hasFaMoon = !!el.querySelector('i.fa-moon');
      const hasFaSun = !!el.querySelector('i.fa-sun');

      if (hasFaMoon || hasFaSun) {
        // animate the visible icon(s) if present
        const icons = Array.from(el.querySelectorAll('i.fa-moon, i.fa-sun, i.icon-sun, i.icon-moon'));
        icons.forEach((ic) => {
          try {
            const style = window.getComputedStyle(ic);
            // CSS now uses opacity/visibility to show/hide icons; animate only the
            // currently visible one (opacity > 0).
            const isVisible = style && style.opacity && parseFloat(style.opacity) > 0;
            if (isVisible) {
              ic.classList.add('rotating');
              setTimeout(() => ic.classList.remove('rotating'), 360);
            }
          } catch (e) { /* ignore */ }
        });
        // set accessible label/title
        const label = isDark ? 'Dark mode' : 'Light mode';
        el.setAttribute('aria-label', label);
        el.title = label;
      } else {
        // find or create the <i> indicator inside the control
        let icon = el.querySelector('i.icon-toggle');
        if (!icon) {
          icon = document.createElement('i');
          // no extra margin class here so spacing matches navbar
          icon.className = 'fas icon-toggle';
          el.insertBefore(icon, el.firstChild);
        }

        // animate rotation for visual feedback
        icon.classList.add('rotating');
        // remove the rotating class after the transition duration (safe fallback)
        setTimeout(() => icon.classList.remove('rotating'), 360);

        // set classes (swap fa-moon / fa-sun)
        // show moon when dark, sun when light
        if (isDark) {
          icon.classList.remove('fa-sun');
          icon.classList.add('fa-moon');
        } else {
          icon.classList.remove('fa-moon');
          icon.classList.add('fa-sun');
        }

        // update label text (if present)
        const labelSpan = el.querySelector('span.theme-label');
        if (labelSpan) labelSpan.textContent = isDark ? 'Dark mode' : 'Light mode';
        const label = isDark ? 'Dark mode' : 'Light mode';
        el.setAttribute('aria-label', label);
        el.title = label;
      }
    });
  }

  // Attach direct listeners to theme toggle controls for reliability. This
  // avoids edge cases where event.target may be a text node and closest()
  // checks fail. Also support keyboard activation (Enter / Space).
  const toggleElements = document.querySelectorAll('[data-theme-toggle]');
  toggleElements.forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      toggleTheme();
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleTheme();
      }
    });
  });

  // initialize theme toggle icons on load
  try { updateThemeToggleIcons(); } catch (e) { /* ignore */ }

  // --- Submit New Request (Permit) modal wiring ---
  (function permitModal() {
    const modal = document.getElementById('permit-form-modal');
    if (!modal) return; // layout without modal
    const overlay = modal.querySelector('[data-permit-overlay]');
    const btnClose = modal.querySelector('[data-permit-close]');
    const btnCancel = modal.querySelector('[data-permit-cancel]');
    const btnSubmit = modal.querySelector('[data-permit-submit]');
    const bodyEl = document.getElementById('permit-modal-body');

    let formRoot = null;
    let filesInput = null;
    let updateFileUploadVisibilityFn = null; // set when handlers init

    function open() {
      if (modal.classList.contains('hidden')) modal.classList.remove('hidden');
      // find embedded form in modal
      formRoot = modal.querySelector('#permitForm');
      if (!formRoot) return;
      // Initialize once per page load
      if (!formRoot.dataset.wired) {
        initFormHandlers();
        formRoot.dataset.wired = '1';
      }
      // Prefill each time modal opens
      prefillFromProfile().catch(() => { });
    }
    function close() {
      modal.classList.add('hidden');
    }

    // Expose a safe global opener so feature pages (e.g., profile) can call it
    try { window.openPermitModal = () => { open(); return true; }; } catch (_) { }


    async function prefillFromProfile() {
      if (!formRoot) return;
      try {
        const res = await fetch(apiUrl('/api/profile'), { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const u = (data && data.user) ? data.user : {};

        const nameSource = (u.fullName || u.username || '').trim();
        let firstName = nameSource;
        let lastName = '';
        if (nameSource.includes(' ')) {
          const parts = nameSource.split(/\s+/);
          firstName = parts.shift();
          lastName = parts.join(' ');
        }

        const setIfEmpty = (sel, val) => {
          const el = formRoot.querySelector(sel);
          if (el && !el.value && val) el.value = val;
        };

        // Requester Details
        setIfEmpty('#fullName', firstName);
        setIfEmpty('#lastName', lastName);
        setIfEmpty('#corpemailid', u.email || '');
        // Prefer mobile fields commonly used in profile
        const phone = u.mobile || u.mobileNumber || u.phone || u.phoneNumber || (u.contact && (u.contact.mobile || u.contact.phone)) || '';
        setIfEmpty('#contactdetails', phone);

        // No signature fields in modal anymore
      } catch (_) { /* ignore prefill failures */ }
    }

    function toggleHidden(el, show) {
      if (!el) return;
      if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
    }

    function initFormHandlers() {
      if (!formRoot) return;

      // Initialize flatpickr if available, else provide a graceful fallback
      try {
        const startEl = formRoot.querySelector('#startDateTime');
        const endEl = formRoot.querySelector('#endDateTime');
        if (window.flatpickr && startEl && endEl) {
          let endPicker;
          const startPicker = window.flatpickr(startEl, {
            enableTime: true,
            dateFormat: 'Y-m-d H:i',
            minDate: 'today',
            allowInput: false,
            onOpen: function (_, __, fp) {
              fp.set('minDate', new Date());
            },
            onChange: function (selectedDates) {
              const start = selectedDates && selectedDates[0] ? selectedDates[0] : null;
              if (endPicker && start) {
                endPicker.set('minDate', start);
                const end = endPicker.selectedDates && endPicker.selectedDates[0];
                if (!end || end <= start) {
                  // set end = start + 30 minutes
                  const next = new Date(start.getTime() + 30 * 60000);
                  endPicker.setDate(next, true);
                }
              }
            }
          });
          endPicker = window.flatpickr(endEl, {
            enableTime: true,
            dateFormat: 'Y-m-d H:i',
            minDate: 'today',
            allowInput: false,
            onOpen: function (_, __, fp) {
              fp.set('minDate', new Date());
            }
          });
        } else {
          // Fallback: allow manual input if flatpickr unavailable
          if (startEl) startEl.removeAttribute('readonly');
          if (endEl) endEl.removeAttribute('readonly');
        }
      } catch (_) { }

      // Terminal -> Facility and specify fields (fetched from backend lookups)
      const terminalSel = formRoot.querySelector('#terminal');
      const facilityContainer = formRoot.querySelector('#facilityContainer');
      const facilitySel = formRoot.querySelector('#facility');
      const specifyTerminalContainer = formRoot.querySelector('#specifyTerminalContainer');
      const specifyFacilityContainer = formRoot.querySelector('#specifyFacilityContainer');
      const equipmentTypeSel = formRoot.querySelector('#equipmentTypeInput');
      const natureOfWorkSel = formRoot.querySelector('#natureOfWork');

      let lookups = null; // cache within modal lifecycle

      function populateSelect(selectEl, placeholder, values) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.disabled = true;
        ph.selected = true;
        ph.textContent = placeholder;
        selectEl.appendChild(ph);
        (values || []).forEach(val => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          selectEl.appendChild(opt);
        });
      }

      function populateFacilities(list) {
        populateSelect(facilitySel, 'Select the Facility', list || []);
      }

      const updateTerminal = () => {
        if (!terminalSel) return;
        const val = terminalSel.value;
        const isOther = val === 'Other';
        if (val && !isOther && lookups && lookups.facilities && lookups.facilities[val]) {
          populateFacilities(lookups.facilities[val]);
          toggleHidden(facilityContainer, true);
          toggleHidden(specifyTerminalContainer, false);
          toggleHidden(specifyFacilityContainer, false);
        } else if (isOther) {
          toggleHidden(facilityContainer, false);
          toggleHidden(specifyTerminalContainer, true);
          toggleHidden(specifyFacilityContainer, true);
          if (facilitySel) { facilitySel.selectedIndex = 0; }
        } else {
          toggleHidden(facilityContainer, false);
          toggleHidden(specifyTerminalContainer, false);
          toggleHidden(specifyFacilityContainer, false);
        }
      };

      async function loadLookupsAndPopulate() {
        // Fetch lookups from backend and populate selects
        try {
          const res = await fetch(apiUrl('/api/lookups'), { credentials: 'include' });
          if (res.ok) {
            lookups = await res.json();
          } else {
            // fallback to built-in defaults if backend unavailable
            lookups = {
              terminals: ['PTC', 'RTBF', 'QROC', 'Other'],
              facilities: {
                PTC: ['Arrival Hall', 'Baggage Hall', 'BHS Baggage Control Room', 'Concourse Alpha', 'Concourse Bravo', 'Concourse Charlie', 'Departure Hall', 'DSF Area', 'Terminating Alpha', 'Terminating Bravo', 'Concourse Alpha Basement', 'Concourse Bravo Basement', 'HLC Server Room', 'HBSS Server Room', 'MOI Break Room', 'Custom OSR Room (Concourse Alpha)', 'Custom OSR Room (Concourse Bravo)'],
                RTBF: ['Baggage Hall', 'Control Room', 'Staff Break Room', 'OSR Room', 'Transfer Area', 'Customer Service Building', 'Employee Service Building', 'Stagging Area'],
                QROC: ['Arrival Area', 'Departure Area', 'Baggage Hall', 'BHS Baggage Control Room']
              },
              equipmentTypes: ['BHS', 'PLB - Passenger Loading Bridge', 'VDGS - Visual Docking Guidance System', 'High Speed Shutter Door'],
              natureOfWork: ['Project', 'Fault', 'Preventive Maintenance', 'Corrective Maintenance', 'Snag Work']
            };
          }
        } catch (_) {
          // same fallback if network error
          lookups = lookups || {
            terminals: ['PTC', 'RTBF', 'QROC', 'Other'],
            facilities: {
              PTC: ['Arrival Hall', 'Baggage Hall', 'BHS Baggage Control Room', 'Concourse Alpha', 'Concourse Bravo', 'Concourse Charlie', 'Departure Hall', 'DSF Area', 'Terminating Alpha', 'Terminating Bravo', 'Concourse Alpha Basement', 'Concourse Bravo Basement', 'HLC Server Room', 'HBSS Server Room', 'MOI Break Room', 'Custom OSR Room (Concourse Alpha)', 'Custom OSR Room (Concourse Bravo)'],
              RTBF: ['Baggage Hall', 'Control Room', 'Staff Break Room', 'OSR Room', 'Transfer Area', 'Customer Service Building', 'Employee Service Building', 'Stagging Area'],
              QROC: ['Arrival Area', 'Departure Area', 'Baggage Hall', 'BHS Baggage Control Room']
            },
            equipmentTypes: ['BHS', 'PLB - Passenger Loading Bridge', 'VDGS - Visual Docking Guidance System', 'High Speed Shutter Door'],
            natureOfWork: ['Project', 'Fault', 'Preventive Maintenance', 'Corrective Maintenance', 'Snag Work']
          };
        }

        // Populate terminal list
        if (terminalSel) populateSelect(terminalSel, 'Select the Terminal', (lookups.terminals || []));
        // Populate equipment types
        if (equipmentTypeSel) populateSelect(equipmentTypeSel, 'Select Equipment Type', (lookups.equipmentTypes || []));
        // Populate nature of work
        if (natureOfWorkSel) populateSelect(natureOfWorkSel, 'Select Nature of Work', (lookups.natureOfWork || []));

        // Sync facilities based on current terminal selection
        updateTerminal();
      }

      if (terminalSel) {
        terminalSel.addEventListener('change', updateTerminal);
        // Load lookups once and initialize all dependent selects
        loadLookupsAndPopulate();
      }

      // Impact -> dependent fields
      const impactSel = formRoot.querySelector('#impact');
      const levelOfImpactContainer = formRoot.querySelector('#levelOfImpactContainer');
      const equipmentType = formRoot.querySelector('#equipmentType');
      const impactDetails = formRoot.querySelector('#impactDetails');
      if (impactSel) {
        const updateImpact = () => {
          const yes = impactSel.value === 'Yes';
          toggleHidden(levelOfImpactContainer, yes);
          toggleHidden(equipmentType, yes);
          toggleHidden(impactDetails, yes);
        };
        impactSel.addEventListener('change', updateImpact);
        // Initialize visibility on load
        updateImpact();
      }

      // Radios with dependent reason inputs
      function wireRadioPair(name, yesId, noId, containerId) {
        const yes = formRoot.querySelector('#' + yesId);
        const no = formRoot.querySelector('#' + noId);
        const cont = formRoot.querySelector('#' + containerId);
        // when NO is selected, show reason textbox and require it; otherwise hide and remove required
        const update = () => {
          const showReason = no && no.checked;
          toggleHidden(cont, showReason);
          if (cont) {
            const input = cont.querySelector('input,textarea,select');
            if (input) input.required = !!showReason;
          }
          updateFileUploadVisibility();
        };
        if (yes) yes.addEventListener('change', update);
        if (no) no.addEventListener('change', update);
        // Set initial state
        update();
      }
      wireRadioPair('ePermit', 'ePermitYes', 'ePermitNo', 'ePermitDetails');
      wireRadioPair('fmmWorkorder', 'fmmWorkorderYes', 'fmmWorkorderNo', 'fmmwrkordr');
      wireRadioPair('hseRisk', 'hseRiskYes', 'hseRiskNo', 'hseassmnt');
      wireRadioPair('opRisk', 'opRiskYes', 'opRiskNo', 'opsassmnt');

      // File upload list + validation + preview + remove
      filesInput = formRoot.querySelector('#fileUpload');
      const uploadedList = formRoot.querySelector('#uploadedFiles');
      const fileMsg = formRoot.querySelector('#fileTypeMessage');
      const allowedExt = ['pdf', 'jpeg', 'jpg'];
      let selectedFiles = [];

      function fileKey(f) { return `${f.name}|${f.size}|${f.lastModified || 0}`; }
      function syncInputFiles() {
        if (!filesInput) return;
        const dt = new DataTransfer();
        selectedFiles.forEach(f => dt.items.add(f));
        filesInput.files = dt.files;
      }
      function clearSelectedFiles() {
        selectedFiles = [];
        syncInputFiles();
        if (uploadedList) uploadedList.innerHTML = '';
        if (fileMsg) fileMsg.textContent = '';
      }

      // expose a clear hook so global reset can purge this state
      if (modal) modal._permitClearFiles = clearSelectedFiles;

      function validateAndRenderFiles() {
        if (!uploadedList) return { valid: true, files: [] };
        uploadedList.innerHTML = '';
        if (fileMsg) fileMsg.textContent = '';
        let allValid = true;
        selectedFiles.forEach((f, idx) => {
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          const sizeOk = f.size <= 3 * 1024 * 1024; // 3MB
          const typeOk = allowedExt.includes(ext);
          const li = document.createElement('li');
          const sizeKB = Math.max(1, Math.round(f.size / 1024));
          li.innerHTML = `
            <span>${f.name} (${sizeKB} KB)</span>
            <button type="button" data-preview-index="${idx}" class="inline-flex items-center px-2 py-0.5 rounded border text-xs ml-2">Preview</button>
            <button type="button" data-remove-index="${idx}" class="inline-flex items-center px-2 py-0.5 rounded border text-xs ml-2 text-red-600 border-red-400">Remove</button>
          `;
          if (!sizeOk || !typeOk) {
            allValid = false;
            const reason = !typeOk ? 'Invalid file type' : 'File too large (>3MB)';
            const warn = document.createElement('span');
            warn.textContent = ` - ${reason}`;
            warn.style.color = 'var(--error-color)';
            li.appendChild(warn);
          }
          uploadedList.appendChild(li);
        });
        return { valid: allValid, files: selectedFiles.slice() };
      }

      function handleFileChange() {
        if (!filesInput) return;
        const incoming = Array.from(filesInput.files || []);
        // merge unique by name+size+lastModified
        const seen = new Set(selectedFiles.map(fileKey));
        incoming.forEach(f => {
          const k = fileKey(f);
          if (!seen.has(k)) { selectedFiles.push(f); seen.add(k); }
        });
        // reflect in input.files for form submission
        syncInputFiles();
        validateAndRenderFiles();
      }

      if (filesInput && uploadedList) {
        filesInput.addEventListener('change', handleFileChange);
        uploadedList.addEventListener('click', (e) => {
          const tgt = e.target;
          if (!tgt) return;
          const previewBtn = tgt.closest('[data-preview-index]');
          const removeBtn = tgt.closest('[data-remove-index]');
          if (previewBtn) {
            const idx = parseInt(previewBtn.getAttribute('data-preview-index'), 10);
            const f = selectedFiles[idx];
            if (!f) return;
            const url = URL.createObjectURL(f);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
            return;
          }
          if (removeBtn) {
            const idx = parseInt(removeBtn.getAttribute('data-remove-index'), 10);
            if (Number.isInteger(idx) && idx >= 0 && idx < selectedFiles.length) {
              selectedFiles.splice(idx, 1);
              syncInputFiles();
              validateAndRenderFiles();
            }
          }
        });
      }

      // Update file-upload section visibility based on required-docs radios
      function anyRequiredDocsYes() {
        const ids = ['ePermitYes', 'fmmWorkorderYes', 'hseRiskYes', 'opRiskYes'];
        return ids.some(id => { const el = formRoot.querySelector('#' + id); return el && el.checked; });
      }
      function updateFileUploadVisibility() {
        const sec = formRoot.querySelector('#fileUploadSection');
        const legend = formRoot.querySelector('#fileUploadLegend');
        const show = anyRequiredDocsYes();
        toggleHidden(sec, show);
        toggleHidden(legend, show);
        if (!show && filesInput) {
          // also clear our tracked list when section hides
          clearSelectedFiles();
        }
      }
      // initial sync
      updateFileUploadVisibility();

      // Expose for use in reset
      updateFileUploadVisibilityFn = updateFileUploadVisibility;

      function updateFileUploadVisibilityWrapper() {
        updateFileUploadVisibility();
      }
      // Fallback: also watch changes on the fieldset for document radios
      const docsFieldset = formRoot.querySelector('section fieldset legend h3')?.textContent?.includes('Required Documents')
        ? formRoot.querySelector('section fieldset').parentElement
        : null;
      if (docsFieldset) {
        docsFieldset.addEventListener('change', updateFileUploadVisibilityWrapper);
      }

      // Ensure Enter key or native submit triggers our handler too
      try {
        formRoot.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });
      } catch (_) { /* ignore */ }

      // Attach database validation on blur for email and phone
      const emailInput = formRoot.querySelector('#corpemailid');
      const phoneInput = formRoot.querySelector('#contactdetails');
      if (emailInput) emailInput.addEventListener('blur', () => validateAgainstDB('email'));
      if (phoneInput) phoneInput.addEventListener('blur', () => validateAgainstDB('phone'));

      async function validateAgainstDB(kind) {
        try {
          const res = await fetch(apiUrl('/api/profile'), { credentials: 'include' });
          const data = await res.json();
          const u = data && data.user ? data.user : {};
          const emailDB = u.email || '';
          const phoneDB = u.phone || u.mobile || u.mobileNumber || '';
          if (kind === 'email' && emailInput) {
            if (emailInput.value && emailDB && emailInput.value.trim().toLowerCase() !== emailDB.trim().toLowerCase()) {
              emailInput.setCustomValidity('Email does not match your registered email');
              window.showToast && window.showToast('error', 'Email does not match your registered email');
            } else {
              emailInput.setCustomValidity('');
            }
          }
          if (kind === 'phone' && phoneInput) {
            if (phoneInput.value && phoneDB && phoneInput.value.trim() !== phoneDB.trim()) {
              phoneInput.setCustomValidity('Mobile number does not match your registered number');
              window.showToast && window.showToast('error', 'Mobile number does not match your registered number');
            } else {
              phoneInput.setCustomValidity('');
            }
          }
        } catch (_) { /* ignore */ }
      }
    }

    async function handleSubmit() {
      if (!formRoot) return;
      try {
        // Custom validation only (no native HTML5 validation)
        const errors = [];
        const getVal = (sel) => { const el = formRoot.querySelector(sel); return el ? (el.value || '').trim() : ''; };
        const nonEmpty = (v) => v && v.length > 0;

        // Requester details must be present (read-only)
        if (!nonEmpty(getVal('#fullName'))) errors.push('Missing requester first name');
        if (!nonEmpty(getVal('#lastName'))) errors.push('Missing requester last name');
        if (!nonEmpty(getVal('#corpemailid'))) errors.push('Missing requester email');
        if (!nonEmpty(getVal('#contactdetails'))) errors.push('Missing requester mobile');

        // Work basics
        if (!nonEmpty(getVal('#permitTitle'))) errors.push('Permit Title is required');
        const terminal = getVal('#terminal');
        if (!nonEmpty(terminal)) errors.push('Terminal is required');
        if (terminal === 'Other') {
          if (!nonEmpty(getVal('#specifyTerminal'))) errors.push('Specify Terminal is required');
          if (!nonEmpty(getVal('#specifyFacility'))) errors.push('Specify Facility is required');
        } else if (nonEmpty(terminal)) {
          // require facility when a known terminal is selected
          if (!nonEmpty(getVal('#facility'))) errors.push('Facility is required');
        }

        const impact = getVal('#impact');
        if (!nonEmpty(impact)) errors.push('Impact selection is required');
        if (impact === 'Yes') {
          if (!nonEmpty(getVal('#levelOfImpact'))) errors.push('Level of Impact is required');
          if (!nonEmpty(getVal('#equipmentTypeInput'))) errors.push('Equipment Type is required');
          if (!nonEmpty(getVal('#impactDetailsInput'))) errors.push('Affected Equipment Details are required');
        }

        if (!nonEmpty(getVal('#natureOfWork'))) errors.push('Nature of Work is required');
        if (!nonEmpty(getVal('#workDescription'))) errors.push('Work Description is required');

        // --- Required documents validation (see section below for details) ---
        const docGroups = [
          { yes: '#ePermitYes', no: '#ePermitNo', label: 'e-Permit', reasonInput: '#ePermitReason' },
          { yes: '#fmmWorkorderYes', no: '#fmmWorkorderNo', label: 'FMM Workorder', reasonInput: '#noFmmWorkorder' },
          { yes: '#hseRiskYes', no: '#hseRiskNo', label: 'HSE Risk Assessment', reasonInput: '#noHseRiskAssessmentReason' },
          { yes: '#opRiskYes', no: '#opRiskNo', label: 'Operations Risk Assessment', reasonInput: '#noOpsRiskAssessmentReason' }
        ];
        let anyDocYes = false;
        docGroups.forEach(g => {
          const yes = formRoot.querySelector(g.yes);
          const no = formRoot.querySelector(g.no);
          if ((!yes || !yes.checked) && (!no || !no.checked)) {
            errors.push(`Please select Yes/No for ${g.label}`);
          }
          if (yes && yes.checked) anyDocYes = true;
          if (no && no.checked && g.reasonInput) {
            if (!nonEmpty(getVal(g.reasonInput))) errors.push(`Reason for No ${g.label} is required`);
          }
        });

        // If any doc group is Yes, at least one document must be uploaded
        const allowedExt = ['pdf', 'jpeg', 'jpg'];
        if (anyDocYes) {
          const files = (filesInput && filesInput.files) ? Array.from(filesInput.files) : [];
          if (!files.length) errors.push('Please upload required document(s) for the selected items');
          files.forEach(f => {
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            if (!allowedExt.includes(ext)) errors.push(`Invalid file type: ${f.name}`);
            if (f.size > 3 * 1024 * 1024) errors.push(`File too large (>3MB): ${f.name}`);
          });
        }

        // Date/time (validated after Required Documents so users see doc errors first)
        const startStr = getVal('#startDateTime');
        const endStr = getVal('#endDateTime');
        if (!nonEmpty(startStr)) errors.push('Start Date & Time is required');
        if (!nonEmpty(endStr)) errors.push('End Date & Time is required');
        if (nonEmpty(startStr) && nonEmpty(endStr)) {
          const start = new Date(startStr.replace(' ', 'T'));
          const end = new Date(endStr.replace(' ', 'T'));
          const now = new Date();
          if (isNaN(start) || isNaN(end)) errors.push('Invalid date/time');
          if (!isNaN(start) && start < now) errors.push('Start Date & Time cannot be in the past');
          if (!isNaN(end) && end <= start) errors.push('End Date & Time must be after Start Date & Time');
        }

        // Conditions
        const confirmEl = formRoot.querySelector('#confirmConditions');
        if (!confirmEl || !confirmEl.checked) errors.push('Please agree to the conditions');

        // (moved Required Documents validation above)

        // DB validations (compare with current user)
        try {
          const res = await fetch(apiUrl('/api/profile'), { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            const u = data && data.user ? data.user : {};
            const emailDB = (u.email || '').trim().toLowerCase();
            const phoneDB = (u.phone || u.mobile || u.mobileNumber || '').trim();
            const emailVal = getVal('#corpemailid').toLowerCase();
            const phoneVal = getVal('#contactdetails');
            if (emailDB && emailVal && emailVal !== emailDB) errors.push('Email does not match your registered email');
            if (phoneDB && phoneVal && phoneVal !== phoneDB) errors.push('Mobile number does not match your registered number');
          }
        } catch (_) { /* ignore */ }

        if (errors.length) {
          if (window.showToast) window.showToast('error', errors[0]); else alert(errors[0]);
          return;
        }

        // Required documents -> show message if invalid files already signaled by fileMsg
        const fileMsg = formRoot.querySelector('#fileTypeMessage');
        if (fileMsg && fileMsg.textContent) { if (window.showToast) window.showToast('error', fileMsg.textContent); else alert(fileMsg.textContent); return; }

        const fd = new FormData(formRoot);
        // Ensure multiple files appended if present (FormData captures automatically by name="files")

        // Submit
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = 'Submitting...'; }
        const res = await fetch(apiUrl('/api/permit'), { method: 'POST', credentials: 'include', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = data && data.message ? data.message : 'Failed to submit request';
          if (window.showToast) window.showToast('error', msg); else alert(msg);
          if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Submit'; }
          return;
        }
        // Show success message
        if (window.showToast) window.showToast('success', 'Request submitted successfully'); else alert('Request submitted successfully');
        // Clear the form so the next open starts fresh
        try { resetPermitForm(); } catch (_) { }
        close();
        try { window.dispatchEvent(new CustomEvent('permit:submitted', { detail: data })); } catch (_) { }
      } catch (e) {
        if (window.showToast) window.showToast('error', 'Network error while submitting'); else alert('Network error while submitting');
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Submit'; }
      }
    }

    // open/close wiring
    document.addEventListener('click', (ev) => {
      const a = ev.target && ev.target.closest && ev.target.closest('[data-action="submit-new-request"]');
      if (a) { ev.preventDefault(); open(); }
    });
    if (overlay) overlay.addEventListener('click', () => { try { resetPermitForm(); } catch (_) { } close(); });
    if (btnClose) btnClose.addEventListener('click', () => { try { resetPermitForm(); } catch (_) { } close(); });
    if (btnCancel) btnCancel.addEventListener('click', () => { try { resetPermitForm(); } catch (_) { } close(); });
    // Direct binding if the button was found at script init
    if (btnSubmit) btnSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      // prevent delegated handler from also firing on the same click
      try { e.stopImmediatePropagation(); } catch (_) { }
      try { e.stopPropagation(); } catch (_) { }
      handleSubmit();
    });

    // Robust fallback: delegate clicks so it works even if the specific element
    // wasn’t found at init time (e.g., due to dynamic mounting order)
    document.addEventListener('click', (ev) => {
      const b = ev.target && ev.target.closest && ev.target.closest('[data-permit-submit]');
      if (!b) return;
      ev.preventDefault();
      handleSubmit();
    });

    // ESC key should also clear and close the permit modal
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.classList.contains('hidden')) {
        try { resetPermitForm(); } catch (_) { }
        close();
      }
    });
  })();

  // Utility: clear the permit form to pristine state
  function resetPermitForm() {
    try {
      const modal = document.getElementById('permit-form-modal');
      if (!modal) return;
      const form = modal.querySelector('#permitForm');
      if (!form) return;

      // Clear all field values and selections
      form.reset();

      // Clear file input and list (and any tracked selection in modal wiring)
      const fileInput = form.querySelector('#fileUpload');
      const fileList = form.querySelector('#uploadedFiles');
      const fileMsg = form.querySelector('#fileTypeMessage');
      if (modal && typeof modal._permitClearFiles === 'function') {
        try { modal._permitClearFiles(); } catch (_) { }
      }
      if (fileInput) fileInput.value = '';
      if (fileList) fileList.innerHTML = '';
      if (fileMsg) fileMsg.textContent = '';

      // Hide conditional containers
      ['#facilityContainer', '#specifyTerminalContainer', '#specifyFacilityContainer', '#levelOfImpactContainer', '#equipmentType', '#impactDetails', '#ePermitDetails', '#fmmwrkordr', '#hseassmnt', '#opsassmnt', '#fileUploadSection'].forEach(sel => {
        const el = form.querySelector(sel);
        if (el) el.classList.add('hidden');
      });

      // Reset selects to placeholder
      ['#terminal', '#facility', '#impact', '#levelOfImpact', '#equipmentTypeInput', '#natureOfWork'].forEach(sel => {
        const el = form.querySelector(sel);
        if (el) el.selectedIndex = 0;
      });

      // Clear flatpickr controls if initialized
      ['#startDateTime', '#endDateTime'].forEach(sel => {
        const el = form.querySelector(sel);
        if (el && el._flatpickr) el._flatpickr.clear();
        else if (el) el.value = '';
      });

      // Clear custom validation messages
      ['#corpemailid', '#contactdetails'].forEach(sel => {
        const el = form.querySelector(sel);
        if (el && typeof el.setCustomValidity === 'function') el.setCustomValidity('');
      });

      // Ensure upload section visibility reflects cleared radios
      if (typeof updateFileUploadVisibilityFn === 'function') {
        try { updateFileUploadVisibilityFn(); } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }
  }

  // --- Sidebar / hamburger ---
  const hamburger = document.getElementById('sidebar-hamburger');
  const sidebar = document.getElementById('desktop-sidebar');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('sidebar-overlay');
  const body = document.body;
  let desktopOpen = false;
  let mobileOpen = false;

  function isDesktop() {
    return window.innerWidth >= 768;
  }

  function openDesktop() {
    if (!sidebar) return;
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    // also add legacy/strong selector used by theme.css to ensure transform wins
    sidebar.classList.add('active');
    body.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('overlay-open');
    if (hamburger) hamburger.classList.add('is-open');
    desktopOpen = true;
  }

  function closeDesktop() {
    if (!sidebar) return;
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.remove('active');
    body.classList.remove('sidebar-open');
    if (hamburger) hamburger.classList.remove('is-open');
    if (overlay) overlay.classList.remove('overlay-open');
    desktopOpen = false;
  }

  function toggleDesktop() {
    if (desktopOpen) closeDesktop(); else openDesktop();
  }

  function openMobile() {
    if (!mobileMenu) return;
    // Remove display:none so the element can transition in
    mobileMenu.classList.remove('hidden');
    // ensure the transition starts from hidden state
    mobileMenu.classList.remove('mobile-open');
    // force reflow so the browser acknowledges the state change
    // eslint-disable-next-line no-unused-expressions
    mobileMenu.offsetWidth;
    mobileMenu.classList.add('mobile-open');
    if (overlay) overlay.classList.add('overlay-open');
    mobileOpen = true;
    if (hamburger) hamburger.classList.add('is-open');
  }

  function closeMobile() {
    if (!mobileMenu) return;
    // start fade-out/slide-out by removing the open class
    mobileMenu.classList.remove('mobile-open');
    // remove hamburger open state immediately
    if (hamburger) hamburger.classList.remove('is-open');
    // start overlay fade-out
    if (overlay) overlay.classList.remove('overlay-open');

    // clean up any previous handler
    if (mobileMenu._closeHandler) {
      mobileMenu.removeEventListener('transitionend', mobileMenu._closeHandler);
      clearTimeout(mobileMenu._closeFallback);
    }

    // after transition ends, add hidden to remove from flow
    const onEnd = (ev) => {
      if (ev.target !== mobileMenu) return;
      // only react to opacity/transform transitions
      if (ev.propertyName && !(ev.propertyName === 'opacity' || ev.propertyName === 'transform')) return;
      mobileMenu.classList.add('hidden');
      mobileOpen = false;
      mobileMenu.removeEventListener('transitionend', onEnd);
      delete mobileMenu._closeHandler;
      if (mobileMenu._closeFallback) {
        clearTimeout(mobileMenu._closeFallback);
        delete mobileMenu._closeFallback;
      }
    };

    mobileMenu._closeHandler = onEnd;
    mobileMenu.addEventListener('transitionend', onEnd);

    // fallback in case transitionend doesn't fire
    mobileMenu._closeFallback = setTimeout(() => {
      if (!mobileMenu.classList.contains('mobile-open')) {
        mobileMenu.classList.add('hidden');
        mobileOpen = false;
      }
      if (mobileMenu._closeHandler) {
        mobileMenu.removeEventListener('transitionend', mobileMenu._closeHandler);
        delete mobileMenu._closeHandler;
      }
      delete mobileMenu._closeFallback;
    }, 420);
  }

  function toggleMobile() {
    if (mobileOpen) closeMobile(); else openMobile();
  }

  // handle hamburger clicks
  if (hamburger) {
    hamburger.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (isDesktop()) toggleDesktop(); else toggleMobile();
    });
  }

  // close when clicking outside
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    // if desktop and sidebar open, close when clicking outside sidebar and hamburger
    if (isDesktop() && desktopOpen) {
      if (sidebar && !sidebar.contains(target) && hamburger && !hamburger.contains(target)) {
        closeDesktop();
      }
    }
    // mobile
    if (!isDesktop() && mobileOpen) {
      if (mobileMenu && !mobileMenu.contains(target) && hamburger && !hamburger.contains(target)) {
        closeMobile();
      }
    }
  });

  // clicking the overlay closes any open menu
  if (typeof overlay !== 'undefined' && overlay) {
    overlay.addEventListener('click', () => {
      if (desktopOpen) closeDesktop();
      if (mobileOpen) closeMobile();
    });
  }

  // close menus on ESC
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (desktopOpen) closeDesktop();
      if (mobileOpen) closeMobile();
    }
  });

  // ensure state aligns on resize
  window.addEventListener('resize', () => {
    if (isDesktop()) {
      // ensure mobile menu closed
      if (mobileOpen) closeMobile();
    } else {
      // ensure desktop sidebar is closed when switching to mobile
      if (desktopOpen) closeDesktop();
    }
  });

  // initial state
  if (isDesktop()) {
    // keep closed by default
    closeDesktop();
  } else {
    closeMobile();
  }

  // Populate mobile sections from desktop so mobile accordions have content
  // and keep them in sync via MutationObserver (cloned content, live sync).
  function populateMobileSections() {
    const map = [
      ['desktop-personal-section', 'mobile-personal-section'],
      ['desktop-actions-section', 'mobile-actions-section'],
      ['desktop-account-section', 'mobile-account-section']
    ];

    const observers = [];
    const timers = new Map();

    function cloneInto(src, dest) {
      // deep-clone child nodes to dest so IDs on wrappers don't duplicate
      const clones = Array.from(src.childNodes).map(n => n.cloneNode(true));

      // remove id attributes from cloned nodes to avoid duplicate IDs in the document
      function stripIds(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.hasAttribute && node.hasAttribute('id')) node.removeAttribute('id');
        // also remove `for` attributes that might reference IDs
        if (node.hasAttribute && node.hasAttribute('for')) node.removeAttribute('for');
        // recurse
        for (let i = 0; i < node.children.length; i++) stripIds(node.children[i]);
      }

      clones.forEach(c => stripIds(c));
      dest.replaceChildren(...clones);
    }

    map.forEach(([srcId, destId]) => {
      const src = document.getElementById(srcId);
      const dest = document.getElementById(destId);
      if (!src || !dest) return;

      // initial clone
      cloneInto(src, dest);

      // observe src for changes and update dest (debounced)
      const obs = new MutationObserver((mutations) => {
        // debounce updates to avoid thrashing
        if (timers.has(destId)) clearTimeout(timers.get(destId));
        timers.set(destId, setTimeout(() => {
          try {
            cloneInto(src, dest);
          } catch (e) { /* ignore */ }
          timers.delete(destId);
        }, 150));
      });

      obs.observe(src, { childList: true, subtree: true, characterData: true, attributes: true });
      observers.push(obs);
    });

    // disconnect observers when the page unloads
    window.addEventListener('beforeunload', () => {
      observers.forEach(o => o.disconnect());
    });
  }

  populateMobileSections();
  // Ensure newly-inserted mobile controls reflect the current theme
  try { updateThemeToggleIcons(); } catch (e) { /* ignore */ }

  // --- Accordions (chevron wiring) ---
  // Buttons with class `accordion-toggle` should expand/collapse the element
  // referenced by their `data-target`. If `data-accordion-group` is set,
  // only one item in the group stays open.
  // Accordion handling using event delegation so newly-cloned mobile content works
  function initAccordions() {
    // click handler delegates accordion toggle behaviour
    document.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('.accordion-toggle');
      if (!btn) return;
      ev.preventDefault();

      const targetId = btn.getAttribute('data-target');
      const content = targetId ? document.getElementById(targetId) : null;
      if (!content) return;

      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        btn.setAttribute('aria-expanded', 'false');
        content.style.maxHeight = '0px';
        return;
      }

      // if grouped, close others in the same group
      const group = btn.getAttribute('data-accordion-group');
      if (group) {
        document.querySelectorAll(`.accordion-toggle[data-accordion-group="${group}"]`).forEach((t) => {
          if (t === btn) return;
          const otherId = t.getAttribute('data-target');
          const otherContent = otherId && document.getElementById(otherId);
          if (otherContent) {
            t.setAttribute('aria-expanded', 'false');
            otherContent.style.maxHeight = '0px';
          }
        });
      }

      // expand this one
      btn.setAttribute('aria-expanded', 'true');
      content.style.maxHeight = content.scrollHeight + 'px';
    });

    // ensure initial state for any existing toggles
    document.querySelectorAll('.accordion-toggle').forEach((btn) => {
      const targetId = btn.getAttribute('data-target');
      const content = targetId ? document.getElementById(targetId) : null;
      if (content) content.style.maxHeight = (btn.getAttribute('aria-expanded') === 'true') ? content.scrollHeight + 'px' : '0px';
    });
  }

  initAccordions();

  // --- Profile data wiring (Personal Information card) ---
  function setUserField(name, value) {
    try {
      document.querySelectorAll(`[data-user-field="${name}"]`).forEach((el) => {
        el.textContent = value ?? '';
      });
    } catch (e) { /* ignore */ }
  }

  function formatDate(dt) {
    try {
      if (!dt) return '';
      const d = typeof dt === 'string' ? new Date(dt) : dt;
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (_) { return ''; }
  }

  async function loadProfileData() {
    try {
      const res = await fetch(apiUrl('/api/profile'), { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const u = data && data.user ? data.user : {};
      const clientIp = data && data.clientIp ? data.clientIp : '';

      const fullName = u.fullName || u.username || '';
      const email = u.email || '';
      const company = u.company || u.department || '';
      const phone = u.phone || u.mobile || '';
      const memberSince = formatDate(u.createdAt);
      const lastLogin = formatDate(u.lastLogin || u.prevLogin);
      const ipAddress = clientIp || '';

      setUserField('fullName', fullName);
      setUserField('email', email);
      setUserField('company', company);
      setUserField('phone', phone);
      setUserField('memberSince', memberSince);
      setUserField('lastLogin', lastLogin);
      setUserField('ipAddress', ipAddress);

      // Reveal admin-only UI if session indicates Admin role. The /api/profile
      // endpoint returns session.role in data.session.role when available.
      try {
        const role = (data && data.session && data.session.role) ? data.session.role : (u && u.role ? u.role : null);
        document.querySelectorAll('[data-admin-only]').forEach((el) => {
          if (role === 'Admin') el.classList.remove('hidden'); else el.classList.add('hidden');
        });
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
  }

  // Kick off profile fetch. MutationObserver in populateMobileSections will
  // re-clone changes into the mobile sidebar.
  loadProfileData();

  // --- Logout flow wiring ---
  function getLoginUrl() {
    try {
      const path = window.location.pathname || '';
      const base = path.includes('/PTW/') ? '/PTW' : '';
      return `${base}/login/index.html`;
    } catch (_) { return '/login/index.html'; }
  }

  function showSessionEndedNotice() {
    try {
      let bar = document.getElementById('session-ended-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'session-ended-bar';
        bar.style.position = 'fixed';
        bar.style.top = '0';
        bar.style.left = '0';
        bar.style.right = '0';
        bar.style.zIndex = '9999';
        bar.style.padding = '10px 14px';
        bar.style.textAlign = 'center';
        bar.style.fontWeight = '600';
        bar.style.backgroundColor = '#f59e0b'; // amber-500
        bar.style.color = '#1f2937'; // gray-800
        bar.textContent = 'Your session ended because it was used on another device. Redirecting to sign in...';
        document.body.appendChild(bar);
      }
    } catch (_) { /* ignore */ }
  }

  (function wireLogout() {
    const modal = document.getElementById('logout-confirm-modal');
    const openers = document.querySelectorAll('[data-logout-trigger]');
    const cancelBtn = document.querySelector('[data-logout-cancel]');
    const confirmBtn = document.querySelector('[data-logout-confirm]');
    const overlay = document.querySelector('[data-logout-overlay]');
    const status = document.querySelector('[data-logout-status]');

    function openModal() { if (modal) modal.classList.remove('hidden'); if (status) { status.textContent = ''; status.classList.add('hidden'); } }
    function closeModal() { if (modal) modal.classList.add('hidden'); }

    openers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(); }));
    if (cancelBtn) cancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    if (overlay) overlay.addEventListener('click', () => closeModal());
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

    async function doLogout() {
      try {
        const res = await fetch(apiUrl('/api/logout'), { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (status) { status.textContent = err.message || 'Logout failed'; status.classList.remove('hidden'); }
          return;
        }
        // Clear any theme/session storage hints to avoid visual mismatch after redirect
        try { localStorage.removeItem('theme'); } catch (_) { }
        try { sessionStorage.removeItem('theme'); } catch (_) { }
        window.location.href = getLoginUrl();
      } catch (_) {
        if (status) { status.textContent = 'Network error during logout'; status.classList.remove('hidden'); }
      }
    }

    if (confirmBtn) confirmBtn.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
  })();

  // --- Update Password (shared modal) ---
  (function wireUpdatePasswordModal() {
    const modal = document.getElementById('update-password-modal');
    if (!modal) return;
    const openers = document.querySelectorAll('[data-update-password-trigger]');
    const overlay = modal.querySelector('[data-update-password-overlay]');
    const btnClose = modal.querySelector('[data-update-password-close]');
    const btnCancel = modal.querySelector('[data-update-password-cancel]');

    const form = modal.querySelector('#updatePasswordFormShared');
    const currentEl = modal.querySelector('#currentPasswordShared');
    const currentHint = modal.querySelector('#currentPasswordHintShared');
    const currentErr = modal.querySelector('#currentPasswordErrorShared');
    const newSection = modal.querySelector('#newPasswordSectionShared');
    const newEl = modal.querySelector('#newPasswordShared');
    const confirmEl = modal.querySelector('#confirmNewPasswordShared');
    const confirmErr = modal.querySelector('#confirmErrorShared');
    const bar = modal.querySelector('#passwordStrengthBarShared');
    const label = modal.querySelector('#passwordStrengthLabelShared');
    const submitBtn = modal.querySelector('#updatePasswordSubmitShared');

    let mode = 'verify'; // 'verify' current password first, then 'update'

    function resetUI() {
      try {
        form && form.reset();
        newSection && newSection.classList.add('hidden');
        currentErr && currentErr.classList.add('hidden');
        confirmErr && confirmErr.classList.add('hidden');
        currentHint && currentHint.classList.remove('hidden');
        if (bar) { bar.style.width = '0%'; bar.style.backgroundColor = 'transparent'; }
        if (label) label.textContent = 'Strength: —';
        mode = 'verify';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Continue'; }
      } catch (_) { }
    }

    function open() {
      modal.classList.remove('hidden');
      resetUI();
      currentEl && currentEl.focus();
    }
    function close() { modal.classList.add('hidden'); }

    // Expose global opener for feature pages
    try { window.openUpdatePasswordModal = () => { open(); return true; }; } catch (_) { }

    function countMatches(regex, str) { const m = (str || '').match(regex); return m ? m.length : 0; }
    function assessStrength(pw) {
      const len = (pw || '').length;
      const lowers = countMatches(/[a-z]/g, pw);
      const uppers = countMatches(/[A-Z]/g, pw);
      const digits = countMatches(/\d/g, pw);
      const specials = countMatches(/[^A-Za-z\d]/g, pw);
      let score = 0; if (len >= 8) score++; if (lowers >= 1) score++; if (uppers >= 1) score++; if (digits >= 1) score++; if (specials >= 1) score++;
      const percent = Math.min(100, score * 20);
      let strength = 'Weak'; let color = '#ef4444';
      if (score >= 3 && score <= 4) { strength = 'Strong'; color = '#f59e0b'; }
      if (score >= 5) { strength = 'Very Strong'; color = '#22c55e'; }
      return { percent, strength, color };
    }
    function meetsPolicy(pw) {
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pw || '');
    }
    function updateStrengthUI() {
      const pw = newEl ? newEl.value : '';
      const { percent, strength, color } = assessStrength(pw);
      if (bar) { bar.style.width = percent + '%'; bar.style.backgroundColor = color; }
      if (label) label.textContent = 'Strength: ' + (pw ? strength : '—');
    }
    function updateSubmitState() {
      // Keep submit enabled to allow showing toast messages on click even when fields are empty.
      // We still block in the submit handler and show appropriate toasts.
      return;
    }

    // Openers (direct binding for elements present at init)
    openers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); open(); }));
    // Delegated binding so dynamically cloned items in the mobile menu work too
    document.addEventListener('click', (e) => {
      const trigger = e.target && e.target.closest && e.target.closest('[data-update-password-trigger]');
      if (!trigger) return;
      e.preventDefault();
      open();
    });
    if (overlay) overlay.addEventListener('click', close);
    if (btnClose) btnClose.addEventListener('click', close);
    if (btnCancel) btnCancel.addEventListener('click', close);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

    // Live UI
    if (currentEl) currentEl.addEventListener('input', () => {
      // Only toggle hint/section; do not show inline errors. Toasts will handle messaging.
      currentHint && currentHint.classList.toggle('hidden', !!currentEl.value);
      newSection && newSection.classList.toggle('hidden', !currentEl.value);
      updateSubmitState();
    });
    if (newEl) newEl.addEventListener('input', () => { updateStrengthUI(); updateSubmitState(); });
    if (confirmEl) confirmEl.addEventListener('input', () => {
      // No inline error below the field; rely on toast on submit
      updateSubmitState();
    });

    // Submit
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = currentEl ? currentEl.value : '';
      const newPassword = newEl ? newEl.value : '';
      const confirmPassword = confirmEl ? confirmEl.value : '';
      if (!currentPassword) {
        if (window.showToast) showToast('error', 'Current password is required'); else alert('Current password is required');
        return;
      }

      if (mode === 'verify') {
        // Verify current password against DB
        try {
          submitBtn && (submitBtn.disabled = true, submitBtn.textContent = 'Checking…');
          const res = await fetch(apiUrl('/api/check-password'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            // If endpoint doesn't exist (older backend), gracefully skip verify and advance
            if (res.status === 404) {
              mode = 'update';
              newSection && newSection.classList.remove('hidden');
              currentHint && currentHint.classList.add('hidden');
              submitBtn && (submitBtn.textContent = 'Update Password');
              newEl && newEl.focus();
              if (window.showToast) showToast('info', 'Verification step unavailable; continue to update.');
              updateSubmitState();
              return;
            }
            const msg = (data && data.message) || 'Unable to verify password';
            if (window.showToast) showToast('error', msg); else alert(msg);
            // Reset verification field state on failure
            if (currentEl) currentEl.value = '';
            currentHint && currentHint.classList.remove('hidden');
            newSection && newSection.classList.add('hidden');
            return;
          }
          // Good: advance to update stage
          mode = 'update';
          newSection && newSection.classList.remove('hidden');
          currentHint && currentHint.classList.add('hidden');
          submitBtn && (submitBtn.textContent = 'Update Password');
          newEl && newEl.focus();
          updateSubmitState();
        } catch (err) {
          if (window.showToast) showToast('error', 'Network error while verifying'); else alert('Network error while verifying');
          // Reset verification field state on failure
          if (currentEl) currentEl.value = '';
          currentHint && currentHint.classList.remove('hidden');
          newSection && newSection.classList.add('hidden');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = (mode === 'verify') ? 'Continue' : 'Update Password';
          }
        }
        return;
      }

      // mode === 'update'
      if (!newPassword) { if (window.showToast) showToast('error', 'New password is required'); else alert('New password is required'); return; }
      if (!confirmPassword) { if (window.showToast) showToast('error', 'Confirm new password is required'); else alert('Confirm new password is required'); return; }
      if (!meetsPolicy(newPassword)) { const msg = 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'; if (window.showToast) showToast('error', msg); else alert(msg); return; }
      if (newPassword !== confirmPassword) { if (window.showToast) showToast('error', 'Passwords do not match'); else alert('Passwords do not match'); return; }
      try {
        submitBtn && (submitBtn.disabled = true, submitBtn.textContent = 'Updating…');
        const res = await fetch(apiUrl('/api/update-password'), { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (data && data.message) || 'Failed to update password';
          if (window.showToast) showToast('error', msg); else alert(msg);
          return;
        }
        if (window.showToast) showToast('success', 'Password updated successfully'); else alert('Password updated successfully');
        // Reset UI and close
        resetUI();
        close();
      } catch (err) {
        if (window.showToast) showToast('error', 'Network error while updating password'); else alert('Network error while updating password');
      } finally {
        // Keep disabled briefly to avoid double clicks; will re-enable on next open/reset
        submitBtn && (submitBtn.disabled = true, submitBtn.textContent = 'Update Password');
      }
    });
  })();

  // --- Idle timeout manager ---
  (function idleTimeoutManager() {
    // Do not run idle warnings on login page or when explicitly disabled
    try {
      const path = (window.location && window.location.pathname) || '';
      if ((document.body && document.body.hasAttribute('data-no-idle')) || /\/login(\/|$)/i.test(path)) {
        return; // no-op on login or when disabled
      }
    } catch (_) { /* ignore */ }
    // Configurable timings (in ms)
    // Session idle timeout: 10 minutes total. Show reminder at the last 2 minutes (after 8 minutes of inactivity).
    const IDLE_WARNING_AFTER = 8 * 60 * 1000; // show warning after 8 minutes of inactivity
    const WARNING_COUNTDOWN_SECONDS = 120;     // 120 seconds to choose

    // Elements
    const modal = document.getElementById('idle-timeout-modal');
    const overlay = modal ? modal.querySelector('[data-idle-overlay]') : null;
    const stayBtn = modal ? modal.querySelector('[data-idle-stay]') : null;
    const logoutBtn = modal ? modal.querySelector('[data-idle-logout]') : null;
    const countdownEl = modal ? modal.querySelector('[data-idle-countdown]') : null;
    const statusEl = modal ? modal.querySelector('[data-idle-status]') : null;

    let idleTimer = null;
    let countdownTimer = null;
    let remaining = WARNING_COUNTDOWN_SECONDS;
    let showing = false;

    function openModal() {
      if (!modal || showing) return;
      // Prevent any pending idle timers while the modal is open
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      remaining = WARNING_COUNTDOWN_SECONDS;
      if (countdownEl) countdownEl.textContent = String(remaining);
      if (statusEl) { statusEl.textContent = ''; statusEl.classList.add('hidden'); }
      modal.classList.remove('hidden');
      showing = true;
      startCountdown();
    }

    function closeModal() {
      if (!modal || !showing) return;
      modal.classList.add('hidden');
      showing = false;
      stopCountdown();
    }

    function startCountdown() {
      stopCountdown();
      countdownTimer = setInterval(() => {
        remaining -= 1;
        if (countdownEl) countdownEl.textContent = String(remaining);
        if (remaining <= 0) {
          // Auto-logout immediately when timer reaches 0; keep modal visible until redirect begins
          stopCountdown();
          if (countdownEl) countdownEl.textContent = '0';
          doLogout();
        }
      }, 1000);
    }

    function stopCountdown() {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      // Only schedule the warning. Auto-logout will occur in the modal if no action is taken.
      idleTimer = setTimeout(() => openModal(), IDLE_WARNING_AFTER);
    }

    // Treat interactions as activity
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    activityEvents.forEach(evt => {
      document.addEventListener(evt, () => {
        if (evt === 'visibilitychange') {
          if (document.visibilityState !== 'visible') return;
        }
        // If the warning is up and user moves the mouse, keep the modal but keep timers flowing.
        if (!showing) resetIdleTimer();
      });
    });

    async function refreshSession() {
      try {
        const res = await fetch(apiUrl('/api/ping'), { credentials: 'include' });
        if (!res.ok) throw new Error('Ping failed');
        if (window.showToast) window.showToast('success', 'Your session has been extended.');
        resetIdleTimer();
      } catch (e) {
        if (statusEl) { statusEl.textContent = 'Unable to extend session. You may need to sign in again soon.'; statusEl.classList.remove('hidden'); }
      }
    }

    async function doLogout() {
      try {
        const res = await fetch(apiUrl('/api/logout'), { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (statusEl) { statusEl.textContent = err && err.message ? err.message : 'Logout failed.'; statusEl.classList.remove('hidden'); }
          return;
        }
        try { localStorage.removeItem('theme'); } catch (_) { }
        try { sessionStorage.removeItem('theme'); } catch (_) { }
        window.location.href = getLoginUrl();
      } catch (_) {
        if (statusEl) { statusEl.textContent = 'Network error during logout'; statusEl.classList.remove('hidden'); }
      }
    }

    // Wire modal buttons
    // Do not close on overlay click; require explicit action
    if (overlay) overlay.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    // Prevent ESC from closing the idle modal
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && showing) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    if (stayBtn) stayBtn.addEventListener('click', async (e) => { e.preventDefault(); await refreshSession(); closeModal(); });
    if (logoutBtn) logoutBtn.addEventListener('click', async (e) => { e.preventDefault(); await doLogout(); });

    // Initialize
    resetIdleTimer();
  })();

  // --- Notification System ---
  (function notificationManager() {
    const bellBtn = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    const listContainer = document.getElementById('notification-list');
    const emptyState = document.getElementById('notification-empty');
    const markAllReadBtn = document.getElementById('mark-all-read');
    const detailModal = document.getElementById('notification-detail-modal');
    const detailOverlay = detailModal ? detailModal.querySelector('[data-notification-detail-overlay]') : null;
    const detailCloseButtons = detailModal ? detailModal.querySelectorAll('[data-notification-detail-close]') : [];
    const detailTitle = document.getElementById('notification-detail-title');
    const detailTime = document.getElementById('notification-detail-time');
    const detailMessage = document.getElementById('notification-detail-message');
    const detailMetadata = document.getElementById('notification-detail-metadata');
    const detailIcon = document.getElementById('notification-detail-icon');
    const detailActionBtn = document.getElementById('notification-detail-action');

    if (!bellBtn || !dropdown) return;

    let notifications = [];
    let dropdownOpen = false;

    // Toggle dropdown
    function toggleDropdown() {
      dropdownOpen = !dropdownOpen;
      dropdown.classList.toggle('hidden', !dropdownOpen);
      bellBtn.setAttribute('aria-expanded', String(dropdownOpen));
      if (dropdownOpen) {
        fetchNotifications();
      }
    }

    function closeDropdown() {
      dropdownOpen = false;
      dropdown.classList.add('hidden');
      bellBtn.setAttribute('aria-expanded', 'false');
    }

    // Fetch notifications from backend
    async function fetchNotifications() {
      try {
        const res = await fetch(apiUrl('/api/notifications'), { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        notifications = data.notifications || [];
        renderNotifications();
      } catch (e) {
        console.error('Error fetching notifications:', e);
        if (window.showToast) window.showToast('error', 'Failed to load notifications');
      }
    }

    // Render notification list
    function renderNotifications() {
      if (!listContainer) return;

      const unreadCount = notifications.filter(n => !n.read).length;

      // Update badge

      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // Render list
      if (notifications.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        listContainer.innerHTML = '';
        return;
      }

      if (emptyState) emptyState.classList.add('hidden');

      listContainer.innerHTML = notifications.map(notif => {
        const unread = !notif.read;
        const iconClass = getNotificationIcon(notif.type);
        const iconColor = getNotificationColor(notif.type);

        return `
          <div class="notification-item px-4 py-3 border-b border-[var(--input-border)] hover:bg-[color:rgba(39,49,114,0.05)] cursor-pointer transition-colors ${unread ? 'bg-[color:rgba(39,49,114,0.06)]' : ''}"
               data-notification-id="${notif._id || notif.id}">
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconColor}">
                <i class="${iconClass} text-sm"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm font-medium text-[var(--text-primary)] line-clamp-1">${escapeHtml(notif.title || 'Notification')}</p>
                  ${unread ? '<span class="flex h-2 w-2 rounded-full bg-[var(--page-color)] flex-shrink-0"></span>' : ''}
                </div>
                <p class="text-xs text-[var(--text-primary)]/75 mt-1 line-clamp-2">${escapeHtml(notif.message || '')}</p>
                <p class="text-xs text-[var(--text-primary)]/60 mt-1">${formatNotificationTime(notif.createdAt)}</p>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Attach click handlers
      listContainer.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.notificationId;
          const notif = notifications.find(n => (n._id || n.id) === id);
          if (notif) {
            showNotificationDetail(notif);
            markAsRead(id);
          }
        });
      });
    }

    // Show notification detail modal
    function showNotificationDetail(notif) {
      if (!detailModal) return;

      closeDropdown();

      // Set icon and color
      if (detailIcon) {
        const iconClass = getNotificationIcon(notif.type);
        const colorClass = getNotificationColor(notif.type);
        detailIcon.className = `flex h-12 w-12 items-center justify-center rounded-full ${colorClass}`;
        detailIcon.innerHTML = `<i class="${iconClass} text-xl"></i>`;
      }

      // Set content
      if (detailTitle) detailTitle.textContent = notif.title || 'Notification Details';
      if (detailTime) detailTime.textContent = formatNotificationTime(notif.createdAt);

      // Build detailed paragraph message
      if (detailMessage) {
        detailMessage.innerHTML = buildDetailedMessage(notif);
      }

      // Set metadata with additional context
      if (detailMetadata) {
        let metadataHtml = '';

        if (notif.type === 'permit_approved' || notif.type === 'permit_rejected' || notif.type === 'permit_updated') {
          metadataHtml = `
            <div class="space-y-3 text-sm">
              ${notif.metadata?.permitId || notif.metadata?.permitNumber ? `
                <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span class="text-gray-500 dark:text-gray-400">Permit Reference</span>
                  <span class="font-medium text-gray-800 dark:text-white">${escapeHtml(notif.metadata.permitNumber || notif.metadata.permitId)}</span>
                </div>
              ` : ''}
              ${notif.metadata?.status ? `
                <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span class="text-gray-500 dark:text-gray-400">Current Status</span>
                  <span class="font-semibold px-2 py-1 rounded text-xs ${getStatusBadgeClass(notif.metadata.status)}">${escapeHtml(notif.metadata.status)}</span>
                </div>
              ` : ''}
              ${notif.metadata?.comments ? `
                <div class="py-2">
                  <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Additional Comments</p>
                  <p class="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg italic">"${escapeHtml(notif.metadata.comments)}"</p>
                </div>
              ` : ''}
            </div>
          `;
        }

        detailMetadata.innerHTML = metadataHtml;
      }

      // Set action button
      if (detailActionBtn && notif.metadata?.permitId) {
        detailActionBtn.classList.remove('hidden');
        detailActionBtn.textContent = 'View Permit Details';
        detailActionBtn.onclick = () => {
          closeNotificationDetail();
          // Navigate to permit details or relevant page
          if (notif.metadata.permitId) {
            window.location.href = `../profile/profile.html?permitId=${notif.metadata.permitId}`;
          }
        };
      } else if (detailActionBtn) {
        detailActionBtn.classList.add('hidden');
      }

      detailModal.classList.remove('hidden');
    }

    // Build detailed paragraph message based on notification type
    function buildDetailedMessage(notif) {
      const meta = notif.metadata || {};
      const approverName = meta.approverName || 'an approver';
      const permitRef = meta.permitNumber || meta.permitId || 'your permit';
      const status = meta.status || 'updated';

      let message = '';

      switch (notif.type) {
        case 'permit_approved':
          if (status === 'In Progress') {
            // Pre-approved case
            message = `Great news! Your permit <strong>${escapeHtml(permitRef)}</strong> has been <strong>pre-approved</strong> by ${escapeHtml(approverName)}.`;
            message += `<br><br>The permit is now marked as <strong>In Progress</strong> and has been forwarded to the final approver for review and validation. You will receive another notification once the final approval decision is made.`;
            if (meta.comments) {
              message += `<br><br>The pre-approver noted: <em>"${escapeHtml(meta.comments)}"</em>`;
            }
          } else {
            // Final approved case
            message = `Congratulations! Your permit <strong>${escapeHtml(permitRef)}</strong> has been <strong>fully approved</strong> by ${escapeHtml(approverName)}.`;
            message += `<br><br>The permit is now active and you can proceed with the planned work according to the terms and conditions specified in the permit.`;
            if (meta.comments) {
              message += `<br><br>Approval notes: <em>"${escapeHtml(meta.comments)}"</em>`;
            }
          }
          break;

        case 'permit_rejected':
          message = `Unfortunately, your permit <strong>${escapeHtml(permitRef)}</strong> has been <strong>rejected</strong> by ${escapeHtml(approverName)}.`;

          if (status === 'Rejected' && approverName.toLowerCase().includes('pre')) {
            // Rejected by pre-approver
            message += `<br><br>However, the permit has been forwarded to the final approver for further verification and validation. The final approver may review the rejection and make a final decision. You will be notified of any updates.`;
          } else {
            // Final rejection
            message += `<br><br>Please review the comments below and make necessary modifications before resubmitting your permit request.`;
          }

          if (meta.comments) {
            message += `<br><br>Reason for rejection: <em>"${escapeHtml(meta.comments)}"</em>`;
          } else {
            message += `<br><br>No specific reason was provided. Please contact the approver for more details.`;
          }
          break;

        case 'permit_updated':
          message = `Your permit <strong>${escapeHtml(permitRef)}</strong> has been <strong>updated</strong>.`;
          message += `<br><br>The current status is now <strong>${escapeHtml(status)}</strong>. `;

          if (meta.approverName) {
            message += `This update was made by ${escapeHtml(approverName)}.`;
          }

          if (meta.comments) {
            message += `<br><br>Update notes: <em>"${escapeHtml(meta.comments)}"</em>`;
          }

          message += `<br><br>Please review the permit details to see what has changed.`;
          break;

        case 'permit_submitted':
          message = `Your permit <strong>${escapeHtml(permitRef)}</strong> has been successfully submitted for review.`;
          message += `<br><br>It is currently <strong>Pending</strong> and awaiting review by the pre-approver. You will receive notifications as your permit moves through the approval workflow.`;
          break;

        default:
          message = escapeHtml(notif.message || 'Notification details');
      }

      return message;
    }

    // Helper to get status badge color class
    function getStatusBadgeClass(status) {
      const statusLower = String(status).toLowerCase();
      if (statusLower.includes('approve')) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      if (statusLower.includes('reject')) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      if (statusLower.includes('progress')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }

    function closeNotificationDetail() {
      if (detailModal) detailModal.classList.add('hidden');
    }

    // Mark notification as read
    async function markAsRead(notificationId) {
      try {
        await fetch(apiUrl(`/api/notifications/${notificationId}/read`), {
          method: 'PUT',
          credentials: 'include'
        });

        // Remove notification from local array
        const index = notifications.findIndex(n => (n._id || n.id) === notificationId);
        if (index > -1) {
          notifications.splice(index, 1);
        }

        // Re-render the list
        renderNotifications();

        // No toast for individual notification - cleaner UX
      } catch (e) {
        console.error('Error marking notification as read:', e);
        // On error, still try to remove from local array
        const index = notifications.findIndex(n => (n._id || n.id) === notificationId);
        if (index > -1) {
          notifications.splice(index, 1);
        }
        renderNotifications();
      }
    }

    // Mark all as read
    async function markAllRead() {
      try {
        await fetch(apiUrl('/api/notifications/mark-all-read'), {
          method: 'PUT',
          credentials: 'include'
        });

        // Clear all notifications from the local array
        notifications = [];
        renderNotifications();
        if (window.showToast) window.showToast('success', 'All notifications marked as read');
      } catch (e) {
        console.error('Error marking all as read:', e);
        if (window.showToast) window.showToast('error', 'Failed to mark notifications as read');
      }
    }

    // Helper functions
    function getNotificationIcon(type) {
      const icons = {
        'permit_approved': 'fas fa-check-circle',
        'permit_rejected': 'fas fa-times-circle',
        'permit_updated': 'fas fa-edit',
        'permit_submitted': 'fas fa-file-alt',
        'system': 'fas fa-info-circle'
      };
      return icons[type] || 'fas fa-bell';
    }

    function getNotificationColor(type) {
      const colors = {
        'permit_approved': 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400',
        'permit_rejected': 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
        'permit_updated': 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
        'permit_submitted': 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
        'system': 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400'
      };
      return colors[type] || 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
    }

    function formatNotificationTime(dateString) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
      } catch (e) {
        return '';
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Event listeners
    if (bellBtn) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
      });
    }

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        markAllRead();
      });
    }

    if (detailOverlay) {
      detailOverlay.addEventListener('click', closeNotificationDetail);
    }

    detailCloseButtons.forEach(btn => {
      btn.addEventListener('click', closeNotificationDetail);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (dropdownOpen && !bellBtn.contains(e.target) && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    // Close detail modal with ESC
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && detailModal && !detailModal.classList.contains('hidden')) {
        closeNotificationDetail();
      }
    });

    // Initial fetch and periodic updates
    fetchNotifications();
    setInterval(fetchNotifications, 60000); // Refresh every minute
  })();

  // --- Download Report Modal Logic ---
  // Open report modal when quick action is clicked (uses data-action on anchor)
  document.addEventListener('click', function (e) {
    try {
      const btn = e.target.closest && e.target.closest('[data-action="openReportModal"]');
      if (btn) {
        e.preventDefault();
        openDownloadReportModal();
      }
    } catch (_) { }
  });

  function openDownloadReportModal() {
    const modal = document.getElementById('download-report-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Initialize flatpickr once per modal
    try {
      if (window.flatpickr && !modal._fpInit) {
        flatpickr(document.getElementById('reportStartDate'), { dateFormat: 'Y-m-d' });
        flatpickr(document.getElementById('reportEndDate'), { dateFormat: 'Y-m-d' });
        modal._fpInit = true;
      }
    } catch (_) { }
  }

  document.getElementById('cancelReportDownload')?.addEventListener('click', function () {
    document.getElementById('download-report-modal').classList.add('hidden');
  });

  document.getElementById('downloadReportForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const format = document.getElementById('reportFormat').value;
    if (!startDate || !endDate || !format) {
      if (window.showToast) window.showToast('error', 'Please select dates and format');
      return;
    }
    try {
      // Use apiUrl so requests go to backend port (5000) when front-end served from Live Server (5500)
      const url = apiUrl(`/api/reports?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&format=${encodeURIComponent(format)}`);
      const res = await fetch(url, { method: 'GET', credentials: 'include' });

      if (!res.ok) {
        // try to read server-provided error message
        let msg = 'Failed to generate report';
        try {
          const j = await res.json().catch(() => ({}));
          if (j && j.message) msg = j.message;
        } catch (_) { /* ignore */ }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `PTW_Report_${startDate}_to_${endDate}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      document.getElementById('download-report-modal').classList.add('hidden');
      if (window.showToast) window.showToast('success', 'Report downloaded');
    } catch (err) {
      // Distinguish network errors (likely backend not running) from server errors
      const msg = err && err.message ? err.message : 'Download failed';
      if (window.showToast) window.showToast('error', msg);
    }
  });
  // --- End Download Report Modal Logic ---

  // Observe changes to <html> attributes related to theme so we can detect
  // external scripts that overwrite theme state. This logs changes and updates
  // the toggle icons so the UI stays synchronized.
  try {
    const html = document.documentElement;
    let lastTheme = html.getAttribute('data-theme') || (html.classList.contains('dark') ? 'dark' : 'light');
    const mo = new MutationObserver((records) => {
      records.forEach((rec) => {
        if (rec.type === 'attributes' && (rec.attributeName === 'data-theme' || rec.attributeName === 'class')) {
          const current = html.getAttribute('data-theme') || (html.classList.contains('dark') ? 'dark' : 'light');
          if (current !== lastTheme) {
            lastTheme = current;
            // keep UI in sync
            try { updateThemeToggleIcons(); } catch (e) { }
          }
        }
      });
    });
    mo.observe(html, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    // listen for our own dispatched event too
    window.addEventListener('theme:changed', () => {
      try { updateThemeToggleIcons(); } catch (e) { }
    });
  } catch (e) { /* ignore */ }

})();


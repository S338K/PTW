document.addEventListener('DOMContentLoaded', async function () {
  const API_BASE = 'https://ptw-yu8u.onrender.com';

  /* ===== SESSION CHECK ===== */
  async function checkSession() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { credentials: 'include' });
      if (!res.ok) {
        window.location.href = 'index.html'; // redirect if session expired
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch (err) {
      console.error('Session check failed:', err);
      window.location.href = 'index.html';
      return null;
    }
  }

  const user = await checkSession();
  if (user) {
    const fullName = document.getElementById('userFullName');
    if (fullName) {
      fullName.textContent = user.username;
    }
  }

  /* ===== IDLE TIMEOUT SETUP ===== */
  const IDLE_LIMIT = 10 * 60 * 1000; // 10 minutes
  let idleTimer;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(logoutUser, IDLE_LIMIT);
  }

  async function logoutUser() {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      alert('Logged out due to inactivity');
      window.location.href = 'index.html';
    });
  }

  ['mousemove', 'keydown', 'click'].forEach(evt => document.addEventListener(evt, resetIdleTimer));
  resetIdleTimer();


  // Function to handle the visibility trigger for cards
  const revealCards = () => {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();

      // Check if the card is in the viewport
      if (rect.top < window.innerHeight && rect.bottom >= 0) {
        card.classList.add('visible');  // Add 'visible' class when in viewport
      } else {
        card.classList.remove('visible');  // Remove it if out of viewport
      }
    });
  };

  // Trigger on page load
  revealCards();

  // Trigger on scroll
  window.addEventListener('scroll', revealCards);

  // Add the 'in-view' class when the element comes into the viewport
  function addInViewClassOnScroll() {
    const elements = document.querySelectorAll('.card, .form-container, .form-group, .profile-navbar, .md-input');

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isInView = rect.top >= 0 && rect.top <= window.innerHeight;

      if (isInView && !element.classList.contains('in-view')) {
        element.classList.add('in-view');
      }
    });
  }

  // Call the function on scroll and page load
  window.addEventListener('scroll', addInViewClassOnScroll);
  window.addEventListener('load', addInViewClassOnScroll);

  // Run it immediately in case elements are already in view (on initial page load)
  addInViewClassOnScroll();


  // =========================
  // Navbar buttons
  // =========================
  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      window.location.href = 'profile.html';
    });
  }

  /* ===== LOGOUT BUTTON ===== */
  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) {
    logoutButton.addEventListener('click', async function () {
      await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = 'index.html';
    });
  }

  // =========================
  // Utilities for validation
  // =========================
  function showErrorMessage(inputElement, errorMessage) {
    if (!inputElement) return;
    let container = inputElement.closest('.md-input') || inputElement.parentElement || inputElement;
    let error = container.querySelector('.error-message');
    if (!error) {
      error = document.createElement('span');
      error.className = 'error-message';
      error.style.color = 'darkred';
      error.style.fontSize = '0.9em';
      error.style.display = 'block';
      error.style.marginTop = '4px';
      container.appendChild(error);
    }
    error.textContent = errorMessage;
    inputElement.style.border = '2px solid red';
  }

  function hideErrorMessage(inputElement) {
    if (!inputElement) return;
    let container = inputElement.closest('.md-input') || inputElement.parentElement || inputElement;
    const error = container.querySelector('.error-message');
    if (error) error.remove();
    inputElement.style.border = '';
  }

  function validateField(inputElement, regex, errorMessage) {
    if (!inputElement) return true;
    const v = (inputElement.value || '').trim();
    if (!regex.test(v)) {
      showErrorMessage(inputElement, errorMessage);
      return false;
    }
    hideErrorMessage(inputElement);
    return true;
  }

  // =========================
  // Utilities for validation
  // =========================
  function showErrorMessage(inputElement, errorMessage) {
    if (!inputElement) return;
    let container = inputElement.closest('.md-input') || inputElement.parentElement || inputElement;
    let error = container.querySelector('.error-message');
    if (!error) {
      error = document.createElement('span');
      error.className = 'error-message';
      error.style.color = 'darkred';
      error.style.fontSize = '0.9em';
      error.style.display = 'block';
      error.style.marginTop = '4px';
      container.appendChild(error);
    }
    error.textContent = errorMessage;
    inputElement.style.border = '2px solid red';
  }

  function hideErrorMessage(inputElement) {
    if (!inputElement) return;
    let container = inputElement.closest('.md-input') || inputElement.parentElement || inputElement;
    const error = container.querySelector('.error-message');
    if (error) error.remove();
    inputElement.style.border = '';
  }

  function validateField(inputElement, regex, errorMessage) {
    if (!inputElement) return true;
    const v = (inputElement.value || '').trim();
    if (!regex.test(v)) {
      showErrorMessage(inputElement, errorMessage);
      return false;
    }
    hideErrorMessage(inputElement);
    return true;
  }

  // =========================
  // Requester details validation
  // =========================
  const validationFields = [
    { id: 'fullNameMD', regex: /^[A-Za-z\s]{1,50}$/, msg: 'Name must be alphabetic and under 50 characters.' },
    { id: 'lastName', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Last Name must be alphabetic and under 25 characters.' },
    { id: 'contactdetails', regex: /^\+974\d{8}$/, msg: 'Mobile number must be +974 followed by 8 digits.' },
    { id: 'altcontactdetails', regex: /^(\+974\d{8})?$/, msg: 'Alternate mobile number must be +974 followed by 8 digits.' },
    { id: 'corpemailid', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, msg: 'Enter a valid email address.' },
    { id: 'permitTitle', regex: /^[A-Za-z\s]{1,50}$/, msg: 'Permit title must be alphabetic and under 50 characters.' },
  ];

  validationFields.forEach(({ id, regex, msg }) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => validateField(el, regex, msg));
  });

  function validateRequesterDetails() {
    return validationFields.every(({ id, regex, msg }) => {
      const el = document.getElementById(id);
      return el ? validateField(el, regex, msg) : true;
    });
  }


  // =========================
  // Facility list update
  // =========================
  const facilityData = {
    'PTC': ['Arrival Hall', 'Baggage Hall', 'Check-In Area', 'Terminating Alpha', 'Terminating Bravo', 'Transfer Alpha', 'Transfer Bravo', 'Transfer Charlie', 'Dog Sniffing Area', 'Stand C1', 'Stand C2', 'Stand C3', 'Stand C4', 'Stand C5'],
    'RTBF': ['Employee Service Building', 'Customer Service Building', 'RTBF Baggage Hall', 'RTBF Baggage Control Room'],
    'QROC': ['Arrival Area', 'Departure Area', 'Baggage Hall Area']
  };

  const terminalEl = document.getElementById('terminal');
  const facilityEl = document.getElementById('facility');
  const facilityContainer = document.getElementById('facilityContainer');
  const specifyTerminalContainer = document.getElementById('specifyTerminalContainer');
  const specifyFacilityContainer = document.getElementById('specifyFacilityContainer');

  function resetFacilitySelect() {
    if (!facilityEl) return;
    facilityEl.innerHTML = '<option value="" disabled selected>Select the Facility</option>';
  }

  if (terminalEl) {
    terminalEl.addEventListener('change', function () {
      const selected = this.value;
      if (facilityData[selected]) {
        facilityContainer?.classList.remove('hidden');
        specifyTerminalContainer?.classList.add('hidden');
        specifyFacilityContainer?.classList.add('hidden');
        resetFacilitySelect();
        facilityData[selected].forEach(f => {
          const opt = document.createElement('option');
          opt.value = f;
          opt.textContent = f;
          facilityEl.appendChild(opt);
        });
      } else if (selected === 'Other') {
        facilityContainer?.classList.add('hidden');
        specifyTerminalContainer?.classList.remove('hidden');
        specifyFacilityContainer?.classList.remove('hidden');
        resetFacilitySelect();
      } else {
        facilityContainer?.classList.add('hidden');
        specifyTerminalContainer?.classList.add('hidden');
        specifyFacilityContainer?.classList.add('hidden');
        resetFacilitySelect();
      }
    });
  }
  // =========================
  // Impact on Operation fix (updated for Level of Impact + Equipment)
  // =========================
  const impactEl = document.getElementById('impact');
  if (impactEl) {
    impactEl.addEventListener('change', function () {
      const levelImpactContainer = document.getElementById('levelOfImpactContainer');
      const eqType = document.getElementById('equipmentType');
      const impactDetails = document.getElementById('impactDetails');

      const levelImpactInput = document.getElementById('levelOfImpact');
      const eqInput = document.getElementById('equipmentTypeInput');
      const impactInput = document.getElementById('impactDetailsInput');

      if (this.value === 'Yes') {
        levelImpactContainer.classList.remove('hidden');
        eqType.classList.remove('hidden');
        impactDetails.classList.remove('hidden');

        levelImpactInput.setAttribute('required', 'required');
        eqInput.setAttribute('required', 'required');
        impactInput.setAttribute('required', 'required');
      } else {
        levelImpactContainer.classList.add('hidden');
        eqType.classList.add('hidden');
        impactDetails.classList.add('hidden');

        levelImpactInput.removeAttribute('required');
        eqInput.removeAttribute('required');
        impactInput.removeAttribute('required');

        levelImpactInput.value = '';
        eqInput.value = '';
        impactInput.value = '';
      }
    });
  }

  // Always require Nature of Work and Work Description
  document.getElementById('natureOfWork')?.setAttribute('required', 'required');
  document.getElementById('workDescription')?.setAttribute('required', 'required');

  // =========================
  // Required Documents fix
  // =========================
  function setupDocToggle(radioYesId, radioNoId, containerId, inputId) {
    const yesRadio = document.getElementById(radioYesId);
    const noRadio = document.getElementById(radioNoId);
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);

    if (yesRadio && noRadio && container && input) {
      yesRadio.addEventListener('change', () => {
        if (yesRadio.checked) {
          container.classList.add('hidden');
          input.removeAttribute('required');
          input.value = '';
        }
      });
      noRadio.addEventListener('change', () => {
        if (noRadio.checked) {
          container.classList.remove('hidden');
          input.setAttribute('required', 'required');
        }
      });
    }
  }

  setupDocToggle('ePermitYes', 'ePermitNo', 'ePermitDetails', 'ePermitReason');
  setupDocToggle('fmmWorkorderYes', 'fmmWorkorderNo', 'fmmwrkordr', 'noFmmWorkorder');
  setupDocToggle('hseRiskYes', 'hseRiskNo', 'hseassmnt', 'noHseRiskAssessmentReason');
  setupDocToggle('opRiskYes', 'opRiskNo', 'opsassmnt', 'noOpsRiskAssessmentReason');

  // =========================
  // Date & time validation
  // =========================
  let fpStart = null;
  let fpEnd = null;

  if (typeof flatpickr !== 'undefined') {
    fpStart = flatpickr('#startDateTime', {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      minDate: 'today',
      time_24hr: true,
      onChange: function (selectedDates) {
        if (selectedDates && selectedDates[0] && fpEnd) {
          fpEnd.set('minDate', selectedDates[0]);
        }
      }
    });

    fpEnd = flatpickr('#endDateTime', {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      minDate: 'today',
      time_24hr: true
    });
  }

  function validateDateTime() {
    const startEl = document.getElementById('startDateTime');
    const endEl = document.getElementById('endDateTime');
    const now = new Date();

    let startDate = fpStart?.selectedDates?.[0] || (startEl?.value ? new Date(startEl.value) : null);
    let endDate = fpEnd?.selectedDates?.[0] || (endEl?.value ? new Date(endEl.value) : null);

    let valid = true;

    if (!startDate || isNaN(startDate.getTime())) {
      showErrorMessage(startEl, 'Please select a valid start date and time');
      valid = false;
    } else if (startDate <= now) {
      showErrorMessage(startEl, 'Start date/time must be in the future');
      valid = false;
    } else {
      hideErrorMessage(startEl);
    }

    if (!endDate || isNaN(endDate.getTime())) {
      showErrorMessage(endEl, 'Please select a valid end date and time');
      valid = false;
    } else if (endDate <= now) {
      showErrorMessage(endEl, 'End date/time must be in the future');
      valid = false;
    } else {
      hideErrorMessage(endEl);
    }

    if (startDate && endDate && endDate <= startDate) {
      showErrorMessage(endEl, 'End date & time must be after Start date & time');
      valid = false;
    }

    return valid;
  }

  // =========================
  // File upload module (unified)
  // =========================
  const fileInput = document.getElementById('fileUpload');
  const fileListEl = document.getElementById('uploadedFiles');
  const typeMsg = document.getElementById('fileTypeMessage');
  let selectedFiles = [];

  const allowedExt = ['.jpg', '.jpeg', '.pdf'];
  const MAX_TOTAL = 3 * 1024 * 1024; // 3 MB

  function setUploadError(message) {
    if (typeMsg) typeMsg.textContent = message;
    const label = document.querySelector(`label[for="${fileInput?.id}"]`);
    if (label) label.classList.add('upload-error');
  }
  function clearUploadError() {
    if (typeMsg) typeMsg.textContent = '';
    const label = document.querySelector(`label[for="${fileInput?.id}"]`);
    if (label) label.classList.remove('upload-error');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const li = document.createElement('li');

      const info = document.createElement('span');
      info.textContent = `${file.name} (${formatSize(file.size)})`;

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '❌';
      removeBtn.classList.add('delete-file-btn');
      removeBtn.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        renderFileList();
        fileInput.value = ''; // allow re‑selecting same file
        if (selectedFiles.length === 0) clearUploadError();
      });

      li.appendChild(info);
      li.appendChild(removeBtn);
      fileListEl.appendChild(li);
    });
  }

  function handleNewSelection(newFiles) {
    let total = selectedFiles.reduce((s, f) => s + f.size, 0);

    for (const file of newFiles) {
      const nameLower = file.name.toLowerCase();

      // Extension check
      const isAllowed = allowedExt.some(ext => nameLower.endsWith(ext));
      if (!isAllowed) {
        setUploadError('Only .jpg, .jpeg, and .pdf files are allowed.');
        continue;
      }

      // Duplicate name check
      const isDuplicate = selectedFiles.some(f => f.name.toLowerCase() === nameLower);
      if (isDuplicate) {
        setUploadError(`Duplicate file detected: ${file.name}`);
        continue;
      }

      // Total size check
      if (total + file.size > MAX_TOTAL) {
        setUploadError('Total file size must not exceed 3 MB.');
        continue;
      }

      selectedFiles.push(file);
      total += file.size;
      clearUploadError();
    }
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const newFiles = Array.from(e.target.files || []);
      if (newFiles.length === 0) return;
      handleNewSelection(newFiles);
      renderFileList();
      fileInput.value = ''; // reset so same file triggers change
    });
  }

  function validateFileUpload() {
    return selectedFiles.length > 0 && (!typeMsg || typeMsg.textContent === '');
  }
  // =========================
  // Signature defaults + auto-fill from full name
  // =========================
  (function fillSignatureDefaults() {
    const signDate = document.getElementById('signDate');
    const signTime = document.getElementById('signTime');
    const now = new Date();
    if (signDate && !signDate.value) {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      signDate.value = `${y}-${m}-${d}`;
    }
    if (signTime && !signTime.value) {
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      signTime.value = `${hh}:${mm}`;
    }
  })();

  const fullNameInput = document.getElementById('fullName');
  const signNameInput = document.getElementById('signName');
  if (fullNameInput && signNameInput) {
    const sync = () => { signNameInput.value = fullNameInput.value; };
    fullNameInput.addEventListener('input', sync);
    sync();
  }

  // =========================
  // Conditions validation
  // =========================
  function validateConditions() {
    const checkbox = document.getElementById('confirmConditions');
    if (!checkbox) return true;
    if (!checkbox.checked) {
      alert('You must agree to the conditions before submitting.');
      return false;
    }
    return true;
  }

  // =========================
  // Signature validation
  // =========================
  function validateSignature() {
    const fields = ['signName', 'signDate', 'signTime', 'designation'];
    let ok = true;
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.value || !el.value.toString().trim()) {
        showErrorMessage(el, 'This field is required');
        ok = false;
      } else {
        hideErrorMessage(el);
      }
    });
    return ok;
  }

  // ==========================
  // Form submission
  // ==========================
  const form = document.getElementById('permitForm');
  const submitBtn = document.getElementById('submitBtn');

  if (form) {
    // Main submit handler (fires for both Enter and button click)
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      console.log('Form submission triggered');

      const ok =
        validateRequesterDetails() &&
        validateDateTime() &&
        validateFileUpload() &&
        validateSignature() &&
        validateConditions();

      if (!ok) {
        alert('Please review highlighted fields and complete all required details.');
        return;
      }

      // Optional: disable button to prevent double clicks
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      const formData = new FormData(form);
      formData.delete('files');
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      try {
        const res = await fetch(`${API_BASE}/api/permit`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (res.ok) {
          alert('Form submitted successfully!');
          form.reset();
          selectedFiles = [];
          renderFileList();

          // Reset signature defaults
          const now = new Date();
          const signDate = document.getElementById('signDate');
          const signTime = document.getElementById('signTime');
          if (signDate) {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            signDate.value = `${y}-${m}-${d}`;
          }
          if (signTime) {
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            signTime.value = `${hh}:${mm}`;
          }
          if (fullNameInput && signNameInput) {
            signNameInput.value = fullNameInput.value;
          }

          // Reset UI sections
          const fileMsg = document.getElementById('fileTypeMessage');
          if (fileMsg) fileMsg.textContent = '';
          if (facilityContainer) facilityContainer.classList.add('hidden');
          if (specifyTerminalContainer) specifyTerminalContainer.classList.add('hidden');
          if (specifyFacilityContainer) specifyFacilityContainer.classList.add('hidden');
          if (facilityEl) facilityEl.innerHTML = '<option value="" disabled selected>Select the Facility</option>';

          const equipmentTypeSection = document.getElementById('equipmentType');
          const impactDetailsSection = document.getElementById('impactDetails');
          const levelImpactSection = document.getElementById('levelOfImpactContainer');
          if (equipmentTypeSection) equipmentTypeSection.classList.add('hidden');
          if (impactDetailsSection) impactDetailsSection.classList.add('hidden');
          if (levelImpactSection) levelImpactSection.classList.add('hidden');

          document.querySelectorAll('.error-message').forEach(n => n.remove());
          document.querySelectorAll('input, textarea, select').forEach(el => { el.style.border = ''; });
        } else {
          const err = await res.json();
          alert('Error: ' + (err.message || 'Unable to submit form'));
        }
      } catch (error) {
        console.error('Submit error:', error);
        alert('Network or Server error while submitting form.');
      } finally {
        // Re-enable button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      }
    });

    // Explicitly wire the button too (in case it's outside the <form>)
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        form.requestSubmit(); // triggers the form's submit event
      });
    }
  }
})

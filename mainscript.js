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

  // ==========================
  // Utilities for validation
  // ==========================
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

  // ==========================
  // Requester details validation
  // ==========================
  const validationFields = [
    { id: 'fullName', regex: /^[A-Za-z\s]{1,50}$/, msg: 'Name must be alphabetic and under 50 characters.' },
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

  // ==========================
  // Work details validation & facility logic
  // ==========================
  const facilityData = {
    'PTC': [
      'Arrival Hall', 'Baggage Hall', 'Check-In Area',
      'Terminating Alpha', 'Terminating Bravo',
      'Transfer Alpha', 'Transfer Bravo', 'Transfer Charlie',
      'Dog Sniffing Area', 'Stand C1', 'Stand C2', 'Stand C3', 'Stand C4', 'Stand C5'
    ],
    'RTBF': [
      'Employee Service Building', 'Customer Service Building',
      'RTBF Baggage Hall', 'RTBF Baggage Control Room'
    ],
    'QROC': [
      'Arrival Area', 'Departure Area', 'Baggage Hall Area'
    ]
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

  // Impact on Operation conditional fields
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


  // ==========================
  // Documents Required
  // ==========================
  function setupDocToggle(radioYesId, radioNoId, containerId, inputId) {
    const yesRadio = document.getElementById(radioYesId);
    const noRadio = document.getElementById(noRadioId);
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

  // ==========================
  // Bind file inputs to radios + inline preview
  // ==========================
  function bindDocWithFile(yesId, noId, fileId, label) {
    const yesRadio = document.getElementById(yesId);
    const noRadio = document.getElementById(noId);
    const fileInput = document.getElementById(fileId);

    if (!yesRadio || !noRadio || !fileInput) return;

    yesRadio.addEventListener('change', () => {
      if (yesRadio.checked) {
        fileInput.setAttribute('required', 'required');
        if (!fileInput.files || fileInput.files.length === 0) {
          showErrorMessage(fileInput, `${label} must be uploaded`);
        }
      }
    });

    noRadio.addEventListener('change', () => {
      if (noRadio.checked) {
        fileInput.removeAttribute('required');
        hideErrorMessage(fileInput);
        const preview = fileInput.closest('.md-input')?.querySelector('.file-preview');
        if (preview) preview.remove();
      }
    });

    fileInput.addEventListener('change', () => {
      const container = fileInput.closest('.md-input') || fileInput.parentElement;
      let preview = container.querySelector('.file-preview');
      if (preview) preview.remove();

      if (fileInput.files && fileInput.files.length > 0) {
        hideErrorMessage(fileInput);
        preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.style.fontSize = '0.85em';
        preview.style.marginTop = '4px';

        const file = fileInput.files[0];
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.style.maxWidth = '120px';
          img.style.maxHeight = '120px';
          img.style.display = 'block';
          img.style.marginTop = '4px';
          img.style.border = '1px solid #ccc';
          img.style.borderRadius = '4px';
          preview.appendChild(img);
        } else {
          preview.textContent = `Selected: ${file.name}`;
        }
        container.appendChild(preview);
      } else if (yesRadio.checked) {
        showErrorMessage(fileInput, `${label} must be uploaded`);
      }
    });
  }

  bindDocWithFile('ePermitYes', 'ePermitNo', 'ePermitFile', 'E-Permit document');
  bindDocWithFile('fmmWorkorderYes', 'fmmWorkorderNo', 'fmmWorkorderFile', 'FMM Workorder document');
  bindDocWithFile('hseRiskYes', 'hseRiskNo', 'hseRiskFile', 'HSE Risk Assessment document');
  bindDocWithFile('opRiskYes', 'opRiskNo', 'opRiskFile', 'Operational Risk Assessment document');

  // ==========================
  // Validation on submit
  // ==========================
  function validateRequiredDocs() {
    let valid = true;
    const docRules = [
      { yesId: 'ePermitYes', fileId: 'ePermitFile', label: 'E-Permit document' },
      { yesId: 'fmmWorkorderYes', fileId: 'fmmWorkorderFile', label: 'FMM Workorder document' },
      { yesId: 'hseRiskYes', fileId: 'hseRiskFile', label: 'HSE Risk Assessment document' },
      { yesId: 'opRiskYes', fileId: 'opRiskFile', label: 'Operational Risk Assessment document' }
    ];

    docRules.forEach(({ yesId, fileId, label }) => {
      const yesRadio = document.getElementById(yesId);
      const fileInput = document.getElementById(fileId);

      if (yesRadio && yesRadio.checked) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          showErrorMessage(fileInput, `${label} must be uploaded`);
          valid = false;
        } else {
          hideErrorMessage(fileInput);
        }
      } else {
        if (fileInput) hideErrorMessage(fileInput);
      }
    });

    return valid;
  }

  // ==========================
  // General File Upload (attachments)
  // ==========================
  let selectedFiles = [];

  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('fileList');
  const fileTypeMessage = document.getElementById('fileTypeMessage');

  function renderFileList() {
    if (!fileList) return;
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.textContent = file.name;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        renderFileList();
      });
      li.appendChild(removeBtn);
      fileList.appendChild(li);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      files.forEach(file => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(file.type)) {
          fileTypeMessage.textContent = 'Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          fileTypeMessage.textContent = 'File size must be under 5MB';
          return;
        }
        if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
          fileTypeMessage.textContent = 'Duplicate file skipped';
          return;
        }
        selectedFiles.push(file);
      });
      renderFileList();
      fileInput.value = '';
    });
  }

  function validateFileUpload() {
    if (selectedFiles.length === 0) {
      showErrorMessage(fileInput, 'Please upload at least one supporting file');
      return false;
    }
    hideErrorMessage(fileInput);
    return true;
  }


  // ==========================
  // Date & Time validation
  // ==========================
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


  // ==========================
  // Signature auto-fill & validation
  // ==========================
  const fullNameInput = document.getElementById('fullName');
  const signNameInput = document.getElementById('signName');
  const signDate = document.getElementById('signDate');
  const signTime = document.getElementById('signTime');

  // Auto-fill signature name from full name
  if (fullNameInput && signNameInput) {
    fullNameInput.addEventListener('input', () => {
      signNameInput.value = fullNameInput.value;
    });
  }

  // Default date/time for signature
  (function setDefaultSignatureDateTime() {
    const now = new Date();
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
  })();

  function validateSignature() {
    let valid = true;
    if (!signNameInput || !signNameInput.value.trim()) {
      showErrorMessage(signNameInput, 'Signature name is required');
      valid = false;
    } else {
      hideErrorMessage(signNameInput);
    }
    if (!signDate || !signDate.value.trim()) {
      showErrorMessage(signDate, 'Signature date is required');
      valid = false;
    } else {
      hideErrorMessage(signDate);
    }
    if (!signTime || !signTime.value.trim()) {
      showErrorMessage(signTime, 'Signature time is required');
      valid = false;
    } else {
      hideErrorMessage(signTime);
    }
    return valid;
  }
  // ==========================
  // Conditions validation
  // ==========================
  function validateConditions() {
    const conditionsCheckbox = document.getElementById('conditions');
    if (!conditionsCheckbox || !conditionsCheckbox.checked) {
      showErrorMessage(conditionsCheckbox, 'You must agree to the conditions before submitting');
      return false;
    }
    hideErrorMessage(conditionsCheckbox);
    return true;
  }

  // ==========================
  // Form submission
  // ==========================
  const form = document.getElementById('permitForm');
  const submitBtn = document.getElementById('submitBtn');

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const ok =
        validateRequesterDetails() &&
        validateDateTime() &&
        validateRequiredDocs() &&   // ✅ now bound to radios + file inputs
        validateFileUpload() &&
        validateSignature() &&
        validateConditions();

      if (!ok) {
        // Scroll to first error for better UX
        const firstError = document.querySelector('.error-message');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

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

          // Clear error messages and borders
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
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      }
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        form.requestSubmit(); // triggers the form's submit event
      });
    }
  }
})

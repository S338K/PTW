document.addEventListener('DOMContentLoaded', function () {

  // =========================
  // Session guard + idle timer
  // =========================
  const currentPage = window.location.pathname.split('/').pop();

  if (currentPage !== 'index.html' && !sessionStorage.getItem('isLoggedIn')) {
    window.location.href = 'index.html';
    return;
  }

  if (sessionStorage.getItem('isLoggedIn')) {
    function logoutUser() {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }

    function resetIdleTimer() {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    }

    function checkIdleTime() {
      const last = parseInt(sessionStorage.getItem('lastActivity') || '0', 10);
      if (!last || Date.now() - last > 5 * 60 * 1000) {
        logoutUser();
      }
    }

    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart', 'touchmove'].forEach(evt =>
      document.addEventListener(evt, resetIdleTimer, { passive: true })
    );

    setInterval(checkIdleTime, 30000);
    resetIdleTimer();
  }

  // =========================
  // Navbar buttons
  // =========================
  const logoutBtn = document.getElementById('logoutBtn');
  const profileBtn = document.getElementById('profileBtn');
  const submitNewBtn = document.getElementById('submitNewBtn');

  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });

  if (profileBtn) profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });

  if (submitNewBtn) submitNewBtn.addEventListener('click', () => {
    window.location.href = 'mainpage.html';
  });

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
    { id: 'fullNameMD', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Name must be alphabetic and under 25 characters.' },
    { id: 'lastName', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Last Name must be alphabetic and under 25 characters.' },
    { id: 'contactdetails', regex: /^\+974\d{8}$/, msg: 'Mobile must be +974 followed by 8 digits.' },
    { id: 'altcontactdetails', regex: /^(\+974\d{8})?$/, msg: 'Alternate mobile must be +974 followed by 8 digits or left blank.' },
    { id: 'corpemailid', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, msg: 'Enter a valid corporate email.' },
    { id: 'buildingNo', regex: /^\d{1,2}$/, msg: 'Building No. should be 1–2 digits.' },
    { id: 'floorNo', regex: /^\d{1,2}$/, msg: 'Floor No. should be 1–2 digits.' },
    { id: 'streetNo', regex: /^\d{1,3}$/, msg: 'Street No. should be 1–3 digits.' },
    { id: 'zone', regex: /^\d{1,2}$/, msg: 'Zone should be 1–2 digits.' },
    { id: 'city', regex: /^[A-Za-z\s]+$/, msg: 'City should be alphabetic.' },
    { id: 'country', regex: /^[A-Za-z\s]+$/, msg: 'Country should be alphabetic.' },
    { id: 'poBox', regex: /^\d{1,6}$/, msg: 'P.O. Box should be 1–6 digits.' }
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

  
// ====== Impact on Operation Conditional Fields ======
const impactSelect = document.getElementById('impact');
const equipmentTypeSection = document.getElementById('equipmentType');
const impactDetailsSection = document.getElementById('impactDetails');

if (impactSelect) {
  impactSelect.addEventListener('change', function () {
    if (this.value === 'Yes') {
      equipmentTypeSection.classList.remove('hidden');
      impactDetailsSection.classList.remove('hidden');
    } else {
      equipmentTypeSection.classList.add('hidden');
      impactDetailsSection.classList.add('hidden');
      // Clear fields
      document.querySelectorAll('#equipmentType input, #equipmentType select, #equipmentType textarea, #impactDetails input, #impactDetails select, #impactDetails textarea')
        .forEach(el => el.value = '');
    }
  });
}

// ====== Requested Documents Conditional Fields ======
function setupRadioToggle(radioYesId, radioNoId, targetSectionId) {
  const yesRadio = document.getElementById(radioYesId);
  const noRadio = document.getElementById(radioNoId);
  const targetSection = document.getElementById(targetSectionId);

  if (yesRadio && noRadio && targetSection) {
    const hideSection = () => {
      targetSection.classList.add('hidden');
      targetSection.querySelectorAll('input, select, textarea').forEach(el => el.value = '');
    };
    const showSection = () => {
      targetSection.classList.remove('hidden');
    };

    yesRadio.addEventListener('change', function () {
      if (this.checked) hideSection();
    });
    noRadio.addEventListener('change', function () {
      if (this.checked) showSection();
    });
  }
}

// ePermit
setupRadioToggle('ePermitYes', 'ePermitNo', 'ePermitDetails');
// FMM Workorder
setupRadioToggle('fmmWorkorderYes', 'fmmWorkorderNo', 'fmmwrkordr');
// HSE Risk Assessment
setupRadioToggle('hseRiskYes', 'hseRiskNo', 'hseassmnt');
// Operations Risk Assessment
setupRadioToggle('opRiskYes', 'opRiskNo', 'opsassmnt');

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
      showErrorMessage(endEl, 'End date/time must be after start date/time');
      valid = false;
    }

    return valid;
  }

  // =========================
  // File upload validation
  // =========================
  (function setupFileUploadValidation() {
    const fileInput = document.getElementById('fileUpload');
    const typeMsg = document.getElementById('fileTypeMessage');
    const list = document.getElementById('uploadedFiles');
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg'];

    if (!fileInput) return;

    function validateFiles() {
      if (!fileInput.files || fileInput.files.length === 0) {
        if (typeMsg) typeMsg.textContent = '';
        if (list) list.innerHTML = '';
        hideErrorMessage(fileInput);
        return true;
      }
      for (const file of fileInput.files) {
        if (!allowed.includes(file.type)) {
          showErrorMessage(fileInput, 'Only PDF or JPG/JPEG files are allowed');
          if (typeMsg) typeMsg.textContent = 'Only PDF or JPG/JPEG files are allowed.';
          return false;
        }
      }
      hideErrorMessage(fileInput);
      if (typeMsg) typeMsg.textContent = '';
      return true;
    }

    function renderList() {
      if (!list) return;
      list.innerHTML = '';
      Array.from(fileInput.files).forEach(f => {
        const li = document.createElement('li');
        li.textContent = `${f.name} (${Math.round(f.size / 1024)} KB)`;
        list.appendChild(li);
      });
    }

    fileInput.addEventListener('change', () => {
      const ok = validateFiles();
      if (ok) renderList();
    });

    window.__validateFileUpload = validateFiles;
  })();

  function validateFileUpload() {
    return typeof window.__validateFileUpload === 'function'
      ? window.__validateFileUpload()
      : true;
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

  const fullNameInput = document.getElementById('fullNameMD');
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

  // =========================
  // Form submit handler
  // =========================
  const form = document.getElementById('permitForm');
  const submitBtn = document.getElementById('submitBtn');

  if (submitBtn && form) {
    submitBtn.addEventListener('click', function (e) {
      e.preventDefault();

      const ok =
        validateRequesterDetails() &&
        validateWorkDetails &&
        validateRequiredDocuments &&
        validateDateTime() &&
        validateFileUpload() &&
        validateSignature() &&
        validateConditions();

      if (ok) {
        alert('Form submitted successfully!');
        form.reset();

        // Re-apply defaults
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

        const fileList = document.getElementById('uploadedFiles');
        const fileMsg = document.getElementById('fileTypeMessage');
        if (fileList) fileList.innerHTML = '';
        if (fileMsg) fileMsg.textContent = '';

        if (facilityContainer) facilityContainer.classList.add('hidden');
        if (specifyTerminalContainer) specifyTerminalContainer.classList.add('hidden');
        if (specifyFacilityContainer) specifyFacilityContainer.classList.add('hidden');
        if (facilityEl) facilityEl.innerHTML = '<option value="" disabled selected>Select the Facility</option>';

        equipmentTypeSection?.classList.add('hidden');
        impactDetailsSection?.classList.add('hidden');

        document.querySelectorAll('.error-message').forEach(n => n.remove());
        document.querySelectorAll('input, textarea, select').forEach(el => { el.style.border = ''; });
      } else {
        alert('Please review highlighted fields and complete all required details.');
      }
    });
  }

});

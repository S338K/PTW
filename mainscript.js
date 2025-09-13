document.addEventListener('DOMContentLoaded', function () {

  // =========================
  // Utility Functions
  // =========================
  function validateField(inputElement, regex, errorMessage) {
    if (!regex.test(inputElement.value.trim())) {
      inputElement.style.border = '2px solid red';
      showErrorMessage(inputElement, errorMessage);
      return false;
    } else {
      inputElement.style.border = '2px solid green';
      hideErrorMessage(inputElement);
      return true;
    }
  }

  function showErrorMessage(inputElement, errorMessage) {
    let errorMessageElement = inputElement.parentElement.querySelector('.error-message');
    if (!errorMessageElement) {
      errorMessageElement = document.createElement('span');
      errorMessageElement.classList.add('error-message');
      errorMessageElement.style.color = 'darkred';
      errorMessageElement.style.fontSize = '0.9em';
      inputElement.parentElement.appendChild(errorMessageElement);
    }
    errorMessageElement.textContent = errorMessage;
  }

  function hideErrorMessage(inputElement) {
    const errorMessageElement = inputElement.parentElement.querySelector('.error-message');
    if (errorMessageElement) errorMessageElement.remove();
  }

  // =========================
  // 1. Requester Details Validation (real-time)
  // =========================
  const validationFields = [
    { id: 'fullNameMD', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Name must be alphabetic and less than 25 characters' },
    { id: 'lastName', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Last Name must be alphabetic and less than 25 characters' },
    { id: 'contactdetails', regex: /^\+974\d{8}$/, msg: 'Mobile Number must be in the format +974XXXXXXXX' },
    { id: 'altcontactdetails', regex: /^(\+974\d{8})?$/, msg: 'Alternate Mobile Number must be in the format +974XXXXXXXX or empty' },
    { id: 'corpemailid', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, msg: 'Please enter a valid email address' },
    { id: 'buildingNo', regex: /^\d{1,2}$/, msg: 'Building number should be a number (max 2 digits)' },
    { id: 'floorNo', regex: /^\d{1,2}$/, msg: 'Floor number should be a number (max 2 digits)' },
    { id: 'streetNo', regex: /^\d{1,3}$/, msg: 'Street number should be a number (max 3 digits)' },
    { id: 'zone', regex: /^\d{1,2}$/, msg: 'Zone should be a number (max 2 digits)' },
    { id: 'city', regex: /^[A-Za-z\s]+$/, msg: 'City should be alphabetic' },
    { id: 'country', regex: /^[A-Za-z\s]+$/, msg: 'Country should be alphabetic' },
    { id: 'poBox', regex: /^\d{1,6}$/, msg: 'P.O. Box should be a number (max 6 digits)' },
  ];

  validationFields.forEach(({ id, regex, msg }) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', function () { validateField(this, regex, msg); });
  });

  function validateRequesterDetails() {
    return validationFields.every(({ id, regex, msg }) => {
      const el = document.getElementById(id);
      return el ? validateField(el, regex, msg) : true;
    });
  }

  // =========================
  // 2. Work Details + Dynamic Logic
  // =========================
  const facilityData = {
    'PTC': ['Arrival Hall', 'Baggage Hall', 'Check-In Area', 'Terminating Alpha', 'Terminating Bravo', 'Transfer Alpha', 'Transfer Bravo', 'Transfer Charlie', 'Dog Sniffing Area', 'Stand C1', 'Stand C2', 'Stand C3', 'Stand C4', 'Stand C5'],
    'RTBF': ['Facility D', 'Facility E'],
    'QROC': ['Facility F', 'Facility G']
  };

  const terminalEl = document.getElementById('terminal');
  const facilityEl = document.getElementById('facility');
  const facilityContainer = document.getElementById('facilityContainer');
  const specifyTerminalContainer = document.getElementById('specifyTerminalContainer');
  const specifyFacilityContainer = document.getElementById('specifyFacilityContainer');

  terminalEl.addEventListener('change', function () {
    const selected = this.value;
    if (facilityData[selected]) {
      facilityContainer.classList.remove('hidden');
      specifyTerminalContainer.classList.add('hidden');
      specifyFacilityContainer.classList.add('hidden');
      facilityEl.innerHTML = '<option value="" disabled selected>Select the Facility</option>';
      facilityData[selected].forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        facilityEl.appendChild(opt);
      });
    } else if (selected === 'Other') {
      facilityContainer.classList.add('hidden');
      specifyTerminalContainer.classList.remove('hidden');
      specifyFacilityContainer.classList.remove('hidden');
    } else {
      facilityContainer.classList.add('hidden');
      specifyTerminalContainer.classList.add('hidden');
      specifyFacilityContainer.classList.add('hidden');
    }
  });

  // Impact on Operation dynamic logic
  const impactEl = document.getElementById('impact');
  const equipmentType = document.getElementById('equipmentType');
  const impactDetails = document.getElementById('impactDetails');

  impactEl.addEventListener('change', function () {
    if (this.value === 'Yes') {
      equipmentType.classList.remove('hidden');
      impactDetails.classList.remove('hidden');
    } else {
      equipmentType.classList.add('hidden');
      impactDetails.classList.add('hidden');
    }
  });

  function validateWorkDetails() {
    // Placeholder for additional work details validation if needed
    return true;
  }

  // =========================
  // 3. Required Documents
  // =========================
  function setupReasonToggle(yesId, noId, reasonId) {
    const yesEl = document.getElementById(yesId);
    const noEl = document.getElementById(noId);
    const reasonEl = document.getElementById(reasonId);

    if (yesEl && noEl && reasonEl) {
      yesEl.addEventListener('change', () => {
        reasonEl.parentElement.style.display = 'none';
        reasonEl.required = false;
        hideErrorMessage(reasonEl);
      });
      noEl.addEventListener('change', () => {
        reasonEl.parentElement.style.display = 'block';
        reasonEl.required = true;
      });
      reasonEl.addEventListener('input', () => {
        if (!reasonEl.value.trim()) {
          showErrorMessage(reasonEl, 'Please provide a reason');
        } else {
          hideErrorMessage(reasonEl);
        }
      });
    }
  }

  setupReasonToggle('ePermitYes', 'ePermitNo', 'ePermitReason');
  setupReasonToggle('riskYes', 'riskNo', 'riskReason');
  setupReasonToggle('methodYes', 'methodNo', 'methodReason');

  function validateRequiredDocuments() {
    let valid = true;
    const docGroups = [
      { yes: 'ePermitYes', no: 'ePermitNo', reason: 'ePermitReason' },
      { yes: 'riskYes', no: 'riskNo', reason: 'riskReason' },
      { yes: 'methodYes', no: 'methodNo', reason: 'methodReason' }
    ];
    docGroups.forEach(({ yes, no, reason }) => {
      const yesEl = document.getElementById(yes);
      const noEl = document.getElementById(no);
      const reasonEl = document.getElementById(reason);
      if (!yesEl.checked && !noEl.checked) {
        showErrorMessage(yesEl, 'Please select Yes or No');
        valid = false;
      }
      if (noEl.checked && !reasonEl.value.trim()) {
        showErrorMessage(reasonEl, 'Please provide a reason');
        valid = false;
      }
    });
    return valid;
  }

  // =========================
  // 4. Date & Time Validation
  // =========================
  // If you're using flatpickr in HTML (class="datetime-picker"), initialize it here
  let fpStart = null;
  let fpEnd = null;

  if (typeof flatpickr !== 'undefined') {
    fpStart = flatpickr('#startDateTime', {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      minDate: 'today',
      time_24hr: true,
      onChange: function (selectedDates) {
        if (selectedDates && selectedDates[0]) {
          // Ensure end can't be before start
          if (fpEnd) fpEnd.set('minDate', selectedDates[0]);
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

    let startVal = startEl?.value?.trim() || '';
    let endVal = endEl?.value?.trim() || '';

    // Prefer flatpickr selectedDates if available for reliable parsing
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (fpStart && fpStart.selectedDates && fpStart.selectedDates[0]) {
      startDate = fpStart.selectedDates[0];
    } else if (startVal) {
      startDate = new Date(startVal);
    }

    if (fpEnd && fpEnd.selectedDates && fpEnd.selectedDates[0]) {
      endDate = fpEnd.selectedDates[0];
    } else if (endVal) {
      endDate = new Date(endVal);
    }

    let valid = true;

    if (!startDate) {
      showErrorMessage(startEl, 'Please select a start date and time');
      valid = false;
    } else if (startDate <= now) {
      showErrorMessage(startEl, 'Start date/time must be in the future');
      valid = false;
    } else {
      hideErrorMessage(startEl);
    }

    if (!endDate) {
      showErrorMessage(endEl, 'Please select an end date and time');
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
  // 5. File Upload Validation
  // =========================
  (function setupFileUploadValidation() {
    const fileInput = document.getElementById('fileUpload');
    const typeMsg = document.getElementById('fileTypeMessage');
    const list = document.getElementById('uploadedFiles');
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg'];

    if (!fileInput) return;

    function validateFiles() {
      if (fileInput.files.length === 0) {
        if (typeMsg) typeMsg.textContent = '';
        if (list) list.innerHTML = '';
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

    // Expose for submit validation
    window.__validateFileUpload = validateFiles;
  })();

  function validateFileUpload() {
    return typeof window.__validateFileUpload === 'function'
      ? window.__validateFileUpload()
      : true;
  }

  // =========================
  // 6. Signature Validation
  // =========================
  // Optionally auto-fill readonly fields for signDate and signTime
  (function fillSignatureDefaults() {
    const signDate = document.getElementById('signDate');
    const signTime = document.getElementById('signTime');
    const signName = document.getElementById('signName');

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM

    if (signDate && !signDate.value) signDate.value = dateStr;
    if (signTime && !signTime.value) signTime.value = timeStr;

    // If you have a profile name in session/localStorage, you can set it here
    // Example:
    // const profileName = localStorage.getItem('profileName');
    // if (signName && !signName.value && profileName) signName.value = profileName;
  })();

  function validateSignature() {
    const requiredIds = ['signName', 'signDate', 'signTime', 'designation'];
    let valid = true;

    requiredIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!el.value || !el.value.toString().trim()) {
        showErrorMessage(el, 'This field is required');
        valid = false;
      } else {
        hideErrorMessage(el);
      }
    });

    return valid;
  }

  // =========================
  // 7. Conditions Validation
  // =========================
  function validateConditions() {
    const checkbox = document.getElementById('confirmConditions');
    if (!checkbox) return true; // if not present, don't block
    if (!checkbox.checked) {
      alert('You must agree to the conditions before submitting.');
      return false;
    }
    return true;
  }

  // =========================
  // 8. Required Documents Toggles (IDs aligned to your HTML)
  // =========================
  (function setupRequiredDocsToggles() {
    function toggleGroup(yesId, noId, containerId, reasonInputId) {
      const yesEl = document.getElementById(yesId);
      const noEl = document.getElementById(noId);
      const container = document.getElementById(containerId);
      const reasonEl = document.getElementById(reasonInputId);

      if (!yesEl || !noEl || !container || !reasonEl) return;

      function showReason(show) {
        container.classList.toggle('hidden', !show);
        container.style.display = show ? 'block' : 'none';
        reasonEl.required = show;
        if (!show) hideErrorMessage(reasonEl);
      }

      yesEl.addEventListener('change', () => showReason(false));
      noEl.addEventListener('change', () => showReason(true));
      reasonEl.addEventListener('input', () => {
        if (!reasonEl.value.trim()) {
          showErrorMessage(reasonEl, 'Please provide a reason');
        } else {
          hideErrorMessage(reasonEl);
        }
      });
    }

    // Map to your actual IDs from HTML
    toggleGroup('ePermitYes', 'ePermitNo', 'ePermitDetails', 'ePermitReason');
    toggleGroup('fmmWorkorderYes', 'fmmWorkorderNo', 'fmmwrkordr', 'noFmmWorkorder');
    toggleGroup('hseRiskYes', 'hseRiskNo', 'hseassmnt', 'noHseRiskAssessmentReason');
    toggleGroup('opRiskYes', 'opRiskNo', 'opsassmnt', 'noOpsRiskAssessmentReason');
  })();

  function validateRequiredDocuments() {
    // Validate each group: one of Yes/No must be selected; if No, reason required
    const groups = [
      { yes: 'ePermitYes', no: 'ePermitNo', reason: 'ePermitReason' },
      { yes: 'fmmWorkorderYes', no: 'fmmWorkorderNo', reason: 'noFmmWorkorder' },
      { yes: 'hseRiskYes', no: 'hseRiskNo', reason: 'noHseRiskAssessmentReason' },
      { yes: 'opRiskYes', no: 'opRiskNo', reason: 'noOpsRiskAssessmentReason' }
    ];

    let valid = true;

    groups.forEach(({ yes, no, reason }) => {
      const yesEl = document.getElementById(yes);
      const noEl = document.getElementById(no);
      const reasonEl = document.getElementById(reason);

      if (!yesEl || !noEl) return;

      if (!yesEl.checked && !noEl.checked) {
        showErrorMessage(yesEl, 'Please select Yes or No');
        valid = false;
      } else {
        hideErrorMessage(yesEl);
      }

      if (noEl.checked) {
        if (!reasonEl || !reasonEl.value.trim()) {
          showErrorMessage(reasonEl || noEl, 'Please provide a reason');
          valid = false;
        } else {
          hideErrorMessage(reasonEl);
        }
      }
    });

    return valid;
  }

  // =========================
  // 9. Form Submit Handler
  // =========================
  const form = document.getElementById('permitForm');
  const submitBtn = document.getElementById('submitBtn');

  if (submitBtn) {
    submitBtn.addEventListener('click', function (e) {
      e.preventDefault();

      const ok =
        validateRequesterDetails() &&
        validateWorkDetails() &&
        validateRequiredDocuments() &&
        validateDateTime() &&
        validateFileUpload() &&
        validateSignature() &&
        validateConditions();

      if (ok) {
        form.submit();
      } else {
        alert('Please review the highlighted fields and complete all required details.');
      }
    });
  }
});

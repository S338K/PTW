document.addEventListener("DOMContentLoaded", function () {
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
});


document.addEventListener('DOMContentLoaded', function () {

  const API_BASE = 'https://ptw-yu8u.onrender.com';

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

  // ===== Logout and redirect to index.html =====
  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) {
    logoutButton.addEventListener('click', function () {
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
});

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
  const maxTotalSize = 3 * 1024 * 1024; // 3MB total

  // Store all selected files across multiple selections
  let selectedFiles = [];

  if (!fileInput) return;

  function showErrorMessage(message) {
    if (typeMsg) typeMsg.textContent = message;
    // Optional: add error styling to icon label
    const label = document.querySelector(`label[for="${fileInput.id}"]`);
    if (label) label.classList.add('upload-error');
  }

  function hideErrorMessage() {
    if (typeMsg) typeMsg.textContent = '';
    const label = document.querySelector(`label[for="${fileInput.id}"]`);
    if (label) label.classList.remove('upload-error');
  }

  function validateFiles(newFiles) {
    let totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

    for (const file of newFiles) {
      // Check duplicates (by name + size)
      const isDuplicate = selectedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      if (isDuplicate) {
        showErrorMessage(`Duplicate file skipped: ${file.name}`);
        return false;
      }

      // Check type
      if (!allowed.includes(file.type)) {
        showErrorMessage('Only PDF or JPG/JPEG files are allowed.');
        return false;
      }

      // Check total size limit
      if (totalSize + file.size > maxTotalSize) {
        showErrorMessage('Total file size must not exceed 3 MB.');
        return false;
      }

      totalSize += file.size;
    }

    hideErrorMessage();
    return true;
  }

  function renderList() {
    if (!list) return;
    list.innerHTML = '';

    selectedFiles.forEach(file => {
      const li = document.createElement('li');
      li.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.target = '_blank';
      link.textContent = file.type === 'application/pdf' ? ' View' : ' Preview';
      link.style.marginLeft = '5px';
      li.appendChild(link);

      list.appendChild(li);
    });
  }

  fileInput.addEventListener('change', () => {
    const newFiles = Array.from(fileInput.files);

    if (validateFiles(newFiles)) {
      // Add new files to the list
      selectedFiles = [...selectedFiles, ...newFiles];
      renderList();
    }

    // Reset input so the same file can be re-selected if removed
    fileInput.value = '';
  });

  // Expose for form-wide validation
  window.__validateFileUpload = function () {
    return selectedFiles.length > 0 && typeMsg.textContent === '';
  };
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
  submitBtn.addEventListener('click', async function (e) {
    e.preventDefault();

    const ok =
      validateRequesterDetails() &&
      validateDateTime() &&
      validateFileUpload() &&
      validateSignature() &&
      validateConditions();

    if (ok) {
      const formData = new FormData(form);

      try {
        const res = await fetch(`${API_BASE}/api/permit`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          alert('Form submitted successfully!');
          form.reset();

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
        alert('Network or server error while submitting form.');
      }
    } else {
      alert('Please review highlighted fields and complete all required details.');
    }
  });
}

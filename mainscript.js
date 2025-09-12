document.addEventListener("DOMContentLoaded", () => {
  // ========== Welcome Message ==========
  function updateNavigationBarWelcome() {
    const welcomeLabel = document.getElementById('secondaryHeaderWelcome');
    if (!welcomeLabel) return;
    const storedName = localStorage.getItem('ptw_logged_in_user');
    welcomeLabel.textContent = storedName ? `Welcome : ${storedName}` : 'Welcome :';
  }
  updateNavigationBarWelcome();

  // ========== Header Scroll Hide/Show ==========
  (function headerScrollTransition() {
    const header = document.querySelector('.header-container');
    let lastScrollY = window.scrollY;
    let isHidden = false;
    window.addEventListener('scroll', () => {
      if (!header) return;
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 40) {
        if (!isHidden) {
          header.style.transform = 'translateY(-120%)';
          header.style.opacity = '0';
          header.style.pointerEvents = 'none';
          isHidden = true;
        }
      } else {
        if (isHidden || currentScrollY <= 40) {
          header.style.transform = 'translateY(0)';
          header.style.opacity = '1';
          header.style.pointerEvents = 'auto';
          isHidden = false;
        }
      }
      lastScrollY = currentScrollY;
  })();

  // ========== Utility Functions ==========
  function validateField(inputElement, regex, errorMessage) {
    if (!regex.test(inputElement.value)) {
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

  function showWorkDetailsElement(el) {
    if (el) {
      el.classList.remove('hidden');
      el.style.display = 'block';
    }
  }

  function hideWorkDetailsElement(el) {
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  }

  function clearWorkDetailsErrors() {
    const ids = ['terminal', 'facility', 'specifyTerminal', 'specifyFacility', 'impact', 'equipmentDetails', 'impactLevel', 'affectedEquipment'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.border = '';
        hideErrorMessage(el);
      }
    });
  }

  function setupReasonToggle(radioYesId, radioNoId, reasonDivId, reasonInputId) {
    const radioYes = document.getElementById(radioYesId);
    const radioNo = document.getElementById(radioNoId);
    const reasonDiv = document.getElementById(reasonDivId);
    const reasonInput = document.getElementById(reasonInputId);

    if (!radioYes || !radioNo || !reasonDiv || !reasonInput) return;

    const toggle = () => {
      if (radioNo.checked) {
        showWorkDetailsElement(reasonDiv);
        reasonInput.required = true;
      } else {
        hideWorkDetailsElement(reasonDiv);
        reasonInput.required = false;
        reasonInput.value = '';
      }
    };

    radioYes.addEventListener('change', toggle);
    radioNo.addEventListener('change', toggle);
    toggle();
  }

  function getFormattedDateTime() {
    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${dayName}, ${day} ${month} ${year} — ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }

  function startClock() {
    const dateTimeEl = document.getElementById("dateTimeDisplay");
    if (!dateTimeEl) return;
    dateTimeEl.textContent = getFormattedDateTime();
    setInterval(() => {
      dateTimeEl.textContent = getFormattedDateTime();
    }, 1000);
  }
  startClock();

  // ========== Form Field Validations ==========
  const validationFields = [
    { id: 'fullNameMD', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Name must be alphabetic and less than 25 characters' },
    { id: 'lastName', regex: /^[A-Za-z\s]{1,25}$/, msg: 'Last Name must be alphabetic and less than 25 characters' },
    { id: 'contactdetails', regex: /^\+974\d{8}$/, msg: 'Mobile Number must be in the format +974XXXXXXXX' },
    { id: 'altcontactdetails', regex: /^(\+974\d{8})?$/, msg: 'Alternate Mobile Number must be in the format +974XXXXXXXX or empty' },
    { id: 'corpemailid', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, msg: 'Please enter a valid email address' },
    { id: 'buildingNo', regex: /^\d{1,2}$/, msg: 'Building number should be a number (maximum 2 digits)' },
    { id: 'floorNo', regex: /^\d{1,2}$/, msg: 'Floor number should be a number (maximum 2 digits)' },
    { id: 'streetNo', regex: /^\d{1,3}$/, msg: 'Street number should be a number (maximum 3 digits)' },
    { id: 'zone', regex: /^\d{1,2}$/, msg: 'Zone should be a number (maximum 2 digits)' },
    { id: 'city', regex: /^[A-Za-z\s]+$/, msg: 'City should be alphabetic' },
    { id: 'country', regex: /^[A-Za-z\s]+$/, msg: 'Country should be alphabetic' },
    { id: 'poBox', regex: /^\d{1,6}$/, msg: 'P.O. Box should be a number (maximum 6 digits)' },
  ];

  validationFields.forEach(({ id, regex, msg }) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', function () {
      validateField(this, regex, msg);
    });
  });

  function validateRequesterDetails() {
    return validationFields.every(({ id, regex, msg }) => {
      const el = document.getElementById(id);
      return el ? validateField(el, regex, msg) : true;
    });
  }

  // ========== Work Details ==========
  const facilityData = {
    'PTC': ['Arrival Hall', 'Baggage Hall', 'Check-In Area', 'Terminating Alpha', 'Terminating Brav', 'Transfer Alpha', 'Transfer Bravo', 'Transfer Charli', 'Dog Sniffing Area', 'Stand C1', 'Stand C2', 'Stand C3', 'Stand C4', 'Stand C5'],
    'CTC': ['Arrival Lounge', 'Departure Hall', 'Retail Area', 'Check-In Row 1', 'Check-In Row 2'],
  };

  const workDetailsElements = {
    terminal: document.getElementById('terminal'),
    facility: document.getElementById('facility'),
    specifyTerminal: document.getElementById('specifyTerminal'),
    specifyFacility: document.getElementById('specifyFacility'),
    impact: document.getElementById('impact'),
    equipmentDetails: document.getElementById('equipmentDetails'),
    impactLevel: document.getElementById('impactLevel'),
    affectedEquipment: document.getElementById('affectedEquipment'),
    category: document.getElementById('category'),
    workDescription: document.getElementById('workDescription'),
  };

  function validateWorkDetails() {
    let isValid = true;

    // Terminal
    if (!workDetailsElements.terminal.value) {
      showErrorMessage(workDetailsElements.terminal, 'Please select a terminal');
      workDetailsElements.terminal.style.border = '2px solid red';
      isValid = false;
    }

    const terminal = workDetailsElements.terminal.value;
    if (terminal === 'Other') {
      if (!workDetailsElements.specifyTerminal.value.trim()) {
        showErrorMessage(workDetailsElements.specifyTerminal, 'Please specify the terminal');
        workDetailsElements.specifyTerminal.style.border = '2px solid red';
        isValid = false;
      }
      if (!workDetailsElements.specifyFacility.value.trim()) {
        showErrorMessage(workDetailsElements.specifyFacility, 'Please specify the facility');
        workDetailsElements.specifyFacility.style.border = '2px solid red';
        isValid = false;
      }
    } else if (terminal && facilityData[terminal]) {
      if (!workDetailsElements.facility.value) {
        showErrorMessage(workDetailsElements.facility, 'Please select a facility');
        workDetailsElements.facility.style.border = '2px solid red';
        isValid = false;
      }
    }

    // Impact
    if (!workDetailsElements.impact.value) {
      showErrorMessage(workDetailsElements.impact, 'Please select impact on operations');
      workDetailsElements.impact.style.border = '2px solid red';
      isValid = false;
    }

    if (workDetailsElements.impact.value === 'Yes') {
      if (!workDetailsElements.equipmentDetails.value) {
        showErrorMessage(workDetailsElements.equipmentDetails, 'Please select the equipment');
        workDetailsElements.equipmentDetails.style.border = '2px solid red';
        isValid = false;
      }

      if (!workDetailsElements.impactLevel.value) {
        showErrorMessage(workDetailsElements.impactLevel, 'Please select the level of impact');
        workDetailsElements.impactLevel.style.border = '2px solid red';
        isValid = false;
      }

      const equipmentDesc = workDetailsElements.affectedEquipment.value.trim();
      if (!equipmentDesc) {
        showErrorMessage(workDetailsElements.affectedEquipment, 'Please describe the affected equipment');
        workDetailsElements.affectedEquipment.style.border = '2px solid red';
        isValid = false;
      } else if (equipmentDesc.length < 10) {
        showErrorMessage(workDetailsElements.affectedEquipment, 'Equipment description must be at least 10 characters');
        workDetailsElements.affectedEquipment.style.border = '2px solid red';
        isValid = false;
      }
    }

    if (!workDetailsElements.category.value) {
      showErrorMessage(workDetailsElements.category, 'Please select the nature of work');
      workDetailsElements.category.style.border = '2px solid red';
      isValid = false;
    }

    const workDesc = workDetailsElements.workDescription.value.trim();
    if (!workDesc) {
      showErrorMessage(workDetailsElements.workDescription, 'Please provide a description of work');
      workDetailsElements.workDescription.style.border = '2px solid red';
      isValid = false;
    } else if (workDesc.length < 20) {
      showErrorMessage(workDetailsElements.workDescription, 'Work description must be at least 20 characters');
      workDetailsElements.workDescription.style.border = '2px solid red';
      isValid = false;
    }

    return isValid;
  }

  // ========== Initialize Work Details ==========
  function initializeWorkDetails() {
    if (!workDetailsElements.terminal) return;
    workDetailsElements.terminal.addEventListener('change', clearWorkDetailsErrors);
    workDetailsElements.impact.addEventListener('change', clearWorkDetailsErrors);
    Object.values(workDetailsElements).forEach(el => {
      if (el) {
        el.addEventListener('change', clearWorkDetailsErrors);
        el.addEventListener('input', clearWorkDetailsErrors);
      }
    });
  }
  initializeWorkDetails();

  // ========== Required Document Toggles ==========
  setupReasonToggle('ePermitYes', 'ePermitNo', 'ePermitDetails', 'ePermitReason');
  setupReasonToggle('fmmWorkorderYes', 'fmmWorkorderNo', 'fmmwrkordr', 'noFmmWorkorder');
  setupReasonToggle('hseRiskYes', 'hseRiskNo', 'hseassmnt', 'noHseRiskAssessmentReason');
  setupReasonToggle('opRiskYes', 'opRiskNo', 'opsassmnt', 'noOpsRiskAssessmentReason');

  // ========== Document Validation ==========
  function validateDocuments() {
    let isValid = true;

    const docChecks = [
      {
        yes: 'ePermitYes', no: 'ePermitNo', reason: 'ePermitReason',
        msg: 'Please select an option for e-Permit', reasonMsg: 'Please provide a reason for not having e-Permit'
      },
      {
        yes: 'fmmWorkorderYes', no: 'fmmWorkorderNo', reason: 'noFmmWorkorder',
        msg: 'Please select an option for FMM Work Order', reasonMsg: 'Please provide a reason for not having FMM Work Order'
      },
      {
        yes: 'hseRiskYes', no: 'hseRiskNo', reason: 'noHseRiskAssessmentReason',
        msg: 'Please select an option for HSE Risk Assessment', reasonMsg: 'Please provide a reason for not having HSE Risk Assessment'
      },
      {
        yes: 'opRiskYes', no: 'opRiskNo', reason: 'noOpsRiskAssessmentReason',
        msg: 'Please select an option for Operational Risk Assessment', reasonMsg: 'Please provide a reason for not having Operational Risk Assessment'
      }
    ];

    docChecks.forEach(({ yes, no, reason, msg, reasonMsg }) => {
      const yesEl = document.getElementById(yes);
      const noEl = document.getElementById(no);
      const reasonEl = document.getElementById(reason);

      if (!yesEl || !noEl || !reasonEl) return;

      if (!yesEl.checked && !noEl.checked) {
        showErrorMessage(yesEl, msg);
        isValid = false;
      } else {
        hideErrorMessage(yesEl);
      }

      if (noEl.checked && !reasonEl.value.trim()) {
        showErrorMessage(reasonEl, reasonMsg);
        isValid = false;
      } else {
        hideErrorMessage(reasonEl);
      }
    });

    return isValid;
  }

  // You can now call:
  // validateRequesterDetails();
  // validateWorkDetails();
  // validateDocuments();

});

  /* ============================================
     REQUESTED TIMINGS (including clock and flatpickr)
  ============================================ */

  if (typeof flatpickr === "function") {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    flatpickr(".datetime-picker", {
      enableTime: true,
      time_24hr: true,
      defaultHour: currentHour,
      defaultMinute: currentMinute,
      dateFormat: "F d, Y H:i",
      minuteIncrement: 1,
      allowInput: true,
      minDate: "today",
      defaultDate: null,
      onReady: function (selectedDates, dateStr, instance) {
        instance.input.placeholder = "Select the date and time";
      },
      onChange: function(selectedDates, dateStr, instance) {
        hideErrorMessage(instance.input);
      }
    });
  }

  function validateDateTime() {
    let isValid = true;
    const startDateTime = document.getElementById('startDateTime');
    const endDateTime = document.getElementById('endDateTime');
    const now = new Date();

    if (!startDateTime.value) {
      showErrorMessage(startDateTime, 'Please select a start date and time');
      isValid = false;
    } else {
      const startDate = new Date(startDateTime.value);
      if (startDate <= now) {
        showErrorMessage(startDateTime, 'Start date and time must be in the future');
        isValid = false;
      } else {
        hideErrorMessage(startDateTime);
      }
    }

    if (!endDateTime.value) {
      showErrorMessage(endDateTime, 'Please select an end date and time');
      isValid = false;
    } else {
      const endDate = new Date(endDateTime.value);
      if (endDate <= now) {
        showErrorMessage(endDateTime, 'End date and time must be in the future');
        isValid = false;
      } else {
        hideErrorMessage(endDateTime);
      }
    }

    if (startDateTime.value && endDateTime.value) {
      const startDate = new Date(startDateTime.value);
      const endDate = new Date(endDateTime.value);
      if (endDate <= startDate) {
        showErrorMessage(endDateTime, 'End date and time must be after start date and time');
        isValid = false;
      } else {
        hideErrorMessage(endDateTime);
      }
    }

    return isValid;
  }

  function validateRequestedTimings() {
    return true;
  }

  /* ============================================
     FILE UPLOAD
  ============================================ */
  const fileInput = document.getElementById('fileUpload');
  const fileList = document.getElementById('uploadedFiles');
  const fileTypeMessage = document.getElementById('fileTypeMessage');
  let fileCounter = 1;
  const uploadedFileNames = new Set();

  fileInput.addEventListener('change', function () {
    const files = Array.from(this.files);
    const allowedExtensions = ['pdf', 'jpeg', 'jpg'];
    let invalidFileFound = false;
    let duplicateFileFound = false;

    files.forEach(file => {
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        invalidFileFound = true;
        return;
      }

      if (uploadedFileNames.has(file.name)) {
        duplicateFileFound = true;
        return;
      }

      uploadedFileNames.add(file.name);
      const listItem = document.createElement('li');
      listItem.style.marginBottom = '8px';

      if (fileExtension === 'jpeg' || fileExtension === 'jpg') {
        const img = document.createElement('img');
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.marginRight = '10px';
        img.alt = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        listItem.appendChild(img);
        listItem.appendChild(document.createTextNode(`${fileCounter}. ${file.name}`));
      } else if (fileExtension === 'pdf') {
        const link = document.createElement('a');
        link.textContent = `${fileCounter}. ${file.name}`;
        link.href = URL.createObjectURL(file);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        listItem.appendChild(link);
      }

      fileList.appendChild(listItem);
      fileCounter++;
    });

    if (invalidFileFound) {
      fileTypeMessage.textContent = "Invalid file type detected. Please upload only .pdf, .jpeg, or .jpg files.";
      fileTypeMessage.style.display = 'block';
    } else if (duplicateFileFound) {
      fileTypeMessage.textContent = "Duplicate file name detected. Please upload unique files.";
      fileTypeMessage.style.display = 'block';
    } else {
      fileTypeMessage.style.display = 'none';
    }

    this.value = '';
  });

  function validateFileUpload() {
    return true;
  }

  /* ============================================
     SIGNATURE AUTO-POPULATION
  ============================================ */
  function autoPopulateSignatureName() {
    const fullName = document.getElementById('fullNameMD');
    const lastName = document.getElementById('lastName');
    const signName = document.getElementById('signName');

    if (fullName && lastName && signName) {
      const updateSignature = () => {
        const name = fullName.value.trim();
        const surname = lastName.value.trim();
        if (name && surname) {
          signName.value = `${name} ${surname}`;
        } else if (name) {
          signName.value = name;
        }
      };

      fullName.addEventListener('input', updateSignature);
      lastName.addEventListener('input', updateSignature);
    }
  }

  autoPopulateSignatureName();

  (function autofillSignatureDateTime() {
    const now = new Date();
    const options = { month: 'long', day: '2-digit', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', options).replace(',', '');
    const parts = formattedDate.split(' ');
    const finalDate = `${parts[0]}, ${parts[1]} ${parts[2]}`;

    const signDateInput = document.getElementById("signDate");
    const signTimeInput = document.getElementById("signTime");

    if (signDateInput) signDateInput.value = finalDate;
    if (signTimeInput) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      signTimeInput.value = `${hours}:${minutes}`;
    }
  })();

  function validateSignature() {
    let isValid = true;
    const signName = document.getElementById('signName');
    const signDate = document.getElementById('signDate');
    const signTime = document.getElementById('signTime');
    const designation = document.getElementById('designation');

    if (!signName.value.trim()) {
      showErrorMessage(signName, 'Please enter your name');
      isValid = false;
    } else {
      hideErrorMessage(signName);
    }

    if (!signDate.value.trim()) {
      showErrorMessage(signDate, 'Please enter the date');
      isValid = false;
    } else {
      hideErrorMessage(signDate);
    }

    if (!signTime.value.trim()) {
      showErrorMessage(signTime, 'Please enter the time');
      isValid = false;
    } else {
      hideErrorMessage(signTime);
    }

    if (!designation.value.trim()) {
      showErrorMessage(designation, 'Please enter your designation');
      isValid = false;
    } else {
      hideErrorMessage(designation);
    }

    return isValid;
  }

  function validateConditions() {
    const confirmConditions = document.getElementById('confirmConditions');
    if (!confirmConditions.checked) {
      showErrorMessage(confirmConditions, 'You must accept the terms and conditions');
      return false;
    }
    hideErrorMessage(confirmConditions);
    return true;
  }

  // Final form submission
  const form = document.getElementById('permitForm');
  const submitButton = document.getElementById('submitBtn');

  if (submitButton) {
    submitButton.addEventListener('click', (e) => {
      e.preventDefault();

      clearWorkDetailsErrors();

      const isFormValid = validateRequesterDetails() &&
                          validateWorkDetails() &&
                          validateDocuments() &&
                          validateDateTime() &&
                          validateFileUpload() &&
                          validateRequestedTimings() &&
                          validateSignature() &&
                          validateConditions();

      if (isFormValid) {
  alert("Request has been submitted successfully.");
  form.submit(); // ✅ Submits the form
} else {
  alert("Please fill all the required details.");
}

    });
  }

  // Clear button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all form data?')) {
        form.reset();
        document.getElementById('uploadedFiles').innerHTML = '';
        clearWorkDetailsErrors();
        handleImpactChange();
      }
    });
  }

  const savePdfBtn = document.getElementById('savePdfBtn');
  if (savePdfBtn) {
    savePdfBtn.addEventListener('click', () => {
      alert('PDF export functionality would be implemented here');
    });
  }

  // Header/nav scroll behavior
  let lastScrollY = window.scrollY;
  const header = document.querySelector('.header-container');
  const navBar = document.getElementById('navigationBar');
  let isSticky = false;
  let isHidden = false;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const headerHeight = header?.offsetHeight || 0;

    if (currentScrollY >= headerHeight && !isSticky) {
      navBar?.classList.add('sticky');
      isSticky = true;
    } else if (currentScrollY < headerHeight && isSticky) {
      navBar?.classList.remove('sticky');
      isSticky = false;
    }

    if (currentScrollY > lastScrollY && currentScrollY > 40 && !isHidden) {
      header.style.transform = 'translateY(-120%)';
      header.style.opacity = '0';
      header.style.pointerEvents = 'none';
      navBar.classList.add('hide');
      navBar.classList.remove('show');
      isHidden = true;
    } else if ((isHidden || currentScrollY <= 40)) {
      header.style.transform = 'translateY(0)';
      header.style.opacity = '1';
      header.style.pointerEvents = 'auto';
      navBar.classList.remove('hide');
      navBar.classList.add('show');
      isHidden = false;
    }

    lastScrollY = currentScrollY;
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      localStorage.removeItem('ptw_logged_in_user');
      window.location.href = 'login.html';
    });
  }

  const profileBtn = document.getElementById("profileBtn");
  if (profileBtn) {
    profileBtn.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }
});
// Shared validators used by signup and layout modal
// Plain functions attached to window.PTW_VALIDATORS for non-module scripts.
(function () {
  function validateName(value) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,50}$/.test(String(value || "").trim());
  }
  function validateCompany(value) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]{2,50}$/.test(String(value || "").trim());
  }
  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }
  function validatePhone(value) {
    try {
      const cleaned = String(value || "").replace(/[\s\-()]/g, "");
      return /^\+974\d{8,}$/.test(cleaned);
    } catch (_) {
      return false;
    }
  }
  function validatePassword(value, name, email) {
    const strongPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPattern.test(String(value || ""))) return false;
    const lower = String(value || "").toLowerCase();
    if (name && lower.includes(String(name || "").toLowerCase())) return false;
    if (
      validateEmail(email) &&
      lower.includes(
        String(email || "")
          .split("@")[0]
          .toLowerCase(),
      )
    )
      return false;
    return true;
  }
  function validateConfirmPassword(pass, confirm) {
    return (
      String(pass || "") === String(confirm || "") &&
      String(confirm || "").length > 0
    );
  }
  function validateTerms(checked) {
    return !!checked;
  }
  function validateBuildingNo(v) {
    return /^\d{1,2}$/.test(String(v || ""));
  }
  function validateFloorNo(v) {
    return /^\d{1,2}$/.test(String(v || ""));
  }
  function validateStreetNo(v) {
    return /^\d{1,3}$/.test(String(v || ""));
  }
  function validateZone(v) {
    return /^\d{1,2}$/.test(String(v || ""));
  }
  function validateCity(v) {
    return /^[A-Za-z\s]+$/.test(String(v || "").trim());
  }
  function validateCountry(v) {
    return /^[A-Za-z\s]+$/.test(String(v || "").trim());
  }
  function validatePoBox(v) {
    return /^\d{1,6}$/.test(String(v || ""));
  }

  // Attach to window for non-module consumers
  try {
    if (typeof window !== "undefined") {
      window.PTW_VALIDATORS = window.PTW_VALIDATORS || {};
      Object.assign(window.PTW_VALIDATORS, {
        validateName,
        validateCompany,
        validateEmail,
        validatePhone,
        validatePassword,
        validateConfirmPassword,
        validateTerms,
        validateBuildingNo,
        validateFloorNo,
        validateStreetNo,
        validateZone,
        validateCity,
        validateCountry,
        validatePoBox,
      });
    }
  } catch (_) {
    /* ignore */
  }
})();

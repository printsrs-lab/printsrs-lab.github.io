
// ==========================================
// Pro UID Guard (PS-001 format only)
// ==========================================

(function() {

  function isValidUID(uid) {
    return /^PS-\d{3,}$/.test(uid);
  }

  const params = new URLSearchParams(location.search);
  const uid = params.get("uid");

  if (location.pathname.startsWith("/pro/")) {
    if (!uid || !isValidUID(uid)) {
      console.warn("Invalid UID format. Pro disabled.");
      if (window.PRO) {
        window.PRO.enabled = false;
      }
    }
  }

})();

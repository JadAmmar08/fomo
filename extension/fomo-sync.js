// Runs on usefomo.co pages — syncs the anonymous ID so the mirror/pulse can find the user
chrome.storage.local.get({ anonymousUserId: null }, (store) => {
  if (!store.anonymousUserId) return;

  // Always set the cookie for future requests
  document.cookie = `fomo_anonymous_id=${store.anonymousUserId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;

  // If on mirror/pulse and the URL doesn't have the uid param, add it and reload
  // This guarantees the server sees the right user ID regardless of cookie state
  if (location.pathname === "/mirror" || location.pathname === "/pulse") {
    const params = new URLSearchParams(location.search);
    if (params.get("uid") !== store.anonymousUserId) {
      params.set("uid", store.anonymousUserId);
      location.replace(location.pathname + "?" + params.toString());
    }
  }
});

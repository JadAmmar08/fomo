// Runs on usefomo.co pages — syncs the anonymous ID cookie so the mirror can find the user
chrome.storage.local.get({ anonymousUserId: null }, (store) => {
  if (!store.anonymousUserId) return;

  const cookieExists = document.cookie.includes("fomo_anonymous_id=" + store.anonymousUserId);
  document.cookie = `fomo_anonymous_id=${store.anonymousUserId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;

  // If the cookie wasn't there before, the server didn't see it on this request.
  // Reload so the server-rendered page picks it up.
  if (!cookieExists && (location.pathname === "/mirror" || location.pathname === "/pulse")) {
    location.reload();
  }
});

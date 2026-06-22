// Runs on usefomo.co pages — syncs the anonymous ID cookie so the mirror can find the user
chrome.storage.local.get({ anonymousUserId: null }, (store) => {
  if (store.anonymousUserId) {
    document.cookie = `fomo_anonymous_id=${store.anonymousUserId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
  }
});

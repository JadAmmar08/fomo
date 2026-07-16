// Runs on usefomo.net pages — syncs the anonymous ID so the mirror/room/team pages find the
// right user. Direction matters: if someone just logged in on the website with their own
// account, the resulting cookie is a deliberate signal and must win over whatever identity
// happens to be cached in this browser's extension storage (e.g. from a sibling, a shared
// computer, or an old test). Only when there's no such signal do we fall back to pushing the
// extension's stored identity onto the site.
function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

chrome.storage.local.get({ anonymousUserId: null }, (store) => {
  const existingCookie = readCookie("fomo_anonymous_id");

  // A real, explicit login (or a different person's session) produced a cookie that disagrees
  // with what this browser's extension has cached. Adopt it: the website is authoritative here.
  if (existingCookie && store.anonymousUserId && existingCookie !== store.anonymousUserId) {
    chrome.storage.local.set({ anonymousUserId: existingCookie });
  } else if (store.anonymousUserId) {
    // No conflicting signal from the site — push the extension's identity onto it as before.
    document.cookie = `fomo_anonymous_id=${store.anonymousUserId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
  }

  const activeId = existingCookie || store.anonymousUserId;
  if (!activeId) return;

  // If on the mirror and the URL doesn't have the uid param, add it and reload.
  // This guarantees the server sees the right user ID regardless of cookie state.
  if (location.pathname === "/mirror") {
    const params = new URLSearchParams(location.search);
    if (params.get("uid") !== activeId) {
      params.set("uid", activeId);
      location.replace(location.pathname + "?" + params.toString());
    }
  }
});

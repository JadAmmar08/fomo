const POLL_MS = 5000;
const STORAGE_KEY = "fomo_anonymous_user_id";

let anonymousUserId = localStorage.getItem(STORAGE_KEY);
let pollTimer = null;
let currentAlert = null;

function showView(view) {
  document.getElementById("login-view").style.display = view === "login" ? "block" : "none";
  document.getElementById("alerts-view").style.display = view === "alerts" ? "block" : "none";
}

function getCurrentFileName() {
  // Office.context.document.url is the best cross-host (Word/Excel) signal available
  // client-side for a locally-open document — there's no reliable Graph driveItem id
  // without extra Graph calls, so this matches by file name instead, same tradeoff as
  // the extension's Office Online URL detection (see extension/content.js).
  const url = Office.context.document.url;
  if (!url) return null;
  const clean = url.split("?")[0].split("#")[0];
  const name = decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
  return name || null;
}

function renderAlert(alert) {
  const container = document.getElementById("alert-container");
  const emptyState = document.getElementById("empty-state");

  if (!alert) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    currentAlert = null;
    return;
  }

  if (currentAlert && currentAlert.cardKey === alert.cardKey) return;
  currentAlert = alert;
  emptyState.style.display = "none";

  const label = alert.conflictKind === "contradiction" ? "Conflicting data found" : "Possible overlap";
  container.innerHTML = `
    <div class="alert-card">
      <div class="alert-label">${label}</div>
      <div class="alert-text"></div>
      <button class="dismiss-btn">Dismiss</button>
    </div>
  `;
  container.querySelector(".alert-text").textContent = alert.text;
  container.querySelector(".dismiss-btn").addEventListener("click", async () => {
    await fetch("/api/live-signal/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousUserId, roomSlug: alert.roomSlug, cardKey: alert.cardKey })
    }).catch(() => undefined);
    renderAlert(null);
  });
}

function setDebugInfo(lines) {
  const el = document.getElementById("debug-info");
  if (el) el.textContent = lines.join(" · ");
}

async function poll() {
  const fileName = getCurrentFileName();
  const rawUrl = (typeof Office !== "undefined" && Office.context && Office.context.document) ? Office.context.document.url : "(no Office.context.document.url)";
  if (!fileName || !anonymousUserId) {
    setDebugInfo([`raw url: ${rawUrl}`, "no fileName resolved, not polling"]);
    return;
  }
  try {
    const res = await fetch(`/api/live-signal?anonymousUserId=${encodeURIComponent(anonymousUserId)}&fileName=${encodeURIComponent(fileName)}`);
    const data = await res.json();
    setDebugInfo([`user: ${anonymousUserId}`, `matching against: "${fileName}"`, `raw url: ${rawUrl}`, `last check: ${new Date().toLocaleTimeString()}`]);
    renderAlert(data.alert ?? null);
  } catch {
    setDebugInfo([`user: ${anonymousUserId}`, `matching against: "${fileName}"`, `raw url: ${rawUrl}`, "poll request failed"]);
  }
}

function startPolling() {
  showView("alerts");
  poll();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, POLL_MS);
  registerLiveEditListener();
}

let liveEditDebounceTimer = null;
let liveEditListenerRegistered = false;

// Excel-only: worksheet.onChanged reacts inside the open document the instant a cell
// commits, no cloud save/webhook round trip needed — this is what makes it fast
// (Grammarly-style) instead of waiting on Graph's webhook delivery (5-40+ seconds
// observed). Word has no equivalent live content-change event in Office.js, so it
// stays on the 5s poll above as its only mechanism. Fire-and-forget: the existing
// poll is what actually renders the result once /api/live-signal/check-now writes
// a pinned card, so this doesn't need to handle a response.
async function registerLiveEditListener() {
  if (liveEditListenerRegistered) return;
  if (typeof Office === "undefined" || Office.context.host !== Office.HostType.Excel) return;
  if (typeof Excel === "undefined") return;

  try {
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      sheet.onChanged.add(() => {
        if (!anonymousUserId) return;
        const fileName = getCurrentFileName();
        if (!fileName) return;

        // Debounced: a paste or fill can fire onChanged many times in one burst,
        // and each server-side check is a real Anthropic call, not a cache read —
        // wait 2s after the last change before actually triggering one.
        clearTimeout(liveEditDebounceTimer);
        liveEditDebounceTimer = setTimeout(() => {
          fetch("/api/live-signal/check-now", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anonymousUserId, fileName })
          }).catch(() => undefined);
        }, 2000);
      });
      await context.sync();
    });
    liveEditListenerRegistered = true;
  } catch (err) {
    console.error("[taskpane] registering live edit listener failed:", err);
  }
}

async function handleLogin() {
  const email = document.getElementById("email-input").value.trim();
  const statusEl = document.getElementById("status");
  if (!email) return;
  statusEl.textContent = "Signing in...";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!data.anonymousUserId) {
      statusEl.textContent = "Something went wrong. Try again.";
      return;
    }
    anonymousUserId = data.anonymousUserId;
    localStorage.setItem(STORAGE_KEY, anonymousUserId);
    startPolling();
  } catch {
    statusEl.textContent = "Something went wrong. Try again.";
  }
}

Office.onReady(() => {
  document.getElementById("login-btn").addEventListener("click", handleLogin);
  document.getElementById("email-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("signout-btn").addEventListener("click", () => {
    // localStorage caches the resolved identity from login time — if the account it
    // points to gets merged/changed server-side afterward (see lib/account.ts), this is
    // the only way to pick up the new one, since there's no server session to invalidate.
    localStorage.removeItem(STORAGE_KEY);
    anonymousUserId = null;
    if (pollTimer) clearInterval(pollTimer);
    currentAlert = null;
    showView("login");
  });

  if (anonymousUserId) {
    startPolling();
  } else {
    showView("login");
  }
});

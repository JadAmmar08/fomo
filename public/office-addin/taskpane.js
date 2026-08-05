const POLL_MS = 1500;
const STORAGE_KEY = "fomo_anonymous_user_id";

let anonymousUserId = localStorage.getItem(STORAGE_KEY);
let pollTimer = null;
let currentAlert = null;
let liveEditStatus = "live-edit: not yet attempted"; // shown in debug-info — avoids needing DevTools' nested-iframe console to see what's happening

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
    await clearHighlight();
    renderAlert(null);
  });
}

let highlightedCell = null; // { sheetName, address } — tracked so Dismiss can clear it

// Parses "SheetName!C5" (the format extractStructuredCells/getSheetValuesWithCoordinates
// produce) and marks that exact cell: a fill color plus a native Excel comment with the
// conflict text, the actual in-document visual (closer to Grammarly's inline underline
// than the sidebar card alone).
async function highlightCell(location, commentText) {
  const [sheetName, address] = location.includes("!") ? location.split("!") : [null, location];
  try {
    await Excel.run(async (context) => {
      const sheet = sheetName ? context.workbook.worksheets.getItem(sheetName) : context.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getRange(address);
      range.format.fill.color = "#FFF3B0";
      sheet.comments.add(address, commentText);
      await context.sync();
    });
    highlightedCell = { sheetName, address };
  } catch (err) {
    console.error("[taskpane] highlighting cell failed:", err);
  }
}

async function clearHighlight() {
  if (!highlightedCell) return;
  const { sheetName, address } = highlightedCell;
  highlightedCell = null;
  try {
    await Excel.run(async (context) => {
      const sheet = sheetName ? context.workbook.worksheets.getItem(sheetName) : context.workbook.worksheets.getActiveWorksheet();
      sheet.getRange(address).format.fill.clear();
      sheet.comments.getItemByCell(address).delete();
      await context.sync();
    });
  } catch (err) {
    console.error("[taskpane] clearing cell highlight failed:", err);
  }
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
    setDebugInfo([`user: ${anonymousUserId}`, `matching against: "${fileName}"`, `raw url: ${rawUrl}`, `last check: ${new Date().toLocaleTimeString()}`, liveEditStatus]);

    // A newly-arrived alert might have been pinned by a check that ran on a
    // DIFFERENT file (e.g. someone else's edit conflicting with this one) — the
    // live-edit path only highlights when THIS file's own check-now call finds
    // something, so polling has to do the same job for that case, not just render
    // the sidebar card.
    const isNewAlert = data.alert && (!currentAlert || currentAlert.cardKey !== data.alert.cardKey);
    renderAlert(data.alert ?? null);
    if (isNewAlert && data.alert.location) highlightCell(data.alert.location, data.alert.text);
  } catch {
    setDebugInfo([`user: ${anonymousUserId}`, `matching against: "${fileName}"`, `raw url: ${rawUrl}`, "poll request failed", liveEditStatus]);
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
// observed). check-now is awaited server-side and returns the result directly, so
// poll() below runs immediately after instead of waiting for its next tick. Word
// has no equivalent live content-change event in Office.js, so it stays on the
// poll loop as its only mechanism.
async function registerLiveEditListener() {
  if (liveEditListenerRegistered) return;
  if (typeof Office === "undefined" || Office.context.host !== Office.HostType.Excel) {
    liveEditStatus = `live-edit: skipped (host is ${typeof Office === "undefined" ? "undefined" : Office.context.host})`;
    return;
  }
  if (typeof Excel === "undefined") {
    liveEditStatus = "live-edit: skipped (Excel API not available)";
    return;
  }

  try {
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      sheet.onChanged.add(() => {
        liveEditStatus = `live-edit: onChanged fired ${new Date().toLocaleTimeString()}, debouncing...`;
        if (!anonymousUserId) return;
        const fileName = getCurrentFileName();
        if (!fileName) return;

        // Debounced only to collapse a burst of onChanged events (a paste or
        // fill) into one check — this no longer needs to wait out OneDrive's
        // cloud sync lag, since the grid read below comes straight from the
        // local document, not a Graph re-download. 800ms is just "let the burst
        // finish," not "wait for the cloud."
        clearTimeout(liveEditDebounceTimer);
        liveEditDebounceTimer = setTimeout(async () => {
          liveEditStatus = `live-edit: reading grid ${new Date().toLocaleTimeString()}`;
          try {
            // Read the used range directly from the open document via Office.js —
            // this is local and instant, unlike re-fetching the file's content via
            // Graph, which can lag a few seconds behind a just-typed cell while
            // OneDrive finishes syncing it to the backend Graph reads from (a real
            // race confirmed live: a check right after an edit sometimes still saw
            // the PREVIOUS value). Sending the actual values removes that race.
            let grid = null;
            let sheetName = null;
            await Excel.run(async (readContext) => {
              const activeSheet = readContext.workbook.worksheets.getActiveWorksheet();
              activeSheet.load("name");
              const used = activeSheet.getUsedRangeOrNullObject(true);
              used.load("values");
              await readContext.sync();
              if (!used.isNullObject) {
                grid = used.values;
                sheetName = activeSheet.name;
              }
            });

            liveEditStatus = `live-edit: check-now called ${new Date().toLocaleTimeString()}`;
            const res = await fetch("/api/live-signal/check-now", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ anonymousUserId, fileName, grid, sheetName })
            });
            const data = await res.json();
            liveEditStatus = data.skipped
              ? `live-edit: skipped (${data.skipped}) ${new Date().toLocaleTimeString()} — not a real "no conflict" result`
              : `live-edit: check-now responded ${new Date().toLocaleTimeString()}, alert=${Boolean(data.alert)}`;
            // poll() (not a hand-built alert object here) so the sidebar card gets
            // the real cardKey/roomSlug from pinned_cards — needed for Dismiss to
            // actually delete the right row, not something check-now's leaner
            // {conflictKind, text, location} result carries on its own. poll()
            // also handles the cell highlight itself now (see poll(), it needs to
            // do the same job for alerts that arrive from OTHER files' checks
            // too), so this only needs to trigger it, not highlight directly.
            if (data.alert) poll();
          } catch (err) {
            liveEditStatus = `live-edit: check-now FAILED: ${err}`;
          }
        }, 800);
      });
      await context.sync();
    });
    liveEditListenerRegistered = true;
    liveEditStatus = "live-edit: registered OK, waiting for an edit";
  } catch (err) {
    liveEditStatus = `live-edit: registration FAILED: ${err}`;
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

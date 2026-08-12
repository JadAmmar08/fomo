const POLL_MS = 1500;
const STORAGE_KEY = "fomo_anonymous_user_id";
const HIGHLIGHT_STORAGE_KEY = "fomo_highlighted_cells";

let anonymousUserId = localStorage.getItem(STORAGE_KEY);
let pollTimer = null;
let currentAlerts = new Map(); // cardKey -> alert, so multiple simultaneous conflicts all show, not just one
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

// Renders every currently-open conflict as its own card, not just one — a single
// edit (e.g. pasting a table) can break multiple facts at once, and each needs its
// own Dismiss so resolving one doesn't hide the others.
function renderAlerts(alerts) {
  const container = document.getElementById("alert-container");
  const emptyState = document.getElementById("empty-state");

  const incomingKeys = new Set(alerts.map((a) => a.cardKey));
  // Sweep highlightedCells (persisted, the real source of truth for what's
  // currently marked in the sheet), not currentAlerts (in-memory only, resets to
  // empty on every page reload) — otherwise a reload forgets what it highlighted
  // before and orphans that fill/comment in the sheet forever.
  for (const key of Array.from(highlightedCells.keys())) {
    if (!incomingKeys.has(key)) clearHighlight(key);
  }
  currentAlerts = new Map(alerts.map((a) => [a.cardKey, a]));

  if (alerts.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  container.innerHTML = alerts.map((alert) => {
    const label = alert.conflictKind === "contradiction" ? "Conflicting data found" : "Possible overlap";
    // Collapsed by default — clicking reveals exactly where the OTHER side of
    // the conflict lives, inline in this same card, no navigating away needed.
    const sourceLink = alert.otherFile
      ? `<div class="source-link" data-card-key="${alert.cardKey}">View in ${alert.otherFile} &rsaquo;</div>
         <div class="source-detail" data-card-key="${alert.cardKey}" style="display:none;">${alert.otherFile}${alert.otherLocation ? ` — ${alert.otherLocation}` : ""}</div>`
      : "";
    return `
      <div class="alert-card" data-card-key="${alert.cardKey}">
        <div class="alert-label">${label}</div>
        <div class="alert-text">${alert.text}</div>
        ${sourceLink}
        <button class="dismiss-btn">Dismiss</button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".source-link").forEach((link) => {
    link.addEventListener("click", () => {
      const cardKey = link.getAttribute("data-card-key");
      const detail = container.querySelector(`.source-detail[data-card-key="${cardKey}"]`);
      if (detail) detail.style.display = detail.style.display === "none" ? "block" : "none";
    });
  });

  container.querySelectorAll(".alert-card").forEach((card) => {
    const cardKey = card.getAttribute("data-card-key");
    const alert = currentAlerts.get(cardKey);
    card.querySelector(".dismiss-btn").addEventListener("click", async () => {
      await fetch("/api/live-signal/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousUserId, roomSlug: alert.roomSlug, cardKey: alert.cardKey })
      }).catch(() => undefined);
      await clearHighlight(cardKey);
      currentAlerts.delete(cardKey);
      renderAlerts(Array.from(currentAlerts.values()));
    });
  });
}

// cardKey -> { sheetName, address } — one per open card, so Dismiss only clears its
// own. Persisted to localStorage (not just kept in memory) because the task pane
// reloads on tab switches/refreshes, and an in-memory-only map forgets what it
// highlighted before, orphaning fills/comments in the sheet forever since nothing
// then knows to clear them.
function loadHighlightedCells() {
  try {
    const raw = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
    return raw ? new Map(JSON.parse(raw)) : new Map();
  } catch {
    return new Map();
  }
}
function saveHighlightedCells() {
  localStorage.setItem(HIGHLIGHT_STORAGE_KEY, JSON.stringify(Array.from(highlightedCells.entries())));
}
let highlightedCells = loadHighlightedCells();

// Every FOMO-created comment is tagged with this marker so reconcileHighlights
// (below) can tell "an old FOMO highlight nobody's tracking anymore" apart from
// a real comment the user actually wrote — never touch anything without it.
const FOMO_COMMENT_MARKER = "[FOMO] ";

// Parses "SheetName!C5" (the format extractStructuredCells/getSheetValuesWithCoordinates
// produce) and marks that exact cell: a fill color plus a native Excel comment with the
// conflict text, the actual in-document visual (closer to Grammarly's inline underline
// than the sidebar card alone).
async function highlightCellExcel(cardKey, location, commentText) {
  const [sheetName, address] = location.includes("!") ? location.split("!") : [null, location];
  try {
    await Excel.run(async (context) => {
      const sheet = sheetName ? context.workbook.worksheets.getItem(sheetName) : context.workbook.worksheets.getActiveWorksheet();
      const range = sheet.getRange(address);
      // No fill color — Excel's own comment-corner triangle is mark enough,
      // and leaves the cell's actual value/formatting fully visible underneath.
      sheet.comments.add(address, FOMO_COMMENT_MARKER + commentText);
      await context.sync();
    });
    highlightedCells.set(cardKey, { host: "excel", sheetName, address });
    saveHighlightedCells();
  } catch (err) {
    console.error("[taskpane] highlighting cell failed:", err);
  }
}

async function clearHighlightExcel(cell) {
  const { sheetName, address } = cell;
  await Excel.run(async (context) => {
    const sheet = sheetName ? context.workbook.worksheets.getItem(sheetName) : context.workbook.worksheets.getActiveWorksheet();
    sheet.comments.getItemByCell(address).delete();
    await context.sync();
  });
}

// Word equivalent of the Excel highlight above — "location" here is a verbatim
// snippet of the source paragraph (see extractStructuredParagraphs in
// lib/microsoft.ts), found via Word's own text search rather than a cell
// address, since paragraphs have no natural coordinate the way cells do.
// Word's highlightColor only accepts a fixed set of named colors, not
// arbitrary hex like Excel's fill, so "Yellow" is the closest match.
async function highlightCellWord(cardKey, location, commentText) {
  try {
    await Word.run(async (context) => {
      const results = context.document.body.search(location, { matchCase: false });
      results.load("items");
      await context.sync();
      if (results.items.length === 0) return;
      const range = results.items[0];
      range.font.highlightColor = "Yellow";
      range.insertComment(FOMO_COMMENT_MARKER + commentText);
      await context.sync();
    });
    highlightedCells.set(cardKey, { host: "word", snippet: location });
    saveHighlightedCells();
  } catch (err) {
    console.error("[taskpane] highlighting Word range failed:", err);
  }
}

async function clearHighlightWord(cell) {
  await Word.run(async (context) => {
    const results = context.document.body.search(cell.snippet, { matchCase: false });
    results.load("items");
    await context.sync();
    if (results.items.length === 0) return;
    const range = results.items[0];
    range.font.highlightColor = "None";
    const comments = range.getComments();
    comments.load("items/content");
    await context.sync();
    for (const comment of comments.items) {
      if (comment.content.startsWith(FOMO_COMMENT_MARKER)) comment.delete();
    }
    await context.sync();
  });
}

function currentHost() {
  if (typeof Office === "undefined" || !Office.context) return null;
  if (Office.context.host === Office.HostType.Excel) return "excel";
  if (Office.context.host === Office.HostType.Word) return "word";
  return null;
}

async function highlightCell(cardKey, location, commentText) {
  const host = currentHost();
  if (host === "excel") return highlightCellExcel(cardKey, location, commentText);
  if (host === "word") return highlightCellWord(cardKey, location, commentText);
}

async function clearHighlight(cardKey) {
  const cell = highlightedCells.get(cardKey);
  if (!cell) return;
  highlightedCells.delete(cardKey);
  saveHighlightedCells();
  try {
    if (cell.host === "excel") await clearHighlightExcel(cell);
    else if (cell.host === "word") await clearHighlightWord(cell);
  } catch (err) {
    console.error("[taskpane] clearing highlight failed:", err);
  }
}

// Self-healing sweep: cardKey-based tracking (highlightedCells/localStorage) only
// knows to clear a highlight it itself remembers setting. A highlight left over
// from before that tracking existed (or from any other gap: a crashed tab, a
// browser storage clear) is permanently invisible to it and would sit stuck
// forever. This instead reconciles against the real workbook state directly:
// scan every comment on the active sheet, and for any one carrying the FOMO
// marker whose cell isn't backed by a currently-open alert, clear it. Only ever
// touches marker-tagged comments, so a real comment the user wrote is never at risk.
async function reconcileHighlights(activeLocations) {
  try {
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      sheet.load("name");
      const comments = sheet.comments;
      comments.load("items");
      await context.sync();

      const stale = [];
      for (const comment of comments.items) {
        comment.load("content");
      }
      await context.sync();
      for (const comment of comments.items) {
        if (!comment.content.startsWith(FOMO_COMMENT_MARKER)) continue;
        const range = comment.getLocation();
        range.load("address");
        stale.push({ comment, range });
      }
      await context.sync();

      for (const { comment, range } of stale) {
        const location = `${sheet.name}!${range.address.replace(/^.*!/, "")}`;
        if (!activeLocations.has(location)) {
          range.format.fill.clear();
          comment.delete();
        }
      }
      await context.sync();
    });
  } catch (err) {
    console.error("[taskpane] reconcileHighlights failed:", err);
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
    const alerts = data.alerts ?? [];
    setDebugInfo([`user: ${anonymousUserId}`, `matching against: "${fileName}"`, `raw url: ${rawUrl}`, `${alerts.length} open conflict(s)`, `last check: ${new Date().toLocaleTimeString()}`, liveEditStatus]);

    // A newly-arrived alert might have been pinned by a check that ran on a
    // DIFFERENT file (e.g. someone else's edit conflicting with this one) — the
    // live-edit path only highlights when THIS file's own check-now call finds
    // something, so polling has to do the same job for that case, not just render
    // the sidebar card.
    const newAlerts = alerts.filter((a) => !currentAlerts.has(a.cardKey));
    renderAlerts(alerts);
    for (const alert of newAlerts) {
      if (alert.location) highlightCell(alert.cardKey, alert.location, alert.text);
    }
    if (typeof Excel !== "undefined") {
      const activeLocations = new Set(alerts.filter((a) => a.location).map((a) => a.location));
      reconcileHighlights(activeLocations);
    }
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
            let startRow = 1;
            let startCol = 1;
            await Excel.run(async (readContext) => {
              const activeSheet = readContext.workbook.worksheets.getActiveWorksheet();
              activeSheet.load("name");
              const used = activeSheet.getUsedRangeOrNullObject(true);
              // .text (not .values) so date/currency/percent cells come through
              // already formatted the way they're displayed (e.g. "11/20/2026"
              // instead of Excel's raw date serial "46346"), matching the
              // Graph-download path's ExcelJS-formatted output below.
              used.load("text,address");
              await readContext.sync();
              if (!used.isNullObject) {
                grid = used.text;
                sheetName = activeSheet.name;
                // used.text is relative to wherever the used range actually
                // starts, NOT necessarily A1 — a table starting at C8 means
                // text[0][0] is C8, not A1. Without parsing this offset out of
                // the address (e.g. "Sheet1!C8:F13") and sending it along, the
                // server would compute every cell's location as if the table
                // started at A1, silently citing the wrong cell (confirmed
                // live: a table at C8:F13 got reported as B2:D4).
                const cellRef = used.address.split("!").pop().split(":")[0];
                const match = cellRef.match(/^([A-Z]+)(\d+)$/);
                if (match) {
                  startRow = parseInt(match[2], 10);
                  startCol = match[1].split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
                }
              }
            });

            liveEditStatus = `live-edit: check-now called ${new Date().toLocaleTimeString()}`;
            const res = await fetch("/api/live-signal/check-now", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ anonymousUserId, fileName, grid, sheetName, startRow, startCol })
            });
            const data = await res.json();
            const alertCount = Array.isArray(data.alerts) ? data.alerts.length : 0;
            liveEditStatus = data.skipped
              ? `live-edit: skipped (${data.skipped}) ${new Date().toLocaleTimeString()} — not a real "no conflict" result`
              : `live-edit: check-now responded ${new Date().toLocaleTimeString()}, ${alertCount} conflict(s)`;
            // poll() (not hand-built alert objects here) so the sidebar cards get
            // the real cardKey/roomSlug from pinned_cards — needed for Dismiss to
            // actually delete the right row, not something check-now's leaner
            // {conflictKind, text, location} results carry on their own. poll()
            // also handles the cell highlights itself now (see poll(), it needs to
            // do the same job for alerts that arrive from OTHER files' checks
            // too), so this only needs to trigger it, not highlight directly.
            if (alertCount > 0) poll();
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

// Requests the pane auto-open the next time a linked document opens, so the
// user doesn't have to manually click the ribbon button before detection is
// running — the closest practical equivalent of Grammarly "just working" the
// moment you open a document. Combined with the shared runtime declared in
// manifest.xml (keeps this JS context alive even if the pane gets closed
// again), this is what actually removes the "has to stay open" requirement,
// not just the "has to be manually opened" one. Best-effort: older Office
// builds don't support this API at all.
function requestAutoLaunch() {
  try {
    if (typeof Office !== "undefined" && Office.addin && Office.addin.setStartupBehavior) {
      Office.addin.setStartupBehavior(Office.StartupBehavior.Load).catch((err) => {
        console.error("[taskpane] setStartupBehavior failed:", err);
      });
    }
  } catch (err) {
    console.error("[taskpane] requestAutoLaunch failed:", err);
  }
}

Office.onReady(() => {
  requestAutoLaunch();
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
    currentAlerts = new Map();
    showView("login");
  });

  if (anonymousUserId) {
    startPolling();
  } else {
    showView("login");
  }
});

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function collectHints() {
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[property="og:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:title"]',
    'meta[name="keywords"]'
  ];
  return selectors
    .map(s => document.querySelector(s)?.getAttribute("content"))
    .filter(Boolean)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 8);
}

function collectPageContent() {
  const parts = [];
  const host = location.hostname.replace(/^www\./, "");

  // Page title
  if (document.title) parts.push("PAGE TITLE: " + document.title);

  // Meta tags (og/twitter only — skip noisy ones)
  document.querySelectorAll("meta[content]").forEach(el => {
    const name = el.getAttribute("name") || el.getAttribute("property") || "";
    const content = el.getAttribute("content") || "";
    if (content && name && (name.startsWith("og:") || name.startsWith("twitter:") || name === "description")) {
      parts.push(`META[${name}]: ${content}`);
    }
  });

  // AI chat tools: extract only the topic being researched, not the full conversation.
  // We deliberately grab just the first user message (the "ask"), not every back-and-forth
  // turn — a full transcript can contain far more sensitive material than a page visit ever
  // would, and all we actually need is a sense of what the person is working on.
  if (host === "claude.ai" || host.includes("chatgpt.com") || host === "chat.openai.com") {
    const userMessageSelectors = [
      '[data-testid="user-message"]',
      '[data-message-author-role="user"]',
      '[data-testid*="user-turn"]'
    ];
    let firstUserMessage = "";
    for (const selector of userMessageSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        firstUserMessage = cleanText(el.textContent).slice(0, 400);
        break;
      }
    }
    if (firstUserMessage) parts.push("INITIAL QUERY: " + firstUserMessage);
    return parts.join("\n\n").slice(0, 25000);
  }

  // YouTube: extract only what matters — channel and description (title comes from tab.title)
  if (host.includes("youtube.com")) {
    const channel = cleanText(
      document.querySelector("ytd-channel-name a, #channel-name a, #owner-name a, yt-formatted-string#owner-name a")?.textContent || ""
    );
    const description = cleanText(
      document.querySelector("#description-inline-expander, ytd-expander #content, #snippet")?.textContent || ""
    ).slice(0, 800);
    if (channel) parts.push("CHANNEL: " + channel);
    if (description) parts.push("VIDEO DESCRIPTION: " + description);
    return parts.join("\n\n").slice(0, 25000);
  }

  // All headings
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4"))
    .map(el => cleanText(el.textContent))
    .filter(Boolean);
  if (headings.length) parts.push("HEADINGS: " + headings.join(" | "));

  // All aria-labels (LinkedIn uses these heavily)
  const ariaLabels = Array.from(document.querySelectorAll("[aria-label]"))
    .map(el => cleanText(el.getAttribute("aria-label")))
    .filter(t => t && t.length > 3 && t.length < 200);
  if (ariaLabels.length) parts.push("ARIA LABELS: " + [...new Set(ariaLabels)].slice(0, 30).join(" | "));

  // Spans and divs with short meaningful text — skip ad/sponsored elements
  const shortTexts = Array.from(document.querySelectorAll("span,div,p,li,a"))
    .filter(el => !el.closest("[data-ad], [aria-label*='sponsored' i], [aria-label*='advertisement' i], .ad, .ads, #ad"))
    .map(el => cleanText(el.textContent))
    .filter(t => t.length > 4 && t.length < 120)
    .filter(t => !t.match(/^[\d\s]+$/));
  const uniqueShort = [...new Set(shortTexts)].slice(0, 60);
  if (uniqueShort.length) parts.push("PAGE TEXT SNIPPETS: " + uniqueShort.join(" | "));

  // Body text
  const bodyText = cleanText(document.body?.innerText || "");
  if (bodyText) parts.push("BODY: " + bodyText.slice(0, 6000));

  return parts.join("\n\n").slice(0, 25000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FOMO_EXTRACT_CONTEXT") {
    return false;
  }

  const delay = location.hostname.includes("youtube.com") ? 5000 : 2500;
  setTimeout(() => {
    sendResponse({ pageHints: collectHints(), pageContent: collectPageContent() });
  }, delay);

  return true;
});

// Grammarly-style in-file alert: while someone is actually looking at a watched Google
// Doc/Sheet/Slide or Word/Excel Online file, poll for a live duplicate/contradiction
// signal on that exact file and surface it as a small dismissible card right on the
// page, instead of relying on a Chrome notification they may never see or click.
(function initLiveSignalWatcher() {
  const LIVE_SIGNAL_POLL_MS = 20000;

  function extractWatchedFileId() {
    const host = location.hostname;
    const path = location.pathname;

    if (host === "docs.google.com") {
      const match = path.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
      if (match) return match[2];
    }

    // Office Online / OneDrive / SharePoint file URLs vary a lot by tenant and entry
    // point, so this covers the most common query-param shapes rather than every case
    // (see lib/microsoft.ts for the same "supported vs not" honesty this mirrors).
    if (host.includes("officeapps.live.com") || host.includes(".sharepoint.com") || host === "office.com" || host === "www.office.com") {
      const params = new URLSearchParams(location.search);
      const candidate = params.get("sourcedoc") || params.get("resid") || params.get("id");
      if (candidate) return candidate.replace(/[{}]/g, "");
    }

    return null;
  }

  let currentFileId = null;
  let pollTimer = null;
  let cardEl = null;
  let shownCardKey = null;

  function removeCard() {
    if (cardEl) {
      cardEl.remove();
      cardEl = null;
    }
  }

  function showCard(alert) {
    if (shownCardKey === alert.cardKey) return;
    removeCard();
    shownCardKey = alert.cardKey;

    cardEl = document.createElement("div");
    cardEl.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      width: 300px; background: #1a1a1a; color: #f7f6f3; border-radius: 12px;
      padding: 14px 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px; line-height: 1.45;
    `;

    const label = alert.conflictKind === "contradiction" ? "Conflicting data found" : "Possible overlap";
    cardEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
        <div style="font-weight:600; color:#f7f6f3;">FOMO — ${label}</div>
        <button id="fomo-dismiss-btn" style="background:none; border:none; color:#9a9a9a; cursor:pointer; font-size:16px; line-height:1; padding:0;">&times;</button>
      </div>
      <div style="color:#d8d8d8;"></div>
    `;
    cardEl.querySelector("div > div:last-child").textContent = alert.text;

    document.documentElement.appendChild(cardEl);
    cardEl.querySelector("#fomo-dismiss-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "FOMO_DISMISS_LIVE_SIGNAL", roomSlug: alert.roomSlug, cardKey: alert.cardKey });
      removeCard();
    });
  }

  async function poll() {
    if (!currentFileId) return;
    const response = await chrome.runtime.sendMessage({ type: "FOMO_CHECK_LIVE_SIGNAL", fileId: currentFileId }).catch(() => null);
    if (response?.alert) showCard(response.alert);
  }

  function start() {
    const fileId = extractWatchedFileId();
    if (!fileId || fileId === currentFileId) return;
    currentFileId = fileId;
    shownCardKey = null;
    removeCard();
    if (pollTimer) clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, LIVE_SIGNAL_POLL_MS);
  }

  start();
  // Google Docs/Sheets and Office Online are single-page apps, so watch for
  // client-side navigation between files without a full page reload.
  let lastPath = location.pathname + location.search;
  setInterval(() => {
    const path = location.pathname + location.search;
    if (path !== lastPath) {
      lastPath = path;
      start();
    }
  }, 3000);
})();

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

  // YouTube: extract only what matters — title, channel, description
  if (host.includes("youtube.com")) {
    const videoTitle = cleanText(document.querySelector("h1.ytd-watch-metadata, h1.title")?.textContent || "");
    const channel = cleanText(document.querySelector("ytd-channel-name a, #channel-name a, #owner-name a")?.textContent || "");
    const description = cleanText(document.querySelector("#description-inline-expander, #description ytd-text-inline-expander, ytd-expander #content")?.textContent || "").slice(0, 500);
    if (videoTitle) parts.push("VIDEO TITLE: " + videoTitle);
    if (channel) parts.push("CHANNEL: " + channel);
    if (description) parts.push("DESCRIPTION: " + description);
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

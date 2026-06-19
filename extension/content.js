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

  // Page title
  if (document.title) parts.push("PAGE TITLE: " + document.title);

  // All meta tags
  document.querySelectorAll("meta[content]").forEach(el => {
    const name = el.getAttribute("name") || el.getAttribute("property") || "";
    const content = el.getAttribute("content") || "";
    if (content && name && !name.includes("viewport") && !name.includes("theme")) {
      parts.push(`META[${name}]: ${content}`);
    }
  });

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

  // All alt text
  const altTexts = Array.from(document.querySelectorAll("img[alt]"))
    .map(el => cleanText(el.getAttribute("alt")))
    .filter(t => t && t.length > 3);
  if (altTexts.length) parts.push("IMAGE ALTS: " + [...new Set(altTexts)].slice(0, 20).join(" | "));

  // Spans and divs with short meaningful text (job titles, company names, skills)
  const shortTexts = Array.from(document.querySelectorAll("span,div,p,li,a"))
    .map(el => cleanText(el.textContent))
    .filter(t => t.length > 4 && t.length < 120)
    .filter(t => !t.match(/^[\d\s]+$/)); // skip pure numbers
  const uniqueShort = [...new Set(shortTexts)].slice(0, 80);
  if (uniqueShort.length) parts.push("PAGE TEXT SNIPPETS: " + uniqueShort.join(" | "));

  // Full body text as fallback
  const bodyText = cleanText(document.body?.innerText || "");
  if (bodyText) parts.push("BODY: " + bodyText.slice(0, 8000));

  return parts.join("\n\n").slice(0, 25000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FOMO_EXTRACT_CONTEXT") {
    return false;
  }

  // Wait for JS-rendered content to settle
  setTimeout(() => {
    sendResponse({
      pageHints: collectHints(),
      pageContent: collectPageContent()
    });
  }, 800);

  return true;
});

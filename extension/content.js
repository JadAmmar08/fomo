function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectHints() {
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    "";
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)
    .slice(0, 8);

  return [cleanText(description), ...headings].filter(Boolean).slice(0, 8);
}

function collectPageContent() {
  const preferred =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.body;

  const text = cleanText(preferred?.innerText || document.body?.innerText || "");
  return text.slice(0, 12000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FOMO_EXTRACT_CONTEXT") {
    return false;
  }

  sendResponse({
    pageHints: collectHints(),
    pageContent: collectPageContent()
  });
  return false;
});

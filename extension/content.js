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
  const text = cleanText(document.body?.innerText || "");
  return text.slice(0, 20000);
}

function collectStructuredSignals() {
  const signals = {};

  // Job titles, roles, professions
  const roleSelectors = [
    '[data-field="experience_current_positions"]',
    '.pv-text-details__left-panel',
    '.text-body-medium',
    '[aria-label*="role"]',
    '[aria-label*="title"]',
    'h2.top-card-layout__headline',
    '.top-card__subline-item',
    '.profile-info-subheader'
  ];
  const roles = roleSelectors.flatMap(sel =>
    Array.from(document.querySelectorAll(sel)).map(el => cleanText(el.textContent))
  ).filter(Boolean).slice(0, 5);
  if (roles.length) signals.roles = roles;

  // Skills, topics, tags
  const skillSelectors = [
    '[data-field="skills"]',
    '.skill-category-entity__name',
    '.pvs-entity__supplementary-info',
    'a[data-control-name*="skill"]',
    '.artdeco-chip__text',
    '[data-js-module-id="ember-skill"]'
  ];
  const skills = skillSelectors.flatMap(sel =>
    Array.from(document.querySelectorAll(sel)).map(el => cleanText(el.textContent))
  ).filter(Boolean).slice(0, 10);
  if (skills.length) signals.skills = skills;

  // About / bio text
  const bioSelectors = [
    '.pv-about-section',
    '[data-field="summary"]',
    '.core-section-container__content p',
    'meta[name="description"]',
    'meta[property="og:description"]'
  ];
  const bio = bioSelectors.map(sel => {
    const el = document.querySelector(sel);
    return el ? cleanText(el.getAttribute('content') || el.textContent) : null;
  }).filter(Boolean)[0] || "";
  if (bio) signals.bio = bio.slice(0, 500);

  // Industry / company
  const industrySelectors = [
    '.pv-text-details__left-panel .text-body-small',
    '[data-field="industry"]',
    '.top-card-layout__company',
    'a[data-field="experience_company_logo"]'
  ];
  const industry = industrySelectors.flatMap(sel =>
    Array.from(document.querySelectorAll(sel)).map(el => cleanText(el.textContent))
  ).filter(Boolean).slice(0, 3);
  if (industry.length) signals.industry = industry;

  // Open Graph / meta signals
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  if (ogTitle) signals.ogTitle = ogTitle;
  if (ogDesc) signals.ogDescription = ogDesc.slice(0, 300);

  return Object.keys(signals).length > 0 ? signals : null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FOMO_EXTRACT_CONTEXT") {
    return false;
  }

  // Wait briefly for JS-rendered content (LinkedIn, etc.) to settle
  setTimeout(() => {
    const structured = collectStructuredSignals();
    const pageContent = collectPageContent();
    const enriched = structured
      ? `${pageContent}\n\n[STRUCTURED_SIGNALS:${JSON.stringify(structured)}]`
      : pageContent;

    sendResponse({
      pageHints: collectHints(),
      pageContent: enriched
    });
  }, 1500);

  return true; // keep message channel open for async response
});

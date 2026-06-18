import {
  classifyPage,
  makeSignalKey,
  normalizeSignal,
  shouldBlock
} from "./classifier.js";

const API_BASE_URL = "http://localhost:3000";
const DEFAULTS = {
  trackingEnabled: true,
  blockedDomains: [],
  sentSignalKeys: {},
  anonymousUserId: null,
  aiClassifications: {}
};
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function isTrackableUrl(url) {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

function isInternalFomoPage(url) {
  try {
    const current = new URL(url);
    const app = new URL(API_BASE_URL);
    return current.origin === app.origin;
  } catch {
    return false;
  }
}

function wasRecentlySent(entry) {
  if (!entry?.sentAt) {
    return false;
  }

  return Date.now() - new Date(entry.sentAt).getTime() < RESEND_COOLDOWN_MS;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set(DEFAULTS);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url && isTrackableUrl(tab.url)) {
    await autoTrackTab(tab);
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url || !isTrackableUrl(tab.url)) {
    return;
  }

  await autoTrackTab(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FOMO_GET_STATE") {
    getCurrentPageState().then(sendResponse);
    return true;
  }

  if (message.type === "FOMO_TOGGLE_TRACKING") {
    chrome.storage.local.set({ trackingEnabled: Boolean(message.enabled) }, async () => {
      let state = await getCurrentPageState();
      if (message.enabled && state.ok && state.currentUrl && state.signal) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await autoTrackUrl(state.currentUrl, state.signal.pageTitle, tab?.id);
        state = await getCurrentPageState();
      }
      sendResponse(state);
    });
    return true;
  }

  if (message.type === "FOMO_NEVER_TRACK_SITE") {
    chrome.storage.local.get(DEFAULTS, async (store) => {
      const anonymousUserId = await ensureAnonymousUserId(store);
      const { normalizedDomain } = normalizeSignal(message.url, message.title);
      const blockedDomains = Array.from(new Set([...store.blockedDomains, normalizedDomain]));
      chrome.storage.local.set({ blockedDomains }, async () => {
        await fetch(`${API_BASE_URL}/api/settings/privacy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonymousUserId, blockDomain: normalizedDomain })
        }).catch(() => undefined);

        sendResponse(await getCurrentPageState());
      });
    });
    return true;
  }

  if (message.type === "FOMO_SEND_SIGNAL") {
    sendSignalForTab(message.url, message.title, true).then(sendResponse);
    return true;
  }

  return false;
});

async function getCurrentPageState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const store = await chrome.storage.local.get(DEFAULTS);

  if (!tab?.url) {
    return { ok: false, reason: "No active tab" };
  }

  if (!isTrackableUrl(tab.url)) {
    return { ok: false, reason: "Only normal web pages can be tracked." };
  }

  const signal = normalizeSignal(tab.url, tab.title || "Untitled page");
  const blocked = shouldBlock(tab.url) || store.blockedDomains.includes(signal.normalizedDomain);
  if (isInternalFomoPage(tab.url)) {
    return {
      ok: true,
      trackingEnabled: store.trackingEnabled,
      blocked: true,
      alreadySent: true,
      currentUrl: tab.url,
      signal,
      classification: {
        category: "technology",
        topicLabel: "FOMO internal page",
        topicTags: ["FOMO"],
        confidence: 1,
        reasoning: "FOMO does not track its own local dashboard pages."
      }
    };
  }
  const classification = await getAiClassificationForTab(tab.url, tab.title || "Untitled page", tab.id, store);
  const alreadySent = wasRecentlySent(store.sentSignalKeys[makeSignalKey(signal)]);

  return {
    ok: true,
    trackingEnabled: store.trackingEnabled,
    blocked,
    alreadySent,
    currentUrl: tab.url,
    signal,
    classification
  };
}

async function autoTrackTab(tab) {
  return autoTrackUrl(tab.url, tab.title || "Untitled page", tab.id);
}

async function autoTrackUrl(url, title, tabId) {
  return sendSignalForTab(url, title, false, tabId);
}

async function ensureAnonymousUserId(store) {
  if (store.anonymousUserId) {
    return store.anonymousUserId;
  }

  const response = await fetch(`${API_BASE_URL}/api/session`).catch(() => null);
  if (!response?.ok) {
    return null;
  }

  const data = await response.json();
  if (data?.anonymousUserId) {
    await chrome.storage.local.set({ anonymousUserId: data.anonymousUserId });
    return data.anonymousUserId;
  }

  return null;
}

async function getPageContext(tabId) {
  if (typeof tabId !== "number") {
    return { pageHints: [], pageContent: "" };
  }

  const response = await chrome.tabs.sendMessage(tabId, {
    type: "FOMO_EXTRACT_CONTEXT"
  }).catch(() => null);

  return {
    pageHints: Array.isArray(response?.pageHints) ? response.pageHints : [],
    pageContent: typeof response?.pageContent === "string" ? response.pageContent : ""
  };
}

async function getAiClassificationForTab(url, title, tabId, existingStore) {
  const signal = normalizeSignal(url, title);
  const store = existingStore ?? (await chrome.storage.local.get(DEFAULTS));
  const signalKey = makeSignalKey(signal);
  const cached = store.aiClassifications?.[signalKey];
  if (cached?.classification) {
    return cached.classification;
  }

  const pageContext = await getPageContext(tabId);
  const localClassification = classifyPage(url, title);
  const response = await fetch(`${API_BASE_URL}/api/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...signal,
      pageHints: pageContext.pageHints,
      pageContent: pageContext.pageContent,
      localCategory: localClassification.category,
      localTopicLabel: localClassification.topicLabel,
      localTopicTags: localClassification.topicTags,
      localConfidence: localClassification.confidence,
      localReasoning: localClassification.reasoning
    })
  }).catch(() => null);

  const classification = response?.ok ? await response.json() : localClassification;

  await chrome.storage.local.set({
    aiClassifications: {
      ...store.aiClassifications,
      [signalKey]: {
        classification,
        cachedAt: new Date().toISOString()
      }
    }
  });

  return classification;
}

async function sendSignalForTab(url, title, force, tabId) {
  if (!isTrackableUrl(url)) {
    return { ok: false, reason: "Only normal web pages can be tracked." };
  }

  const store = await chrome.storage.local.get(DEFAULTS);
  const anonymousUserId = await ensureAnonymousUserId(store);
  const signal = normalizeSignal(url, title);
  const signalKey = makeSignalKey(signal);
  const blocked = shouldBlock(url) || store.blockedDomains.includes(signal.normalizedDomain);

  if (!store.trackingEnabled) {
    return { ok: false, reason: "Tracking is paused" };
  }

  if (blocked) {
    return { ok: false, reason: "This site is excluded from tracking" };
  }

  if (isInternalFomoPage(url)) {
    return { ok: false, reason: "FOMO does not track its own dashboard pages." };
  }

  if (!force && wasRecentlySent(store.sentSignalKeys[signalKey])) {
    return { ok: true, skipped: true, reason: "Already synced this page recently." };
  }

  const pageContext = await getPageContext(tabId);
  const aiClassification = await getAiClassificationForTab(url, title, tabId, store);

  const response = await fetch(`${API_BASE_URL}/api/signals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...signal,
      anonymousUserId,
      pageHints: pageContext.pageHints,
      pageContent: pageContext.pageContent,
      localCategory: aiClassification.category,
      localTopicLabel: aiClassification.topicLabel,
      localTopicTags: aiClassification.topicTags,
      localConfidence: aiClassification.confidence,
      localReasoning: aiClassification.reasoning,
      preclassified: true,
      source: "extension"
    })
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false, reason: "Backend rejected the signal" };
  }

  await chrome.storage.local.set({
    sentSignalKeys: {
      ...store.sentSignalKeys,
      [signalKey]: {
        sentAt: new Date().toISOString(),
        category: aiClassification.category,
        topicLabel: aiClassification.topicLabel
      }
    }
  });

  return { ok: true, signal, classification: aiClassification };
}

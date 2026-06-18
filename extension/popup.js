const trackingToggle = document.getElementById("trackingToggle");
const trackingStatus = document.getElementById("trackingStatus");
const topicLabel = document.getElementById("topicLabel");
const topicTags = document.getElementById("topicTags");
const reason = document.getElementById("reason");

let currentState = null;

async function loadState() {
  currentState = await chrome.runtime.sendMessage({ type: "FOMO_GET_STATE" });

  if (!currentState?.ok) {
    topicLabel.textContent = "Unavailable";
    topicTags.innerHTML = "";
    reason.textContent = currentState?.reason || "Could not inspect the current tab.";
    return;
  }

  trackingToggle.checked = Boolean(currentState.trackingEnabled);
  trackingStatus.textContent = currentState.blocked
    ? "This page is blocked from tracking."
    : currentState.trackingEnabled
      ? currentState.alreadySent
        ? "Tracking is on."
        : "Tracking is on."
      : "Tracking is paused.";
  topicLabel.textContent = currentState.classification.topicLabel || currentState.classification.category;
  topicTags.innerHTML = "";
  (currentState.classification.topicTags || []).forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    topicTags.appendChild(span);
  });
  reason.textContent = currentState.classification.reasoning;
}

trackingToggle.addEventListener("change", async () => {
  currentState = await chrome.runtime.sendMessage({
    type: "FOMO_TOGGLE_TRACKING",
    enabled: trackingToggle.checked
  });
  loadState();
});

loadState();

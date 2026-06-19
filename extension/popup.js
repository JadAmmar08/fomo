const trackingToggle = document.getElementById("trackingToggle");
const trackingStatus = document.getElementById("trackingStatus");
const statusDot = document.getElementById("statusDot");
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
    trackingStatus.textContent = "Unavailable";
    statusDot.classList.remove("active");
    return;
  }

  const active = !currentState.blocked && currentState.trackingEnabled;
  trackingToggle.checked = Boolean(currentState.trackingEnabled);
  statusDot.classList.toggle("active", active);
  trackingStatus.textContent = currentState.blocked
    ? "Page excluded"
    : currentState.trackingEnabled
      ? "Tracking"
      : "Paused";

  topicLabel.textContent = currentState.classification?.topicLabel || currentState.classification?.category || "Unknown";
  topicTags.innerHTML = "";
  (currentState.classification?.topicTags || []).forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    topicTags.appendChild(span);
  });
  reason.textContent = "";
}

trackingToggle.addEventListener("change", async () => {
  currentState = await chrome.runtime.sendMessage({
    type: "FOMO_TOGGLE_TRACKING",
    enabled: trackingToggle.checked
  });
  loadState();
});

loadState();

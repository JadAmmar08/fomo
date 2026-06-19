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

  const label = currentState.classification?.topicLabel || currentState.classification?.category || "Unknown";
  const dwell = currentState.dwellSeconds || 0;
  const dwellText = dwell > 60 ? ` · ${Math.round(dwell / 60)}m` : dwell > 5 ? ` · ${dwell}s` : "";
  topicLabel.textContent = label + dwellText;
  const tags = (currentState.classification?.topicTags || []).slice(0, 2);
  topicTags.innerHTML = "";
  tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    topicTags.appendChild(span);
  });
  topicTags.style.display = tags.length ? "flex" : "none";
}

trackingToggle.addEventListener("change", async () => {
  currentState = await chrome.runtime.sendMessage({
    type: "FOMO_TOGGLE_TRACKING",
    enabled: trackingToggle.checked
  });
  loadState();
});

loadState();

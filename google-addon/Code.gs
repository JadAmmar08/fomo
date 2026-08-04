// FOMO Live Signal — a Google Workspace Editor Add-on. Installs once via Extensions
// menu and shows up automatically in every Doc/Sheet from then on. Google's
// cross-file add-on framework only supports CardService UI (buttons/text/cards),
// not arbitrary HTML/JS — so unlike the Office add-in's auto-polling sidebar, this
// is a manual "Check for FOMO alerts" button rather than live background polling.
// That's a real platform constraint, not a shortcut.

const APP_URL = "https://usefomo.net";
const PROPS = PropertiesService.getUserProperties();
const USER_ID_KEY = "fomo_anonymous_user_id";
const LAST_ROOM_KEY = "fomo_last_room_slug";
const LAST_CARD_KEY = "fomo_last_card_key";

function onHomepage(e) {
  return buildCard(e);
}

function buildCard(e) {
  const anonymousUserId = PROPS.getProperty(USER_ID_KEY);
  if (!anonymousUserId) {
    return buildLoginCard();
  }
  return buildAlertsCard(e, null);
}

function buildLoginCard() {
  const emailInput = CardService.newTextInput()
    .setFieldName("email")
    .setTitle("Your email")
    .setHint("you@company.com");

  const loginButton = CardService.newTextButton()
    .setText("Sign in")
    .setOnClickAction(CardService.newAction().setFunctionName("handleLogin"));

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Sign in to check for live duplicate/conflict alerts on this file."))
    .addWidget(emailInput)
    .addWidget(loginButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("FOMO Live Signal"))
    .addSection(section)
    .build();
}

function handleLogin(e) {
  const email = (e.formInput && e.formInput.email || "").trim();
  if (!email) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Enter an email first."))
      .build();
  }

  try {
    const res = UrlFetchApp.fetch(`${APP_URL}/api/auth/login`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ email }),
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText());
    if (!data.anonymousUserId) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Sign-in failed. Try again."))
        .build();
    }
    PROPS.setProperty(USER_ID_KEY, data.anonymousUserId);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(buildAlertsCard(e, null)))
      .build();
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Sign-in failed: " + err))
      .build();
  }
}

function signOut(e) {
  PROPS.deleteProperty(USER_ID_KEY);
  PROPS.deleteProperty(LAST_ROOM_KEY);
  PROPS.deleteProperty(LAST_CARD_KEY);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildLoginCard()))
    .build();
}

// Docs and Sheets homepage-trigger events carry the open file's real Drive id
// directly (e.docs.id / e.sheets.id) — this is the actual driveItem id, the same
// one already stored as sourceFileId on pinned cards, so matching is exact, not
// the fuzzy filename matching the Word/Excel add-in needs.
function getActiveFileId(e) {
  if (e && e.docs && e.docs.id) return e.docs.id;
  if (e && e.sheets && e.sheets.id) return e.sheets.id;
  return null;
}

function checkAlerts(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildAlertsCard(e, "checking")))
    .build();
}

function buildAlertsCard(e, mode) {
  const anonymousUserId = PROPS.getProperty(USER_ID_KEY);
  const fileId = getActiveFileId(e);

  const section = CardService.newCardSection();

  if (!fileId) {
    section.addWidget(CardService.newTextParagraph().setText("Open a Google Doc or Sheet to check for alerts."));
  } else {
    let alert = null;
    try {
      const res = UrlFetchApp.fetch(
        `${APP_URL}/api/live-signal?anonymousUserId=${encodeURIComponent(anonymousUserId)}&fileId=${encodeURIComponent(fileId)}`,
        { muteHttpExceptions: true }
      );
      const data = JSON.parse(res.getContentText());
      alert = data.alert || null;
    } catch (err) {
      section.addWidget(CardService.newTextParagraph().setText("Couldn't reach FOMO: " + err));
    }

    if (alert) {
      PROPS.setProperty(LAST_ROOM_KEY, alert.roomSlug);
      PROPS.setProperty(LAST_CARD_KEY, alert.cardKey);
      const label = alert.conflictKind === "contradiction" ? "Conflicting data found" : "Possible overlap";
      section.addWidget(CardService.newTextParagraph().setText(`<b>${label}</b><br>${alert.text}`));
      section.addWidget(
        CardService.newTextButton()
          .setText("Dismiss")
          .setOnClickAction(CardService.newAction().setFunctionName("dismissAlert"))
      );
    } else {
      section.addWidget(CardService.newTextParagraph().setText("No conflicts found for this file right now."));
    }
  }

  section.addWidget(
    CardService.newTextButton()
      .setText("Check for FOMO alerts")
      .setOnClickAction(CardService.newAction().setFunctionName("checkAlerts"))
  );

  const footer = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("Sign out")
        .setOnClickAction(CardService.newAction().setFunctionName("signOut"))
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("FOMO Live Signal"))
    .addSection(section)
    .addSection(footer)
    .build();
}

function dismissAlert(e) {
  const anonymousUserId = PROPS.getProperty(USER_ID_KEY);
  const roomSlug = PROPS.getProperty(LAST_ROOM_KEY);
  const cardKey = PROPS.getProperty(LAST_CARD_KEY);

  if (anonymousUserId && roomSlug && cardKey) {
    try {
      UrlFetchApp.fetch(`${APP_URL}/api/live-signal/dismiss`, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ anonymousUserId, roomSlug, cardKey }),
        muteHttpExceptions: true
      });
    } catch (err) {
      // best-effort — the next "Check for FOMO alerts" click will just show it again
    }
  }
  PROPS.deleteProperty(LAST_ROOM_KEY);
  PROPS.deleteProperty(LAST_CARD_KEY);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildAlertsCard(e, null)))
    .build();
}

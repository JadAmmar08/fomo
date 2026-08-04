"use client";

import { PublicClientApplication, type IPublicClientApplication, type AccountInfo } from "@azure/msal-browser";

// Microsoft's current, actively maintained OneDrive/SharePoint file picker (v8) —
// replaces the legacy js.live.net v7.2 SDK, which is unmaintained and whose popup
// tracking breaks in current Chrome. v8 is a page Microsoft hosts (either as an
// iframe or a popup) that you talk to over postMessage/MessageChannel, not a script
// tag with its own open() call. Consumer (personal) OneDrive accounts only for now —
// work/school accounts need a tenant-specific SharePoint "my site" base URL that
// isn't reliably derivable from what we store today; a real, separate limitation,
// not an oversight.
const CONSUMER_BASE_URL = "https://onedrive.live.com/picker";
const CONSUMER_AUTHORITY = "https://login.microsoftonline.com/consumers";
// Per Microsoft's docs, the consumer OneDrive picker uses this literal scope name —
// NOT a `{resource}/.default` scope (that pattern is for SharePoint/work-school
// base URLs, which have their own registered API resource; onedrive.live.com/picker
// isn't one, and requesting it that way is a real, confirmed invalid_scope error).
const PICKER_SCOPE = "OneDrive.ReadOnly";
const RETURN_TO_KEY = "fomo_msal_return_to";
const CACHED_FOR_KEY = "fomo_msal_cached_for";

let msalInstance: IPublicClientApplication | null = null;
let msalInitPromise: Promise<IPublicClientApplication> | null = null;

// MSAL's own cache lives in browser localStorage, scoped to the origin — not to
// which FOMO account is currently logged in. Two different FOMO accounts in the
// same browser would otherwise silently share whichever Microsoft account was
// last signed in, since acquireTokenSilent just grabs the cached account with no
// idea a different FOMO identity is now active. This reads the same cookie the
// backend uses to key `anonymous_user_id`.
function getCurrentFomoUserId(): string | null {
  const match = document.cookie.match(/(?:^|; )fomo_anonymous_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// A single popup can only itself open one further popup (MSAL's own sign-in window)
// before browsers start blocking the second one — confirmed directly, not assumed.
// So the very first sign-in in a browser has to happen as a full-page redirect
// (bulletproof against popup blockers) rather than a nested popup. Once MSAL has a
// cached account from that redirect, every later "browse OneDrive" click can get a
// token silently (no popup) and only the picker itself needs to open one.
function getMsal(): Promise<IPublicClientApplication> {
  if (msalInstance) return Promise.resolve(msalInstance);
  if (msalInitPromise) return msalInitPromise;

  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_MICROSOFT_CLIENT_ID not set");

  msalInitPromise = (async () => {
    const app = new PublicClientApplication({
      auth: {
        clientId,
        authority: CONSUMER_AUTHORITY,
        redirectUri: window.location.origin
      }
    });
    await app.initialize();

    // Resolves the account from a just-completed loginRedirect, if this page load is
    // the return leg of one. No-ops harmlessly on a normal page load with no redirect
    // response present.
    const redirectResult = await app.handleRedirectPromise();
    if (redirectResult?.account) {
      app.setActiveAccount(redirectResult.account);
    }

    const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
    if (returnTo && redirectResult) {
      sessionStorage.removeItem(RETURN_TO_KEY);
      if (returnTo !== window.location.pathname) {
        window.location.href = returnTo;
      }
    }

    msalInstance = app;
    return app;
  })();
  return msalInitPromise;
}

// Called once from the root layout on every page load — the redirect back from
// Microsoft's sign-in can land on any page (whichever was current when the redirect
// was initiated isn't where Microsoft sends it back to), so this can't be left to
// only run lazily inside the team page that started it.
export function initMicrosoftAuthRedirectHandling() {
  if (!process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) return;
  getMsal().catch((err) => console.error("[microsoft-picker] redirect handling failed:", err));
}

async function getCachedAccount(): Promise<AccountInfo | null> {
  const app = await getMsal();

  const currentFomoUser = getCurrentFomoUserId();
  const cachedFor = sessionStorage.getItem(CACHED_FOR_KEY);
  if (currentFomoUser && cachedFor && cachedFor !== currentFomoUser) {
    // A different FOMO account is now active in this browser than the one that
    // last signed into Microsoft here — drop the stale cache so the next picker
    // click does a real interactive sign-in instead of silently reusing the
    // previous FOMO account's OneDrive.
    const accounts = app.getAllAccounts();
    for (const acct of accounts) {
      await app.clearCache({ account: acct });
    }
    sessionStorage.removeItem(CACHED_FOR_KEY);
    return null;
  }

  const account = app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
  if (account && currentFomoUser && !cachedFor) {
    sessionStorage.setItem(CACHED_FOR_KEY, currentFomoUser);
  }
  return account;
}

interface AuthenticateCommand {
  command: "authenticate";
  resource: string;
}

// This build only supports consumer OneDrive accounts, so every "authenticate"
// command the picker sends — the initial page load and every later request while
// browsing — gets the same literal scope, regardless of what `resource` value the
// picker happens to pass at runtime (it doesn't reliably match CONSUMER_BASE_URL
// exactly, confirmed by an "unableToObtainToken" error when it was checked for
// equality). A resource-derived `.default` scope only applies to the SharePoint/
// work-school picker, which this doesn't handle yet.
async function getToken(_command: AuthenticateCommand): Promise<string> {
  const app = await getMsal();
  const account = await getCachedAccount();
  if (!account) throw new Error("No signed-in Microsoft account");

  const result = await app.acquireTokenSilent({ scopes: [PICKER_SCOPE], account });
  return result.accessToken;
}

interface PickedFile {
  id: string;
  name: string;
}

// First-ever call in a browser: no cached account, so this redirects the whole page
// to Microsoft sign-in and returns — there is no popup to open yet. The caller
// (browseAndAddFiles) should treat a `null` return here as "in progress, page is
// navigating," not as a real failure or cancellation.
async function openPicker(mode: "files" | "folders"): Promise<PickedFile[] | null> {
  const app = await getMsal();
  const account = await getCachedAccount();

  if (!account) {
    sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname);
    await app.loginRedirect({ scopes: [PICKER_SCOPE] });
    return null;
  }

  // Opened synchronously relative to the click (no `await` before it) so it survives
  // popup blockers — by this point we already have a cached account, so the token
  // fetch just below is silent and fast, not another interactive popup.
  const win = window.open("", "OneDrivePicker", "width=1080,height=680");
  if (!win) {
    console.error("[microsoft-picker] popup blocked");
    return null;
  }

  let initialToken: string;
  try {
    initialToken = await getToken({ command: "authenticate", resource: CONSUMER_BASE_URL });
  } catch (err) {
    console.error("[microsoft-picker] initial auth failed:", err);
    win.close();
    return null;
  }

  return new Promise((resolve) => {
    const channelId = crypto.randomUUID();
    let port: MessagePort | null = null;
    let resolved = false;

    function finish(result: PickedFile[] | null) {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("message", onWindowMessage);
      win!.close();
      resolve(result);
    }

    async function onPortMessage(event: MessageEvent) {
      const payload = event.data;
      if (payload.type === "notification") return;
      if (payload.type !== "command") return;

      port!.postMessage({ type: "acknowledge", id: payload.id });
      const command = payload.data;

      if (command.command === "authenticate") {
        try {
          const token = await getToken(command);
          port!.postMessage({ type: "result", id: payload.id, data: { result: "token", token } });
        } catch (err) {
          port!.postMessage({
            type: "result",
            id: payload.id,
            data: { result: "error", error: { code: "unableToObtainToken", message: String(err) } }
          });
        }
        return;
      }

      if (command.command === "pick") {
        const items = (command.items ?? []) as Array<{ id: string; name?: string }>;
        finish(items.map((item) => ({ id: item.id, name: item.name ?? "Untitled" })));
        port!.postMessage({ type: "result", id: payload.id, data: { result: "success" } });
        return;
      }

      if (command.command === "close") {
        finish(null);
        return;
      }

      port!.postMessage({
        type: "result",
        id: payload.id,
        data: { result: "error", error: { code: "unsupportedCommand", message: command.command } }
      });
    }

    function onWindowMessage(event: MessageEvent) {
      if (event.source !== win) return;
      const message = event.data;
      if (message.type === "initialize" && message.channelId === channelId) {
        port = event.ports[0];
        port.addEventListener("message", onPortMessage);
        port.start();
        port.postMessage({ type: "activate" });
      }
    }

    window.addEventListener("message", onWindowMessage);

    const options = {
      sdk: "8.0",
      entry: { oneDrive: { files: {} } },
      authentication: {},
      messaging: { origin: window.location.origin, channelId },
      typesAndSources: { mode, pivots: { oneDrive: true, recent: mode === "files" } },
      selection: { mode: mode === "files" ? "multiple" : "single" }
    };

    // No /_layouts/15/FilePicker.aspx suffix here — that's the SharePoint/work-school
    // convention. The consumer endpoint is the bare base URL itself; confirmed against
    // Microsoft's own reference sample (OneDrive/samples, javascript-basic-consumer)
    // after the SharePoint-style path produced a real "item might not exist" error.
    const queryString = new URLSearchParams({ filePicker: JSON.stringify(options) });
    const url = `${CONSUMER_BASE_URL}?${queryString.toString()}`;

    const form = win.document.createElement("form");
    form.setAttribute("action", url);
    form.setAttribute("method", "POST");
    const tokenInput = win.document.createElement("input");
    tokenInput.setAttribute("type", "hidden");
    tokenInput.setAttribute("name", "access_token");
    tokenInput.setAttribute("value", initialToken);
    form.appendChild(tokenInput);
    win.document.body.appendChild(form);
    form.submit();
  });
}

export function openMicrosoftPicker(): Promise<PickedFile[] | null> {
  return openPicker("files");
}

// Same widget, restricted to folder selection — used by "or choose a folder", which
// previously fell back to a plain custom dropdown while file-picking got the real
// native browser.
export async function openMicrosoftFolderPicker(): Promise<PickedFile | null> {
  const files = await openPicker("folders");
  return files?.[0] ?? null;
}

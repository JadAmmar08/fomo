"use client";

import { PublicClientApplication, InteractionRequiredAuthError, type IPublicClientApplication, type AccountInfo } from "@azure/msal-browser";

// Microsoft's current, actively maintained OneDrive/SharePoint file picker (v8) —
// replaces the legacy js.live.net v7.2 SDK, which is unmaintained and whose popup
// tracking breaks in current Chrome. v8 is a page Microsoft hosts (either as an
// iframe or a popup) that you talk to over postMessage/MessageChannel, not a script
// tag with its own open() call.
//
// Two genuinely different account types are supported, because they use different
// picker hosts and different token resources:
//  - Personal (MSA) accounts: onedrive.live.com/picker, scope "OneDrive.ReadOnly".
//  - Work/school (Entra ID org) accounts: {tenant}-my.sharepoint.com's
//    FilePicker.aspx, scope "{that origin}/.default" — a SharePoint-resource
//    token, not a Graph token. Which origin to use isn't knowable up front; it's
//    derived per-account from Graph's /me/drive.webUrl the first time that
//    account is used, then cached.
const CONSUMER_BASE_URL = "https://onedrive.live.com/picker";
// "common" (not the old hardcoded /consumers) at the app level, so both personal
// and work/school accounts can sign in through the same MSAL instance. But the
// "OneDrive.ReadOnly" scope itself only resolves through the dedicated /consumers
// authority specifically — requesting it via /common throws AADSTS70011 ("scope is
// not configured for this tenant"), confirmed live. So CONSUMER_AUTHORITY is still
// needed as a per-call override for that one scope; every other call (sign-in
// itself, work-account SharePoint scopes) uses the app-level AUTHORITY.
const AUTHORITY = "https://login.microsoftonline.com/common";
const CONSUMER_AUTHORITY = "https://login.microsoftonline.com/consumers";
const MSA_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";
// Per Microsoft's docs, the consumer OneDrive picker uses this literal scope name —
// NOT a `{resource}/.default` scope (that pattern is for SharePoint/work-school
// base URLs, which have their own registered API resource; onedrive.live.com/picker
// isn't one, and requesting it that way is a real, confirmed invalid_scope error).
const CONSUMER_PICKER_SCOPE = "OneDrive.ReadOnly";
const RETURN_TO_KEY = "fomo_msal_return_to";
const ATTEMPTED_FOR_KEY = "fomo_msal_attempted_for";

let msalInstance: IPublicClientApplication | null = null;
let msalInitPromise: Promise<IPublicClientApplication> | null = null;
// Keyed by account.homeAccountId — avoids an extra Graph round trip on every
// picker open for the same work account.
const sharePointOriginCache = new Map<string, string>();

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
        authority: AUTHORITY,
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

// The well-known consumer tenant id — every personal Microsoft account's id_token
// carries this as `tid` regardless of which personal account it is. Anything else
// is a real Entra ID organization tenant, i.e. a work/school account.
function isWorkAccount(account: AccountInfo): boolean {
  return Boolean(account.tenantId) && account.tenantId !== MSA_TENANT_ID;
}

// The client-side MSAL cache is keyed by whatever Microsoft account has signed
// into this browser before — it has no idea which account is actually connected
// server-side for this room (that's stored separately as `microsoft_email` on
// `microsoft_connections`, set via the OAuth flow in lib/microsoft.ts). Trying to
// heuristically guess "is the cache stale" from FOMO login state doesn't work,
// because MSAL account records can survive a partial cache clear. So instead:
// always resolve against server truth. If `expectedEmail` is given, only ever use
// a cached account whose username actually matches it; anything else — no match,
// or no expected email known yet — forces a real interactive sign-in.
async function getCachedAccount(expectedEmail: string | null): Promise<AccountInfo | null> {
  const app = await getMsal();
  const accounts = app.getAllAccounts();

  if (expectedEmail) {
    const match = accounts.find((a) => a.username?.toLowerCase() === expectedEmail.toLowerCase());
    if (match) {
      app.setActiveAccount(match);
      return match;
    }
    return null;
  }

  return app.getActiveAccount() ?? accounts[0] ?? null;
}

// Work/school OneDrive lives on a per-tenant SharePoint host
// (e.g. https://contoso-my.sharepoint.com) that isn't derivable from anything we
// store — it has to be read off the account's own Graph drive record. Requires a
// Graph-scoped token first (a different resource than the SharePoint picker token
// this feeds into).
async function getSharePointOrigin(app: IPublicClientApplication, account: AccountInfo): Promise<string> {
  const cached = sharePointOriginCache.get(account.homeAccountId);
  if (cached) return cached;

  const graphToken = await acquireToken(app, account, ["https://graph.microsoft.com/Files.Read"]);
  const res = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
    headers: { Authorization: `Bearer ${graphToken}` }
  });
  if (!res.ok) throw new Error("Could not resolve this work account's SharePoint site");
  const data = (await res.json()) as { webUrl?: string };
  if (!data.webUrl) throw new Error("Graph didn't return a drive URL for this work account");

  const origin = new URL(data.webUrl).origin;
  sharePointOriginCache.set(account.homeAccountId, origin);
  return origin;
}

// Silent-first, redirect-fallback: the scopes actually needed (OneDrive.ReadOnly, a
// SharePoint-resource `.default`, or Graph's Files.Read) are different resources
// than whatever was consented to at initial sign-in, so a plain silent call can
// legitimately need one-time interactive consent the first time. This deliberately
// does NOT fall back to acquireTokenPopup — this often runs after a picker popup is
// already open (see openPicker below), and opening a second, nested popup for
// consent hits the same "one popup can only open one more" browser limit the
// original login flow exists to avoid. A full-page redirect works from any nesting
// depth, at the cost of losing whatever picker window was open (acceptable: the
// user just clicks "browse OneDrive" again after landing back on the page, and it
// works silently from then on since consent is now granted).
async function acquireToken(app: IPublicClientApplication, account: AccountInfo, scopes: string[], authority?: string): Promise<string> {
  try {
    const result = await app.acquireTokenSilent({ scopes, account, authority });
    return result.accessToken;
  } catch (err) {
    if (!(err instanceof InteractionRequiredAuthError)) throw err;
    sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname);
    await app.loginRedirect({ scopes, account, authority, loginHint: account.username });
    throw new Error("Redirecting for consent — picker call should be retried after redirect returns.");
  }
}

interface PickerTarget {
  baseUrl: string;
  scopes: string[];
  authority?: string;
}

async function resolvePickerTarget(app: IPublicClientApplication, account: AccountInfo): Promise<PickerTarget> {
  if (isWorkAccount(account)) {
    const origin = await getSharePointOrigin(app, account);
    return { baseUrl: `${origin}/_layouts/15/FilePicker.aspx`, scopes: [`${origin}/.default`] };
  }
  // OneDrive.ReadOnly must be requested against /consumers specifically — see
  // CONSUMER_AUTHORITY comment above.
  return { baseUrl: CONSUMER_BASE_URL, scopes: [CONSUMER_PICKER_SCOPE], authority: CONSUMER_AUTHORITY };
}

interface PickedFile {
  id: string;
  name: string;
}

// First-ever call in a browser, or a call where the cached account doesn't match
// the server-connected email: no usable cached account, so this redirects the
// whole page to Microsoft sign-in and returns — there is no popup to open yet.
// The caller (browseAndAddFiles) should treat a `null` return here as "in
// progress, page is navigating," not as a real failure or cancellation.
async function openPicker(mode: "files" | "folders", expectedEmail: string | null): Promise<PickedFile[] | null> {
  const app = await getMsal();
  const account = await getCachedAccount(expectedEmail);

  if (!account) {
    // Without this, picking the wrong account in Microsoft's chooser (a different
    // one than whatever's actually connected server-side for this room) redirected
    // forever with no explanation — getCachedAccount kept finding no match, so
    // openPicker kept redirecting again on every click. If we already tried once
    // for this exact expectedEmail and still have no match, but MSAL *does* have
    // some cached account now, that account is just the wrong one — stop and say
    // so instead of looping.
    const attemptedFor = sessionStorage.getItem(ATTEMPTED_FOR_KEY);
    if (expectedEmail && attemptedFor === expectedEmail && app.getAllAccounts().length > 0) {
      sessionStorage.removeItem(ATTEMPTED_FOR_KEY);
      const wrongAccount = app.getAllAccounts()[0]?.username ?? "a different account";
      window.alert(
        `This room is connected to ${expectedEmail}, but you signed into ${wrongAccount} just now. ` +
        `Pick "${expectedEmail}" in Microsoft's chooser, or use Disconnect below to switch this room to ${wrongAccount} instead.`
      );
      return null;
    }

    if (expectedEmail) sessionStorage.setItem(ATTEMPTED_FOR_KEY, expectedEmail);
    sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname);
    // Login itself only requests Graph scopes (valid for both personal and
    // work/school accounts on the "common" authority) — it can't know yet which
    // picker resource (OneDrive.ReadOnly vs. a SharePoint origin) it'll need,
    // since that depends on which account type signs in. The resource-specific
    // token is acquired afterward, in resolvePickerTarget/acquireToken.
    // prompt: "select_account" so Microsoft shows the chooser instead of silently
    // re-authenticating via the browser's existing SSO cookie. login_hint further
    // pre-selects the account we actually need, when we know which one that is.
    await app.loginRedirect({
      scopes: ["User.Read", "Files.Read", "offline_access"],
      prompt: "select_account",
      loginHint: expectedEmail ?? undefined
    });
    return null;
  }

  sessionStorage.removeItem(ATTEMPTED_FOR_KEY);
  // Re-bound to a fresh const: TS can't carry the `!account` narrowing above into
  // the nested onPortMessage closure below, since it can't prove the outer const
  // isn't reassigned before the closure runs.
  const activeAccount: AccountInfo = account;

  // Opened as early as possible — getCachedAccount above is a fast, local lookup
  // (in-memory/localStorage, no network), so this is still close enough to the
  // click for browsers to trust it as a real popup. resolvePickerTarget for a work
  // account does a real network round trip (Graph /me/drive), so it has to run
  // AFTER the window is open, not before — putting it before window.open() here
  // once pushed this past the browser's user-activation window entirely, causing
  // the popup to open blank and get killed immediately instead of being blocked
  // outright (which at least would have been visible/debuggable).
  const win = window.open("", "OneDrivePicker", "width=1080,height=680");
  if (!win) {
    console.error("[microsoft-picker] popup blocked");
    return null;
  }

  let target: PickerTarget;
  let initialToken: string;
  try {
    target = await resolvePickerTarget(app, activeAccount);
    initialToken = await acquireToken(app, activeAccount, target.scopes, target.authority);
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
          const token = await acquireToken(app, activeAccount, target.scopes, target.authority);
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

    // No /_layouts/15/FilePicker.aspx suffix for consumer accounts — that's the
    // SharePoint/work-school convention (which target.baseUrl already includes for
    // work accounts, via resolvePickerTarget). The consumer endpoint is the bare
    // base URL itself; confirmed against Microsoft's own reference sample
    // (OneDrive/samples, javascript-basic-consumer) after the SharePoint-style path
    // produced a real "item might not exist" error for a personal account.
    const queryString = new URLSearchParams({ filePicker: JSON.stringify(options) });
    const url = `${target.baseUrl}?${queryString.toString()}`;

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

// `expectedEmail` should be the room's currently connected `microsoft_email`
// (from the workstream status API) — this is what makes the picker actually
// track whichever account is connected server-side, instead of whatever
// Microsoft account happens to be cached in this browser.
export function openMicrosoftPicker(expectedEmail: string | null): Promise<PickedFile[] | null> {
  return openPicker("files", expectedEmail);
}

// Clears every cached Microsoft account in this browser's MSAL instance. Kept as
// a blunt "forget everything" for Disconnect, since the email-matching in
// getCachedAccount now does the real work of picking the right account — this
// is just cleanup so stale accounts don't pile up in local storage over time.
export async function clearMicrosoftPickerCache(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID) return;
  const app = await getMsal();
  for (const acct of app.getAllAccounts()) {
    await app.clearCache({ account: acct });
    sharePointOriginCache.delete(acct.homeAccountId);
  }
}

// Same widget, restricted to folder selection — used by "or choose a folder", which
// previously fell back to a plain custom dropdown while file-picking got the real
// native browser.
export async function openMicrosoftFolderPicker(expectedEmail: string | null): Promise<PickedFile | null> {
  const files = await openPicker("folders", expectedEmail);
  return files?.[0] ?? null;
}

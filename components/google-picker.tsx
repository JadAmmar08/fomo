"use client";

// Google's own Drive file browser widget — actively maintained, and much simpler
// than Microsoft's picker: it takes a plain OAuth access token directly, no separate
// consumer/work-school distinction and no postMessage/MessageChannel handshake.
declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId?: unknown) => GoogleDocsView;
        ViewId: { DOCS: unknown; FOLDERS: unknown };
        Feature: { MULTISELECT_ENABLED: unknown };
        Action: { PICKED: string; CANCEL: string };
      };
    };
  }
}

interface GoogleDocsView {
  setIncludeFolders: (include: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView | unknown) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  enableFeature: (feature: unknown) => GooglePickerBuilder;
  setCallback: (cb: (data: PickerResponse) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface PickerResponse {
  action: string;
  docs?: Array<{ id: string; name: string }>;
}

const API_SCRIPT_URL = "https://apis.google.com/js/api.js";
let apiLoadPromise: Promise<void> | null = null;
let pickerLoadPromise: Promise<void> | null = null;

function loadGapi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.gapi) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = API_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

function loadPicker(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (pickerLoadPromise) return pickerLoadPromise;
  pickerLoadPromise = loadGapi().then(
    () => new Promise((resolve) => window.gapi!.load("picker", () => resolve()))
  );
  return pickerLoadPromise;
}

// Fires as soon as this module is imported (page load), not on click — Google's
// picker doesn't have the same popup-blocker sensitivity Microsoft's did, but
// preloading avoids a visible delay on first click regardless.
if (typeof window !== "undefined") {
  loadPicker().catch((err) => console.error("[google-picker] preload failed:", err));
}

interface PickedFile {
  id: string;
  name: string;
}

async function pickerBase(roomId: string): Promise<{ apiKey: string; accessToken: string; picker: NonNullable<Window["google"]>["picker"] } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("[google-picker] NEXT_PUBLIC_GOOGLE_API_KEY not set");
    return null;
  }

  const tokenRes = await fetch(`/api/integrations/google/picker-token?roomId=${roomId}`, { credentials: "include" });
  if (!tokenRes.ok) return null;
  const { accessToken } = await tokenRes.json();

  await loadPicker();
  return { apiKey, accessToken, picker: window.google!.picker };
}

export async function openGooglePicker(roomId: string): Promise<PickedFile[] | null> {
  const base = await pickerBase(roomId);
  if (!base) return null;
  const { apiKey, accessToken, picker } = base;

  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(false);

    const instance = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: PickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          resolve((data.docs ?? []).map((d) => ({ id: d.id, name: d.name })));
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    instance.setVisible(true);
  });
}

// Same widget, configured to browse and select exactly one folder instead of files —
// used by "or choose a folder", which previously fell back to a plain custom dropdown
// while file-picking got the real native browser.
export async function openGoogleFolderPicker(roomId: string): Promise<PickedFile | null> {
  const base = await pickerBase(roomId);
  if (!base) return null;
  const { apiKey, accessToken, picker } = base;

  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true);

    const instance = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: PickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          const folder = data.docs?.[0];
          resolve(folder ? { id: folder.id, name: folder.name } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    instance.setVisible(true);
  });
}

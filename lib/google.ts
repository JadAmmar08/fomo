import { getPool } from "@/lib/postgres";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// Read-only scopes only — this feature summarizes revision history, it never edits files.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email"
].join(" ");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    // "select_account" forces the account chooser (not just SSO reuse) so
    // reconnecting with a different Google account is actually possible.
    prompt: "select_account consent",
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function fetchGoogleEmail(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email as string | null;
}

export async function saveGoogleConnection(params: {
  anonymousUserId: string;
  roomId: string;
  googleEmail: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const expiresAt = new Date(Date.now() + params.expiresIn * 1000);
  await pool.query(
    `insert into google_connections
       (anonymous_user_id, room_id, google_email, access_token, refresh_token, token_expires_at, scope, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (anonymous_user_id, room_id) do update set
       google_email = excluded.google_email,
       access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, google_connections.refresh_token),
       token_expires_at = excluded.token_expires_at,
       scope = excluded.scope,
       updated_at = now()`,
    [
      params.anonymousUserId,
      params.roomId,
      params.googleEmail,
      params.accessToken,
      params.refreshToken ?? null,
      expiresAt.toISOString(),
      params.scope
    ]
  );
}

// Returns a valid access token for this user/room, refreshing it first if it's expired.
export async function getValidAccessToken(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const res = await pool.query<{ access_token: string; refresh_token: string | null; token_expires_at: string }>(
    `select access_token, refresh_token, token_expires_at from google_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const expiresAt = new Date(row.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return row.access_token as string;
  }
  if (!row.refresh_token) return null;

  const refreshed = await refreshAccessToken(row.refresh_token);
  await pool.query(
    `update google_connections set access_token = $1, token_expires_at = $2, updated_at = now()
     where anonymous_user_id = $3 and room_id = $4`,
    [refreshed.access_token, new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), anonymousUserId, roomId]
  );
  return refreshed.access_token;
}

export async function hasGoogleConnection(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) return false;
  const res = await pool.query(
    `select 1 from google_connections where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  return res.rows.length > 0;
}

export async function getGoogleConnection(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{
    linked_folder_id: string | null;
    linked_folder_name: string | null;
    auto_all_files: boolean;
    include_shared_files: boolean;
    google_email: string | null;
    linked_file_ids: Array<{ id: string; name: string }>;
  }>(
    `select linked_folder_id, linked_folder_name, auto_all_files, include_shared_files, google_email, linked_file_ids from google_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  return res.rows[0] ?? null;
}

export async function linkGoogleFolder(anonymousUserId: string, roomId: string, folderId: string, folderName: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set linked_folder_id = $1, linked_folder_name = $2, auto_all_files = false, linked_file_ids = '[]', updated_at = now()
     where anonymous_user_id = $3 and room_id = $4`,
    [folderId, folderName, anonymousUserId, roomId]
  );
}

// The smallest possible unit of access: exactly the files someone hand-picked, not
// a whole folder or their whole account. Meant for a first, low-stakes pilot where
// someone wants to share 2-3 specific documents rather than an entire folder's
// worth of contents.
export async function linkGoogleFiles(anonymousUserId: string, roomId: string, files: Array<{ id: string; name: string }>) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set linked_file_ids = $1, linked_folder_id = null, linked_folder_name = null, auto_all_files = false, updated_at = now()
     where anonymous_user_id = $2 and room_id = $3`,
    [JSON.stringify(files), anonymousUserId, roomId]
  );
}

// Merges newly picked files into whatever's already linked, instead of clobbering the
// existing selection.
export async function addGoogleFiles(anonymousUserId: string, roomId: string, files: Array<{ id: string; name: string }>) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const existing = await getGoogleConnection(anonymousUserId, roomId);
  const current = existing?.linked_file_ids ?? [];
  const merged = [...current];
  for (const f of files) {
    if (!merged.some((m) => m.id === f.id)) merged.push(f);
  }
  await pool.query(
    `update google_connections set linked_file_ids = $1, linked_folder_id = null, linked_folder_name = null, auto_all_files = false, updated_at = now()
     where anonymous_user_id = $2 and room_id = $3`,
    [JSON.stringify(merged), anonymousUserId, roomId]
  );
  return merged;
}

// Drops exactly one file from the linked set without touching the rest.
export async function removeGoogleFile(anonymousUserId: string, roomId: string, fileId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const existing = await getGoogleConnection(anonymousUserId, roomId);
  const remaining = (existing?.linked_file_ids ?? []).filter((f) => f.id !== fileId);
  await pool.query(
    `update google_connections set linked_file_ids = $1, updated_at = now()
     where anonymous_user_id = $2 and room_id = $3`,
    [JSON.stringify(remaining), anonymousUserId, roomId]
  );
  return remaining;
}

// Lists individual files (not folders) for the specific-file picker — recent files
// across the account, same "recently modified" ordering as everything else, just
// surfaced as pickable items instead of auto-included.
export async function listPickableFiles(accessToken: string, maxFiles = 30) {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: String(maxFiles),
        orderBy: "modifiedTime desc",
        fields: "files(id,name)"
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive file list failed: ${await res.text()}`);
  const { files } = (await res.json()) as { files: Array<{ id: string; name: string }> };
  return files;
}

// Fetches full activity (content + revisions) for an exact, explicit set of file
// IDs — no folder scan, no ownership query, just precisely what was picked.
export async function listSpecificFiles(accessToken: string, fileIds: string[]) {
  return Promise.all(
    fileIds.map(async (fileId) => {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,webViewLink`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const meta = await metaRes.json();
      const revRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(modifiedTime,lastModifyingUser)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const revisions = revRes.ok ? ((await revRes.json()).revisions ?? []) : [];
      const content = await exportFileContent(accessToken, fileId, meta.mimeType);
      return { ...meta, revisions, content };
    })
  );
}

// Registers a push-notification channel so Drive tells us the instant this one file
// changes, instead of us polling it. Requires the webhook address's domain to be
// verified in Google Search Console for this OAuth client — a real Drive prerequisite,
// not something this code can route around. `token` is echoed back on every
// notification so the webhook route can check it before trusting the payload.
export async function watchFile(accessToken: string, fileId: string, channelId: string, webhookUrl: string, token: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl, token })
  });
  if (!res.ok) throw new Error(`Drive watch failed: ${await res.text()}`);
  return res.json() as Promise<{ resourceId: string; expiration: string }>;
}

// Drive has no way to watch a single folder for new children — files.watch only
// covers a file/folder's own metadata, not what gets created inside it. The account-
// wide changes feed is the only way to learn about new files, so a folder watch
// subscribes to that instead and the caller re-lists the folder's children on every
// ping rather than trying to parse which specific change fired.
export async function getChangesStartPageToken(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/drive/v3/changes/startPageToken", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`Drive startPageToken failed: ${await res.text()}`);
  const { startPageToken } = (await res.json()) as { startPageToken: string };
  return startPageToken;
}

export async function watchChanges(accessToken: string, pageToken: string, channelId: string, webhookUrl: string, token: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${encodeURIComponent(pageToken)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: channelId, type: "web_hook", address: webhookUrl, token })
    }
  );
  if (!res.ok) throw new Error(`Drive changes.watch failed: ${await res.text()}`);
  return res.json() as Promise<{ resourceId: string; expiration: string }>;
}

// Cheap re-list of exactly one folder's direct children, used to diff against the
// last-known file id set and find what's genuinely new since the last ping —
// simpler and more robust than tracking Drive's changes.list cursor precisely.
export async function listFolderChildren(accessToken: string, folderId: string) {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        pageSize: "200",
        fields: "files(id,name)"
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive folder children list failed: ${await res.text()}`);
  const { files } = (await res.json()) as { files: Array<{ id: string; name: string }> };
  return files;
}

// Drive channels can't be extended in place, only stopped and recreated — this just
// stops one so a stale/duplicate channel doesn't keep firing after we've replaced it.
export async function stopWatchChannel(accessToken: string, channelId: string, resourceId: string) {
  await fetch("https://www.googleapis.com/drive/v3/channels/stop", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, resourceId })
  }).catch(() => {});
}

// Clears whatever's currently linked (folder, everything-I-own, or specific files)
// without removing the underlying connection — lets someone pick something
// different without going through OAuth again.
export async function unlinkGoogle(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set linked_folder_id = null, linked_folder_name = null, auto_all_files = false, include_shared_files = false, linked_file_ids = '[]', updated_at = now()
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  const { stopFileWatches, stopFolderWatches } = await import("@/lib/file-watch");
  await Promise.all([
    stopFileWatches("google", anonymousUserId, roomId),
    stopFolderWatches("google", anonymousUserId, roomId)
  ]);
}

// Removes the connection entirely — the next visit shows "Connect" from scratch.
export async function disconnectGoogle(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const { stopFileWatches, stopFolderWatches } = await import("@/lib/file-watch");
  await Promise.all([
    stopFileWatches("google", anonymousUserId, roomId),
    stopFolderWatches("google", anonymousUserId, roomId)
  ]);
  await pool.query(`delete from google_connections where anonymous_user_id = $1 and room_id = $2`, [anonymousUserId, roomId]);
}

// One person's own explicit decision about their own account: read every file they
// actually own, not just one folder. Deliberately excludes anything merely shared
// with them by someone else ('me' in owners, not just visible to them) — a file a
// client or outside party shared into their Drive is that party's data, not theirs
// to consent to sharing with FOMO.
export async function enableAutoAllFiles(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set auto_all_files = true, linked_folder_id = null, linked_folder_name = null, updated_at = now()
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
}

// A separate, explicit decision on top of "everything I own": also include files
// shared with them by someone else, but only ones they've genuinely edited
// themselves (enforced in listRecentFilesWithRevisions's filter), never a file
// sitting untouched in their "Shared with me" view.
export async function enableIncludeSharedFiles(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set include_shared_files = true, updated_at = now()
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
}

// Lists the user's Drive folders (not files) — the picker only shows folders so a
// specific team's shared workspace can be scoped to, instead of reading their whole
// personal Drive.
export async function listFolders(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        pageSize: "100",
        orderBy: "name",
        fields: "files(id,name)"
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive folder list failed: ${await res.text()}`);
  const { files } = (await res.json()) as { files: Array<{ id: string; name: string }> };
  return files;
}

// Lists files a user has recently modified, with their revision history — the raw
// material for a workstream handoff summary (who touched what, in what order).
// Scoped to a single linked folder, or to every file the user actually owns when
// ownedOnly is set. When includeShared is also set, files shared with them by
// someone else are included too, but ONLY if this person has actually edited it
// themselves (checked against real revision history below) — a shared file they
// never touched belongs to whoever shared it, not to their consent to give, but one
// they've genuinely worked in is legitimately part of their own activity.
export async function listRecentFilesWithRevisions(
  accessToken: string,
  maxFiles = 10,
  folderId?: string | null,
  ownedOnly = false,
  options?: { includeShared?: boolean; userEmail?: string | null }
) {
  const includeOwnedField = ownedOnly && options?.includeShared;
  const params: Record<string, string> = {
    pageSize: String(maxFiles),
    orderBy: "modifiedTime desc",
    fields: `files(id,name,mimeType,modifiedTime,webViewLink${includeOwnedField ? ",ownedByMe" : ""})`
  };
  if (folderId) {
    params.q = `'${folderId}' in parents and trashed = false`;
  } else if (ownedOnly && !options?.includeShared) {
    params.q = "'me' in owners and trashed = false";
  } else if (includeOwnedField) {
    params.q = "trashed = false";
  }

  const filesRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams(params),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!filesRes.ok) throw new Error(`Drive files list failed: ${await filesRes.text()}`);
  const { files } = (await filesRes.json()) as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string; ownedByMe?: boolean }> };

  const withRevisions = await Promise.all(
    files.map(async (file) => {
      const revRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/revisions?fields=revisions(modifiedTime,lastModifyingUser)`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const revisions = revRes.ok
        ? ((await revRes.json()).revisions ?? [])
        : [];
      const content = await exportFileContent(accessToken, file.id, file.mimeType);
      return { ...file, revisions, content };
    })
  );

  if (!includeOwnedField || !options?.userEmail) return withRevisions;

  // Keep anything they own outright, regardless of revision data (which isn't
  // always populated reliably). A shared file only counts if they show up as an
  // actual editor in its revision history, not just a passive recipient of it.
  return withRevisions.filter((file) => {
    if (file.ownedByMe) return true;
    const revisions = file.revisions as Array<{ lastModifyingUser?: { emailAddress?: string } }>;
    return revisions.some((r) => r.lastModifyingUser?.emailAddress === options.userEmail);
  });
}

const EXPORT_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  // Sheets export only covers the first sheet/tab — a real limitation, not a bug,
  // but enough to describe what a spreadsheet is actually tracking.
  "application/vnd.google-apps.spreadsheet": "text/csv"
};

const MAX_CONTENT_CHARS = 3000;

// Pulls the actual text content of a native Google Doc/Sheet/Slide — not just its
// activity metadata — so a summary can describe what the file is actually about,
// not only who touched it and when. Skips anything not natively exportable (PDFs,
// images, videos, uploaded Office files) rather than guessing at their content.
async function exportFileContent(accessToken: string, fileId: string, mimeType: string): Promise<string | null> {
  const exportMime = EXPORT_MIME_TYPES[mimeType];
  if (!exportMime) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, MAX_CONTENT_CHARS);
  } catch {
    return null;
  }
}

export interface StructuredCell {
  location: string;
  value: string;
  rowLabel?: string;
  colLabel?: string;
}

// Real cell coordinates for a Google Sheet, unlike exportFileContent's CSV export
// above which flattens everything to text with no (row, col) identity — needed so a
// contradiction can cite an exact cell instead of "somewhere in this file." Uses the
// Sheets API's values.get directly rather than Drive's export endpoint, since CSV
// export has no way to carry coordinates. `drive.readonly` (already consented by
// every connected account) covers Sheets API reads for files the token can already
// access — no separate `spreadsheets.readonly` scope needed as long as that holds
// in practice; if a 403 ever shows up here specifically, that scope is the fix.
export async function getSheetValuesWithCoordinates(accessToken: string, fileId: string): Promise<StructuredCell[] | null> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1:Z200`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { values?: string[][] };
    const rows = data.values;
    if (!rows || rows.length === 0) return null;

    const columnHeaders = new Map<number, string>();
    (rows[0] ?? []).forEach((text, i) => {
      if (text?.trim()) columnHeaders.set(i, text.trim());
    });

    const cells: StructuredCell[] = [];
    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // header row itself isn't a fact
      let rowLabel: string | undefined;
      for (const cell of row) {
        if (cell?.trim()) { rowLabel = cell.trim(); break; }
      }

      row.forEach((rawValue, colIndex) => {
        const value = rawValue?.trim();
        if (!value) return;
        if (rowLabel && value === rowLabel && colIndex === 0) return;

        cells.push({
          location: `${columnLetter(colIndex)}${rowIndex + 1}`,
          value,
          rowLabel,
          colLabel: columnHeaders.get(colIndex)
        });
      });
    });

    return cells.length > 0 ? cells.slice(0, 200) : null;
  } catch (err) {
    console.error(`[getSheetValuesWithCoordinates] failed for ${fileId}:`, err);
    return null;
  }
}

function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

interface FileActivity {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  revisions: Array<{ modifiedTime: string; lastModifyingUser?: { displayName?: string; emailAddress?: string } }>;
  content?: string | null;
}

// Turns raw Drive file/revision data into a short, readable workstream summary —
// the first slice of the handoff feature: "here's what changed and who touched it,
// and what it's actually about," not a behavior model of any individual.
export async function summarizeWorkstream(files: FileActivity[], previousSummary?: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || files.length === 0) return null;

  const activityLines = files.map((f) => {
    const editors = [...new Set(f.revisions.map((r) => r.lastModifyingUser?.displayName).filter(Boolean))];
    const header = `- "${f.name}" (${f.mimeType.split(".").pop()}), last modified ${f.modifiedTime}, edited by: ${editors.join(", ") || "unknown"}, ${f.revisions.length} revisions`;
    return f.content ? `${header}\n  Content excerpt:\n  ${f.content.replace(/\n/g, "\n  ")}` : header;
  });

  const historyBlock = previousSummary
    ? `\n\nHere is the summary from the last time this was checked, for context:\n"${previousSummary}"\n\nIf the current activity looks materially the same as last time, say so briefly and note what's new instead of repeating the same description. If it looks meaningfully different, lead with what changed.`
    : "";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Here is a list of recently modified Google Drive files, their edit history, and — where available — an excerpt of their actual content:\n\n${activityLines.join("\n\n")}${historyBlock}\n\nWrite a short (3-5 sentence) plain-English summary of this workstream: what it's actually about (using the content excerpts, not just filenames), who's been involved, and anything that looks unresolved or actively in flux. Never describe this as tracking or monitoring a person — describe the work itself. No preamble, just the summary.`
        }
      ]
    });

    const block = message.content[0];
    return block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("[summarizeWorkstream] failed:", err);
    return null;
  }
}

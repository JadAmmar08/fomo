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
    prompt: "consent",
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
  const res = await pool.query<{ linked_folder_id: string | null; linked_folder_name: string | null }>(
    `select linked_folder_id, linked_folder_name from google_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  return res.rows[0] ?? null;
}

export async function linkGoogleFolder(anonymousUserId: string, roomId: string, folderId: string, folderName: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update google_connections set linked_folder_id = $1, linked_folder_name = $2, updated_at = now()
     where anonymous_user_id = $3 and room_id = $4`,
    [folderId, folderName, anonymousUserId, roomId]
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
// Scoped to a single linked folder when provided, instead of the whole personal Drive.
export async function listRecentFilesWithRevisions(accessToken: string, maxFiles = 10, folderId?: string | null) {
  const params: Record<string, string> = {
    pageSize: String(maxFiles),
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)"
  };
  if (folderId) params.q = `'${folderId}' in parents and trashed = false`;

  const filesRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?" + new URLSearchParams(params),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!filesRes.ok) throw new Error(`Drive files list failed: ${await filesRes.text()}`);
  const { files } = (await filesRes.json()) as { files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string }> };

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

  return withRevisions;
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

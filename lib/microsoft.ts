import { getPool } from "@/lib/postgres";

const MS_AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Read-only scopes only — same promise as Drive/Slack: this feature reads file
// activity, it never writes, moves, or deletes anything in OneDrive.
export const MS_SCOPES = ["Files.Read", "User.Read", "offline_access"].join(" ");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildMicrosoftAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("MICROSOFT_CLIENT_ID"),
    response_type: "code",
    redirect_uri: requireEnv("MICROSOFT_REDIRECT_URI"),
    scope: MS_SCOPES,
    response_mode: "query",
    state
  });
  return `${MS_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("MICROSOFT_CLIENT_ID"),
      client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
      redirect_uri: requireEnv("MICROSOFT_REDIRECT_URI"),
      grant_type: "authorization_code",
      scope: MS_SCOPES
    })
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("MICROSOFT_CLIENT_ID"),
      client_secret: requireEnv("MICROSOFT_CLIENT_SECRET"),
      grant_type: "refresh_token",
      scope: MS_SCOPES
    })
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

export async function fetchMicrosoftEmail(accessToken: string) {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.mail ?? data.userPrincipalName ?? null) as string | null;
}

export async function saveMicrosoftConnection(params: {
  anonymousUserId: string;
  roomId: string;
  microsoftEmail: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const expiresAt = new Date(Date.now() + params.expiresIn * 1000);
  await pool.query(
    `insert into microsoft_connections
       (anonymous_user_id, room_id, microsoft_email, access_token, refresh_token, token_expires_at, scope, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (anonymous_user_id, room_id) do update set
       microsoft_email = excluded.microsoft_email,
       access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, microsoft_connections.refresh_token),
       token_expires_at = excluded.token_expires_at,
       scope = excluded.scope,
       updated_at = now()`,
    [
      params.anonymousUserId,
      params.roomId,
      params.microsoftEmail,
      params.accessToken,
      params.refreshToken ?? null,
      expiresAt.toISOString(),
      params.scope
    ]
  );
}

export async function getValidAccessToken(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const res = await pool.query<{ access_token: string; refresh_token: string | null; token_expires_at: string }>(
    `select access_token, refresh_token, token_expires_at from microsoft_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const expiresAt = new Date(row.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return row.access_token;
  }
  if (!row.refresh_token) return null;

  const refreshed = await refreshAccessToken(row.refresh_token);
  await pool.query(
    `update microsoft_connections set access_token = $1, refresh_token = coalesce($2, refresh_token), token_expires_at = $3, updated_at = now()
     where anonymous_user_id = $4 and room_id = $5`,
    [refreshed.access_token, refreshed.refresh_token ?? null, new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), anonymousUserId, roomId]
  );
  return refreshed.access_token;
}

export async function getMicrosoftConnection(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ linked_folder_id: string | null; linked_folder_name: string | null }>(
    `select linked_folder_id, linked_folder_name from microsoft_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  return res.rows[0] ?? null;
}

export async function linkMicrosoftFolder(anonymousUserId: string, roomId: string, folderId: string, folderName: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update microsoft_connections set linked_folder_id = $1, linked_folder_name = $2, updated_at = now()
     where anonymous_user_id = $3 and room_id = $4`,
    [folderId, folderName, anonymousUserId, roomId]
  );
}

// Lists OneDrive folders (not files) at the root — the picker only shows folders so
// a specific team's shared workspace can be scoped to, instead of reading the whole
// personal OneDrive.
export async function listFolders(accessToken: string) {
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/root/children?$filter=folder ne null&$select=id,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`OneDrive folder list failed: ${await res.text()}`);
  const data = await res.json();
  return data.value as Array<{ id: string; name: string }>;
}

interface OneDriveFile {
  id: string;
  name: string;
  file?: { mimeType: string };
  lastModifiedDateTime: string;
  webUrl: string;
  lastModifiedBy?: { user?: { displayName?: string } };
}

// Lists files recently modified in a linked OneDrive folder. Graph doesn't expose
// per-revision history as simply as Drive does, so this uses lastModifiedBy/time —
// enough to say who touched what and when, same as Drive's activity-only baseline.
export async function listRecentFiles(accessToken: string, folderId: string, maxFiles = 10) {
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/items/${folderId}/children?$orderby=lastModifiedDateTime desc&$top=${maxFiles}&$select=id,name,file,lastModifiedDateTime,webUrl,lastModifiedBy`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`OneDrive files list failed: ${await res.text()}`);
  const data = await res.json();
  return (data.value as OneDriveFile[]).filter((f) => f.file);
}

// Turns raw OneDrive file activity into a short, readable workstream summary.
// Content-level extraction (reading what's actually inside a .docx/.xlsx) isn't
// wired up yet — Graph has no simple "export as text" like Drive does, so that
// needs real Office file parsing as a follow-up, not just an OAuth scope.
export async function summarizeWorkstream(files: OneDriveFile[], previousSummary?: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || files.length === 0) return null;

  const activityLines = files.map(
    (f) =>
      `- "${f.name}", last modified ${f.lastModifiedDateTime} by ${f.lastModifiedBy?.user?.displayName ?? "unknown"}`
  );

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
          content: `Here is a list of recently modified OneDrive files:\n\n${activityLines.join("\n")}${historyBlock}\n\nWrite a short (3-5 sentence) plain-English summary of this workstream: what's been worked on (based on filenames, since content isn't available yet), who's been involved, and anything that looks unresolved or actively in flux. Never describe this as tracking or monitoring a person — describe the activity on the files themselves. No preamble, just the summary.`
        }
      ]
    });

    const block = message.content[0];
    return block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("[summarizeWorkstream/microsoft] failed:", err);
    return null;
  }
}

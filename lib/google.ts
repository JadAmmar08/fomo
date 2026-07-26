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

// Lists files a user has recently modified, with their revision history — the raw
// material for a workstream handoff summary (who touched what, in what order).
export async function listRecentFilesWithRevisions(accessToken: string, maxFiles = 10) {
  const filesRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        pageSize: String(maxFiles),
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)"
      }),
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
      return { ...file, revisions };
    })
  );

  return withRevisions;
}

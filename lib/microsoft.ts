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
  const res = await pool.query<{
    linked_folder_id: string | null;
    linked_folder_name: string | null;
    auto_all_files: boolean;
    include_shared_files: boolean;
  }>(
    `select linked_folder_id, linked_folder_name, auto_all_files, include_shared_files from microsoft_connections
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  return res.rows[0] ?? null;
}

export async function linkMicrosoftFolder(anonymousUserId: string, roomId: string, folderId: string, folderName: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update microsoft_connections set linked_folder_id = $1, linked_folder_name = $2, auto_all_files = false, updated_at = now()
     where anonymous_user_id = $3 and room_id = $4`,
    [folderId, folderName, anonymousUserId, roomId]
  );
}

// One person's own explicit decision about their own account: read every file they
// actually own, not just one folder.
export async function enableAutoAllFiles(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update microsoft_connections set auto_all_files = true, linked_folder_id = null, linked_folder_name = null, updated_at = now()
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
}

// A separate, explicit decision on top of "everything I own": also include files
// shared with them that Graph's /recent shows real activity on.
export async function enableIncludeSharedFiles(anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update microsoft_connections set include_shared_files = true, updated_at = now()
     where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
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
  versions?: Array<{ lastModifiedDateTime: string; lastModifiedBy?: { user?: { displayName?: string } } }>;
  content?: string | null;
}

interface FileVersion {
  lastModifiedDateTime: string;
  lastModifiedBy?: { user?: { displayName?: string } };
}

// Graph's version history — the equivalent of Drive's revisions endpoint. Not every
// file type keeps versions (some plain uploads don't), so a missing history is
// treated as "no version data" rather than an error.
async function listFileVersions(accessToken: string, fileId: string): Promise<FileVersion[]> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me/drive/items/${fileId}/versions`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.value as FileVersion[]) ?? [];
  } catch {
    return [];
  }
}

const OFFICE_EXTRACTORS: Record<string, "xlsx" | "docx" | "pptx"> = {
  xlsx: "xlsx",
  xls: "xlsx",
  docx: "docx",
  pptx: "pptx"
};

const MAX_CONTENT_CHARS = 3000;

// A .pptx is just a zip of XML — each slide's text runs live in ppt/slides/slideN.xml
// as <a:t> elements. No mainstream "mammoth for PowerPoint" library exists, so this
// unzips and extracts text directly rather than pull in a heavier, less-trusted
// pptx-parsing package for what's fundamentally simple XML text extraction.
async function extractPptxText(buffer: Buffer): Promise<string | null> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) return null;

  const slideTexts = await Promise.all(
    slideFiles.map(async (name, i) => {
      const xml = await zip.files[name].async("text");
      const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
      return texts.length > 0 ? `Slide ${i + 1}: ${texts.join(" ")}` : null;
    })
  );

  return slideTexts.filter(Boolean).join("\n").slice(0, MAX_CONTENT_CHARS) || null;
}

// Downloads a file's raw bytes and extracts its actual text content — Excel via
// exceljs, Word via mammoth, PowerPoint via direct XML parsing. Graph has no simple
// "export as text" like Drive does, so this is real binary parsing, not a single
// API call. Anything else (PDFs, images) is skipped rather than guessed at.
async function extractFileContent(accessToken: string, fileId: string, fileName: string): Promise<string | null> {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const kind = ext ? OFFICE_EXTRACTORS[ext] : undefined;
  if (!kind) return null;

  try {
    const res = await fetch(`${GRAPH_BASE}/me/drive/items/${fileId}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    if (kind === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return null;
      const rows: string[] = [];
      sheet.eachRow((row) => {
        rows.push(row.values ? (row.values as unknown[]).filter(Boolean).join(", ") : "");
      });
      return rows.join("\n").slice(0, MAX_CONTENT_CHARS);
    }

    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, MAX_CONTENT_CHARS);
    }

    if (kind === "pptx") {
      return extractPptxText(buffer);
    }

    return null;
  } catch (err) {
    console.error(`[extractFileContent] failed for ${fileName}:`, err);
    return null;
  }
}

async function enrichFiles(accessToken: string, files: OneDriveFile[]) {
  return Promise.all(
    files.map(async (f) => {
      const [versions, content] = await Promise.all([
        listFileVersions(accessToken, f.id),
        extractFileContent(accessToken, f.id, f.name)
      ]);
      return { ...f, versions, content };
    })
  );
}

// Lists files recently modified in a linked OneDrive folder, along with per-version
// edit history and — where the format supports it — real extracted content.
export async function listRecentFiles(accessToken: string, folderId: string, maxFiles = 10) {
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/items/${folderId}/children?$orderby=lastModifiedDateTime desc&$top=${maxFiles}&$select=id,name,file,lastModifiedDateTime,webUrl,lastModifiedBy`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`OneDrive files list failed: ${await res.text()}`);
  const data = await res.json();
  const files = (data.value as OneDriveFile[]).filter((f) => f.file);
  return enrichFiles(accessToken, files);
}

// Lists recently touched files across the user's entire OneDrive, not one folder.
// Graph's /recent endpoint also includes items shared with the user by others, so by
// default anything carrying a remoteItem (meaning it lives in someone else's drive,
// just shared into this view) is filtered out. When includeShared is set, those are
// kept too — but since /recent only ever returns items this person has actually
// opened or edited, a shared item showing up here already proves real activity by
// them, not passive access to something they never touched.
export async function listRecentFilesAcrossDrive(accessToken: string, maxFiles = 20, includeShared = false) {
  const res = await fetch(
    `${GRAPH_BASE}/me/drive/recent?$top=${maxFiles}&$select=id,name,file,lastModifiedDateTime,webUrl,lastModifiedBy,remoteItem`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`OneDrive recent files list failed: ${await res.text()}`);
  const data = await res.json();
  const files = (data.value as Array<OneDriveFile & { remoteItem?: unknown }>).filter((f) => f.file && (includeShared || !f.remoteItem));
  return enrichFiles(accessToken, files);
}

// Turns raw OneDrive file activity, version history, and (where available) actual
// content into a short, readable workstream summary — never a per-person behavior
// record, always framed as activity on the files themselves.
export async function summarizeWorkstream(files: OneDriveFile[], previousSummary?: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || files.length === 0) return null;

  const activityLines = files.map((f) => {
    const editors = [...new Set((f.versions ?? []).map((v) => v.lastModifiedBy?.user?.displayName).filter(Boolean))];
    const editorList = editors.length > 0 ? editors.join(", ") : f.lastModifiedBy?.user?.displayName ?? "unknown";
    const header = `- "${f.name}", last modified ${f.lastModifiedDateTime}, edited by: ${editorList}, ${f.versions?.length ?? 0} versions`;
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
          content: `Here is a list of recently modified OneDrive files, their edit history, and — where available — an excerpt of their actual content:\n\n${activityLines.join("\n\n")}${historyBlock}\n\nWrite a short (3-5 sentence) plain-English summary of this workstream: what it's actually about (using the content excerpts, not just filenames, when available), who's been involved, and anything that looks unresolved or actively in flux. Never describe this as tracking or monitoring a person — describe the work itself. No preamble, just the summary.`
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

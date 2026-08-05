import crypto from "crypto";
import { getPool } from "@/lib/postgres";
import * as google from "@/lib/google";
import * as microsoft from "@/lib/microsoft";
import { sendPushToUser } from "@/lib/push";

type Provider = "google" | "microsoft";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function webhookUrl(provider: Provider) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/webhooks/${provider === "google" ? "google-drive" : "microsoft"}`;
}

// Called right after someone links a specific file, one call per file. Best-effort:
// a failure here (e.g. Drive's webhook domain isn't verified yet) should never break
// linking the file itself, so every call site wraps this in its own catch.
export async function registerFileWatch(provider: Provider, anonymousUserId: string, roomId: string, fileId: string, fileName: string) {
  const pool = getPool();
  if (!pool) return;

  const secret = requireEnv("FILE_WATCH_WEBHOOK_SECRET");
  const channelId = crypto.randomUUID();

  if (provider === "google") {
    const token = await google.getValidAccessToken(anonymousUserId, roomId);
    if (!token) return;
    const { resourceId, expiration } = await google.watchFile(token, fileId, channelId, webhookUrl("google"), secret);
    await pool.query(
      `insert into file_watch_channels (provider, anonymous_user_id, room_id, file_id, file_name, channel_id, resource_id, expires_at)
       values ('google', $1, $2, $3, $4, $5, $6, $7)
       on conflict (provider, file_id, anonymous_user_id, room_id) do update
         set channel_id = excluded.channel_id, resource_id = excluded.resource_id, expires_at = excluded.expires_at, updated_at = now()`,
      [anonymousUserId, roomId, fileId, fileName, channelId, resourceId, new Date(Number(expiration)).toISOString()]
    );
  } else {
    const token = await microsoft.getValidAccessToken(anonymousUserId, roomId);
    if (!token) return;
    // Graph rejects a subscription on the file resource directly ("resource ... is not
    // supported") — subscribe to the file's parent folder's children instead, and rely on
    // the content-hash dedup in handleFileChangeNotification to only act on this specific
    // file's real edits, same as any other folder-scoped ping.
    const parentFolderId = await microsoft.getParentFolderId(token, fileId);
    if (!parentFolderId) return;
    const { id, expirationDateTime } = await microsoft.createFolderSubscription(token, parentFolderId, webhookUrl("microsoft"), secret);
    await pool.query(
      `insert into file_watch_channels (provider, anonymous_user_id, room_id, file_id, file_name, channel_id, expires_at)
       values ('microsoft', $1, $2, $3, $4, $5, $6)
       on conflict (provider, file_id, anonymous_user_id, room_id) do update
         set channel_id = excluded.channel_id, expires_at = excluded.expires_at, updated_at = now()`,
      [anonymousUserId, roomId, fileId, fileName, id, expirationDateTime]
    );
  }
}

// Called when someone unlinks files or disconnects a provider entirely — without this,
// a watch keeps renewing and firing forever even after the user thinks it's off.
// Best-effort per row: one bad provider call shouldn't stop the rest from being cleaned up.
export async function stopFileWatches(provider: Provider, anonymousUserId: string, roomId: string, fileIds?: string[]) {
  const pool = getPool();
  if (!pool) return;

  const res = await pool.query<{ id: string; file_id: string; channel_id: string; resource_id: string | null }>(
    fileIds
      ? `select id, file_id, channel_id, resource_id from file_watch_channels
         where provider = $1 and anonymous_user_id = $2 and room_id = $3 and file_id = any($4)`
      : `select id, file_id, channel_id, resource_id from file_watch_channels
         where provider = $1 and anonymous_user_id = $2 and room_id = $3`,
    fileIds ? [provider, anonymousUserId, roomId, fileIds] : [provider, anonymousUserId, roomId]
  );
  if (res.rows.length === 0) return;

  const token = provider === "google"
    ? await google.getValidAccessToken(anonymousUserId, roomId).catch(() => null)
    : await microsoft.getValidAccessToken(anonymousUserId, roomId).catch(() => null);

  for (const row of res.rows) {
    try {
      if (token) {
        if (provider === "google" && row.resource_id) {
          await google.stopWatchChannel(token, row.channel_id, row.resource_id);
        } else if (provider === "microsoft") {
          await microsoft.deleteSubscription(token, row.channel_id);
        }
      }
    } catch (err) {
      console.error(`[file-watch stop] failed for ${provider}/${row.file_id}:`, err);
    }
  }

  await pool.query(`delete from file_watch_channels where id = any($1)`, [res.rows.map((r) => r.id)]);
}

// Runs from the existing 15-min cron. Google channels can't be extended in place —
// stop the old one and open a fresh one with a new channel id. Graph subscriptions
// can be extended with a PATCH, so those just get their expiry pushed out.
export async function renewExpiringWatches() {
  const pool = getPool();
  if (!pool) return;
  const secret = requireEnv("FILE_WATCH_WEBHOOK_SECRET");

  const res = await pool.query<{
    id: string; provider: Provider; anonymous_user_id: string; room_id: string;
    file_id: string; channel_id: string; resource_id: string | null;
  }>(`select id, provider, anonymous_user_id, room_id, file_id, channel_id, resource_id
      from file_watch_channels where expires_at < now() + interval '15 minutes'`);

  for (const row of res.rows) {
    try {
      if (row.provider === "google") {
        const token = await google.getValidAccessToken(row.anonymous_user_id, row.room_id);
        if (!token) continue;
        if (row.resource_id) await google.stopWatchChannel(token, row.channel_id, row.resource_id);
        const newChannelId = crypto.randomUUID();
        const { resourceId, expiration } = await google.watchFile(token, row.file_id, newChannelId, webhookUrl("google"), secret);
        await pool.query(
          `update file_watch_channels set channel_id = $1, resource_id = $2, expires_at = $3, updated_at = now() where id = $4`,
          [newChannelId, resourceId, new Date(Number(expiration)).toISOString(), row.id]
        );
      } else {
        const token = await microsoft.getValidAccessToken(row.anonymous_user_id, row.room_id);
        if (!token) continue;
        const { expirationDateTime } = await microsoft.renewSubscription(token, row.channel_id);
        await pool.query(`update file_watch_channels set expires_at = $1, updated_at = now() where id = $2`, [expirationDateTime, row.id]);
      }
    } catch (err) {
      console.error(`[file-watch renew] failed for ${row.provider}/${row.file_id}:`, err);
    }
  }

  await renewExpiringFolderWatches();
}

// Same renewal pattern as renewExpiringWatches, for folder-level channels.
async function renewExpiringFolderWatches() {
  const pool = getPool();
  if (!pool) return;
  const secret = requireEnv("FILE_WATCH_WEBHOOK_SECRET");

  const res = await pool.query<{
    id: string; provider: Provider; anonymous_user_id: string; room_id: string;
    folder_id: string; channel_id: string; resource_id: string | null;
  }>(`select id, provider, anonymous_user_id, room_id, folder_id, channel_id, resource_id
      from folder_watch_channels where expires_at < now() + interval '15 minutes'`);

  for (const row of res.rows) {
    try {
      if (row.provider === "google") {
        const token = await google.getValidAccessToken(row.anonymous_user_id, row.room_id);
        if (!token) continue;
        if (row.resource_id) await google.stopWatchChannel(token, row.channel_id, row.resource_id);
        const newChannelId = crypto.randomUUID();
        const pageToken = await google.getChangesStartPageToken(token);
        const { resourceId, expiration } = await google.watchChanges(token, pageToken, newChannelId, webhookUrl("google"), secret);
        await pool.query(
          `update folder_watch_channels set channel_id = $1, resource_id = $2, expires_at = $3, updated_at = now() where id = $4`,
          [newChannelId, resourceId, new Date(Number(expiration)).toISOString(), row.id]
        );
      } else {
        const token = await microsoft.getValidAccessToken(row.anonymous_user_id, row.room_id);
        if (!token) continue;
        const { expirationDateTime } = await microsoft.renewSubscription(token, row.channel_id);
        await pool.query(`update folder_watch_channels set expires_at = $1, updated_at = now() where id = $2`, [expirationDateTime, row.id]);
      }
    } catch (err) {
      console.error(`[folder-watch renew] failed for ${row.provider}/${row.folder_id}:`, err);
    }
  }
}

// Called right after someone links a folder. Best-effort, same reasoning as
// registerFileWatch: a failed subscription should never block linking the folder.
// Seeds known_file_ids with what's already in the folder so existing files don't
// all fire as "new" the first time a ping arrives.
export async function registerFolderWatch(provider: Provider, anonymousUserId: string, roomId: string, folderId: string, folderName: string) {
  const pool = getPool();
  if (!pool) return;

  const secret = requireEnv("FILE_WATCH_WEBHOOK_SECRET");
  const channelId = crypto.randomUUID();

  if (provider === "google") {
    const token = await google.getValidAccessToken(anonymousUserId, roomId);
    if (!token) return;
    const [existing, pageToken] = await Promise.all([
      google.listFolderChildren(token, folderId),
      google.getChangesStartPageToken(token)
    ]);
    const { resourceId, expiration } = await google.watchChanges(token, pageToken, channelId, webhookUrl("google"), secret);
    await pool.query(
      `insert into folder_watch_channels (provider, anonymous_user_id, room_id, folder_id, folder_name, channel_id, resource_id, known_file_ids, expires_at)
       values ('google', $1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (provider, folder_id, anonymous_user_id, room_id) do update
         set channel_id = excluded.channel_id, resource_id = excluded.resource_id, expires_at = excluded.expires_at, updated_at = now()`,
      [anonymousUserId, roomId, folderId, folderName, channelId, resourceId, JSON.stringify(existing.map((f) => f.id)), new Date(Number(expiration)).toISOString()]
    );
  } else {
    const token = await microsoft.getValidAccessToken(anonymousUserId, roomId);
    if (!token) return;
    const [existing, sub] = await Promise.all([
      microsoft.listFolderChildren(token, folderId),
      microsoft.createFolderSubscription(token, folderId, webhookUrl("microsoft"), secret)
    ]);
    await pool.query(
      `insert into folder_watch_channels (provider, anonymous_user_id, room_id, folder_id, folder_name, channel_id, known_file_ids, expires_at)
       values ('microsoft', $1, $2, $3, $4, $5, $6, $7)
       on conflict (provider, folder_id, anonymous_user_id, room_id) do update
         set channel_id = excluded.channel_id, expires_at = excluded.expires_at, updated_at = now()`,
      [anonymousUserId, roomId, folderId, folderName, sub.id, JSON.stringify(existing.map((f) => f.id)), sub.expirationDateTime]
    );
  }
}

// Mirrors stopFileWatches for folder-level channels — called on unlink/disconnect so
// a cleared folder link doesn't keep silently watching for new files.
export async function stopFolderWatches(provider: Provider, anonymousUserId: string, roomId: string) {
  const pool = getPool();
  if (!pool) return;

  const res = await pool.query<{ id: string; folder_id: string; channel_id: string; resource_id: string | null }>(
    `select id, folder_id, channel_id, resource_id from folder_watch_channels
     where provider = $1 and anonymous_user_id = $2 and room_id = $3`,
    [provider, anonymousUserId, roomId]
  );
  if (res.rows.length === 0) return;

  const token = provider === "google"
    ? await google.getValidAccessToken(anonymousUserId, roomId).catch(() => null)
    : await microsoft.getValidAccessToken(anonymousUserId, roomId).catch(() => null);

  for (const row of res.rows) {
    try {
      if (token) {
        if (provider === "google" && row.resource_id) {
          await google.stopWatchChannel(token, row.channel_id, row.resource_id);
        } else if (provider === "microsoft") {
          await microsoft.deleteSubscription(token, row.channel_id);
        }
      }
    } catch (err) {
      console.error(`[folder-watch stop] failed for ${provider}/${row.folder_id}:`, err);
    }
  }

  await pool.query(`delete from folder_watch_channels where id = any($1)`, [res.rows.map((r) => r.id)]);
}

// Entry point for both webhook routes when the channel isn't a single-file watch —
// re-lists the folder's current children, diffs against known_file_ids to find what's
// genuinely new since the last ping, and runs the lightweight creation-time overlap
// check on each new file. Best-effort per file so one bad lookup doesn't drop the rest.
export async function handleFolderChangeNotification(provider: Provider, channelId: string) {
  const pool = getPool();
  if (!pool) return;

  const res = await pool.query<{ anonymous_user_id: string; room_id: string; folder_id: string; known_file_ids: string[] }>(
    `select anonymous_user_id, room_id, folder_id, known_file_ids from folder_watch_channels where provider = $1 and channel_id = $2`,
    [provider, channelId]
  );
  const row = res.rows[0];
  if (!row) return;

  const token = provider === "google"
    ? await google.getValidAccessToken(row.anonymous_user_id, row.room_id)
    : await microsoft.getValidAccessToken(row.anonymous_user_id, row.room_id);
  if (!token) return;

  const children = provider === "google"
    ? await google.listFolderChildren(token, row.folder_id)
    : await microsoft.listFolderChildren(token, row.folder_id);

  const knownIds = new Set(row.known_file_ids);
  const newFiles = children.filter((f) => !knownIds.has(f.id));

  await pool.query(
    `update folder_watch_channels set known_file_ids = $1, updated_at = now() where provider = $2 and channel_id = $3`,
    [JSON.stringify(children.map((f) => f.id)), provider, channelId]
  );

  for (const file of newFiles) {
    await checkNewFileForOverlap(row.anonymous_user_id, row.room_id, file.name, file.id).catch((err) =>
      console.error(`[folder-watch overlap check] failed for ${file.name}:`, err)
    );
  }
}

// The creation-time counterpart to checkFileForConflict: runs the instant a new file
// shows up in a watched folder, before there's necessarily any real content to diff.
// Matches on title alone against teammates' digests, deliberately looser and cheaper
// than the full content comparison, to catch "someone's already working on this" as
// early as possible rather than after real duplicate effort has been sunk.
export async function checkNewFileForOverlap(anonymousUserId: string, roomSlug: string, fileName: string, fileId: string) {
  const pool = getPool();
  if (!pool) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const roomRes = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [roomSlug]);
  const roomUuid = roomRes.rows[0]?.id;
  if (!roomUuid) return;

  const membersRes = await pool.query<{ anonymous_user_id: string }>(
    `select anonymous_user_id from room_members where room_id = $1`,
    [roomUuid]
  );
  const otherMemberIds = membersRes.rows.map((r) => r.anonymous_user_id).filter((id) => id !== anonymousUserId);
  if (otherMemberIds.length === 0) return;

  const { getMemberWorkstreamDigest } = await import("@/lib/workstream");
  const digests = await Promise.all(
    otherMemberIds.map((id) => getMemberWorkstreamDigest(id, roomSlug).catch(() => null))
  );
  const teamLines = digests.filter((d): d is string => Boolean(d)).map((d) => `- Teammate's current work: ${d}`);
  if (teamLines.length === 0) return;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      tools: [
        {
          name: "new_file_overlap_check",
          description: "Report whether a newly created file's name plausibly overlaps with a teammate's already-known work, before its content exists yet.",
          input_schema: {
            type: "object" as const,
            properties: {
              overlaps: { type: "boolean" },
              text: { type: "string", description: "One sentence naming which teammate's work this likely overlaps. Empty string if overlaps is false." }
            },
            required: ["overlaps", "text"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "new_file_overlap_check" },
      system: `A teammate just created a new file named "${fileName}" (no content yet, judge on the name alone). Only say overlaps: true if the name plausibly points at the same specific piece of work as an existing teammate digest below, not just a shared broad topic. Be conservative, false positives here waste people's time before they've even started. NO EM-DASHES. Max one sentence, 24 words.`,
      messages: [
        {
          role: "user",
          content: `New file name: "${fileName}"\n\nTeam context:\n${teamLines.join("\n")}`
        }
      ]
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return;
    const out = block.input as { overlaps?: boolean; text?: string };
    if (!out.overlaps || !out.text) return;

    const rec = { type: "team_signal" as const, text: out.text, sourceTopics: [fileName], conflictKind: "duplicate" as const, sourceFileId: fileId };
    const cardKey = `team_signal:${rec.text}`;

    await pool.query(
      `insert into pinned_cards (anonymous_user_id, room_id, card_type, card_key, card_data)
       values ($1, $2, 'discovery', $3, $4)
       on conflict (anonymous_user_id, room_id, card_type, card_key) do update set card_data = excluded.card_data`,
      [anonymousUserId, roomSlug, cardKey, JSON.stringify(rec)]
    );

    await sendPushToUser(anonymousUserId, {
      title: "Possible overlap before you start",
      body: out.text,
      url: `/teams/${roomSlug}`
    });
  } catch (err) {
    console.error("[folder-watch overlap check] failed:", err);
  }
}

// Entry point for both webhook routes: resolve the channel back to a real file, fetch
// its current content, and skip out early if nothing actually changed (both providers
// fire more notifications than there are real edits — a metadata-only touch or a
// duplicate delivery shouldn't trigger a second LLM call for the same content).
export async function handleFileChangeNotification(provider: Provider, channelId: string) {
  const pool = getPool();
  if (!pool) return;

  const res = await pool.query<{ anonymous_user_id: string; room_id: string; file_id: string; file_name: string; last_content_hash: string | null }>(
    `select anonymous_user_id, room_id, file_id, file_name, last_content_hash from file_watch_channels where provider = $1 and channel_id = $2`,
    [provider, channelId]
  );
  const row = res.rows[0];
  if (!row) return;

  const token = provider === "google"
    ? await google.getValidAccessToken(row.anonymous_user_id, row.room_id)
    : await microsoft.getValidAccessToken(row.anonymous_user_id, row.room_id);
  if (!token) return;

  const [file] = provider === "google"
    ? await google.listSpecificFiles(token, [row.file_id])
    : await microsoft.listSpecificFiles(token, [row.file_id]);
  if (!file?.content) return;

  const hash = crypto.createHash("sha256").update(file.content).digest("hex");
  if (hash === row.last_content_hash) return;

  await pool.query(
    `update file_watch_channels set last_content_hash = $1, updated_at = now() where provider = $2 and channel_id = $3`,
    [hash, provider, channelId]
  );

  // A real, confirmed content change just happened — force this person's own digest to
  // regenerate right now instead of waiting on the normal 12h TTL, so the next teammate
  // whose edit compares against it (whether in the next minute or next week) is comparing
  // against what's actually true, not whatever was true up to 12h ago. This is what makes
  // "auto-update on every real change" true in practice, not just in the TTL's name.
  const { getMemberWorkstreamDigest } = await import("@/lib/workstream");
  await getMemberWorkstreamDigest(row.anonymous_user_id, row.room_id, true).catch((err) =>
    console.error("[file-watch] forced digest refresh failed:", err)
  );

  await checkFileForConflict(row.anonymous_user_id, row.room_id, row.file_name, file.content, row.file_id);

  // Structured-facts path (v1: spreadsheets only) — runs alongside the whole-text
  // check above, not instead of it, while this new path proves itself. Deliberately
  // separate try/catch so a failure here never blocks the existing, working check.
  try {
    const isGoogleSheet = provider === "google" && (file as { mimeType?: string }).mimeType === "application/vnd.google-apps.spreadsheet";
    const isExcelFile = provider === "microsoft" && /\.(xlsx|xls)$/i.test(row.file_name);

    if (isGoogleSheet || isExcelFile) {
      const cells = provider === "google"
        ? await google.getSheetValuesWithCoordinates(token, row.file_id)
        : await microsoft.extractStructuredCells(token, row.file_id, row.file_name);

      if (cells && cells.length > 0) {
        const facts = await extractFactsFromCells(cells, row.file_name);
        await checkFactsForConflict(row.anonymous_user_id, row.room_id, provider, row.file_id, row.file_name, facts);
      }
    }
  } catch (err) {
    console.error("[file-watch] structured-facts path failed:", err);
  }
}

// The cheap, single-file version of what individual-guidance.ts does for a whole
// person's digest — deliberately narrow (one file's new content against the team's
// already-synthesized digests and mirror state, no fresh gathering of anyone else's
// raw files) so this can run on every real edit without becoming its own expensive
// full recompute.
export async function checkFileForConflict(anonymousUserId: string, roomSlug: string, fileName: string, content: string, fileId?: string) {
  const pool = getPool();
  if (!pool) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const roomRes = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [roomSlug]);
  const roomUuid = roomRes.rows[0]?.id;
  if (!roomUuid) return;

  const [membersRes, mirrorRes] = await Promise.all([
    pool.query<{ anonymous_user_id: string }>(`select anonymous_user_id from room_members where room_id = $1`, [roomUuid]),
    pool.query<{ theses: { statement: string }[] | null; stale_assumptions: { statement: string }[] | null }>(
      `select theses, stale_assumptions from team_mirror_state where room_id = $1`,
      [roomUuid]
    )
  ]);

  // Goes through the same self-refreshing digest lookup Pulse/guidance use (regenerates
  // if past the 12h TTL) instead of reading member_workstream_digests directly, so a
  // real-time conflict check never compares against a digest that's gone stale beyond
  // that TTL just because nobody happened to view Pulse recently.
  const otherMemberIds = membersRes.rows.map((r) => r.anonymous_user_id).filter((id) => id !== anonymousUserId);
  const { getMemberWorkstreamDigest } = await import("@/lib/workstream");
  const digests = await Promise.all(
    otherMemberIds.map((id) => getMemberWorkstreamDigest(id, roomSlug).catch(() => null))
  );

  const teamLines = [
    ...digests.filter((d): d is string => Boolean(d)).map((d) => `- Teammate's current work: ${d}`),
    ...(mirrorRes.rows[0]?.theses ?? []).map((t) => `- Team thesis: ${t.statement}`),
    ...(mirrorRes.rows[0]?.stale_assumptions ?? []).map((s) => `- Unrevisited team assumption: ${s.statement}`)
  ];
  if (teamLines.length === 0) return;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: [
        {
          name: "file_conflict_check",
          description: "Report whether this file's new content genuinely duplicates or contradicts the team's known work.",
          input_schema: {
            type: "object" as const,
            properties: {
              conflictKind: { type: "string", enum: ["duplicate", "contradiction", "none"] },
              text: { type: "string", description: "One sentence stating the conflict. Empty string if conflictKind is none." }
            },
            required: ["conflictKind", "text"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "file_conflict_check" },
      system: `A teammate just edited "${fileName}". Compare ONLY its new content against the team context given. "duplicate" if a teammate is already doing this same work. "contradiction" if a fact, number, or conclusion in this file now conflicts with what the team already found, including a plain factual error like a wrong figure in a shared spreadsheet. "none" for anything softer, a surface theme, or no real link, an empty array is correct and common. NO EM-DASHES. Max one sentence, 28 words, no consultant-speak.`,
      messages: [
        {
          role: "user",
          content: `New content of "${fileName}":\n${content.slice(0, 2000)}\n\nTeam context:\n${teamLines.join("\n")}`
        }
      ]
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return;
    const out = block.input as { conflictKind?: string; text?: string };
    if (out.conflictKind !== "duplicate" && out.conflictKind !== "contradiction") return;
    if (!out.text) return;

    const rec = { type: "team_signal" as const, text: out.text, sourceTopics: [fileName], conflictKind: out.conflictKind, sourceFileId: fileId };
    const cardKey = `team_signal:${rec.text}`;

    await pool.query(
      `insert into pinned_cards (anonymous_user_id, room_id, card_type, card_key, card_data)
       values ($1, $2, 'discovery', $3, $4)
       on conflict (anonymous_user_id, room_id, card_type, card_key) do update set card_data = excluded.card_data`,
      [anonymousUserId, roomSlug, cardKey, JSON.stringify(rec)]
    );

    await sendPushToUser(anonymousUserId, {
      title: out.conflictKind === "duplicate" ? "Duplicate work found" : "Conflicting data found",
      body: out.text,
      url: `/teams/${roomSlug}`
    });
  } catch (err) {
    console.error("[file-watch conflict check] failed:", err);
  }
}

interface StructuredCellInput {
  location: string;
  value: string;
  rowLabel?: string;
  colLabel?: string;
}

export interface ExtractedFact {
  subject: string;
  value: string;
  location: string;
  snippet?: string;
}

// Structured-facts v1: spreadsheets only. Turns raw cell coordinates+values (real,
// not hallucinated — given to the model verbatim) into normalized, comparable facts
// ({subject, value, location}). The model's only job is producing a clean subject
// label from the row/column context; it never invents a location or value. This is
// the extraction half of the two-part design in fomo_vision.md's "Detection
// architecture refinement" — kept deliberately separate from the judgment half
// (checkFactsForConflict below), which is the only place contextual ambiguity gets
// resolved.
export async function extractFactsFromCells(cells: StructuredCellInput[], fileName: string): Promise<ExtractedFact[]> {
  if (cells.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const cellLines = cells
    .slice(0, 200)
    .map((c) => `${c.location} | value: ${c.value}${c.rowLabel ? ` | row label: ${c.rowLabel}` : ""}${c.colLabel ? ` | column label: ${c.colLabel}` : ""}`)
    .join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      tools: [
        {
          name: "extract_facts",
          description: "Turn labeled spreadsheet cells into normalized, comparable facts.",
          input_schema: {
            type: "object" as const,
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subject: { type: "string", description: "Normalized referent, e.g. 'client 1 Q4 earnings'. Combine row + column label when both exist." },
                    value: { type: "string", description: "The literal cell value, copied exactly." },
                    location: { type: "string", description: "Copied exactly from the input, never invented." }
                  },
                  required: ["subject", "value", "location"],
                  additionalProperties: false
                }
              }
            },
            required: ["facts"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "extract_facts" },
      system: `Each line is one cell from "${fileName}": its coordinate, value, and any row/column label found nearby. Only keep cells that are real, checkable facts, a labeled number, date, or named conclusion someone could contradict. Skip IDs, blank labels, formatting artifacts, or cells with no meaningful label. Copy "location" and "value" exactly as given, never invent or reformat them. Max 30 facts. NO EM-DASHES.`,
      messages: [{ role: "user", content: cellLines }]
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    const out = block.input as { facts?: ExtractedFact[] };
    return out.facts ?? [];
  } catch (err) {
    console.error("[extractFactsFromCells] failed:", err);
    return [];
  }
}

// Judgment half of the structured-facts design: given newly extracted facts, finds
// candidate existing facts in the same room whose subject is textually similar
// (Postgres trigram similarity, not embeddings, for v1), then asks a single,
// narrow AI call per candidate set whether they're genuinely the same real-world
// claim with disagreeing values, deliberately never given the whole team's activity
// at once. Runs alongside the existing whole-text checkFileForConflict above for
// spreadsheets, not in place of it, while this new path proves itself.
export async function checkFactsForConflict(
  anonymousUserId: string,
  roomSlug: string,
  provider: Provider,
  fileId: string,
  fileName: string,
  facts: ExtractedFact[]
) {
  const pool = getPool();
  if (!pool || facts.length === 0) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  for (const fact of facts) {
    // A fact at the same file+location that's still current is this same cell
    // having been re-extracted after an edit, not a new independent claim — it
    // supersedes the old row rather than sitting alongside it.
    const existingRes = await pool.query<{ id: string }>(
      `select id from project_facts where provider = $1 and file_id = $2 and location = $3 and superseded_by is null`,
      [provider, fileId, fact.location]
    );
    const existingId = existingRes.rows[0]?.id;

    const insertRes = await pool.query<{ id: string }>(
      `insert into project_facts (anonymous_user_id, room_id, provider, file_id, file_name, subject, value, location)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [anonymousUserId, roomSlug, provider, fileId, fileName, fact.subject, fact.value, fact.location]
    );
    const newId = insertRes.rows[0].id;

    if (existingId) {
      await pool.query(`update project_facts set superseded_by = $1, updated_at = now() where id = $2`, [newId, existingId]);
    }

    // Candidates: similar subject, still current, from a different file (a
    // different location in the same file is a supersession, handled above, not
    // a cross-person conflict).
    const candidatesRes = await pool.query<{ id: string; subject: string; value: string; location: string; file_name: string }>(
      `select id, subject, value, location, file_name from project_facts
       where room_id = $1 and superseded_by is null and file_id != $2 and id != $3
         and similarity(subject, $4) > 0.4
       order by similarity(subject, $4) desc
       limit 5`,
      [roomSlug, fileId, newId, fact.subject]
    );
    if (candidatesRes.rows.length === 0) continue;

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        tools: [
          {
            name: "fact_conflict_check",
            description: "Report whether a new fact genuinely contradicts a candidate existing fact.",
            input_schema: {
              type: "object" as const,
              properties: {
                candidateId: { type: "string", description: "id of the conflicting candidate, empty string if none conflict" },
                text: { type: "string", description: "One sentence citing both exact locations and values. Empty string if no conflict." }
              },
              required: ["candidateId", "text"],
              additionalProperties: false
            }
          }
        ],
        tool_choice: { type: "tool", name: "fact_conflict_check" },
        system: `A new fact was just recorded: "${fact.subject}" = ${fact.value} (${fileName}, ${fact.location}). Compare it against these candidate facts from other files in the same project. A real contradiction means they're genuinely about the same real-world thing, same subject, same time period, same kind of figure, but disagree on value. Same number appearing in a different context is NOT a contradiction. If a real contradiction exists, cite both exact locations and values in one sentence. NO EM-DASHES. Max 28 words.`,
        messages: [
          {
            role: "user",
            content: candidatesRes.rows.map((c) => `id: ${c.id} | ${c.subject} = ${c.value} (${c.file_name}, ${c.location})`).join("\n")
          }
        ]
      });

      const block = message.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") continue;
      const out = block.input as { candidateId?: string; text?: string };
      if (!out.candidateId || !out.text) continue;

      const cardKey = `fact_conflict:${out.text}`;
      const rec = { type: "team_signal" as const, text: out.text, sourceTopics: [fileName], conflictKind: "contradiction" as const, sourceFileId: fileId };

      await pool.query(
        `insert into pinned_cards (anonymous_user_id, room_id, card_type, card_key, card_data)
         values ($1, $2, 'discovery', $3, $4)
         on conflict (anonymous_user_id, room_id, card_type, card_key) do update set card_data = excluded.card_data`,
        [anonymousUserId, roomSlug, cardKey, JSON.stringify(rec)]
      );

      await sendPushToUser(anonymousUserId, {
        title: "Conflicting data found",
        body: out.text,
        url: `/teams/${roomSlug}`
      });
    } catch (err) {
      console.error("[checkFactsForConflict] judgment call failed:", err);
    }
  }
}

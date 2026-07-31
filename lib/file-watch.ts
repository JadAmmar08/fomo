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
    const { id, expirationDateTime } = await microsoft.createSubscription(token, fileId, webhookUrl("microsoft"), secret);
    await pool.query(
      `insert into file_watch_channels (provider, anonymous_user_id, room_id, file_id, file_name, channel_id, expires_at)
       values ('microsoft', $1, $2, $3, $4, $5, $6)
       on conflict (provider, file_id, anonymous_user_id, room_id) do update
         set channel_id = excluded.channel_id, expires_at = excluded.expires_at, updated_at = now()`,
      [anonymousUserId, roomId, fileId, fileName, id, expirationDateTime]
    );
  }
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

  await checkFileForConflict(row.anonymous_user_id, row.room_id, row.file_name, file.content);
}

// The cheap, single-file version of what individual-guidance.ts does for a whole
// person's digest — deliberately narrow (one file's new content against the team's
// already-synthesized digests and mirror state, no fresh gathering of anyone else's
// raw files) so this can run on every real edit without becoming its own expensive
// full recompute.
async function checkFileForConflict(anonymousUserId: string, roomSlug: string, fileName: string, content: string) {
  const pool = getPool();
  if (!pool) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const roomRes = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [roomSlug]);
  const roomUuid = roomRes.rows[0]?.id;
  if (!roomUuid) return;

  const [othersRes, mirrorRes] = await Promise.all([
    pool.query<{ digest: string }>(
      `select digest from member_workstream_digests where room_id = $1 and anonymous_user_id != $2`,
      [roomSlug, anonymousUserId]
    ),
    pool.query<{ theses: { statement: string }[] | null; stale_assumptions: { statement: string }[] | null }>(
      `select theses, stale_assumptions from team_mirror_state where room_id = $1`,
      [roomUuid]
    )
  ]);

  const teamLines = [
    ...othersRes.rows.map((r) => `- Teammate's current work: ${r.digest}`),
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

    const rec = { type: "team_signal" as const, text: out.text, sourceTopics: [fileName], conflictKind: out.conflictKind };
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

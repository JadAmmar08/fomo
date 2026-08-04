import * as google from "@/lib/google";
import * as slack from "@/lib/slack";
import * as microsoft from "@/lib/microsoft";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots";
import { getRoomWebOfIdeas, type IdeaConnection } from "@/lib/room-connections";
import { getPool } from "@/lib/postgres";

export interface WorkstreamItem {
  source: "google" | "slack" | "microsoft";
  label: string;
  name: string;
  modifiedTime: string;
  link: string;
  content?: string | null;
}

export interface SourceStatus {
  connected: boolean;
  linked: boolean;
  label: string;
  isAutoAll?: boolean;
  includeSharedEnabled?: boolean;
  linkedFiles?: Array<{ id: string; name: string }>;
  connectedEmail?: string | null;
}

export async function getSourceStatuses(anonymousUserId: string, roomId: string): Promise<Record<"google" | "slack" | "microsoft", SourceStatus>> {
  const [googleConn, slackConn, msConn] = await Promise.all([
    google.getGoogleConnection(anonymousUserId, roomId),
    slack.getSlackConnection(roomId),
    microsoft.getMicrosoftConnection(anonymousUserId, roomId)
  ]);

  const googleToken = await google.getValidAccessToken(anonymousUserId, roomId).catch(() => null);
  const msToken = await microsoft.getValidAccessToken(anonymousUserId, roomId).catch(() => null);

  return {
    google: {
      connected: Boolean(googleToken),
      linked: Boolean(googleConn?.linked_folder_id) || Boolean(googleConn?.auto_all_files) || Boolean(googleConn?.linked_file_ids?.length),
      label: googleConn?.linked_file_ids?.length
        ? `${googleConn.linked_file_ids.length} file${googleConn.linked_file_ids.length > 1 ? "s" : ""}`
        : googleConn?.auto_all_files
          ? googleConn.include_shared_files ? "Everything I own + shared" : "Everything I own"
          : googleConn?.linked_folder_name ?? "Google Drive",
      isAutoAll: Boolean(googleConn?.auto_all_files),
      includeSharedEnabled: Boolean(googleConn?.include_shared_files),
      linkedFiles: googleConn?.linked_file_ids ?? []
    },
    slack: {
      connected: Boolean(slackConn),
      linked: Boolean(slackConn?.linked_channel_id) || Boolean(slackConn?.auto_join_all),
      label: slackConn?.auto_join_all
        ? "All internal channels"
        : slackConn?.linked_channel_name
          ? `#${slackConn.linked_channel_name}`
          : "Slack"
    },
    microsoft: {
      connected: Boolean(msToken),
      linked: Boolean(msConn?.linked_folder_id) || Boolean(msConn?.auto_all_files) || Boolean(msConn?.linked_file_ids?.length),
      label: msConn?.linked_file_ids?.length
        ? `${msConn.linked_file_ids.length} file${msConn.linked_file_ids.length > 1 ? "s" : ""}`
        : msConn?.auto_all_files
          ? msConn.include_shared_files ? "Everything I own + shared" : "Everything I own"
          : msConn?.linked_folder_name ?? "OneDrive",
      isAutoAll: Boolean(msConn?.auto_all_files),
      includeSharedEnabled: Boolean(msConn?.include_shared_files),
      linkedFiles: msConn?.linked_file_ids ?? [],
      connectedEmail: msConn?.microsoft_email ?? null
    }
  };
}

// Pulls raw activity from every connected-and-linked source for this room and
// normalizes it into one shape, so the summary and feed treat Drive files, OneDrive
// files, and Slack messages as the same kind of thing: something that happened,
// by someone, with content — never who did what framed as behavior, just activity.
async function gatherItems(anonymousUserId: string, roomId: string): Promise<WorkstreamItem[]> {
  const items: WorkstreamItem[] = [];

  const googleToken = await google.getValidAccessToken(anonymousUserId, roomId).catch(() => null);
  if (googleToken) {
    const conn = await google.getGoogleConnection(anonymousUserId, roomId);
    const files = conn?.linked_file_ids?.length
      ? await google.listSpecificFiles(googleToken, conn.linked_file_ids.map((f) => f.id))
      : conn?.auto_all_files
        ? await google.listRecentFilesWithRevisions(googleToken, 20, null, true, {
            includeShared: conn.include_shared_files,
            userEmail: conn.google_email
          })
        : conn?.linked_folder_id
          ? await google.listRecentFilesWithRevisions(googleToken, 10, conn.linked_folder_id)
          : [];
    for (const f of files) {
      items.push({ source: "google", label: "Drive", name: f.name, modifiedTime: f.modifiedTime, link: f.webViewLink, content: f.content });
    }
  }

  const msToken = await microsoft.getValidAccessToken(anonymousUserId, roomId).catch(() => null);
  if (msToken) {
    const conn = await microsoft.getMicrosoftConnection(anonymousUserId, roomId);
    const files = conn?.linked_file_ids?.length
      ? await microsoft.listSpecificFiles(msToken, conn.linked_file_ids.map((f) => f.id))
      : conn?.auto_all_files
        ? await microsoft.listRecentFilesAcrossDrive(msToken, 20, conn.include_shared_files)
        : conn?.linked_folder_id
          ? await microsoft.listRecentFiles(msToken, conn.linked_folder_id, 10)
          : [];
    for (const f of files) {
      items.push({ source: "microsoft", label: "OneDrive", name: f.name, modifiedTime: f.lastModifiedDateTime, link: f.webUrl, content: f.content });
    }
  }

  const slackConn = await slack.getSlackConnection(roomId);
  if (slackConn?.auto_join_all) {
    const channelActivity = await slack.fetchAllInternalChannelsActivity(slackConn.access_token, 30);
    for (const { channel, messages } of channelActivity) {
      items.push({
        source: "slack",
        label: `#${channel}`,
        name: "Recent conversation",
        modifiedTime: new Date(Number(messages[0].ts) * 1000).toISOString(),
        link: "#",
        content: messages.slice().reverse().map((m) => m.text).join("\n")
      });
    }
  } else if (slackConn?.linked_channel_id) {
    const messages = await slack.fetchChannelHistory(slackConn.access_token, slackConn.linked_channel_id, 50);
    if (messages.length > 0) {
      items.push({
        source: "slack",
        label: `#${slackConn.linked_channel_name}`,
        name: "Recent conversation",
        modifiedTime: new Date(Number(messages[0].ts) * 1000).toISOString(),
        link: "#",
        content: messages.slice().reverse().map((m) => m.text).join("\n")
      });
    }
  }

  return items.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
}

function formatItemsAsLines(items: WorkstreamItem[], excerptChars = 120): string[] {
  return items
    .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
    .slice(0, 15)
    .map((item) => {
      const excerpt = item.content ? item.content.replace(/\s+/g, " ").trim().slice(0, excerptChars) : "";
      return excerpt ? `[${item.label}] "${item.name}" — ${excerpt}` : `[${item.label}] "${item.name}"`;
    });
}

const DIGEST_TTL_MS = 12 * 60 * 60 * 1000; // shorter than the guidance/pulse caches that consume it, so it never serves as the stale bottleneck
// Real-time file edits force a refresh (see lib/file-watch.ts) so a teammate's next
// comparison is never stale, but a burst of edits in the same active session (someone
// typing, saving every few seconds) shouldn't pay for a full resynthesis on every single
// one — this caps it to at most once per this window regardless of how many force=true
// calls come in back to back.
const FORCE_DEBOUNCE_MS = 2 * 60 * 1000;

// A raw excerpt from one file tells you almost nothing about what someone actually
// concluded, and reasoning over 15 of them at once is both thin and expensive as
// connected activity grows. This synthesizes one person's real connected work into a
// short, concrete "what their work currently shows" digest — actual findings, decisions,
// and open items, not a topic list — which is what makes catching a real contradiction
// between two people's work possible instead of just noticing they're in the same area.
export async function getMemberWorkstreamDigest(anonymousUserId: string, roomSlug: string, force = false): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;

  const cached = await pool.query<{ digest: string; generated_at: string }>(
    `select digest, generated_at from member_workstream_digests where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomSlug]
  );
  const age = cached.rows.length > 0 ? Date.now() - new Date(cached.rows[0].generated_at).getTime() : Infinity;
  const withinTtl = !force && age < DIGEST_TTL_MS;
  const withinForceDebounce = force && age < FORCE_DEBOUNCE_MS;
  if (withinTtl || withinForceDebounce) {
    return cached.rows[0].digest;
  }

  const items = await gatherItems(anonymousUserId, roomSlug).catch(() => []);
  if (items.length === 0) return null;

  const digest = await synthesizeMemberDigest(items, cached.rows[0]?.digest ?? null);
  if (!digest) return cached.rows[0]?.digest ?? null;

  await pool.query(
    `insert into member_workstream_digests (anonymous_user_id, room_id, digest, generated_at)
     values ($1, $2, $3, now())
     on conflict (anonymous_user_id, room_id) do update set digest = excluded.digest, generated_at = now()`,
    [anonymousUserId, roomSlug, digest]
  );

  return digest;
}

async function synthesizeMemberDigest(items: WorkstreamItem[], previousDigest: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Oldest first, not most-recent-first, so the model can actually see progression over
  // time (a draft, then a revision, then a final version) instead of a shuffled pile it
  // has to guess the order of.
  const chronological = [...items].sort((a, b) => new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime());
  const lines = chronological.slice(0, 20).map((item) => {
    const header = `- [${item.label}] "${item.name}", ${item.modifiedTime}`;
    return item.content ? `${header}\n  Content: ${item.content.slice(0, 1000).replace(/\n/g, "\n  ")}` : header;
  });

  const historyBlock = previousDigest
    ? `\n\nHere is the digest from the last time this was generated:\n"${previousDigest}"\n\nIf their actual conclusion or position looks materially the same, say so briefly and lead with anything new. If their conclusion or stance has genuinely shifted since then, lead with what changed, that shift is the most important thing to surface.`
    : "";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: `Here is one person's connected file and conversation activity, ordered oldest to newest by when each item was last modified:\n\n${lines.join("\n\n")}${historyBlock}\n\nWrite a short (2-5 sentence) digest of what this person's work CURRENTLY shows. Rules:\n- Items are given in date order on purpose. If a later item supersedes, revises, or contradicts an earlier one, state only the current (later) position, don't report the superseded one as if it's still live.\n- Distinguish status: something phrased as a draft, open hypothesis, or rejected idea is NOT the same as a settled conclusion or decision. Say so if it matters (e.g. "still exploring X" vs "concluded X").\n- State concrete findings, decisions, or conclusions, and any open item they seem stuck on or still deciding.\n- State specifics from the content, not a generic topic summary. No preamble, just the digest.`
        }
      ]
    });

    const block = message.content[0];
    return block.type === "text" ? block.text.trim() : null;
  } catch (err) {
    console.error("[synthesizeMemberDigest] failed:", err);
    return null;
  }
}

// Anonymous, content-only view into what the rest of the team has connected — used by
// Discovery to point one person toward a teammate's existing work without ever naming
// who owns it or linking to it (that's the whole difference from the Workstream feed).
export interface OwnedWorkstreamItem {
  ownerId: string;
  item: WorkstreamItem;
}

// Item-level version, retains who owns each item (never shown to the model or the
// requester up front, only used later if a handoff request needs to resolve back to a
// real artifact and its owner).
export async function getTeamWorkstreamItems(roomSlug: string, excludeUserId: string): Promise<OwnedWorkstreamItem[]> {
  const pool = getPool();
  if (!pool) return [];

  const roomUuid = await resolveRoomUuid(roomSlug);
  if (!roomUuid) return [];

  const membersRes = await pool.query<{ anonymous_user_id: string }>(
    `select anonymous_user_id from room_members where room_id = $1`,
    [roomUuid]
  );
  const memberIds = membersRes.rows.map((r) => r.anonymous_user_id).filter((id) => id !== excludeUserId);
  if (memberIds.length === 0) return [];

  const owned: OwnedWorkstreamItem[] = [];
  for (const memberId of memberIds) {
    const items = await gatherItems(memberId, roomSlug).catch(() => []);
    for (const item of items) owned.push({ ownerId: memberId, item });
  }

  return owned
    .sort((a, b) => new Date(b.item.modifiedTime).getTime() - new Date(a.item.modifiedTime).getTime())
    .slice(0, 15);
}

export async function getTeamWorkstreamSnippets(roomSlug: string, excludeUserId: string): Promise<string[]> {
  const owned = await getTeamWorkstreamItems(roomSlug, excludeUserId);
  return formatItemsAsLines(owned.map((o) => o.item));
}

async function resolveRoomUuid(slug: string): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [slug]);
  return res.rows[0]?.id ?? null;
}

// One combined narrative across every connected source AND the existing Pulse
// connections layer (cross-person topic overlap from browsing/research) — one
// synthesis instead of two separate features that never spoke to each other.
export async function getCombinedWorkstream(anonymousUserId: string, roomId: string) {
  const items = await gatherItems(anonymousUserId, roomId);

  const roomUuid = await resolveRoomUuid(roomId);
  const pulse = roomUuid ? await getRoomWebOfIdeas(roomUuid).catch(() => null) : null;
  const pulseConnections = pulse?.connections ?? [];
  const soloHighlights = pulse?.soloHighlights ?? [];

  if (items.length === 0 && pulseConnections.length === 0) {
    return { items, summary: null, pulseConnections, soloHighlights };
  }

  const previous = await getLatestSnapshot(roomId, "combined");
  const summary = await summarizeCombined(items, pulseConnections, previous?.summary);
  await saveSnapshot(roomId, "combined", items, summary);

  return { items, summary, pulseConnections, soloHighlights };
}

async function summarizeCombined(items: WorkstreamItem[], pulseConnections: IdeaConnection[], previousSummary?: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const lines = items.map((item) => {
    const header = `- [${item.label}] "${item.name}", ${item.modifiedTime}`;
    return item.content ? `${header}\n  Content: ${item.content.slice(0, 1500).replace(/\n/g, "\n  ")}` : header;
  });

  const pulseLines = pulseConnections.map(
    (c) => `- [Research overlap] ${c.headline}: ${c.explanation}`
  );

  const historyBlock = previousSummary
    ? `\n\nHere is the summary from the last time this was checked:\n"${previousSummary}"\n\nIf things look materially the same, say so briefly and lead with what's new. If meaningfully different, lead with what changed.`
    : "";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const allLines = [...lines, ...pulseLines];
    if (allLines.length === 0) return null;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Here is recent activity across this team's connected tools (Drive, OneDrive, Slack — files, edits, conversation) and, separately, AI-found overlaps between what different members have independently been researching:\n\n${allLines.join("\n\n")}${historyBlock}\n\nWrite a short (2-3 sentence, one tight paragraph) plain-English summary of this team as ONE coherent picture, not separate reports per source. Lead with the single most important thing: what's duplicated, contradicted, or stalled, if anything, otherwise what's actually being worked on. Never describe this as tracking or monitoring a specific person — describe the work and the overlaps themselves. No preamble, no restating unchanged status at length, just the summary.`
        }
      ]
    });

    const block = message.content[0];
    return block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("[summarizeCombined] failed:", err);
    return null;
  }
}

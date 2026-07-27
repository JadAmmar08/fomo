import * as google from "@/lib/google";
import * as slack from "@/lib/slack";
import * as microsoft from "@/lib/microsoft";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots";

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
      linked: Boolean(googleConn?.linked_folder_id) || Boolean(googleConn?.auto_all_files),
      label: googleConn?.auto_all_files
        ? googleConn.include_shared_files ? "Everything I own + shared" : "Everything I own"
        : googleConn?.linked_folder_name ?? "Google Drive",
      isAutoAll: Boolean(googleConn?.auto_all_files),
      includeSharedEnabled: Boolean(googleConn?.include_shared_files)
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
      linked: Boolean(msConn?.linked_folder_id) || Boolean(msConn?.auto_all_files),
      label: msConn?.auto_all_files
        ? msConn.include_shared_files ? "Everything I own + shared" : "Everything I own"
        : msConn?.linked_folder_name ?? "OneDrive",
      isAutoAll: Boolean(msConn?.auto_all_files),
      includeSharedEnabled: Boolean(msConn?.include_shared_files)
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
    const files = conn?.auto_all_files
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
    const files = conn?.auto_all_files
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

// One combined narrative across every connected source, instead of three separate
// summaries — the same signal, read as a single workstream rather than three
// disconnected tool-by-tool reports.
export async function getCombinedWorkstream(anonymousUserId: string, roomId: string) {
  const items = await gatherItems(anonymousUserId, roomId);
  if (items.length === 0) return { items, summary: null };

  const previous = await getLatestSnapshot(roomId, "combined");
  const summary = await summarizeCombined(items, previous?.summary);
  await saveSnapshot(roomId, "combined", items, summary);

  return { items, summary };
}

async function summarizeCombined(items: WorkstreamItem[], previousSummary?: string | null): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const lines = items.map((item) => {
    const header = `- [${item.label}] "${item.name}", ${item.modifiedTime}`;
    return item.content ? `${header}\n  Content: ${item.content.slice(0, 1500).replace(/\n/g, "\n  ")}` : header;
  });

  const historyBlock = previousSummary
    ? `\n\nHere is the summary from the last time this was checked:\n"${previousSummary}"\n\nIf things look materially the same, say so briefly and lead with what's new. If meaningfully different, lead with what changed.`
    : "";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Here is recent activity across this team's connected tools (Drive, OneDrive, Slack) — files, edits, and conversation:\n\n${lines.join("\n\n")}${historyBlock}\n\nWrite a short (4-6 sentence) plain-English summary of this team's workstream as ONE coherent picture, not three separate reports per tool. Cover: what's actually being worked on, anything that looks duplicated or disconnected across sources, and anything unresolved or stalled. Never describe this as tracking or monitoring a person — describe the work itself. No preamble, just the summary.`
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

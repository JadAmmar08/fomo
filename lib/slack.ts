import { getPool } from "@/lib/postgres";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_OAUTH_ACCESS_URL = "https://slack.com/api/oauth.v2.access";

// Bot-level scopes for a single workspace install (not a per-user token). channels:history
// and channels:read are the two that matter — everything else stays off by design, since
// this only ever reads channels a room's members have explicitly linked, never a user's DMs.
export const SLACK_SCOPES = ["channels:history", "channels:read", "channels:join", "team:read"].join(",");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildSlackInstallUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("SLACK_CLIENT_ID"),
    scope: SLACK_SCOPES,
    redirect_uri: requireEnv("SLACK_REDIRECT_URI"),
    state
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  scope: string;
  bot_user_id: string;
  team: { id: string; name: string };
  error?: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const res = await fetch(SLACK_OAUTH_ACCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("SLACK_CLIENT_ID"),
      client_secret: requireEnv("SLACK_CLIENT_SECRET"),
      redirect_uri: requireEnv("SLACK_REDIRECT_URI")
    })
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok) throw new Error(`Slack OAuth failed: ${data.error}`);
  return data;
}

export async function saveSlackConnection(params: {
  roomId: string;
  installedBy: string;
  accessToken: string;
  botUserId: string;
  scope: string;
  teamId: string;
  teamName: string;
}) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `insert into slack_connections
       (room_id, slack_team_id, slack_team_name, access_token, bot_user_id, scope, installed_by, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (room_id) do update set
       slack_team_id = excluded.slack_team_id,
       slack_team_name = excluded.slack_team_name,
       access_token = excluded.access_token,
       bot_user_id = excluded.bot_user_id,
       scope = excluded.scope,
       installed_by = excluded.installed_by,
       updated_at = now()`,
    [params.roomId, params.teamId, params.teamName, params.accessToken, params.botUserId, params.scope, params.installedBy]
  );
}

export async function getSlackConnection(roomId: string) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{
    access_token: string;
    slack_team_name: string;
    linked_channel_id: string | null;
    linked_channel_name: string | null;
  }>(
    `select access_token, slack_team_name, linked_channel_id, linked_channel_name
     from slack_connections where room_id = $1`,
    [roomId]
  );
  return res.rows[0] ?? null;
}

export async function linkSlackChannel(roomId: string, channelId: string, channelName: string) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `update slack_connections set linked_channel_id = $1, linked_channel_name = $2, updated_at = now()
     where room_id = $3`,
    [channelId, channelName, roomId]
  );
}

export async function listChannels(accessToken: string) {
  const res = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=200", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack channel list failed: ${data.error}`);
  return data.channels as Array<{ id: string; name: string; is_member: boolean }>;
}

// Joins a public channel on the caller's explicit, one-time selection — never on its own
// initiative. This replaces the old "type /invite @FOMO manually" step with a single click,
// but the consent moment is the same: nothing happens until someone picks this exact channel.
export async function joinChannel(accessToken: string, channelId: string) {
  const res = await fetch("https://slack.com/api/conversations.join", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ channel: channelId })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack channel join failed: ${data.error}`);
}

export async function fetchChannelHistory(accessToken: string, channelId: string, limit = 100) {
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack history fetch failed: ${data.error}`);
  return data.messages as Array<{ user?: string; text: string; ts: string }>;
}

// Turns a channel's recent messages into a short summary of what's being actively discussed —
// never a per-person behavior model, just a readable digest of the conversation itself.
export async function summarizeChannelActivity(messages: Array<{ user?: string; text: string; ts: string }>): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || messages.length === 0) return null;

  const transcript = messages
    .slice()
    .reverse()
    .map((m) => `[${new Date(Number(m.ts) * 1000).toLocaleDateString()}] ${m.text}`)
    .join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Here are recent messages from a team Slack channel:\n\n${transcript}\n\nWrite a short (3-5 sentence) plain-English summary of what's actively being discussed, any open questions or decisions pending, and anything that looks unresolved. No preamble, just the summary.`
        }
      ]
    });

    const block = message.content[0];
    return block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("[summarizeChannelActivity] failed:", err);
    return null;
  }
}

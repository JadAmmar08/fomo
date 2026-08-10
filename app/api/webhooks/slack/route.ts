import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { extractFactsFromCells, checkFactsForConflict } from "@/lib/file-watch";
import { resolveSlackSenderAnonymousId } from "@/lib/slack";

// Slack signs every request with HMAC-SHA256 over "v0:{timestamp}:{raw body}",
// using the app's Signing Secret. Verifying this (not the deprecated Verification
// Token) confirms the request genuinely came from Slack before we trust anything
// in it. Raw body text is required here, not req.json(), since the signature is
// computed over the exact bytes Slack sent.
function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret || !timestamp || !signature) return false;

  // Reject requests older than 5 minutes, a standard replay-attack guard Slack's
  // own docs recommend.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

interface SlackMessageEvent {
  type: string;
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    type: string;
    challenge?: string;
    team_id?: string;
    event?: SlackMessageEvent;
  };

  // Slack's one-time handshake when you first save this URL under Event
  // Subscriptions: echo the challenge value back, plain text, nothing else.
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback" || !body.event || !body.team_id) {
    return NextResponse.json({ ok: true });
  }

  const event = body.event;

  // Only plain new messages from real people carry a checkable claim. Skip bot
  // messages (including our own), edits, deletes, joins/leaves, and anything
  // without text — a subtype means it's one of those, not a fresh message.
  if (event.type !== "message" || event.subtype || event.bot_id || !event.text?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true });

  // A workspace can be installed into more than one FOMO room (room_id is the
  // primary key on slack_connections, slack_team_id is not unique), so every
  // room that either explicitly linked this channel or turned on auto-join-all
  // needs its own check, not just the first match.
  const rooms = await pool.query<{
    room_id: string;
    installed_by: string;
    access_token: string;
    linked_channel_name: string | null;
  }>(
    `select room_id, installed_by, access_token, linked_channel_name from slack_connections
     where slack_team_id = $1 and (linked_channel_id = $2 or auto_join_all = true)`,
    [body.team_id, event.channel]
  );

  for (const room of rooms.rows) {
    try {
      const channelLabel = room.linked_channel_name ? `#${room.linked_channel_name} (Slack)` : `Slack channel ${event.channel}`;
      const facts = await extractFactsFromCells(
        [{ location: event.ts, value: event.text! }],
        channelLabel
      );
      if (facts.length === 0) continue;

      // Attribute to whoever actually sent the message, not whoever installed
      // the app, so detection ownership and personal-memory activity (see
      // syncPersonalMemoryFromActivity, which reads project_facts by
      // anonymous_user_id) reflect the real person, when their Slack account
      // can be matched to a FOMO one by email. Falls back to the installer
      // when no match exists, same as before this resolution existed.
      const senderId = event.user
        ? await resolveSlackSenderAnonymousId(room.access_token, body.team_id!, event.user).catch(() => null)
        : null;
      const ownerId = senderId ?? room.installed_by;

      // Each message is its own unique "file" (fileId = its ts), so the
      // supersession cleanup in checkFactsForConflict only ever looks at THIS
      // message's own prior state (none, since it's brand new) — it never
      // touches earlier messages' facts, which is what makes reusing that
      // function safe for an incremental stream instead of a full-file rescan.
      await checkFactsForConflict(ownerId, room.room_id, "slack", event.ts, channelLabel, facts);
    } catch (err) {
      console.error("[slack webhook] failed to process message for room", room.room_id, err);
    }
  }

  return NextResponse.json({ ok: true });
}

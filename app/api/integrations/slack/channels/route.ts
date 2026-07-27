import { NextRequest, NextResponse } from "next/server";
import { getSlackConnection, joinChannel, linkSlackChannel, listChannels } from "@/lib/slack";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";
  const connection = await getSlackConnection(roomId);
  if (!connection) return NextResponse.json({ connected: false });

  try {
    const channels = await listChannels(connection.access_token);
    return NextResponse.json({
      connected: true,
      teamName: connection.slack_team_name,
      linkedChannelId: connection.linked_channel_id,
      channels: channels.map((c) => ({ id: c.id, name: c.name, isExternal: Boolean(c.is_ext_shared) }))
    });
  } catch (err) {
    console.error("[slack channels] failed:", err);
    return NextResponse.json({ connected: true, error: "Could not list channels" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const channelId = String(body.channelId ?? "");
  const channelName = String(body.channelName ?? "");
  const isExternal = Boolean(body.isExternal);
  const externalConsentConfirmed = Boolean(body.externalConsentConfirmed);

  if (!roomId || !channelId) {
    return NextResponse.json({ error: "roomId and channelId required" }, { status: 400 });
  }

  // A channel shared with another organization (e.g. a client) needs an explicit,
  // separate confirmation beyond just picking it from the list — the people on the
  // other side of that channel haven't agreed to anything just because someone on
  // this team clicked a name in a picker.
  if (isExternal && !externalConsentConfirmed) {
    return NextResponse.json({ error: "External channel requires explicit consent confirmation" }, { status: 400 });
  }

  const connection = await getSlackConnection(roomId);
  if (!connection) {
    return NextResponse.json({ error: "No Slack connection for this room" }, { status: 400 });
  }

  try {
    await joinChannel(connection.access_token, channelId);
  } catch (err) {
    console.error("[slack channels] join failed:", err);
    return NextResponse.json({ error: "Could not join channel" }, { status: 500 });
  }

  await linkSlackChannel(roomId, channelId, channelName, isExternal);
  return NextResponse.json({ ok: true });
}

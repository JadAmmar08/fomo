import { NextRequest, NextResponse } from "next/server";
import { getSlackConnection, linkSlackChannel, listChannels } from "@/lib/slack";

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
      channels: channels.filter((c) => c.is_member).map((c) => ({ id: c.id, name: c.name }))
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

  if (!roomId || !channelId) {
    return NextResponse.json({ error: "roomId and channelId required" }, { status: 400 });
  }

  await linkSlackChannel(roomId, channelId, channelName);
  return NextResponse.json({ ok: true });
}

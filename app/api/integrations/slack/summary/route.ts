import { NextRequest, NextResponse } from "next/server";
import { fetchChannelHistory, getSlackConnection, summarizeChannelActivity } from "@/lib/slack";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";
  const connection = await getSlackConnection(roomId);

  if (!connection) return NextResponse.json({ connected: false });
  if (!connection.linked_channel_id) {
    return NextResponse.json({ connected: true, linked: false, teamName: connection.slack_team_name });
  }

  try {
    const messages = await fetchChannelHistory(connection.access_token, connection.linked_channel_id, 100);
    const previous = await getLatestSnapshot(roomId, "slack");
    const summary = await summarizeChannelActivity(messages, previous?.summary);
    await saveSnapshot(roomId, "slack", messages, summary);

    return NextResponse.json({
      connected: true,
      linked: true,
      channelName: connection.linked_channel_name,
      summary
    });
  } catch (err) {
    console.error("[slack summary] failed:", err);
    return NextResponse.json({ connected: true, linked: true, error: "Could not read channel activity" }, { status: 500 });
  }
}

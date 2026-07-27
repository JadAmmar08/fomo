import { NextRequest, NextResponse } from "next/server";
import { enableAutoJoinAll, getSlackConnection, joinAllInternalChannels } from "@/lib/slack";

// One organizational decision made once by whoever installed the app: join and read
// every internal channel. Channels shared with another organization are always
// excluded, no exceptions — see joinAllInternalChannels for why.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const connection = await getSlackConnection(roomId);
  if (!connection) return NextResponse.json({ error: "No Slack connection for this room" }, { status: 400 });

  try {
    const joined = await joinAllInternalChannels(connection.access_token);
    await enableAutoJoinAll(roomId);
    return NextResponse.json({ ok: true, joinedCount: joined.length });
  } catch (err) {
    console.error("[slack auto-join] failed:", err);
    return NextResponse.json({ error: "Could not join channels" }, { status: 500 });
  }
}

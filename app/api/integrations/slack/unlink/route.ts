import { NextRequest, NextResponse } from "next/server";
import { disconnectSlack, unlinkSlackChannel } from "@/lib/slack";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const fullDisconnect = Boolean(body.disconnect);
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  if (fullDisconnect) await disconnectSlack(roomId);
  else await unlinkSlackChannel(roomId);

  return NextResponse.json({ ok: true });
}

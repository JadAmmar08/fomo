import { NextRequest, NextResponse } from "next/server";
import { disconnectMicrosoft, unlinkMicrosoft } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const fullDisconnect = Boolean(body.disconnect);
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  if (fullDisconnect) await disconnectMicrosoft(anonymousUserId, roomId);
  else await unlinkMicrosoft(anonymousUserId, roomId);

  return NextResponse.json({ ok: true });
}

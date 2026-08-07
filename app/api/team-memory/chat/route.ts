import { NextRequest, NextResponse } from "next/server";
import { sendTeamMemoryChat } from "@/lib/team-memory";

export async function POST(req: NextRequest) {
  const { anonymousUserId, roomId, message } = await req.json().catch(() => ({}));
  if (!anonymousUserId || !roomId || !message) {
    return NextResponse.json({ error: "anonymousUserId, roomId, and message required" }, { status: 400 });
  }
  const result = await sendTeamMemoryChat(anonymousUserId, roomId, String(message)).catch((err) => {
    console.error("[team-memory chat] failed:", err);
    return null;
  });
  if (!result) return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { getSharedMemories } from "@/lib/personal-memory";

// Memory files shared TO the caller by someone else's explicit KT handoff.
// Never returns anything the caller wasn't the intended recipient of.
export async function GET(req: NextRequest) {
  const anonymousUserId = req.nextUrl.searchParams.get("anonymousUserId");
  const roomId = req.nextUrl.searchParams.get("room");
  if (!anonymousUserId || !roomId) {
    return NextResponse.json({ error: "anonymousUserId and room required" }, { status: 400 });
  }
  const shares = await getSharedMemories(anonymousUserId, roomId);
  return NextResponse.json({ shares });
}

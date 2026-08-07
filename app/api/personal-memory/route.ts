import { NextRequest, NextResponse } from "next/server";
import { getPersonalMemory, getPersonalMemoryMessages, setPersonalMemory } from "@/lib/personal-memory";

// Anonymous-id-scoped, same trust model as the rest of the app (see
// app/api/live-signal/route.ts) — whoever holds the anonymousUserId can read
// or edit this file. The privacy guarantee here is that no route accepts a
// "target user" different from the caller: this file only ever reads/writes
// the memory belonging to anonymousUserId itself.
export async function GET(req: NextRequest) {
  const anonymousUserId = req.nextUrl.searchParams.get("anonymousUserId");
  const roomId = req.nextUrl.searchParams.get("room");
  if (!anonymousUserId || !roomId) {
    return NextResponse.json({ error: "anonymousUserId and room required" }, { status: 400 });
  }
  const [memory, messages] = await Promise.all([
    getPersonalMemory(anonymousUserId, roomId),
    getPersonalMemoryMessages(anonymousUserId, roomId)
  ]);
  return NextResponse.json({ memory, messages });
}

export async function PUT(req: NextRequest) {
  const { anonymousUserId, roomId, content } = await req.json().catch(() => ({}));
  if (!anonymousUserId || !roomId || typeof content !== "string") {
    return NextResponse.json({ error: "anonymousUserId, roomId, and content required" }, { status: 400 });
  }
  const memory = await setPersonalMemory(anonymousUserId, roomId, content);
  return NextResponse.json({ memory });
}

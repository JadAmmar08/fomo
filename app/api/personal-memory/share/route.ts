import { NextRequest, NextResponse } from "next/server";
import { sharePersonalMemory } from "@/lib/personal-memory";

// A KT handoff: explicit and one-shot, a frozen snapshot taken right now, not
// a subscription. The sharer has to call this again to update what the
// recipient sees — nothing here creates a standing link between the two.
export async function POST(req: NextRequest) {
  const { anonymousUserId, roomId, shareWith } = await req.json().catch(() => ({}));
  if (!anonymousUserId || !roomId || !shareWith) {
    return NextResponse.json({ error: "anonymousUserId, roomId, and shareWith required" }, { status: 400 });
  }
  if (anonymousUserId === shareWith) {
    return NextResponse.json({ error: "Can't share with yourself" }, { status: 400 });
  }
  await sharePersonalMemory(roomId, anonymousUserId, shareWith);
  return NextResponse.json({ ok: true });
}

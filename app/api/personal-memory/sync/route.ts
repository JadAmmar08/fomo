import { NextRequest, NextResponse } from "next/server";
import { syncPersonalMemoryFromActivity } from "@/lib/personal-memory";

// Pulls real file activity (project_facts) for the caller and merges genuine
// observed patterns into their own private memory. Never touches anyone
// else's data — anonymousUserId is always the caller's own.
export async function POST(req: NextRequest) {
  const { anonymousUserId, roomId } = await req.json().catch(() => ({}));
  if (!anonymousUserId || !roomId) {
    return NextResponse.json({ error: "anonymousUserId and roomId required" }, { status: 400 });
  }
  const memory = await syncPersonalMemoryFromActivity(anonymousUserId, roomId).catch((err) => {
    console.error("[personal-memory sync] failed:", err);
    return null;
  });
  if (!memory) return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  return NextResponse.json({ memory });
}

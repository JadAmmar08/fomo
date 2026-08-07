import { NextRequest, NextResponse } from "next/server";
import { getRequestAnonymousUserId } from "@/lib/session";
import { registerFolderWatch } from "@/lib/file-watch";

// "All files up to this point": marks a starting checkpoint, not a backfill.
// Reuses the existing folder-watch mechanism rooted at the whole drive
// ("root") — registerFolderWatch snapshots whatever files exist right now as
// the known baseline (never processed or backfilled), and only files that
// show up AFTER this point get treated as new and checked. No historical
// crawl, no scrolling through old files, and no sidebar/task pane needs to be
// open, new/edited files are caught through the same webhook path Word/Excel
// already fall back to when the live-edit pane isn't running.
export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  await registerFolderWatch("microsoft", anonymousUserId, roomId, "root", "My files").catch((err) => {
    console.error("[microsoft link-all] folder watch registration failed:", err);
    throw err;
  });

  return NextResponse.json({ ok: true });
}

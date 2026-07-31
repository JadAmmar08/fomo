import { NextRequest, NextResponse } from "next/server";
import { handleFileChangeNotification, handleFolderChangeNotification } from "@/lib/file-watch";

// Drive never sends a body, everything is in headers. The channel token is the
// shared secret we handed Drive when we registered the watch (lib/file-watch.ts
// registerFileWatch) — anyone without it gets rejected before we touch the DB.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-goog-channel-token");
  if (!process.env.FILE_WATCH_WEBHOOK_SECRET || token !== process.env.FILE_WATCH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");

  // "sync" fires once when the channel is first created, just confirming it's live,
  // there's no real change to check yet. "update" is a single-file watch (registerFileWatch);
  // "change" is the account-wide changes feed a folder watch subscribes to (registerFolderWatch)
  // — the channel id only ever matches one of the two tables, so trying both is safe.
  if (channelId && (resourceState === "update" || resourceState === "change")) {
    await Promise.all([
      handleFileChangeNotification("google", channelId).catch((err) => console.error("[webhook google-drive] file check failed:", err)),
      handleFolderChangeNotification("google", channelId).catch((err) => console.error("[webhook google-drive] folder check failed:", err))
    ]);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getGoogleConnection, getValidAccessToken, listRecentFilesWithRevisions, summarizeWorkstream } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  const connection = await getGoogleConnection(anonymousUserId, roomId);
  if (!connection?.linked_folder_id) {
    return NextResponse.json({ connected: true, linked: false });
  }

  try {
    const files = await listRecentFilesWithRevisions(accessToken, 10, connection.linked_folder_id);
    const previous = await getLatestSnapshot(roomId, "google");
    const summary = await summarizeWorkstream(files, previous?.summary);
    await saveSnapshot(roomId, "google", files, summary);

    return NextResponse.json({
      connected: true,
      linked: true,
      folderName: connection.linked_folder_name,
      summary,
      files: files.map((f) => ({ name: f.name, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink }))
    });
  } catch (err) {
    console.error("[google summary] failed:", err);
    return NextResponse.json({ connected: true, linked: true, error: "Could not read Drive activity" }, { status: 500 });
  }
}

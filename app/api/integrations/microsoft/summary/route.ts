import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftConnection, getValidAccessToken, listRecentFiles, summarizeWorkstream } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";
import { getLatestSnapshot, saveSnapshot } from "@/lib/snapshots";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  const connection = await getMicrosoftConnection(anonymousUserId, roomId);
  if (!connection?.linked_folder_id) {
    return NextResponse.json({ connected: true, linked: false });
  }

  try {
    const files = await listRecentFiles(accessToken, connection.linked_folder_id, 10);
    const previous = await getLatestSnapshot(roomId, "microsoft");
    const summary = await summarizeWorkstream(files, previous?.summary);
    await saveSnapshot(roomId, "microsoft", files, summary);

    return NextResponse.json({
      connected: true,
      linked: true,
      folderName: connection.linked_folder_name,
      summary,
      files: files.map((f) => ({ name: f.name, modifiedTime: f.lastModifiedDateTime, webViewLink: f.webUrl }))
    });
  } catch (err) {
    console.error("[microsoft summary] failed:", err);
    return NextResponse.json({ connected: true, linked: true, error: "Could not read OneDrive activity" }, { status: 500 });
  }
}

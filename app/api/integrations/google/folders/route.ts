import { NextRequest, NextResponse, after } from "next/server";
import { getGoogleConnection, getValidAccessToken, linkGoogleFolder, listFolders } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";
import { registerFolderWatch, stopFolderWatches } from "@/lib/file-watch";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ connected: false });

  try {
    const connection = await getGoogleConnection(anonymousUserId, roomId);
    const folders = await listFolders(accessToken);
    return NextResponse.json({
      connected: true,
      linkedFolderId: connection?.linked_folder_id ?? null,
      folders
    });
  } catch (err) {
    console.error("[google folders] failed:", err);
    return NextResponse.json({ connected: true, error: "Could not list folders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const folderId = String(body.folderId ?? "");
  const folderName = String(body.folderName ?? "");

  if (!roomId || !folderId) {
    return NextResponse.json({ error: "roomId and folderId required" }, { status: 400 });
  }

  await linkGoogleFolder(anonymousUserId, roomId, folderId, folderName);

  // Best-effort, same reasoning as the per-file watch: a subscription failure should
  // never block linking the folder itself, the 15-min cron doesn't cover new-file
  // detection but existing content still gets picked up through other paths. Still needs
  // after() rather than a bare fire-and-forget promise — see the microsoft/files route
  // for why (Vercel's serverless runtime doesn't keep a function alive for un-awaited
  // work after the response is sent).
  after(async () => {
    await stopFolderWatches("google", anonymousUserId, roomId)
      .then(() => registerFolderWatch("google", anonymousUserId, roomId, folderId, folderName))
      .catch((err) => console.error("[google folders] watch registration failed:", err));
  });

  return NextResponse.json({ ok: true });
}

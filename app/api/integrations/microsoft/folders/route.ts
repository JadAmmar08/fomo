import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftConnection, getValidAccessToken, linkMicrosoftFolder, listFolders } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ connected: false });

  try {
    const connection = await getMicrosoftConnection(anonymousUserId, roomId);
    const folders = await listFolders(accessToken);
    return NextResponse.json({
      connected: true,
      linkedFolderId: connection?.linked_folder_id ?? null,
      folders
    });
  } catch (err) {
    console.error("[microsoft folders] failed:", err);
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

  await linkMicrosoftFolder(anonymousUserId, roomId, folderId, folderName);
  return NextResponse.json({ ok: true });
}

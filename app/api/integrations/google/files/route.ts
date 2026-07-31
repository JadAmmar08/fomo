import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, linkGoogleFiles, listPickableFiles } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";
import { registerFileWatch, stopFolderWatches } from "@/lib/file-watch";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ connected: false });

  try {
    const files = await listPickableFiles(accessToken);
    return NextResponse.json({ connected: true, files });
  } catch (err) {
    console.error("[google files] failed:", err);
    return NextResponse.json({ connected: true, error: "Could not list files" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const files = Array.isArray(body.files) ? body.files : [];

  if (!roomId || files.length === 0) {
    return NextResponse.json({ error: "roomId and at least one file required" }, { status: 400 });
  }

  await linkGoogleFiles(anonymousUserId, roomId, files);

  // Picking specific files clears any previously linked folder, so its watch
  // (if any) needs to stop too, or it'd keep firing for a folder that's no longer linked.
  stopFolderWatches("google", anonymousUserId, roomId).catch((err) =>
    console.error("[google files] folder watch cleanup failed:", err)
  );

  // Best-effort: a watch registration failure (e.g. the webhook domain isn't verified
  // in Google Search Console yet) should never block linking the file itself, the
  // 15-min cron still covers it either way.
  for (const f of files as Array<{ id: string; name: string }>) {
    registerFileWatch("google", anonymousUserId, roomId, f.id, f.name).catch((err) =>
      console.error("[google files] watch registration failed:", err)
    );
  }

  return NextResponse.json({ ok: true });
}

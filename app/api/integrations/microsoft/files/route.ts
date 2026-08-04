import { NextRequest, NextResponse, after } from "next/server";
import { getValidAccessToken, linkMicrosoftFiles, addMicrosoftFiles, removeMicrosoftFile, listPickableFiles } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";
import { registerFileWatch, stopFileWatches, stopFolderWatches } from "@/lib/file-watch";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ connected: false });

  try {
    const files = await listPickableFiles(accessToken);
    return NextResponse.json({ connected: true, files });
  } catch (err) {
    console.error("[microsoft files] failed:", err);
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

  await linkMicrosoftFiles(anonymousUserId, roomId, files);

  // Deliberately not awaited (best-effort, shouldn't block the response), but still needs
  // `after()` to actually run to completion — a bare fire-and-forget promise here was
  // silently getting killed once the response was sent, since Vercel's serverless runtime
  // doesn't keep a function alive for un-awaited work after it returns.
  after(async () => {
    await stopFolderWatches("microsoft", anonymousUserId, roomId).catch((err) =>
      console.error("[microsoft files] folder watch cleanup failed:", err)
    );
    for (const f of files as Array<{ id: string; name: string }>) {
      await registerFileWatch("microsoft", anonymousUserId, roomId, f.id, f.name).catch((err) =>
        console.error("[microsoft files] watch registration failed:", err)
      );
    }
  });

  return NextResponse.json({ ok: true });
}

// Incremental edit on an already-linked set: add newly picked files and/or remove one
// file, without clobbering everything else that's linked — unlike POST above, which
// replaces the whole selection.
export async function PATCH(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  const add = Array.isArray(body.add) ? (body.add as Array<{ id: string; name: string }>) : [];
  const removeId = typeof body.remove === "string" ? body.remove : null;

  if (!roomId || (add.length === 0 && !removeId)) {
    return NextResponse.json({ error: "roomId and add or remove required" }, { status: 400 });
  }

  if (removeId) {
    await removeMicrosoftFile(anonymousUserId, roomId, removeId);
    after(async () => {
      await stopFileWatches("microsoft", anonymousUserId, roomId, [removeId]).catch((err) =>
        console.error("[microsoft files patch] watch cleanup failed:", err)
      );
    });
  }

  if (add.length > 0) {
    await addMicrosoftFiles(anonymousUserId, roomId, add);
    after(async () => {
      for (const f of add) {
        await registerFileWatch("microsoft", anonymousUserId, roomId, f.id, f.name).catch((err) =>
          console.error("[microsoft files patch] watch registration failed:", err)
        );
      }
    });
  }

  return NextResponse.json({ ok: true });
}

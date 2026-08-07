import { NextRequest, NextResponse, after } from "next/server";
import { getValidAccessToken, snapshotAllExistingFiles, addMicrosoftFiles } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";
import { registerFileWatch } from "@/lib/file-watch";

// "All files up to this point": a one-time snapshot of whatever files actually
// exist right now, linked and watched the same way hand-picked files are —
// unlike the old auto-all flag, this doesn't keep expanding to new files
// created later, it's bounded to what existed when someone chose this.
export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const files = await snapshotAllExistingFiles(accessToken).catch((err) => {
    console.error("[microsoft link-all] snapshot failed:", err);
    return [];
  });
  if (files.length === 0) return NextResponse.json({ ok: true, count: 0 });

  await addMicrosoftFiles(anonymousUserId, roomId, files);

  after(async () => {
    for (const f of files) {
      await registerFileWatch("microsoft", anonymousUserId, roomId, f.id, f.name).catch((err) =>
        console.error("[microsoft link-all] watch registration failed:", err)
      );
    }
  });

  return NextResponse.json({ ok: true, count: files.length });
}

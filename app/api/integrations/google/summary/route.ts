import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, listRecentFilesWithRevisions, summarizeWorkstream } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const files = await listRecentFilesWithRevisions(accessToken, 10);
    const summary = await summarizeWorkstream(files);
    return NextResponse.json({
      connected: true,
      summary,
      files: files.map((f) => ({ name: f.name, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink }))
    });
  } catch (err) {
    console.error("[google summary] failed:", err);
    return NextResponse.json({ connected: true, error: "Could not read Drive activity" }, { status: 500 });
  }
}

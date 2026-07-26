import { NextRequest, NextResponse } from "next/server";
import { buildSlackInstallUrl } from "@/lib/slack";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  const state = Buffer.from(JSON.stringify({ anonymousUserId, roomId })).toString("base64url");

  let installUrl: string;
  try {
    installUrl = buildSlackInstallUrl(state);
  } catch {
    return NextResponse.json({ error: "Slack integration not configured" }, { status: 500 });
  }

  return NextResponse.redirect(installUrl);
}

import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const state = Buffer.from(JSON.stringify({ anonymousUserId, roomId })).toString("base64url");

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state);
  } catch {
    return NextResponse.json({ error: "Google integration not configured" }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}

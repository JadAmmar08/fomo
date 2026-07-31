import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google";
import { getAccountForRequest } from "@/lib/account";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  // Connecting a real Google account has to happen under an identity that already has an
  // email attached — otherwise the connection can end up tied to an orphan identity nobody
  // can ever log back into (this is exactly what went wrong during earlier testing).
  const account = await getAccountForRequest(req);
  if (!account) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  }
  const anonymousUserId = account.anonymousUserId;

  const state = Buffer.from(JSON.stringify({ anonymousUserId, roomId })).toString("base64url");

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state);
  } catch {
    return NextResponse.json({ error: "Google integration not configured" }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}

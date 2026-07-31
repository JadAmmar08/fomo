import { NextRequest, NextResponse } from "next/server";
import { buildMicrosoftAuthUrl } from "@/lib/microsoft";
import { getAccountForRequest } from "@/lib/account";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  // Same reasoning as the Google connect route: never let a connection attach to an
  // identity with no email behind it.
  const account = await getAccountForRequest(req);
  if (!account) {
    return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  }
  const anonymousUserId = account.anonymousUserId;

  const state = Buffer.from(JSON.stringify({ anonymousUserId, roomId })).toString("base64url");

  let authUrl: string;
  try {
    authUrl = buildMicrosoftAuthUrl(state);
  } catch {
    return NextResponse.json({ error: "Microsoft integration not configured" }, { status: 500 });
  }

  return NextResponse.redirect(authUrl);
}

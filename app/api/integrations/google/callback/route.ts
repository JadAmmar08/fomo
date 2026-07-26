import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchGoogleEmail, saveGoogleConnection } from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/teams?google=denied`);
  }

  let anonymousUserId: string;
  let roomId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    anonymousUserId = decoded.anonymousUserId;
    roomId = decoded.roomId ?? "";
  } catch {
    return NextResponse.redirect(`${appUrl}/teams?google=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleEmail(tokens.access_token);

    await saveGoogleConnection({
      anonymousUserId,
      roomId,
      googleEmail: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });
  } catch (err) {
    console.error("[google callback] failed:", err);
    return NextResponse.redirect(`${appUrl}/teams?google=error`);
  }

  const redirectTarget = roomId ? `/teams/${roomId}?google=connected` : "/teams?google=connected";
  return NextResponse.redirect(`${appUrl}${redirectTarget}`);
}

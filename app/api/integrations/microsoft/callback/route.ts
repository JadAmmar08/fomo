import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchMicrosoftEmail, saveMicrosoftConnection } from "@/lib/microsoft";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/teams?microsoft=denied`);
  }

  let anonymousUserId: string;
  let roomId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    anonymousUserId = decoded.anonymousUserId;
    roomId = decoded.roomId;
  } catch {
    return NextResponse.redirect(`${appUrl}/teams?microsoft=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchMicrosoftEmail(tokens.access_token);

    await saveMicrosoftConnection({
      anonymousUserId,
      roomId,
      microsoftEmail: email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });
  } catch (err) {
    console.error("[microsoft callback] failed:", err);
    return NextResponse.redirect(`${appUrl}/teams?microsoft=error`);
  }

  const redirectTarget = roomId ? `/teams/${roomId}?microsoft=connected` : "/teams?microsoft=connected";
  return NextResponse.redirect(`${appUrl}${redirectTarget}`);
}

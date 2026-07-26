import { NextRequest, NextResponse } from "next/server";
import { exchangeSlackCode, saveSlackConnection } from "@/lib/slack";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/teams?slack=denied`);
  }

  let anonymousUserId: string;
  let roomId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    anonymousUserId = decoded.anonymousUserId;
    roomId = decoded.roomId;
  } catch {
    return NextResponse.redirect(`${appUrl}/teams?slack=error`);
  }

  try {
    const result = await exchangeSlackCode(code);
    await saveSlackConnection({
      roomId,
      installedBy: anonymousUserId,
      accessToken: result.access_token,
      botUserId: result.bot_user_id,
      scope: result.scope,
      teamId: result.team.id,
      teamName: result.team.name
    });
  } catch (err) {
    console.error("[slack callback] failed:", err);
    return NextResponse.redirect(`${appUrl}/teams?slack=error`);
  }

  return NextResponse.redirect(`${appUrl}/teams/${roomId}?slack=connected`);
}

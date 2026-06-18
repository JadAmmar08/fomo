import { NextRequest, NextResponse } from "next/server";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";
import { getMirror } from "@/lib/store";

export async function GET(request: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(request);
  const mirror = await getMirror(anonymousUserId);
  return attachAnonymousCookie(
    NextResponse.json({
      anonymousUserId,
      storageMode: mirror.storageMode,
      user: mirror.user
    }),
    anonymousUserId
  );
}

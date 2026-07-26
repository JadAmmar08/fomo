import { NextRequest, NextResponse } from "next/server";
import { hasGoogleConnection } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const connected = await hasGoogleConnection(anonymousUserId, roomId);
  return NextResponse.json({ connected });
}

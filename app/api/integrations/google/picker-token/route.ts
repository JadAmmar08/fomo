import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";
import { getRequestAnonymousUserId } from "@/lib/session";

// Hands the browser a short-lived Drive access token so the Google Picker (which
// runs entirely client-side) can authenticate — the same read-only, already-
// consented token used server-side elsewhere, just handed to the tab that owns it.
export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const accessToken = await getValidAccessToken(anonymousUserId, roomId);
  if (!accessToken) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  return NextResponse.json({ accessToken });
}

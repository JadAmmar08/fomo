import { NextRequest, NextResponse } from "next/server";
import { getIndividualGuidance } from "@/lib/individual-guidance";

export async function GET(req: NextRequest) {
  const anonymousUserId = req.headers.get("x-fomo-anonymous-id") ?? req.cookies.get("fomo_anonymous_id")?.value ?? "";
  if (!anonymousUserId) {
    return NextResponse.json({ guidance: null });
  }

  const guidance = await getIndividualGuidance(anonymousUserId).catch(() => null);
  return NextResponse.json({ guidance });
}

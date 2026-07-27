import { NextRequest, NextResponse } from "next/server";
import { getSourceStatuses } from "@/lib/workstream";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  const statuses = await getSourceStatuses(anonymousUserId, roomId);
  return NextResponse.json(statuses);
}

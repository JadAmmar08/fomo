import { NextRequest, NextResponse } from "next/server";
import { enableIncludeSharedFiles } from "@/lib/microsoft";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();
  const roomId = String(body.roomId ?? "");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  await enableIncludeSharedFiles(anonymousUserId, roomId);
  return NextResponse.json({ ok: true });
}

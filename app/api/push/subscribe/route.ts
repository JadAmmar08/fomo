import { NextRequest, NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const body = await req.json();

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await saveSubscription(anonymousUserId, body);
  return NextResponse.json({ ok: true });
}

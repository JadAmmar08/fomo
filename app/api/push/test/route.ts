import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";
import { getRequestAnonymousUserId } from "@/lib/session";

// Manual trigger for verifying the push pipeline end to end — not a real product
// feature, just a way to confirm a subscribed browser actually receives a push.
export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  await sendPushToUser(anonymousUserId, {
    title: "FOMO",
    body: "Push notifications are working.",
    url: "/teams"
  });
  return NextResponse.json({ ok: true });
}

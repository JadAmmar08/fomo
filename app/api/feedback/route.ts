import { NextRequest, NextResponse } from "next/server";
import { recordFeedback } from "@/lib/store";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.targetType || !body.targetId || !body.action) {
    return NextResponse.json({ error: "Missing feedback fields" }, { status: 400 });
  }

  const feedback = await recordFeedback({
    anonymousUserId: getRequestAnonymousUserId(
      request,
      typeof body.anonymousUserId === "string" ? body.anonymousUserId : undefined
    ),
    targetType: body.targetType,
    targetId: body.targetId,
    action: body.action
  });

  return attachAnonymousCookie(
    NextResponse.json(feedback, { status: 201 }),
    feedback.anonymousUserId
  );
}

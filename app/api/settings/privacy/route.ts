import { NextRequest, NextResponse } from "next/server";
import { savePrivacySettings } from "@/lib/store";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const anonymousUserId = getRequestAnonymousUserId(
    request,
    typeof body.anonymousUserId === "string" ? body.anonymousUserId : undefined
  );
  const result = await savePrivacySettings({
    ...body,
    anonymousUserId
  });
  return attachAnonymousCookie(NextResponse.json(result), anonymousUserId);
}

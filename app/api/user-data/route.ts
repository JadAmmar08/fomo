import { NextRequest, NextResponse } from "next/server";
import { destroyUserData } from "@/lib/store";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const scope = body.scope === "account" ? "account" : "local";
  const anonymousUserId = getRequestAnonymousUserId(
    request,
    typeof body.anonymousUserId === "string" ? body.anonymousUserId : undefined
  );
  const result = await destroyUserData(scope, anonymousUserId);
  return attachAnonymousCookie(NextResponse.json(result), anonymousUserId);
}

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Only clears the session cookie on this device — the account and its data are
// untouched (that's what /api/user-data DELETE is for). Signing back in with the
// same email always brings everything back.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

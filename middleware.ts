import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_HEADER,
  createAnonymousUserId
} from "@/lib/session";

export function middleware(request: NextRequest) {
  const existingAnonymousUserId =
    request.cookies.get(SESSION_COOKIE)?.value || request.headers.get(SESSION_HEADER);

  if (existingAnonymousUserId) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SESSION_HEADER, existingAnonymousUserId);
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  const anonymousUserId = createAnonymousUserId();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SESSION_HEADER, anonymousUserId);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.cookies.set(SESSION_COOKIE, anonymousUserId, {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

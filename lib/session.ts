import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "fomo_anonymous_id";
export const SESSION_HEADER = "x-fomo-anonymous-id";

export function createAnonymousUserId() {
  return `anon_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function getServerAnonymousUserId() {
  const headerStore = await headers();
  const headerValue = headerStore.get(SESSION_HEADER);
  if (headerValue) {
    return headerValue;
  }

  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? createAnonymousUserId();
}

export async function hasExistingSession() {
  const headerStore = await headers();
  if (headerStore.get(SESSION_HEADER)) return true;
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(SESSION_COOKIE)?.value);
}

export function getRequestAnonymousUserId(request: NextRequest, fallback?: string) {
  return (
    fallback ||
    request.headers.get(SESSION_HEADER) ||
    request.cookies.get(SESSION_COOKIE)?.value ||
    createAnonymousUserId()
  );
}

export function attachAnonymousCookie(response: NextResponse, anonymousUserId: string) {
  response.cookies.set(SESSION_COOKIE, anonymousUserId, {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}

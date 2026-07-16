import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { createAnonymousUserId, attachAnonymousCookie } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`login:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const redirectTo = typeof body.redirectTo === "string" && body.redirectTo.startsWith("/") ? body.redirectTo : "/teams";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  // Reuse the existing anonymous_user_id for this email if they already have an account,
  // so logging in on a new device brings back the same mirror/rooms — never a fresh identity.
  const existingRes = await pool.query(`select anonymous_user_id from accounts where email = $1`, [email]);
  let anonymousUserId: string;
  if (existingRes.rows.length > 0) {
    anonymousUserId = String(existingRes.rows[0].anonymous_user_id);
  } else {
    anonymousUserId = createAnonymousUserId();
    await pool.query(
      `insert into accounts (email, anonymous_user_id) values ($1, $2)`,
      [email, anonymousUserId]
    );
  }

  // Capture their name at login so the nav can greet them by name instead of falling back to
  // "My mirror". Update on conflict, but only when there's a real name to set and the existing
  // row still has the generic placeholder — never clobber a real name set elsewhere.
  if (name) {
    await pool.query(
      `insert into users (anonymous_user_id, name) values ($1, $2)
       on conflict (anonymous_user_id) do update set name = excluded.name
       where users.name = 'FOMO user' or users.name is null`,
      [anonymousUserId, name]
    );
  } else {
    await pool.query(
      `insert into users (anonymous_user_id, name) values ($1, 'FOMO user') on conflict (anonymous_user_id) do nothing`,
      [anonymousUserId]
    );
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  return attachAnonymousCookie(response, anonymousUserId);
}

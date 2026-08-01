import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";

// Backs the account page (nav pill -> /settings) — a single read-only snapshot of who
// this identity is: their email (if any), display name, and every team they're in.
// Deliberately doesn't expose anything about other members or connected-integration
// tokens here; this is "what does MY account look like," not a debug dump.
export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const pool = getPool();
  if (!pool) return NextResponse.json({ email: null, name: null, teams: [] });

  const [accountRes, userRes, teamsRes] = await Promise.all([
    pool.query<{ email: string }>(`select email from accounts where anonymous_user_id = $1`, [anonymousUserId]),
    pool.query<{ name: string }>(`select name from users where anonymous_user_id = $1`, [anonymousUserId]),
    pool.query<{ name: string; slug: string; role: string; type: string }>(
      `select r.name, r.slug, rm.role, r.type
       from rooms r join room_members rm on rm.room_id = r.id
       where rm.anonymous_user_id = $1 and r.is_active = true
       order by rm.joined_at desc`,
      [anonymousUserId]
    )
  ]);

  const rawName = userRes.rows[0]?.name ?? null;

  return NextResponse.json({
    email: accountRes.rows[0]?.email ?? null,
    name: rawName && rawName !== "FOMO user" ? rawName : null,
    teams: teamsRes.rows
  });
}

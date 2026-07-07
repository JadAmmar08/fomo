import { NextRequest, NextResponse } from "next/server";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";
import { getPool } from "@/lib/postgres";

export async function GET(request: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(request);

  let hasActivity = false;
  let isAccount = false;
  let name: string | null = null;
  const pool = getPool();
  if (pool) {
    const [activityRes, accountRes] = await Promise.all([
      pool.query(`select 1 from browsing_signals where anonymous_user_id = $1 limit 1`, [anonymousUserId]).catch(() => ({ rows: [] })),
      pool.query(`select email from accounts where anonymous_user_id = $1 limit 1`, [anonymousUserId]).catch(() => ({ rows: [] }))
    ]);
    hasActivity = activityRes.rows.length > 0;
    isAccount = accountRes.rows.length > 0;

    if (hasActivity || isAccount) {
      const nameRes = await pool
        .query(`select name from users where anonymous_user_id = $1 limit 1`, [anonymousUserId])
        .catch(() => ({ rows: [] }));
      const rawName = nameRes.rows[0]?.name ? String(nameRes.rows[0].name) : null;
      name = rawName && rawName !== "FOMO user" ? rawName.split(" ")[0] : null;
    }
  }

  return attachAnonymousCookie(
    NextResponse.json({
      anonymousUserId,
      storageMode: pool ? "database" : "memory",
      hasActivity,
      isAccount,
      isMember: hasActivity || isAccount,
      name
    }),
    anonymousUserId
  );
}

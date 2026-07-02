import { NextRequest, NextResponse } from "next/server";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";
import { getPool } from "@/lib/postgres";

export async function GET(request: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(request);

  let hasActivity = false;
  const pool = getPool();
  if (pool) {
    const res = await pool
      .query(`select 1 from browsing_signals where anonymous_user_id = $1 limit 1`, [anonymousUserId])
      .catch(() => ({ rows: [] }));
    hasActivity = res.rows.length > 0;
  }

  return attachAnonymousCookie(
    NextResponse.json({
      anonymousUserId,
      storageMode: pool ? "database" : "memory",
      hasActivity
    }),
    anonymousUserId
  );
}

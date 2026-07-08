import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getIndividualGuidance } from "@/lib/individual-guidance";

export async function GET(req: NextRequest) {
  const anonymousUserId = req.headers.get("x-fomo-anonymous-id") ?? req.cookies.get("fomo_anonymous_id")?.value ?? "";
  if (!anonymousUserId) {
    return NextResponse.json({ guidance: null });
  }

  const roomSlug = req.nextUrl.searchParams.get("room");
  let roomId = "";
  if (roomSlug) {
    const pool = getPool();
    if (pool) {
      const roomRes = await pool.query(`select id from rooms where slug = $1 and is_active = true`, [roomSlug]);
      if (roomRes.rows.length > 0) roomId = String(roomRes.rows[0].id);
    }
  }

  const guidance = await getIndividualGuidance(anonymousUserId, roomId).catch(() => null);
  return NextResponse.json({ guidance });
}

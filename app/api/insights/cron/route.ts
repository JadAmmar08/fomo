import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRoomWebOfIdeas } from "@/lib/room-connections";
import { getIndividualGuidance } from "@/lib/individual-guidance";

// Forces a fresh Pulse + per-member Discovery pass for every active room on a fixed
// schedule, instead of only recomputing whenever someone happens to load a page. This is
// what makes the push notifications in room-connections.ts/individual-guidance.ts actually
// ambient — a real contradiction or overlap gets caught and pushed out within one cron
// interval, not whenever the next viewer shows up (which could be hours or days later).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const roomsRes = await pool.query<{ id: string }>(`select id from rooms where is_active = true`);

  let roomsProcessed = 0;
  let membersProcessed = 0;
  const errors: string[] = [];

  for (const room of roomsRes.rows) {
    try {
      await getRoomWebOfIdeas(room.id, true);
      roomsProcessed++;
    } catch (err) {
      errors.push(`pulse ${room.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    const membersRes = await pool.query<{ anonymous_user_id: string }>(
      `select anonymous_user_id from room_members where room_id = $1`,
      [room.id]
    );
    for (const member of membersRes.rows) {
      try {
        await getIndividualGuidance(member.anonymous_user_id, room.id, true);
        membersProcessed++;
      } catch (err) {
        errors.push(`guidance ${room.id}/${member.anonymous_user_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, roomsProcessed, membersProcessed, errors });
}

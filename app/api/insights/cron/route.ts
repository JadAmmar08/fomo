import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRoomWebOfIdeas } from "@/lib/room-connections";
import { getIndividualGuidance } from "@/lib/individual-guidance";
import { renewExpiringWatches } from "@/lib/file-watch";

// Triggers Pulse + per-member Discovery on a fixed schedule instead of only whenever
// someone happens to load a page — that's what makes the push notifications in
// room-connections.ts/individual-guidance.ts actually ambient, a real contradiction or
// overlap gets caught within one cron interval instead of whenever the next viewer shows
// up (which could be hours or days later). Deliberately does NOT force-refresh: it still
// respects each function's own cache (Pulse every 4h, Discovery every 24h), so most ticks
// are a cheap cache hit and a real (paid) recompute only happens once the cache actually
// expires, on schedule rather than on someone's next visit.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.INSIGHTS_CRON_SECRET || authHeader !== `Bearer ${process.env.INSIGHTS_CRON_SECRET}`) {
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

  // Watch channels/subscriptions expire on their own schedule, independent of any
  // room's pulse/guidance cache, so this needs to run every tick regardless of what
  // else is due for recompute below.
  await renewExpiringWatches().catch((err) => errors.push(`watch renewal: ${err instanceof Error ? err.message : String(err)}`));

  for (const room of roomsRes.rows) {
    try {
      await getRoomWebOfIdeas(room.id);
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
        await getIndividualGuidance(member.anonymous_user_id, room.id);
        membersProcessed++;
      } catch (err) {
        errors.push(`guidance ${room.id}/${member.anonymous_user_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({ ok: true, roomsProcessed, membersProcessed, errors });
}

import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

// Extension-only dismiss for the in-file alert card (see app/api/live-signal/route.ts).
// A real delete, same "brush it off" semantics as unpinning elsewhere — once dismissed,
// the alert is gone for good, not just hidden client-side, so it won't reappear on the
// next poll or on the team's Discovery feed either.
export async function POST(req: NextRequest) {
  const { anonymousUserId, roomSlug, cardKey } = await req.json().catch(() => ({}));
  if (!anonymousUserId || !roomSlug || !cardKey) {
    return NextResponse.json({ error: "anonymousUserId, roomSlug, and cardKey required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  await pool.query(
    `delete from pinned_cards where anonymous_user_id = $1 and room_id = $2 and card_type = 'discovery' and card_key = $3`,
    [anonymousUserId, roomSlug, cardKey]
  );

  // Also drop the dismisser's own cached workstream digest — otherwise it can keep
  // matching future edits against the same stale fact for up to its normal 12h TTL
  // (see lib/workstream.ts) even right after they've acknowledged and moved past it.
  // getMemberWorkstreamDigest self-heals: the next read regenerates it fresh.
  await pool.query(
    `delete from member_workstream_digests where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomSlug]
  );

  return NextResponse.json({ ok: true });
}

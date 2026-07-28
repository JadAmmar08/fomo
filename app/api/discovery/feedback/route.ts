import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";

// Minimal correction signal collected in the same interaction as the handoff request,
// not a separate feature. Doesn't change behavior yet, just logs it, this is meant to
// answer "is the core matching right" before building a heavier correction UI.
export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);

  const { roomSlug, recommendationText, feedback } = await req.json().catch(() => ({}));
  if (!roomSlug || !recommendationText || (feedback !== "useful" && feedback !== "not_relevant")) {
    return NextResponse.json({ error: "roomSlug, recommendationText, and feedback ('useful'|'not_relevant') required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  await pool.query(
    `insert into guidance_feedback (anonymous_user_id, room_id, recommendation_text, feedback) values ($1, $2, $3, $4)`,
    [anonymousUserId, roomSlug, recommendationText, feedback]
  );

  return NextResponse.json({ ok: true });
}

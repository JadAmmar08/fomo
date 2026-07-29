import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";

const MAX_NOTE_LENGTH = 600;

// A person's own plain-English statement of what they're actually working on. This is
// the highest-priority signal Discovery and Pulse can get, explicit ground truth from
// the person themselves, not inferred from browsing or file content, and it's what lets
// someone with zero connected tools still get something useful out of Discovery.
export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomSlug = req.nextUrl.searchParams.get("roomSlug");
  if (!roomSlug) return NextResponse.json({ error: "roomSlug required" }, { status: 400 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const res = await pool.query<{ workstream_note: string | null }>(
    `select rm.workstream_note from room_members rm
     join rooms r on r.id = rm.room_id
     where r.slug = $1 and rm.anonymous_user_id = $2`,
    [roomSlug, anonymousUserId]
  );

  return NextResponse.json({ note: res.rows[0]?.workstream_note ?? null });
}

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const { roomSlug, note } = await req.json().catch(() => ({}));
  if (!roomSlug) return NextResponse.json({ error: "roomSlug required" }, { status: 400 });

  const trimmed = String(note ?? "").trim().slice(0, MAX_NOTE_LENGTH);

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const roomRes = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [roomSlug]);
  const roomId = roomRes.rows[0]?.id;
  if (!roomId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await pool.query(
    `update room_members set workstream_note = $1 where room_id = $2 and anonymous_user_id = $3`,
    [trimmed || null, roomId, anonymousUserId]
  );

  return NextResponse.json({ ok: true });
}

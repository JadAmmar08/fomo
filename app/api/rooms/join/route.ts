import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`join:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json();
  const inviteCode = String(body.inviteCode ?? "").trim();
  const anonymousUserId = getRequestAnonymousUserId(req, body.anonymousUserId);

  if (!inviteCode) {
    return NextResponse.json({ error: "Invite code required" }, { status: 400 });
  }

  // Find the room
  const roomRes = await pool.query(
    `SELECT id, name, slug, max_members, is_active, type FROM rooms WHERE invite_code = $1`,
    [inviteCode]
  );

  if (roomRes.rows.length === 0) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const room = roomRes.rows[0];

  if (!room.is_active) {
    return NextResponse.json({ error: "This room is no longer active" }, { status: 403 });
  }

  // Check member count
  const countRes = await pool.query(
    `SELECT count(*) FROM room_members WHERE room_id = $1`,
    [room.id]
  );
  if (parseInt(String(countRes.rows[0].count)) >= Number(room.max_members)) {
    return NextResponse.json({ error: "This room is full" }, { status: 403 });
  }

  // Join
  try {
    await pool.query(
      `INSERT INTO room_members (room_id, anonymous_user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, anonymous_user_id) DO NOTHING`,
      [room.id, anonymousUserId]
    );

    return NextResponse.json({
      ok: true,
      room: { id: room.id, name: room.name, slug: room.slug, type: room.type }
    });
  } catch {
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }
}

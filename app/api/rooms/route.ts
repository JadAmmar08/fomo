import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`rooms:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const anonymousUserId = getRequestAnonymousUserId(req, body.anonymousUserId);

  if (!name || name.length < 3) {
    return NextResponse.json({ error: "Room name must be at least 3 characters" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO rooms (name, slug, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, invite_code, created_at`,
      [name, slug, description, anonymousUserId]
    );

    const room = result.rows[0];

    // Auto-join the creator as admin
    await pool.query(
      `INSERT INTO room_members (room_id, anonymous_user_id, role)
       VALUES ($1, $2, 'admin')`,
      [room.id, anonymousUserId]
    );

    return NextResponse.json({ ok: true, room });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("unique")) {
      return NextResponse.json({ error: "A room with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const anonymousUserId = req.headers.get("x-fomo-anonymous-id") ?? req.cookies.get("fomo_anonymous_id")?.value;

  if (!anonymousUserId) {
    return NextResponse.json({ rooms: [] });
  }

  const result = await pool.query(
    `SELECT r.id, r.name, r.slug, r.description, r.invite_code, r.created_at, rm.role,
       (SELECT count(*) FROM room_members WHERE room_id = r.id) as member_count
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.anonymous_user_id = $1 AND r.is_active = true
     ORDER BY rm.joined_at DESC`,
    [anonymousUserId]
  );

  return NextResponse.json({ rooms: result.rows });
}

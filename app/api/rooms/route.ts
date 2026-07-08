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
  const type = body.type === "team" ? "team" : "room";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const anonymousUserId = getRequestAnonymousUserId(req, body.anonymousUserId);

  if (!name || name.length < 3) {
    return NextResponse.json({ error: "Name must be at least 3 characters" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO rooms (name, slug, description, created_by, type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, description, invite_code, created_at, type`,
      [name, slug, description, anonymousUserId, type]
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
      return NextResponse.json({ error: "That name is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const anonymousUserId = req.headers.get("x-fomo-anonymous-id") ?? req.cookies.get("fomo_anonymous_id")?.value;
  const typeParam = req.nextUrl.searchParams.get("type");
  const type = typeParam === "team" ? "team" : "room";

  if (!anonymousUserId) {
    return NextResponse.json({ rooms: [] });
  }

  const result = await pool.query(
    `SELECT r.id, r.name, r.slug, r.description, r.invite_code, r.created_at, r.type, rm.role,
       (SELECT count(*) FROM room_members WHERE room_id = r.id) as member_count
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.anonymous_user_id = $1 AND r.is_active = true AND r.type = $2
     ORDER BY rm.joined_at DESC`,
    [anonymousUserId, type]
  );

  return NextResponse.json({ rooms: result.rows });
}

export async function DELETE(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const anonymousUserId = req.headers.get("x-fomo-anonymous-id") ?? req.cookies.get("fomo_anonymous_id")?.value;
  if (!anonymousUserId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const roomId = req.nextUrl.searchParams.get("id");
  if (!roomId) {
    return NextResponse.json({ error: "Room id required" }, { status: 400 });
  }

  const memberRes = await pool.query(
    `select role from room_members where room_id = $1 and anonymous_user_id = $2`,
    [roomId, anonymousUserId]
  );
  if (memberRes.rows.length === 0 || memberRes.rows[0].role !== "admin") {
    return NextResponse.json({ error: "Only the team admin can delete it" }, { status: 403 });
  }

  // rooms cascades to room_members, room_connections, team_connection_history,
  // team_mirror_state, and team_mirror_shifts via foreign keys. individual_guidance
  // isn't a foreign-key relationship (room_id is a plain string there, since guidance
  // can exist without a team), so it needs its own cleanup.
  await pool.query(`delete from individual_guidance where room_id = $1`, [roomId]);
  await pool.query(`delete from rooms where id = $1`, [roomId]);

  return NextResponse.json({ ok: true });
}

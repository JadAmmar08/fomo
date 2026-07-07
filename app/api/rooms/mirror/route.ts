import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getTeamMirror } from "@/lib/team-mirror";

export async function GET(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const roomSlug = req.nextUrl.searchParams.get("room");
  if (!roomSlug) {
    return NextResponse.json({ error: "Room slug required" }, { status: 400 });
  }

  const roomRes = await pool.query(
    `SELECT id, name, type FROM rooms WHERE slug = $1 AND is_active = true`,
    [roomSlug]
  );

  if (roomRes.rows.length === 0) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const room = roomRes.rows[0];
  if (String(room.type) !== "team") {
    return NextResponse.json({ error: "Mental model is only available for teams" }, { status: 400 });
  }

  const mirror = await getTeamMirror(String(room.id)).catch(() => null);

  return NextResponse.json({
    room: { id: room.id, name: room.name },
    mirror
  });
}

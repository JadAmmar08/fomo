import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

interface StoredRecommendation {
  type: string;
  text: string;
  resourceRef?: { source: string; name: string; link: string; ownerId: string; content: string | null } | null;
}

// The one action Discovery's team_signal previously dead-ended at ("something relevant
// probably exists, go ask around"). Clicking "Request it" auto-shares the underlying item
// immediately, no owner approval gate, the owner just gets an FYI notification after the
// fact rather than a request to approve.
export async function POST(req: NextRequest) {
  const requesterId = getRequestAnonymousUserId(req);
  if (!requesterId) return NextResponse.json({ error: "Not identified" }, { status: 401 });

  const { roomSlug, recommendationText } = await req.json().catch(() => ({}));
  if (!roomSlug || !recommendationText) {
    return NextResponse.json({ error: "roomSlug and recommendationText required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const roomRes = await pool.query<{ id: string }>(`select id from rooms where slug = $1`, [roomSlug]);
  const roomId = roomRes.rows[0]?.id;
  if (!roomId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const guidanceRes = await pool.query<{ recommendations: StoredRecommendation[] }>(
    `select recommendations from individual_guidance where anonymous_user_id = $1 and room_id = $2`,
    [requesterId, roomId]
  );
  const recommendations = guidanceRes.rows[0]?.recommendations ?? [];
  const match = recommendations.find((r) => r.text === recommendationText && r.type === "team_signal");
  const resourceRef = match?.resourceRef;

  if (!resourceRef) {
    return NextResponse.json({ error: "Nothing to hand off for this recommendation" }, { status: 404 });
  }

  await pool.query(
    `insert into handoff_requests (room_id, requester_id, owner_id, source, item_name, item_link, item_content, topic)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [roomSlug, requesterId, resourceRef.ownerId, resourceRef.source, resourceRef.name, resourceRef.link, resourceRef.content, recommendationText]
  );

  sendPushToUser(resourceRef.ownerId, {
    title: "Your work was shared with a teammate",
    body: `"${resourceRef.name}" was shared to help with something a teammate is working on.`,
    url: `/teams/${roomSlug}`
  }).catch((err) => console.error("[handoff notify owner] failed:", err));

  return NextResponse.json({
    source: resourceRef.source,
    name: resourceRef.name,
    link: resourceRef.link,
    content: resourceRef.content
  });
}

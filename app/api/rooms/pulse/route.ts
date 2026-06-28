import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { buildCommunityTrends } from "@/lib/trends";
import type { BrowsingSignal } from "@/lib/types";

function mapSignal(row: Record<string, unknown>): BrowsingSignal {
  return {
    id: String(row.id),
    anonymousUserId: String(row.anonymous_user_id),
    normalizedDomain: String(row.normalized_domain),
    urlPath: String(row.url_path),
    pageTitle: String(row.page_title),
    timestampBucket: new Date(String(row.timestamp_bucket)).toISOString(),
    category: String(row.broad_category) as BrowsingSignal["category"],
    topicLabel: String(row.topic_label),
    topicTags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning),
    source: (String(row.source) as BrowsingSignal["source"]) || "extension"
  };
}

export async function GET(req: NextRequest) {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const roomSlug = req.nextUrl.searchParams.get("room");
  if (!roomSlug) {
    return NextResponse.json({ error: "Room slug required" }, { status: 400 });
  }

  // Verify room exists
  const roomRes = await pool.query(
    `SELECT id, name FROM rooms WHERE slug = $1 AND is_active = true`,
    [roomSlug]
  );

  if (roomRes.rows.length === 0) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const room = roomRes.rows[0];

  // Get signals only from room members
  const signalsRes = await pool.query(
    `SELECT DISTINCT ON (bs.anonymous_user_id, bs.topic_label) bs.*
     FROM browsing_signals bs
     JOIN room_members rm ON rm.anonymous_user_id = bs.anonymous_user_id
     JOIN privacy_settings ps ON ps.anonymous_user_id = bs.anonymous_user_id
     WHERE rm.room_id = $1
       AND bs.timestamp_bucket >= now() - interval '48 hours'
       AND ps.tracking_paused = false
       AND bs.broad_category = any(ps.shareable_categories)
       AND bs.normalized_domain NOT IN ('instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net', 'docs.google.com', 'drive.google.com', 'calendar.google.com', 'accounts.google.com')
       AND bs.url_path NOT LIKE '/shorts%'
     ORDER BY bs.anonymous_user_id, bs.topic_label, bs.timestamp_bucket DESC
     LIMIT 2000`,
    [room.id]
  );

  const trends = buildCommunityTrends(signalsRes.rows.map(mapSignal));

  return NextResponse.json({
    room: { id: room.id, name: room.name },
    trends,
    generatedAt: new Date().toISOString()
  });
}

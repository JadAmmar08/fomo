import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { isJunkLabel } from "@/lib/trends";

const RETENTION_DAYS = 14;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Delete anything older than the retention window — nothing downstream reads past 14 days
  const staleRes = await pool.query(
    `delete from browsing_signals where timestamp_bucket < now() - interval '${RETENTION_DAYS} days' returning id`
  );

  // Junk labels can show up at any age — sweep them out regardless of retention
  const candidatesRes = await pool.query(
    `select id, topic_label from browsing_signals where timestamp_bucket >= now() - interval '${RETENTION_DAYS} days'`
  );
  const junkIds = candidatesRes.rows
    .filter((row) => isJunkLabel(String(row.topic_label)))
    .map((row) => row.id);

  let junkDeleted = 0;
  if (junkIds.length > 0) {
    const junkRes = await pool.query(
      `delete from browsing_signals where id = any($1::uuid[]) returning id`,
      [junkIds]
    );
    junkDeleted = junkRes.rows.length;
  }

  return NextResponse.json({
    ok: true,
    staleDeleted: staleRes.rows.length,
    junkDeleted
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { processFileChange } from "@/lib/file-watch";
import { rateLimit } from "@/lib/rate-limit";

// On-demand trigger for the same detection pipeline the Microsoft webhook uses —
// called from the Excel task pane's worksheet.onChanged handler so a real conflict
// can surface within seconds of the edit instead of waiting on Graph's webhook
// delivery (observed 5-40+ seconds). Awaited and returned directly (not fire-and-
// forget) so the client can act on the result immediately — render the alert and
// highlight the conflicting cell right away — instead of waiting up to 5s for the
// next poll tick to pick up whatever this wrote to pinned_cards.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const anonymousUserId = String(body.anonymousUserId ?? "");
  const fileName = String(body.fileName ?? "");
  if (!anonymousUserId || !fileName) {
    return NextResponse.json({ error: "anonymousUserId and fileName required" }, { status: 400 });
  }

  // worksheet.onChanged can fire multiple times in quick succession during a paste
  // or fill, and each call here triggers real Anthropic calls, not a cache read —
  // unlike the plain poll/dismiss routes, this genuinely needs a limit.
  if (!rateLimit(`live-signal-check-now:${anonymousUserId}`, 1, 8000)) {
    return NextResponse.json({ ok: true, skipped: "rate_limited" });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ ok: true, alert: null });

  const res = await pool.query<{ room_id: string; file_id: string; last_content_hash: string | null }>(
    `select room_id, file_id, last_content_hash from file_watch_channels
     where provider = 'microsoft' and anonymous_user_id = $1 and file_name = $2
     order by updated_at desc limit 1`,
    [anonymousUserId, fileName]
  );
  const row = res.rows[0];
  if (!row) return NextResponse.json({ ok: true, skipped: "not_linked", alert: null });

  const result = await processFileChange("microsoft", anonymousUserId, row.room_id, row.file_id, fileName, row.last_content_hash, null).catch((err) => {
    console.error("[live-signal check-now] failed:", err);
    return null;
  });

  return NextResponse.json({ ok: true, alert: result });
}

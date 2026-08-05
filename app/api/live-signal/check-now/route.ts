import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { processFileChange } from "@/lib/file-watch";
import { rateLimit } from "@/lib/rate-limit";

// On-demand trigger for the same detection pipeline the Microsoft webhook uses —
// called from the Excel task pane's worksheet.onChanged handler so a real conflict
// can surface within seconds of the edit instead of waiting on Graph's webhook
// delivery (observed 5-40+ seconds). Fire-and-forget from the client's perspective:
// the existing 5s poll already surfaces whatever this writes to pinned_cards, so
// this doesn't need to return the check's result inline.
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
  if (!pool) return NextResponse.json({ ok: true });

  const res = await pool.query<{ room_id: string; file_id: string; last_content_hash: string | null }>(
    `select room_id, file_id, last_content_hash from file_watch_channels
     where provider = 'microsoft' and anonymous_user_id = $1 and file_name = $2
     order by updated_at desc limit 1`,
    [anonymousUserId, fileName]
  );
  const row = res.rows[0];
  if (!row) return NextResponse.json({ ok: true, skipped: "not_linked" });

  processFileChange("microsoft", anonymousUserId, row.room_id, row.file_id, fileName, row.last_content_hash, null).catch((err) =>
    console.error("[live-signal check-now] failed:", err)
  );

  return NextResponse.json({ ok: true });
}

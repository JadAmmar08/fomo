import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { processFileChange, extractFactsFromCells, checkFactsForConflict } from "@/lib/file-watch";
import { cellsFromGrid } from "@/lib/microsoft";
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
  const sheetName = body.sheetName ? String(body.sheetName) : null;
  const grid = Array.isArray(body.grid) ? (body.grid as string[][]) : null;
  if (!anonymousUserId || !fileName) {
    return NextResponse.json({ error: "anonymousUserId and fileName required" }, { status: 400 });
  }

  // worksheet.onChanged can fire multiple times in quick succession during a paste
  // or fill, and each call here triggers real Anthropic calls, not a cache read —
  // unlike the plain poll/dismiss routes, this genuinely needs a limit. 4s (not
  // the original 8s) since the client-grid fast path below has no Graph
  // download/parse step anymore, so back-to-back real edits round-trip faster —
  // 8s was silently dropping genuine follow-up edits, surfacing client-side as an
  // indistinguishable "alert=false" with no real check having run at all.
  if (!rateLimit(`live-signal-check-now:${anonymousUserId}`, 1, 4000)) {
    return NextResponse.json({ ok: true, skipped: "rate_limited", alert: null });
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

  let result: Awaited<ReturnType<typeof processFileChange>>;
  if (grid && sheetName) {
    // Fast path: the client sends its own just-committed cell values directly
    // (Office.js has them locally the instant onChanged fires) instead of us
    // re-downloading the file via Graph. Confirmed live: a check right after an
    // edit could still read the file's PREVIOUS content, because OneDrive hadn't
    // finished syncing the browser's edit to the backend Graph reads from yet —
    // a real race, not a timing tune. Reading straight from the client instead of
    // through that cloud round-trip removes the race entirely, and is also
    // faster (no download + ExcelJS parse). Whole-text fallback isn't available
    // on this path (no full-file "content" from the client) — an edit whose
    // structured extraction finds nothing still gets caught by the next webhook
    // delivery, same safety net as before.
    result = await extractFactsFromCells(cellsFromGrid(sheetName, grid), fileName)
      .then((facts) => checkFactsForConflict(anonymousUserId, row.room_id, "microsoft", row.file_id, fileName, facts))
      .catch((err) => {
        console.error("[live-signal check-now] client-grid path failed:", err);
        return [];
      });
  } else {
    result = await processFileChange("microsoft", anonymousUserId, row.room_id, row.file_id, fileName, row.last_content_hash, null).catch((err) => {
      console.error("[live-signal check-now] failed:", err);
      return [];
    });
  }

  return NextResponse.json({ ok: true, alerts: result });
}

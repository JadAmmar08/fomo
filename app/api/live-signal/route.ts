import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

// Polled by both in-file surfaces: the Chrome extension's content script (Google
// Docs/Sheets/Slides, matched by Drive/Graph file id, see extension/content.js) and
// the Word/Excel desktop task pane add-in (public/office-addin), which has no
// reliable client-side file id for a locally-open document and matches by file name
// instead. Deliberately takes anonymousUserId as an explicit param rather than the
// usual session cookie, since a cross-origin content script fetch has no first-party
// FOMO cookie to send.
export async function GET(req: NextRequest) {
  const anonymousUserId = req.nextUrl.searchParams.get("anonymousUserId");
  const fileId = req.nextUrl.searchParams.get("fileId");
  const fileName = req.nextUrl.searchParams.get("fileName");
  if (!anonymousUserId || (!fileId && !fileName)) {
    return NextResponse.json({ error: "anonymousUserId and either fileId or fileName required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ alert: null });

  const res = await pool.query<{ room_id: string; card_key: string; card_data: { text: string; conflictKind: string } }>(
    fileId
      ? `select room_id, card_key, card_data from pinned_cards
         where anonymous_user_id = $1 and card_type = 'discovery' and card_data->>'sourceFileId' = $2
         order by pinned_at desc limit 1`
      : `select room_id, card_key, card_data from pinned_cards
         where anonymous_user_id = $1 and card_type = 'discovery' and card_data->'sourceTopics' ? $2
         order by pinned_at desc limit 1`,
    [anonymousUserId, fileId ?? fileName]
  );
  const row = res.rows[0];
  if (!row) return NextResponse.json({ alert: null });

  return NextResponse.json({
    alert: {
      roomSlug: row.room_id,
      cardKey: row.card_key,
      text: row.card_data.text,
      conflictKind: row.card_data.conflictKind
    }
  });
}

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

  const res = await pool.query<{ room_id: string; card_key: string; card_data: { text: string; conflictKind: string; sourceTopics?: string[]; sourceLocations?: Record<string, string> } }>(
    fileId
      ? `select room_id, card_key, card_data from pinned_cards
         where anonymous_user_id = $1 and card_type = 'discovery' and card_data->>'sourceFileId' = $2
         order by pinned_at desc limit 10`
      : `select room_id, card_key, card_data from pinned_cards
         where anonymous_user_id = $1 and card_type = 'discovery' and card_data->'sourceTopics' ? $2
         order by pinned_at desc limit 10`,
    [anonymousUserId, fileId ?? fileName]
  );

  // sourceLocations is keyed by file name, one cell address per file involved in
  // the conflict — pick the one for whichever file is actually polling, so a
  // cell highlight (client-side) always targets the right sheet/coordinate.
  // The "other" file/location involved in the conflict, so the client can show
  // exactly where the conflicting value lives elsewhere without navigating away —
  // whichever entry in sourceTopics isn't the file currently polling.
  const alerts = res.rows.map((row) => {
    const otherFile = fileName ? row.card_data.sourceTopics?.find((t) => t !== fileName) : undefined;
    return {
      roomSlug: row.room_id,
      cardKey: row.card_key,
      text: row.card_data.text,
      conflictKind: row.card_data.conflictKind,
      location: fileName ? row.card_data.sourceLocations?.[fileName] : undefined,
      otherFile: otherFile ?? undefined,
      otherLocation: otherFile ? row.card_data.sourceLocations?.[otherFile] : undefined
    };
  });

  return NextResponse.json({ alerts });
}

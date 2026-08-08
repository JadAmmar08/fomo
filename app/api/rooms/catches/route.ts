import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

// Room-wide feed of live detection results (contradictions/duplicates FOMO has
// actually caught), for the team page. pinned_cards is scoped per
// anonymous_user_id (a conflict is pinned for every owner involved, see
// checkFactsForConflict in lib/file-watch.ts), so the same card_key can appear
// under multiple owners — dedupe by card_key here since the team page shows
// one shared feed, not a per-person one.
export async function GET(req: NextRequest) {
  const roomSlug = req.nextUrl.searchParams.get("room");
  if (!roomSlug) return NextResponse.json({ error: "room required" }, { status: 400 });

  const pool = getPool();
  if (!pool) return NextResponse.json({ catches: [] });

  const res = await pool.query<{
    card_key: string;
    card_data: { text: string; conflictKind: "contradiction" | "duplicate"; sourceTopics: string[] };
    pinned_at: string;
  }>(
    `select distinct on (card_key) card_key, card_data, pinned_at
     from pinned_cards
     where room_id = $1 and card_type = 'discovery'
       and (card_key like 'fact_conflict:%' or card_key like 'team_signal:%')
     order by card_key, pinned_at desc
     limit 30`,
    [roomSlug]
  );

  const catches = res.rows
    .map((row) => ({
      cardKey: row.card_key,
      text: row.card_data.text,
      conflictKind: row.card_data.conflictKind,
      files: row.card_data.sourceTopics ?? [],
      pinnedAt: row.pinned_at
    }))
    .sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime());

  return NextResponse.json({ catches });
}

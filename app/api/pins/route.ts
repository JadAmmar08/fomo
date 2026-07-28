import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";

type CardType = "pulse" | "discovery" | "mirror";
const CARD_TYPES: CardType[] = ["pulse", "discovery", "mirror"];

// Lets any Pulse connection, Discovery recommendation, or Mirror card be pinned so it
// stays visible across recomputes even if a future pass doesn't reproduce it. card_data
// holds the full card content, since these cards don't otherwise have a stable row/id to
// reference once they drop out of the live computed set.
export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomSlug = req.nextUrl.searchParams.get("roomSlug");
  const cardType = req.nextUrl.searchParams.get("cardType") as CardType | null;
  const cardKey = req.nextUrl.searchParams.get("cardKey");
  if (!roomSlug || !cardType || !CARD_TYPES.includes(cardType)) {
    return NextResponse.json({ error: "roomSlug and valid cardType required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  if (cardKey) {
    const res = await pool.query(
      `select 1 from pinned_cards where anonymous_user_id = $1 and room_id = $2 and card_type = $3 and card_key = $4`,
      [anonymousUserId, roomSlug, cardType, cardKey]
    );
    return NextResponse.json({ pinned: res.rows.length > 0 });
  }

  const res = await pool.query<{ card_key: string; card_data: unknown }>(
    `select card_key, card_data from pinned_cards where anonymous_user_id = $1 and room_id = $2 and card_type = $3`,
    [anonymousUserId, roomSlug, cardType]
  );
  return NextResponse.json({ pins: res.rows.map((r) => ({ cardKey: r.card_key, cardData: r.card_data })) });
}

export async function POST(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const { roomSlug, cardType, cardKey, cardData } = await req.json().catch(() => ({}));
  if (!roomSlug || !cardType || !CARD_TYPES.includes(cardType) || !cardKey || !cardData) {
    return NextResponse.json({ error: "roomSlug, valid cardType, cardKey, and cardData required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  await pool.query(
    `insert into pinned_cards (anonymous_user_id, room_id, card_type, card_key, card_data)
     values ($1, $2, $3, $4, $5)
     on conflict (anonymous_user_id, room_id, card_type, card_key) do update set card_data = excluded.card_data`,
    [anonymousUserId, roomSlug, cardType, cardKey, JSON.stringify(cardData)]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const { roomSlug, cardType, cardKey } = await req.json().catch(() => ({}));
  if (!roomSlug || !cardType || !CARD_TYPES.includes(cardType) || !cardKey) {
    return NextResponse.json({ error: "roomSlug, valid cardType, and cardKey required" }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  await pool.query(
    `delete from pinned_cards where anonymous_user_id = $1 and room_id = $2 and card_type = $3 and card_key = $4`,
    [anonymousUserId, roomSlug, cardType, cardKey]
  );

  return NextResponse.json({ ok: true });
}

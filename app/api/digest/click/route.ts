import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") ?? "pulse";
  const userId = req.nextUrl.searchParams.get("uid") ?? "unknown";

  const pool = getPool();
  if (pool) {
    pool.query(
      `insert into digest_clicks (anonymous_user_id, destination, clicked_at)
       values ($1, $2, now())`,
      [userId, to]
    ).catch(() => {});
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.net";
  const destination = to === "mirror" ? `${appUrl}/mirror` : `${appUrl}/rooms`;

  return NextResponse.redirect(destination);
}

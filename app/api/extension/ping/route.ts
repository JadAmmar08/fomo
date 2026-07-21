import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const anonymousUserId = typeof body.anonymousUserId === "string" ? body.anonymousUserId : null;
  const extensionVersion = typeof body.extensionVersion === "string" ? body.extensionVersion : null;

  if (!anonymousUserId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pool = getPool();
  if (pool) {
    await pool
      .query(
        `insert into extension_pings (anonymous_user_id, extension_version) values ($1, $2)`,
        [anonymousUserId, extensionVersion]
      )
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}

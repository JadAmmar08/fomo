import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";
import { attachAnonymousCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.co";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_token`);
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.redirect(`${appUrl}/login?error=unavailable`);
  }

  const tokenRes = await pool.query(
    `select anonymous_user_id, redirect_to, expires_at, used_at from magic_link_tokens where token = $1`,
    [token]
  );

  if (tokenRes.rows.length === 0) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_link`);
  }

  const row = tokenRes.rows[0];
  if (row.used_at) {
    return NextResponse.redirect(`${appUrl}/login?error=link_used`);
  }
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    return NextResponse.redirect(`${appUrl}/login?error=link_expired`);
  }

  await pool.query(`update magic_link_tokens set used_at = now() where token = $1`, [token]);

  const redirectTo = typeof row.redirect_to === "string" && row.redirect_to.startsWith("/") ? row.redirect_to : "/mirror";
  const response = NextResponse.redirect(`${appUrl}${redirectTo}`);
  return attachAnonymousCookie(response, String(row.anonymous_user_id));
}

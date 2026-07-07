import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getPool } from "@/lib/postgres";
import { createAnonymousUserId } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

let resend: Resend | null = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`magic-link:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const pool = getPool();
  const resendClient = getResend();
  if (!pool || !resendClient) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "/mirror";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  // Reuse the existing anonymous_user_id for this email if they already have an account,
  // so logging in on a new device brings back the same mirror/rooms — never a fresh identity.
  const existingRes = await pool.query(`select anonymous_user_id from accounts where email = $1`, [email]);
  let anonymousUserId: string;
  if (existingRes.rows.length > 0) {
    anonymousUserId = String(existingRes.rows[0].anonymous_user_id);
  } else {
    anonymousUserId = createAnonymousUserId();
    await pool.query(
      `insert into accounts (email, anonymous_user_id) values ($1, $2)`,
      [email, anonymousUserId]
    );
  }

  // Capture their name at login so the nav can greet them by name instead of falling back to
  // "My mirror" — on conflict do nothing so this never overwrites a name set elsewhere.
  await pool.query(
    `insert into users (anonymous_user_id, name) values ($1, $2) on conflict (anonymous_user_id) do nothing`,
    [anonymousUserId, name || "FOMO user"]
  );

  const token = createAnonymousUserId().replace("anon_", "link_");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    `insert into magic_link_tokens (token, email, anonymous_user_id, redirect_to, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [token, email, anonymousUserId, redirectTo, expiresAt]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.co";
  const link = `${appUrl}/api/auth/verify?token=${token}`;

  await resendClient.emails.send({
    from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
    to: email,
    subject: "Your FOMO sign-in link",
    html: `
      <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;background:#f7f6f3;color:#1a1a18;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#1a6b5a;display:inline-block;"></span>
          <span style="font-family:Georgia,serif;font-size:1.1rem;">FOMO</span>
        </div>
        <p style="font-size:1.1rem;line-height:1.6;margin:0 0 28px;">Click below to sign in. This link expires in 15 minutes.</p>
        <a href="${link}" style="display:inline-block;padding:14px 26px;background:#1a1a18;color:#f7f6f3;border-radius:999px;text-decoration:none;font-weight:500;font-size:0.9rem;">
          Sign in to FOMO →
        </a>
        <p style="color:rgba(26,26,24,0.4);font-size:0.8rem;margin-top:32px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  });

  return NextResponse.json({ ok: true });
}

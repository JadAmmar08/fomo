import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getPool } from "@/lib/postgres";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Store in DB if available
  const pool = getPool();
  if (pool) {
    try {
      await pool.query(
        `insert into waitlist (email, name) values ($1, $2) on conflict (email) do nothing`,
        [email.toLowerCase().trim(), name?.trim() ?? null]
      );
    } catch {
      // Table may not exist yet — non-fatal
    }
  }

  // Send welcome email if Resend is configured
  if (process.env.RESEND_API_KEY) {
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const result = await resend.emails.send({
      from: `FOMO <${fromAddress}>`,
      to: email,
      subject: "You're on the FOMO waitlist",
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d0f;color:#f0ede8;">
          <div style="width:20px;height:20px;border-radius:50%;border:3px solid #3ab8aa;margin-bottom:24px;"></div>
          <h1 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.04em;margin:0 0 12px;">You're in.</h1>
          <p style="color:rgba(240,237,232,0.55);line-height:1.6;margin:0 0 24px;">
            Thanks for signing up for FOMO${name ? `, ${name.split(" ")[0]}` : ""}. We're building something that helps you know what matters before everyone else does.
          </p>
          <p style="color:rgba(240,237,232,0.55);line-height:1.6;margin:0 0 24px;">
            While you wait, install the browser extension and start building your mirror. The longer it runs, the sharper your picture gets.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/download" style="display:inline-block;padding:12px 20px;background:#3ab8aa;color:white;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.9rem;">
            Get the extension
          </a>
          <p style="color:rgba(240,237,232,0.28);font-size:0.8rem;margin-top:32px;">FOMO · Attention network</p>
        </div>
      `
    });
    if (result.error) {
      console.error("[waitlist] Resend error:", result.error);
    }
  }

  return NextResponse.json({ ok: true });
}

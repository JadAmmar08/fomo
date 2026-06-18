import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getPool } from "@/lib/postgres";
import { buildCommunityTrends } from "@/lib/trends";

let resend: Resend | null = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function digestHtml(recipientName: string, trends: Array<{ topicLabel: string; category: string; changePct: number; anonymousSignals: number; explanation: string }>) {
  const trendRows = trends.slice(0, 5).map((t) => `
    <div style="padding:16px;border-radius:12px;background:#1e1e21;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <strong style="color:#f0ede8;font-size:1rem;">${t.topicLabel}</strong>
        <span style="color:#3ab8aa;font-weight:700;font-size:0.9rem;flex-shrink:0;margin-left:12px;">+${Math.round(t.changePct)}%</span>
      </div>
      <p style="color:rgba(240,237,232,0.5);font-size:0.85rem;margin:0;line-height:1.5;">${t.explanation}</p>
    </div>
  `).join("");

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0d0f;color:#f0ede8;">
      <div style="width:20px;height:20px;border-radius:50%;border:3px solid #3ab8aa;margin-bottom:28px;"></div>

      <p style="color:rgba(240,237,232,0.45);font-size:0.85rem;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;">Weekly digest</p>
      <h1 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.04em;margin:0 0 8px;">What your communities noticed this week.</h1>
      <p style="color:rgba(240,237,232,0.5);margin:0 0 28px;line-height:1.6;">
        ${recipientName ? `Hey ${recipientName.split(" ")[0]}, here` : "Here"} are the topics gaining momentum in your communities right now.
      </p>

      ${trends.length > 0 ? trendRows : `
        <div style="padding:24px;border-radius:12px;background:#1e1e21;border:1px solid rgba(255,255,255,0.07);text-align:center;">
          <p style="color:rgba(240,237,232,0.45);margin:0;">Not enough signal yet. Keep browsing with the extension active.</p>
        </div>
      `}

      <div style="margin-top:28px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/pulse" style="display:inline-block;padding:12px 20px;background:#3ab8aa;color:white;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.9rem;">
          See full pulse
        </a>
      </div>

      <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);">
        <p style="color:rgba(240,237,232,0.25);font-size:0.75rem;margin:0;">
          FOMO · Attention network · <a href="${process.env.NEXT_PUBLIC_APP_URL}/mirror" style="color:rgba(240,237,232,0.4);">View your mirror</a>
        </p>
      </div>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.DIGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendClient = getResend();
  if (!resendClient) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  // Get all users with emails from waitlist
  const usersRes = await pool.query(`select email, name from waitlist where email is not null`).catch(() => ({ rows: [] }));
  const users = usersRes.rows as Array<{ email: string; name: string | null }>;

  if (users.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No users to send to" });
  }

  // Get community-wide trends for the digest
  const signalsRes = await pool.query(`
    select bs.* from browsing_signals bs
    join privacy_settings ps on ps.anonymous_user_id = bs.anonymous_user_id
    where bs.timestamp_bucket >= now() - interval '7 days'
      and ps.tracking_paused = false
      and bs.broad_category = any(ps.shareable_categories)
    order by bs.timestamp_bucket desc
    limit 5000
  `).catch(() => ({ rows: [] }));

  const trends = buildCommunityTrends(signalsRes.rows as Parameters<typeof buildCommunityTrends>[0]);

  let sent = 0;
  for (const user of users) {
    const result = await resendClient.emails.send({
      from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: user.email,
      subject: "What your communities noticed this week",
      html: digestHtml(user.name ?? "", trends)
    });
    if (!result.error) sent++;
  }

  return NextResponse.json({ ok: true, sent, total: users.length });
}

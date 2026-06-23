import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getPool } from "@/lib/postgres";
import { buildCommunityTrends } from "@/lib/trends";
import type { BrowsingSignal } from "@/lib/types";

let resend: Resend | null = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function mapSignal(row: Record<string, unknown>): BrowsingSignal {
  return {
    id: String(row.id),
    anonymousUserId: String(row.anonymous_user_id),
    normalizedDomain: String(row.normalized_domain),
    urlPath: String(row.url_path),
    pageTitle: String(row.page_title),
    timestampBucket: new Date(String(row.timestamp_bucket)).toISOString(),
    category: String(row.broad_category) as BrowsingSignal["category"],
    topicLabel: String(row.topic_label),
    topicTags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning),
    source: (String(row.source) as BrowsingSignal["source"]) || "extension"
  };
}

function personalizedDigestHtml(
  recipientName: string,
  userCategories: string[],
  relevantTrends: Array<{ topicLabel: string; category: string; changePct: number; anonymousSignals: number; uniqueUsers: number }>,
  communityTrends: Array<{ topicLabel: string; category: string; changePct: number; anonymousSignals: number; uniqueUsers: number }>
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.co";
  const greeting = recipientName ? `Hey ${recipientName.split(" ")[0]}` : "Hey";

  const trendRow = (t: { topicLabel: string; category: string; uniqueUsers: number }) => `
    <div style="padding:14px 16px;border-radius:10px;background:#1e1e21;border:1px solid rgba(255,255,255,0.07);margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="color:#f0ede8;font-size:0.95rem;">${t.topicLabel}</strong>
        <span style="color:#3ab8aa;font-size:0.8rem;flex-shrink:0;margin-left:12px;">${t.uniqueUsers} ${t.uniqueUsers === 1 ? "person" : "people"}</span>
      </div>
      <span style="color:rgba(240,237,232,0.35);font-size:0.75rem;">${t.category}</span>
    </div>
  `;

  const forYouSection = relevantTrends.length > 0 ? `
    <p style="color:#3ab8aa;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Based on your interests</p>
    <p style="color:rgba(240,237,232,0.5);font-size:0.9rem;margin:0 0 16px;line-height:1.5;">
      People with similar attention patterns to yours were into these topics:
    </p>
    ${relevantTrends.slice(0, 5).map(trendRow).join("")}
  ` : "";

  const communitySection = communityTrends.length > 0 ? `
    <p style="color:rgba(240,237,232,0.45);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;margin:24px 0 12px;">Trending across the community</p>
    ${communityTrends.slice(0, 3).map(trendRow).join("")}
  ` : "";

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0d0f;color:#f0ede8;">
      <div style="width:20px;height:20px;border-radius:50%;border:3px solid #3ab8aa;margin-bottom:28px;"></div>

      <h1 style="font-size:1.4rem;font-weight:800;letter-spacing:-0.03em;margin:0 0 8px;">Your attention briefing</h1>
      <p style="color:rgba(240,237,232,0.5);margin:0 0 28px;line-height:1.6;">
        ${greeting}, here's what people like you were paying attention to.
      </p>

      ${forYouSection}
      ${communitySection}

      ${relevantTrends.length === 0 && communityTrends.length === 0 ? `
        <div style="padding:24px;border-radius:12px;background:#1e1e21;border:1px solid rgba(255,255,255,0.07);text-align:center;">
          <p style="color:rgba(240,237,232,0.45);margin:0;">Not enough signal yet. Keep browsing with the extension active.</p>
        </div>
      ` : ""}

      <div style="margin-top:28px;">
        <a href="${appUrl}/pulse" style="display:inline-block;padding:12px 20px;background:#3ab8aa;color:white;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.9rem;margin-right:8px;">
          See full pulse
        </a>
        <a href="${appUrl}/mirror" style="display:inline-block;padding:12px 20px;background:transparent;color:#3ab8aa;border:1px solid #3ab8aa;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.9rem;">
          Your mirror
        </a>
      </div>

      <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);">
        <p style="color:rgba(240,237,232,0.25);font-size:0.75rem;margin:0;">
          FOMO · Your attention briefing · <a href="${appUrl}/privacy" style="color:rgba(240,237,232,0.35);">Privacy</a>
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

  // Get users who have both an email and an anonymous_user_id
  const usersRes = await pool.query(
    `select w.email, w.name, w.anonymous_user_id
     from waitlist w
     where w.email is not null and w.anonymous_user_id is not null`
  ).catch(() => ({ rows: [] }));
  const users = usersRes.rows as Array<{ email: string; name: string | null; anonymous_user_id: string }>;

  if (users.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No users with linked emails" });
  }

  // Get all community signals from last 48h for trends
  const allSignalsRes = await pool.query(`
    select distinct on (bs.anonymous_user_id, bs.topic_label) bs.*
    from browsing_signals bs
    join privacy_settings ps on ps.anonymous_user_id = bs.anonymous_user_id
    where bs.timestamp_bucket >= now() - interval '48 hours'
      and ps.tracking_paused = false
      and bs.broad_category = any(ps.shareable_categories)
      and bs.normalized_domain not in ('instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net', 'docs.google.com', 'drive.google.com', 'calendar.google.com', 'accounts.google.com')
    order by bs.anonymous_user_id, bs.topic_label, bs.timestamp_bucket desc
    limit 2000
  `).catch(() => ({ rows: [] }));

  const allSignals = allSignalsRes.rows.map(mapSignal);
  const communityTrends = buildCommunityTrends(allSignals);

  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    // Get this user's top categories (their interests)
    const userSignalsRes = await pool.query(
      `select broad_category, count(*) as cnt
       from browsing_signals
       where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '7 days'
       group by broad_category
       order by cnt desc
       limit 5`,
      [user.anonymous_user_id]
    ).catch(() => ({ rows: [] }));

    const userCategories = userSignalsRes.rows.map((r: Record<string, unknown>) => String(r.broad_category));

    // Skip users without enough signals to have a mirror
    if (userCategories.length === 0) continue;

    // Find trends that match this user's categories but aren't from them
    const relevantTrends = communityTrends.filter(t =>
      userCategories.includes(t.category)
    );

    // Get community trends that DON'T match their categories (discovery)
    const discoveryTrends = communityTrends.filter(t =>
      !userCategories.includes(t.category)
    );

    const result = await resendClient.emails.send({
      from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: user.email,
      subject: `${relevantTrends[0]?.topicLabel ?? "What your community noticed"} — and ${communityTrends.length - 1} more`,
      html: personalizedDigestHtml(
        user.name ?? "",
        userCategories,
        relevantTrends,
        discoveryTrends
      )
    });

    if (result.error) {
      errors.push(`${user.email}: ${result.error.message}`);
    } else {
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent, total: users.length, errors: errors.length > 0 ? errors : undefined });
}

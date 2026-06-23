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

const JUNK_WORDS = new Set([
  "login", "sign in", "sign up", "signup", "account", "password", "checkout",
  "settings", "dashboard", "homepage", "home", "profile", "check-in",
  "submission", "submit", "problem set", "office hours", "microsoft",
  "google", "chrome", "extension", "developer", "vercel", "deployment",
  "resend", "email", "domain", "graphing calculator", "calculator",
  "streaming service", "profile selection", "cookie", "notification"
]);

function isJunkTrend(label: string): boolean {
  const lower = label.toLowerCase();
  return Array.from(JUNK_WORDS).some(w => lower.includes(w));
}

async function curateWithHaiku(
  userTopics: string[],
  candidates: Array<{ topicLabel: string; category: string; uniqueUsers: number }>
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || candidates.length === 0) return candidates.map(c => c.topicLabel);

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `You pick which trending topics are genuinely interesting and relevant for a specific person. You are extremely selective — only pick topics that would make this person say "oh that's interesting, I should check that out." Never pick generic, boring, or utility topics (logins, settings, tools, calculators). Return ONLY the topic labels you'd send, one per line. If nothing is good enough, return NONE.`,
      messages: [{
        role: "user",
        content: `This person's top interests based on their browsing:\n${userTopics.slice(0, 10).join("\n")}\n\nCandidate trending topics from their community:\n${candidates.map(c => `- ${c.topicLabel} (${c.category}, ${c.uniqueUsers} people)`).join("\n")}\n\nWhich of these candidates would this person actually find interesting? Be very selective. Max 5.`
      }]
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    if (text.trim() === "NONE") return [];
    return text.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  } catch {
    return candidates.slice(0, 3).map(c => c.topicLabel);
  }
}

function digestHtml(
  recipientName: string,
  trends: Array<{ topicLabel: string; category: string; uniqueUsers: number }>
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.co";
  const greeting = recipientName ? `Hey ${recipientName.split(" ")[0]}` : "Hey";

  const trendRows = trends.map(t => `
    <div style="padding:16px 18px;border-radius:10px;background:#1e1e21;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="color:#f0ede8;font-size:1rem;">${t.topicLabel}</strong>
        <span style="color:#3ab8aa;font-size:0.85rem;flex-shrink:0;margin-left:12px;">${t.uniqueUsers} ${t.uniqueUsers === 1 ? "person" : "people"}</span>
      </div>
      <span style="color:rgba(240,237,232,0.35);font-size:0.78rem;">${t.category}</span>
    </div>
  `).join("");

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0d0f;color:#f0ede8;">
      <div style="width:20px;height:20px;border-radius:50%;border:3px solid #3ab8aa;margin-bottom:28px;"></div>
      <h1 style="font-size:1.4rem;font-weight:800;letter-spacing:-0.03em;margin:0 0 8px;">Your attention briefing</h1>
      <p style="color:rgba(240,237,232,0.5);margin:0 0 6px;line-height:1.6;">
        ${greeting}, people in your community were paying attention to this:
      </p>
      <p style="color:rgba(240,237,232,0.35);font-size:0.85rem;margin:0 0 24px;">Based on your mirror profile</p>
      ${trendRows}
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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  const usersRes = await pool.query(`
    select w.email, w.name, w.anonymous_user_id
    from waitlist w
    where w.email is not null
      and w.anonymous_user_id is not null
      and (select count(*) from browsing_signals bs where bs.anonymous_user_id = w.anonymous_user_id) >= 5
  `).catch(() => ({ rows: [] }));
  const users = usersRes.rows as Array<{ email: string; name: string | null; anonymous_user_id: string }>;

  if (users.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No eligible users" });
  }

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
  const communityTrends = buildCommunityTrends(allSignals)
    .filter(t => !isJunkTrend(t.topicLabel));

  let sent = 0;

  for (const user of users) {
    // Get this user's actual topic labels — their real interests, not broad categories
    const userTopicsRes = await pool.query(
      `select topic_label from browsing_signals
       where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '14 days'
       group by topic_label order by count(*) desc limit 20`,
      [user.anonymous_user_id]
    ).catch(() => ({ rows: [] }));

    const userTopics = userTopicsRes.rows.map((r: Record<string, unknown>) => String(r.topic_label));
    if (userTopics.length === 0) continue;

    // Exclude trends this user generated themselves
    const candidates = communityTrends.filter(t => {
      const userSignals = allSignals.filter(s =>
        s.anonymousUserId === user.anonymous_user_id &&
        s.topicLabel.toLowerCase() === t.topicLabel.toLowerCase()
      );
      return userSignals.length === 0;
    });

    if (candidates.length === 0) continue;

    // Let Haiku pick what's actually interesting for this person
    const pickedLabels = await curateWithHaiku(userTopics, candidates);
    if (pickedLabels.length === 0) continue;

    const toSend = pickedLabels
      .map(label => candidates.find(c => c.topicLabel.toLowerCase().includes(label.toLowerCase()) || label.toLowerCase().includes(c.topicLabel.toLowerCase())))
      .filter((t): t is NonNullable<typeof t> => t != null)
      .slice(0, 5);

    if (toSend.length === 0) continue;

    const result = await resendClient.emails.send({
      from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: user.email,
      subject: `${toSend[0].topicLabel} is trending in your community`,
      html: digestHtml(user.name ?? "", toSend)
    });

    if (!result.error) sent++;
  }

  return NextResponse.json({ ok: true, sent, total: users.length });
}

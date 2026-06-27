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

async function writeBriefingWithHaiku(
  userName: string,
  userTopics: string[],
  candidates: Array<{ topicLabel: string; category: string; uniqueUsers: number }>
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || candidates.length === 0) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You write a short personalized message to someone about what's happening in their community. You sound like a friend who noticed something interesting, not a newsletter.

CRITICAL: Only mention community trends that DIRECTLY relate to this person's actual interests. If their interests are shopping and fashion, do NOT mention pre-med or economics trends — those are other people's interests, not theirs. If nothing in the community trends matches their interests, say SKIP.

RULES:
- Write 2-3 sentences max. Natural, casual, like a text from a friend.
- ONLY mention trends that genuinely overlap with what this person actually browses
- If their mirror is full of fashion/shopping, talk about fashion trends in the community
- If their mirror is full of pre-med, talk about pre-med trends in the community
- Do NOT mix different users' interests together
- Summarize what's interesting — don't just repeat signal names
- Never mention categories, labels, or technical terms like "signals" or "pulse"
- No bullet points, no dashes, no lists. Just a short natural paragraph.
- If no community trends match this person's interests, respond with exactly: SKIP`,
      messages: [{
        role: "user",
        content: `This person's ACTUAL browsing topics (their mirror):\n${userTopics.slice(0, 10).join("\n")}\n\nCommunity trends from OTHER people:\n${candidates.map(c => `- ${c.topicLabel} (${c.category}, ${c.uniqueUsers} people)`).join("\n")}\n\nOnly write about community trends that match this person's actual interests. If nothing matches, say SKIP.\n\nPerson's name: ${userName || "this user"}`
      }]
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
    if (!text || text === "SKIP") return null;
    return text;
  } catch {
    return null;
  }
}

function digestHtml(recipientName: string, briefing: string, anonymousUserId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usefomo.co";
  const firstName = recipientName ? recipientName.split(" ")[0] : "";
  const pulseLink = `${appUrl}/api/digest/click?to=pulse&uid=${anonymousUserId}`;
  const mirrorLink = `${appUrl}/api/digest/click?to=mirror&uid=${anonymousUserId}`;

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0d0f;color:#f0ede8;">
      <div style="width:20px;height:20px;border-radius:50%;border:3px solid #3ab8aa;margin-bottom:28px;"></div>
      <p style="color:#f0ede8;font-size:1.05rem;line-height:1.7;margin:0 0 28px;">
        ${firstName ? `Hey ${firstName}, ` : ""}${briefing}
      </p>
      <a href="${pulseLink}" style="display:inline-block;padding:12px 20px;background:#3ab8aa;color:white;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.9rem;">
        See what else is trending
      </a>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);">
        <p style="color:rgba(240,237,232,0.25);font-size:0.75rem;margin:0;">
          FOMO · <a href="${mirrorLink}" style="color:rgba(240,237,232,0.35);">Your mirror</a> · <a href="${appUrl}/privacy" style="color:rgba(240,237,232,0.35);">Privacy</a>
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

    // Let Haiku write a personalized briefing
    const briefing = await writeBriefingWithHaiku(user.name ?? "", userTopics, candidates);
    if (!briefing) continue;

    const subjectText = briefing.slice(0, 80).replace(/["\n]/g, "").trim();
    const subject = subjectText.length > 60 ? subjectText.slice(0, 57) + "..." : subjectText;

    const result = await resendClient.emails.send({
      from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: user.email,
      subject,
      html: digestHtml(user.name ?? "", briefing, user.anonymous_user_id)
    });

    if (!result.error) sent++;
  }

  return NextResponse.json({ ok: true, sent, total: users.length });
}

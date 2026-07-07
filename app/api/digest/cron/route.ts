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
      system: `You write a short, sharp, personalized note about what someone's community is paying attention to. You sound like a witty, well-connected friend texting them a heads-up — not a newsletter, not a report, and never a dry list of stats.

You'll get this person's own browsing topics (for context on who they are) and a list of trending topics from OTHER people in the community (their own topics are already excluded).

THE VOICE:
- Confident, warm, a little playful — the kind of text that makes someone smile and immediately want to check the app.
- Treat every trend as a socially meaningful attention pattern, never as a raw browsing artifact. If a trend label still sounds like a platform/dashboard/admin thing, translate it in your head into what it actually represents (e.g. "LinkedIn messaging" → people quietly recruiting/networking) and write about THAT, never the literal label.

RULES:
- Write 2-3 sentences max. One sharp opening line, then a bit of texture or a light nudge to go look.
- Prefer trends that connect to this person's interests if any clearly do. If none clearly connect, just share the most interesting community trend anyway — frame it as "here's what's buzzing" rather than pretending it's personally relevant.
- Do NOT mix multiple unrelated trends into one confusing message — pick the single best one.
- Never mention categories, labels, or technical terms like "signals," "pulse," or "topics."
- No bullet points, no dashes, no lists. Just a short, tight, natural paragraph with personality.
- Only respond with exactly SKIP if the candidate list is genuinely empty or nonsensical junk.`,
      messages: [{
        role: "user",
        content: `This person's ACTUAL browsing topics (their mirror, for context on who they are):\n${userTopics.slice(0, 10).join("\n")}\n\nTrending community topics from OTHER people:\n${candidates.map(c => `- ${c.topicLabel} (${c.category}, ${c.uniqueUsers} people)`).join("\n")}\n\nWrite a short, sharp, personality-filled note about what's trending. Prefer a topic that connects to their interests, but if nothing clearly connects, just share the best trend anyway.\n\nPerson's name: ${userName || "this user"}`
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
    <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:44px 32px;background:#f7f6f3;color:#1a1a18;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
        <span style="width:8px;height:8px;border-radius:50%;background:#1a6b5a;display:inline-block;"></span>
        <span style="font-family:Georgia,serif;font-size:1.1rem;color:#1a1a18;">FOMO</span>
      </div>
      <p style="font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:rgba(26,26,24,0.35);margin:0 0 14px;">
        ${firstName ? `Hey ${firstName}` : "Your community pulse"}
      </p>
      <p style="font-family:Georgia,serif;font-size:1.4rem;line-height:1.5;color:#1a1a18;margin:0 0 32px;">
        ${briefing}
      </p>
      <a href="${pulseLink}" style="display:inline-block;padding:14px 26px;background:#1a1a18;color:#f7f6f3;border-radius:999px;text-decoration:none;font-weight:500;font-size:0.9rem;">
        See your rooms →
      </a>
      <div style="margin-top:48px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.08);">
        <p style="color:rgba(26,26,24,0.35);font-size:0.75rem;margin:0;">
          FOMO · <a href="${mirrorLink}" style="color:rgba(26,26,24,0.45);">Your mirror</a> · <a href="${appUrl}/privacy" style="color:rgba(26,26,24,0.45);">Privacy</a>
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

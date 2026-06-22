import type { PoolClient } from "pg";
import { buildUserInterests } from "@/lib/interests";
import { getPool } from "@/lib/postgres";
import { buildCommunityTrends } from "@/lib/trends";

function toPostgresArray(arr: string[]): string {
  return "{" + arr.map(s => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",") + "}";
}
import type {
  BlockedDomain,
  BrowsingSignal,
  FeedbackEntry,
  FomoUser,
  PrivacySettings
} from "@/lib/types";

function defaultPrivacySettings(anonymousUserId: string): PrivacySettings {
  return {
    anonymousUserId,
    trackingPaused: false,
    shareableCategories: ["startups", "technology", "research", "events", "finance", "sports", "entertainment", "school/campus", "healthcare", "fashion", "food"],
    localDataRetention: "keep",
    accountDataRetention: "keep"
  };
}

export async function getCachedClassification(domain: string, urlPath: string) {
  return withClient(async (client) => {
    const res = await client.query(
      `select broad_category, topic_label, topic_tags, confidence, reasoning
       from browsing_signals
       where normalized_domain = $1 and url_path = $2
       order by timestamp_bucket desc limit 1`,
      [domain, urlPath]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      category: String(row.broad_category),
      topicLabel: String(row.topic_label),
      topicTags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [String(row.topic_label)],
      confidence: Number(row.confidence),
      reasoning: String(row.reasoning)
    };
  });
}

function mapUser(row: Record<string, unknown>): FomoUser {
  return {
    id: String(row.id),
    anonymousUserId: String(row.anonymous_user_id),
    name: String(row.name ?? "FOMO user"),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
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
    topicLabel: String(row.topic_label ?? row.page_title),
    topicTags: Array.isArray(row.topic_tags) ? (row.topic_tags as string[]) : [],
    confidence: Number(row.confidence),
    reasoning: String(row.reasoning),
    source: String(row.source) as BrowsingSignal["source"]
  };
}

function mapFeedback(row: Record<string, unknown>): FeedbackEntry {
  return {
    id: String(row.id),
    anonymousUserId: String(row.anonymous_user_id),
    targetType: String(row.target_type) as FeedbackEntry["targetType"],
    targetId: String(row.target_id),
    action: String(row.action) as FeedbackEntry["action"],
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapBlockedDomain(row: Record<string, unknown>): BlockedDomain {
  return {
    id: String(row.id),
    anonymousUserId: String(row.anonymous_user_id),
    domain: String(row.domain),
    reason: String(row.reason)
  };
}

function mapPrivacy(
  anonymousUserId: string,
  row?: Record<string, unknown>
): PrivacySettings {
  if (!row) {
    return defaultPrivacySettings(anonymousUserId);
  }

  return {
    anonymousUserId,
    trackingPaused: Boolean(row.tracking_paused),
    shareableCategories: Array.isArray(row.shareable_categories)
      ? (row.shareable_categories as PrivacySettings["shareableCategories"])
      : defaultPrivacySettings(anonymousUserId).shareableCategories,
    localDataRetention:
      String(row.local_data_retention ?? "keep") === "delete" ? "delete" : "keep",
    accountDataRetention:
      String(row.account_data_retention ?? "keep") === "delete" ? "delete" : "keep"
  };
}

async function withClient<T>(run: (client: PoolClient) => Promise<T>) {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  try {
    const client = await pool.connect();
    try {
      return await run(client);
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as Record<string, unknown>)?.code;
    const detail = (err as Record<string, unknown>)?.detail;
    console.error("[db] withClient error:", msg, "code:", code, "detail:", detail);
    return null;
  }
}

export function isDatabaseMode() {
  return Boolean(getPool());
}

async function notifyNewUser(anonymousUserId: string) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `FOMO <${process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"}>`,
      to: "Jadammar08@gmail.com",
      subject: "New FOMO user",
      text: `Someone just installed FOMO.\n\nUser ID: ${anonymousUserId}\n\nCheck Supabase for their signals.`
    });
  } catch {
    // non-critical, don't throw
  }
}

export async function ensureDatabaseUser(anonymousUserId: string) {
  return withClient(async (client) => {
    const userResult = await client.query(
      `
      insert into users (anonymous_user_id, name)
      values ($1, $2)
      on conflict (anonymous_user_id)
      do nothing
      returning *
      `,
      [anonymousUserId, "FOMO user"]
    );

    const isNew = userResult.rows.length > 0;
    if (isNew) notifyNewUser(anonymousUserId);

    await client.query(
      `
      insert into privacy_settings (
        anonymous_user_id,
        tracking_paused,
        shareable_categories,
        local_data_retention,
        account_data_retention
      )
      values ($1, false, $2, 'keep', 'keep')
      on conflict (anonymous_user_id) do nothing
      `,
      [anonymousUserId, toPostgresArray(defaultPrivacySettings(anonymousUserId).shareableCategories)]
    );

    if (isNew) return mapUser(userResult.rows[0]);
    const existing = await client.query(`select * from users where anonymous_user_id = $1 limit 1`, [anonymousUserId]);
    return mapUser(existing.rows[0]);
  });
}

export async function getDatabaseMirrorState(anonymousUserId: string) {
  return withClient(async (client) => {
    await ensureDatabaseUser(anonymousUserId);

    const [userRes, signalsRes, feedbackRes, blockedRes, privacyRes] = await Promise.all([
      client.query(`select * from users where anonymous_user_id = $1 limit 1`, [anonymousUserId]),
      client.query(
        `select * from browsing_signals where anonymous_user_id = $1 order by timestamp_bucket desc limit 200`,
        [anonymousUserId]
      ),
      client.query(
        `select * from feedback where anonymous_user_id = $1 order by created_at desc`,
        [anonymousUserId]
      ),
      client.query(
        `select * from blocked_domains where anonymous_user_id = $1 order by created_at desc`,
        [anonymousUserId]
      ),
      client.query(`select * from privacy_settings where anonymous_user_id = $1 limit 1`, [
        anonymousUserId
      ])
    ]);

    const user = mapUser(userRes.rows[0]);
    const ownSignals = signalsRes.rows.map(mapSignal);
    const ownFeedback = feedbackRes.rows.map(mapFeedback);
    const blockedDomains = blockedRes.rows.map(mapBlockedDomain);
    const privacySettings = mapPrivacy(anonymousUserId, privacyRes.rows[0]);
    const interests = buildUserInterests(
      anonymousUserId,
      ownSignals,
      ownFeedback,
      privacySettings
    );

    return {
      user,
      ownSignals,
      ownFeedback,
      blockedDomains,
      privacySettings,
      interests
    };
  });
}

export async function getDatabasePulseState(_anonymousUserId: string) {
  return withClient(async (client) => {
    // Pull signals from ALL users who have sharing enabled for each category
    const signalsRes = await client.query(
      `select bs.*
       from browsing_signals bs
       join privacy_settings ps on ps.anonymous_user_id = bs.anonymous_user_id
       where bs.timestamp_bucket >= now() - interval '48 hours'
         and ps.tracking_paused = false
         and bs.broad_category = any(ps.shareable_categories)
         and bs.normalized_domain not in ('instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net', 'docs.google.com', 'drive.google.com', 'calendar.google.com', 'accounts.google.com')
       order by bs.timestamp_bucket desc
       limit 2000`
    );

    return buildCommunityTrends(signalsRes.rows.map(mapSignal));
  });
}

export async function insertDatabaseSignal(signal: BrowsingSignal) {
  return withClient(async (client) => {
    await ensureDatabaseUser(signal.anonymousUserId);
    await client.query(
      `
      insert into browsing_signals (
        id,
        anonymous_user_id,
        normalized_domain,
        url_path,
        page_title,
        timestamp_bucket,
        broad_category,
        topic_label,
        topic_tags,
        confidence,
        reasoning,
        source
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        signal.id,
        signal.anonymousUserId,
        signal.normalizedDomain,
        signal.urlPath,
        signal.pageTitle,
        signal.timestampBucket,
        signal.category,
        signal.topicLabel,
        toPostgresArray(signal.topicTags),
        signal.confidence,
        signal.reasoning,
        signal.source
      ]
    );

    return signal;
  });
}

export async function insertDatabaseFeedback(entry: FeedbackEntry) {
  return withClient(async (client) => {
    await ensureDatabaseUser(entry.anonymousUserId);
    await client.query(
      `
      insert into feedback (id, anonymous_user_id, target_type, target_id, action, created_at)
      values ($1,$2,$3,$4,$5,$6)
      `,
      [
        entry.id,
        entry.anonymousUserId,
        entry.targetType,
        entry.targetId,
        entry.action,
        entry.createdAt
      ]
    );

    return entry;
  });
}

export async function upsertDatabasePrivacySettings(
  anonymousUserId: string,
  update: Partial<PrivacySettings> & { blockDomain?: string }
) {
  return withClient(async (client) => {
    await ensureDatabaseUser(anonymousUserId);
    const currentRes = await client.query(
      `select * from privacy_settings where anonymous_user_id = $1 limit 1`,
      [anonymousUserId]
    );
    const current = mapPrivacy(anonymousUserId, currentRes.rows[0]);
    const next = {
      ...current,
      ...update,
      anonymousUserId
    };

    await client.query(
      `
      insert into privacy_settings (
        anonymous_user_id,
        tracking_paused,
        shareable_categories,
        local_data_retention,
        account_data_retention
      )
      values ($1,$2,$3,$4,$5)
      on conflict (anonymous_user_id)
      do update set
        tracking_paused = excluded.tracking_paused,
        shareable_categories = excluded.shareable_categories,
        local_data_retention = excluded.local_data_retention,
        account_data_retention = excluded.account_data_retention
      `,
      [
        anonymousUserId,
        next.trackingPaused,
        toPostgresArray(next.shareableCategories),
        next.localDataRetention,
        next.accountDataRetention
      ]
    );

    if (update.blockDomain) {
      await client.query(
        `
        insert into blocked_domains (anonymous_user_id, domain, reason)
        values ($1,$2,$3)
        on conflict (anonymous_user_id, domain) do nothing
        `,
        [anonymousUserId, update.blockDomain, "never-track"]
      );
    }

    return next;
  });
}

export async function deleteDatabaseData(anonymousUserId: string, scope: "local" | "account") {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(`delete from browsing_signals where anonymous_user_id = $1`, [
        anonymousUserId
      ]);
      await client.query(`delete from feedback where anonymous_user_id = $1`, [anonymousUserId]);

      if (scope === "account") {
        await client.query(`delete from blocked_domains where anonymous_user_id = $1`, [
          anonymousUserId
        ]);
        await client.query(`delete from privacy_settings where anonymous_user_id = $1`, [
          anonymousUserId
        ]);
        await client.query(`delete from users where anonymous_user_id = $1`, [anonymousUserId]);
      }

      await client.query("commit");
      return { ok: true, scope };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function materializeDatabaseTrends() {
  return withClient(async (client) => {
    const trends = (await getDatabasePulseState("")) ?? [];
    await client.query(`delete from community_trends`);

    for (const trend of trends) {
      await client.query(
        `
        insert into community_trends (
          broad_category,
          topic_label,
          topic_tags,
          trend_score,
          anonymous_signals,
          unique_users,
          time_window,
          change_pct,
          explanation
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          trend.category,
          trend.topicLabel,
          toPostgresArray(trend.topicTags),
          trend.trendScore,
          trend.anonymousSignals,
          trend.uniqueUsers,
          trend.timeWindow,
          trend.changePct,
          trend.explanation
        ]
      );
    }

    return trends;
  });
}

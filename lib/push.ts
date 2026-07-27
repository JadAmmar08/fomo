import { getPool } from "@/lib/postgres";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function getWebPush() {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails("mailto:jadammar08@gmail.com", requireEnv("VAPID_PUBLIC_KEY"), requireEnv("VAPID_PRIVATE_KEY"));
  return webpush;
}

export async function saveSubscription(anonymousUserId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `insert into push_subscriptions (anonymous_user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update set anonymous_user_id = excluded.anonymous_user_id`,
    [anonymousUserId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );
}

// Sends a real OS-level push notification to every device this user has enabled
// notifications on. Dead/expired subscriptions (410 Gone, 404) are cleaned up
// automatically rather than retried forever.
export async function sendPushToUser(anonymousUserId: string, payload: { title: string; body: string; url?: string }) {
  const pool = getPool();
  if (!pool) return;
  const res = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from push_subscriptions where anonymous_user_id = $1`,
    [anonymousUserId]
  );
  if (res.rows.length === 0) return;

  const webpush = await getWebPush();

  await Promise.all(
    res.rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await pool.query(`delete from push_subscriptions where endpoint = $1`, [row.endpoint]);
        } else {
          console.error("[sendPushToUser] failed:", err);
        }
      }
    })
  );
}

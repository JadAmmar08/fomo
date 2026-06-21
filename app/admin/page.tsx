import { redirect } from "next/navigation";
import { withClient } from "@/lib/postgres";

export const runtime = "nodejs";

async function getStats() {
  return withClient(async (client) => {
    const [usersRes, newUsersRes, signalsRes, signals24hRes, recentUsersRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM users`),
      client.query(`SELECT COUNT(*) FROM users WHERE created_at > now() - interval '24 hours'`),
      client.query(`SELECT COUNT(*) FROM browsing_signals`),
      client.query(`SELECT COUNT(*) FROM browsing_signals WHERE timestamp_bucket > now() - interval '24 hours'`),
      client.query(`SELECT anonymous_user_id, created_at FROM users ORDER BY created_at DESC LIMIT 20`)
    ]);

    return {
      totalUsers: parseInt(usersRes.rows[0].count),
      newUsersToday: parseInt(newUsersRes.rows[0].count),
      totalSignals: parseInt(signalsRes.rows[0].count),
      signals24h: parseInt(signals24hRes.rows[0].count),
      recentUsers: recentUsersRes.rows
    };
  });
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const params = await searchParams;
  const adminKey = process.env.ADMIN_KEY ?? "fomo-admin";
  if (params.key !== adminKey) redirect("/");

  const stats = await getStats();

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "40px 36px" }}>
        <span className="eyebrow">Admin</span>
        <h1 style={{ marginTop: 12 }}>FOMO Dashboard</h1>
      </section>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Total users</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.totalUsers ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">New today</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.newUsersToday ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Total signals</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.totalSignals ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Signals last 24h</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.signals24h ?? 0}</div>
        </div>
      </div>

      <section className="panel">
        <span className="eyebrow">Recent signups</span>
        <h2 style={{ marginBottom: 20 }}>Last 20 users</h2>
        <div className="list">
          {stats?.recentUsers.map((user: { anonymous_user_id: string; created_at: string }) => (
            <div key={user.anonymous_user_id} className="item" style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--subtle)" }}>{user.anonymous_user_id}</span>
              <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                {new Date(user.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getPool } from "@/lib/postgres";
import { AdminDashboardClient } from "@/components/admin-dashboard-client";

export const runtime = "nodejs";

async function getStats() {
  const pool = getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try {
    const [activeRes, active24hRes, signalsRes, signals24hRes, recentUsersRes] = await Promise.all([
      client.query(`SELECT COUNT(DISTINCT anonymous_user_id) FROM browsing_signals`),
      client.query(`SELECT COUNT(DISTINCT anonymous_user_id) FROM browsing_signals WHERE timestamp_bucket > now() - interval '24 hours'`),
      client.query(`SELECT COUNT(*) FROM browsing_signals`),
      client.query(`SELECT COUNT(*) FROM browsing_signals WHERE timestamp_bucket > now() - interval '24 hours'`),
      client.query(`SELECT anonymous_user_id, created_at FROM users ORDER BY created_at DESC LIMIT 20`)
    ]);
    let waitlistCount = 0;
    let waitlistToday = 0;
    let recentWaitlist: Array<{ email: string; name: string | null; created_at: string }> = [];
    let digestClicks = 0;
    let digestClicks24h = 0;
    let recentClicks: Array<{ anonymous_user_id: string; destination: string; clicked_at: string }> = [];
    try {
      const [wRes, wTodayRes, wRecentRes] = await Promise.all([
        client.query(`SELECT COUNT(*) FROM waitlist`),
        client.query(`SELECT COUNT(*) FROM waitlist WHERE created_at > now() - interval '24 hours'`),
        client.query(`SELECT email, name, created_at FROM waitlist ORDER BY created_at DESC LIMIT 20`)
      ]);
      waitlistCount = parseInt(String(wRes.rows[0].count));
      waitlistToday = parseInt(String(wTodayRes.rows[0].count));
      recentWaitlist = wRecentRes.rows as Array<{ email: string; name: string | null; created_at: string }>;
    } catch { /* table may not exist */ }
    try {
      const [dcRes, dc24hRes, dcRecentRes] = await Promise.all([
        client.query(`SELECT COUNT(*) FROM digest_clicks`),
        client.query(`SELECT COUNT(*) FROM digest_clicks WHERE clicked_at > now() - interval '24 hours'`),
        client.query(`SELECT anonymous_user_id, destination, clicked_at FROM digest_clicks ORDER BY clicked_at DESC LIMIT 10`)
      ]);
      digestClicks = parseInt(String(dcRes.rows[0].count));
      digestClicks24h = parseInt(String(dc24hRes.rows[0].count));
      recentClicks = dcRecentRes.rows as Array<{ anonymous_user_id: string; destination: string; clicked_at: string }>;
    } catch { /* table may not exist */ }
    return {
      activeUsers: parseInt(String(activeRes.rows[0].count)),
      activeToday: parseInt(String(active24hRes.rows[0].count)),
      totalSignals: parseInt(String(signalsRes.rows[0].count)),
      signals24h: parseInt(String(signals24hRes.rows[0].count)),
      recentUsers: recentUsersRes.rows as Array<{ anonymous_user_id: string; created_at: string }>,
      waitlistCount,
      waitlistToday,
      recentWaitlist,
      digestClicks,
      digestClicks24h,
      recentClicks
    };
  } finally {
    client.release();
  }
}

interface TeamMember {
  anonymous_user_id: string;
  joined_at: string;
  signal_count: number;
  last_active: string | null;
}

interface TeamStat {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  active_members_7d: number;
  total_signals: number;
  signals_7d: number;
  connection_count: number;
  connections_generated_at: string | null;
  thesis_count: number;
  stale_count: number;
  mirror_updated_at: string | null;
  members: TeamMember[];
}

async function getTeamStats(): Promise<TeamStat[]> {
  const pool = getPool();
  if (!pool) return [];
  const client = await pool.connect();
  try {
    const roomsRes = await client.query(`
      SELECT id, name, slug, created_at,
        (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count,
        (SELECT COUNT(DISTINCT rm.anonymous_user_id) FROM room_members rm
          JOIN browsing_signals bs ON bs.anonymous_user_id = rm.anonymous_user_id
          WHERE rm.room_id = r.id AND bs.timestamp_bucket > now() - interval '7 days') AS active_members_7d,
        (SELECT COUNT(*) FROM browsing_signals bs
          JOIN room_members rm ON bs.anonymous_user_id = rm.anonymous_user_id
          WHERE rm.room_id = r.id) AS total_signals,
        (SELECT COUNT(*) FROM browsing_signals bs
          JOIN room_members rm ON bs.anonymous_user_id = rm.anonymous_user_id
          WHERE rm.room_id = r.id AND bs.timestamp_bucket > now() - interval '7 days') AS signals_7d
      FROM rooms r
      WHERE r.type = 'team'
      ORDER BY r.created_at DESC
    `);

    const teams: TeamStat[] = [];
    for (const row of roomsRes.rows) {
      let connectionCount = 0;
      let connectionsGeneratedAt: string | null = null;
      let thesisCount = 0;
      let staleCount = 0;
      let mirrorUpdatedAt: string | null = null;
      try {
        const connRes = await client.query(
          `SELECT connections, generated_at FROM room_connections WHERE room_id = $1`,
          [row.id]
        );
        if (connRes.rows.length > 0) {
          const connections = connRes.rows[0].connections;
          connectionCount = Array.isArray(connections) ? connections.length : 0;
          connectionsGeneratedAt = connRes.rows[0].generated_at as string;
        }
      } catch { /* table may not exist */ }
      try {
        const mirrorRes = await client.query(
          `SELECT theses, stale_assumptions, updated_at FROM team_mirror_state WHERE room_id = $1`,
          [row.id]
        );
        if (mirrorRes.rows.length > 0) {
          const theses = mirrorRes.rows[0].theses;
          const stale = mirrorRes.rows[0].stale_assumptions;
          thesisCount = Array.isArray(theses) ? theses.length : 0;
          staleCount = Array.isArray(stale) ? stale.length : 0;
          mirrorUpdatedAt = mirrorRes.rows[0].updated_at as string;
        }
      } catch { /* table may not exist */ }

      let members: TeamMember[] = [];
      try {
        const membersRes = await client.query(
          `SELECT rm.anonymous_user_id, rm.joined_at,
              (SELECT COUNT(*) FROM browsing_signals bs WHERE bs.anonymous_user_id = rm.anonymous_user_id) AS signal_count,
              (SELECT MAX(bs.timestamp_bucket) FROM browsing_signals bs WHERE bs.anonymous_user_id = rm.anonymous_user_id) AS last_active
            FROM room_members rm
            WHERE rm.room_id = $1
            ORDER BY rm.joined_at ASC`,
          [row.id]
        );
        members = membersRes.rows.map((m) => ({
          anonymous_user_id: m.anonymous_user_id as string,
          joined_at: m.joined_at as string,
          signal_count: parseInt(String(m.signal_count)),
          last_active: m.last_active as string | null
        }));
      } catch { /* ignore */ }

      teams.push({
        id: row.id as string,
        name: row.name as string,
        slug: row.slug as string,
        created_at: row.created_at as string,
        member_count: parseInt(String(row.member_count)),
        active_members_7d: parseInt(String(row.active_members_7d)),
        total_signals: parseInt(String(row.total_signals)),
        signals_7d: parseInt(String(row.signals_7d)),
        connection_count: connectionCount,
        connections_generated_at: connectionsGeneratedAt,
        thesis_count: thesisCount,
        stale_count: staleCount,
        mirror_updated_at: mirrorUpdatedAt,
        members
      });
    }
    return teams;
  } finally {
    client.release();
  }
}

async function getDashboardData(key: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${appUrl}/api/admin/dashboard?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const params = await searchParams;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) redirect("/");
  if (params.key !== adminKey) redirect("/");

  const [stats, teams, dashboardData] = await Promise.all([getStats(), getTeamStats(), getDashboardData(adminKey)]);

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "40px 36px" }}>
        <span className="eyebrow">Admin</span>
        <h1 style={{ marginTop: 12 }}>FOMO Dashboard</h1>
      </section>

      <section className="panel">
        <AdminDashboardClient adminKey={adminKey} initialData={dashboardData} />
      </section>

      <section className="panel">
        <span className="eyebrow">Pilot health</span>
        <h2 style={{ marginBottom: 20 }}>Teams</h2>
        {teams.length === 0 ? (
          <p>No teams created yet.</p>
        ) : (
          <div className="list" style={{ gap: 16 }}>
            {teams.map((team) => {
              const isReallyBeingUsed = team.active_members_7d >= 2;
              return (
                <div key={team.id} className="item" style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text)" }}>{team.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>
                        /{team.slug} · created {new Date(team.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <span className="pill" style={{
                      fontSize: "0.72rem", fontWeight: 600,
                      color: isReallyBeingUsed ? "var(--accent)" : "var(--subtle)",
                      background: isReallyBeingUsed ? "var(--accent-soft)" : "var(--surface-muted)",
                      border: `1px solid ${isReallyBeingUsed ? "var(--accent)" : "var(--line)"}`
                    }}>
                      {isReallyBeingUsed ? "Actively used" : "Not yet active"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                    <div>
                      <span className="kicker" style={{ marginBottom: 2 }}>Members</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text)" }}>{team.member_count}</div>
                    </div>
                    <div>
                      <span className="kicker" style={{ marginBottom: 2 }}>Active (7d)</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text)" }}>{team.active_members_7d}</div>
                    </div>
                    <div>
                      <span className="kicker" style={{ marginBottom: 2 }}>Signals (7d)</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text)" }}>{team.signals_7d}</div>
                    </div>
                    <div>
                      <span className="kicker" style={{ marginBottom: 2 }}>Signals (total)</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--text)" }}>{team.total_signals}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                      <span className="kicker" style={{ marginBottom: 2 }}>Team Pulse</span>
                      <div style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                        {team.connection_count} connection{team.connection_count === 1 ? "" : "s"}
                        {team.connections_generated_at && (
                          <span style={{ color: "var(--subtle)" }}> · last {new Date(team.connections_generated_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px" }}>
                      <span className="kicker" style={{ marginBottom: 2 }}>Team Mirror</span>
                      <div style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                        {team.thesis_count} thesis{team.thesis_count === 1 ? "" : "es"}, {team.stale_count} stale
                        {team.mirror_updated_at && (
                          <span style={{ color: "var(--subtle)" }}> · last {new Date(team.mirror_updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {team.members.length > 0 && (
                    <div>
                      <span className="kicker" style={{ marginBottom: 6, display: "block" }}>Members</span>
                      <div className="list" style={{ gap: 6 }}>
                        {team.members.map((m) => {
                          const daysSinceActive = m.last_active
                            ? Math.floor((Date.now() - new Date(m.last_active).getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                          const wentQuiet = daysSinceActive !== null && daysSinceActive > 3;
                          return (
                            <div key={m.anonymous_user_id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface-raised)", borderRadius: 8 }}>
                              <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--subtle)" }}>{m.anonymous_user_id.slice(0, 14)}</span>
                              <span style={{ fontSize: "0.78rem", color: "var(--text)" }}>{m.signal_count} signals</span>
                              <span style={{ fontSize: "0.78rem", color: wentQuiet ? "var(--danger)" : "var(--subtle)" }}>
                                {m.last_active
                                  ? daysSinceActive === 0 ? "active today" : `last active ${daysSinceActive}d ago`
                                  : "no activity yet"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Waitlist</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.waitlistCount ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Waitlist today</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.waitlistToday ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Active users</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.activeUsers ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Active today</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.activeToday ?? 0}</div>
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

      <div className="grid two">
        <div className="card">
          <span className="kicker">Digest clicks</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.digestClicks ?? 0}</div>
        </div>
        <div className="card">
          <span className="kicker">Digest clicks 24h</span>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--accent)", marginTop: 8 }}>{stats?.digestClicks24h ?? 0}</div>
        </div>
      </div>

      {(stats?.recentClicks?.length ?? 0) > 0 && (
        <section className="panel">
          <span className="eyebrow">Digest</span>
          <h2 style={{ marginBottom: 20 }}>Recent digest clicks</h2>
          <div className="list">
            {stats!.recentClicks.map((click, i) => (
              <div key={i} className="item" style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--subtle)" }}>{click.anonymous_user_id.slice(0, 18)}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--accent)", marginLeft: 10 }}>{click.destination}</span>
                </div>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  {new Date(click.clicked_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(stats?.recentWaitlist?.length ?? 0) > 0 && (
        <section className="panel">
          <span className="eyebrow">Waitlist</span>
          <h2 style={{ marginBottom: 20 }}>Recent sign-ups</h2>
          <div className="list">
            {stats!.recentWaitlist.map((entry) => (
              <div key={entry.email} className="item" style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px" }}>
                <div>
                  <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{entry.email}</span>
                  {entry.name && <span style={{ fontSize: "0.8rem", color: "var(--subtle)", marginLeft: 10 }}>{entry.name}</span>}
                </div>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  {new Date(entry.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <span className="eyebrow">Recent signups</span>
        <h2 style={{ marginBottom: 20 }}>Last 20 users</h2>
        <div className="list">
          {stats?.recentUsers.map((user) => (
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

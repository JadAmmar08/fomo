import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

export const runtime = "nodejs";

function checkAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  const key = request.nextUrl.searchParams.get("key");
  return key === adminKey;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }
  const client = await pool.connect();

  try {
    // ---- Today's health ----
    const [todayRes, yesterdayRes, totalUsersRes, activeTeamsTodayRes] = await Promise.all([
      client.query(`SELECT COUNT(DISTINCT anonymous_user_id) AS dau, COUNT(*) AS signals
        FROM browsing_signals WHERE timestamp_bucket::date = current_date`),
      client.query(`SELECT COUNT(DISTINCT anonymous_user_id) AS dau, COUNT(*) AS signals
        FROM browsing_signals WHERE timestamp_bucket::date = current_date - interval '1 day'`),
      client.query(`SELECT COUNT(*) AS total FROM users`),
      client.query(`SELECT COUNT(DISTINCT rm.room_id) AS active_teams
        FROM room_members rm
        JOIN rooms r ON r.id = rm.room_id AND r.type = 'team'
        JOIN browsing_signals bs ON bs.anonymous_user_id = rm.anonymous_user_id
        WHERE bs.timestamp_bucket::date = current_date`)
    ]);

    const todayDau = parseInt(String(todayRes.rows[0].dau));
    const todaySignals = parseInt(String(todayRes.rows[0].signals));
    const yesterdayDau = parseInt(String(yesterdayRes.rows[0].dau));
    const yesterdaySignals = parseInt(String(yesterdayRes.rows[0].signals));
    const totalUsers = parseInt(String(totalUsersRes.rows[0].total));

    const health = {
      dau: todayDau,
      dauTrendPct: yesterdayDau > 0 ? Math.round(((todayDau - yesterdayDau) / yesterdayDau) * 1000) / 10 : null,
      pctUsedExtension: totalUsers > 0 ? Math.round((todayDau / totalUsers) * 1000) / 10 : 0,
      activeTeamsToday: parseInt(String(activeTeamsTodayRes.rows[0].active_teams)),
      signalsToday: todaySignals,
      signalsTrendPct: yesterdaySignals > 0 ? Math.round(((todaySignals - yesterdaySignals) / yesterdaySignals) * 1000) / 10 : null
    };

    // ---- Retention cohorts (last 14 cohort days, day1/day2/day7) ----
    let retention: Array<{ cohortDate: string; cohortSize: number; day1: number | null; day2: number | null; day7: number | null }> = [];
    try {
      const cohortRes = await client.query(`
        WITH first_seen AS (
          SELECT anonymous_user_id, MIN(timestamp_bucket::date) AS cohort_date
          FROM browsing_signals
          GROUP BY anonymous_user_id
        ),
        cohorts AS (
          SELECT cohort_date, COUNT(*) AS cohort_size
          FROM first_seen
          WHERE cohort_date > current_date - interval '15 days'
          GROUP BY cohort_date
        ),
        activity AS (
          SELECT DISTINCT anonymous_user_id, timestamp_bucket::date AS active_date
          FROM browsing_signals
        )
        SELECT
          c.cohort_date,
          c.cohort_size,
          (SELECT COUNT(*) FROM first_seen fs JOIN activity a ON a.anonymous_user_id = fs.anonymous_user_id
            WHERE fs.cohort_date = c.cohort_date AND a.active_date = fs.cohort_date + 1) AS day1,
          (SELECT COUNT(*) FROM first_seen fs JOIN activity a ON a.anonymous_user_id = fs.anonymous_user_id
            WHERE fs.cohort_date = c.cohort_date AND a.active_date = fs.cohort_date + 2) AS day2,
          (SELECT COUNT(*) FROM first_seen fs JOIN activity a ON a.anonymous_user_id = fs.anonymous_user_id
            WHERE fs.cohort_date = c.cohort_date AND a.active_date = fs.cohort_date + 7) AS day7
        FROM cohorts c
        ORDER BY c.cohort_date DESC
      `);
      retention = cohortRes.rows.map((r) => {
        const size = parseInt(String(r.cohort_size));
        const cohortDate = r.cohort_date as string;
        const cohortAgeDays = Math.floor((Date.now() - new Date(cohortDate).getTime()) / (1000 * 60 * 60 * 24));
        return {
          cohortDate: new Date(cohortDate).toISOString().slice(0, 10),
          cohortSize: size,
          day1: cohortAgeDays >= 1 ? Math.round((parseInt(String(r.day1)) / size) * 1000) / 10 : null,
          day2: cohortAgeDays >= 2 ? Math.round((parseInt(String(r.day2)) / size) * 1000) / 10 : null,
          day7: cohortAgeDays >= 7 ? Math.round((parseInt(String(r.day7)) / size) * 1000) / 10 : null
        };
      });
    } catch { /* ignore */ }

    // ---- Feature engagement (last 7 days) ----
    let engagement = { pulseViews: 0, pulseUniqueUsers: 0, mirrorViews: 0, mirrorUniqueUsers: 0, guidanceViews: 0, guidanceUniqueUsers: 0 };
    try {
      const engRes = await client.query(`
        SELECT event_type, COUNT(*) AS views, COUNT(DISTINCT anonymous_user_id) AS unique_users
        FROM feature_views
        WHERE viewed_at > now() - interval '7 days'
        GROUP BY event_type
      `);
      for (const row of engRes.rows) {
        const views = parseInt(String(row.views));
        const unique = parseInt(String(row.unique_users));
        if (row.event_type === "pulse_view") { engagement.pulseViews = views; engagement.pulseUniqueUsers = unique; }
        if (row.event_type === "mirror_view") { engagement.mirrorViews = views; engagement.mirrorUniqueUsers = unique; }
        if (row.event_type === "guidance_view") { engagement.guidanceViews = views; engagement.guidanceUniqueUsers = unique; }
      }
    } catch { /* table may not exist yet */ }

    const engagementPct = {
      pulsePctOfDau: todayDau > 0 ? Math.round((engagement.pulseUniqueUsers / totalUsers) * 1000) / 10 : 0,
      mirrorPctOfDau: totalUsers > 0 ? Math.round((engagement.mirrorUniqueUsers / totalUsers) * 1000) / 10 : 0,
      guidancePctOfDau: totalUsers > 0 ? Math.round((engagement.guidanceUniqueUsers / totalUsers) * 1000) / 10 : 0
    };

    // ---- Activation funnel ----
    let funnel = { installs: totalUsers, accounts: 0, invitedTeam: 0, joinedTeam: 0, firstPulseView: 0, firstMirrorView: 0 };
    try {
      const [accountsRes, invitedRes, joinedRes, pulseViewedRes, mirrorViewedRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM accounts`),
        client.query(`SELECT COUNT(DISTINCT created_by) AS n FROM rooms WHERE type = 'team'`),
        client.query(`SELECT COUNT(DISTINCT rm.anonymous_user_id) AS n
          FROM room_members rm JOIN rooms r ON r.id = rm.room_id
          WHERE r.type = 'team' AND rm.anonymous_user_id <> r.created_by`),
        client.query(`SELECT COUNT(DISTINCT anonymous_user_id) AS n FROM feature_views WHERE event_type = 'pulse_view'`).catch(() => ({ rows: [{ n: 0 }] })),
        client.query(`SELECT COUNT(DISTINCT anonymous_user_id) AS n FROM feature_views WHERE event_type = 'mirror_view'`).catch(() => ({ rows: [{ n: 0 }] }))
      ]);
      funnel = {
        installs: totalUsers,
        accounts: parseInt(String(accountsRes.rows[0].n)),
        invitedTeam: parseInt(String(invitedRes.rows[0].n)),
        joinedTeam: parseInt(String(joinedRes.rows[0].n)),
        firstPulseView: parseInt(String(pulseViewedRes.rows[0].n)),
        firstMirrorView: parseInt(String(mirrorViewedRes.rows[0].n))
      };
    } catch { /* ignore */ }

    const funnelSteps = [
      { label: "Install", count: funnel.installs },
      { label: "Create account", count: funnel.accounts },
      { label: "Invite team", count: funnel.invitedTeam },
      { label: "Team member joins", count: funnel.joinedTeam },
      { label: "First Pulse view", count: funnel.firstPulseView },
      { label: "First Mirror view", count: funnel.firstMirrorView }
    ].map((step) => ({
      ...step,
      pct: funnel.installs > 0 ? Math.round((step.count / funnel.installs) * 1000) / 10 : 0
    }));

    // ---- Costs (last 7 days) ----
    let costsByType: Array<{ callType: string; calls: number; estimatedCost: number; cacheHitRate: number | null }> = [];
    let costsByTeam: Array<{ roomId: string; teamName: string; estimatedCost: number }> = [];
    try {
      const costRes = await client.query(`
        SELECT call_type,
          COUNT(*) AS calls,
          SUM(estimated_cost) AS total_cost,
          SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits
        FROM cost_log
        WHERE created_at > now() - interval '7 days'
        GROUP BY call_type
      `);
      costsByType = costRes.rows.map((r) => {
        const calls = parseInt(String(r.calls));
        return {
          callType: r.call_type as string,
          calls,
          estimatedCost: Math.round(parseFloat(String(r.total_cost)) * 10000) / 10000,
          cacheHitRate: r.call_type === "classification" ? Math.round((parseInt(String(r.cache_hits)) / calls) * 1000) / 10 : null
        };
      });

      const teamCostRes = await client.query(`
        SELECT cl.room_id, r.name AS team_name, SUM(cl.estimated_cost) AS total_cost
        FROM cost_log cl
        JOIN rooms r ON r.id = cl.room_id
        WHERE cl.created_at > now() - interval '7 days' AND cl.room_id IS NOT NULL
        GROUP BY cl.room_id, r.name
        ORDER BY total_cost DESC
        LIMIT 10
      `);
      costsByTeam = teamCostRes.rows.map((r) => ({
        roomId: r.room_id as string,
        teamName: r.team_name as string,
        estimatedCost: Math.round(parseFloat(String(r.total_cost)) * 10000) / 10000
      }));
    } catch { /* table may not exist yet */ }

    // ---- Top feedback (by frequency — schema has no free-text field, only action/target_type) ----
    let topFeedback: Array<{ targetType: string; action: string; count: number }> = [];
    try {
      const fbRes = await client.query(`
        SELECT target_type, action, COUNT(*) AS n
        FROM feedback
        GROUP BY target_type, action
        ORDER BY n DESC
        LIMIT 10
      `);
      topFeedback = fbRes.rows.map((r) => ({
        targetType: r.target_type as string,
        action: r.action as string,
        count: parseInt(String(r.n))
      }));
    } catch { /* table may not exist */ }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      health,
      retention,
      engagement: { ...engagement, ...engagementPct },
      funnel: funnelSteps,
      costs: { byType: costsByType, byTeam: costsByTeam },
      topFeedback
    });
  } finally {
    client.release();
  }
}

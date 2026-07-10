import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/postgres";

export const runtime = "nodejs";

function checkAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  const key = request.nextUrl.searchParams.get("key");
  return key === adminKey;
}

// Every query below is scoped to anonymous_user_ids that belong to at least
// one team (rooms.type = 'team') — this dashboard reflects team usage only,
// not solo/room browsing.
const TEAM_MEMBERS_CTE = `
  team_members AS (
    SELECT DISTINCT rm.anonymous_user_id
    FROM room_members rm
    JOIN rooms r ON r.id = rm.room_id AND r.type = 'team'
  )
`;

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
    // ---- Today's health (team members only) ----
    const [todayRes, yesterdayRes, totalMembersRes, activeTeamsTodayRes] = await Promise.all([
      client.query(`WITH ${TEAM_MEMBERS_CTE}
        SELECT COUNT(DISTINCT bs.anonymous_user_id) AS dau, COUNT(*) AS signals
        FROM browsing_signals bs
        JOIN team_members tm ON tm.anonymous_user_id = bs.anonymous_user_id
        WHERE bs.timestamp_bucket::date = current_date`),
      client.query(`WITH ${TEAM_MEMBERS_CTE}
        SELECT COUNT(DISTINCT bs.anonymous_user_id) AS dau, COUNT(*) AS signals
        FROM browsing_signals bs
        JOIN team_members tm ON tm.anonymous_user_id = bs.anonymous_user_id
        WHERE bs.timestamp_bucket::date = current_date - interval '1 day'`),
      client.query(`WITH ${TEAM_MEMBERS_CTE} SELECT COUNT(*) AS total FROM team_members`),
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
    const totalMembers = parseInt(String(totalMembersRes.rows[0].total));

    const health = {
      dau: todayDau,
      dauTrendPct: yesterdayDau > 0 ? Math.round(((todayDau - yesterdayDau) / yesterdayDau) * 1000) / 10 : null,
      pctUsedExtension: totalMembers > 0 ? Math.round((todayDau / totalMembers) * 1000) / 10 : 0,
      activeTeamsToday: parseInt(String(activeTeamsTodayRes.rows[0].active_teams)),
      signalsToday: todaySignals,
      signalsTrendPct: yesterdaySignals > 0 ? Math.round(((todaySignals - yesterdaySignals) / yesterdaySignals) * 1000) / 10 : null
    };

    // ---- Retention cohorts (team members only, last 14 cohort days, day1/day2/day7) ----
    let retention: Array<{ cohortDate: string; cohortSize: number; day1: number | null; day2: number | null; day7: number | null }> = [];
    try {
      const cohortRes = await client.query(`
        WITH ${TEAM_MEMBERS_CTE},
        first_seen AS (
          SELECT bs.anonymous_user_id, MIN(bs.timestamp_bucket::date) AS cohort_date
          FROM browsing_signals bs
          JOIN team_members tm ON tm.anonymous_user_id = bs.anonymous_user_id
          GROUP BY bs.anonymous_user_id
        ),
        cohorts AS (
          SELECT cohort_date, COUNT(*) AS cohort_size
          FROM first_seen
          WHERE cohort_date > current_date - interval '15 days'
          GROUP BY cohort_date
        ),
        activity AS (
          SELECT DISTINCT bs.anonymous_user_id, bs.timestamp_bucket::date AS active_date
          FROM browsing_signals bs
          JOIN team_members tm ON tm.anonymous_user_id = bs.anonymous_user_id
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

    // ---- Feature engagement (last 7 days, team members only) ----
    let engagement = { pulseViews: 0, pulseUniqueUsers: 0, mirrorViews: 0, mirrorUniqueUsers: 0, guidanceViews: 0, guidanceUniqueUsers: 0 };
    try {
      const engRes = await client.query(`
        WITH ${TEAM_MEMBERS_CTE}
        SELECT fv.event_type, COUNT(*) AS views, COUNT(DISTINCT fv.anonymous_user_id) AS unique_users
        FROM feature_views fv
        JOIN team_members tm ON tm.anonymous_user_id = fv.anonymous_user_id
        WHERE fv.viewed_at > now() - interval '7 days'
        GROUP BY fv.event_type
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
      pulsePctOfDau: totalMembers > 0 ? Math.round((engagement.pulseUniqueUsers / totalMembers) * 1000) / 10 : 0,
      mirrorPctOfDau: totalMembers > 0 ? Math.round((engagement.mirrorUniqueUsers / totalMembers) * 1000) / 10 : 0,
      guidancePctOfDau: totalMembers > 0 ? Math.round((engagement.guidanceUniqueUsers / totalMembers) * 1000) / 10 : 0
    };

    // ---- Activation funnel (per-team, not per-user — teams created down to teams
    // whose members actually looked at what FOMO produced for them) ----
    let funnel = { teamsCreated: 0, teamsWith2Plus: 0, teamsWithPulseView: 0, teamsWithMirrorView: 0 };
    try {
      const [createdRes, twoPlusRes, pulseViewRes, mirrorViewRes] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM rooms WHERE type = 'team'`),
        client.query(`SELECT COUNT(*) AS n FROM (
            SELECT room_id FROM room_members rm JOIN rooms r ON r.id = rm.room_id AND r.type = 'team'
            GROUP BY room_id HAVING COUNT(*) >= 2
          ) t`),
        client.query(`SELECT COUNT(DISTINCT fv.room_id) AS n FROM feature_views fv
          JOIN rooms r ON r.id = fv.room_id AND r.type = 'team'
          WHERE fv.event_type = 'pulse_view'`).catch(() => ({ rows: [{ n: 0 }] })),
        client.query(`SELECT COUNT(DISTINCT fv.room_id) AS n FROM feature_views fv
          JOIN rooms r ON r.id = fv.room_id AND r.type = 'team'
          WHERE fv.event_type = 'mirror_view'`).catch(() => ({ rows: [{ n: 0 }] }))
      ]);
      funnel = {
        teamsCreated: parseInt(String(createdRes.rows[0].n)),
        teamsWith2Plus: parseInt(String(twoPlusRes.rows[0].n)),
        teamsWithPulseView: parseInt(String(pulseViewRes.rows[0].n)),
        teamsWithMirrorView: parseInt(String(mirrorViewRes.rows[0].n))
      };
    } catch { /* ignore */ }

    const funnelSteps = [
      { label: "Team created", count: funnel.teamsCreated },
      { label: "Team has 2+ members", count: funnel.teamsWith2Plus },
      { label: "Team viewed Pulse", count: funnel.teamsWithPulseView },
      { label: "Team viewed Mirror", count: funnel.teamsWithMirrorView }
    ].map((step) => ({
      ...step,
      pct: funnel.teamsCreated > 0 ? Math.round((step.count / funnel.teamsCreated) * 1000) / 10 : 0
    }));

    // ---- Costs (last 7 days, team-attributed calls only) ----
    let costsByType: Array<{ callType: string; calls: number; estimatedCost: number; cacheHitRate: number | null }> = [];
    let costsByTeam: Array<{ roomId: string; teamName: string; estimatedCost: number }> = [];
    try {
      const costRes = await client.query(`
        SELECT cl.call_type,
          COUNT(*) AS calls,
          SUM(cl.estimated_cost) AS total_cost,
          SUM(CASE WHEN cl.cache_hit THEN 1 ELSE 0 END) AS cache_hits
        FROM cost_log cl
        WHERE cl.created_at > now() - interval '7 days'
          AND (cl.room_id IS NOT NULL OR cl.call_type = 'classification')
        GROUP BY cl.call_type
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
        JOIN rooms r ON r.id = cl.room_id AND r.type = 'team'
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

    // ---- Top feedback (team members only, by frequency — schema has no free-text field) ----
    let topFeedback: Array<{ targetType: string; action: string; count: number }> = [];
    try {
      const fbRes = await client.query(`
        WITH ${TEAM_MEMBERS_CTE}
        SELECT f.target_type, f.action, COUNT(*) AS n
        FROM feedback f
        JOIN team_members tm ON tm.anonymous_user_id = f.anonymous_user_id
        GROUP BY f.target_type, f.action
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

"use client";

import useSWR from "swr";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DashboardData {
  generatedAt: string;
  health: {
    dau: number;
    dauTrendPct: number | null;
    pctUsedExtension: number;
    activeTeamsToday: number;
    signalsToday: number;
    signalsTrendPct: number | null;
  };
  retention: Array<{ cohortDate: string; cohortSize: number; day1: number | null; day2: number | null; day7: number | null }>;
  engagement: {
    pulseViews: number; pulseUniqueUsers: number; pulsePctOfDau: number;
    mirrorViews: number; mirrorUniqueUsers: number; mirrorPctOfDau: number;
    guidanceViews: number; guidanceUniqueUsers: number; guidancePctOfDau: number;
  };
  funnel: Array<{ label: string; count: number; pct: number }>;
  costs: {
    byType: Array<{ callType: string; calls: number; estimatedCost: number; cacheHitRate: number | null }>;
    byTeam: Array<{ roomId: string; teamName: string; estimatedCost: number }>;
  };
  topFeedback: Array<{ targetType: string; action: string; count: number }>;
}

const cardStyle: React.CSSProperties = {
  background: "white", borderRadius: 16, border: "1px solid var(--line)",
  padding: "20px 24px"
};

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: "0.78rem", marginLeft: 8, color: up ? "var(--accent)" : "var(--danger)" }}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function CallTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    classification: "Classification",
    pulse_synthesis: "Pulse synthesis",
    mirror_synthesis: "Mirror synthesis",
    guidance_synthesis: "Guidance synthesis"
  };
  return <>{labels[type] ?? type}</>;
}

export function AdminDashboardClient({ adminKey, initialData }: { adminKey: string; initialData: DashboardData | null }) {
  const { data, error } = useSWR<DashboardData>(
    `/api/admin/dashboard?key=${encodeURIComponent(adminKey)}`,
    (url: string) => fetch(url).then((r) => r.json()),
    { fallbackData: initialData ?? undefined, refreshInterval: 45000 }
  );

  if (error) return <p style={{ color: "var(--danger)" }}>Failed to load dashboard data.</p>;
  if (!data) return <p>Loading...</p>;

  const chartData = [...data.retention].reverse().map((r) => ({
    date: r.cohortDate.slice(5),
    "Day 1": r.day1,
    "Day 2": r.day2,
    "Day 7": r.day7
  }));

  const maxFunnelCount = data.funnel[0]?.count ?? 1;
  let biggestDropIdx = 0;
  let biggestDrop = -1;
  for (let i = 1; i < data.funnel.length; i++) {
    const drop = data.funnel[i - 1].pct - data.funnel[i].pct;
    if (drop > biggestDrop) { biggestDrop = drop; biggestDropIdx = i; }
  }

  const totalCost7d = data.costs.byType.reduce((sum, c) => sum + c.estimatedCost, 0);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--subtle)", textAlign: "right" }}>
        Auto-refreshing · last updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>

      {/* Today's health */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Today&apos;s health</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div style={cardStyle}>
            <span className="kicker">DAU</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{data.health.dau}<Trend pct={data.health.dauTrendPct} /></div>
          </div>
          <div style={cardStyle}>
            <span className="kicker">% used extension</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{data.health.pctUsedExtension}%</div>
          </div>
          <div style={cardStyle}>
            <span className="kicker">Active teams</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{data.health.activeTeamsToday}</div>
          </div>
          <div style={cardStyle}>
            <span className="kicker">Signals today</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{data.health.signalsToday}<Trend pct={data.health.signalsTrendPct} /></div>
          </div>
        </div>
      </section>

      {/* Retention */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Retention by cohort</h2>
        <div style={cardStyle}>
          {chartData.length === 0 ? (
            <p style={{ color: "var(--subtle)" }}>No cohorts old enough to measure yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} unit="%" />
                <Tooltip />
                <Legend />
                <Bar dataKey="Day 1" fill="var(--accent)" />
                <Bar dataKey="Day 2" fill="var(--direction, #6b8afd)" />
                <Bar dataKey="Day 7" fill="var(--question, #d98c3f)" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--subtle)", marginTop: 8 }}>
            % of each cohort still active N days after their first signal. Blank bars mean the cohort isn&apos;t old enough yet to measure.
          </p>
        </div>
      </section>

      {/* Feature engagement */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Feature engagement (7d)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div style={cardStyle}>
            <span className="kicker">Team Pulse</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{data.engagement.pulseViews} views</div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>{data.engagement.pulseUniqueUsers} unique · {data.engagement.pulsePctOfDau}% of users</div>
          </div>
          <div style={cardStyle}>
            <span className="kicker">Team Mirror</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{data.engagement.mirrorViews} views</div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>{data.engagement.mirrorUniqueUsers} unique · {data.engagement.mirrorPctOfDau}% of users</div>
          </div>
          <div style={cardStyle}>
            <span className="kicker">Guidance</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{data.engagement.guidanceViews} views</div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>{data.engagement.guidanceUniqueUsers} unique · {data.engagement.guidancePctOfDau}% of users</div>
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--subtle)", marginTop: 8 }}>
          Time-spent and click-through aren&apos;t instrumented yet — these are view counts only.
        </p>
      </section>

      {/* Activation funnel */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Activation funnel</h2>
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.funnel.map((step, i) => (
            <div key={step.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                <span style={{ color: i === biggestDropIdx ? "var(--danger)" : "var(--text)" }}>
                  {step.label} {i === biggestDropIdx && "← biggest drop-off"}
                </span>
                <span style={{ color: "var(--subtle)" }}>{step.count} ({step.pct}%)</span>
              </div>
              <div style={{ background: "var(--surface-muted)", borderRadius: 6, height: 8, width: "100%" }}>
                <div style={{
                  width: `${maxFunnelCount > 0 ? (step.count / maxFunnelCount) * 100 : 0}%`,
                  background: i === biggestDropIdx ? "var(--danger)" : "var(--accent)",
                  height: 8, borderRadius: 6
                }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Costs */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Costs (7d) — total ${totalCost7d.toFixed(4)}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={cardStyle}>
            <span className="kicker" style={{ marginBottom: 8, display: "block" }}>By call type</span>
            {data.costs.byType.length === 0 ? <p style={{ color: "var(--subtle)", fontSize: "0.85rem" }}>No calls logged yet.</p> : (
              <div className="list" style={{ gap: 6 }}>
                {data.costs.byType.map((c) => (
                  <div key={c.callType} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span><CallTypeLabel type={c.callType} /> ({c.calls})</span>
                    <span>
                      ${c.estimatedCost.toFixed(4)}
                      {c.cacheHitRate !== null && <span style={{ color: "var(--subtle)" }}> · {c.cacheHitRate}% cache hit</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={cardStyle}>
            <span className="kicker" style={{ marginBottom: 8, display: "block" }}>By team (top 10)</span>
            {data.costs.byTeam.length === 0 ? <p style={{ color: "var(--subtle)", fontSize: "0.85rem" }}>No team-attributed spend yet.</p> : (
              <div className="list" style={{ gap: 6 }}>
                {data.costs.byTeam.map((c) => (
                  <div key={c.roomId} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>{c.teamName}</span>
                    <span>${c.estimatedCost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top feedback */}
      <section>
        <h2 style={{ marginBottom: 14, fontSize: "1.1rem" }}>Top feedback signals</h2>
        <div style={cardStyle}>
          {data.topFeedback.length === 0 ? (
            <p style={{ color: "var(--subtle)" }}>No feedback recorded yet.</p>
          ) : (
            <div className="list" style={{ gap: 6 }}>
              {data.topFeedback.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{f.targetType} — {f.action}</span>
                  <span style={{ color: "var(--subtle)" }}>{f.count}×</span>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: "0.75rem", color: "var(--subtle)", marginTop: 8 }}>
            Grouped by (target, action) frequency — the feedback table doesn&apos;t store free-text complaints yet.
          </p>
        </div>
      </section>
    </div>
  );
}

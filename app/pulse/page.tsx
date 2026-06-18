import { FeedbackActions } from "@/components/feedback-actions";
import { getPulseResponse } from "@/lib/store";

export default async function PulsePage() {
  const pulse = await getPulseResponse();

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Community Pulse</span>
        <h1>What your community is paying attention to.</h1>
        <p>
          {pulse.storageMode === "database"
            ? "Anonymous signals from people with similar attention patterns, aggregated in real time. No posts. No opinions. Just attention."
            : "Your own attention signals, grouped into topics. Connect with others to see a real community pulse."}
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Updated</span>
            <div>{new Date(pulse.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Window</span>
            <div>Last 24 hours</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Source</span>
            <div>{pulse.storageMode === "database" ? "Live signals" : "Demo data"}</div>
          </div>
        </div>
      </section>

      {pulse.trends.length === 0 ? (
        <section className="panel">
          <h2>No trends yet</h2>
          <p>
            Browse a few pages with the extension active, then refresh. Trends appear once
            enough signal accumulates across the community.
          </p>
        </section>
      ) : (
        <section className="grid two">
          {pulse.trends.map((trend) => (
            <div key={trend.id} className="panel glow-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="kicker">{trend.timeWindow} · {trend.category}</span>
                  <h2 style={{ marginBottom: 0 }}>{trend.topicLabel}</h2>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="metric" style={{ fontSize: "1.8rem", color: "var(--accent)" }}>
                    {trend.trendScore.toFixed(0)}
                  </div>
                  <div className="score-note">score</div>
                </div>
              </div>

              <div className="tag-row" style={{ marginBottom: 16 }}>
                {trend.topicTags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div className="meta-card">
                  <span className="kicker">Signals</span>
                  <strong style={{ fontSize: "1.2rem" }}>{trend.anonymousSignals}</strong>
                </div>
                <div className="meta-card">
                  <span className="kicker">Growth</span>
                  <strong style={{ fontSize: "1.2rem", color: trend.changePct > 0 ? "var(--teal)" : "var(--muted)" }}>
                    {trend.changePct > 0 ? "+" : ""}{Math.round(trend.changePct)}%
                  </strong>
                </div>
              </div>

              <p style={{ marginBottom: 14, fontSize: "0.88rem" }}>{trend.explanation}</p>

              <FeedbackActions
                targetType="pulse"
                targetId={trend.id}
                actions={["good-catch", "not-relevant", "hide-topic"]}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

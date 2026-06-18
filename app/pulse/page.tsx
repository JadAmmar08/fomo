import { FeedbackActions } from "@/components/feedback-actions";
import { getPulseResponse } from "@/lib/store";

export default async function PulsePage() {
  const pulse = await getPulseResponse();

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Pulse</span>
        <h1>Your current attention, grouped into live pulses.</h1>
        <p>
          Pulse now reflects only your own tracked signals on this local setup, so there are no
          fake community topics mixed in.
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Generated</span>
            <div>{new Date(pulse.generatedAt).toLocaleString()}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Source</span>
            <div>{pulse.storageMode === "database" ? "Your saved signals" : "Your local signals"}</div>
          </div>
        </div>
      </section>

      <section className="grid two">
        {pulse.trends.length === 0 ? (
          <div className="panel">
            <h2>No pulses yet</h2>
            <p>Browse a few safe pages with tracking on, then refresh this page.</p>
          </div>
        ) : null}
        {pulse.trends.map((trend) => (
          <div key={trend.id} className="panel glow-panel">
            <div className="stat-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p className="kicker">{trend.timeWindow}</p>
                <h2>{trend.topicLabel}</h2>
                <p className="score-note">AI topic pulse</p>
              </div>
              <p className="metric" style={{ fontSize: "2rem" }}>
                {trend.trendScore.toFixed(1)}
              </p>
            </div>
            <div className="grid two">
              <div className="item">
                <p className="kicker">Anonymous signals</p>
                <strong>{trend.anonymousSignals}</strong>
              </div>
              <div className="item">
                <p className="kicker">Unique users</p>
                <strong>{trend.uniqueUsers}</strong>
              </div>
            </div>
            <div className="signal-meta">
              <div className="meta-card">
                <span className="kicker">Growth</span>
                <div>{Math.round(trend.changePct)}%</div>
              </div>
              <div className="meta-card">
                <span className="kicker">Why now</span>
                <div>Recent volume + recency inside your own browsing</div>
              </div>
              <div className="meta-card">
                <span className="kicker">View</span>
                <div>Personal pulse only</div>
              </div>
            </div>
            <div className="tag-row" style={{ marginTop: 14 }}>
              {trend.topicTags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
            <p style={{ marginTop: 16 }}>{trend.explanation}</p>
            <FeedbackActions
              targetType="pulse"
              targetId={trend.id}
              actions={["good-catch", "not-relevant", "hide-topic"]}
            />
          </div>
        ))}
      </section>
    </div>
  );
}

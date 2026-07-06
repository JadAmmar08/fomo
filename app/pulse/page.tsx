import { FeedbackActions } from "@/components/feedback-actions";
import { getPulseResponse } from "@/lib/store";
import type { PresentedTrend } from "@/lib/trends";

export default async function PulsePage() {
  const pulse = await getPulseResponse();
  const trends = (pulse.trends as PresentedTrend[]).slice(0, 10);

  return (
    <div>
      {/* Header */}
      <section style={{ padding: "70px 0 56px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Community pulse
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", maxWidth: 760, margin: "0 auto 6px", lineHeight: 1.02 }}>
          What your community is
        </h1>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", margin: "0 auto 24px", lineHeight: 1.05 }}>
          paying attention to.
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto 28px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          {pulse.storageMode === "database"
            ? "Anonymous signals from people with similar attention patterns, aggregated in real time. No posts. No opinions. Just attention."
            : "Your own attention signals, grouped into topics. Connect with others to see a real community pulse."}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--subtle)", fontSize: "0.75rem", marginRight: 6 }}>UPDATED</span>
            {new Date(pulse.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--subtle)", fontSize: "0.75rem", marginRight: 6 }}>WINDOW</span>
            Last 24 hours
          </span>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>
            {pulse.storageMode === "database" ? "Live signals" : "Demo data"}
          </span>
        </div>
      </section>

      {trends.length === 0 ? (
        <section data-reveal style={{
          background: "white", borderRadius: 20, border: "1px solid var(--line)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "56px 48px", textAlign: "center"
        }}>
          <h2>Nothing yet — you&apos;re early.</h2>
          <p style={{ maxWidth: 420, margin: "0 auto" }}>
            Browse a few pages with the extension active, then refresh. Trends appear once enough signal accumulates across the community.
          </p>
        </section>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {trends.map((trend, i) => (
            <div key={trend.id} data-reveal data-reveal-delay={`${Math.min(i, 4) * 60}`} style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid var(--line)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
              padding: "36px 40px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {trend.isPersonalized && (
                    <span className="pill" style={{ fontSize: "0.72rem" }}>close to your interests</span>
                  )}
                  <span className="kicker" style={{ marginBottom: 0 }}>{trend.category}</span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", color: "var(--accent)" }}>{trend.trendScore.toFixed(0)}</span>
                  <span className="score-note" style={{ marginLeft: 6 }}>score</span>
                </div>
              </div>

              <h2 style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", lineHeight: 1.1, marginBottom: 14 }}>
                {trend.topicLabel}
              </h2>

              <p style={{ fontSize: "1.02rem", lineHeight: 1.7, color: "var(--muted)", marginBottom: 20, maxWidth: 640 }}>
                {trend.narrative}
              </p>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: "var(--text)" }}>{trend.uniqueUsers}</strong> {trend.uniqueUsers === 1 ? "person" : "people"}
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: "var(--text)" }}>{trend.anonymousSignals}</strong> signals
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: trend.changePct > 0 ? "var(--accent)" : "var(--text)" }}>
                    {trend.changePct > 0 ? "+" : ""}{Math.round(trend.changePct)}%
                  </strong> growth
                </span>
              </div>

              <FeedbackActions
                targetType="pulse"
                targetId={trend.id}
                actions={["good-catch", "not-relevant", "hide-topic"]}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

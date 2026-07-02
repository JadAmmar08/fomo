import { FeedbackActions } from "@/components/feedback-actions";
import { getPulseResponse } from "@/lib/store";

export default async function PulsePage() {
  const pulse = await getPulseResponse();

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
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", margin: "0 auto 24px", lineHeight: 1.05, fontStyle: "italic", color: "var(--accent)" }}>
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

      {pulse.trends.length === 0 ? (
        <section data-reveal style={{
          background: "white", borderRadius: 20, border: "1px solid var(--line)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "56px 48px", textAlign: "center"
        }}>
          <h2>Nothing yet — <span style={{ color: "var(--accent)" }}>you&apos;re early.</span></h2>
          <p style={{ maxWidth: 420, margin: "0 auto" }}>
            Browse a few pages with the extension active, then refresh. Trends appear once enough signal accumulates across the community.
          </p>
        </section>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {pulse.trends.map((trend, i) => (
            <div key={trend.id} data-reveal data-reveal-delay={`${(i % 2) * 90}`} style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid var(--line)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
              padding: "32px 34px",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="kicker" style={{ marginBottom: 8 }}>{trend.timeWindow} · {trend.category}</span>
                  <h2 style={{ marginBottom: 0, fontSize: "1.5rem", lineHeight: 1.2 }}>{trend.topicLabel}</h2>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: "2.4rem", color: "var(--accent)", lineHeight: 1 }}>
                    {trend.trendScore.toFixed(0)}
                  </div>
                  <div className="score-note">score</div>
                </div>
              </div>

              {trend.topicTags.length > 0 && (
                <div className="tag-row" style={{ marginBottom: 18 }}>
                  {trend.topicTags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <div className="meta-card">
                  <span className="kicker">Signals</span>
                  <strong style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem" }}>{trend.anonymousSignals}</strong>
                </div>
                <div className="meta-card">
                  <span className="kicker">Growth</span>
                  <strong style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", color: trend.changePct > 0 ? "var(--accent)" : "var(--muted)" }}>
                    {trend.changePct > 0 ? "+" : ""}{Math.round(trend.changePct)}%
                  </strong>
                </div>
              </div>

              <p style={{ marginBottom: 18, fontSize: "0.92rem", lineHeight: 1.7, flex: 1 }}>{trend.explanation}</p>

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

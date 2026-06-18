import { FeedbackActions } from "@/components/feedback-actions";
import { getMirror } from "@/lib/store";
import { formatPercent } from "@/lib/utils";

export default async function MirrorPage() {
  const mirror = await getMirror();

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Private Mirror</span>
        <h1>What your attention reveals about you.</h1>
        <p>
          Built entirely from what you pay attention to — not what you post or say.
          This data never leaves your session without your permission.
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Session</span>
            <div className="mono">{mirror.user.anonymousUserId.slice(0, 16)}…</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Storage</span>
            <div>{mirror.storageMode === "database" ? "Persistent" : "Demo"}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Tracked topics</span>
            <div>{mirror.interests.length}</div>
          </div>
        </div>
      </section>

      {mirror.interests.length > 0 ? (
        <section className="panel">
          <h2>Detected interests</h2>
          <p style={{ marginBottom: 20 }}>
            Topics FOMO inferred from your attention patterns. The stronger the signal, the more consistently you returned to it.
          </p>
          <div className="list">
            {mirror.interests.map((interest) => (
              <div key={interest.id} className="item">
                <div className="interest-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ marginBottom: 4 }}>{interest.topicLabel}</h3>
                    <div className="interest-badges">
                      <span className="pill">{interest.change}</span>
                      <span className="chip">{interest.signalCount} signals</span>
                      <span className="chip">{interest.shareable ? "In pulse" : "Mirror only"}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <strong style={{ fontSize: "1.1rem" }}>{formatPercent(interest.confidence)}</strong>
                    <div className="score-note">Feedback {interest.feedbackScore >= 0 ? "+" : ""}{interest.feedbackScore.toFixed(2)}</div>
                  </div>
                </div>
                <div className="progress" style={{ margin: "12px 0" }}>
                  <span style={{ width: `${interest.confidence * 100}%` }} />
                </div>
                <div className="tag-row" style={{ marginBottom: 10 }}>
                  {interest.topicTags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
                <p style={{ marginBottom: 10, fontSize: "0.88rem" }}>{interest.reasoning}</p>
                <FeedbackActions
                  targetType="mirror"
                  targetId={interest.id}
                  actions={["this-is-wrong", "hide-topic", "more-like-this", "good-catch"]}
                />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>No interests yet</h2>
          <p>Browse a few pages with the extension active. Your mirror builds up as signals accumulate.</p>
        </section>
      )}

      {mirror.recentSignals.length > 0 && (
        <section className="panel">
          <h2>Recent signals</h2>
          <p style={{ marginBottom: 20 }}>The raw attention data feeding your mirror.</p>
          <div className="list">
            {mirror.recentSignals.map((signal) => (
              <div key={signal.id} className="item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div>
                    <h3 style={{ marginBottom: 2 }}>{signal.topicLabel}</h3>
                    <span className="kicker">{signal.normalizedDomain}</span>
                  </div>
                  <span className="subtle" style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                    {new Date(signal.timestampBucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="tag-row">
                  {signal.topicTags.map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

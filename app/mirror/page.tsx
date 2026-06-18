import { FeedbackActions } from "@/components/feedback-actions";
import { getMirror } from "@/lib/store";
import { formatPercent } from "@/lib/utils";

export default async function MirrorPage() {
  const mirror = await getMirror();

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Private Mirror</span>
        <h1>Your AI-generated attention map.</h1>
        <p>
          FOMO now centers everything on AI topic labels instead of broad categories, so each card
          is meant to reflect a specific thing you were actually looking at.
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Anonymous session</span>
            <div className="mono">{mirror.user.anonymousUserId}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Storage mode</span>
            <div>{mirror.storageMode === "database" ? "Persistent" : "Demo fallback"}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Tracked topics</span>
            <div>{mirror.interests.length}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Detected interests</h2>
        <div className="list">
          {mirror.interests.map((interest) => (
            <div key={interest.id} className="item">
              <div className="interest-header">
                <div>
                  <h3 style={{ marginBottom: 4 }}>{interest.topicLabel}</h3>
                  <div className="interest-badges">
                    <span className="pill">{interest.change}</span>
                    <span className="chip">{interest.signalCount} signals</span>
                    <span className="chip">{interest.shareable ? "In pulse" : "Mirror only"}</span>
                  </div>
                </div>
                <div>
                  <strong>{formatPercent(interest.confidence)}</strong>
                  <div className="score-note">Feedback {interest.feedbackScore >= 0 ? "+" : ""}{interest.feedbackScore.toFixed(2)}</div>
                </div>
              </div>
              <div className="progress" style={{ margin: "14px 0" }}>
                <span style={{ width: `${interest.confidence * 100}%` }} />
              </div>
              <div className="tag-row" style={{ marginBottom: 12 }}>
                {interest.topicTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
              <p>{interest.reasoning}</p>
              <FeedbackActions
                targetType="mirror"
                targetId={interest.id}
                actions={["this-is-wrong", "hide-topic", "more-like-this", "good-catch"]}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Contributing signals</h2>
        <div className="list">
          {mirror.recentSignals.map((signal) => (
            <div key={signal.id} className="item">
              <p className="kicker">{signal.timestampBucket}</p>
              <h3>{signal.topicLabel}</h3>
              <div className="signal-meta">
                <div className="meta-card">
                  <span className="kicker">Domain</span>
                  <div>{signal.normalizedDomain}</div>
                </div>
                <div className="meta-card">
                  <span className="kicker">Path</span>
                  <div className="mono">{signal.urlPath}</div>
                </div>
              </div>
              <div className="tag-row" style={{ margin: "12px 0" }}>
                {signal.topicTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
              <p style={{ marginBottom: 0 }}>{signal.reasoning}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

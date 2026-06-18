import { FeedbackActions } from "@/components/feedback-actions";
import { getMirror } from "@/lib/store";
import { formatPercent } from "@/lib/utils";

export default async function MirrorPage() {
  const mirror = await getMirror();

  return (
    <div className="stack">
      <section className="panel">
        <span className="eyebrow">Private Mirror</span>
        <h1>How FOMO sees you.</h1>
        <p>
          Based on what you pay attention to, FOMO places you in communities and
          surfaces the pulse of those communities to you. This is your representation: not what you say, but what you consistently look at.
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Member since</span>
            <div>{new Date(mirror.user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Storage</span>
            <div>{mirror.storageMode === "database" ? "Persistent" : "Demo"}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Communities</span>
            <div>{mirror.communities.length}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Tracked topics</span>
            <div>{mirror.interests.length}</div>
          </div>
        </div>
      </section>

      {/* Community placement the main profile section */}
      {mirror.communities.length > 0 ? (
        <section className="panel">
          <span className="eyebrow">Your placement</span>
          <h2>Communities FOMO places you in</h2>
          <p style={{ marginBottom: 20 }}>
            These are inferred automatically from your attention patterns. You never chose them.
            They determine which pulse signals get surfaced to you.
          </p>
          <div className="grid two">
            {mirror.communities.map((community) => (
              <div key={community.id} className="item" style={{ borderColor: "rgba(58,184,170,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <h3 style={{ marginBottom: 0 }}>{community.name}</h3>
                  <strong style={{ color: "var(--accent)", flexShrink: 0 }}>
                    {formatPercent(community.confidence)}
                  </strong>
                </div>
                <div className="progress" style={{ marginBottom: 12 }}>
                  <span style={{ width: `${community.confidence * 100}%` }} />
                </div>
                <p style={{ fontSize: "0.88rem", marginBottom: 10 }}>{community.description}</p>
                <div className="tag-row">
                  {community.primaryCategories.map((cat) => (
                    <span key={cat} className="pill">{cat}</span>
                  ))}
                </div>
                <p style={{ fontSize: "0.78rem", color: "var(--subtle)", marginTop: 10, marginBottom: 0 }}>
                  {community.signal}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel">
          <span className="eyebrow">Your placement</span>
          <h2>No community placement yet</h2>
          <p>
            FOMO places you in communities based on your attention patterns. Keep browsing
            with the extension active. Your placement emerges over time.
          </p>
        </section>
      )}

      {/* Interests */}
      {mirror.interests.length > 0 ? (
        <section className="panel">
          <h2>Attention topics</h2>
          <p style={{ marginBottom: 20 }}>
            The specific topics shaping your community placement and pulse feed.
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
          <h2>No topics yet</h2>
          <p>Browse a few pages with the extension active. Your mirror builds up as signals accumulate.</p>
        </section>
      )}

      {/* Recent signals */}
      {mirror.recentSignals.length > 0 && (
        <section className="panel">
          <h2>Recent signals</h2>
          <p style={{ marginBottom: 20 }}>The raw attention data feeding your mirror and community placement.</p>
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

export const runtime = "nodejs";

import { getMirror } from "@/lib/store";
import { formatPercent } from "@/lib/utils";
import Link from "next/link";

export default async function MirrorPage() {
  const mirror = await getMirror();

  const topInterests = mirror.interests.slice(0, 5);
  const totalSignals = mirror.interests.reduce((sum, i) => sum + i.signalCount, 0);
  const profile = mirror.personalProfile;

  return (
    <div className="stack">

      {/* Hero */}
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Private Mirror</span>
        {profile ? (
          <>
            <h1 style={{ maxWidth: 560, marginTop: 12 }}>{profile.headline}</h1>
            <p style={{ maxWidth: 500, marginBottom: 16 }}>{profile.description}</p>
            <div className="tag-row">
              {profile.evidenceTags.map((tag) => (
                <span key={tag} className="pill">{tag}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ maxWidth: 560 }}>This is how you appear on the pulse.</h1>
            <p style={{ maxWidth: 500, marginBottom: 0 }}>
              FOMO watches what you pay attention to and builds your identity from it. Keep browsing — your profile emerges over time.
            </p>
          </>
        )}
      </section>

      {/* Community placement */}
      {mirror.communities.length > 0 ? (
        <section className="panel">
          <span className="eyebrow">Your communities</span>
          <h2>Where FOMO places you on the pulse</h2>
          <p style={{ marginBottom: 24 }}>
            These communities are inferred from your attention — never self-reported. They determine whose pulse you share and who shares yours.
          </p>
          <div className="grid two">
            {mirror.communities.map((community) => (
              <div key={community.id} className="card" style={{ borderColor: "rgba(58,184,170,0.2)", background: "var(--surface)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ marginBottom: 0, fontSize: "1rem" }}>{community.name}</h3>
                  <strong style={{ color: "var(--accent)", flexShrink: 0, fontSize: "0.9rem" }}>
                    {formatPercent(community.confidence)}
                  </strong>
                </div>
                <div className="progress" style={{ marginBottom: 10 }}>
                  <span style={{ width: `${community.confidence * 100}%` }} />
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--subtle)", marginBottom: 10 }}>{community.description}</p>
                <div className="tag-row">
                  {community.primaryCategories.map((cat) => (
                    <span key={cat} className="pill">{cat}</span>
                  ))}
                </div>
                {community.signal && (
                  <p style={{ fontSize: "0.78rem", color: "var(--subtle)", marginTop: 10, marginBottom: 0 }}>
                    {community.signal}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <Link href="/pulse" className="button-secondary" style={{ display: "inline-flex" }}>
              See your pulse
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel" style={{ background: "var(--surface)" }}>
          <span className="eyebrow">Your communities</span>
          <h2>No placement yet</h2>
          <p>
            FOMO places you in communities as your attention patterns build up. Keep browsing with the extension active — your placement emerges over time.
          </p>
        </section>
      )}

      {/* What's driving your placement */}
      {topInterests.length > 0 && (
        <section className="panel">
          <span className="eyebrow">What's putting you there</span>
          <h2>Your top attention signals</h2>
          <p style={{ marginBottom: 24 }}>
            These are the topics feeding your profile. The more time you spend on something, the stronger the signal.
          </p>
          <div className="list">
            {topInterests.map((interest, i) => (
              <div key={interest.id} className="item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--accent-soft)", border: "1px solid var(--accent)",
                      color: "var(--accent)", fontWeight: 700, fontSize: "0.8rem",
                      display: "grid", placeItems: "center", flexShrink: 0
                    }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ marginBottom: 2, fontSize: "0.95rem" }}>{interest.topicLabel}</h3>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="kicker">{interest.signalCount} visits</span>
                        <span className="kicker" style={{ color: interest.change === "rising" ? "var(--accent)" : "var(--subtle)" }}>
                          {interest.change}
                        </span>
                        <span className="kicker">{interest.shareable ? "On the pulse" : "Mirror only"}</span>
                      </div>
                    </div>
                  </div>
                  <strong style={{ color: "var(--accent)", flexShrink: 0 }}>
                    {formatPercent(interest.confidence)}
                  </strong>
                </div>
                <div className="progress" style={{ margin: "10px 0" }}>
                  <span style={{ width: `${interest.confidence * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats strip */}
      <section className="panel">
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Member since</span>
            <div>{new Date(mirror.user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Total signals</span>
            <div>{totalSignals}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Communities</span>
            <div>{mirror.communities.length}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Mode</span>
            <div>{mirror.storageMode === "database" ? "Persistent" : "Demo"}</div>
          </div>
        </div>
      </section>

    </div>
  );
}

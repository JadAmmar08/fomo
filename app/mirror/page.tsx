export const runtime = "nodejs";

import { getMirror } from "@/lib/store";
import { hasExistingSession } from "@/lib/session";
import { formatPercent } from "@/lib/utils";
import Link from "next/link";
import type { Route } from "next";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
      <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
      {children}
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 20,
  border: "1px solid var(--line)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
} as const;

export default async function MirrorPage({ searchParams }: { searchParams: Promise<{ uid?: string }> }) {
  const params = await searchParams;
  const sessionExists = params.uid || await hasExistingSession();
  if (!sessionExists) {
    return (
      <div>
        <section style={{ padding: "90px 0", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            Private mirror
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          </div>
          <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", maxWidth: 700, margin: "0 auto 24px", lineHeight: 1.02 }}>
            Install the extension to <span>meet your mirror.</span>
          </h1>
          <p style={{ maxWidth: 440, margin: "0 auto 40px", fontSize: "1.05rem", lineHeight: 1.7 }}>
            Your mirror builds automatically from your browsing. Install the FOMO extension, browse for a bit, then come back here.
          </p>
          <Link href="/download" className="button" style={{ fontSize: "1rem", padding: "16px 36px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
            Get the extension
          </Link>
        </section>
      </div>
    );
  }

  const mirror = await getMirror(params.uid);

  const topInterests = mirror.interests.slice(0, 5);
  const totalSignals = mirror.interests.reduce((sum, i) => sum + i.signalCount, 0);
  const profile = mirror.personalProfile;

  return (
    <div className="stack" style={{ gap: 24 }}>

      {/* Hero */}
      <section style={{ padding: "64px 0 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Private mirror
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        {profile ? (
          <>
            <h1 style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", maxWidth: 820, margin: "0 auto 20px", lineHeight: 1.05 }}>
              {profile.headline}
            </h1>
            <p style={{ maxWidth: 540, margin: "0 auto 24px", fontSize: "1.1rem", lineHeight: 1.75, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--muted)" }}>
              {profile.description}
            </p>
            <div className="tag-row" style={{ justifyContent: "center" }}>
              {profile.evidenceTags.map((tag) => (
                <span key={tag} className="pill">{tag}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", maxWidth: 700, margin: "0 auto 20px", lineHeight: 1.05 }}>
              Your profile is <span>building.</span>
            </h1>
            <p style={{ maxWidth: 460, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
              Browse normally for a bit. FOMO is watching your attention in the background. Come back in an hour and your profile will be here.
            </p>
          </>
        )}
      </section>

      {/* Communities */}
      {mirror.communities.length > 0 ? (
        <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
          <SectionLabel>Your communities</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 8 }}>
            Where FOMO <span>places you.</span>
          </h2>
          <p style={{ marginBottom: 28, maxWidth: 560 }}>
            Inferred from your attention, never self-reported. These determine whose pulse you share and who shares yours.
          </p>
          <div className="grid two">
            {mirror.communities.map((community) => (
              <div key={community.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 16, padding: "22px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                  <h3 style={{ marginBottom: 0, fontSize: "1.05rem" }}>{community.name}</h3>
                  <strong style={{ fontFamily: "var(--font-serif)", color: "var(--accent)", flexShrink: 0, fontSize: "1.2rem" }}>
                    {formatPercent(community.confidence)}
                  </strong>
                </div>
                <div className="progress" style={{ marginBottom: 12 }}>
                  <span style={{ width: `${community.confidence * 100}%` }} />
                </div>
                <p style={{ fontSize: "0.88rem", marginBottom: 12 }}>{community.description}</p>
                <div className="tag-row">
                  {community.primaryCategories.map((cat) => (
                    <span key={cat} className="chip">{cat}</span>
                  ))}
                </div>
                {community.signal && (
                  <p style={{ fontSize: "0.8rem", color: "var(--subtle)", marginTop: 12, marginBottom: 0 }}>
                    {community.signal}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <Link href={"/rooms" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
              Join a room →
            </Link>
          </div>
        </section>
      ) : (
        <section data-reveal style={{ ...cardStyle, padding: "48px 44px", textAlign: "center" }}>
          <h2>Still <span>watching...</span></h2>
          <p style={{ maxWidth: 460, margin: "0 auto" }}>
            Browse normally for an hour and FOMO will place you in communities based on what you actually pay attention to.
          </p>
        </section>
      )}

      {/* Top signals */}
      {topInterests.length > 0 && (
        <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
          <SectionLabel>What&apos;s putting you there</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 8 }}>
            Your top attention signals.
          </h2>
          <p style={{ marginBottom: 28, maxWidth: 560 }}>
            The topics feeding your profile. The more time you spend on something, the stronger the signal.
          </p>
          <div className="list">
            {topInterests.map((interest, i) => (
              <div key={interest.id} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "var(--font-serif)", fontStyle: "italic",
                      fontSize: "1.4rem", color: "var(--accent)", opacity: 0.5,
                      width: 30, flexShrink: 0
                    }}>{String(i + 1).padStart(2, "0")}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ marginBottom: 2, fontSize: "0.98rem" }}>{interest.topicLabel}</h3>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span className="kicker" style={{ marginBottom: 0 }}>{interest.signalCount} visits</span>
                        <span className="kicker" style={{ marginBottom: 0, color: interest.change === "rising" ? "var(--accent)" : "var(--subtle)" }}>
                          {interest.change}
                        </span>
                        <span className="kicker" style={{ marginBottom: 0 }}>{interest.shareable ? "On the pulse" : "Mirror only"}</span>
                      </div>
                    </div>
                  </div>
                  <strong style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", color: "var(--accent)", flexShrink: 0 }}>
                    {formatPercent(interest.confidence)}
                  </strong>
                </div>
                <div className="progress" style={{ marginTop: 12 }}>
                  <span style={{ width: `${interest.confidence * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats strip */}
      <section data-reveal style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", overflow: "hidden" }}>
        {[
          { label: "Member since", value: new Date(mirror.user.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) },
          { label: "Total signals", value: String(totalSignals) },
          { label: "Communities", value: String(mirror.communities.length) },
          { label: "Mode", value: mirror.storageMode === "database" ? "Persistent" : "Demo" },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: "28px 20px", textAlign: "center", borderRight: i < 3 ? "1px solid var(--line)" : undefined }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Share */}
      <section data-reveal style={{ padding: "56px 0 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", marginBottom: 12 }}>
          Know someone who&apos;d <span>find this interesting?</span>
        </h2>
        <p style={{ marginBottom: 32, fontSize: "1rem" }}>The more people on FOMO, the better everyone&apos;s pulse gets.</p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <a
            href={`sms:&body=Check out FOMO. It shows you what your community is actually paying attention to online. Install it here: https://usefomo.net/download`}
            className="button"
          >
            Text a friend
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=Just%20started%20using%20FOMO.%20It%20shows%20you%20what%20your%20community%20is%20actually%20paying%20attention%20to%20online.%20Try%20it%3A%20https%3A%2F%2Fusefomo.net`}
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
            style={{ background: "white" }}
          >
            Share on X
          </a>
        </div>
      </section>

    </div>
  );
}

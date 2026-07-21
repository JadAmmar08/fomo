import { HeroCta, BottomCta } from "@/components/hero-cta";

export default function LandingPage() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: "110px 0 72px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 40, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Give every project team a shared research brain.
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.8rem)", maxWidth: 900, margin: "0 auto 36px", lineHeight: 0.98, letterSpacing: "-0.03em" }}>
          Your team knows more than it realizes.
        </h1>
        <p style={{ maxWidth: 560, margin: "0 auto 44px", fontSize: "1.2rem", lineHeight: 1.7, color: "var(--muted)" }}>
          Create a private FOMO for any project. As everyone researches normally, FOMO connects their findings, flags contradictions, and shows the team what to resolve next.
        </p>
        <HeroCta />
        <p style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>Free forever. Anonymous by design. Zero extra work.</p>
      </section>

      {/* Concrete value props */}
      <section data-reveal style={{ padding: "40px 0 90px", borderTop: "1px solid var(--line)" }}>
        <div className="grid three" style={{ gap: 24 }}>
          {[
            { title: "Shorter meetings.", body: "Open it at the start of the call. Nobody spends the first ten minutes catching everyone up, the team already knows what everyone found." },
            { title: "Fewer blind spots.", body: "See when two people are independently converging on the same problem, or missing something the other already knows." },
            { title: "No setup for a project team.", body: "Spin one up for a case, a diligence sprint, or a research assignment. Archive it when the project ends." },
          ].map((v) => (
            <div key={v.title} style={{ padding: "32px 8px" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: 10 }}>{v.title}</h3>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.75 }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The pulse — text left, product card right */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 80, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            The pulse
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Not a feed. A finding.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.8, marginBottom: 28, maxWidth: 420 }}>
            FOMO doesn&apos;t just show you what&apos;s trending. It tells you why it matters, framed as a real tension, a blind spot, an opportunity, or a question worth answering.
          </p>
          <div style={{ display: "grid", gap: 16 }}>
            {[
              { title: "Zero extra work.", body: "People just browse normally. No posting, no summarizing, no meetings to compare notes." },
              { title: "Never who found what.", body: "Only how it connects. Anonymous by design, so people participate honestly." },
              { title: "Ranked by insight, not popularity.", body: "One sharp connection beats ten obvious ones. FOMO would rather say nothing than pad the list." },
            ].map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, marginTop: 3 }}>✓</span>
                <p style={{ fontSize: "0.95rem", lineHeight: 1.7 }}><strong style={{ color: "var(--text)" }}>{f.title}</strong> {f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Product mockup card — the actual connections engine output */}
        <div style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 32px 90px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 26px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Team Pulse</div>
              <div style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>Biotech Research Team</div>
            </div>
            <span className="pill" style={{ fontSize: "0.75rem" }}>● Live</span>
          </div>
          <div style={{ padding: "22px 26px", display: "grid", gap: 14 }}>
            {[
              { label: "Tension", color: "var(--tension)", bg: "var(--tension-soft)", from: "In-Vivo Delivery Research", to: "Regulatory Precedent", body: "The science side is prioritizing an in-vivo approach, but every comparable approved program used ex-vivo delivery. Worth resolving before it changes the timeline." },
              { label: "Blind spot", color: "var(--blindspot)", bg: "var(--blindspot-soft)", from: "Patent Coverage", to: "Valuation Model", body: "The valuation assumes seven years of exclusivity, but the strongest composition claims expire in four." },
            ].map((c) => (
              <div key={c.label} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: `3px solid ${c.color}`, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{c.from} <span style={{ color: "var(--accent)", fontWeight: 400 }}>↔</span> {c.to}</span>
                </div>
                <span className="pill" style={{ fontSize: "0.68rem", fontWeight: 600, marginBottom: 8, display: "inline-flex", color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>{c.label}</span>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: 0, color: "var(--text-strong)" }}>{c.body}</p>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <span className="chip">anonymous</span>
              <span className="chip">auto-found</span>
              <span className="chip">2 people, independently</span>
            </div>
          </div>
        </div>
      </section>

      {/* Individual guidance — kept as a small supporting note, not a full section,
          so it doesn't compete with the core team-connections pitch */}
      <section data-reveal style={{ padding: "44px 0", borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, maxWidth: 780, margin: "0 auto" }}>
          <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>◐</span>
          <p style={{ fontSize: "0.98rem", lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
            <strong style={{ color: "var(--text)" }}>Start before the whole team joins.</strong> FOMO begins organizing your project research immediately, then starts finding cross-team connections as collaborators arrive.
          </p>
        </div>
      </section>

      {/* The mirror — text left, product card right (keeps the alternating rhythm) */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 80, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            The mirror
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Not a snapshot. A memory.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.8, maxWidth: 420 }}>
            Every team gets an evolving model of what it currently believes, what&apos;s been reinforced, and what nobody&apos;s challenged in a while. It gets sharper the longer the team uses it, and a new member can read it and be caught up in minutes.
          </p>
        </div>

        {/* Product mockup card — the actual team mirror output */}
        <div style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 32px 90px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 26px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Team Mirror</div>
              <div style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>Biotech Research Team</div>
            </div>
            <span className="pill" style={{ fontSize: "0.75rem" }}>Evolving</span>
          </div>
          <div style={{ padding: "22px 26px" }}>
            <span className="kicker" style={{ marginBottom: 12, display: "block" }}>Working theses</span>
            <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
              {[
                "The in-vivo delivery approach is the team's default, pending regulatory resolution.",
                "The acquisition price ceiling assumes seven years of exclusivity.",
              ].map((t, i) => (
                <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--implication)", borderRadius: 14, padding: "14px 18px" }}>
                  <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: 0, color: "var(--text-strong)" }}>{t}</p>
                </div>
              ))}
            </div>
            <span className="kicker" style={{ marginBottom: 12, display: "block" }}>Blind spots</span>
            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--blindspot)", borderRadius: 14, padding: "14px 18px" }}>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: 0, color: "var(--text-strong)" }}>Nobody has revisited the exclusivity assumption since the patent research surfaced the four-year expiry.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section data-reveal style={{ padding: "90px 0 100px", borderTop: "1px solid var(--line)" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            How it works
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          </div>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.05 }}>
            Three steps. No friction.
          </h2>
        </div>
        <div className="grid three" style={{ gap: 24 }}>
          {[
            { n: "01", title: "Install. Work normally.", body: "A lightweight Chrome extension runs silently in the background. No workspace setup, no integrations, no manual updates." },
            { n: "02", title: "Invite your team.", body: "A private, invite-only team. Nobody sees who found what, only how it connects." },
            { n: "03", title: "Open it at your next meeting.", body: "Real connections between separate research, plus an evolving model of what the team believes, ready before anyone says a word." },
          ].map((step) => (
            <div key={step.n} style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid var(--line)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
              padding: "44px 36px",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "4.5rem", color: "var(--line-strong)", lineHeight: 1, marginBottom: 28 }}>{step.n}</div>
              <h3 style={{ fontSize: "1.35rem", marginBottom: 12, letterSpacing: "-0.02em", fontWeight: 600 }}>{step.title}</h3>
              <p style={{ fontSize: "0.98rem", lineHeight: 1.75 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 90, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            Privacy
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Respects the person.<br />Benefits the team.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.85, maxWidth: 400 }}>
            Nobody&apos;s individual browsing is ever shown to anyone, including whoever&apos;s paying for it. FOMO surfaces what the group found, never who found it.
          </p>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ marginBottom: 10, fontSize: "1.1rem" }}>What FOMO sees</h3>
            <p style={{ lineHeight: 1.75 }}>Page titles, URLs, and visible page content, used only to understand project topics, evidence, and connections.</p>
          </div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ color: "var(--subtle)", marginBottom: 10, fontSize: "1.1rem" }}>What FOMO never touches</h3>
            <p style={{ lineHeight: 1.75 }}>Passwords, messages, form inputs, banking pages, health records. Ever.</p>
          </div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ marginBottom: 10, fontSize: "1.1rem" }}>Evaluating FOMO for your team?</h3>
            <p style={{ lineHeight: 1.75 }}>We&apos;ve written up exactly what the browser extension permission does, what data goes where, and who we share it with, in plain language for IT and security reviewers. <a href="/privacy" style={{ color: "var(--accent)" }}>Read the full breakdown</a>.</p>
          </div>
        </div>
      </section>

      <BottomCta />

    </div>
  );
}

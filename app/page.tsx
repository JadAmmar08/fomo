import Link from "next/link";

export default function LandingPage() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: "120px 0 100px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 40, color: "var(--subtle)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span style={{ display: "block", width: 48, height: 1, background: "var(--line-strong)" }} />
          The community attention layer
          <span style={{ display: "block", width: 48, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.5rem)", maxWidth: 860, margin: "0 auto 0", lineHeight: 1.0, letterSpacing: "-0.03em" }}>
          Your community is paying attention.
        </h1>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.5rem)", margin: "0 auto 32px", lineHeight: 1.05, fontStyle: "italic", color: "var(--accent)", letterSpacing: "-0.03em" }}>
          Are you?
        </h1>
        <p style={{ maxWidth: 460, margin: "0 auto 48px", fontSize: "1.15rem", lineHeight: 1.75, color: "var(--muted)" }}>
          FOMO watches what you actually browse and shows you what people like you are focused on — before it becomes obvious.
        </p>
        <Link href="/download" className="button" style={{ fontSize: "1rem", padding: "16px 36px" }}>
          Get the extension — it&apos;s free
        </Link>
      </section>

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)" }}>
        {[
          { n: "24+", label: "Active users" },
          { n: "5,000+", label: "Signals tracked" },
          { n: "Real-time", label: "Community pulse" },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: "56px 40px",
            textAlign: "center",
            borderRight: i < 2 ? "1px solid var(--line)" : undefined
          }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.8rem, 5vw, 4rem)", fontWeight: 400, color: "var(--text)", marginBottom: 8, letterSpacing: "-0.03em" }}>{stat.n}</div>
            <div style={{ fontSize: "0.9rem", color: "var(--subtle)", letterSpacing: "0.02em" }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding: "100px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 64 }}>
          <div>
            <span className="eyebrow">How it works</span>
            <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.1 }}>Three steps.<br />No friction.</h2>
          </div>
          <Link href="/download" className="button-secondary" style={{ flexShrink: 0 }}>Get started</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
          {[
            { n: "01", title: "Install. Browse normally.", body: "A lightweight Chrome extension runs silently in the background. No setup, no forms, no logins. Just install and forget it." },
            { n: "02", title: "Your mirror builds itself.", body: "Within an hour, FOMO builds a profile of who you are — based on where your attention actually goes, not what you post." },
            { n: "03", title: "See what your community sees.", body: "The pulse shows what people like you are browsing right now. No opinions. No noise. Just raw community attention." },
          ].map((step, i) => (
            <div key={step.n} style={{
              padding: "48px 40px",
              borderLeft: "1px solid var(--line)",
              borderTop: "1px solid var(--line)",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "5rem", color: "var(--line-strong)", lineHeight: 1, marginBottom: 32, letterSpacing: "-0.05em" }}>{step.n}</div>
              <h3 style={{ fontSize: "1.3rem", marginBottom: 14, letterSpacing: "-0.02em", fontWeight: 600 }}>{step.title}</h3>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.75 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section style={{ padding: "100px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 100, alignItems: "center", borderBottom: "1px solid var(--line)" }}>
        <div>
          <span className="eyebrow">Privacy</span>
          <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", lineHeight: 1.1, marginBottom: 20 }}>Anonymous by design.<br /><em>Not by accident.</em></h2>
          <p style={{ fontSize: "1rem", lineHeight: 1.85, maxWidth: 380 }}>
            Your identity is never attached to your signals. FOMO tracks what you browse — never who you are.
          </p>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel" style={{ padding: "28px 32px" }}>
            <h3 style={{ color: "var(--accent)", marginBottom: 10, fontSize: "1.05rem" }}>What FOMO sees</h3>
            <p style={{ lineHeight: 1.75 }}>Page titles, URLs, and content — used only to classify your attention. Nothing else.</p>
          </div>
          <div className="panel" style={{ padding: "28px 32px" }}>
            <h3 style={{ color: "var(--subtle)", marginBottom: 10, fontSize: "1.05rem" }}>What FOMO never touches</h3>
            <p style={{ lineHeight: 1.75 }}>Passwords, messages, form inputs, banking pages, health records. Ever.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "120px 0", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 20, lineHeight: 1.05 }}>Ready to see what<br /><em>you&apos;re missing?</em></h2>
        <p style={{ marginBottom: 44, fontSize: "1.05rem", color: "var(--muted)" }}>Install the extension. Browse for an hour. Come back.</p>
        <Link href="/download" className="button" style={{ fontSize: "1rem", padding: "16px 36px" }}>
          Get started — it&apos;s free
        </Link>
      </section>

    </div>
  );
}

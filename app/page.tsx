import Link from "next/link";

export default function LandingPage() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: "100px 0 80px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 32, color: "var(--subtle)", fontSize: "0.78rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          The community attention layer
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", maxWidth: 800, margin: "0 auto 12px", lineHeight: 1.0 }}>
          Your community is<br />paying attention.
        </h1>
        <h1 style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)", margin: "0 auto 28px", lineHeight: 1.0, fontStyle: "italic", color: "var(--accent)" }}>
          Are you?
        </h1>
        <p style={{ maxWidth: 440, margin: "0 auto 40px", fontSize: "1.1rem", lineHeight: 1.75, color: "var(--muted)" }}>
          FOMO watches what you actually browse and shows you what people like you are paying attention to — before it becomes obvious.
        </p>
        <Link href="/download" className="button" style={{ fontSize: "1rem", padding: "14px 32px", borderRadius: 999 }}>
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
            padding: "40px 32px",
            textAlign: "center",
            borderRight: i < 2 ? "1px solid var(--line)" : undefined
          }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 400, color: "var(--text)", marginBottom: 6 }}>{stat.n}</div>
            <div style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding: "80px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={{ marginBottom: 48 }}>
          <span className="eyebrow">How it works</span>
          <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}>Three steps.<br />No friction.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
          {[
            { n: "01", title: "Install. Browse normally.", body: "A lightweight Chrome extension runs in the background. No setup, no forms, no logins." },
            { n: "02", title: "Your mirror builds itself.", body: "Within an hour, FOMO profiles who you are based on where your attention actually goes — not what you post." },
            { n: "03", title: "See what your community sees.", body: "The pulse shows what people like you are focused on right now. No opinions. Just raw attention." },
          ].map((step) => (
            <div key={step.n} className="card" style={{ borderRadius: 0, border: "none", borderLeft: "1px solid var(--line)", paddingLeft: 32, background: "transparent" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "3rem", color: "var(--line-strong)", lineHeight: 1, marginBottom: 20 }}>{step.n}</div>
              <h3 style={{ fontSize: "1.15rem", marginBottom: 10 }}>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section style={{ padding: "80px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div>
          <span className="eyebrow">Privacy</span>
          <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", marginBottom: 16 }}>Anonymous by design.<br />Not by accident.</h2>
          <p style={{ fontSize: "1rem", lineHeight: 1.8 }}>
            Your identity is never attached to your signals. What FOMO tracks is what you browse — never who you are.
          </p>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="panel" style={{ padding: "24px 28px" }}>
            <h3 style={{ color: "var(--accent)", marginBottom: 8 }}>What FOMO sees</h3>
            <p>Page titles, URLs, and content — used only to classify your attention. Never your identity.</p>
          </div>
          <div className="panel" style={{ padding: "24px 28px" }}>
            <h3 style={{ color: "var(--subtle)", marginBottom: 8 }}>What FOMO never touches</h3>
            <p>Passwords, messages, form inputs, banking pages, health records. Ever.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 0", textAlign: "center", borderTop: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", marginBottom: 16 }}>Ready to see what you&apos;re missing?</h2>
        <p style={{ marginBottom: 36, fontSize: "1rem" }}>Install the extension. Browse for an hour. Come back.</p>
        <Link href="/download" className="button" style={{ fontSize: "1rem", padding: "14px 32px" }}>
          Get started — it&apos;s free
        </Link>
      </section>

    </div>
  );
}

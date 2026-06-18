import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="stack">

      {/* Hero */}
      <section className="panel" style={{ padding: "56px 40px" }}>
        <span className="eyebrow">Now in early access</span>
        <h1 style={{ maxWidth: 600, marginTop: 12 }}>
          Know what matters before everyone else does.
        </h1>
        <p style={{ maxWidth: 520, fontSize: "1.05rem", marginBottom: 32 }}>
          FOMO watches what you pay attention to, not what you post, and surfaces emerging trends from your community before they become obvious.
        </p>
        <div className="button-row">
          <Link href="/signup" className="button">Get started</Link>
          <Link href="/pulse" className="button-secondary">See the pulse</Link>
        </div>
      </section>

      {/* Three pillars */}
      <div className="grid three">
        <div className="card">
          <div className="icon-block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
            </svg>
          </div>
          <h3>Community Pulse</h3>
          <p>See what people with similar attention patterns are quietly converging on, before it becomes obvious to everyone.</p>
        </div>
        <div className="card">
          <div className="icon-block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <h3>Private Mirror</h3>
          <p>See how FOMO represents you. Which communities you've been placed in, and exactly which topics are driving that placement.</p>
        </div>
        <div className="card">
          <div className="icon-block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <h3>Early Signal</h3>
          <p>Trends appear in attention weeks before they appear in conversation. FOMO catches them while they're still forming.</p>
        </div>
      </div>

      {/* How it works */}
      <section className="panel">
        <span className="eyebrow">How it works</span>
        <h2>Attention is the signal. Everything else is noise.</h2>
        <p style={{ marginBottom: 28, maxWidth: 520 }}>
          A browser extension quietly observes what you spend time on, never touching passwords, forms, or messages. Over time, patterns emerge.
        </p>
        <div className="grid two">
          <div className="item">
            <span className="kicker">Step 1</span>
            <h3>Install the extension</h3>
            <p>Runs silently in the background, capturing only safe metadata like page titles and domain names.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 2</span>
            <h3>Your mirror builds</h3>
            <p>Each page gets classified into a topic. Over hours and days, your mirror reveals patterns in your own attention you didn't know were there.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 3</span>
            <h3>FOMO places you in communities</h3>
            <p>Based on what you pay attention to, FOMO quietly groups you with people who share similar patterns. No forms, no self-reported identity.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 4</span>
            <h3>Your pulse reflects your communities</h3>
            <p>The pulse shows what those communities are paying attention to right now, surfaced before it goes mainstream.</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="panel" style={{ background: "var(--teal-soft)", borderColor: "rgba(58,184,170,0.15)" }}>
        <h2>Privacy is the foundation, not a feature.</h2>
        <div className="grid three" style={{ marginTop: 16 }}>
          {[
            ["Never collected", "Passwords, form inputs, cookies, screenshots, or message content."],
            ["Always anonymous", "Signals are tied to a session ID, never your name or email."],
            ["You control it", "Pause tracking, block any domain, or delete all your data at any time."],
          ].map(([title, desc]) => (
            <div key={title} className="item" style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(58,184,170,0.12)" }}>
              <h3 style={{ color: "var(--teal)" }}>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="panel" style={{ textAlign: "center", padding: "48px 36px" }}>
        <h2>Start building your mirror.</h2>
        <p style={{ marginBottom: 28, maxWidth: 420, margin: "0 auto 28px" }}>
          Sign up for early access and get the extension. Your pulse starts the moment you begin browsing.
        </p>
        <Link href="/signup" className="button">Get started</Link>
      </section>

    </div>
  );
}

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="stack">
      {/* Hero */}
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Now in early access</span>
        <h1 style={{ maxWidth: 640 }}>
          Know what matters before everyone else does.
        </h1>
        <p style={{ maxWidth: 560, fontSize: "1.05rem", marginBottom: 28 }}>
          FOMO is a private attention network. It watches what you pay attention to —
          not what you post — and surfaces emerging trends from your community before
          they become obvious.
        </p>
        <div className="button-row">
          <Link href="/pulse" className="button">See the pulse</Link>
          <Link href="/mirror" className="button-secondary">View your mirror</Link>
        </div>
      </section>

      {/* Three pillars */}
      <div className="grid three">
        <div className="card">
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>📡</div>
          <h3>Community Pulse</h3>
          <p>
            The pulse is the core of FOMO. It surfaces what your community is quietly
            converging on — emerging topics, opportunities, and ideas — before they
            become obvious to everyone.
          </p>
        </div>
        <div className="card">
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>🪞</div>
          <h3>Private Mirror</h3>
          <p>
            Your mirror shows how you're represented on the pulse — what topics FOMO
            associates with you, and how your attention shapes what you see in your community.
          </p>
        </div>
        <div className="card">
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>⚡</div>
          <h3>Early Signal</h3>
          <p>
            Trends appear in attention before they appear in conversation. FOMO
            catches the signal weeks before it becomes noise.
          </p>
        </div>
      </div>

      {/* How it works */}
      <section className="panel">
        <span className="eyebrow">How it works</span>
        <h2>Attention is the signal. Everything else is noise.</h2>
        <p style={{ marginBottom: 24, maxWidth: 560 }}>
          FOMO runs as a browser extension that privately observes page titles and
          domains — never passwords, forms, or messages. Over time, patterns emerge
          and get woven into your community pulse.
        </p>
        <div className="grid two">
          <div className="item">
            <span className="kicker">Step 1</span>
            <h3>Install the extension</h3>
            <p>The extension runs silently in the background, capturing only safe metadata from the pages you visit.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 2</span>
            <h3>FOMO reads your attention</h3>
            <p>Every page you visit gets classified into a topic. Over hours and days, a clear picture of what you actually care about begins to form.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 3</span>
            <h3>Your pulse emerges</h3>
            <p>Anonymous signals from people with similar attention patterns get aggregated. You see what's rising in your community before it becomes obvious.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 4</span>
            <h3>Your mirror shows your position</h3>
            <p>The mirror is a window into how you're represented on the pulse — which topics you're contributing to, and how your attention places you in your community.</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="panel" style={{ background: "var(--teal-soft)", borderColor: "rgba(58,184,170,0.15)" }}>
        <h2>Privacy is the foundation, not a feature.</h2>
        <div className="grid three" style={{ marginTop: 16 }}>
          {[
            ["Never collected", "Passwords, form inputs, cookies, screenshots, or message content."],
            ["Always anonymous", "Signals are tied to an anonymous session ID — never your name or email."],
            ["You control it", "Pause tracking, block any domain, or delete all your data at any time."],
          ].map(([title, desc]) => (
            <div key={title} className="item" style={{ background: "rgba(0,0,0,0.15)", borderColor: "rgba(58,184,170,0.12)" }}>
              <h3 style={{ color: "var(--teal)" }}>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="panel" style={{ textAlign: "center", padding: "48px 36px" }}>
        <h2>See what your community is paying attention to.</h2>
        <p style={{ marginBottom: 24 }}>
          The pulse is live. Your mirror builds the moment the extension starts running.
        </p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <Link href="/pulse" className="button">Open the pulse</Link>
          <Link href="/mirror" className="button-secondary">See your mirror</Link>
        </div>
      </section>
    </div>
  );
}

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
          FOMO is a private attention network. It watches what you pay attention to, not what you post, and surfaces emerging trends from your community before they become obvious.
        </p>
        <div className="button-row">
          <Link href="/pulse" className="button">See the pulse</Link>
          <Link href="/mirror" className="button-secondary">View your mirror</Link>
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
          <p>
            The pulse is the core of FOMO. It surfaces what your community is quietly
            converging on emerging topics, opportunities, and ideas, before they
            become obvious to everyone.
          </p>
        </div>
        <div className="card">
          <div className="icon-block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <h3>Private Mirror</h3>
          <p>
            Your mirror shows how you're represented on the pulse. FOMO infers which
            communities you belong to based purely on your attention, and that placement
            determines what pulse signals you see.
          </p>
        </div>
        <div className="card">
          <div className="icon-block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
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
          domains, never passwords, forms, or messages. Over time, patterns emerge
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
            <h3>FOMO places you in communities</h3>
            <p>Based on your attention patterns, FOMO quietly groups you with people who pay attention to similar things. No signup form, no self-reported identity required.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 4</span>
            <h3>Your pulse reflects your communities</h3>
            <p>The pulse shows what those communities are paying attention to right now. Your mirror lets you see exactly how you're placed and why.</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="panel" style={{ background: "var(--teal-soft)", borderColor: "rgba(58,184,170,0.15)" }}>
        <h2>Privacy is the foundation, not a feature.</h2>
        <div className="grid three" style={{ marginTop: 16 }}>
          {[
            ["Never collected", "Passwords, form inputs, cookies, screenshots, or message content."],
            ["Always anonymous", "Signals are tied to an anonymous session ID, never your name or email."],
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

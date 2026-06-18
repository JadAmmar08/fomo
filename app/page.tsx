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
          <Link href="/mirror" className="button">See your mirror</Link>
          <Link href="/pulse" className="button-secondary">View community pulse</Link>
        </div>
      </section>

      {/* Three pillars */}
      <div className="grid three">
        <div className="card">
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>🪞</div>
          <h3>Private Mirror</h3>
          <p>
            FOMO builds a private map of your interests based purely on what you spend
            time reading and exploring — not what you tell it.
          </p>
        </div>
        <div className="card">
          <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>📡</div>
          <h3>Community Pulse</h3>
          <p>
            Anonymous attention signals from people with similar patterns get
            aggregated into a live pulse of what's emerging in your world.
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
          domains — never passwords, forms, or messages. Claude AI classifies each
          page into a human-readable topic. Over time, patterns emerge.
        </p>
        <div className="grid two">
          <div className="item">
            <span className="kicker">Step 1</span>
            <h3>Install the extension</h3>
            <p>The extension runs silently in the background, capturing only safe metadata from the pages you visit.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 2</span>
            <h3>FOMO builds your mirror</h3>
            <p>Claude classifies each page into a topic. Your mirror builds up over hours and days, revealing patterns you didn't know were there.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 3</span>
            <h3>Your community pulse emerges</h3>
            <p>Anonymous signals from people with similar attention patterns get aggregated. You see what's rising before it becomes obvious.</p>
          </div>
          <div className="item">
            <span className="kicker">Step 4</span>
            <h3>Get ahead of the curve</h3>
            <p>FOMO surfaces opportunities, events, and ideas your community is quietly converging on — before they go mainstream.</p>
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
        <h2>Start building your mirror.</h2>
        <p style={{ marginBottom: 24 }}>
          Your attention history starts accumulating the moment you install the extension.
          The longer FOMO runs, the sharper the picture gets.
        </p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <Link href="/mirror" className="button">Open your mirror</Link>
        </div>
      </section>
    </div>
  );
}

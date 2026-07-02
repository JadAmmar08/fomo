import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="stack">

      {/* Hero */}
      <section style={{ padding: "80px 0 60px", textAlign: "center" }}>
        <span className="eyebrow">Early access</span>
        <h1 style={{ maxWidth: 720, margin: "0 auto 20px" }}>
          Your community is paying attention.<br />
          <em>Are you?</em>
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto 36px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          FOMO watches what you actually browse and shows you what people like you are focused on right now — before it becomes obvious.
        </p>
        <Link href="/download" className="button" style={{ fontSize: "0.95rem", padding: "12px 28px" }}>
          Get the extension — it&apos;s free
        </Link>
      </section>

      {/* Three things */}
      <div className="grid three">
        <div className="card">
          <span className="eyebrow" style={{ marginBottom: 12 }}>Step 1</span>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>Install. Browse normally.</h3>
          <p>A lightweight Chrome extension runs in the background. No setup, no forms, no logins.</p>
        </div>
        <div className="card">
          <span className="eyebrow" style={{ marginBottom: 12 }}>Step 2</span>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>Your mirror builds itself.</h3>
          <p>Within an hour, FOMO builds a profile of who you are based on where your attention actually goes.</p>
        </div>
        <div className="card">
          <span className="eyebrow" style={{ marginBottom: 12 }}>Step 3</span>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 8 }}>See what your community sees.</h3>
          <p>The pulse shows what people like you are browsing right now. No opinions. Just attention.</p>
        </div>
      </div>

      {/* Privacy */}
      <section className="panel" style={{ padding: "40px" }}>
        <h2 style={{ marginBottom: 24 }}>Built on privacy.</h2>
        <div className="grid two">
          <div>
            <h3 style={{ color: "var(--accent)", marginBottom: 10 }}>What FOMO sees</h3>
            <p>Page titles, URLs, and content — used only to classify what you&apos;re paying attention to. Never your identity.</p>
          </div>
          <div>
            <h3 style={{ color: "var(--subtle)", marginBottom: 10 }}>What FOMO never touches</h3>
            <p>Passwords, messages, form inputs, banking pages, health records. Ever.</p>
          </div>
        </div>
      </section>

    </div>
  );
}

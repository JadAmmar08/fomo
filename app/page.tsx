import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="stack">

      {/* Hero */}
      <section className="panel" style={{ padding: "56px 40px" }}>
        <span className="eyebrow">Early access</span>
        <h1 style={{ maxWidth: 560, marginTop: 12 }}>
          See what your community is paying attention to.
        </h1>
        <p style={{ maxWidth: 480, fontSize: "1.05rem", marginBottom: 32 }}>
          FOMO tracks what you actually browse and places you in communities based on your attention — not what you post. The pulse shows what those communities are focused on right now.
        </p>
        <Link href="/download" className="button">Get the extension</Link>
      </section>

      {/* Three things */}
      <div className="grid three">
        <div className="card">
          <h3>Install the extension</h3>
          <p>A Chrome extension runs in the background and tracks what you spend time on. No setup, no forms.</p>
        </div>
        <div className="card">
          <h3>Get placed in communities</h3>
          <p>FOMO groups you with people who pay attention to similar things. Based on behavior, not self-reported identity.</p>
        </div>
        <div className="card">
          <h3>See your pulse</h3>
          <p>The pulse shows what your communities are browsing right now — before it becomes obvious to everyone.</p>
        </div>
      </div>

      {/* Privacy */}
      <section className="panel">
        <h2>What FOMO sees</h2>
        <div className="grid two" style={{ marginTop: 16 }}>
          <div className="item">
            <h3 style={{ color: "var(--accent)", marginBottom: 8 }}>Collected</h3>
            <p>Page titles, URLs, and page content — sent to AI to classify what you're looking at. Time spent on each page.</p>
          </div>
          <div className="item">
            <h3 style={{ color: "var(--subtle)", marginBottom: 8 }}>Never collected</h3>
            <p>Passwords, messages, form inputs, or anything from banking and health pages. Your identity is never attached.</p>
          </div>
        </div>
      </section>


    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Get the Extension" };

const steps = [
  {
    n: "1",
    title: "Download and unzip",
    body: 'Click the button below to download the extension. Once downloaded, double-click the zip file to unzip it. You\'ll get a folder called "extension".'
  },
  {
    n: "2",
    title: "Open Chrome extensions",
    body: 'In Chrome, go to chrome://extensions (paste that into your address bar). In the top right corner, turn on "Developer mode".'
  },
  {
    n: "3",
    title: 'Load the extension',
    body: 'Click "Load unpacked" and select the "extension" folder you just unzipped. FOMO will appear in your Chrome toolbar.'
  },
  {
    n: "4",
    title: "Start browsing",
    body: "FOMO runs silently in the background. Your mirror and pulse start building as you browse."
  }
];

export default function DownloadPage() {
  return (
    <div className="stack">
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Get started</span>
        <h1 style={{ maxWidth: 520 }}>Get the FOMO extension.</h1>
        <p style={{ maxWidth: 480, marginBottom: 28 }}>
          The extension is how FOMO reads your attention. It runs silently, captures only safe metadata, and never touches passwords, forms, or messages.
        </p>
        <div className="button-row">
          <a href="/fomo-extension.zip" download className="button">
            Download extension
          </a>
          <Link href="/signup" className="button-secondary">Join the waitlist</Link>
        </div>
      </section>

      <section className="panel">
        <h2>How to install</h2>
        <p style={{ marginBottom: 24 }}>
          FOMO is currently in early access. Install it manually in a few steps.
        </p>
        <div className="grid two">
          {steps.map((step) => (
            <div key={step.n} className="item">
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent)",
                fontWeight: 700,
                fontSize: "0.9rem",
                marginBottom: 12
              }}>
                {step.n}
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>What the extension sees</h2>
        <div className="grid two" style={{ marginTop: 8 }}>
          <div>
            <h3 style={{ color: "var(--accent)", marginBottom: 12 }}>Collected</h3>
            <div className="list">
              {["Page title", "Domain name", "URL path (no query params)", "Time rounded to the hour"].map((item) => (
                <div key={item} className="item" style={{ padding: "10px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ color: "var(--danger)", marginBottom: 12 }}>Never collected</h3>
            <div className="list">
              {["Passwords or form inputs", "Cookies or login sessions", "Screenshots or page content", "Messages or emails", "Banking or health pages"].map((item) => (
                <div key={item} className="item" style={{ padding: "10px 14px" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text)" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ textAlign: "center", padding: "40px 36px" }}>
        <h2>Already installed?</h2>
        <p style={{ marginBottom: 24 }}>Your mirror starts building the moment you browse.</p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <Link href="/mirror" className="button">Open your mirror</Link>
          <Link href="/pulse" className="button-secondary">See the pulse</Link>
        </div>
      </section>
    </div>
  );
}

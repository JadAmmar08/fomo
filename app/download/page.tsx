import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Get the Extension" };

const steps = [
  {
    n: "1",
    title: "Download the extension",
    body: 'Click the button above. Once downloaded, double-click the zip file to unzip it. You\'ll get a folder called "extension".'
  },
  {
    n: "2",
    title: "Open Chrome extensions",
    body: 'Paste chrome://extensions into your address bar and hit enter. Turn on "Developer mode" in the top right corner.'
  },
  {
    n: "3",
    title: "Load the extension",
    body: 'Click "Load unpacked" and select the "extension" folder you just unzipped. FOMO will appear in your toolbar.'
  },
  {
    n: "4",
    title: "You're done",
    body: "Start browsing. Your mirror and pulse build automatically. Come back in an hour to see your profile."
  }
];

export default function DownloadPage() {
  return (
    <div className="stack">
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Get started</span>
        <h1 style={{ maxWidth: 520, marginTop: 12 }}>Get the FOMO extension.</h1>
        <p style={{ maxWidth: 480, marginBottom: 28 }}>
          Takes 2 minutes to install. No account needed.
        </p>
        <a href="/fomo-extension.zip" download className="button">
          Download extension
        </a>
      </section>

      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Install in 60 seconds</span>
        <h2 style={{ fontSize: "1.5rem", marginTop: 8, marginBottom: 32 }}>Follow these steps</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {steps.map((step) => (
            <div key={step.n} style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-start",
              padding: 20,
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid rgba(240,237,232,0.06)"
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "var(--bg)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "1.1rem",
                flexShrink: 0
              }}>
                {step.n}
              </div>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>{step.title}</h3>
                <p style={{ margin: 0, color: "var(--subtle)", lineHeight: 1.5 }}>{step.body}</p>
              </div>
            </div>
          ))}
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

"use client";

import Link from "next/link";
import { useState } from "react";

const steps = [
  {
    n: "1",
    title: "Download and unzip",
    body: <>Click the button above. Once downloaded, <strong>double-click the zip file</strong> to unzip it. You&apos;ll get a folder called <strong>&quot;extension&quot;</strong>.</>
  },
  {
    n: "2",
    title: "Open Chrome extensions",
    body: <>Paste <strong>chrome://extensions</strong> into your address bar and hit enter. Turn on <strong>&quot;Developer mode&quot;</strong> in the top right corner.</>
  },
  {
    n: "3",
    title: "Load the extension",
    body: <>Click <strong>&quot;Load unpacked&quot;</strong> and select the <strong>&quot;extension&quot;</strong> folder you just unzipped.</>
  },
  {
    n: "4",
    title: "Pin it to your toolbar",
    body: <>Click the <strong>puzzle piece icon</strong> (🧩) in the top right of Chrome, find <strong>FOMO</strong>, and click the <strong>pin icon</strong>. This keeps FOMO visible in your toolbar.</>
  },
  {
    n: "5",
    title: "You're done",
    body: <>Start browsing. Your mirror and pulse build automatically. Come back in an hour to see your profile.</>
  }
];

const inputStyle = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid rgba(240,237,232,0.12)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%"
};

export default function DownloadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleDownload() {
    if (email) {
      fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      }).catch(() => {});
    }
    setSubmitted(true);
  }

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Get started</span>
        <h1 style={{ maxWidth: 520, marginTop: 12 }}>Get the FOMO extension.</h1>
        <p style={{ maxWidth: 480, marginBottom: 28 }}>
          Takes 2 minutes to install. No account needed.
        </p>
        {!submitted ? (
          <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="email"
              placeholder="Your email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <a
              href="/fomo-extension.zip"
              download
              className="button"
              style={{ textAlign: "center", marginTop: 4 }}
              onClick={handleDownload}
            >
              Download extension
            </a>
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--accent)", marginBottom: 12 }}>Download started! Follow the steps below.</p>
            <a href="/fomo-extension.zip" download style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
              Click here if the download didn&apos;t start
            </a>
          </div>
        )}
      </section>

      <section className="panel" style={{ padding: "56px 40px", border: "2px solid var(--accent)", boxShadow: "0 0 60px rgba(58,184,170,0.08)" }}>
        <span className="eyebrow" style={{ background: "rgba(58,184,170,0.15)", color: "var(--accent)", fontSize: "0.85rem", padding: "6px 14px" }}>Install in 60 seconds</span>
        <h2 style={{ fontSize: "2rem", marginTop: 12, marginBottom: 40, letterSpacing: "-0.03em" }}>Follow these steps</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {steps.map((step) => (
            <div key={step.n} style={{
              display: "flex",
              gap: 24,
              alignItems: "flex-start",
              padding: 28,
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid rgba(240,237,232,0.1)"
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "var(--bg)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "1.4rem",
                flexShrink: 0
              }}>
                {step.n}
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: "1.3rem" }}>{step.title}</h3>
                <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.6, fontSize: "1.05rem" }}>{step.body}</p>
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

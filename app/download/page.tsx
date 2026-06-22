"use client";

import Link from "next/link";
import { useState, useRef } from "react";

const steps = [
  {
    n: "1",
    title: "Unzip the file",
    body: 'Find the downloaded file (fomo-extension.zip) and double-click it to unzip. You\'ll get a folder called "extension".'
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const stepsRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);

      // Auto-download the extension
      const link = document.createElement("a");
      link.href = "/fomo-extension.zip";
      link.download = "fomo-extension.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Scroll to install steps
      setTimeout(() => {
        stepsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      {/* Signup or download complete */}
      <section className="panel" style={{ padding: "48px 36px" }}>
        {!submitted ? (
          <>
            <span className="eyebrow">Get started</span>
            <h1 style={{ maxWidth: 520, marginTop: 12 }}>Get the FOMO extension.</h1>
            <p style={{ maxWidth: 480, marginBottom: 28 }}>
              Enter your email and we&apos;ll start your download. Takes 2 minutes to install.
            </p>
            <form onSubmit={handleSubmit} style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(240,237,232,0.12)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(240,237,232,0.12)",
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />
              {error && <p style={{ color: "var(--danger)", margin: 0, fontSize: "0.85rem" }}>{error}</p>}
              <button type="submit" className="button" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "Starting download..." : "Download extension"}
              </button>
            </form>
          </>
        ) : (
          <>
            <span className="eyebrow" style={{ background: "rgba(58,184,170,0.15)", color: "var(--accent)" }}>Downloading...</span>
            <h1 style={{ maxWidth: 520, marginTop: 12 }}>Your download started.</h1>
            <p style={{ maxWidth: 480, marginBottom: 16 }}>
              If it didn&apos;t start automatically, <a href="/fomo-extension.zip" download style={{ color: "var(--accent)" }}>click here</a>. Now follow the steps below to install it.
            </p>
          </>
        )}
      </section>

      {/* Install steps — always visible but emphasized after download */}
      <div ref={stepsRef}>
        <section className="panel" style={{
          padding: "48px 36px",
          border: submitted ? "2px solid var(--accent)" : undefined,
          boxShadow: submitted ? "0 0 40px rgba(58,184,170,0.1)" : undefined
        }}>
          <span className="eyebrow">{submitted ? "Do this now" : "How to install"}</span>
          <h2 style={{ fontSize: "1.5rem", marginTop: 8, marginBottom: 8 }}>
            {submitted ? "Install in 60 seconds" : "How to install"}
          </h2>
          <p style={{ marginBottom: 32 }}>
            {submitted
              ? "You're almost there. Follow these 4 steps and your FOMO profile starts building immediately."
              : "FOMO is currently in early access. Install it manually in a few steps."}
          </p>
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
      </div>

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

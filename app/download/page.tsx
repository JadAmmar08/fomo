"use client";

import Link from "next/link";
import { useState } from "react";

const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "";

const inputStyle = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid var(--line-strong)",
  background: "var(--surface-raised)",
  color: "var(--text)",
  fontSize: "0.95rem",
  outline: "none",
  width: "100%"
};

export default function DownloadPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleInstall() {
    if (email) {
      fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, anonymousUserId: document.cookie.match(/fomo_anonymous_id=([^;]+)/)?.[1] })
      }).catch(() => {});
    }
  }

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "56px 40px" }}>
        <span className="eyebrow">Get started</span>
        <h1 style={{ maxWidth: 520, marginTop: 12 }}>Add FOMO to Chrome.</h1>
        <p style={{ maxWidth: 480, marginBottom: 28, fontSize: "1.05rem" }}>
          One click. No account needed. Your mirror and pulse start building the moment you browse.
        </p>
        <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          {CHROME_STORE_URL ? (
            <a
              href={!name || !email ? "#" : CHROME_STORE_URL}
              target={!name || !email ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="button"
              style={{ textAlign: "center", marginTop: 4, fontSize: "1.05rem", padding: "14px 24px", opacity: !name || !email ? 0.5 : 1 }}
              onClick={(e) => {
                if (!name || !email) { e.preventDefault(); return; }
                handleInstall();
              }}
            >
              {!name || !email ? "Enter your name and email first" : "Add to Chrome — it's free"}
            </a>
          ) : (
            <a
              href="/fomo-extension.zip"
              download
              className="button"
              style={{ textAlign: "center", marginTop: 4 }}
              onClick={handleInstall}
            >
              Download extension
            </a>
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: "48px 40px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>What happens next</h2>
        <p style={{ color: "var(--subtle)", marginBottom: 32 }}>After installing, just browse normally.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            { n: "1", title: "Browse normally", body: "FOMO runs silently in the background. No setup needed." },
            { n: "2", title: "Your mirror builds", body: "Within an hour, FOMO builds a profile of who you are based on what you actually read — not what you post." },
            { n: "3", title: "See your pulse", body: "Check what people with similar interests are paying attention to right now." }
          ].map((step) => (
            <div key={step.n} style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-start",
              padding: 24,
              background: "var(--surface-raised)",
              borderRadius: 12,
              border: "1px solid var(--line)"
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--accent)",
                color: "white",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "1.2rem",
                flexShrink: 0
              }}>
                {step.n}
              </div>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>{step.title}</h3>
                <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.5 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: "40px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: 16 }}>What FOMO sees</h2>
        <div className="grid two">
          <div>
            <h3 style={{ color: "var(--accent)", marginBottom: 10, fontSize: "1rem" }}>Collected</h3>
            <p style={{ color: "var(--text)", lineHeight: 1.6 }}>
              Page titles and URLs, page content for AI classification, time spent on each page.
            </p>
          </div>
          <div>
            <h3 style={{ color: "var(--danger)", marginBottom: 10, fontSize: "1rem" }}>Never collected</h3>
            <p style={{ color: "var(--text)", lineHeight: 1.6 }}>
              Passwords, messages, emails, form inputs, banking pages, health pages, or your identity.
            </p>
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

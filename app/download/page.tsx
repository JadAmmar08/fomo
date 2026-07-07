"use client";

import Link from "next/link";
import type { Route } from "next";
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
      <section style={{ padding: "70px 0 56px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Get started
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", margin: "0 auto 6px", lineHeight: 1.02 }}>
          Add FOMO to Chrome.
        </h1>
        <p style={{ maxWidth: 440, margin: "20px auto 36px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          One click. No account needed. Your mirror and pulse start building the moment you browse.
        </p>
        <div style={{ maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
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
              {!name || !email ? "Enter your name and email first" : "Add to Chrome, it's free"}
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
            { n: "2", title: "Your mirror builds", body: "Within an hour, FOMO builds a profile of who you are based on what you actually read, not what you post." },
            { n: "3", title: "Join a room or team", body: "Invite people you know into a private room, or a research group into a team." }
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
        <p style={{ marginBottom: 24 }}>Your data starts building the moment you browse.</p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <Link href={"/teams" as Route} className="button">Open your team</Link>
          <Link href={"/rooms" as Route} className="button-secondary">Join a room</Link>
        </div>
      </section>
    </div>
  );
}

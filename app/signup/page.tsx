"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name })
    });
    setStatus(res.ok ? "done" : "error");
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="panel">
        <span className="eyebrow">Early access</span>
        <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>Join FOMO.</h1>
        <p style={{ marginBottom: 28 }}>
          Get early access and be the first to see what your community is paying attention to.
        </p>

        {status === "done" ? (
          <div className="callout" style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 8 }}>You're in.</div>
            <p style={{ margin: "0 0 20px" }}>Check your inbox for next steps.</p>
            <Link href="/download" className="button" style={{ display: "inline-flex" }}>
              Get the extension
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--subtle)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--subtle)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />
            </div>
            {status === "error" && (
              <p style={{ color: "var(--danger)", fontSize: "0.88rem", margin: 0 }}>
                Something went wrong. Try again.
              </p>
            )}
            <button
              type="submit"
              className="button"
              disabled={status === "loading"}
              style={{ marginTop: 4 }}
            >
              {status === "loading" ? "Joining..." : "Join the waitlist"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 20, fontSize: "0.82rem", color: "var(--subtle)", textAlign: "center" }}>
          Already have the extension?{" "}
          <Link href="/mirror" style={{ color: "var(--accent)" }}>Open your mirror</Link>
        </p>
      </div>
    </div>
  );
}

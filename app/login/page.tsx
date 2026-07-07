"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "That link is missing a token.",
  invalid_link: "That link isn't valid. Request a new one below.",
  link_used: "That link was already used. Request a new one below.",
  link_expired: "That link expired. Request a new one below.",
  unavailable: "Sign-in is temporarily unavailable."
};

function LoginInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const redirectTo = searchParams.get("redirect") ?? "/mirror";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState(errorCode ? ERROR_MESSAGES[errorCode] ?? "Something went wrong." : "");

  useEffect(() => {
    if (errorCode) setError(ERROR_MESSAGES[errorCode] ?? "Something went wrong.");
  }, [errorCode]);

  async function sendLink() {
    if (!email.trim()) return;
    setStatus("sending");
    setError("");
    const res = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, redirectTo })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <div>
      <section style={{ padding: "90px 0", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Sign in
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>

        {status === "sent" ? (
          <>
            <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", maxWidth: 600, margin: "0 auto 20px", lineHeight: 1.05 }}>
              Check your email.
            </h1>
            <p style={{ maxWidth: 420, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
              We sent a sign-in link to {email}. It expires in 15 minutes.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", maxWidth: 600, margin: "0 auto 20px", lineHeight: 1.05 }}>
              No password. <span>Just a link.</span>
            </h1>
            <p style={{ maxWidth: 420, margin: "0 auto 32px", fontSize: "1.05rem", lineHeight: 1.7 }}>
              Enter your email and we'll send you a link that signs you in — on any device, no password to remember.
            </p>
            <div style={{ maxWidth: 380, margin: "0 auto", display: "grid", gap: 12 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => e.key === "Enter" && sendLink()}
                style={{
                  width: "100%", padding: "14px 18px",
                  background: "var(--surface-raised)", border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius-md)", color: "var(--text)", fontSize: "1rem"
                }}
              />
              {error && <p style={{ color: "var(--danger)", fontSize: "0.88rem", margin: 0 }}>{error}</p>}
              <button
                className="button"
                onClick={sendLink}
                disabled={status === "sending" || !email.trim()}
                style={{ fontSize: "1rem", padding: "14px 26px" }}
              >
                {status === "sending" ? "Sending..." : "Send sign-in link"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

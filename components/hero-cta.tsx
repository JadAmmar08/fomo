"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ACTIVE_KEY = "fomo_has_activity";

export function HeroCta() {
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ACTIVE_KEY) === "1") setIsMember(true);
  }, []);

  if (isMember) {
    return (
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
        <Link href="/mirror" className="button" style={{ fontSize: "1.05rem", padding: "18px 40px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
          Open your mirror →
        </Link>
        <Link href="/pulse" className="button-secondary" style={{ fontSize: "1.05rem", padding: "18px 32px", background: "white" }}>
          See the live pulse
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
      <Link href="/download" className="button" style={{ fontSize: "1.05rem", padding: "18px 40px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
        Get the extension →
      </Link>
      <Link href="/pulse" className="button-secondary" style={{ fontSize: "1.05rem", padding: "18px 32px", background: "white" }}>
        See the live pulse
      </Link>
    </div>
  );
}

export function BottomCta() {
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ACTIVE_KEY) === "1") setIsMember(true);
  }, []);

  if (isMember) {
    return (
      <section data-reveal style={{ padding: "110px 0 90px", textAlign: "center", borderTop: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: "clamp(2.6rem, 6vw, 4.6rem)", marginBottom: 22, lineHeight: 1.02 }}>
          Your community is<br />already talking.
        </h2>
        <p style={{ marginBottom: 48, fontSize: "1.1rem", color: "var(--muted)" }}>Check what&apos;s trending right now.</p>
        <Link href="/pulse" className="button" style={{ fontSize: "1.05rem", padding: "18px 44px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
          See the pulse
        </Link>
      </section>
    );
  }

  return (
    <section data-reveal style={{ padding: "110px 0 90px", textAlign: "center", borderTop: "1px solid var(--line)" }}>
      <h2 style={{ fontSize: "clamp(2.6rem, 6vw, 4.6rem)", marginBottom: 22, lineHeight: 1.02 }}>
        Ready to see what<br />you&apos;re missing?
      </h2>
      <p style={{ marginBottom: 48, fontSize: "1.1rem", color: "var(--muted)" }}>Install the extension. Browse for an hour. Come back.</p>
      <Link href="/download" className="button" style={{ fontSize: "1.05rem", padding: "18px 44px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
        Get started — it&apos;s free
      </Link>
    </section>
  );
}

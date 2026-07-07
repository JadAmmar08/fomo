"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

const MEMBER_KEY = "fomo_is_member";

function useIsMember() {
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(MEMBER_KEY) === "1") {
      setIsMember(true);
      return;
    }
    fetch("/api/session")
      .then(r => r.json())
      .then(d => {
        if (d?.isMember) {
          localStorage.setItem(MEMBER_KEY, "1");
          setIsMember(true);
        }
      })
      .catch(() => {});
  }, []);

  return isMember;
}

export function HeroCta() {
  const isMember = useIsMember();

  if (isMember) {
    return (
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
        <Link href="/mirror" className="button" style={{ fontSize: "1.05rem", padding: "18px 40px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
          Open your mirror →
        </Link>
        <Link href={"/rooms" as Route} className="button-secondary" style={{ fontSize: "1.05rem", padding: "18px 32px", background: "white" }}>
          Join a room
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
      <Link href="/download" className="button" style={{ fontSize: "1.05rem", padding: "18px 40px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
        Get the extension →
      </Link>
      <Link href={"/rooms" as Route} className="button-secondary" style={{ fontSize: "1.05rem", padding: "18px 32px", background: "white" }}>
        See a room
      </Link>
    </div>
  );
}

export function BottomCta() {
  const isMember = useIsMember();

  if (isMember) {
    return (
      <section data-reveal style={{ padding: "110px 0 90px", textAlign: "center", borderTop: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: "clamp(2.6rem, 6vw, 4.6rem)", marginBottom: 22, lineHeight: 1.02 }}>
          Your people are<br />already talking.
        </h2>
        <p style={{ marginBottom: 48, fontSize: "1.1rem", color: "var(--muted)" }}>Check what your room is into right now.</p>
        <Link href={"/rooms" as Route} className="button" style={{ fontSize: "1.05rem", padding: "18px 44px", boxShadow: "0 12px 32px rgba(26,26,24,0.25)" }}>
          Go to your rooms
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
        Get started, it&apos;s free
      </Link>
    </section>
  );
}

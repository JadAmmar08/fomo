"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/pulse", label: "Pulse" },
  { href: "/mirror", label: "Mirror" },
  { href: "/rooms" as Route, label: "Rooms" },
  { href: "/privacy", label: "Privacy" }
];

const ACTIVE_KEY = "fomo_has_activity";
const SEEN_TRENDS_KEY = "fomo_seen_trend_ids";
const MAX_BADGE = 2;

export function Nav() {
  const pathname = usePathname();
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [pulseBadge, setPulseBadge] = useState(0);

  useEffect(() => {
    // Once someone has real signals, treat them as a member forever on this device
    if (localStorage.getItem(ACTIVE_KEY) === "1") {
      setIsMember(true);
      return;
    }
    fetch("/api/session")
      .then(r => r.json())
      .then(d => {
        if (d?.hasActivity) {
          localStorage.setItem(ACTIVE_KEY, "1");
          setIsMember(true);
        } else {
          setIsMember(false);
        }
      })
      .catch(() => setIsMember(false));
  }, []);

  useEffect(() => {
    if (!isMember) return;

    if (pathname === "/pulse") {
      setPulseBadge(0);
      return;
    }

    fetch("/api/pulse")
      .then(r => r.json())
      .then(d => {
        const topIds: string[] = (d?.trends ?? []).slice(0, MAX_BADGE).map((t: { id: string }) => t.id);
        if (topIds.length === 0) return;
        const seen: string[] = JSON.parse(localStorage.getItem(SEEN_TRENDS_KEY) ?? "[]");
        const newCount = topIds.filter(id => !seen.includes(id)).length;
        setPulseBadge(newCount);
      })
      .catch(() => {});
  }, [isMember, pathname]);

  useEffect(() => {
    if (pathname !== "/pulse") return;
    fetch("/api/pulse")
      .then(r => r.json())
      .then(d => {
        const topIds: string[] = (d?.trends ?? []).slice(0, MAX_BADGE).map((t: { id: string }) => t.id);
        localStorage.setItem(SEEN_TRENDS_KEY, JSON.stringify(topIds));
      })
      .catch(() => {});
  }, [pathname]);

  return (
    <nav className="topnav" aria-label="Primary">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
          style={{ position: "relative" }}
        >
          {item.label}
          {item.href === "/pulse" && pulseBadge > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -6,
              background: "var(--accent)", color: "white",
              borderRadius: 999, minWidth: 16, height: 16, padding: "0 3px",
              fontSize: "0.68rem", fontWeight: 700, lineHeight: "16px", textAlign: "center"
            }}>
              {pulseBadge}
            </span>
          )}
        </Link>
      ))}
      {isMember ? (
        <Link
          href="/mirror"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid rgba(26, 107, 90, 0.2)",
            borderRadius: 999,
            padding: "7px 16px",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginLeft: 8
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          My mirror
        </Link>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, marginLeft: 8, visibility: isMember === null ? "hidden" : "visible" }}>
          <Link href={"/login" as Route} style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
            Log in
          </Link>
          <Link
            href="/download"
            style={{
              background: "var(--text)",
              color: "var(--bg)",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: "0.875rem",
              fontWeight: 500
            }}
          >
            Get started
          </Link>
        </span>
      )}
    </nav>
  );
}

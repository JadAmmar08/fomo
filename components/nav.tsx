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

export function Nav() {
  const pathname = usePathname();
  const [isMember, setIsMember] = useState<boolean | null>(null);

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

  return (
    <nav className="topnav" aria-label="Primary">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
        >
          {item.label}
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
        <Link
          href="/download"
          style={{
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: 999,
            padding: "8px 18px",
            fontSize: "0.875rem",
            fontWeight: 500,
            marginLeft: 8,
            visibility: isMember === null ? "hidden" : "visible"
          }}
        >
          Get started
        </Link>
      )}
    </nav>
  );
}

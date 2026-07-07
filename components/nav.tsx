"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/teams" as Route, label: "Teams" },
  { href: "/rooms" as Route, label: "Rooms" },
  { href: "/privacy", label: "Privacy" }
];

const MEMBER_KEY = "fomo_is_member";
const NAME_KEY = "fomo_name";

export function Nav() {
  const pathname = usePathname();
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    // Once someone is recognized (logged in OR has activity), they're a member on this
    // device forever — never shown "Get started" or "Log in" again.
    if (localStorage.getItem(MEMBER_KEY) === "1") {
      setIsMember(true);
      setName(localStorage.getItem(NAME_KEY));
      return;
    }
    fetch("/api/session")
      .then(r => r.json())
      .then(d => {
        if (d?.isMember) {
          localStorage.setItem(MEMBER_KEY, "1");
          if (d.name) localStorage.setItem(NAME_KEY, d.name);
          setName(d.name ?? null);
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
          href={"/teams" as Route}
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
          {name ?? "My account"}
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

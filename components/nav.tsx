"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/pulse", label: "Pulse" },
  { href: "/mirror", label: "Mirror" },
  { href: "/rooms" as Route, label: "Rooms" },
  { href: "/privacy", label: "Privacy" }
];

export function Nav() {
  const pathname = usePathname();

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
      <Link
        href="/download"
        style={{
          background: "var(--text)",
          color: "var(--bg)",
          borderRadius: 999,
          padding: "7px 18px",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginLeft: 8
        }}
      >
        Get started
      </Link>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/pulse", label: "Pulse" },
  { href: "/mirror", label: "Mirror" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="topnav" aria-label="Primary">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={pathname === item.href ? { color: "var(--text)", background: "var(--surface-raised)" } : undefined}
        >
          {item.label}
        </Link>
      ))}
      <Link
        href="/signup"
        style={{ background: "var(--accent)", color: "white", borderRadius: 999, padding: "6px 14px" }}
      >
        Get started
      </Link>
    </nav>
  );
}

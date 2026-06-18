import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOMO",
  description: "Transparent social sensing with a private mirror and anonymous community pulse."
};

const navItems = [
  { href: "/mirror", label: "Private Mirror" },
  { href: "/pulse", label: "Community Pulse" }
] satisfies Array<{ href: Route; label: string }>;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link href="/mirror" className="brand">
              <span className="brand-mark">F</span>
              <span>
                <strong>FOMO</strong>
                <small>Transparent social sensing</small>
              </span>
            </Link>
            <nav className="topnav" aria-label="Primary">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="page-frame">{children}</main>
        </div>
      </body>
    </html>
  );
}

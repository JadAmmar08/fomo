import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOMO",
  description: "Know what your community is paying attention to."
};

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
            <Link href="/" className="brand">
              <span className="brand-dot"></span>
              FOMO
            </Link>
            <Nav />
          </header>
          <main className="page-frame">{children}</main>
          <footer style={{ borderTop: "1px solid var(--line)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "0.9rem", color: "var(--subtle)" }}>FOMO</span>
            <div style={{ display: "flex", gap: 24 }}>
              <Link href="/privacy" style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>Privacy</Link>
              <Link href="/terms" style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>Terms</Link>
            </div>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}

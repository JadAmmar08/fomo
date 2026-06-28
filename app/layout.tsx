import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOMO",
  description: "Know what matters before everyone else does."
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
              <span className="brand-mark"></span>
              <strong>FOMO</strong>
            </Link>
            <Nav />
          </header>
          <main className="page-frame">{children}</main>
          <footer style={{ textAlign: "center", padding: "24px 16px", fontSize: "0.8rem", color: "var(--subtle)", borderTop: "1px solid var(--line)" }}>
            <Link href="/privacy" style={{ color: "var(--subtle)", marginRight: 16 }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--subtle)" }}>Terms</Link>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}

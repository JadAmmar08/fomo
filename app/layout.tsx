import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/nav";
import { ScrollReveal } from "@/components/scroll-reveal";
import { MicrosoftAuthRedirectHandler } from "@/components/microsoft-auth-redirect-handler";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOMO",
  description: "FOMO catches contradictions and duplicated work in your team's files, live, right where you're working."
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
              <img src="/fomo-logo.png" alt="FOMO" className="brand-logo" />
            </Link>
            <Nav />
          </header>
          <main className="page-frame">{children}</main>
          <footer style={{ borderTop: "1px solid var(--line)", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "0.95rem", color: "var(--subtle)" }}>fomo</span>
            <div style={{ display: "flex", gap: 24 }}>
              <Link href="/privacy" style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>Privacy</Link>
              <Link href="/terms" style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>Terms</Link>
            </div>
          </footer>
        </div>
        <ScrollReveal />
        <Analytics />
        <MicrosoftAuthRedirectHandler />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
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
        </div>
      </body>
    </html>
  );
}

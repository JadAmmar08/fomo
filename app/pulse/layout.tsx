import type { Metadata } from "next";
export const metadata: Metadata = { title: "FOMO - Community Pulse" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

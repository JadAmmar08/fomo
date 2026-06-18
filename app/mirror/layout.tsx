import type { Metadata } from "next";
export const metadata: Metadata = { title: "FOMO - Private Mirror" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

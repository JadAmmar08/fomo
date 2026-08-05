import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Support" };

export default function SupportPage() {
  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Support</span>
        <h1 style={{ marginTop: 12 }}>Get help with FOMO</h1>
        <p style={{ color: "var(--subtle)" }}>Questions, bugs, or feedback, we read every message.</p>
      </section>

      <section className="panel">
        <h2>Contact us</h2>
        <p>Email <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a> for account issues, bug reports, feature requests, or anything else about FOMO.</p>
      </section>

      <section className="panel">
        <h2>Other resources</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><a href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a></li>
          <li><a href="/terms" style={{ color: "var(--accent)" }}>Terms of Service</a></li>
          <li><a href="/fomo-data-privacy-overview.pdf" style={{ color: "var(--accent)" }}>Data &amp; Privacy Overview (PDF)</a>, for IT or security teams evaluating FOMO</li>
        </ul>
      </section>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Terms of Service" };

export default function TermsPage() {
  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Legal</span>
        <h1 style={{ marginTop: 12 }}>Terms of Service</h1>
        <p style={{ color: "var(--subtle)" }}>Last updated: June 21, 2026</p>
      </section>

      <section className="panel">
        <h2>Acceptance</h2>
        <p>By installing the FOMO extension or using usefomo.co, you agree to these terms. If you don't agree, don't use FOMO.</p>
      </section>

      <section className="panel">
        <h2>What FOMO does</h2>
        <p>FOMO tracks page titles and URLs as you browse, classifies them into interest categories, and shows you an anonymous feed of what people with similar interests are paying attention to. See our <a href="/privacy" style={{ color: "var(--accent)" }}>Privacy Policy</a> for full details on data collection.</p>
      </section>

      <section className="panel">
        <h2>Your responsibilities</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>You must be 13 or older to use FOMO.</li>
          <li>You may not use FOMO to collect data on others without their knowledge.</li>
          <li>You may not attempt to reverse engineer, scrape, or abuse the FOMO API.</li>
          <li>You may not use FOMO for any illegal purpose.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Our service</h2>
        <p>FOMO is provided as-is, in early access. We may change, pause, or discontinue the service at any time. We are not liable for any loss of data or interruption of service.</p>
        <p>We make no guarantees about uptime, accuracy of classification, or the content of the community pulse feed.</p>
      </section>

      <section className="panel">
        <h2>Intellectual property</h2>
        <p>FOMO and its code, design, and branding are owned by FOMO. You may not copy, redistribute, or build competing products using our code or data without permission.</p>
      </section>

      <section className="panel">
        <h2>Limitation of liability</h2>
        <p>To the maximum extent permitted by law, FOMO is not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability to you for any claim is limited to $0, as FOMO is currently free.</p>
      </section>

      <section className="panel">
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the State of California, United States.</p>
      </section>

      <section className="panel">
        <h2>Contact</h2>
        <p>Questions? Email us at <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a>.</p>
      </section>
    </div>
  );
}

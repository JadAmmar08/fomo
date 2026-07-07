import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Legal</span>
        <h1 style={{ marginTop: 12 }}>Privacy Policy</h1>
        <p style={{ color: "var(--subtle)" }}>Last updated: June 21, 2026</p>
      </section>

      <section className="panel">
        <h2>What FOMO is</h2>
        <p>FOMO is a browser extension and web app that tracks what you pay attention to online (page titles and URLs) and shows you a personalized feed of what people in your rooms or teams are paying attention to. Everything is anonymous by default. No account is required.</p>
      </section>

      <section className="panel">
        <h2>What we collect</h2>
        <div className="list">
          {[
            ["Page title and URL", "To classify what you're reading into interest categories."],
            ["Anonymous user ID", "A randomly generated ID stored in your browser. Not linked to your name, email, or identity."],
            ["Time on page", "To measure attention: how long you actually spent on something."],
            ["Interest categories", "Inferred from your browsing, stored on our servers to power your rooms and teams."],
          ].map(([item, desc]) => (
            <div key={item} className="item" style={{ padding: "14px 16px" }}>
              <strong style={{ fontSize: "0.9rem" }}>{item}</strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--subtle)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>What we never collect</h2>
        <div className="list">
          {[
            "Your name, email, or any personally identifiable information (unless you voluntarily join the waitlist)",
            "Passwords, form inputs, or anything you type",
            "Messages, emails, or private communications",
            "Content from banking, health, or other sensitive pages (these are automatically excluded)",
            "Your precise location",
          ].map((item) => (
            <div key={item} className="item" style={{ padding: "10px 16px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>How we use your data</h2>
        <p>We use your browsing signals to:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li>Build your anonymous attention profile (shown only to you on the Mirror page)</li>
          <li>Contribute anonymously to your rooms' and teams' pulse</li>
          <li>Improve classification accuracy over time</li>
        </ul>
        <p>We do not sell your data. We do not share it with advertisers. We do not use it for any purpose other than running FOMO.</p>
      </section>

      <section className="panel">
        <h2>How data is shared</h2>
        <p>Your browsing signals contribute anonymously to the rooms and teams you join. Other members see aggregated topic trends, never individual browsing activity, never your user ID, never anything that could identify you.</p>
        <p>We use Anthropic's Claude API to classify page content. Page titles and URLs are sent to Anthropic for this purpose. See <a href="https://www.anthropic.com/privacy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Anthropic's privacy policy</a>.</p>
        <p>We use Supabase to store data. See <a href="https://supabase.com/privacy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Supabase's privacy policy</a>.</p>
      </section>

      <section className="panel">
        <h2>Your rights</h2>
        <p>You can delete all your data at any time from the <a href="/settings" style={{ color: "var(--accent)" }}>Settings page</a>. This permanently removes all browsing signals, your anonymous profile, and your user record from our servers.</p>
        <p>You can pause tracking at any time by toggling the extension off. No new signals will be collected while paused.</p>
        <p>If you joined the waitlist and want your email removed, contact us at <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a>.</p>
      </section>

      <section className="panel">
        <h2>Children</h2>
        <p>FOMO is not intended for children under 13. We do not knowingly collect data from anyone under 13. If you believe a child has used FOMO, contact us and we will delete their data immediately.</p>
      </section>

      <section className="panel">
        <h2>Data retention</h2>
        <p>Browsing signals are retained for as long as you use FOMO. You can delete them at any time. If you have not used FOMO in 12 months, we may delete your data automatically.</p>
      </section>

      <section className="panel">
        <h2>Changes to this policy</h2>
        <p>We may update this policy as FOMO evolves. If we make material changes, we will update the date at the top of this page.</p>
      </section>

      <section className="panel">
        <h2>Contact</h2>
        <p>Questions? Email us at <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a>.</p>
      </section>
    </div>
  );
}

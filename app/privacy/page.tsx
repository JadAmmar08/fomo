import type { Metadata } from "next";

export const metadata: Metadata = { title: "FOMO - Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <section className="panel" style={{ padding: "48px 36px" }}>
        <span className="eyebrow">Legal</span>
        <h1 style={{ marginTop: 12 }}>Privacy Policy</h1>
        <p style={{ color: "var(--subtle)" }}>Last updated: July 7, 2026</p>
      </section>

      <section className="panel">
        <h2>What FOMO is</h2>
        <p>FOMO is a browser extension and web app for project teams. It reads what you&apos;re already researching (page titles and URLs) and, if you&apos;re on a team, uses AI to surface connections, tensions, and open questions between what different teammates are separately researching. Everything is anonymous by default: FOMO never reveals who found what, only how it connects. No account is required.</p>
      </section>

      <section className="panel">
        <h2>What we collect</h2>
        <div className="list">
          {[
            ["Page title and URL", "To classify what you're reading into interest categories."],
            ["A snippet of visible page text", "Up to roughly 6,000 characters of the page's visible text and metadata, sent for AI classification only. It is not stored after classification, only the resulting category and topic label are saved."],
            ["Anonymous user ID", "A randomly generated ID stored in your browser. Not linked to your name, email, or identity unless you create an account (see below)."],
            ["Time on page", "To measure attention: how long you actually spent on something."],
            ["Interest categories", "Inferred from your browsing, stored on our servers to power your team's Pulse and Mirror."],
            ["Email address (optional)", "Only if you join the waitlist or create an account to sign in from multiple devices. Used solely to send you a sign-in link or product updates, never sold or used for advertising."],
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
            "Your name or any personally identifiable information, unless you voluntarily join the waitlist or create an account with an email address",
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
          <li>Build your own private research pattern and guidance (shown only to you)</li>
          <li>Contribute anonymously to your team's Pulse (found connections) and Mirror (evolving mental model)</li>
          <li>Improve classification accuracy over time</li>
        </ul>
        <p>If you provide an email address, we use it only to send you a sign-in link, product updates, or (for digest emails) a summary of activity relevant to you. We do not sell your data. We do not share it with advertisers. We do not use it for any purpose other than running FOMO.</p>
      </section>

      <section className="panel">
        <h2>Browser extension permissions</h2>
        <p>When you install FOMO, Chrome will show a permission prompt that says the extension &quot;can read and change all your data on all websites.&quot; That prompt is broad by default for any extension that needs to see what page you&apos;re on, and it&apos;s worth being direct about what it means in practice:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><strong>Why we need it:</strong> FOMO classifies what you&apos;re researching into a topic, which requires seeing what page you&apos;re currently on, regardless of which site it is. There is no narrower permission that allows this.</li>
          <li><strong>What we actually extract:</strong> the page title, URL, and a snippet of visible text (used only to generate a category and topic label). Sensitive pages (banking, health, and similar) are automatically excluded before anything is sent anywhere.</li>
          <li><strong>What we never do with this access:</strong> read what you type, capture screenshots, read cookies from sites other than our own, or store raw page content after classification.</li>
          <li><strong>Cookie access:</strong> the extension&apos;s cookie permission is used only to read and set FOMO&apos;s own session cookie (on usefomo.net), so you stay signed in across devices. It is never used to read cookies from other sites you visit.</li>
        </ul>
        <p>If your organization&apos;s IT or security team needs more detail before approving FOMO for a team, email <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a> and we&apos;ll walk through it directly.</p>
      </section>

      <section className="panel">
        <h2>How data is shared</h2>
        <p>Your browsing signals contribute anonymously to the team you join. Other members see found connections and the team's evolving mental model, never individual browsing activity, never your user ID, never anything that could identify you.</p>
        <p>We share data with the following third parties, solely to operate FOMO:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><strong>Anthropic</strong> (Claude API): page titles, URLs, and page text snippets are sent to classify content and generate team insights. See <a href="https://www.anthropic.com/privacy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Anthropic&apos;s privacy policy</a>.</li>
          <li><strong>Supabase</strong>: stores our database, including browsing signals, interest categories, and account records. See <a href="https://supabase.com/privacy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Supabase&apos;s privacy policy</a>.</li>
          <li><strong>Resend</strong>: sends transactional emails (sign-in links and, if you opt in, digest emails) on our behalf. Only your email address is shared with Resend for this purpose. See <a href="https://resend.com/legal/privacy-policy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Resend&apos;s privacy policy</a>.</li>
          <li><strong>Vercel</strong>: hosts our website and app, and provides anonymous, aggregated web analytics (page views only, no personal data). See <a href="https://vercel.com/legal/privacy-policy" style={{ color: "var(--accent)" }} target="_blank" rel="noopener noreferrer">Vercel&apos;s privacy policy</a>.</li>
        </ul>
        <p>We do not sell data to anyone, and we do not share it with advertisers or data brokers.</p>
      </section>

      <section className="panel">
        <h2>Your rights</h2>
        <p>You can delete all your data at any time from the <a href="/settings" style={{ color: "var(--accent)" }}>Settings page</a>. This permanently removes all browsing signals, your anonymous profile, and your user record from our servers.</p>
        <p>You can pause tracking at any time by toggling the extension off. No new signals will be collected while paused.</p>
        <p>If you joined the waitlist, created an account, or otherwise provided an email address and want it removed, contact us at <a href="mailto:hi@usefomo.co" style={{ color: "var(--accent)" }}>hi@usefomo.co</a>.</p>
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

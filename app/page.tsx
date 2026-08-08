import { HeroCta, BottomCta } from "@/components/hero-cta";

export default function LandingPage() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: "110px 0 72px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 40, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Catches contradictions the moment they happen.
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.8rem)", maxWidth: 900, margin: "0 auto 36px", lineHeight: 0.98, letterSpacing: "-0.03em" }}>
          Your team knows more than it realizes.
        </h1>
        <p style={{ maxWidth: 560, margin: "0 auto 44px", fontSize: "1.2rem", lineHeight: 1.7, color: "var(--muted)" }}>
          FOMO watches the files your team already works in, Excel, PowerPoint, Word, Slack, and catches it live when two people&apos;s numbers stop agreeing. Not a report you read later. It happens right in the document, cited to the exact cell.
        </p>
        <HeroCta />
        <p style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>Free forever. Anonymous by design. You choose exactly what it can see.</p>
      </section>

      {/* Proof first: real Excel + PowerPoint examples, before any philosophy —
          this is the thing that's actually true and demoable today, so it leads. */}
      <section data-reveal style={{ padding: "40px 0 90px", borderTop: "1px solid var(--line)" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            See it, don&apos;t take our word for it
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          </div>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.05, maxWidth: 640, margin: "0 auto" }}>
            Two people, two files, one contradiction.
          </h2>
        </div>

        <div className="grid two" style={{ gap: 32 }}>
          {/* Excel card */}
          <div style={{ background: "white", borderRadius: 20, boxShadow: "0 24px 70px rgba(0,0,0,0.1)", border: "1px solid var(--line)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1a7f37" }} />
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Excel</span>
              </div>
              <span className="pill" style={{ fontSize: "0.72rem" }}>Live, cell-level</span>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem", background: "var(--surface-muted)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: "var(--muted)" }}>
                Sheet1!D6 &nbsp;·&nbsp; Q4 Revenue &nbsp;·&nbsp; <span style={{ background: "#fff3b0", padding: "1px 6px", borderRadius: 4, color: "var(--text)" }}>88000</span>
              </div>
              <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: 14, padding: "14px 16px" }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent)", display: "block", marginBottom: 6 }}>Conflicting data found</span>
                <p style={{ fontSize: "0.82rem", lineHeight: 1.55, margin: "0 0 10px", color: "var(--text-strong)" }}>
                  Q4 Revenue is 88000 here, but 120000 in Budget.xlsx Sheet1!B2.
                </p>
                <span className="button-secondary" style={{ fontSize: "0.75rem", padding: "6px 14px", display: "inline-flex" }}>Dismiss</span>
              </div>
            </div>
          </div>

          {/* PowerPoint card */}
          <div style={{ background: "white", borderRadius: 20, boxShadow: "0 24px 70px rgba(0,0,0,0.1)", border: "1px solid var(--line)", overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c0392b" }} />
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>PowerPoint</span>
              </div>
              <span className="pill" style={{ fontSize: "0.72rem" }}>Slide-level</span>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem", background: "var(--surface-muted)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, color: "var(--muted)" }}>
                Slide 4 &nbsp;·&nbsp; &quot;Market Sizing&quot; &nbsp;·&nbsp; <span style={{ background: "#fff3b0", padding: "1px 6px", borderRadius: 4, color: "var(--text)" }}>$40M TAM</span>
              </div>
              <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--tension)", borderRadius: 14, padding: "14px 16px" }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--tension)", display: "block", marginBottom: 6 }}>Possible overlap</span>
                <p style={{ fontSize: "0.82rem", lineHeight: 1.55, margin: "0 0 10px", color: "var(--text-strong)" }}>
                  This deck says $40M TAM, but Market-Research.xlsx puts it at $65M as of last week.
                </p>
                <span className="button-secondary" style={{ fontSize: "0.75rem", padding: "6px 14px", display: "inline-flex" }}>Dismiss</span>
              </div>
            </div>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--subtle)", marginTop: 28, maxWidth: 520, margin: "28px auto 0" }}>
          Excel catches it as you type, cell by cell. PowerPoint and Word catch it on save, cited to the exact slide or paragraph. Both dismiss for good in one click.
        </p>
      </section>

      {/* Concrete value props */}
      <section data-reveal style={{ padding: "40px 0 90px", borderTop: "1px solid var(--line)" }}>
        <div className="grid three" style={{ gap: 24 }}>
          {[
            { title: "Faster handoffs.", body: "Someone joining or picking work back up gets caught up in minutes, current thinking, what changed, what's still unresolved, not a meeting to reconstruct it." },
            { title: "Fewer blind spots.", body: "See when two people are independently converging on the same problem, or working from assumptions that don't actually agree." },
            { title: "You choose the scope.", body: "One file, one folder, or everything, per person, per tool. Client-facing channels always need their own explicit yes, never bundled in." },
          ].map((v) => (
            <div key={v.title} style={{ padding: "32px 8px" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: 10 }}>{v.title}</h3>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.75 }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The mirror — text left, product card right. What's actually live: two
          chat-editable memory panels, not the old decision/disagreement tiles. */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 80, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            The mirror
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Not a snapshot. A memory.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.8, maxWidth: 420 }}>
            A private file of how you specifically work, and a shared one for the whole team, both editable in plain chat. The more accurate they are, the sharper FOMO gets at knowing what&apos;s actually worth flagging you for, not just what technically differs.
          </p>
        </div>

        {/* Product mockup card — the two real memory panels */}
        <div style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 32px 90px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 26px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="pill" style={{ fontSize: "0.75rem" }}>Your memory</span>
              <span className="pill" style={{ fontSize: "0.75rem", background: "var(--surface-muted)", color: "var(--subtle)" }}>Team memory</span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--subtle)" }}>🔒 Private</span>
          </div>
          <div style={{ padding: "22px 26px" }}>
            <div style={{ background: "var(--surface-muted)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--subtle)" }}>What FOMO understands</span>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: "8px 0 0", color: "var(--text-strong)" }}>
                You always double-check Q4 numbers against Budget.xlsx before pushing an update.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ flex: 1, fontSize: "0.82rem", color: "var(--subtle)" }}>Actually I check it against Forecast.xlsx now, not Budget...</div>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--subtle)", marginTop: 12 }}>Correct it any time, right in the chat. No forms, no settings page.</p>
          </div>
        </div>
      </section>

      {/* Handoff / KT — text left, product card right. This is the payoff of the
          fact-history + personal-memory work: not a separate feature, the same
          substrate that catches contradictions also lets someone pick up
          another person's work without a meeting. */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 80, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            Handoff
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Picking up someone else&apos;s work shouldn&apos;t need a meeting.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.8, marginBottom: 28, maxWidth: 420 }}>
            Every number FOMO has ever caught has a history: what it was, who set it, when it changed, and why it mattered. When someone moves on or hands off a project, that history is already there, not reconstructed from memory in a rushed call.
          </p>
          <div style={{ display: "grid", gap: 16 }}>
            {[
              { title: "A private file, not a performance review.", body: "What FOMO understands about how you work stays yours. No manager view, no team-wide visibility, ever. Only you see it, only you edit it." },
              { title: "You hand it off, on purpose.", body: "Share a one-time snapshot with whoever's taking over. Not a live sync, they get what's true right now, not a moving target." },
              { title: "The receipts carry over.", body: "Exact file, exact cell, exact timestamp, for every value that's changed. The new person doesn't have to trust a summary, they can check it." },
            ].map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, marginTop: 3 }}>✓</span>
                <p style={{ fontSize: "0.95rem", lineHeight: 1.7 }}><strong style={{ color: "var(--text)" }}>{f.title}</strong> {f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Product mockup card — the personal memory + share flow */}
        <div style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 32px 90px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 26px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Your memory</div>
              <div style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>Private to you</div>
            </div>
            <span className="pill" style={{ fontSize: "0.75rem" }}>🔒 Only you</span>
          </div>
          <div style={{ padding: "22px 26px" }}>
            <div style={{ background: "var(--surface-muted)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--subtle)" }}>What FOMO understands</span>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: "8px 0 0", color: "var(--text-strong)" }}>
                You always double-check Q4 numbers against Budget.xlsx before pushing an update.
              </p>
            </div>
            <div style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--gold)", display: "block", marginBottom: 8 }}>Share for handoff</span>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "white", border: "1px solid var(--line-strong)", borderRadius: 10, padding: "8px 12px", fontSize: "0.8rem", color: "var(--subtle)" }}>Their ID...</div>
                <span className="button-secondary" style={{ fontSize: "0.75rem", padding: "8px 16px", display: "inline-flex" }}>Share</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="chip">one-time snapshot</span>
              <span className="chip">not a live sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section data-reveal style={{ padding: "90px 0 100px", borderTop: "1px solid var(--line)" }}>
        <div style={{ textAlign: "center", marginBottom: 72 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            How it works
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          </div>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1.05 }}>
            Three steps. No friction.
          </h2>
        </div>
        <div className="grid three" style={{ gap: 24 }}>
          {[
            { n: "01", title: "Connect what you already use.", body: "Drive, OneDrive, Slack, or just the Chrome extension. Per person, per tool, you choose the scope, down to a single file." },
            { n: "02", title: "Invite your team.", body: "A private, invite-only team. Nobody sees who found what, only how it connects." },
            { n: "03", title: "Open it at your next meeting.", body: "Real connections between separate work, plus a living record of what the team believes, ready before anyone says a word." },
          ].map((step) => (
            <div key={step.n} style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid var(--line)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
              padding: "44px 36px",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "4.5rem", color: "var(--line-strong)", lineHeight: 1, marginBottom: 28 }}>{step.n}</div>
              <h3 style={{ fontSize: "1.35rem", marginBottom: 12, letterSpacing: "-0.02em", fontWeight: 600 }}>{step.title}</h3>
              <p style={{ fontSize: "0.98rem", lineHeight: 1.75 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section data-reveal className="grid two" style={{ padding: "90px 0", gap: 90, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
            Privacy
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Respects the person.<br />Benefits the team.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.85, maxWidth: 400 }}>
            Nobody&apos;s individual activity is ever shown to anyone, including whoever&apos;s paying for it. FOMO surfaces what the group found, never who found it, and never shows a teammate&apos;s content without a real action from you.
          </p>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ marginBottom: 10, fontSize: "1.1rem" }}>You choose the scope</h3>
            <p style={{ lineHeight: 1.75 }}>One file, one folder, or everything you own, per tool, per person. Client-facing or external Slack channels always need their own separate, explicit yes, never bundled into a bulk approval.</p>
          </div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ color: "var(--subtle)", marginBottom: 10, fontSize: "1.1rem" }}>What FOMO never touches</h3>
            <p style={{ lineHeight: 1.75 }}>Passwords, banking pages, health records, anything you haven&apos;t explicitly connected. Ever.</p>
          </div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ marginBottom: 10, fontSize: "1.1rem" }}>Evaluating FOMO for your team?</h3>
            <p style={{ lineHeight: 1.75 }}>We&apos;ve written up exactly what the browser extension permission does, what data goes where, and who we share it with, in plain language for IT and security reviewers. <a href="/privacy" style={{ color: "var(--accent)" }}>Read the full breakdown</a>, or <a href="/fomo-data-privacy-overview.pdf" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>download the two-page IT/security overview (PDF)</a>.</p>
          </div>
        </div>
      </section>

      <BottomCta />

    </div>
  );
}

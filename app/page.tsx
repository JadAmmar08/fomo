import Link from "next/link";
import type { Route } from "next";
import { HeroCta, BottomCta } from "@/components/hero-cta";

export default function LandingPage() {
  return (
    <div>

      {/* Hero */}
      <section style={{ padding: "110px 0 72px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 40, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 48, height: 1, background: "var(--line-strong)" }} />
          The community attention layer
          <span style={{ display: "block", width: 48, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.8rem)", maxWidth: 900, margin: "0 auto", lineHeight: 0.98, letterSpacing: "-0.03em" }}>
          Your community is paying attention.
        </h1>
        <h1 style={{ fontSize: "clamp(3.5rem, 8vw, 6.8rem)", margin: "6px auto 36px", lineHeight: 1.05, fontStyle: "italic", color: "var(--accent)", letterSpacing: "-0.03em" }}>
          Are you?
        </h1>
        <p style={{ maxWidth: 520, margin: "0 auto 44px", fontSize: "1.2rem", lineHeight: 1.7, color: "var(--muted)" }}>
          FOMO watches what you actually browse and shows you what people like you are focused on — before it becomes obvious.
        </p>
        <HeroCta />
        <p style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>Free forever. No account. No feed to post to.</p>
      </section>

      {/* The mirror — text left, product card right */}
      <section data-reveal style={{ padding: "40px 0 110px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
            The mirror
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            We show you who you actually are.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.8, marginBottom: 28, maxWidth: 420 }}>
            Not who you say you are. Your mirror builds itself from where your attention really goes — and it&apos;s private to you.
          </p>
          <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
            {[
              { title: "Zero effort.", body: "No posting, no bios, no upkeep. Browse and it builds." },
              { title: "Honest by definition.", body: "You can fake a profile. You can't fake attention." },
              { title: "Yours alone.", body: "The mirror is private. It never places you in a community you didn't choose." },
            ].map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, marginTop: 3 }}>✓</span>
                <p style={{ fontSize: "0.95rem", lineHeight: 1.7 }}><strong style={{ color: "var(--text)" }}>{f.title}</strong> {f.body}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: "18px 22px", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14 }}>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: "var(--text)" }}>Want to go further?</strong> Join a private <Link href={"/rooms" as Route} style={{ color: "var(--accent)", textDecoration: "underline" }}>Room</Link> with people you actually know — FOMO finds what you&apos;re each separately paying attention to and stitches it into one shared discovery.
            </p>
          </div>
        </div>

        {/* Product mockup card */}
        <div style={{
          background: "white",
          borderRadius: 20,
          boxShadow: "0 32px 90px rgba(0,0,0,0.14), 0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid var(--line)",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 26px", borderBottom: "2px solid var(--text)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Private Mirror</div>
              <div style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>Built from your attention</div>
            </div>
            <span className="pill" style={{ fontSize: "0.75rem" }}>● Live</span>
          </div>
          <div style={{ padding: "26px" }}>
            <div style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 18, marginBottom: 22 }}>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontStyle: "italic", color: "var(--text)", lineHeight: 1.5 }}>
                &ldquo;A student developer building side projects, actively shipping to production and navigating early-stage tools.&rdquo;
              </p>
            </div>
            <span className="kicker" style={{ marginBottom: 10 }}>Where your attention places you</span>
            {[
              { label: "Builders shipping side projects", pct: 88 },
              { label: "Early-stage tooling & infrastructure", pct: 74 },
              { label: "Campus finance & markets", pct: 46 },
            ].map((t) => (
              <div key={t.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>{t.label}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>{t.pct}%</span>
                </div>
                <div className="progress"><span style={{ width: `${t.pct}%` }} /></div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <span className="chip">anonymous</span>
              <span className="chip">auto-built</span>
              <span className="chip">private to you</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — full-bleed band */}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { n: "01", title: "Install. Browse normally.", body: "A lightweight Chrome extension runs silently in the background. No setup, no forms, no logins." },
            { n: "02", title: "Your mirror builds itself.", body: "Within an hour, FOMO profiles who you are from where your attention actually goes — not what you post." },
            { n: "03", title: "Join a room, if you want to.", body: "Invite people you know into a private room and see the connections between what everyone's separately researching." },
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
      <section data-reveal style={{ padding: "90px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 90, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
            Privacy
          </div>
          <h2 style={{ fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.08, marginBottom: 20 }}>
            Anonymous by design.<br />Not by accident.
          </h2>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.85, maxWidth: 400 }}>
            Your identity is never attached to your signals. FOMO tracks what you browse — never who you are.
          </p>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ marginBottom: 10, fontSize: "1.1rem" }}>What FOMO sees</h3>
            <p style={{ lineHeight: 1.75 }}>Page titles, URLs, and content — used only to classify your attention. Nothing else.</p>
          </div>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.08)", padding: "30px 34px" }}>
            <h3 style={{ color: "var(--subtle)", marginBottom: 10, fontSize: "1.1rem" }}>What FOMO never touches</h3>
            <p style={{ lineHeight: 1.75 }}>Passwords, messages, form inputs, banking pages, health records. Ever.</p>
          </div>
        </div>
      </section>

      <BottomCta />

    </div>
  );
}

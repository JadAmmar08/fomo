export const runtime = "nodejs";

import Link from "next/link";
import type { Route } from "next";

interface Thesis {
  statement: string;
  isNew: boolean;
}

interface StaleAssumption {
  statement: string;
  note: string;
}

interface BeliefShift {
  description: string;
  detectedAt: string;
}

interface TeamMirrorData {
  onboardingSummary: string | null;
  theses: Thesis[];
  staleAssumptions: StaleAssumption[] | null;
  shifts: BeliefShift[];
  hasEnoughHistoryForStaleness: boolean;
  generatedAt: string;
}

async function getTeamMirrorData(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${appUrl}/api/rooms/mirror?room=${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{ room: { id: string; name: string }; mirror: TeamMirrorData | null }>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
      <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
      {children}
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: 20,
  border: "1px solid var(--line)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
} as const;

export default async function TeamMirrorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTeamMirrorData(slug);

  if (!data) {
    return (
      <div className="stack">
        <section className="panel" style={{ padding: "48px 36px" }}>
          <span className="eyebrow">Teams</span>
          <h1>Team not found.</h1>
          <p style={{ marginBottom: 20 }}>This team doesn&apos;t exist or is no longer active.</p>
          <Link href={"/teams" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
            Back to teams
          </Link>
        </section>
      </div>
    );
  }

  const { room, mirror } = data;
  const hasAnything = mirror && (mirror.onboardingSummary || mirror.theses.length > 0);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section style={{ padding: "64px 0 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Team mirror
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", maxWidth: 700, margin: "0 auto 20px", lineHeight: 1.05 }}>
          {room.name}&apos;s mental model.
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Not what happened today. What this team has come to believe, and where that thinking might be exposed.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href={`/teams/${slug}` as Route} className="button-secondary" style={{ display: "inline-flex" }}>
            See the pulse instead →
          </Link>
        </div>
      </section>

      {!hasAnything ? (
        <section data-reveal style={{ ...cardStyle, padding: "56px 48px", textAlign: "center" }}>
          <h2>Still forming.</h2>
          <p style={{ maxWidth: 420, margin: "0 auto" }}>
            The mental model builds from the team&apos;s connection history. Once the pulse has found a few things, this page starts filling in.
          </p>
        </section>
      ) : (
        <>
          {mirror!.onboardingSummary && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>New to this team?</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 16 }}>Get caught up.</h2>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontStyle: "italic", lineHeight: 1.7, color: "var(--text)" }}>
                {mirror!.onboardingSummary}
              </p>
            </section>
          )}

          {mirror!.theses.length > 0 && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Working theses</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>What this team currently believes.</h2>
              <div className="list">
                {mirror!.theses.map((thesis, i) => (
                  <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {thesis.isNew && <span className="pill" style={{ fontSize: "0.68rem", flexShrink: 0, marginTop: 2 }}>New</span>}
                    <p style={{ fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>{thesis.statement}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
            <SectionLabel>Blind spots</SectionLabel>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 8 }}>Assumptions nobody&apos;s revisited.</h2>
            {mirror!.hasEnoughHistoryForStaleness ? (
              mirror!.staleAssumptions && mirror!.staleAssumptions.length > 0 ? (
                <div className="list" style={{ marginTop: 16 }}>
                  {mirror!.staleAssumptions.map((a, i) => (
                    <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px" }}>
                      <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 6px" }}>{a.statement}</p>
                      <p style={{ fontSize: "0.85rem", margin: 0 }}>{a.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: 8 }}>Nothing flagged as stale right now, the team&apos;s current beliefs are still being actively tested.</p>
              )
            ) : (
              <p style={{ marginTop: 8 }}>Not enough history yet to tell what&apos;s gone unchallenged. This fills in after a few more days of activity.</p>
            )}
          </section>

          <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
            <SectionLabel>Timeline</SectionLabel>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>How thinking has shifted.</h2>
            {mirror!.shifts.length > 0 ? (
              <div className="list">
                {mirror!.shifts.map((shift, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <span className="kicker" style={{ marginBottom: 0, flexShrink: 0, width: 90 }}>
                      {new Date(shift.detectedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                    <p style={{ fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>{shift.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No shifts yet, this fills in as the team&apos;s thinking actually changes over time.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

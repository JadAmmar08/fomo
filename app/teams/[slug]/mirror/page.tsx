export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { logFeatureView } from "@/lib/cost-log";
import { PinButton } from "@/components/pin-button";

interface Thesis {
  statement: string;
  isNew: boolean;
}

interface StaleAssumption {
  statement: string;
  note: string;
}

interface Disagreement {
  statement: string;
}

interface Decision {
  decision: string;
  rationale: string;
}

interface OpenQuestion {
  question: string;
}

interface BeliefShift {
  description: string;
  detectedAt: string;
}

interface TeamMirrorData {
  onboardingSummary: string | null;
  theses: Thesis[];
  staleAssumptions: StaleAssumption[] | null;
  activeDisagreements: Disagreement[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
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

// Groups shifts under a single date header per day instead of repeating the same
// date next to every entry when several land on the same day.
function groupShiftsByDay(shifts: BeliefShift[]): Array<[string, BeliefShift[]]> {
  const groups = new Map<string, BeliefShift[]>();
  for (const shift of shifts) {
    const day = new Date(shift.detectedAt).toLocaleDateString([], { month: "short", day: "numeric" });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(shift);
  }
  return [...groups.entries()];
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

  const cookieStore = await cookies();
  const viewerUid = cookieStore.get("fomo_anonymous_id")?.value ?? "";
  if (viewerUid) {
    logFeatureView({ eventType: "mirror_view", anonymousUserId: viewerUid, roomId: room.id });
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section style={{ padding: "64px 0 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Team mirror
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", maxWidth: 700, margin: "0 auto 20px", lineHeight: 1.05 }}>
          {room.name}&apos;s workstream, from the inside.
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Not what happened today. What this workstream has come to assume, and where that thinking hasn&apos;t been double-checked.
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
            This builds from the workstream&apos;s real activity. Once there&apos;s enough connected work, this page starts filling in.
          </p>
        </section>
      ) : (
        <>
          {mirror!.onboardingSummary && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Picking this up?</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 16 }}>Get caught up.</h2>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontStyle: "italic", lineHeight: 1.7, color: "var(--text)" }}>
                {mirror!.onboardingSummary}
              </p>
            </section>
          )}

          {mirror!.theses.length > 0 && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Current hypotheses</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>What this workstream currently assumes.</h2>
              <div className="list">
                {mirror!.theses.map((thesis, i) => (
                  <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--implication)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {thesis.isNew && <span className="pill" style={{ fontSize: "0.68rem", flexShrink: 0, marginTop: 2, background: "var(--accent)", color: "white" }}>New</span>}
                    <p style={{ fontSize: "0.95rem", lineHeight: 1.7, margin: 0, color: "var(--text-strong)", flex: 1 }}>{thesis.statement}</p>
                    <PinButton roomSlug={slug} cardType="mirror" cardKey={`thesis:${thesis.statement}`} cardData={thesis} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
            <SectionLabel>Unchecked assumptions</SectionLabel>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 8 }}>What you&apos;d be building on top of.</h2>
            {mirror!.hasEnoughHistoryForStaleness ? (
              mirror!.staleAssumptions && mirror!.staleAssumptions.length > 0 ? (
                <div className="list" style={{ marginTop: 16 }}>
                  {mirror!.staleAssumptions.map((a, i) => (
                    <div key={i} style={{ background: "var(--blindspot-soft)", border: "1px solid var(--line)", borderLeft: "3px solid var(--blindspot)", borderRadius: 14, padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 6px", color: "var(--text)" }}>{a.statement}</p>
                        <PinButton roomSlug={slug} cardType="mirror" cardKey={`stale:${a.statement}`} cardData={a} />
                      </div>
                      <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-strong)" }}>{a.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: 8 }}>Nothing flagged as stale right now, current thinking is still being actively tested.</p>
              )
            ) : (
              <p style={{ marginTop: 8 }}>Not enough history yet to tell what&apos;s gone unchallenged. This fills in after a few more days of activity.</p>
            )}
          </section>

          {mirror!.activeDisagreements.length > 0 && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Active disagreements</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>Where current work doesn&apos;t agree.</h2>
              <div className="list">
                {mirror!.activeDisagreements.map((d, i) => (
                  <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--tension)", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={{ fontSize: "0.95rem", lineHeight: 1.7, margin: 0, color: "var(--text-strong)" }}>{d.statement}</p>
                    <PinButton roomSlug={slug} cardType="mirror" cardKey={`disagreement:${d.statement}`} cardData={d} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {mirror!.decisions.length > 0 && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Decisions and rationale</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>What&apos;s been settled, and why.</h2>
              <div className="list">
                {mirror!.decisions.map((d, i) => (
                  <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderLeft: "3px solid var(--accent)", borderRadius: 14, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 6px", color: "var(--text)" }}>{d.decision}</p>
                      <PinButton roomSlug={slug} cardType="mirror" cardKey={`decision:${d.decision}`} cardData={d} />
                    </div>
                    <p style={{ fontSize: "0.85rem", margin: 0, color: "var(--text-strong)" }}>{d.rationale}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {mirror!.openQuestions.length > 0 && (
            <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
              <SectionLabel>Open questions</SectionLabel>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>What&apos;s still unresolved.</h2>
              <div className="list">
                {mirror!.openQuestions.map((q, i) => (
                  <div key={i} style={{ background: "var(--question-soft)", border: "1px solid var(--line)", borderLeft: "3px solid var(--question)", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={{ fontSize: "0.95rem", lineHeight: 1.7, margin: 0, color: "var(--text-strong)" }}>{q.question}</p>
                    <PinButton roomSlug={slug} cardType="mirror" cardKey={`question:${q.question}`} cardData={q} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section data-reveal style={{ ...cardStyle, padding: "40px 44px" }}>
            <SectionLabel>Timeline</SectionLabel>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 20 }}>How thinking has shifted.</h2>
            {mirror!.shifts.length > 0 ? (
              <div style={{ display: "grid", gap: 20 }}>
                {groupShiftsByDay(mirror!.shifts).map(([day, dayShifts]) => (
                  <div key={day} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="kicker" style={{ marginBottom: 0, flexShrink: 0, width: 90, paddingTop: 2 }}>
                      {day}
                    </span>
                    <div style={{ display: "grid", gap: 8, flex: 1 }}>
                      {dayShifts.map((shift, i) => (
                        <p key={i} style={{ fontSize: "0.92rem", lineHeight: 1.6, margin: 0, color: "var(--text-strong)" }}>
                          {shift.description}
                        </p>
                      ))}
                    </div>
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

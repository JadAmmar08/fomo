export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { logFeatureView } from "@/lib/cost-log";
import { MirrorDirectory } from "@/components/mirror-directory";

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

          <MirrorDirectory
            slug={slug}
            roomId={slug}
            viewerUid={viewerUid}
            theses={mirror!.theses}
            activeDisagreements={mirror!.activeDisagreements}
            openQuestions={mirror!.openQuestions}
            staleAssumptions={mirror!.staleAssumptions}
            decisions={mirror!.decisions}
            shifts={mirror!.shifts}
          />
        </>
      )}
    </div>
  );
}

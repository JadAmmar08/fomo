export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { WebOfIdeas } from "@/components/web-of-ideas";

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  insightType: "implication" | "tension" | "question" | "opportunity" | "blind_spot";
  peopleCount: number;
  isNew: boolean;
}

interface WebOfIdeasData {
  connections: IdeaConnection[];
  soloHighlights: string[];
  generatedAt: string;
  newSinceLastView: number;
  previouslyViewedAt: string | null;
}

async function getTeamPulse(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  const uid = cookieStore.get("fomo_anonymous_id")?.value ?? "";

  const res = await fetch(`${appUrl}/api/rooms/pulse?room=${slug}`, {
    headers: uid ? { "x-fomo-anonymous-id": uid } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json() as Promise<{
    room: { id: string; name: string; type: string };
    webOfIdeas: WebOfIdeasData | null;
    generatedAt: string;
  }>;
}

interface GuidanceData {
  pattern: string;
  recommendations: string[];
}

async function getGuidance(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  const uid = cookieStore.get("fomo_anonymous_id")?.value ?? "";
  if (!uid) return null;

  const res = await fetch(`${appUrl}/api/guidance?room=${slug}`, {
    headers: { "x-fomo-anonymous-id": uid },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json() as { guidance: GuidanceData | null };
  return data.guidance;
}

export default async function TeamPulsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, guidance] = await Promise.all([getTeamPulse(slug), getGuidance(slug)]);

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

  const { room, webOfIdeas, generatedAt } = data;
  const hasWeb = webOfIdeas && (webOfIdeas.connections.length > 0 || webOfIdeas.soloHighlights.length > 0);

  return (
    <div>
      <section style={{ padding: "64px 0 40px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Team
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.4rem)", margin: "0 auto 20px", lineHeight: 1.05 }}>
          {room.name}
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto 28px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          What this team is separately researching, stitched together. Never who found what, only how it connects.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--subtle)", fontSize: "0.75rem", marginRight: 6 }}>UPDATED</span>
            {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>
            Team members only
          </span>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href={`/teams/${slug}/mirror` as Route} className="button-secondary" style={{ display: "inline-flex" }}>
            See the team&apos;s mental model →
          </Link>
        </div>
      </section>

      {/* Your research — single-player value, works from day one, before the team has
          enough shared history for real cross-person connections */}
      {guidance && (
        <section data-reveal style={{
          background: "white", borderRadius: 20, border: "1px solid var(--line)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
            <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
            Your research
          </div>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", fontStyle: "italic", lineHeight: 1.7, marginBottom: guidance.recommendations.length > 0 ? 20 : 0 }}>
            {guidance.pattern}
          </p>
          {guidance.recommendations.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {guidance.recommendations.map((rec, i) => (
                <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px" }}>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{rec}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Web of ideas — the team's connections layer */}
      <section data-reveal style={{
        background: "white", borderRadius: 20, border: "1px solid var(--line)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
          Web of ideas
        </div>

        {hasWeb && webOfIdeas!.previouslyViewedAt && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20,
            background: webOfIdeas!.newSinceLastView > 0 ? "var(--accent-soft)" : "var(--surface-raised)",
            color: webOfIdeas!.newSinceLastView > 0 ? "var(--accent)" : "var(--subtle)",
            border: "1px solid var(--line)", borderRadius: 999, padding: "8px 16px", fontSize: "0.85rem", fontWeight: 500
          }}>
            {webOfIdeas!.newSinceLastView > 0
              ? `${webOfIdeas!.newSinceLastView} new since your last visit`
              : "Nothing new since your last visit"}
          </div>
        )}

        {hasWeb ? (
          <WebOfIdeas connections={webOfIdeas!.connections} soloHighlights={webOfIdeas!.soloHighlights} />
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>Still connecting the dots.</h2>
            <p style={{ maxWidth: 480 }}>
              Once members have a few days of research in, FOMO starts finding the overlaps between what everyone's separately looking into. Check back soon.
            </p>
          </>
        )}
      </section>

      <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
        <p style={{ margin: 0 }}>Want to invite more people?</p>
        <Link href={"/teams" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
          Back to teams
        </Link>
      </section>
    </div>
  );
}

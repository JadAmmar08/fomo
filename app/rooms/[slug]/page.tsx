export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { FeedbackActions } from "@/components/feedback-actions";
import { WebOfIdeas } from "@/components/web-of-ideas";

interface Trend {
  id: string;
  topicLabel: string;
  category: string;
  trendScore: number;
  anonymousSignals: number;
  uniqueUsers: number;
  changePct: number;
  timeWindow: string;
  topicTags: string[];
  explanation: string;
}

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
}

interface WebOfIdeasData {
  connections: IdeaConnection[];
  soloHighlights: string[];
  generatedAt: string;
}

async function getRoomPulse(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  const uid = cookieStore.get("fomo_anonymous_id")?.value ?? "";

  const res = await fetch(`${appUrl}/api/rooms/pulse?room=${slug}`, {
    headers: uid ? { "x-fomo-anonymous-id": uid } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json() as Promise<{
    room: { id: string; name: string };
    trends: Trend[];
    webOfIdeas: WebOfIdeasData | null;
    generatedAt: string;
  }>;
}

export default async function RoomPulsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getRoomPulse(slug);

  if (!data) {
    return (
      <div className="stack">
        <section className="panel" style={{ padding: "48px 36px" }}>
          <span className="eyebrow">Rooms</span>
          <h1>Room not found.</h1>
          <p style={{ marginBottom: 20 }}>This room doesn&apos;t exist or is no longer active.</p>
          <Link href={"/rooms" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
            Back to rooms
          </Link>
        </section>
      </div>
    );
  }

  const { room, trends, webOfIdeas, generatedAt } = data;
  const hasWeb = webOfIdeas && (webOfIdeas.connections.length > 0 || webOfIdeas.soloHighlights.length > 0);

  return (
    <div>
      <section style={{ padding: "64px 0 40px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Room
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.4rem)", margin: "0 auto 20px", lineHeight: 1.05 }}>
          {room.name}
        </h1>
        <p style={{ maxWidth: 480, margin: "0 auto 28px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          What this room is separately researching, stitched together — never who found what, only how it connects.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--subtle)", fontSize: "0.75rem", marginRight: 6 }}>UPDATED</span>
            {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>
            Room members only
          </span>
        </div>
      </section>

      {/* Web of ideas — the room-only connections layer */}
      <section data-reveal style={{
        background: "white", borderRadius: 20, border: "1px solid var(--line)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
          Web of ideas
        </div>

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

      {trends.length === 0 ? (
        <section className="panel" style={{ background: "var(--surface)" }}>
          <h2>No activity yet</h2>
          <p>
            Once members browse with the extension active, their signals will show up here. Invite more people to get things going.
          </p>
        </section>
      ) : (
        <section className="grid two">
          {trends.map((trend) => (
            <div key={trend.id} className="panel glow-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="kicker">{trend.timeWindow} · {trend.category}</span>
                  <h2 style={{ marginBottom: 0 }}>{trend.topicLabel}</h2>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="metric" style={{ fontSize: "1.8rem", color: "var(--accent)" }}>
                    {trend.trendScore.toFixed(0)}
                  </div>
                  <div className="score-note">score</div>
                </div>
              </div>

              <div className="tag-row" style={{ marginBottom: 16 }}>
                {trend.topicTags.map((tag) => (
                  <span key={tag} className="chip">{tag}</span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div className="meta-card">
                  <span className="kicker">Signals</span>
                  <strong style={{ fontSize: "1.2rem" }}>{trend.anonymousSignals}</strong>
                </div>
                <div className="meta-card">
                  <span className="kicker">Growth</span>
                  <strong style={{ fontSize: "1.2rem", color: trend.changePct > 0 ? "var(--teal)" : "var(--muted)" }}>
                    {trend.changePct > 0 ? "+" : ""}{Math.round(trend.changePct)}%
                  </strong>
                </div>
              </div>

              <p style={{ marginBottom: 14, fontSize: "0.88rem" }}>{trend.explanation}</p>

              <FeedbackActions
                targetType="pulse"
                targetId={trend.id}
                actions={["good-catch", "not-relevant", "hide-topic"]}
              />
            </div>
          ))}
        </section>
      )}

      <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
        <p style={{ margin: 0 }}>Want to invite more people?</p>
        <Link href={"/rooms" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
          Back to rooms
        </Link>
      </section>
    </div>
  );
}

export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { FeedbackActions } from "@/components/feedback-actions";

interface PresentedTrend {
  id: string;
  topicLabel: string;
  category: string;
  trendScore: number;
  anonymousSignals: number;
  uniqueUsers: number;
  changePct: number;
  narrative: string;
  isPersonalized: boolean;
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
    room: { id: string; name: string; type: string };
    trends: PresentedTrend[];
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

  const { room, trends, generatedAt } = data;

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
          What this room is paying attention to, personalized to you.
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

      {trends.length === 0 ? (
        <section data-reveal style={{
          background: "white", borderRadius: 20, border: "1px solid var(--line)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "56px 48px", textAlign: "center"
        }}>
          <h2>Nothing yet — you&apos;re early.</h2>
          <p style={{ maxWidth: 420, margin: "0 auto" }}>
            Once members browse with the extension active, their signals show up here. Invite more people to get things going.
          </p>
        </section>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {trends.map((trend, i) => (
            <div key={trend.id} data-reveal data-reveal-delay={`${Math.min(i, 4) * 60}`} style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid var(--line)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.07)",
              padding: "36px 40px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {trend.isPersonalized && (
                    <span className="pill" style={{ fontSize: "0.72rem" }}>close to your interests</span>
                  )}
                  <span className="kicker" style={{ marginBottom: 0 }}>{trend.category}</span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", color: "var(--accent)" }}>{trend.trendScore.toFixed(0)}</span>
                  <span className="score-note" style={{ marginLeft: 6 }}>score</span>
                </div>
              </div>

              <h2 style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", lineHeight: 1.1, marginBottom: 14 }}>
                {trend.topicLabel}
              </h2>

              <p style={{ fontSize: "1.02rem", lineHeight: 1.7, color: "var(--muted)", marginBottom: 20, maxWidth: 640 }}>
                {trend.narrative}
              </p>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: "var(--text)" }}>{trend.uniqueUsers}</strong> {trend.uniqueUsers === 1 ? "person" : "people"}
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: "var(--text)" }}>{trend.anonymousSignals}</strong> signals
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--subtle)" }}>
                  <strong style={{ color: trend.changePct > 0 ? "var(--accent)" : "var(--text)" }}>
                    {trend.changePct > 0 ? "+" : ""}{Math.round(trend.changePct)}%
                  </strong> growth
                </span>
              </div>

              <FeedbackActions
                targetType="pulse"
                targetId={trend.id}
                actions={["good-catch", "not-relevant", "hide-topic"]}
              />
            </div>
          ))}
        </div>
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

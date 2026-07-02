export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { FeedbackActions } from "@/components/feedback-actions";

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

async function getRoomPulse(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  const uid = cookieStore.get("fomo_anonymous_id")?.value ?? "";

  const res = await fetch(`${appUrl}/api/rooms/pulse?room=${slug}`, {
    headers: uid ? { "x-fomo-anonymous-id": uid } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json() as Promise<{ room: { id: string; name: string }; trends: Trend[]; generatedAt: string }>;
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
    <div className="stack">
      <section className="panel" style={{ padding: "40px 36px" }}>
        <span className="eyebrow">Room</span>
        <h1>{room.name}</h1>
        <p style={{ marginBottom: 0 }}>
          What people in this room are paying attention to right now. Anonymous, real-time.
        </p>
        <div className="status-strip">
          <div className="status-tile">
            <span className="kicker">Updated</span>
            <div>{new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Window</span>
            <div>Last 48 hours</div>
          </div>
          <div className="status-tile">
            <span className="kicker">Source</span>
            <div>Room members only</div>
          </div>
        </div>
      </section>

      {trends.length === 0 ? (
        <section className="panel" style={{ background: "var(--surface)" }}>
          <h2>No activity yet</h2>
          <p>
            Once members browse with the extension active, their signals will show up here. Invite more people to get things going.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link href={"/rooms" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
              Back to rooms
            </Link>
          </div>
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

      <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0 }}>Want to invite more people?</p>
        <Link href={"/rooms" as Route} className="button-secondary" style={{ display: "inline-flex" }}>
          Back to rooms
        </Link>
      </section>
    </div>
  );
}

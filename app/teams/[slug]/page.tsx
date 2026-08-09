export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { WorkstreamUnified } from "@/components/workstream-unified";
import { RecentCatchesList } from "@/components/recent-catches-list";
import { logFeatureView } from "@/lib/cost-log";

interface RoomCatch {
  cardKey: string;
  text: string;
  conflictKind: "contradiction" | "duplicate";
  files: string[];
  pinnedAt: string;
}

async function getRoom(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieStore = await cookies();
  const uid = cookieStore.get("fomo_anonymous_id")?.value ?? "";

  const res = await fetch(`${appUrl}/api/rooms/pulse?room=${slug}`, {
    headers: uid ? { "x-fomo-anonymous-id": uid } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ room: { id: string; name: string; type: string } }>;
}

async function getCatches(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${appUrl}/api/rooms/catches?room=${slug}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json() as { catches: RoomCatch[] };
  return data.catches;
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, catches] = await Promise.all([getRoom(slug), getCatches(slug)]);

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

  const { room } = data;

  const cookieStore = await cookies();
  const viewerUid = cookieStore.get("fomo_anonymous_id")?.value ?? "";
  if (viewerUid) {
    logFeatureView({ eventType: "pulse_view", anonymousUserId: viewerUid, roomId: room.id });
  }

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
          Contradictions and duplicated work FOMO has caught across everything this team has connected, live, in-document, cited to the exact source.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="status-tile" style={{ background: "white" }}>
            <span style={{ color: "var(--accent)", marginRight: 6 }}>●</span>
            Team members only
          </span>
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/teams/${slug}/mirror` as Route} className="button-secondary" style={{ display: "inline-flex" }}>
            Memory →
          </Link>
        </div>
      </section>

      {/* Live catches — the actual product: contradictions/duplicates FOMO has
          found across this room's connected files, not a research/discovery feed. */}
      <section data-reveal style={{
        background: "white", borderRadius: 20, border: "1px solid var(--line)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
          Recent catches
        </div>
        {catches.length === 0 && (
          <p style={{ maxWidth: 480 }}>
            Nothing caught yet. Once files are connected and someone edits one, contradictions and duplicated work will show up here the moment FOMO finds them.
          </p>
        )}
        {catches.length > 0 && <RecentCatchesList catches={catches} />}
      </section>

      <WorkstreamUnified roomId={slug} />

      {/* Office Add-in — the instant, in-document layer on top of the folder
          connections above. Those alone give webhook-speed detection (save-triggered,
          no install needed); the add-in is what makes Excel catch it live, as you type. */}
      <section data-reveal className="panel" style={{ padding: "40px", marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
          For instant, in-document alerts
        </div>
        <h3 style={{ fontSize: "1.3rem", marginBottom: 10 }}>Get the FOMO add-in for Word, Excel, and PowerPoint.</h3>
        <p style={{ maxWidth: 560, marginBottom: 24 }}>
          The connections above catch contradictions the moment a file is saved. The add-in goes further in Excel, catching it live, cell by cell, as you type, with the conflict highlighted right where it happened.
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {[
            { n: "1", title: "Open any file in Word, Excel, or PowerPoint.", body: "Desktop or web, either works." },
            { n: "2", title: "Insert → Add-ins → search \"FOMO\" → Add.", body: "One-time, per device. Free, no license needed." },
            { n: "3", title: "Sign in with the same team you connected above.", body: "That's it, no separate setup. Detection starts on your next edit." },
          ].map((step) => (
            <div key={step.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{
                width: 26, height: 26, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent)",
                display: "grid", placeItems: "center", fontSize: "0.8rem", fontWeight: 700, flexShrink: 0
              }}>{step.n}</span>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.65 }}>
                <strong style={{ color: "var(--text)" }}>{step.title}</strong> {step.body}
              </p>
            </div>
          ))}
        </div>
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

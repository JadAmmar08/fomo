export const runtime = "nodejs";

import { cookies } from "next/headers";
import Link from "next/link";
import type { Route } from "next";
import { getPool } from "@/lib/postgres";
import { logFeatureView } from "@/lib/cost-log";
import { MirrorDirectory } from "@/components/mirror-directory";

async function getRoom(slug: string) {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ id: string; name: string }>(
    `select id, name from rooms where slug = $1 and is_active = true`,
    [slug]
  );
  return res.rows[0] ?? null;
}

export default async function TeamMirrorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getRoom(slug);

  if (!room) {
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

  const cookieStore = await cookies();
  const viewerUid = cookieStore.get("fomo_anonymous_id")?.value ?? "";
  if (viewerUid) {
    logFeatureView({ eventType: "mirror_view", anonymousUserId: viewerUid, roomId: room.id });
  }

  return (
    <div className="stack" style={{ gap: 24, maxWidth: 640, margin: "0 auto" }}>
      <section style={{ padding: "64px 0 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Your memory
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", maxWidth: 600, margin: "0 auto 20px", lineHeight: 1.05 }}>
          What FOMO understands, and how it can help.
        </h1>
        <p style={{ maxWidth: 460, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Private to you in {room.name}. The more accurate this is, the better your alerts get, FOMO actually uses it to judge whether something&apos;s really worth flagging you for. Correct it any time, or hand a snapshot to whoever&apos;s taking over your work.
        </p>
      </section>

      <MirrorDirectory roomId={slug} viewerUid={viewerUid} />
    </div>
  );
}

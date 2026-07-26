import { getPool } from "@/lib/postgres";

// Shared accumulation layer for both Drive and Slack workstream summaries — stores
// what was seen each time a summary is generated, so the next generation can say
// "here's what changed" instead of re-describing the same static state from scratch.
export async function saveSnapshot(roomId: string, source: "google" | "slack", rawData: unknown, summary: string | null) {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `insert into workstream_snapshots (room_id, source, raw_data, summary) values ($1, $2, $3, $4)`,
    [roomId, source, JSON.stringify(rawData), summary]
  );
}

export async function getLatestSnapshot(roomId: string, source: "google" | "slack") {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ raw_data: unknown; summary: string | null; captured_at: string }>(
    `select raw_data, summary, captured_at from workstream_snapshots
     where room_id = $1 and source = $2 order by captured_at desc limit 1`,
    [roomId, source]
  );
  return res.rows[0] ?? null;
}

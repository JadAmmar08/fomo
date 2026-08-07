import { getPool } from "@/lib/postgres";

export interface EntitySummary {
  entity: string;
  factCount: number;
  lastUpdated: string;
}

// Distinct named entities (clients, projects, people) with a currently-tracked
// fact in this room, most recently touched first — the directory listing for
// the "Fact History" file. Read-only, purely retrospective: this never feeds
// back into detection, it's just making the supersession chain that already
// exists in project_facts actually visible to someone, instead of only ever
// being consulted internally by checkFactsForConflict.
export async function listTrackedEntities(roomId: string): Promise<EntitySummary[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<{ entity: string; fact_count: string; last_updated: string }>(
    `select entity, count(*) as fact_count, max(extracted_at) as last_updated
     from project_facts
     where room_id = $1 and superseded_by is null and entity is not null and entity != ''
     group by entity
     order by max(extracted_at) desc
     limit 100`,
    [roomId]
  );
  return res.rows.map((r) => ({ entity: r.entity, factCount: Number(r.fact_count), lastUpdated: r.last_updated }));
}

export interface FactHistoryEntry {
  subject: string;
  value: string;
  fileName: string;
  location: string;
  extractedAt: string;
  isCurrent: boolean;
}

// The full history for one entity, current facts and their superseded
// predecessors together, oldest first within each subject — "here's every
// value this has held, who set it, and when," the KT/handoff use case the
// supersession chain was always meant to support but nothing surfaced before.
export async function getEntityFactHistory(roomId: string, entity: string): Promise<FactHistoryEntry[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<{
    subject: string;
    value: string;
    file_name: string;
    location: string;
    extracted_at: string;
    superseded_by: string | null;
  }>(
    `select subject, value, file_name, location, extracted_at, superseded_by
     from project_facts
     where room_id = $1 and entity = $2
     order by subject asc, extracted_at asc`,
    [roomId, entity]
  );
  return res.rows.map((r) => ({
    subject: r.subject,
    value: r.value,
    fileName: r.file_name,
    location: r.location,
    extractedAt: r.extracted_at,
    isCurrent: r.superseded_by === null
  }));
}

import { getPool } from "@/lib/postgres";
import type { IdeaConnection } from "@/lib/room-connections";

export interface Thesis {
  statement: string;
  isNew: boolean;
}

export interface StaleAssumption {
  statement: string;
  note: string;
}

export interface BeliefShift {
  description: string;
  detectedAt: string;
}

export interface TeamMirror {
  onboardingSummary: string | null;
  theses: Thesis[];
  staleAssumptions: StaleAssumption[] | null; // null = not enough history yet, not "none found"
  shifts: BeliefShift[];
  hasEnoughHistoryForStaleness: boolean;
  generatedAt: string;
}

const MIRROR_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — this is a slow-moving state, not a live feed
const MIN_HISTORY_ENTRIES_FOR_STALENESS = 3;
const MIN_HISTORY_SPAN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * The Team mirror: an evolving mental model of the team, distinct from the pulse's point-in-time
 * connections. Persisted and updated incrementally rather than recomputed from scratch, so it can
 * say things a snapshot can't: which theses keep getting reinforced, which assumptions haven't
 * been touched in a while, and what's changed since last time.
 */
export async function getTeamMirror(roomId: string, forceRefresh = false): Promise<TeamMirror | null> {
  const pool = getPool();
  if (!pool) return null;

  const stateRes = await pool.query(
    `select onboarding_summary, theses, stale_assumptions, updated_at from team_mirror_state where room_id = $1`,
    [roomId]
  );
  const previousState = stateRes.rows[0] ? mapPreviousState(stateRes.rows[0]) : null;
  const previousUpdatedAt = stateRes.rows[0]?.updated_at as string | undefined;

  if (!forceRefresh && previousState && previousUpdatedAt) {
    const updatedAt = new Date(previousUpdatedAt).getTime();
    if (Date.now() - updatedAt < MIRROR_CACHE_TTL_MS) {
      const shifts = await getShiftHistory(pool, roomId);
      return {
        onboardingSummary: previousState.onboarding_summary,
        theses: previousState.theses,
        staleAssumptions: previousState.stale_assumptions.length ? previousState.stale_assumptions : null,
        shifts,
        hasEnoughHistoryForStaleness: previousState.stale_assumptions.length > 0,
        generatedAt: previousUpdatedAt
      };
    }
  }

  const historyRes = await pool.query(
    `select connections, captured_at from team_connection_history where room_id = $1 order by captured_at asc`,
    [roomId]
  );
  const history = historyRes.rows as Array<{ connections: IdeaConnection[]; captured_at: string }>;

  if (history.length === 0) {
    return {
      onboardingSummary: null,
      theses: [],
      staleAssumptions: null,
      shifts: [],
      hasEnoughHistoryForStaleness: false,
      generatedAt: new Date().toISOString()
    };
  }

  const oldestCapturedAt = new Date(history[0].captured_at).getTime();
  const hasEnoughHistoryForStaleness =
    history.length >= MIN_HISTORY_ENTRIES_FOR_STALENESS &&
    Date.now() - oldestCapturedAt >= MIN_HISTORY_SPAN_MS;

  const computed = await computeMentalModelWithHaiku(history, previousState, hasEnoughHistoryForStaleness);
  if (!computed) {
    return previousState && previousUpdatedAt
      ? {
          onboardingSummary: previousState.onboarding_summary,
          theses: previousState.theses,
          staleAssumptions: previousState.stale_assumptions.length ? previousState.stale_assumptions : null,
          shifts: await getShiftHistory(pool, roomId),
          hasEnoughHistoryForStaleness,
          generatedAt: previousUpdatedAt
        }
      : null;
  }

  await pool.query(
    `insert into team_mirror_state (room_id, onboarding_summary, theses, stale_assumptions, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_id) do update set
       onboarding_summary = excluded.onboarding_summary,
       theses = excluded.theses,
       stale_assumptions = excluded.stale_assumptions,
       updated_at = now()`,
    [
      roomId,
      computed.onboardingSummary,
      JSON.stringify(computed.theses),
      JSON.stringify(hasEnoughHistoryForStaleness ? computed.staleAssumptions : [])
    ]
  );

  for (const shift of computed.newShifts) {
    await pool.query(
      `insert into team_mirror_shifts (room_id, description) values ($1, $2)`,
      [roomId, shift]
    );
  }

  const shifts = await getShiftHistory(pool, roomId);

  return {
    onboardingSummary: computed.onboardingSummary,
    theses: computed.theses,
    staleAssumptions: hasEnoughHistoryForStaleness ? computed.staleAssumptions : null,
    shifts,
    hasEnoughHistoryForStaleness,
    generatedAt: new Date().toISOString()
  };
}

async function getShiftHistory(pool: NonNullable<ReturnType<typeof getPool>>, roomId: string): Promise<BeliefShift[]> {
  const res = await pool.query(
    `select description, detected_at from team_mirror_shifts where room_id = $1 order by detected_at desc limit 20`,
    [roomId]
  );
  return res.rows.map((r) => ({ description: String(r.description), detectedAt: String(r.detected_at) }));
}

interface PreviousState {
  onboarding_summary: string | null;
  theses: Thesis[];
  stale_assumptions: StaleAssumption[];
}

function mapPreviousState(row: Record<string, unknown>): PreviousState {
  return {
    onboarding_summary: (row.onboarding_summary as string | null) ?? null,
    theses: Array.isArray(row.theses) ? (row.theses as Thesis[]) : [],
    stale_assumptions: Array.isArray(row.stale_assumptions) ? (row.stale_assumptions as StaleAssumption[]) : []
  };
}

async function computeMentalModelWithHaiku(
  history: Array<{ connections: IdeaConnection[]; captured_at: string }>,
  previousState: PreviousState | null,
  askForStaleness: boolean
): Promise<{ onboardingSummary: string; theses: Thesis[]; staleAssumptions: StaleAssumption[]; newShifts: string[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const historyBlock = history
      .map((h, i) => `Cycle ${i + 1} (${new Date(h.captured_at).toLocaleDateString()}):\n` +
        h.connections.map((c) => `- ${c.from} <-> ${c.to}: ${c.explanation}`).join("\n"))
      .join("\n\n");

    const previousBlock = previousState
      ? `Previous mental model:\nOnboarding summary: ${previousState.onboarding_summary ?? "(none)"}\nTheses: ${JSON.stringify(previousState.theses)}\nStale assumptions: ${JSON.stringify(previousState.stale_assumptions)}`
      : "No previous mental model exists yet, this is the first time.";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      tools: [
        {
          name: "team_mental_model",
          description: "Return the team's evolving mental model.",
          input_schema: {
            type: "object" as const,
            properties: {
              onboardingSummary: {
                type: "string",
                description: "2-3 sentences a brand new team member could read to get caught up on what this team collectively knows and is working on. No jargon, no internal references."
              },
              theses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    statement: { type: "string" },
                    isNew: { type: "boolean" }
                  },
                  required: ["statement", "isNew"]
                },
                description: "2-4 standing beliefs this team has converged on, based on connections that keep reinforcing the same idea across multiple cycles. Mark isNew true only if this thesis wasn't in the previous model."
              },
              staleAssumptions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    statement: { type: "string" },
                    note: { type: "string" }
                  },
                  required: ["statement", "note"]
                },
                description: "Only fill this in if asked to. Things the team assumed early on that no connection has touched, confirmed, or challenged since."
              },
              newShifts: {
                type: "array",
                items: { type: "string" },
                description: "Only genuinely new changes in the team's thinking since the previous model, not things that were already true last time. Empty array if nothing has actually changed."
              }
            },
            required: ["onboardingSummary", "theses", "staleAssumptions", "newShifts"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "team_mental_model" },
      system: `You maintain an evolving mental model of what a private research team collectively understands, based on a history of AI-found connections between different members' separate research.

This is NOT a summary of the latest cycle. It is a standing, incrementally-updated model of the team's current thinking, so treat the previous model as your starting point and update it, don't rewrite it from scratch each time.

RULES:
- ONBOARDING SUMMARY: written for someone who just joined the team and has seen none of this. Plain, concrete, no internal shorthand.
- THESES: only include a thesis if it's been reinforced by connections across more than one cycle, or is a clear, strong synthesis of the current cycle if this is the first one. A single one-off connection is not a thesis.
- NO INVENTED SPECIFICS: never state a fabricated number, percentage, or timeline not derivable from the actual connections given.
- ONE CLAIM PER STATEMENT: each thesis or stale assumption should be one tight sentence, not a paragraph.
- NO EM-DASHES anywhere in any field. Use a period or comma instead.
${askForStaleness
  ? "- STALE ASSUMPTIONS: you have enough history for this. Flag anything the team assumed in early cycles that has not been touched, confirmed, or challenged by any connection since. If genuinely nothing qualifies, return an empty array, don't force one."
  : "- STALE ASSUMPTIONS: there isn't enough history yet to say anything real here. Always return an empty array for this field regardless of what you see."}
- NEW SHIFTS: compare against the previous model explicitly. Only report something as a shift if it's a genuine change from what the model said last time (a thesis reversed, a new thesis emerged, an assumption got confirmed or broken). If the previous model already said this, it's not new, don't repeat it.`,
      messages: [
        {
          role: "user",
          content: `${previousBlock}\n\nFull history of connection cycles found so far:\n\n${historyBlock}\n\nUpdate the team's mental model.`
        }
      ]
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as {
      onboardingSummary: string;
      theses: Thesis[];
      staleAssumptions: StaleAssumption[];
      newShifts: string[];
    };

    return {
      onboardingSummary: stripEmDash(raw.onboardingSummary),
      theses: Array.isArray(raw.theses)
        ? raw.theses.slice(0, 6).map((t) => ({ ...t, statement: stripEmDash(t.statement) }))
        : [],
      staleAssumptions: Array.isArray(raw.staleAssumptions)
        ? raw.staleAssumptions.slice(0, 6).map((a) => ({ statement: stripEmDash(a.statement), note: stripEmDash(a.note) }))
        : [],
      newShifts: Array.isArray(raw.newShifts) ? raw.newShifts.slice(0, 4).map(stripEmDash) : []
    };
  } catch {
    return null;
  }
}

// Mechanical safety net matching the site-wide no-em-dash rule — prompting alone isn't
// reliable enough (proven true earlier on the connections engine too).
function stripEmDash(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
}

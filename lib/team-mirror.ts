import { getPool } from "@/lib/postgres";
import { logApiCall } from "@/lib/cost-log";
import { getMemberWorkstreamDigest } from "@/lib/workstream";

interface WorkstreamCycle {
  summary: string | null;
  captured_at: string;
}

export interface Thesis {
  statement: string;
  isNew: boolean;
}

export interface StaleAssumption {
  statement: string;
  note: string;
}

export interface Disagreement {
  statement: string;
}

export interface Decision {
  decision: string;
  rationale: string;
}

export interface OpenQuestion {
  question: string;
}

export interface BeliefShift {
  description: string;
  detectedAt: string;
}

export interface TeamMirror {
  onboardingSummary: string | null;
  theses: Thesis[];
  staleAssumptions: StaleAssumption[] | null; // null = not enough history yet, not "none found"
  activeDisagreements: Disagreement[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
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
 * been touched in a while, where two people's current work actually disagrees, and what's changed
 * since last time.
 */
// roomId is the room's UUID (used by the older team_mirror_state/shifts tables);
// roomSlug is the text slug (used by workstream_snapshots, same as every
// integration table built alongside it). Two different keys for historical
// reasons, both required here.
export async function getTeamMirror(roomId: string, roomSlug: string, forceRefresh = false): Promise<TeamMirror | null> {
  const pool = getPool();
  if (!pool) return null;

  const stateRes = await pool.query(
    `select onboarding_summary, theses, stale_assumptions, active_disagreements, decisions, open_questions, updated_at from team_mirror_state where room_id = $1`,
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
        activeDisagreements: previousState.active_disagreements,
        decisions: previousState.decisions,
        openQuestions: previousState.open_questions,
        shifts,
        hasEnoughHistoryForStaleness: previousState.stale_assumptions.length > 0,
        generatedAt: previousUpdatedAt
      };
    }
  }

  const historyRes = await pool.query<WorkstreamCycle>(
    `select summary, captured_at from workstream_snapshots where room_id = $1 and source = 'combined' order by captured_at asc`,
    [roomSlug]
  );
  const history = historyRes.rows;

  if (history.length === 0) {
    return {
      onboardingSummary: null,
      theses: [],
      staleAssumptions: null,
      activeDisagreements: [],
      decisions: [],
      openQuestions: [],
      shifts: [],
      hasEnoughHistoryForStaleness: false,
      generatedAt: new Date().toISOString()
    };
  }

  const oldestCapturedAt = new Date(history[0].captured_at).getTime();
  const hasEnoughHistoryForStaleness =
    history.length >= MIN_HISTORY_ENTRIES_FOR_STALENESS &&
    Date.now() - oldestCapturedAt >= MIN_HISTORY_SPAN_MS;

  // Disagreement detection needs each member's CURRENT position, not the room-wide combined
  // history used for theses/shifts — a disagreement only exists between two people's live
  // digests right now, a blended room summary would already have flattened it away.
  const memberDigests = await getMemberDigestsForRoom(pool, roomId, roomSlug);

  const computed = await computeMentalModelWithHaiku(history, memberDigests, previousState, hasEnoughHistoryForStaleness, roomId);
  if (!computed) {
    return previousState && previousUpdatedAt
      ? {
          onboardingSummary: previousState.onboarding_summary,
          theses: previousState.theses,
          staleAssumptions: previousState.stale_assumptions.length ? previousState.stale_assumptions : null,
          activeDisagreements: previousState.active_disagreements,
          decisions: previousState.decisions,
          openQuestions: previousState.open_questions,
          shifts: await getShiftHistory(pool, roomId),
          hasEnoughHistoryForStaleness,
          generatedAt: previousUpdatedAt
        }
      : null;
  }

  await pool.query(
    `insert into team_mirror_state (room_id, onboarding_summary, theses, stale_assumptions, active_disagreements, decisions, open_questions, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (room_id) do update set
       onboarding_summary = excluded.onboarding_summary,
       theses = excluded.theses,
       stale_assumptions = excluded.stale_assumptions,
       active_disagreements = excluded.active_disagreements,
       decisions = excluded.decisions,
       open_questions = excluded.open_questions,
       updated_at = now()`,
    [
      roomId,
      computed.onboardingSummary,
      JSON.stringify(computed.theses),
      JSON.stringify(hasEnoughHistoryForStaleness ? computed.staleAssumptions : []),
      JSON.stringify(computed.activeDisagreements),
      JSON.stringify(computed.decisions),
      JSON.stringify(computed.openQuestions)
    ]
  );

  // Mechanical backstop, same reasoning as the sentence-length rules below: the "only
  // report genuinely new shifts" instruction relies entirely on the model comparing
  // against the previous model, which drifts under repeated/rapid recomputation,
  // reinserting the same shift reworded slightly each time. Skip anything too similar
  // to something already logged recently, rather than trust the model's judgment alone.
  const recentShiftsRes = await pool.query<{ description: string }>(
    `select description from team_mirror_shifts where room_id = $1 order by detected_at desc limit 15`,
    [roomId]
  );
  const recentDescriptions = recentShiftsRes.rows.map((r) => r.description);

  for (const shift of computed.newShifts) {
    if (recentDescriptions.some((existing) => isNearDuplicate(shift, existing))) continue;
    await pool.query(
      `insert into team_mirror_shifts (room_id, description) values ($1, $2)`,
      [roomId, shift]
    );
    recentDescriptions.push(shift);
  }

  const shifts = await getShiftHistory(pool, roomId);

  return {
    onboardingSummary: computed.onboardingSummary,
    theses: computed.theses,
    staleAssumptions: hasEnoughHistoryForStaleness ? computed.staleAssumptions : null,
    activeDisagreements: computed.activeDisagreements,
    decisions: computed.decisions,
    openQuestions: computed.openQuestions,
    shifts,
    hasEnoughHistoryForStaleness,
    generatedAt: new Date().toISOString()
  };
}

async function getMemberDigestsForRoom(pool: NonNullable<ReturnType<typeof getPool>>, roomId: string, roomSlug: string): Promise<string[]> {
  const membersRes = await pool.query<{ anonymous_user_id: string }>(
    `select anonymous_user_id from room_members where room_id = $1`,
    [roomId]
  );
  const digests: string[] = [];
  for (const member of membersRes.rows) {
    const digest = await getMemberWorkstreamDigest(member.anonymous_user_id, roomSlug).catch(() => null);
    if (digest) digests.push(digest);
  }
  return digests;
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
  active_disagreements: Disagreement[];
  decisions: Decision[];
  open_questions: OpenQuestion[];
}

function mapPreviousState(row: Record<string, unknown>): PreviousState {
  return {
    onboarding_summary: (row.onboarding_summary as string | null) ?? null,
    theses: Array.isArray(row.theses) ? (row.theses as Thesis[]) : [],
    stale_assumptions: Array.isArray(row.stale_assumptions) ? (row.stale_assumptions as StaleAssumption[]) : [],
    active_disagreements: Array.isArray(row.active_disagreements) ? (row.active_disagreements as Disagreement[]) : [],
    decisions: Array.isArray(row.decisions) ? (row.decisions as Decision[]) : [],
    open_questions: Array.isArray(row.open_questions) ? (row.open_questions as OpenQuestion[]) : []
  };
}

async function computeMentalModelWithHaiku(
  history: WorkstreamCycle[],
  memberDigests: string[],
  previousState: PreviousState | null,
  askForStaleness: boolean,
  roomId?: string
): Promise<{
  onboardingSummary: string;
  theses: Thesis[];
  staleAssumptions: StaleAssumption[];
  activeDisagreements: Disagreement[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  newShifts: string[];
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const historyBlock = history
      .filter((h) => h.summary)
      .map((h, i) => `Cycle ${i + 1} (${new Date(h.captured_at).toLocaleDateString()}):\n${h.summary}`)
      .join("\n\n");

    const digestsBlock = memberDigests.length > 0
      ? `\n\nHere is each member's CURRENT individual position, anonymized as Member 1, Member 2, etc (never reference these labels in your output, they're for your reasoning only):\n${memberDigests.map((d, i) => `Member ${i + 1}: ${d}`).join("\n\n")}`
      : "";

    const previousBlock = previousState
      ? `Previous mental model:\nOnboarding summary: ${previousState.onboarding_summary ?? "(none)"}\nTheses: ${JSON.stringify(previousState.theses)}\nStale assumptions: ${JSON.stringify(previousState.stale_assumptions)}\nActive disagreements: ${JSON.stringify(previousState.active_disagreements)}\nDecisions: ${JSON.stringify(previousState.decisions)}\nOpen questions: ${JSON.stringify(previousState.open_questions)}`
      : "No previous mental model exists yet, this is the first time.";

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      tools: [
        {
          name: "team_mental_model",
          description: "Return the team's evolving mental model.",
          input_schema: {
            type: "object" as const,
            properties: {
              onboardingSummary: {
                type: "string",
                description: "2-3 sentences for an analyst picking up this workstream partway through, who has seen none of the work so far. Plain, concrete, no internal shorthand."
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
                description: "2-4 standing working hypotheses this workstream has converged on, based on what keeps showing up consistently across multiple cycles of real file and conversation content. Mark isNew true only if this hypothesis wasn't in the previous model."
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
                description: "Only fill this in if asked to. Assumptions baked into early work that no later file, edit, or conversation has touched, confirmed, or challenged since, the kind of thing an analyst could unknowingly build on top of."
              },
              activeDisagreements: {
                type: "array",
                items: {
                  type: "object",
                  properties: { statement: { type: "string" } },
                  required: ["statement"]
                },
                description: "Only from the per-member CURRENT positions given below, never from the historical cycles. A real, current case where two members' work assumes genuinely incompatible things right now, e.g. 'the commercial workstream assumes an enterprise sales motion, while product research points to department-level purchasing.' Must name both sides in one sentence. Empty array if nothing genuinely conflicts, don't force one."
              },
              decisions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    decision: { type: "string" },
                    rationale: { type: "string" }
                  },
                  required: ["decision", "rationale"]
                },
                description: "Explicit choices the team appears to have made (something ruled in or out), with the reason, so it doesn't get silently re-litigated later. Only include ones clearly grounded in the actual content, don't infer a decision that was never really made."
              },
              openQuestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: { question: { type: "string" } },
                  required: ["question"]
                },
                description: "Genuinely unresolved questions the work itself raises, specific enough someone could go find the answer. Phrase each as an actual question ending in '?'."
              },
              newShifts: {
                type: "array",
                items: { type: "string" },
                description: "Only genuinely new changes in the team's thinking since the previous model, not things that were already true last time. Empty array if nothing has actually changed. Each one is ONE tight sentence, max 20 words, no colons or semicolons chaining two claims together."
              }
            },
            required: ["onboardingSummary", "theses", "staleAssumptions", "activeDisagreements", "decisions", "openQuestions", "newShifts"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "team_mental_model" },
      system: `You maintain an evolving picture of a workstream's real work, based on a history of activity across its connected tools, real file and document content, and conversation. This exists to support the analyst doing the work, not to report on them to leadership, who already know the direction, they just lack sideways visibility into their own workstream's accumulated state.

This is NOT a summary of the latest cycle. It is a standing, incrementally-updated model of the workstream's current thinking, so treat the previous model as your starting point and update it, don't rewrite it from scratch each time.

RULES:
- ONBOARDING SUMMARY: written for an analyst joining or returning to this workstream who has seen none of the work so far. Plain, concrete, no internal shorthand.
- HYPOTHESES: only include one if it's been reinforced by real content across more than one cycle, or is a clear, strong synthesis of the current cycle if this is the first one. A single one-off mention is not a hypothesis.
- ACTIVE DISAGREEMENTS: ground these ONLY in the per-member current-position list given separately below (if given), never in the historical cycle summaries, since those are already a blended room-wide view where a real disagreement would have been flattened out. Never reference "Member 1," "Member 2," or any label implying who holds which position, describe the two positions themselves.
- DECISIONS: state the actual choice and the actual reason, both grounded in real content, never invent a plausible-sounding rationale that isn't there.
- OPEN QUESTIONS: must be genuinely unresolved and specific, not a vague prompt for more research.
- NO INVENTED SPECIFICS: never state a fabricated number, percentage, or timeline not derivable from the actual activity given.
- ONE CLAIM PER STATEMENT: every hypothesis, stale assumption, disagreement, decision, question, and shift is ONE tight sentence (the stale assumption's and decision's second field can be a second sentence), not a paragraph. Hypotheses, stale assumptions, disagreements, decisions, and questions max 25 words, shifts max 20.
- NO EM-DASHES anywhere in any field. Use a period or comma instead.
${askForStaleness
  ? "- STALE ASSUMPTIONS: you have enough history for this. Flag anything assumed in early cycles that has not been touched, confirmed, or challenged by any later activity since. If genuinely nothing qualifies, return an empty array, don't force one."
  : "- STALE ASSUMPTIONS: there isn't enough history yet to say anything real here. Always return an empty array for this field regardless of what you see."}
- NEW SHIFTS: compare against the previous model explicitly. Only report something as a shift if it's a genuine change from what the model said last time (a hypothesis reversed, a new one emerged, an assumption got confirmed or broken, a disagreement resolved or emerged). If the previous model already said this, it's not new, don't repeat it. State only the change itself, skip preamble like "a new thesis has emerged" or "it was found that."`,
      messages: [
        {
          role: "user",
          content: `${previousBlock}\n\nFull history of this workstream's real activity, cycle by cycle:\n\n${historyBlock}${digestsBlock}\n\nUpdate the workstream's mental model.`
        }
      ]
    });

    logApiCall({
      callType: "mirror_synthesis",
      model: "claude-sonnet-4-6",
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      roomId
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as {
      onboardingSummary: string;
      theses: Thesis[];
      staleAssumptions: StaleAssumption[];
      activeDisagreements: Disagreement[];
      decisions: Decision[];
      openQuestions: OpenQuestion[];
      newShifts: string[];
    };

    return {
      onboardingSummary: stripEmDash(raw.onboardingSummary),
      theses: Array.isArray(raw.theses)
        ? raw.theses.slice(0, 6).map((t) => ({ ...t, statement: tightenToOneSentence(stripEmDash(t.statement), 25) }))
        : [],
      staleAssumptions: Array.isArray(raw.staleAssumptions)
        ? raw.staleAssumptions.slice(0, 6).map((a) => ({
            statement: tightenToOneSentence(stripEmDash(a.statement), 25),
            note: tightenToOneSentence(stripEmDash(a.note), 30)
          }))
        : [],
      activeDisagreements: Array.isArray(raw.activeDisagreements)
        ? raw.activeDisagreements
            .slice(0, 5)
            .map((d) => ({ statement: tightenToOneSentence(stripEmDash(d.statement), 25) }))
            .filter((d) => !hasMemberLeak(d.statement))
        : [],
      decisions: Array.isArray(raw.decisions)
        ? raw.decisions.slice(0, 6).map((d) => ({
            decision: tightenToOneSentence(stripEmDash(d.decision), 25),
            rationale: tightenToOneSentence(stripEmDash(d.rationale), 30)
          }))
        : [],
      openQuestions: Array.isArray(raw.openQuestions)
        ? raw.openQuestions.slice(0, 6).map((q) => ({ question: tightenToOneSentence(stripEmDash(q.question), 25) }))
        : [],
      newShifts: Array.isArray(raw.newShifts) ? raw.newShifts.slice(0, 4).map((s) => tightenToOneSentence(stripEmDash(s), 20)) : []
    };
  } catch {
    return null;
  }
}

// Anonymity backstop matching the same rule used across Pulse and Discovery — a member
// label leaking into an active-disagreement statement would deanonymize whose position is
// whose, drop it rather than show it.
function hasMemberLeak(text: string): boolean {
  return /\bmembers?\s*\d/i.test(text);
}

const STOPWORDS = new Set(["the", "a", "an", "is", "are", "was", "were", "as", "of", "to", "and", "or", "in", "on", "for", "with", "has", "have", "been", "being", "this", "that", "it", "not"]);

function wordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w && !STOPWORDS.has(w))
  );
}

// Jaccard similarity over meaningful words — two shift descriptions reworded
// differently but describing the same underlying change share most of their
// substantive words (names, numbers, verbs), even if sentence structure differs.
function isNearDuplicate(a: string, b: string, threshold = 0.3): boolean {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return false;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union >= threshold;
}

// Mechanical safety net matching the site-wide no-em-dash rule — prompting alone isn't
// reliable enough (proven true earlier on the connections engine too).
function stripEmDash(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
}

// Abbreviations that end in a period but never actually end a sentence. Found by a real
// production example: "state vs." got treated as a complete sentence and everything after it
// (the actual point of the sentence) was silently discarded.
const ABBREVIATIONS = /\b(vs|etc|approx|e\.g|i\.e|dr|mr|mrs|ms|jr|sr|u\.s|u\.k|inc|corp|ltd|co|st|ave|no|a\.m|p\.m)$/i;

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  const boundary = /[.?!]\s+/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text))) {
    const before = text.slice(start, match.index); // exclude the punctuation itself
    const wordBeforePeriod = before.trim().split(/\s+/).pop() ?? "";
    if (ABBREVIATIONS.test(wordBeforePeriod)) continue;
    sentences.push(text.slice(start, match.index + 1).trim());
    start = boundary.lastIndex;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

// A throat-clearing preamble before the colon ("A new thesis has emerged: ...", "Cycle 41
// introduced...:") is the model's actual failure mode here, not a real independent clause —
// unlike Pulse's connections, where the part before a colon/semicolon usually IS the claim.
// Keeping "part before the colon" would discard the real finding and keep the filler. Strip
// known preambles instead, don't attempt generic clause-splitting.
const PREAMBLE_PATTERNS = [
  /^a new thesis has emerged(?: (?:from|around|from cycles?) [\w\s()]+)?:\s*/i,
  /^a new stale assumption was flagged:\s*/i,
  /^a new (?:connection|shift|assumption) (?:has emerged|was flagged|surfaced):\s*/i,
  /^it (?:was|has been) (?:found|noted|observed) that\s+/i
];

function stripPreamble(text: string): string {
  for (const pattern of PREAMBLE_PATTERNS) {
    if (pattern.test(text)) {
      const stripped = text.replace(pattern, "").trim();
      return stripped.charAt(0).toUpperCase() + stripped.slice(1);
    }
  }
  return text;
}

/**
 * Mechanical backstop for the "one tight sentence" rule, same reasoning as the connections
 * engine and individual guidance: prompting alone doesn't reliably hold. If the model writes
 * more than one sentence, keep only the first, it's reliably the actual claim. Never force-cut
 * mid-sentence, an honest longer sentence beats a mangled fragment.
 */
function tightenToOneSentence(text: string, maxWords: number): string {
  const sentences = splitIntoSentences(stripPreamble(text.trim()));
  const result = sentences[0] ?? text.trim();
  const wordCount = result.split(/\s+/).filter(Boolean).length;
  if (wordCount > maxWords + 10 && sentences.length === 1) return result;
  return result;
}

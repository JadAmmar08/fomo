import { getPool } from "@/lib/postgres";
import { logApiCall } from "@/lib/cost-log";
import { getTeamWorkstreamItems, getMemberWorkstreamDigest, type OwnedWorkstreamItem } from "@/lib/workstream";
import { sendPushToUser } from "@/lib/push";

export type GuidanceType = "direction" | "question" | "team_signal";

export interface HandoffResourceRef {
  source: string;
  name: string;
  link: string;
  ownerId: string;
  content: string | null;
}

export interface GuidanceRecommendation {
  type: GuidanceType;
  text: string;
  sourceTopics: string[];
  resourceRef?: HandoffResourceRef | null;
}

export interface IndividualGuidance {
  pattern: string;
  recommendations: GuidanceRecommendation[];
  generatedAt: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — a slow-moving personal pattern, not a live feed

/**
 * Single-player value for a team member, closes the loop with the team pulse/mirror once
 * those exist. Looks at one person's own recent research, names the underlying goal, and
 * recommends adjacent directions, and when a roomId is given, also pulls that team's already
 * -computed pulse connections and mirror theses (read-only, no extra AI calls to produce them)
 * so a recommendation can point out when someone's own research already bears on something the
 * team has found. Falls back to a solo-only version when there's no room or no team data yet.
 * Team context here is already anonymized by construction (pulse/mirror never attribute a
 * finding to a person), so this never exposes a teammate's individual browsing.
 */
export async function getIndividualGuidance(anonymousUserId: string, roomId = "", forceRefresh = false): Promise<IndividualGuidance | null> {
  const pool = getPool();
  if (!pool) return null;

  const previousRow = await pool.query(
    `select pattern, recommendations, generated_at from individual_guidance where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );

  if (!forceRefresh && previousRow.rows.length > 0) {
    const generatedAt = new Date(previousRow.rows[0].generated_at as string).getTime();
    if (Date.now() - generatedAt < CACHE_TTL_MS) {
      return {
        pattern: String(previousRow.rows[0].pattern),
        recommendations: normalizeRecommendations(previousRow.rows[0].recommendations),
        generatedAt: new Date(previousRow.rows[0].generated_at as string).toISOString()
      };
    }
  }

  const previousTeamSignalTexts = new Set(
    normalizeRecommendations(previousRow.rows[0]?.recommendations).filter((r) => r.type === "team_signal").map((r) => r.text)
  );

  // Widened from 20 to 40 for the same reason as Pulse (lib/room-connections.ts): frequent
  // personal browsing was filling the cutoff before the model's own relevance filtering against
  // team context ever got a chance to see lower-frequency but genuinely relevant research.
  const topicsRes = await pool.query(
    `select topic_label from browsing_signals
     where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '14 days'
     group by topic_label order by count(*) desc limit 40`,
    [anonymousUserId]
  );
  const browsingTopics = topicsRes.rows.map((r) => String(r.topic_label));

  // Same enrichment as Pulse (lib/room-connections.ts): browsing topics alone are a weak
  // signal for what someone's actually concluded, mixing in their own connected file/Slack
  // content lets the pattern and team_signal reasoning below draw on real work, not just
  // passive research interest.
  let ownDigest: string | null = null;
  let ownNote: string | null = null;
  let ownPreviousNote: string | null = null;
  let roomSlug: string | null = null;
  if (roomId) {
    const roomSlugRes = await pool.query<{ slug: string }>(`select slug from rooms where id = $1`, [roomId]);
    roomSlug = roomSlugRes.rows[0]?.slug ?? null;
    if (roomSlug) ownDigest = await getMemberWorkstreamDigest(anonymousUserId, roomSlug).catch(() => null);

    const noteRes = await pool.query<{ workstream_note: string | null; previous_workstream_note: string | null }>(
      `select workstream_note, previous_workstream_note from room_members where room_id = $1 and anonymous_user_id = $2`,
      [roomId, anonymousUserId]
    );
    ownNote = noteRes.rows[0]?.workstream_note?.trim() || null;
    ownPreviousNote = noteRes.rows[0]?.previous_workstream_note?.trim() || null;
  }
  const noteLine = ownNote
    ? ownPreviousNote && ownPreviousNote !== ownNote
      ? `[What they say they're working on, just changed from: "${ownPreviousNote}"] ${ownNote}`
      : `[What they say they're working on] ${ownNote}`
    : null;
  const topics = [
    ...browsingTopics,
    ...(ownDigest ? [`[Workstream digest] ${ownDigest}`] : []),
    // Explicit, self-reported ground truth from the person themselves, the highest-priority
    // signal available, ranked above inferred digests and browsing topics because it isn't
    // a guess. Lets someone with zero connected tools still get real value from Discovery.
    ...(noteLine ? [noteLine] : [])
  ];
  if (topics.length < 3 && !ownNote) return null;

  const teamContext = roomId ? await getTeamContext(pool, roomId, anonymousUserId) : null;

  const result = await computeGuidanceWithSonnet(topics, teamContext, anonymousUserId, roomId);
  if (!result) return null;

  await pool.query(
    `insert into individual_guidance (anonymous_user_id, room_id, pattern, recommendations, generated_at)
     values ($1, $2, $3, $4, now())
     on conflict (anonymous_user_id, room_id) do update
       set pattern = excluded.pattern, recommendations = excluded.recommendations, generated_at = now()`,
    [anonymousUserId, roomId, result.pattern, JSON.stringify(result.recommendations)]
  );

  // Fires a real push the moment a genuinely new team_signal appears — the whole point of
  // Discovery's team_signal is timely ("go ask before you redo this"), so waiting for the
  // person to happen to reopen the page defeats it.
  const newTeamSignal = result.recommendations.find((r) => r.type === "team_signal" && !previousTeamSignalTexts.has(r.text));
  if (newTeamSignal) {
    sendPushToUser(anonymousUserId, {
      title: "Something relevant just showed up",
      body: newTeamSignal.text,
      url: roomSlug ? `/teams/${roomSlug}` : undefined
    }).catch((err) => console.error("[guidance notify] failed:", err));
  }

  return { ...result, generatedAt: new Date().toISOString() };
}

// Guards against older cached rows that stored plain strings before recommendations had a type.
function normalizeRecommendations(raw: unknown): GuidanceRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    if (typeof r === "string") return { type: "direction" as const, text: r, sourceTopics: [], resourceRef: null };
    const obj = r as { type?: string; text?: string; sourceTopics?: unknown; resourceRef?: HandoffResourceRef | null };
    const type: GuidanceType = obj.type === "question" || obj.type === "team_signal" ? obj.type : "direction";
    const sourceTopics = Array.isArray(obj.sourceTopics) ? obj.sourceTopics.map((t) => String(t)) : [];
    return { type, text: String(obj.text ?? ""), sourceTopics, resourceRef: obj.resourceRef ?? null };
  }).filter((r) => r.text);
}

interface TeamContext {
  description: string | null;
  connectionSummaries: string[];
  theses: string[];
  staleAssumptions: string[];
  teamResourceItems: OwnedWorkstreamItem[];
}

/**
 * Reads whatever the team's pulse and mirror already have cached, plus an anonymous,
 * content-only snapshot of what teammates' connected tools currently hold (never who owns
 * what, never a link — just enough to judge whether it's relevant to this person's own
 * research). Never triggers a fresh AI recompute here, this is meant to be cheap and
 * read-only, riding on work the pulse/mirror pages already do.
 */
async function getTeamContext(pool: NonNullable<ReturnType<typeof getPool>>, roomId: string, anonymousUserId: string): Promise<TeamContext | null> {
  const [roomRes, connectionsRes, mirrorRes] = await Promise.all([
    pool.query(`select slug, description from rooms where id = $1`, [roomId]),
    pool.query(`select connections from room_connections where room_id = $1`, [roomId]),
    pool.query(`select theses, stale_assumptions from team_mirror_state where room_id = $1`, [roomId])
  ]);
  const description = roomRes.rows[0]?.description ? String(roomRes.rows[0].description) : null;
  const roomSlug = roomRes.rows[0]?.slug ? String(roomRes.rows[0].slug) : null;
  const teamResourceItems = roomSlug ? await getTeamWorkstreamItems(roomSlug, anonymousUserId).catch(() => []) : [];

  const connectionSummaries: string[] = [];
  if (connectionsRes.rows.length > 0) {
    const data = connectionsRes.rows[0].connections as { connections?: { from: string; to: string; explanation: string }[] };
    for (const c of (data.connections ?? []).slice(0, 6)) {
      connectionSummaries.push(`${c.from} <-> ${c.to}: ${c.explanation}`);
    }
  }

  const theses: string[] = [];
  const staleAssumptions: string[] = [];
  if (mirrorRes.rows.length > 0) {
    const rawTheses = mirrorRes.rows[0].theses as { statement: string }[] | null;
    const rawStale = mirrorRes.rows[0].stale_assumptions as { statement: string; note: string }[] | null;
    for (const t of rawTheses ?? []) theses.push(t.statement);
    for (const s of rawStale ?? []) staleAssumptions.push(s.statement);
  }

  if (!description && connectionSummaries.length === 0 && theses.length === 0 && staleAssumptions.length === 0 && teamResourceItems.length === 0) return null;
  return { description, connectionSummaries, theses, staleAssumptions, teamResourceItems };
}

async function computeGuidanceWithSonnet(
  topics: string[],
  teamContext: TeamContext | null,
  anonymousUserId?: string,
  roomId?: string
): Promise<{ pattern: string; recommendations: GuidanceRecommendation[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const resourceLines = (teamContext?.teamResourceItems ?? []).map((r) => {
      const excerpt = r.item.content ? r.item.content.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      return excerpt ? `[${r.item.label}] "${r.item.name}" — ${excerpt}` : `[${r.item.label}] "${r.item.name}"`;
    });

    const teamContextBlock = teamContext
      ? `\n\n${teamContext.description ? `This team's actual focus: ${teamContext.description}\n\n` : ""}The team this person is on has already found the following (never reveal who found what, this is team-wide, not personal):\n${[
          ...teamContext.connectionSummaries.map((c) => `- Connection: ${c}`),
          ...teamContext.theses.map((t) => `- Team thesis: ${t}`),
          ...teamContext.staleAssumptions.map((s) => `- Unrevisited team assumption: ${s}`)
        ].join("\n")}${resourceLines.length > 0
          ? `\n\nNumbered list of material teammates (never say who specifically) currently have connected, shown here ONLY so you can judge relevance, never to be named, described in detail, or linked in your output:\n${resourceLines.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
          : ""}`
      : "";

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      tools: [
        {
          name: "research_guidance",
          description: "Return only genuine team-connected signals for this person, or none at all.",
          input_schema: {
            type: "object" as const,
            properties: {
              pattern: { type: "string" },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["team_signal"] },
                    text: { type: "string" },
                    sourceTopics: {
                      type: "array",
                      items: { type: "string" },
                      description: "The literal topic name(s) from the input list that this recommendation is grounded in, copied verbatim."
                    },
                    resourceIndex: {
                      type: ["integer", "null"],
                      description: "Only when grounded in a teammate's connected material (not a team pulse connection/thesis). The 1-based index into the numbered teammate-material list this recommendation is based on. Null otherwise."
                    }
                  },
                  required: ["type", "text", "sourceTopics", "resourceIndex"]
                }
              }
            },
            required: ["pattern", "recommendations"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "research_guidance" },
      system: `Discovery has one job: tell this person when what they're doing genuinely overlaps, conflicts with, or could be helped by what someone else on the team is doing. Nothing else belongs here. This is not a research-ideas tool, it never suggests a generic next direction or open question that doesn't involve the rest of the team, that job belongs elsewhere in the product.

SCOPE: what this person is actually doing is defined ONLY by what's in the input list below, most importantly a line tagged "[What they say they're working on]" if present, that's their own plain-English statement, written by them, not inferred, and it outranks everything else. A line tagged "[Workstream digest]" is a synthesized summary of their real connected files and conversations, already resolved for recency and already distinguishing a settled conclusion from an open hypothesis. Plain topic labels are the weakest signal, browsing history, not stated intent. Use whichever of these exist to understand their scope, never invent scope beyond what's actually given.

THE ONLY THING TO PRODUCE: for each of the two cases below, at most one recommendation, both of type "team_signal":
  (a) their scope genuinely bears on a team connection, thesis, or unrevisited assumption given in team context, e.g. it would confirm, contradict, or extend something the team already found.
  (b) a teammate already has connected material relevant to their scope. NEVER describe what the material actually says, what kind of file it is, or who has it, the whole point is "this probably already exists, go ask," not a preview of its contents.

If NEITHER case is real and specific, return an empty recommendations array. An empty array is the correct, common answer, not a failure state, do not force a connection that only shares a surface theme (e.g. matching vocabulary) rather than an actual substantive link. A "team_signal" requires the topic to plausibly fall within this team's actual stated focus, not something personal and off-scope for this team (coursework, job hunting, an unrelated hobby) that happens to share language with something the team found.

RULES:
- pattern: ONE sentence describing this person's scope as given (their stated focus if present, otherwise a synthesis of their digest/topics). Max 25 words. This is never shown to the user, it exists only to help you reason, so don't optimize its phrasing, just be accurate.
- recommendations: 0-2 items, one per case above, never more. ONE CLAIM PER ITEM, ONE sentence, max 28 words, state the connection only, no follow-up question in the same item.
- NO EM-DASHES. NO SEMICOLONS. No consultant-speak ("optimize," "leverage," "holistic").
- Ground everything in the literal topic names and team context given, don't invent facts, statistics, or timelines not derivable from them.
- sourceTopics: copy verbatim the topic name(s) from the input list (character for character) that this is actually grounded in. Shown to the user as evidence, must trace back to something real.
- Never say "Member 1," "your teammate," or any phrase that implies you know who specifically did what. Team findings belong to the team as a whole.`,
      messages: [
        {
          role: "user",
          content: `Here is what this person is working on:\n\n${topics.map((t) => `- ${t}`).join("\n")}${teamContextBlock}\n\nDoes this genuinely overlap with, conflict with, or relate to what the rest of the team is doing? If not, say so with an empty recommendations array, don't force one.`
        }
      ]
    });

    logApiCall({
      callType: "guidance_synthesis",
      model: "claude-sonnet-4-6",
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      roomId: roomId || undefined,
      anonymousUserId
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as { pattern: string; recommendations: { type?: string; text?: string; sourceTopics?: unknown; resourceIndex?: number | null }[] };
    if (!raw.pattern) return null;

    const resourceItems = teamContext?.teamResourceItems ?? [];

    // Hard filter, not just the schema's enum: only "team_signal" ever survives here.
    // Discovery's whole point now is team-connected relevance, nothing else belongs.
    const recommendations: GuidanceRecommendation[] = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
      .filter((r) => r.type === "team_signal")
      .slice(0, 2)
      .map((r) => {
        // Only keep topics that are verifiably real (exist in what this person actually
        // researched), the same safety net Pulse uses — a hallucinated sourceTopic gets dropped
        // rather than shown as if it were evidence.
        const sourceTopics = (Array.isArray(r.sourceTopics) ? r.sourceTopics : [])
          .map((t) => String(t))
          .filter((t) => topics.includes(t));

        // Resolved server-side only, never something the model wrote out itself, so the
        // resourceRef always traces back to a real connected item, never a hallucination.
        let resourceRef: HandoffResourceRef | null = null;
        if (typeof r.resourceIndex === "number") {
          const owned = resourceItems[r.resourceIndex - 1];
          if (owned) {
            resourceRef = {
              source: owned.item.source,
              name: owned.item.name,
              link: owned.item.link,
              ownerId: owned.ownerId,
              content: owned.item.content ?? null
            };
          }
        }

        return { type: "team_signal" as GuidanceType, text: tightenToOneSentence(stripEmDash(String(r.text ?? "")), 28), sourceTopics, resourceRef };
      })
      .filter((r) => r.text && !hasMemberLeak(r.text));

    return {
      pattern: tightenToOneSentence(stripEmDash(raw.pattern), 25),
      recommendations
    };
  } catch {
    return null;
  }
}

function hasMemberLeak(text: string): boolean {
  return /\bmembers?\s*\d/i.test(text) || /\byour teammate\b/i.test(text);
}

// Abbreviations that end in a period but never actually end a sentence. Found by a real
// production example: "state vs." got treated as a complete sentence and everything after it
// (the actual point of the recommendation) was silently discarded.
const ABBREVIATIONS = /\b(vs|etc|approx|e\.g|i\.e|dr|mr|mrs|ms|jr|sr|u\.s|u\.k|inc|corp|ltd|co|st|ave|no|a\.m|p\.m)$/i;

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  const boundary = /[.?!]\s+/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(text))) {
    const before = text.slice(start, match.index); // exclude the punctuation itself
    const wordBeforePeriod = before.trim().split(/\s+/).pop() ?? "";
    if (ABBREVIATIONS.test(wordBeforePeriod)) continue; // not a real sentence end, keep scanning
    sentences.push(text.slice(start, match.index + 1).trim());
    start = boundary.lastIndex;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

/**
 * Mechanical backstop on top of prompting, the "one sentence, under N words" instruction
 * doesn't reliably hold on its own, especially for team_signal items that try to state a
 * connection and ask a follow-up question in the same breath. If there's more than one
 * sentence, keep only the first, it's reliably the actual claim, the rest is usually a
 * bonus question or restatement. Never force-truncate mid-sentence, a longer complete
 * sentence beats a chopped, unclear fragment.
 */
function tightenToOneSentence(text: string, maxWords: number): string {
  const sentences = splitIntoSentences(text.trim());
  let result = sentences[0] ?? text.trim();

  // If the first sentence alone is still over budget and there's no clean shorter cut,
  // leave it as-is rather than mangle it, matches the project's existing philosophy.
  const wordCount = result.split(/\s+/).filter(Boolean).length;
  if (wordCount > maxWords + 10 && sentences.length === 1) {
    return result; // no safe cut available, leave the honest long version
  }

  if (!/[.!?]$/.test(result)) result += ".";
  return result;
}

function stripEmDash(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

import { getPool } from "@/lib/postgres";
import { logApiCall } from "@/lib/cost-log";

export type GuidanceType = "direction" | "question" | "team_signal";

export interface GuidanceRecommendation {
  type: GuidanceType;
  text: string;
  sourceTopics: string[];
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

  if (!forceRefresh) {
    const cached = await pool.query(
      `select pattern, recommendations, generated_at from individual_guidance where anonymous_user_id = $1 and room_id = $2`,
      [anonymousUserId, roomId]
    );
    if (cached.rows.length > 0) {
      const generatedAt = new Date(cached.rows[0].generated_at as string).getTime();
      if (Date.now() - generatedAt < CACHE_TTL_MS) {
        return {
          pattern: String(cached.rows[0].pattern),
          recommendations: normalizeRecommendations(cached.rows[0].recommendations),
          generatedAt: new Date(cached.rows[0].generated_at as string).toISOString()
        };
      }
    }
  }

  // Widened from 20 to 40 for the same reason as Pulse (lib/room-connections.ts): frequent
  // personal browsing was filling the cutoff before the model's own relevance filtering against
  // team context ever got a chance to see lower-frequency but genuinely relevant research.
  const topicsRes = await pool.query(
    `select topic_label from browsing_signals
     where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '14 days'
     group by topic_label order by count(*) desc limit 40`,
    [anonymousUserId]
  );
  const topics = topicsRes.rows.map((r) => String(r.topic_label));
  if (topics.length < 3) return null;

  const teamContext = roomId ? await getTeamContext(pool, roomId) : null;

  const result = await computeGuidanceWithHaiku(topics, teamContext, anonymousUserId, roomId);
  if (!result) return null;

  await pool.query(
    `insert into individual_guidance (anonymous_user_id, room_id, pattern, recommendations, generated_at)
     values ($1, $2, $3, $4, now())
     on conflict (anonymous_user_id, room_id) do update
       set pattern = excluded.pattern, recommendations = excluded.recommendations, generated_at = now()`,
    [anonymousUserId, roomId, result.pattern, JSON.stringify(result.recommendations)]
  );

  return { ...result, generatedAt: new Date().toISOString() };
}

// Guards against older cached rows that stored plain strings before recommendations had a type.
function normalizeRecommendations(raw: unknown): GuidanceRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    if (typeof r === "string") return { type: "direction" as const, text: r, sourceTopics: [] };
    const obj = r as { type?: string; text?: string; sourceTopics?: unknown };
    const type: GuidanceType = obj.type === "question" || obj.type === "team_signal" ? obj.type : "direction";
    const sourceTopics = Array.isArray(obj.sourceTopics) ? obj.sourceTopics.map((t) => String(t)) : [];
    return { type, text: String(obj.text ?? ""), sourceTopics };
  }).filter((r) => r.text);
}

interface TeamContext {
  description: string | null;
  connectionSummaries: string[];
  theses: string[];
  staleAssumptions: string[];
}

/**
 * Reads whatever the team's pulse and mirror already have cached. Never triggers a fresh
 * AI recompute here, this is meant to be cheap and read-only, riding on work the pulse/mirror
 * pages already do.
 */
async function getTeamContext(pool: NonNullable<ReturnType<typeof getPool>>, roomId: string): Promise<TeamContext | null> {
  const [roomRes, connectionsRes, mirrorRes] = await Promise.all([
    pool.query(`select description from rooms where id = $1`, [roomId]),
    pool.query(`select connections from room_connections where room_id = $1`, [roomId]),
    pool.query(`select theses, stale_assumptions from team_mirror_state where room_id = $1`, [roomId])
  ]);
  const description = roomRes.rows[0]?.description ? String(roomRes.rows[0].description) : null;

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

  if (!description && connectionSummaries.length === 0 && theses.length === 0 && staleAssumptions.length === 0) return null;
  return { description, connectionSummaries, theses, staleAssumptions };
}

async function computeGuidanceWithHaiku(
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

    const teamContextBlock = teamContext
      ? `\n\n${teamContext.description ? `This team's actual focus: ${teamContext.description}\n\n` : ""}The team this person is on has already found the following (never reveal who found what, this is team-wide, not personal):\n${[
          ...teamContext.connectionSummaries.map((c) => `- Connection: ${c}`),
          ...teamContext.theses.map((t) => `- Team thesis: ${t}`),
          ...teamContext.staleAssumptions.map((s) => `- Unrevisited team assumption: ${s}`)
        ].join("\n")}`
      : "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      tools: [
        {
          name: "research_guidance",
          description: "Return the goal behind someone's own research and 1-3 divergent, non-obvious directions that serve that same goal.",
          input_schema: {
            type: "object" as const,
            properties: {
              pattern: { type: "string" },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["direction", "question", "team_signal"]
                    },
                    text: { type: "string" },
                    sourceTopics: {
                      type: "array",
                      items: { type: "string" },
                      description: "The literal topic name(s) from the input list that this recommendation is grounded in, copied verbatim."
                    }
                  },
                  required: ["type", "text", "sourceTopics"]
                }
              }
            },
            required: ["pattern", "recommendations"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "research_guidance" },
      system: `You are helping one person see the underlying goal behind their own recent research, then pointing them toward interesting adjacent directions they likely haven't considered. This is for ONE person only, never reveal or reference which specific teammate found what, team findings are described as belonging to the team, not a person.

STEP 1, understand the goal: don't just describe their topics, infer what they're actually trying to figure out or accomplish, the destination their research is aimed at, not just the road they're currently on.

STEP 2, point in different directions: recommendations must NOT be "go deeper on the same thing" (that's convergent, and boring, it's what they'd think of on their own). Instead, find adjacent, non-obvious angles that still serve the SAME underlying goal but come at it from a direction they haven't been looking, a different field, a different kind of evidence, a related but unexplored question. The test for a good recommendation: if it just says "look closer at X" where X is a topic they already have, it's not divergent enough, reject it and find a real adjacent angle instead.

STEP 3, if team context is provided below: check whether this person's own research pattern genuinely bears on any team connection, thesis, or unrevisited assumption. If it does, ONE recommendation should point that out directly and must use type "team_signal", e.g. "your research on X could speak to the team's open question about Y." Only make this connection if it's real and specific, don't force one. A "team_signal" requires the topic to plausibly fall within this team's actual stated focus, not just share a surface theme (e.g. "loan repricing" language) with something the team found while actually being personal and off-scope (student loans, coursework, job hunting). If a topic is off-scope for this team, it can still inform the pattern and a plain "direction"/"question", just never a "team_signal". If there's no genuine in-scope link, ignore the team context and give purely personal directions instead.

Each recommendation gets a type:
- "direction": a concrete next thing to look into, phrased as a statement, not a question.
- "question": phrased as an actual open question ending in "?", specific enough someone could go find the answer.
- "team_signal": ONLY for the one recommendation (if any) that ties this person's own research to something the team has already found. Never invent one of these if there's no real link.

RULES:
- pattern: ONE sentence naming the actual underlying goal their research is serving, not a restatement of their topics ("You're researching X and Y" is not a goal, it's a list). Max 25 words. Count your words, if over, cut until under.
- recommendations: 1-3 items. ONE CLAIM PER ITEM, ONE sentence, not two. "direction" and "question" are max 20 words. "team_signal" is max 28 words, still one sentence, state the connection only, do not also add a follow-up question in the same item. Do not repeat or lightly rephrase a topic they already have.
- NO EM-DASHES. NO SEMICOLONS. No consultant-speak ("optimize," "leverage," "holistic").
- Ground everything in the literal topic names and team context given, don't invent facts, statistics, or timelines not derivable from them.
- sourceTopics: for each recommendation, copy verbatim the topic name(s) from the input list (character for character) that it's actually grounded in. This is shown to the user as evidence, so it must trace back to something real in the input, not be invented or paraphrased.
- Never say "Member 1," "your teammate," or any phrase that implies you know who specifically did what. Team findings belong to the team as a whole.
- If the topics are too scattered to infer a real goal, say so honestly in the pattern field rather than forcing one.`,
      messages: [
        {
          role: "user",
          content: `Here is what this person has been researching over the last 14 days:\n\n${topics.map((t) => `- ${t}`).join("\n")}${teamContextBlock}\n\nWhat's the underlying goal behind this research, and what interesting, non-obvious directions could they explore next that still serve that same goal?`
        }
      ]
    });

    logApiCall({
      callType: "guidance_synthesis",
      model: "claude-haiku-4-5-20251001",
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      roomId: roomId || undefined,
      anonymousUserId
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as { pattern: string; recommendations: { type?: string; text?: string; sourceTopics?: unknown }[] };
    if (!raw.pattern) return null;

    const recommendations: GuidanceRecommendation[] = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
      .slice(0, 3)
      .map((r) => {
        const type = (r.type === "question" || r.type === "team_signal" ? r.type : "direction") as GuidanceType;
        const maxWords = type === "team_signal" ? 28 : 20;
        // Only keep topics that are verifiably real (exist in what this person actually
        // researched), the same safety net Pulse uses — a hallucinated sourceTopic gets dropped
        // rather than shown as if it were evidence.
        const sourceTopics = (Array.isArray(r.sourceTopics) ? r.sourceTopics : [])
          .map((t) => String(t))
          .filter((t) => topics.includes(t));
        return { type, text: tightenToOneSentence(stripEmDash(String(r.text ?? "")), maxWords), sourceTopics };
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

import { getPool } from "@/lib/postgres";

export type InsightType = "implication" | "tension" | "question" | "opportunity" | "blind_spot";

export interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  insightType: InsightType;
  peopleCount: number;
}

// sourceTopics is internal only, stripped before caching/returning to the UI. It exists so
// peopleCount can be verified against literal topic labels even when the model's display
// "from"/"to" merges near-duplicate labels (e.g. two members' different phrasings of the same
// concept) — matching against a cleaned-up display string was silently dropping real
// connections when labels were messy or inconsistent across members.
type RawConnectionWithSources = Omit<IdeaConnection, "peopleCount"> & { sourceTopics: string[] };

export interface RoomWebOfIdeas {
  connections: (IdeaConnection & { isNew: boolean })[];
  soloHighlights: string[];
  generatedAt: string;
  // Meeting-glance state: lets the UI show "3 new since your last visit" instead of forcing
  // a full re-read every time. previouslyViewedAt is null on someone's first-ever visit, in
  // which case nothing is marked new (there's no "last time" to compare against).
  newSinceLastView: number;
  previouslyViewedAt: string | null;
}

function connectionKey(c: { from: string; to: string; insightType: InsightType }): string {
  return `${c.insightType}:${c.from.trim().toLowerCase()}:${c.to.trim().toLowerCase()}`;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — small pilot rooms don't need live recompute

/**
 * The room-only "connections" layer. This is a separate, deliberate AI call from the
 * per-signal classifier — it reasons ACROSS multiple room members' recent research to find
 * genuine overlaps and adjacencies, and never attributes a connection to a specific member.
 * Cached per room so repeated page views don't re-trigger the model.
 */
export async function getRoomWebOfIdeas(roomId: string, forceRefresh = false): Promise<RoomWebOfIdeas | null> {
  const pool = getPool();
  if (!pool) return null;

  if (!forceRefresh) {
    const cached = await pool.query(
      `select connections, generated_at from room_connections where room_id = $1`,
      [roomId]
    );
    if (cached.rows.length > 0) {
      const generatedAtIso = new Date(cached.rows[0].generated_at as string | Date).toISOString();
      if (Date.now() - new Date(generatedAtIso).getTime() < CACHE_TTL_MS) {
        const data = cached.rows[0].connections as { connections: IdeaConnection[]; soloHighlights: string[] };
        return attachViewState(pool, roomId, { ...data, generatedAt: generatedAtIso });
      }
    }
  }

  const membersRes = await pool.query(
    `select anonymous_user_id from room_members where room_id = $1`,
    [roomId]
  );
  const memberIds = membersRes.rows.map((r) => String(r.anonymous_user_id));
  if (memberIds.length === 0) return null;

  // Per-member topic lists, kept internal only — the AI sees "Member 1, Member 2..." never a name
  const perMemberTopics: string[][] = [];
  for (const memberId of memberIds) {
    const res = await pool.query(
      `select topic_label from browsing_signals
       where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '7 days'
       group by topic_label order by count(*) desc limit 15`,
      [memberId]
    );
    perMemberTopics.push(res.rows.map((r) => String(r.topic_label)));
  }

  const totalTopics = perMemberTopics.reduce((sum, t) => sum + t.length, 0);
  if (totalTopics < 3) {
    return attachViewState(pool, roomId, { connections: [], soloHighlights: [], generatedAt: new Date().toISOString() });
  }

  const rawConnections = await computeConnectionsWithHaiku(perMemberTopics);
  if (!rawConnections) {
    return attachViewState(pool, roomId, { connections: [], soloHighlights: [], generatedAt: new Date().toISOString() });
  }

  // peopleCount is computed from the actual data, not asked of the model — count distinct
  // members whose topic list contains at least one of the connection's verified sourceTopics.
  // Verified against literal labels (sourceTopics), not the display from/to, because the model
  // sometimes merges near-duplicate labels for display (e.g. two members' different phrasings
  // of the same concept) — matching the merged string would silently drop a genuine connection.
  // This also acts as a hard safety net: a hallucinated sourceTopic that matches no member's
  // real data, or a connection that only traces back to one member, gets dropped.
  const connections = {
    ...rawConnections,
    connections: rawConnections.connections
      .map((c) => {
        const explanation = tightenExplanation(c.explanation, c.insightType);
        const verifiedTopics = c.sourceTopics.filter((t) =>
          perMemberTopics.some((topics) => topics.includes(t))
        );
        const { sourceTopics: _sourceTopics, ...rest } = c;
        return {
          ...rest,
          explanation,
          // A card labeled "Open question" that isn't actually phrased as a question is a
          // mislabel, not an insight type — downgrade rather than show false framing.
          insightType: c.insightType === "question" && !explanation.trim().endsWith("?")
            ? "implication" as const
            : c.insightType,
          peopleCount: perMemberTopics.filter(
            (topics) => verifiedTopics.some((t) => topics.includes(t))
          ).length
        };
      })
      .filter((c) => c.peopleCount >= 2)
      // Fabricated specifics (invented percentages, dollar amounts, year/month ranges) are a
      // real recurring failure mode — the model states them with confidence but they aren't
      // derivable from a topic label. Drop the connection rather than show a confident-sounding
      // invented stat; a shorter honest list beats a longer fabricated one.
      .filter((c) => !hasFabricatedSpecifics(c.explanation))
      .filter((c) => !hasMemberLeak(c.explanation) && !hasMemberLeak(c.from) && !hasMemberLeak(c.to))
  };

  await pool.query(
    `insert into room_connections (room_id, connections, generated_at)
     values ($1, $2, now())
     on conflict (room_id) do update set connections = excluded.connections, generated_at = now()`,
    [roomId, JSON.stringify(connections)]
  );

  // Append-only history, distinct from the overwritten cache above — this is what lets the
  // team mirror detect reinforcement, staleness, and shifts over time instead of only ever
  // seeing the latest snapshot.
  if (connections.connections.length > 0) {
    await pool.query(
      `insert into team_connection_history (room_id, connections) values ($1, $2)`,
      [roomId, JSON.stringify(connections.connections)]
    );
  }

  return attachViewState(pool, roomId, { ...connections, generatedAt: new Date().toISOString() });
}

/**
 * Attaches "new since your last visit" state so the pulse can be skimmed in a meeting instead
 * of re-read in full every time. Reads the last time anyone loaded this team's pulse, diffs the
 * current connections against whatever the history shows as of that visit, then bumps the
 * viewed timestamp to now. On a first-ever visit there's no prior snapshot to diff against, so
 * nothing is marked new rather than flagging everything.
 */
async function attachViewState(
  pool: NonNullable<ReturnType<typeof getPool>>,
  roomId: string,
  data: { connections: IdeaConnection[]; soloHighlights: string[]; generatedAt: string }
): Promise<RoomWebOfIdeas> {
  const roomRes = await pool.query(`select pulse_last_viewed_at from rooms where id = $1`, [roomId]);
  const previouslyViewedAt = roomRes.rows[0]?.pulse_last_viewed_at
    ? new Date(roomRes.rows[0].pulse_last_viewed_at as string | Date).toISOString()
    : null;

  let previousKeys = new Set<string>();
  if (previouslyViewedAt) {
    const historyRes = await pool.query(
      `select connections from team_connection_history
       where room_id = $1 and captured_at <= $2
       order by captured_at desc limit 1`,
      [roomId, previouslyViewedAt]
    );
    if (historyRes.rows.length > 0) {
      const prevConnections = historyRes.rows[0].connections as IdeaConnection[];
      previousKeys = new Set(prevConnections.map(connectionKey));
    }
  }

  const connectionsWithIsNew = data.connections.map((c) => ({
    ...c,
    isNew: previouslyViewedAt !== null && !previousKeys.has(connectionKey(c))
  }));

  await pool.query(
    `update rooms set pulse_last_viewed_at = now() where id = $1`,
    [roomId]
  );

  return {
    ...data,
    connections: connectionsWithIsNew,
    newSinceLastView: connectionsWithIsNew.filter((c) => c.isNew).length,
    previouslyViewedAt
  };
}

const MAX_EXPLANATION_CHARS = 200;

/**
 * Mechanical backstop on top of prompting — the model doesn't reliably obey the "one clause,
 * no semicolon/dash/but" instruction on its own. Only cuts when the remainder after cutting is
 * itself a complete, sensible clause (has a verb-ish shape and isn't a dangling fragment).
 * If no safe cut point exists, leaves the text untouched — a longer complete sentence beats a
 * mechanically broken one.
 */
function hasFabricatedSpecifics(text: string): boolean {
  return (
    /\d+\s*[-–]\s*\d+\s*(year|month|week|day)s?\b/i.test(text) || // "5-7 year"
    /\$\s?\d/.test(text) || // "$50M"
    /\b\d+(\.\d+)?\s*%/.test(text) // "40%"
  );
}

// Anonymity is core to the product, connections must never attribute an idea to a specific
// person. The prompt already forbids referencing "Member 1" etc. in explanations, but the model
// doesn't always obey it, especially when reasoning gets more verbose — drop the connection
// rather than leak an internal reasoning label into user-facing text.
function hasMemberLeak(text: string): boolean {
  return /\bmembers?\s*\d/i.test(text);
}

function looksComplete(clause: string): boolean {
  const c = clause.trim();
  if (c.length < 25) return false;
  // Dangling conjunctions/fragments at the end are the tell of an unsafe cut
  if (/\b(if|whether|because|since|that|which|who|what|and|or|but|to|for|of|the|a|an)$/i.test(c)) return false;
  return true;
}

function tightenExplanation(text: string, insightType: InsightType): string {
  const original = text.trim();

  // A real question must keep its full structure and its "?" — never run clause-splitting on
  // it, since cutting a question in half destroys the thing that makes it a question.
  if (original.includes("?")) {
    const upToQuestion = original.slice(0, original.indexOf("?") + 1);
    return upToQuestion.length >= 15 ? upToQuestion : original;
  }

  let result = original;

  // A tension is DEFINED by its two-sided contrast ("X assumes A, but Y needs B") — cutting
  // at "but"/dash/semicolon would delete the very thing that makes it a tension, leaving a
  // flat one-sided statement. Only the length cap (below) applies to tension cards; the
  // clause-splitting pass is skipped entirely for this type.
  if (insightType !== "tension") {
    for (const splitter of [/\s+[—–]\s+/, /;\s*/, /,?\s+but\s+/i]) {
      const parts = result.split(splitter);
      if (parts.length > 1 && looksComplete(parts[0])) {
        result = parts[0].trim();
        break;
      }
    }
  }

  // Tension cards get more room before truncation kicks in, since the two-sided contrast
  // structure naturally runs a bit longer than a single-claim sentence.
  const maxChars = insightType === "tension" ? MAX_EXPLANATION_CHARS + 60 : MAX_EXPLANATION_CHARS;

  if (result.length > maxChars) {
    const truncated = result.slice(0, maxChars);
    const lastComma = truncated.lastIndexOf(",");
    const candidate = lastComma > 60 ? truncated.slice(0, lastComma) : truncated.slice(0, truncated.lastIndexOf(" "));
    // For a tension, only accept a truncation that still contains a contrast word — otherwise
    // we'd be flattening it into a one-sided statement, which defeats the label.
    const stillHasContrast = insightType !== "tension" || /\b(but|while|yet|whereas|however)\b/i.test(candidate);
    result = (looksComplete(candidate) && stillHasContrast) ? candidate.trim() : original;
  }

  if (!/[.!?]$/.test(result)) result += ".";
  return result;
}

async function computeConnectionsWithHaiku(
  perMemberTopics: string[][]
): Promise<{ connections: RawConnectionWithSources[]; soloHighlights: string[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const memberBlock = perMemberTopics
      .map((topics, i) => `Member ${i + 1}:\n${topics.map((t) => `- ${t}`).join("\n")}`)
      .join("\n\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      tools: [
        {
          name: "web_of_ideas",
          description: "Return the connections found between different members' research topics.",
          input_schema: {
            type: "object" as const,
            properties: {
              connections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    from: { type: "string" },
                    to: { type: "string" },
                    explanation: { type: "string" },
                    insightType: {
                      type: "string",
                      enum: ["implication", "tension", "question", "opportunity", "blind_spot"]
                    },
                    sourceTopics: {
                      type: "array",
                      items: { type: "string" },
                      description: "The exact topic labels this connection is grounded in, copied verbatim (character for character) from the input lists — at least one from each side. Never paraphrase, merge, or clean these up, even if 'from'/'to' above are a tidied-up display version."
                    }
                  },
                  required: ["from", "to", "explanation", "insightType", "sourceTopics"]
                },
                description: "Ordered by insight value, most valuable first — not by how obviously related the topics are."
              },
              soloHighlights: {
                type: "array",
                items: { type: "string" },
                description: "Individually interesting topics that didn't connect to anything else, worth surfacing alone."
              }
            },
            required: ["connections", "soloHighlights"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "web_of_ideas" },
      system: `You are a research analyst finding non-obvious, high-value connections between what different members of a private group are independently looking into. This is the core value of the product: turning quiet, separate research into a shared discovery the group wouldn't have found on its own.

WHAT COUNTS AS A GOOD CONNECTION:
Not "these two topics are related" — that's a fact, not an insight. Each label has a REQUIRED shape. Writing a short sentence is not enough — it must preserve the shape below or it doesn't count as that label:
- an IMPLICATION: state what follows IF both signals are true — an "if both are real, then..." consequence, not just a fact about one side.
- a TENSION: MUST name both sides of the conflict in the same sentence (e.g. "X assumes A, but Y requires B"). A sentence that only states one side is not a tension — it's an unfinished thought. Do not write a tension you can't fit both sides into; pick a different label instead.
- a QUESTION: a real unresolved question, ending in "?", specific enough that someone could go find the answer.
- an OPPORTUNITY: a concrete advantage available ONLY because of the overlap — what becomes possible, not just what's interesting.
- a BLIND_SPOT: name the specific thing one side is missing, and (implicitly) who already has it.

RULES:
- Only connect topics from DIFFERENT members — never connect a member's topics to their own other topics.
- sourceTopics must be copied verbatim from the input, character for character, even if two members phrased the same idea differently (e.g. "off-target effects" vs "off target risk"). List each real label separately in sourceTopics rather than merging them into one — the "from"/"to" fields can be a cleaner display version, but sourceTopics must trace back to exactly what was written in the input.
- Reject superficial overlap. Two things being in the same broad field (both "biotech," both "tech") is NOT enough — there must be a specific, concrete link between them.
- ONE CLAIM. HARD LIMIT ~25 WORDS (30 for tension, since it needs both sides). Count your words before answering — if you're over, cut until you're under.
- NO SEMICOLONS. NO EM-DASHES. For every label EXCEPT tension: NO "BUT" either — if your sentence needs it, you're trying to say two things, pick the stronger one. For TENSION specifically, "but" (or "while"/"yet") is required, not banned — it's the only way to show both sides in one sentence. Do not pad a tension with extra description beyond the two sides themselves.
- NO INVENTED SPECIFICS. Never state a fabricated number, percentage, timeline, or fact that isn't derivable from the topic labels themselves (no "18-24 month windows," no "$50M," no invented statistics) — that's the tell of a plausible-sounding but ungrounded claim. Ground the claim only in the concepts actually named in the topics.
- No throat-clearing, no "Both are..." or "These are..." openings. Start directly with the claim.
- The claim should point at something the room should DO or NOTICE: talk to each other, investigate something specific, recognize a mismatch, or reinterpret one side's work in light of the other's.
- Bad (generic relatedness): "CRISPR therapies need to navigate FDA approval, so whoever's researching the science should align with whoever's mapping the regulatory path."
- Bad for a non-tension label (two ideas stitched together): "CRISPR's off-target editing risk may push regulatory timelines toward multi-year clinical trials, but most biotech funding rounds assume shorter commercialization windows." — this shape is fine, but ONLY if labeled tension.
- Good implication (one claim, 14 words): "The regulatory research should tell the funding side whether their timeline assumption is realistic."
- Good tension (both sides, 22 words): "The gene-editing research assumes a slower regulatory path, but the funding side is planning around a much faster one."
- NO CONSULTANT-SPEAK. Never write "may reveal," "risking," "capital allocation patterns," "distributing risk across modalities," or any phrase that sounds smart but could be pasted into a different room about a different topic and still sound plausible. If you can imagine the same sentence working for an unrelated pair of topics, rewrite it using the actual words from the two specific topics instead.
- NAME THE ACTUAL TOPICS, not a generic abstraction of them. Reference the specific thing (the exact gene, drug, approval type, funding stage — whatever is literally in the topic label) rather than talking about "the science" or "the funding side" in the abstract.
- If insightType is "question", the explanation MUST be phrased as an actual question ending in "?" — something specific the room could go find the answer to. It is not a recommendation or a piece of advice in disguise.
- Every explanation should point at a concrete next step: something to compare, check, ask, or validate — not just an observation that a tension or gap exists.
- ORDER connections by insight value, not by topical closeness. The single best, sharpest, most surprising connection goes first. If you only have 1-2 genuine insights, return only those — do not pad the list.
- NEVER reference "Member 1", "Member 2", "Members 3 and 5" etc. in your explanations, from, or to fields — those labels are for your reasoning only and never appear in output text. This is a hard requirement, not a style preference: anonymity is the product's core guarantee. Rewrite the sentence around the concepts themselves instead (say what the ideas imply, not who holds them).
- For strong individual topics that don't connect to anything else, list them in soloHighlights as short phrases.
- If nothing in the data produces a real insight (not just a topical relation), return an empty connections array. A shorter, sharper list beats a longer, softer one.`,
      messages: [
        {
          role: "user",
          content: `Here is what each member of this private room has been researching over the last 7 days:\n\n${memberBlock}\n\nFind the sharpest, most valuable connections between different members' work — implications, tensions, open questions, or opportunities, not just topical overlap. Order by insight value. List any standout individual topics that don't connect to anything.`
        }
      ]
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as { connections: RawConnectionWithSources[]; soloHighlights: string[] };
    return {
      connections: Array.isArray(raw.connections)
        ? raw.connections.slice(0, 6).map((c) => ({ ...c, sourceTopics: Array.isArray(c.sourceTopics) ? c.sourceTopics : [] }))
        : [],
      soloHighlights: Array.isArray(raw.soloHighlights) ? raw.soloHighlights.slice(0, 8) : []
    };
  } catch {
    return null;
  }
}

import { getPool } from "@/lib/postgres";

export type InsightType = "implication" | "tension" | "question" | "opportunity" | "blind_spot";

export interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  insightType: InsightType;
  peopleCount: number;
}

export interface RoomWebOfIdeas {
  connections: IdeaConnection[];
  soloHighlights: string[];
  generatedAt: string;
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
      const generatedAt = new Date(String(cached.rows[0].generated_at)).getTime();
      if (Date.now() - generatedAt < CACHE_TTL_MS) {
        const data = cached.rows[0].connections as { connections: IdeaConnection[]; soloHighlights: string[] };
        return { ...data, generatedAt: String(cached.rows[0].generated_at) };
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
  if (totalTopics < 3) return { connections: [], soloHighlights: [], generatedAt: new Date().toISOString() };

  const rawConnections = await computeConnectionsWithHaiku(perMemberTopics);
  if (!rawConnections) return { connections: [], soloHighlights: [], generatedAt: new Date().toISOString() };

  // peopleCount is computed from the actual data, not asked of the model — count distinct
  // members whose topic list contains either side of the connection. This also acts as a
  // hard safety net: if the model slips and connects one member's own two topics, peopleCount
  // comes back as 1 and we drop it rather than show a fake cross-person connection.
  const connections = {
    ...rawConnections,
    connections: rawConnections.connections
      .map((c) => ({
        ...c,
        peopleCount: perMemberTopics.filter(
          (topics) => topics.includes(c.from) || topics.includes(c.to)
        ).length
      }))
      .filter((c) => c.peopleCount >= 2)
  };

  await pool.query(
    `insert into room_connections (room_id, connections, generated_at)
     values ($1, $2, now())
     on conflict (room_id) do update set connections = excluded.connections, generated_at = now()`,
    [roomId, JSON.stringify(connections)]
  );

  return { ...connections, generatedAt: new Date().toISOString() };
}

type RawConnection = Omit<IdeaConnection, "peopleCount">;

async function computeConnectionsWithHaiku(
  perMemberTopics: string[][]
): Promise<{ connections: RawConnection[]; soloHighlights: string[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const memberBlock = perMemberTopics
      .map((topics, i) => `Member ${i + 1}:\n${topics.map((t) => `- ${t}`).join("\n")}`)
      .join("\n\n");

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
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
                    }
                  },
                  required: ["from", "to", "explanation", "insightType"]
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
Not "these two topics are related" — that's a fact, not an insight. A good connection surfaces one of:
- an IMPLICATION: what one person's work means for the other's, that they probably haven't realized
- a TENSION: a conflict, tradeoff, or disagreement between two approaches/findings
- a QUESTION: a concrete open question the overlap raises that the group should go answer
- an OPPORTUNITY: something actionable they could do together because of the overlap
- a BLIND_SPOT: something one side is missing that the other side already knows

RULES:
- Only connect topics from DIFFERENT members — never connect a member's topics to their own other topics.
- Reject superficial overlap. Two things being in the same broad field (both "biotech," both "tech") is NOT enough — there must be a specific, concrete link between them.
- EXPLANATIONS MUST BE ONE TIGHT SENTENCE. No throat-clearing, no "Both are..." or "These are..." openings — those are the tell of a generic-relatedness observation, not an insight. Start directly with the implication, tension, question, or opportunity itself.
- Bad (generic relatedness): "CRISPR therapies need to navigate FDA approval, so whoever's researching the science should align with whoever's mapping the regulatory path."
- Good (concrete implication): "The regulatory approach only works if the gene-editing method stays within the FDA's current somatic-cell framework — worth checking before either side goes further."
- Good (open question): "Neither side has worked out whether the funding timeline can actually survive the regulatory timeline — that's the real question here."
- ORDER connections by insight value, not by topical closeness. The single best, sharpest, most surprising connection goes first. If you only have 1-2 genuine insights, return only those — do not pad the list.
- NEVER reference "Member 1", "Member 2" etc. in your explanations — those labels are for your reasoning only.
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

    const raw = toolBlock.input as { connections: RawConnection[]; soloHighlights: string[] };
    return {
      connections: Array.isArray(raw.connections) ? raw.connections.slice(0, 6) : [],
      soloHighlights: Array.isArray(raw.soloHighlights) ? raw.soloHighlights.slice(0, 8) : []
    };
  } catch {
    return null;
  }
}

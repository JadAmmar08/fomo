import { getPool } from "@/lib/postgres";

export interface IndividualGuidance {
  pattern: string;
  recommendations: string[];
  generatedAt: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — a slow-moving personal pattern, not a live feed

/**
 * Single-player value for a team member on day one, before the team has enough shared
 * history for real cross-person connections. Looks only at one person's own recent research,
 * names the pattern in it, and recommends specific next directions. Distinct from the team
 * pulse/mirror, which reason across multiple people's browsing and never attribute anything
 * to an individual.
 */
export async function getIndividualGuidance(anonymousUserId: string, forceRefresh = false): Promise<IndividualGuidance | null> {
  const pool = getPool();
  if (!pool) return null;

  if (!forceRefresh) {
    const cached = await pool.query(
      `select pattern, recommendations, generated_at from individual_guidance where anonymous_user_id = $1`,
      [anonymousUserId]
    );
    if (cached.rows.length > 0) {
      const generatedAt = new Date(cached.rows[0].generated_at as string).getTime();
      if (Date.now() - generatedAt < CACHE_TTL_MS) {
        return {
          pattern: String(cached.rows[0].pattern),
          recommendations: Array.isArray(cached.rows[0].recommendations) ? cached.rows[0].recommendations.map(String) : [],
          generatedAt: new Date(cached.rows[0].generated_at as string).toISOString()
        };
      }
    }
  }

  const topicsRes = await pool.query(
    `select topic_label from browsing_signals
     where anonymous_user_id = $1 and timestamp_bucket >= now() - interval '14 days'
     group by topic_label order by count(*) desc limit 20`,
    [anonymousUserId]
  );
  const topics = topicsRes.rows.map((r) => String(r.topic_label));
  if (topics.length < 3) return null;

  const result = await computeGuidanceWithHaiku(topics);
  if (!result) return null;

  await pool.query(
    `insert into individual_guidance (anonymous_user_id, pattern, recommendations, generated_at)
     values ($1, $2, $3, now())
     on conflict (anonymous_user_id) do update
       set pattern = excluded.pattern, recommendations = excluded.recommendations, generated_at = now()`,
    [anonymousUserId, result.pattern, JSON.stringify(result.recommendations)]
  );

  return { ...result, generatedAt: new Date().toISOString() };
}

async function computeGuidanceWithHaiku(topics: string[]): Promise<{ pattern: string; recommendations: string[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      tools: [
        {
          name: "research_guidance",
          description: "Return the goal behind someone's own research and 1-3 divergent, non-obvious directions that serve that same goal.",
          input_schema: {
            type: "object" as const,
            properties: {
              pattern: { type: "string" },
              recommendations: { type: "array", items: { type: "string" } }
            },
            required: ["pattern", "recommendations"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "research_guidance" },
      system: `You are helping one person see the underlying goal behind their own recent research, then pointing them toward interesting adjacent directions they likely haven't considered. This is for ONE person only, not a team, never reference other people.

STEP 1, understand the goal: don't just describe their topics, infer what they're actually trying to figure out or accomplish, the destination their research is aimed at, not just the road they're currently on.

STEP 2, point in different directions: the recommendations must NOT be "go deeper on the same thing" (that's convergent, and boring, it's what they'd think of on their own). Instead, find adjacent, non-obvious angles that still serve the SAME underlying goal but come at it from a direction they haven't been looking, a different field, a different kind of evidence, a related but unexplored question. The test for a good recommendation: if it just says "look closer at X" where X is a topic they already have, it's not divergent enough, reject it and find a real adjacent angle instead.

RULES:
- pattern: one sentence naming the actual underlying goal their research is serving, not a restatement of their topics ("You're researching X and Y" is not a goal, it's a list). Max 30 words.
- recommendations: 1-3 specific, non-obvious directions that serve the same goal from a new angle, phrased as a concrete thing to look into. Each under 20 words. Do not repeat or lightly rephrase a topic they already have.
- NO EM-DASHES. NO SEMICOLONS. No consultant-speak ("optimize," "leverage," "holistic").
- Ground everything in the literal topic names given, don't invent facts, statistics, or timelines not derivable from the topics. A divergent direction still has to be a real, plausible extension of their actual research, not a random unrelated idea.
- If the topics are too scattered to infer a real goal, say so honestly in the pattern field rather than forcing one.`,
      messages: [
        {
          role: "user",
          content: `Here is what this person has been researching over the last 14 days:\n\n${topics.map((t) => `- ${t}`).join("\n")}\n\nWhat's the underlying goal behind this research, and what interesting, non-obvious directions could they explore next that still serve that same goal?`
        }
      ]
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return null;

    const raw = toolBlock.input as { pattern: string; recommendations: string[] };
    if (!raw.pattern) return null;

    return {
      pattern: stripEmDash(raw.pattern),
      recommendations: (Array.isArray(raw.recommendations) ? raw.recommendations : []).slice(0, 3).map(stripEmDash)
    };
  } catch {
    return null;
  }
}

function stripEmDash(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ");
}

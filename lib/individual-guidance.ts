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
          description: "Return a pattern in someone's own research and 1-3 specific next directions.",
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
      system: `You are helping one person see the pattern in their own recent research and what to look into next. This is for ONE person only, not a team, never reference other people.

RULES:
- pattern: one sentence naming the actual throughline across their topics, not a generic restatement ("You're researching X and Y" is not a pattern, it's a list). Name what the topics have in common or where they're heading. Max 30 words.
- recommendations: 1-3 specific next research directions that follow naturally from the pattern, phrased as a concrete thing to look into, not vague advice. Each under 20 words.
- NO EM-DASHES. NO SEMICOLONS. No consultant-speak ("optimize," "leverage," "holistic").
- Ground everything in the literal topic names given, don't invent facts, statistics, or timelines not derivable from the topics.
- If the topics are too scattered or unrelated to form a real pattern, say so honestly in the pattern field rather than forcing one.`,
      messages: [
        {
          role: "user",
          content: `Here is what this person has been researching over the last 14 days:\n\n${topics.map((t) => `- ${t}`).join("\n")}\n\nWhat's the pattern, and what should they look into next?`
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

import Anthropic from "@anthropic-ai/sdk";
import type { UserInterest, Category } from "@/lib/types";

export interface CommunityPlacement {
  id: string;
  name: string;
  description: string;
  confidence: number;
  primaryCategories: Category[];
  signal: string;
}

export async function inferCommunities(interests: UserInterest[]): Promise<CommunityPlacement[]> {
  if (interests.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackCommunities(interests);

  try {
    const client = new Anthropic({ apiKey });

    const topInterests = interests
      .filter((i) => !i.hidden)
      .sort((a, b) => b.confidence * b.signalCount - a.confidence * a.signalCount)
      .slice(0, 20)
      .map((i) => ({
        topic: i.topicLabel,
        category: i.category,
        signals: i.signalCount,
        confidence: Math.round(i.confidence * 100),
        trend: i.change
      }));

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
      max_tokens: 1024,
      tools: [
        {
          name: "place_in_communities",
          description: "Generate community placements for a user based on their attention patterns.",
          input_schema: {
            type: "object" as const,
            properties: {
              communities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    confidence: { type: "number" },
                    primaryCategories: { type: "array", items: { type: "string" } },
                    signal: { type: "string" }
                  },
                  required: ["name", "description", "confidence", "primaryCategories", "signal"],
                  additionalProperties: false
                },
                minItems: 1,
                maxItems: 4
              }
            },
            required: ["communities"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "place_in_communities" },
      system: `You analyze a person's browsing attention patterns and group them into communities they naturally belong to.

RULES:
- Generate 1–4 communities that genuinely reflect this person's attention fingerprint
- Community names should be specific and evocative — not generic category names
- Names should feel like real groups of people ("Pre-med students tracking research", "Early-stage founders in AI", "Finance students watching markets")
- Description should be 1–2 sentences explaining who else is in this community
- Signal should be 1 sentence explaining what in their attention data led to this placement
- Confidence is 0.0–1.0 based on how strongly the data supports this placement
- primaryCategories should list the broad content categories that drive this placement
- If the data is thin (few signals, low confidence), generate fewer but more accurate communities — don't guess
- Never invent communities not supported by the data`,
      messages: [
        {
          role: "user",
          content: `Here are this user's top attention topics. Generate community placements:\n\n${JSON.stringify(topInterests, null, 2)}`
        }
      ]
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return fallbackCommunities(interests);

    const result = toolBlock.input as { communities: Array<{
      name: string;
      description: string;
      confidence: number;
      primaryCategories: string[];
      signal: string;
    }> };

    return result.communities.map((c) => ({
      id: `community_${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: c.name,
      description: c.description,
      confidence: Math.min(0.97, Math.max(0.1, c.confidence)),
      primaryCategories: c.primaryCategories as Category[],
      signal: c.signal
    }));
  } catch {
    return fallbackCommunities(interests);
  }
}

function fallbackCommunities(interests: UserInterest[]): CommunityPlacement[] {
  const categoryCounts = new Map<string, number>();
  for (const i of interests) {
    categoryCounts.set(i.category, (categoryCounts.get(i.category) ?? 0) + i.signalCount);
  }
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topCategory) return [];

  return [{
    id: `community_${topCategory[0]}`,
    name: topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1),
    description: `People paying close attention to ${topCategory[0]} content.`,
    confidence: 0.5,
    primaryCategories: [topCategory[0] as Category],
    signal: `Most attention concentrated in ${topCategory[0]}.`
  }];
}

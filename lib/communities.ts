import Anthropic from "@anthropic-ai/sdk";
import type { UserInterest, Category, PersonalProfile } from "@/lib/types";

export interface CommunityPlacement {
  id: string;
  name: string;
  description: string;
  confidence: number;
  primaryCategories: Category[];
  signal: string;
}

export interface InferenceResult {
  communities: CommunityPlacement[];
  personalProfile: PersonalProfile | null;
}

export async function inferCommunities(interests: UserInterest[]): Promise<InferenceResult> {
  if (interests.length === 0) return { communities: [], personalProfile: null };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { communities: [], personalProfile: null };

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
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [
        {
          name: "build_mirror",
          description: "Generate a personal profile and community placements from a user's attention patterns.",
          input_schema: {
            type: "object" as const,
            properties: {
              personalProfile: {
                type: "object",
                description: "A personal identity statement inferred from browsing behavior.",
                properties: {
                  headline: {
                    type: "string",
                    description: "A specific, personal description of who this person seems to be — like 'Finance student tracking startup markets' or 'Pre-med focused on neuroscience research'. 4–8 words. Never generic like 'Technology user'."
                  },
                  description: {
                    type: "string",
                    description: "1–2 sentences explaining what their browsing pattern reveals about them as a person — their apparent role, goals, or context."
                  },
                  evidenceTags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3–6 short tags pulled directly from their top topics that back up the headline. These are the reasons FOMO built this profile.",
                    minItems: 2,
                    maxItems: 6
                  }
                },
                required: ["headline", "description", "evidenceTags"],
                additionalProperties: false
              },
              communities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Specific group name like 'Early-stage founders in AI' or 'Pre-med students tracking research'. Never just a category." },
                    description: { type: "string", description: "1–2 sentences on who else is in this community." },
                    confidence: { type: "number" },
                    primaryCategories: { type: "array", items: { type: "string" } },
                    signal: { type: "string", description: "1 sentence on what browsing pattern led to this placement." }
                  },
                  required: ["name", "description", "confidence", "primaryCategories", "signal"],
                  additionalProperties: false
                },
                minItems: 1,
                maxItems: 4
              }
            },
            required: ["personalProfile", "communities"],
            additionalProperties: false
          }
        }
      ],
      tool_choice: { type: "tool", name: "build_mirror" },
      system: `You analyze a person's browsing attention patterns to build their personal profile and community placements for FOMO.

PERSONAL PROFILE RULES:
- The headline should read like how a person would describe themselves — role + focus area
- Draw on real signals: if they browse AI tools + startup news → "Founder tracking AI tools and operators"
- If they browse finance + campus news → "Business student watching markets and campus life"
- Never use generic category words like "Technology enthusiast" or "Finance person"
- The evidenceTags should be 2–6 word phrases pulled directly from their actual top topics

COMMUNITY RULES:
- Community names should feel like real groups of people ("Pre-med students tracking research", "Early-stage founders in AI")
- Never just use a category as the name ("Technology", "Finance")
- signal: 1 sentence on what in their data caused this placement
- If data is thin, generate 1 accurate community instead of 4 guesses`,
      messages: [
        {
          role: "user",
          content: `Build the mirror for this user based on their top attention topics:\n\n${JSON.stringify(topInterests, null, 2)}`
        }
      ]
    });

    const toolBlock = message.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") return { communities: [], personalProfile: null };

    const result = toolBlock.input as {
      personalProfile: { headline: string; description: string; evidenceTags: string[] };
      communities: Array<{
        name: string;
        description: string;
        confidence: number;
        primaryCategories: string[];
        signal: string;
      }>;
    };

    return {
      personalProfile: result.personalProfile,
      communities: result.communities.map((c) => ({
        id: `community_${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        name: c.name,
        description: c.description,
        confidence: Math.min(0.97, Math.max(0.1, c.confidence)),
        primaryCategories: c.primaryCategories as CommunityPlacement["primaryCategories"],
        signal: c.signal
      }))
    };
  } catch (err) {
    console.error("[communities] inferCommunities error:", err);
    return { communities: [], personalProfile: null };
  }
}

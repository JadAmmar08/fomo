import type { UserInterest, Category } from "@/lib/types";

export interface CommunityPlacement {
  id: string;
  name: string;
  description: string;
  confidence: number;
  primaryCategories: Category[];
  signal: string;
}

type CommunityDefinition = {
  name: string;
  description: string;
  signal: string;
  requires: Category[];
  boosts?: Category[];
  minConfidence: number;
};

const COMMUNITY_DEFINITIONS: CommunityDefinition[] = [
  {
    name: "Startup Builders",
    description: "People building or closely following early-stage companies, fundraising, and the founding journey.",
    signal: "High attention to startup news, founder content, and venture activity.",
    requires: ["startups"],
    boosts: ["technology", "finance"],
    minConfidence: 0.3
  },
  {
    name: "Finance & Markets",
    description: "People tracking markets, investments, economic trends, and financial news closely.",
    signal: "Consistent attention to financial publications, market data, and investment content.",
    requires: ["finance"],
    boosts: ["startups", "research"],
    minConfidence: 0.3
  },
  {
    name: "Tech & Builders",
    description: "Developers, engineers, and technically-minded people following the software and tools ecosystem.",
    signal: "Strong attention to developer tools, software projects, and technical discussions.",
    requires: ["technology"],
    boosts: ["startups", "research"],
    minConfidence: 0.3
  },
  {
    name: "Campus & Student Life",
    description: "Students and people embedded in university culture, academics, and campus communities.",
    signal: "Attention concentrated on educational platforms, campus resources, and student content.",
    requires: ["school/campus"],
    boosts: ["events", "research"],
    minConfidence: 0.3
  },
  {
    name: "Research & Academia",
    description: "People who follow academic work, scientific publishing, and knowledge-driven fields.",
    signal: "Regular attention to research papers, journals, and academic institutions.",
    requires: ["research"],
    boosts: ["technology", "healthcare"],
    minConfidence: 0.3
  },
  {
    name: "Healthcare & Biotech",
    description: "People tracking health innovation, clinical research, biotech, and medical news.",
    signal: "Consistent attention to health publications, clinical content, and biotech developments.",
    requires: ["healthcare"],
    boosts: ["research", "startups"],
    minConfidence: 0.3
  },
  {
    name: "Sports & Athletics",
    description: "People closely following sports, athletes, leagues, and competitive events.",
    signal: "High attention to sports media, game coverage, and athletic content.",
    requires: ["sports"],
    boosts: ["events", "entertainment"],
    minConfidence: 0.3
  },
  {
    name: "Culture & Entertainment",
    description: "People tracking film, music, media, and pop culture as it evolves.",
    signal: "Sustained attention to entertainment publications, streaming, and cultural content.",
    requires: ["entertainment"],
    boosts: ["fashion", "events"],
    minConfidence: 0.3
  },
  {
    name: "VC & Dealflow",
    description: "People at the intersection of startups and capital — founders, investors, and operators.",
    signal: "Combined attention to startups and finance suggests proximity to the investment ecosystem.",
    requires: ["startups", "finance"],
    boosts: ["technology"],
    minConfidence: 0.28
  },
  {
    name: "Emerging Tech",
    description: "People on the frontier of new technology — AI, crypto, biotech, and what comes next.",
    signal: "Attention spanning technology, research, and startups points to early-adopter orientation.",
    requires: ["technology", "research"],
    boosts: ["startups", "healthcare"],
    minConfidence: 0.28
  },
  {
    name: "Fashion & Style",
    description: "People tracking fashion, aesthetics, trends, and the culture of style.",
    signal: "Attention to fashion publications, runway coverage, and style content.",
    requires: ["fashion"],
    boosts: ["entertainment", "events"],
    minConfidence: 0.3
  },
  {
    name: "Events & Community",
    description: "People who are plugged into local happenings, conferences, and community gatherings.",
    signal: "Attention to event listings, meetups, and community-driven content.",
    requires: ["events"],
    boosts: ["startups", "school/campus"],
    minConfidence: 0.3
  }
];

function categoryScore(interests: UserInterest[], category: Category): number {
  const matching = interests.filter((i) => i.category === category && !i.hidden);
  if (matching.length === 0) return 0;
  const total = matching.reduce((sum, i) => sum + i.confidence * Math.log1p(i.signalCount), 0);
  return total / matching.length;
}

export function inferCommunities(interests: UserInterest[]): CommunityPlacement[] {
  if (interests.length === 0) return [];

  const scores = new Map<Category, number>();
  const allCategories = Array.from(new Set(interests.map((i) => i.category)));
  for (const cat of allCategories) {
    scores.set(cat, categoryScore(interests, cat));
  }

  const placements: CommunityPlacement[] = [];

  for (const def of COMMUNITY_DEFINITIONS) {
    const requiredScores = def.requires.map((cat) => scores.get(cat) ?? 0);
    if (requiredScores.some((s) => s < def.minConfidence)) continue;

    const baseScore = requiredScores.reduce((a, b) => a + b, 0) / requiredScores.length;
    const boostScore = (def.boosts ?? []).reduce((sum, cat) => sum + (scores.get(cat) ?? 0) * 0.2, 0);
    const confidence = Math.min(0.97, baseScore + boostScore);

    placements.push({
      id: `community_${def.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: def.name,
      description: def.description,
      confidence,
      primaryCategories: def.requires,
      signal: def.signal
    });
  }

  return placements
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

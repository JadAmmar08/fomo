import { CATEGORIES, type Category } from "@/lib/types";

export interface ClassifierInput {
  domain: string;
  pageTitle: string;
  urlPath: string;
  pageHints?: string[];
  pageContent?: string;
  localCategory?: Category | string;
  localConfidence?: number;
  localReasoning?: string;
  localTopicLabel?: string;
  localTopicTags?: string[];
}

export interface ClassificationResult {
  category: Category;
  topicLabel: string;
  topicTags: string[];
  confidence: number;
  reasoning: string;
}

type WeightedRule = {
  pattern: string;
  weight: number;
  source: "domain" | "title" | "path";
  note: string;
};

const categoryRules: Record<Category, WeightedRule[]> = {
  startups: [
    { pattern: "techcrunch.com", weight: 4.4, source: "domain", note: "startup-heavy publication" },
    { pattern: "ycombinator.com", weight: 4.8, source: "domain", note: "startup accelerator domain" },
    { pattern: "producthunt.com", weight: 4.5, source: "domain", note: "new product discovery domain" },
    { pattern: "founder", weight: 2.4, source: "title", note: "founder language in title" },
    { pattern: "venture", weight: 2.2, source: "title", note: "venture language in title" },
    { pattern: "seed", weight: 2.2, source: "title", note: "early-stage funding language" },
    { pattern: "launch", weight: 1.4, source: "path", note: "launch-oriented path signal" }
  ],
  finance: [
    { pattern: "bloomberg.com", weight: 4.8, source: "domain", note: "finance news domain" },
    { pattern: "wsj.com", weight: 4.2, source: "domain", note: "market-oriented publication" },
    { pattern: "coinbase.com", weight: 4.1, source: "domain", note: "financial services domain" },
    { pattern: "earnings", weight: 2.8, source: "title", note: "earnings language in title" },
    { pattern: "market", weight: 2.5, source: "title", note: "market language in title" },
    { pattern: "stocks", weight: 2.2, source: "title", note: "stock language in title" },
    { pattern: "invest", weight: 2.0, source: "path", note: "investment-oriented path signal" }
  ],
  healthcare: [
    { pattern: "nih.gov", weight: 4.8, source: "domain", note: "health research institution" },
    { pattern: "statnews.com", weight: 4.2, source: "domain", note: "healthcare publication" },
    { pattern: "clinical", weight: 2.6, source: "title", note: "clinical language in title" },
    { pattern: "biotech", weight: 2.4, source: "title", note: "biotech language in title" },
    { pattern: "hospital", weight: 2.3, source: "title", note: "care delivery language in title" },
    { pattern: "health", weight: 1.9, source: "path", note: "health-oriented path signal" }
  ],
  sports: [
    { pattern: "espn.com", weight: 4.9, source: "domain", note: "sports media domain" },
    { pattern: "theathletic.com", weight: 4.5, source: "domain", note: "sports coverage domain" },
    { pattern: "nba", weight: 2.6, source: "title", note: "league mention in title" },
    { pattern: "nfl", weight: 2.6, source: "title", note: "league mention in title" },
    { pattern: "match", weight: 2.1, source: "title", note: "match language in title" },
    { pattern: "score", weight: 2.0, source: "path", note: "score-related path signal" }
  ],
  entertainment: [
    { pattern: "netflix.com", weight: 4.6, source: "domain", note: "streaming domain" },
    { pattern: "spotify.com", weight: 4.6, source: "domain", note: "music streaming domain" },
    { pattern: "variety.com", weight: 4.1, source: "domain", note: "entertainment publication" },
    { pattern: "movie", weight: 2.3, source: "title", note: "film language in title" },
    { pattern: "music", weight: 2.3, source: "title", note: "music language in title" },
    { pattern: "streaming", weight: 2.0, source: "title", note: "streaming language in title" },
    { pattern: "festival", weight: 1.9, source: "path", note: "festival-related path signal" }
  ],
  "school/campus": [
    { pattern: ".edu", weight: 4.7, source: "domain", note: "education domain" },
    { pattern: "canvas", weight: 3.8, source: "domain", note: "campus learning platform" },
    { pattern: "university", weight: 2.4, source: "title", note: "university language in title" },
    { pattern: "student", weight: 2.2, source: "title", note: "student language in title" },
    { pattern: "campus", weight: 2.2, source: "title", note: "campus language in title" },
    { pattern: "class", weight: 1.6, source: "path", note: "class-related path signal" }
  ],
  research: [
    { pattern: "arxiv.org", weight: 4.9, source: "domain", note: "research archive domain" },
    { pattern: "nature.com", weight: 4.5, source: "domain", note: "research journal domain" },
    { pattern: "scholar.google.com", weight: 4.4, source: "domain", note: "scholarly search domain" },
    { pattern: "paper", weight: 2.6, source: "title", note: "paper language in title" },
    { pattern: "research", weight: 2.4, source: "title", note: "research language in title" },
    { pattern: "study", weight: 2.2, source: "title", note: "study language in title" },
    { pattern: "/abs/", weight: 2.0, source: "path", note: "paper abstract path" }
  ],
  technology: [
    { pattern: "github.com", weight: 4.9, source: "domain", note: "developer collaboration domain" },
    { pattern: "vercel.com", weight: 4.3, source: "domain", note: "developer tooling domain" },
    { pattern: "developer", weight: 2.3, source: "title", note: "developer language in title" },
    { pattern: "software", weight: 2.3, source: "title", note: "software language in title" },
    { pattern: "programming", weight: 2.3, source: "title", note: "programming language in title" },
    { pattern: "typescript", weight: 2.0, source: "path", note: "technical path signal" },
    { pattern: "ai", weight: 1.5, source: "title", note: "AI language in title" }
  ],
  fashion: [
    { pattern: "vogue.com", weight: 4.7, source: "domain", note: "fashion publication domain" },
    { pattern: "ssense.com", weight: 4.4, source: "domain", note: "fashion retail domain" },
    { pattern: "fashion", weight: 2.5, source: "title", note: "fashion language in title" },
    { pattern: "runway", weight: 2.2, source: "title", note: "runway language in title" },
    { pattern: "designer", weight: 2.0, source: "title", note: "designer language in title" },
    { pattern: "style", weight: 1.8, source: "path", note: "style-oriented path signal" }
  ],
  food: [
    { pattern: "eater.com", weight: 4.4, source: "domain", note: "food publication domain" },
    { pattern: "allrecipes.com", weight: 4.5, source: "domain", note: "recipe domain" },
    { pattern: "recipe", weight: 2.5, source: "title", note: "recipe language in title" },
    { pattern: "restaurant", weight: 2.4, source: "title", note: "restaurant language in title" },
    { pattern: "dining", weight: 2.0, source: "title", note: "dining language in title" },
    { pattern: "cafe", weight: 1.7, source: "path", note: "cafe-related path signal" }
  ],
  events: [
    { pattern: "eventbrite.com", weight: 4.8, source: "domain", note: "ticketing domain" },
    { pattern: "meetup.com", weight: 4.8, source: "domain", note: "community events domain" },
    { pattern: "conference", weight: 2.4, source: "title", note: "conference language in title" },
    { pattern: "meetup", weight: 2.4, source: "title", note: "meetup language in title" },
    { pattern: "summit", weight: 2.2, source: "title", note: "summit language in title" },
    { pattern: "tickets", weight: 2.0, source: "path", note: "ticketing path signal" }
  ]
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanTopicText(value: string) {
  return value
    .replace(/^fomo\s*/i, "")
    .replace(/^pulse\s*/i, "")
    .replace(/^mirror\s*/i, "")
    .replace(/^community pulse\s*/i, "")
    .replace(/^private mirror\s*/i, "")
    .replace(/\br\/([a-z0-9_]+)/gi, "$1")
    .replace(/\b(u|user)\/([a-z0-9_-]+)/gi, "")
    .replace(/^full timeline hiring process\s*:?\s*/i, "")
    .replace(/^timeline hiring process\s*:?\s*/i, "")
    .replace(/^interview timeline\s*:?\s*/i, "")
    .replace(/\s*:\s*r\/[a-z0-9_]+/gi, "")
    // Strip platform suffixes that add no topic information
    .replace(/\s*\|\s*(LinkedIn|Twitter|X|Instagram|Facebook|TikTok|Reddit|YouTube|Snapchat|Pinterest|Threads).*/gi, "")
    .replace(/\s*\|\s*.*/g, "")
    .replace(/\s*-\s*(ESPN|YouTube|Reddit|LinkedIn|Twitter|Facebook|Instagram|TikTok|Google).*/gi, "")
    // Strip "on LinkedIn", "on Twitter" etc.
    .replace(/\s+on\s+(LinkedIn|Twitter|X|Instagram|Facebook|TikTok|Reddit|YouTube)\s*$/gi, "")
    // Strip "| Professional Experience" and similar LinkedIn cruft
    .replace(/\s*\|\s*professional experience\s*$/gi, "")
    .replace(/\s*\|\s*professional background\s*$/gi, "")
    .replace(/\.(html?|php|aspx?)$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePathSegment(part: string) {
  return cleanTopicText(
    decodeURIComponent(part)
      .replace(/\.(html?|php|aspx?)$/gi, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b(index|home|default|admin|materials?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const GENERIC_TOPIC_LABELS = new Set([
  "feed",
  "overview",
  "home",
  "profile",
  "post",
  "comments",
  "jobs",
  "linkedin",
  "linkedin com",
  "reddit",
  "reddit com",
  "google",
  "youtube",
  "search",
  "notifications",
  "messages",
  "inbox",
  "explore",
  "discover",
  "trending",
  "following",
  "followers",
  "dashboard",
  "settings",
  "account",
  "login",
  "signup",
  "sign up",
  "sign in",
  "new tab",
  "untitled page",
  "twitter",
  "x com",
  "instagram",
  "facebook",
  "tiktok",
  "snapchat"
]);

const PLATFORM_WORDS = new Set([
  "linkedin",
  "reddit",
  "youtube",
  "google",
  "instagram",
  "facebook",
  "feed",
  "home",
  "overview",
  "profile",
  "post",
  "comments",
  "jobs"
]);

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripPlatformWords(value: string) {
  return value
    .split(/\s+/)
    .filter((part) => !PLATFORM_WORDS.has(part.toLowerCase()))
    .join(" ")
    .trim();
}

function looksLikeUsername(label: string) {
  const cleaned = label.trim();
  // All-lowercase alphanumeric+underscore with no spaces = typical username/handle
  if (/^[a-z][a-z0-9_]{2,}$/.test(cleaned)) return true;
  return false;
}

function isLowQualityTopicLabel(label: string, input: ClassifierInput) {
  const cleaned = cleanTopicText(label).toLowerCase();
  const domain = input.domain.replace(/^www\./, "").toLowerCase();
  const domainRoot = domain.split(".")[0] ?? domain;
  const pathBits = input.urlPath
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (!cleaned) {
    return true;
  }

  if (GENERIC_TOPIC_LABELS.has(cleaned)) {
    return true;
  }

  if (cleaned === domain || cleaned === domainRoot) {
    return true;
  }

  if (pathBits.includes(cleaned) && cleaned.split(/\s+/).length <= 2) {
    return true;
  }

  if (cleaned.length <= 3) {
    return true;
  }

  if (cleaned.split(/\s+/).length === 1 && /^[a-z0-9_-]+$/.test(cleaned)) {
    return true;
  }

  // Reject labels that look like social-media usernames or person name slugs
  if (looksLikeUsername(cleaned)) {
    return true;
  }

  // Reject if the label is just the domain name with a TLD
  if (/^[a-z0-9-]+\.(com|net|org|io|co|edu|gov)$/.test(cleaned)) {
    return true;
  }

  return false;
}

function collectCandidatePhrases(input: ClassifierInput) {
  const sources = uniqueStrings([
    ...((input.pageHints ?? []).map(cleanTopicText)),
    cleanTopicText(input.pageTitle),
    ...(input.pageContent ?? "")
      .split(/\n+/)
      .map(cleanTopicText)
      .filter(Boolean)
      .slice(0, 20)
  ]);

  return sources
    .map((value) =>
      value
        .replace(/\b(feed|overview|home|comments|post|profile)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .map(stripPlatformWords)
    .filter((value) => value.length >= 8)
    .filter((value) => !isLowQualityTopicLabel(value, input));
}

function deriveContextualTopicLabel(input: ClassifierInput, category: Category) {
  const candidates = collectCandidatePhrases(input);
  const phrase = candidates.find((value) => value.split(/\s+/).length >= 2);
  if (phrase) {
    return compressTopicLabel(phrase);
  }

  const fallback = compressTopicLabel(deriveTopicLabel(input, category));
  if (!isLowQualityTopicLabel(fallback, input)) {
    return fallback;
  }

  return titleCase(category);
}

function deriveTopicLabel(input: ClassifierInput, category: Category) {
  const cleanedTitle = cleanTopicText(input.pageTitle);
  if (cleanedTitle && cleanedTitle.length >= 8) {
    return cleanedTitle.slice(0, 96);
  }

  const pathParts = input.urlPath
    .split("/")
    .map(normalizePathSegment)
    .filter((part) => part && !/^\d+$/.test(part));

  if (pathParts.length > 0) {
    const meaningful = pathParts.filter((part) => part.length >= 4);
    if (meaningful.length >= 2) {
      return titleCase(meaningful.slice(-2).join(" ")).slice(0, 96);
    }
    return titleCase(pathParts[pathParts.length - 1]).slice(0, 96);
  }

  return titleCase(category);
}

function deriveTopicTags(input: ClassifierInput, category: Category, topicLabel: string) {
  const combined = `${input.pageTitle} ${input.urlPath} ${(input.pageHints ?? []).join(" ")}`
    .replace(/[|,:()[\]{}]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const stopwords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "your", "have", "after",
    "into", "onto", "about", "what", "when", "where", "which", "will", "they",
    "their", "there", "here", "been", "were", "open", "final", "highlights", "watch",
    "today", "news", "page", "home", "vs", "live", "more", "best"
  ]);

  const titleTags = combined.filter((token) => {
    const normalized = token.toLowerCase();
    return (
      normalized.length >= 3 &&
      !stopwords.has(normalized) &&
      /[a-zA-Z]/.test(normalized) &&
      !normalized.includes("/") &&
      !/\.(html?|php|aspx?)$/.test(normalized) &&
      normalized !== "fomo" &&
      normalized !== "pulse" &&
      normalized !== "mirror" &&
      normalized !== "reddit"
    );
  });

  const frequentCaps = combined.filter((token) => /^[A-Z]{2,6}$/.test(token));
  const cleanedPathTags = input.urlPath
    .split("/")
    .map(normalizePathSegment)
    .filter((part) => part.length >= 4);
  const unique = Array.from(
    new Set([
      topicLabel,
      ...frequentCaps,
      ...cleanedPathTags.map((token) => titleCase(token.toLowerCase())),
      ...titleTags.map((token) => titleCase(token.toLowerCase()))
    ])
  )
    .filter((tag) => {
      const normalized = tag.toLowerCase();
      return (
        tag.length >= 3 &&
        normalized !== "fomo" &&
        normalized !== "pulse" &&
        normalized !== "mirror" &&
        normalized !== "/pulse"
      );
    })
    .slice(0, 6);

  return unique.length > 0 ? unique : [topicLabel, titleCase(category)];
}

function getHaystack(input: ClassifierInput, source: WeightedRule["source"]) {
  if (source === "domain") {
    return normalizeText(input.domain);
  }
  if (source === "path") {
    return normalizeText(input.urlPath);
  }
  return normalizeText(
    `${input.pageTitle} ${(input.pageHints ?? []).join(" ")} ${input.pageContent ?? ""}`
  );
}

function compressTopicLabel(value: string) {
  const cleaned = cleanTopicText(value)
    .replace(/^[[(]?\d+[)\]]?\s*/g, "")
    .replace(/\b(including|everything you need to know|background check|immigration screening)\b.*$/i, "")
    .replace(/\b(feed|overview|profile|comments)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length > 7 ? words.slice(0, 7).join(" ") : cleaned;
}

function finalizeTopicTags(input: ClassifierInput, category: Category, topicLabel: string, tags?: string[]) {
  const sourceTags = tags && tags.length > 0 ? tags : deriveTopicTags(input, category, topicLabel);
  const cleaned = uniqueStrings(
    sourceTags
      .map(cleanTopicText)
      .map(stripPlatformWords)
      .filter((tag) => tag.length >= 3)
      .filter((tag) => !isLowQualityTopicLabel(tag, input))
      .filter((tag) => tag.toLowerCase() !== topicLabel.toLowerCase())
  ).slice(0, 5);

  return cleaned.length > 0 ? [topicLabel, ...cleaned].slice(0, 6) : [topicLabel];
}

function finalizeClassification(input: ClassifierInput, result: ClassificationResult): ClassificationResult {
  const category = result.category;
  const topicLabel = isLowQualityTopicLabel(result.topicLabel, input)
    ? deriveContextualTopicLabel(input, category)
    : compressTopicLabel(result.topicLabel);

  return {
    ...result,
    topicLabel,
    topicTags: finalizeTopicTags(input, category, topicLabel, result.topicTags)
  };
}

function scoreRuleMatches(input: ClassifierInput) {
  return CATEGORIES.map((category) => {
    const matches = categoryRules[category].filter((rule) =>
      getHaystack(input, rule.source).includes(normalizeText(rule.pattern))
    );
    const score = matches.reduce((sum, match) => sum + match.weight, 0);

    if (input.localCategory === category && typeof input.localConfidence === "number") {
      matches.push({
        pattern: String(input.localCategory),
        weight: input.localConfidence * 2.2,
        source: "title",
        note: "extension-side classifier agreed with this category"
      });
    }

    const totalScore = matches.reduce((sum, match) => sum + match.weight, 0);
    return { category, matches, score: totalScore };
  }).sort((a, b) => b.score - a.score);
}

function buildRuleResult(input: ClassifierInput): ClassificationResult {
  const ranked = scoreRuleMatches(input);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  if (!winner || winner.score <= 0) {
    return finalizeClassification(input, {
      category: "technology",
      topicLabel: deriveTopicLabel(input, "technology"),
      topicTags: deriveTopicTags(input, "technology", deriveTopicLabel(input, "technology")),
      confidence: 0.38,
      reasoning:
        "FOMO could not find a strong topic signature in the safe metadata, so it kept a low-confidence fallback category."
    });
  }

  const margin = Math.max(winner.score - (runnerUp?.score ?? 0), 0);
  const confidence = Math.min(0.97, 0.45 + winner.score / 12 + margin / 18);
  const evidence = winner.matches
    .slice(0, 3)
    .map((match) => match.note)
    .join(", ");
  const topicLabel = compressTopicLabel(
    input.localTopicLabel?.trim() || deriveTopicLabel(input, winner.category)
  );
  const topicTags =
    input.localTopicTags && input.localTopicTags.length > 0
      ? input.localTopicTags.slice(0, 6)
      : deriveTopicTags(input, winner.category, topicLabel);

  return finalizeClassification(input, {
    category: winner.category,
    topicLabel,
    topicTags,
    confidence,
    reasoning: `FOMO inferred ${winner.category} from combined evidence in the title, domain, and safe path metadata: ${evidence}.`
  });
}

function shouldUseAiClassifier() {
  return process.env.OPENAI_CLASSIFIER_ENABLED === "true";
}

export function isWeakTopicLabel(label: string, input: Pick<ClassifierInput, "domain" | "urlPath">): boolean {
  return isLowQualityTopicLabel(label, {
    domain: input.domain,
    pageTitle: "",
    urlPath: input.urlPath
  });
}

export async function classifySignal(input: ClassifierInput): Promise<ClassificationResult> {
  const ruleResult = buildRuleResult(input);

  if (!shouldUseAiClassifier()) {
    return ruleResult;
  }

  const aiResult = await classifyWithOptionalAi(input, ruleResult);
  return aiResult ?? ruleResult;
}

async function classifyWithOptionalAi(
  input: ClassifierInput,
  fallback: ClassificationResult
): Promise<ClassificationResult | null> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              `You classify privacy-safe browsing metadata into one broad topical category and produce a clean human-readable topic label.

GOAL: Infer what the user is actually paying attention to — the *subject matter*, not the page wrapper.

TOPIC LABEL RULES:
- Must be 2–7 words that read like a short summary phrase
- Must describe the subject matter, not the container (not the platform, not the user, not the page type)
- NEVER use: platform names (LinkedIn, Reddit, YouTube, Twitter), usernames, people's names, subreddit names, domain names, route fragments like "feed", "profile", "home", "jobs", "notifications"
- NEVER copy a raw page title or article headline verbatim — summarize it
- NEVER produce single-word labels
- If the page is a person's profile (LinkedIn, Twitter, etc.) with no clear topic content, use the *person's professional role or field* if inferable, otherwise use the category name

GOOD examples: "Goldman Sachs interview timeline", "AP Physics review materials", "Foldable iPhone rumors", "USC transfer success program", "UCLA–USC rivalry", "NBA trade deadline analysis"
BAD examples: "feed", "colemallinger", "linkedin.com", "r/college", "Jobs on LinkedIn", "Home", "Profile"

Never infer sensitive traits. Return strict JSON with category, topicLabel, topicTags, confidence, and reasoning.`
          },
          {
            role: "user",
            content: JSON.stringify({
              allowedCategories: CATEGORIES,
              safeMetadata: {
                domain: input.domain,
                pageTitle: input.pageTitle,
                urlPath: input.urlPath,
                pageHints: input.pageHints ?? [],
                pageContent: input.pageContent ?? ""
              },
              localHint:
                input.localCategory && typeof input.localConfidence === "number"
                  ? {
                      category: input.localCategory,
                      topicLabel: input.localTopicLabel ?? null,
                      topicTags: input.localTopicTags ?? [],
                      confidence: input.localConfidence,
                      reasoning: input.localReasoning ?? null
                    }
                  : null,
              fallbackRuleClassification: fallback
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fomo_classification",
            schema: {
              type: "object",
              properties: {
                category: { type: "string", enum: [...CATEGORIES] },
                topicLabel: { type: "string" },
                topicTags: {
                  type: "array",
                  items: { type: "string" }
                },
                confidence: { type: "number" },
                reasoning: { type: "string" }
              },
              required: ["category", "topicLabel", "topicTags", "confidence", "reasoning"],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const payload = data.choices?.[0]?.message?.content;
    if (!payload) {
      return null;
    }

    return finalizeClassification(input, JSON.parse(payload) as ClassificationResult);
  } catch {
    return null;
  }
}

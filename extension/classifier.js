const CATEGORY_RULES = {
  startups: [
    { pattern: "techcrunch.com", source: "domain", weight: 4.4, note: "startup-heavy publication" },
    { pattern: "ycombinator.com", source: "domain", weight: 4.8, note: "startup accelerator domain" },
    { pattern: "producthunt.com", source: "domain", weight: 4.5, note: "product discovery domain" },
    { pattern: "founder", source: "title", weight: 2.4, note: "founder language in title" },
    { pattern: "venture", source: "title", weight: 2.2, note: "venture language in title" },
    { pattern: "seed", source: "title", weight: 2.2, note: "funding-stage language in title" }
  ],
  finance: [
    { pattern: "bloomberg.com", source: "domain", weight: 4.8, note: "finance news domain" },
    { pattern: "wsj.com", source: "domain", weight: 4.2, note: "market-oriented publication" },
    { pattern: "coinbase.com", source: "domain", weight: 4.1, note: "financial platform domain" },
    { pattern: "market", source: "title", weight: 2.5, note: "market language in title" },
    { pattern: "earnings", source: "title", weight: 2.8, note: "earnings language in title" },
    { pattern: "stocks", source: "title", weight: 2.2, note: "stocks language in title" }
  ],
  healthcare: [
    { pattern: "nih.gov", source: "domain", weight: 4.8, note: "health research institution" },
    { pattern: "statnews.com", source: "domain", weight: 4.2, note: "healthcare publication" },
    { pattern: "clinical", source: "title", weight: 2.6, note: "clinical language in title" },
    { pattern: "biotech", source: "title", weight: 2.4, note: "biotech language in title" },
    { pattern: "health", source: "path", weight: 1.9, note: "health-oriented path signal" }
  ],
  sports: [
    { pattern: "espn.com", source: "domain", weight: 4.9, note: "sports media domain" },
    { pattern: "theathletic.com", source: "domain", weight: 4.5, note: "sports coverage domain" },
    { pattern: "nba", source: "title", weight: 2.6, note: "league mention in title" },
    { pattern: "nfl", source: "title", weight: 2.6, note: "league mention in title" },
    { pattern: "match", source: "title", weight: 2.1, note: "match language in title" },
    { pattern: "score", source: "path", weight: 2.0, note: "score-related path signal" }
  ],
  entertainment: [
    { pattern: "netflix.com", source: "domain", weight: 4.6, note: "streaming domain" },
    { pattern: "spotify.com", source: "domain", weight: 4.6, note: "music streaming domain" },
    { pattern: "variety.com", source: "domain", weight: 4.1, note: "entertainment publication" },
    { pattern: "movie", source: "title", weight: 2.3, note: "film language in title" },
    { pattern: "music", source: "title", weight: 2.3, note: "music language in title" },
    { pattern: "streaming", source: "title", weight: 2.0, note: "streaming language in title" }
  ],
  "school/campus": [
    { pattern: ".edu", source: "domain", weight: 4.7, note: "education domain" },
    { pattern: "canvas", source: "domain", weight: 3.8, note: "campus learning platform" },
    { pattern: "university", source: "title", weight: 2.4, note: "university language in title" },
    { pattern: "student", source: "title", weight: 2.2, note: "student language in title" },
    { pattern: "campus", source: "title", weight: 2.2, note: "campus language in title" }
  ],
  research: [
    { pattern: "arxiv.org", source: "domain", weight: 4.9, note: "research archive domain" },
    { pattern: "nature.com", source: "domain", weight: 4.5, note: "research journal domain" },
    { pattern: "scholar.google.com", source: "domain", weight: 4.4, note: "scholarly search domain" },
    { pattern: "paper", source: "title", weight: 2.6, note: "paper language in title" },
    { pattern: "research", source: "title", weight: 2.4, note: "research language in title" },
    { pattern: "/abs/", source: "path", weight: 2.0, note: "paper abstract path" }
  ],
  technology: [
    { pattern: "github.com", source: "domain", weight: 4.9, note: "developer collaboration domain" },
    { pattern: "vercel.com", source: "domain", weight: 4.3, note: "developer tooling domain" },
    { pattern: "developer", source: "title", weight: 2.3, note: "developer language in title" },
    { pattern: "software", source: "title", weight: 2.3, note: "software language in title" },
    { pattern: "programming", source: "title", weight: 2.3, note: "programming language in title" },
    { pattern: "typescript", source: "path", weight: 2.0, note: "technical path signal" }
  ],
  fashion: [
    { pattern: "vogue.com", source: "domain", weight: 4.7, note: "fashion publication domain" },
    { pattern: "ssense.com", source: "domain", weight: 4.4, note: "fashion retail domain" },
    { pattern: "fashion", source: "title", weight: 2.5, note: "fashion language in title" },
    { pattern: "runway", source: "title", weight: 2.2, note: "runway language in title" },
    { pattern: "style", source: "path", weight: 1.8, note: "style-oriented path signal" }
  ],
  food: [
    { pattern: "eater.com", source: "domain", weight: 4.4, note: "food publication domain" },
    { pattern: "allrecipes.com", source: "domain", weight: 4.5, note: "recipe domain" },
    { pattern: "recipe", source: "title", weight: 2.5, note: "recipe language in title" },
    { pattern: "restaurant", source: "title", weight: 2.4, note: "restaurant language in title" },
    { pattern: "dining", source: "title", weight: 2.0, note: "dining language in title" }
  ],
  events: [
    { pattern: "eventbrite.com", source: "domain", weight: 4.8, note: "ticketing domain" },
    { pattern: "meetup.com", source: "domain", weight: 4.8, note: "community events domain" },
    { pattern: "conference", source: "title", weight: 2.4, note: "conference language in title" },
    { pattern: "meetup", source: "title", weight: 2.4, note: "meetup language in title" },
    { pattern: "summit", source: "title", weight: 2.2, note: "summit language in title" }
  ]
};

const SENSITIVE_PATTERNS = [
  "bank",
  "chase.com",
  "paypal.com",
  "capitalone.com",
  "stripe.com",
  "mychart",
  "patient",
  "portal",
  "adult",
  "web.whatsapp.com",
  "messenger.com",
  "mail.google.com",
  "slack.com",
  "discord.com",
  "/messages",
  "/mail",
  "/inbox",
  "/checkout",
  "/billing",
  "/payment",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "snapchat.com",
  "pinterest.com",
  "threads.net",
  "docs.google.com",
  "drive.google.com",
  "calendar.google.com",
  "accounts.google.com"
];

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[_-]+/g, " ");
}

function toHourBucket(date) {
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function normalizeSignal(urlString, title) {
  const url = new URL(urlString);
  const videoId = url.searchParams.get("v");
  const urlPath = videoId ? `${url.pathname}?v=${videoId}` : url.pathname || "/";
  return {
    normalizedDomain: url.hostname.replace(/^www\./, ""),
    urlPath,
    pageTitle: title || "Untitled page",
    timestampBucket: toHourBucket(new Date())
  };
}

export function shouldBlock(urlString) {
  const url = new URL(urlString);
  const value = `${url.hostname} ${url.pathname}`.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => value.includes(pattern));
}

function getHaystack(signal, source) {
  if (source === "domain") {
    return normalizeText(signal.normalizedDomain);
  }
  if (source === "path") {
    return normalizeText(signal.urlPath);
  }
  return normalizeText(signal.pageTitle);
}

export function classifyPage(urlString, title) {
  const signal = normalizeSignal(urlString, title);
  const topicLabel = deriveTopicLabel(signal);
  const topicTags = deriveTopicTags(signal, topicLabel);

  const ranked = Object.entries(CATEGORY_RULES)
    .map(([category, rules]) => {
      const matches = rules.filter((rule) =>
        getHaystack(signal, rule.source).includes(normalizeText(rule.pattern))
      );
      const score = matches.reduce((sum, match) => sum + match.weight, 0);
      return { category, score, matches };
    })
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const runnerUp = ranked[1];

  if (!winner || winner.score <= 0) {
    return {
      category: "technology",
      topicLabel,
      topicTags,
      confidence: 0.38,
      reasoning: "No strong local topic signature was found in the safe metadata."
    };
  }

  const margin = Math.max(winner.score - (runnerUp?.score || 0), 0);
  const confidence = Math.min(0.97, 0.45 + winner.score / 12 + margin / 18);
  const evidence = winner.matches
    .slice(0, 3)
    .map((match) => match.note)
    .join(", ");

  return {
    category: winner.category,
    topicLabel,
    topicTags,
    confidence,
    reasoning: `Local classifier used combined title, domain, and path evidence: ${evidence}.`
  };
}

const PROFILE_DOMAINS = ["linkedin.com", "twitter.com", "x.com", "instagram.com", "facebook.com", "tiktok.com", "github.com"];
const GENERIC_PATH_SEGMENTS = new Set(["feed", "home", "profile", "jobs", "notifications", "messages", "inbox", "explore", "search", "trending", "following", "followers", "dashboard", "settings", "account"]);

function looksLikeUsername(value) {
  if (!value) return false;
  // Single word all-lowercase alphanumeric+underscore = username pattern
  if (/^[a-z][a-z0-9_]{2,}$/.test(value)) return true;
  // Two or three title-cased words with no common topic words = person name
  const words = value.split(/\s+/);
  if (words.length <= 3 && words.every((w) => /^[A-Z][a-z]+$/.test(w))) return true;
  return false;
}

function deriveTopicLabel(signal) {
  const rawTitle = String(signal.pageTitle || "");

  // Strip platform suffixes before using the title
  const title = rawTitle
    .replace(/\s*\|\s*(LinkedIn|Twitter|X|Instagram|Facebook|TikTok|Reddit|YouTube|Snapchat|Pinterest|Threads).*/gi, "")
    .replace(/\s*\|\s*.*/g, "")
    .replace(/\s+-\s+[^-]+$/g, "")
    .replace(/\s+on\s+(LinkedIn|Twitter|X|Instagram|Facebook|TikTok|Reddit|YouTube)\s*$/gi, "")
    .trim();

  // Reject titles that look like usernames or person names
  if (title.length >= 6 && !looksLikeUsername(title)) {
    return title.slice(0, 96);
  }

  const pathParts = signal.urlPath
    .split("/")
    .map((part) => decodeURIComponent(part))
    .map((part) => part.replace(/[-_]+/g, " ").trim())
    .filter((part) => part && !GENERIC_PATH_SEGMENTS.has(part.toLowerCase()) && !/^\d+$/.test(part));

  const meaningful = pathParts.filter((part) => part.length >= 4 && !looksLikeUsername(part));
  if (meaningful.length > 0) {
    return meaningful[meaningful.length - 1].slice(0, 96);
  }

  // Last resort: use domain root as a hint (will be filtered server-side anyway)
  return signal.normalizedDomain;
}

function deriveTopicTags(signal, topicLabel) {
  const stopwords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "your", "after", "when",
    "where", "which", "they", "their", "have", "more", "live", "best", "page", "home"
  ]);

  const parts = `${signal.pageTitle} ${signal.urlPath}`
    .replace(/[|,:()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const tags = Array.from(
    new Set(
      [
        topicLabel,
        ...parts.filter((part) => /^[A-Z]{2,6}$/.test(part)),
        ...parts
          .map((part) => part.replace(/[-_]+/g, " ").trim())
          .filter((part) => part.length >= 3 && !stopwords.has(part.toLowerCase()))
      ]
    )
  ).slice(0, 6);

  return tags.length > 0 ? tags : [topicLabel];
}

export function makeSignalKey(signal) {
  return `${signal.normalizedDomain}|${signal.urlPath}|${signal.timestampBucket}`;
}

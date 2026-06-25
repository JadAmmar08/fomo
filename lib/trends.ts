import type { BrowsingSignal, CommunityTrend } from "@/lib/types";

const HIGH_VALUE_CATEGORIES = new Set(["research", "startups", "finance", "healthcare"]);
const LOW_VALUE_PATTERNS = [
  "shopping", "shein", "revolve", "dress", "skirt", "sandal", "heel",
  "top rated", "sale", "new arrivals", "collection", "clothing",
  "accessories", "bodycon", "camisole", "outfit", "bikini", "swimwear",
  "dashboard", "guided notes", "worksheet", "exercises", "assignment",
  "course schedule", "enrollment", "student portal"
];

function calculateTrendScore(recent: number, previous: number, uniqueUsers: number, category: string, topicLabel: string) {
  const growth = previous === 0 ? recent : (recent - previous) / previous;
  const recencyBoost = recent > 0 ? Math.min(recent / 30, 1) : 0;
  const base = recent * 0.4 + growth * 20 + uniqueUsers * 5 + recencyBoost * 10;
  const multiUserBoost = uniqueUsers >= 3 ? 100 : uniqueUsers >= 2 ? 50 : 0;
  const categoryBoost = HIGH_VALUE_CATEGORIES.has(category) ? 30 : 0;
  const lower = topicLabel.toLowerCase();
  const lowValuePenalty = LOW_VALUE_PATTERNS.some(p => lower.includes(p)) ? 0.2 : 1;
  return (base + multiUserBoost + categoryBoost) * lowValuePenalty;
}

const JUNK_LABELS = new Set([
  "feed", "home", "homepage", "overview", "profile", "explore", "discover",
  "trending", "search", "notifications", "messages", "inbox", "settings",
  "stories", "reels", "following", "followers", "dashboard", "login",
  "signup", "sign up", "sign in", "new tab", "untitled page", "page title",
  "chatgpt", "chat gpt", "claude", "gemini"
]);

const JUNK_PATTERNS = [
  "login", "sign in", "sign up", "sign-in", "account", "password", "checkout",
  "cookie", "notification", "verification", "verify", "confirm",
  "streaming service", "profile selection", "graphing calculator",
  "office hours", "check-in", "check in",
  "course roster", "course files",
  "microsoft", "google docs", "google drive", "google calendar",
  "google redirect", "m365 copilot",
  "deployment", "deploy", "vercel", "resend", "supabase",
  "developer console", "developer account", "chrome web store",
  "extension", "plugin", "add-on",
  "shopping cart", "order confirmation",
  "unsubscribe", "email preferences", "privacy policy", "terms of service",
  "linkedin profile", "linkedin feed", "linkedin people search",
  "on linkedin", "profile on linkedin", "'s profile",
  "calendly", "scheduling a meeting", "booking a meeting",
  "amazon sign", "amazon checkout",
  "google redirect",
  "applicant portal", "admission status",
  "hotel search", "hotel deals", "travel booking",
  "wikipedia"
];

function isJunkLabel(label: string): boolean {
  const cleaned = label.trim().toLowerCase();
  if (!cleaned || cleaned.length < 4) return true;
  if (JUNK_LABELS.has(cleaned)) return true;
  if (JUNK_PATTERNS.some(p => cleaned.includes(p))) return true;
  if (/^page\s*title/i.test(cleaned)) return true;
  if (/^(stories|browsing)\s*[•·\-–]\s*/i.test(cleaned) && /instagram|facebook|snapchat|tiktok/i.test(cleaned)) return true;
  if (/^\/?stories\//i.test(cleaned)) return true;
  if (/^https?:\/\//i.test(cleaned)) return true;
  if (/\bfomo\b/i.test(cleaned)) return true;
  if (/^i'm\s+a\b/i.test(cleaned)) return true;
  if (/^browsing\s+(github|linkedin|twitter|reddit|youtube|facebook)/i.test(cleaned)) return true;
  // Person name patterns — "Name's Profile", "Name on LinkedIn", "CEO of X"
  if (/^[A-Z][a-z]+ [A-Z][a-z]+('s| on )/i.test(label.trim())) return true;
  if (/^(ceo|cfo|cto|coo|founder|director|vp|president)\s+(of|and|profile)/i.test(cleaned)) return true;
  if (/\bprofile\b/i.test(cleaned) && /\blinkedin\b/i.test(cleaned)) return true;
  return false;
}

function normalizeTopicKey(label: string): string {
  let key = label
    .trim()
    .toLowerCase()
    .replace(/[•·\-–|:.()\/,'"?!]/g, " ")
    .replace(/\bon youtube\b/g, " ")
    .replace(/\bon tiktok\b/g, " ")
    .replace(/\b(summer|fall|spring|winter)\s*\d{4}\b/g, " ")
    .replace(/\b(20\d{2})\b/g, " ")
    .replace(/\b(course|schedule|planner|catalog|materials?|section|lecture|slides?|announcements?|enrollment|session|highlights?|gameplay|quiz(?:zes)?|weekly|midterm|assignments?|syllabus|submission|dashboard|roster)\b/g, " ")
    .replace(/\b(uc berkeley|berkeley|ucla|usc|tulane|stanford)\b/g, "campus")
    .replace(/\b(the|a|an|and|or|of|in|on|at|to|for|with|vs|how|what|why|is|are|was|were|new|your|use|own|can|get|out|no)\b/g, " ")
    .replace(/\b(platform|tool|service|system|information|data|analytics|database)\b/g, " ")
    .replace(/\b(finding|using|becoming?|earning?|getting|escaping|browsing|managing)\b/g, " ")
    .replace(/\b(\w{4,})s\b/g, "$1")
    .replace(/[&$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Extract the core subject — first 2 meaningful words
  const words = key.split(" ").filter(w => w.length > 2);
  return words.slice(0, 2).sort().join(" ");
}

export function buildCommunityTrends(signals: BrowsingSignal[]): CommunityTrend[] {
  const cleaned = signals.filter((s) => !isJunkLabel(s.topicLabel));

  const now = Date.now();
  const past24h = cleaned.filter((signal) => now - new Date(signal.timestampBucket).getTime() <= 24 * 60 * 60 * 1000);
  const previous24h = cleaned.filter((signal) => {
    const age = now - new Date(signal.timestampBucket).getTime();
    return age > 24 * 60 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
  });

  const groups = new Map<string, BrowsingSignal[]>();
  for (const signal of past24h) {
    const key = normalizeTopicKey(signal.topicLabel);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(signal);
  }

  const previousGroups = new Map<string, BrowsingSignal[]>();
  for (const signal of previous24h) {
    const key = normalizeTopicKey(signal.topicLabel);
    if (!previousGroups.has(key)) previousGroups.set(key, []);
    previousGroups.get(key)!.push(signal);
  }

  return Array.from(groups.entries())
    .map(([key, recentSignals]) => {
      const previousSignals = previousGroups.get(key) ?? [];
      const representative = recentSignals[0];
      const topicLabel = representative.topicLabel;
      const recent = recentSignals.length;
      const previous = previousSignals.length;
      const uniqueUsers = new Set(recentSignals.map((signal) => signal.anonymousUserId)).size;
      const changePct = previous === 0 ? recent * 100 : ((recent - previous) / previous) * 100;
      const trendScore = calculateTrendScore(recent, previous, uniqueUsers, representative.category, topicLabel);
      const topicTags = Array.from(new Set(recentSignals.flatMap((signal) => signal.topicTags))).slice(0, 6);

      return {
        id: `trend_${topicLabel.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
        category: representative.category,
        topicLabel,
        topicTags,
        trendScore,
        anonymousSignals: recent,
        uniqueUsers,
        timeWindow: "Last 24 hours",
        changePct,
        explanation: `Interest in ${topicLabel} is rising because ${uniqueUsers} anonymous ${uniqueUsers === 1 ? "user" : "users"} generated ${recent} matching ${recent === 1 ? "signal" : "signals"} in the last 24 hours, ${previous === 0 ? "from a near-zero baseline" : `up ${Math.round(changePct)}% from the previous period`}.`
      };
    })
    .filter((trend) => trend.anonymousSignals > 0)
    .sort((a, b) => b.trendScore - a.trendScore);
}

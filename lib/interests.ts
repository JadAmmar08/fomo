import type {
  BrowsingSignal,
  FeedbackEntry,
  PrivacySettings,
  TrendState,
  UserInterest
} from "@/lib/types";

function hoursAgo(value: string) {
  return (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
}

function recencyWeight(timestampBucket: string) {
  const age = hoursAgo(timestampBucket);
  if (age <= 6) {
    return 1.25;
  }
  if (age <= 24) {
    return 1;
  }
  if (age <= 48) {
    return 0.72;
  }
  return 0.5;
}

function actionDelta(action: FeedbackEntry["action"]) {
  switch (action) {
    case "good-catch":
      return 0.08;
    case "more-like-this":
      return 0.16;
    case "not-relevant":
      return -0.1;
    case "this-is-wrong":
      return -0.22;
    case "hide-topic":
      return -0.34;
    default:
      return 0;
  }
}

function normalizeTopicKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function topicWordSet(label: string): Set<string> {
  const stopwords = new Set(["the", "a", "an", "of", "on", "in", "at", "to", "for", "and", "or", "is", "with"]);
  return new Set(
    normalizeTopicKey(label)
      .split(" ")
      .filter((w) => w.length >= 3 && !stopwords.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((w) => b.has(w)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function deduplicateTopics(grouped: Map<string, { signals: BrowsingSignal[]; label: string }>): Map<string, { signals: BrowsingSignal[]; label: string }> {
  const keys = Array.from(grouped.keys());
  const merged = new Set<string>();
  const result = new Map<string, { signals: BrowsingSignal[]; label: string }>();

  for (let i = 0; i < keys.length; i++) {
    if (merged.has(keys[i])) continue;
    const a = grouped.get(keys[i])!;
    const wordsA = topicWordSet(a.label);
    let mergedSignals = [...a.signals];
    let bestLabel = a.label;

    for (let j = i + 1; j < keys.length; j++) {
      if (merged.has(keys[j])) continue;
      const b = grouped.get(keys[j])!;
      const wordsB = topicWordSet(b.label);
      if (jaccardSimilarity(wordsA, wordsB) >= 0.45) {
        mergedSignals = [...mergedSignals, ...b.signals];
        // keep whichever label has more signals
        if (b.signals.length > a.signals.length) {
          bestLabel = b.label;
        }
        merged.add(keys[j]);
      }
    }

    result.set(keys[i], { signals: mergedSignals, label: bestLabel });
  }

  return result;
}

function makeInterestId(topicLabel: string) {
  return `interest_${normalizeTopicKey(topicLabel).replace(/\s+/g, "_")}`;
}

function computeChange(signals: BrowsingSignal[], feedbackScore: number): TrendState {
  const recent = signals
    .filter((signal) => hoursAgo(signal.timestampBucket) <= 24)
    .reduce((sum, signal) => sum + signal.confidence, 0);
  const previous = signals
    .filter((signal) => {
      const age = hoursAgo(signal.timestampBucket);
      return age > 24 && age <= 48;
    })
    .reduce((sum, signal) => sum + signal.confidence, 0);

  const delta = recent - previous + feedbackScore;
  if (delta > 0.32) {
    return "rising";
  }
  if (delta < -0.18) {
    return "falling";
  }
  return "stable";
}

export function buildUserInterests(
  anonymousUserId: string,
  signals: BrowsingSignal[],
  feedback: FeedbackEntry[],
  privacy: PrivacySettings
): UserInterest[] {
  const rawGrouped = new Map<string, { signals: BrowsingSignal[]; label: string }>();

  signals.forEach((signal) => {
    const key = normalizeTopicKey(signal.topicLabel || signal.pageTitle || signal.category);
    const current = rawGrouped.get(key) ?? { signals: [], label: signal.topicLabel || signal.pageTitle || signal.category };
    current.signals.push(signal);
    rawGrouped.set(key, current);
  });

  const grouped = deduplicateTopics(rawGrouped);

  return Array.from(grouped.entries())
    .map(([_topicKey, { signals: items, label: mergedLabel }]) => {
      const representative = items
        .slice()
        .sort((a, b) => new Date(b.timestampBucket).getTime() - new Date(a.timestampBucket).getTime())[0];
      const topicLabel = mergedLabel || (representative?.topicLabel ?? representative?.pageTitle ?? "Unknown topic");
      const interestId = makeInterestId(topicLabel);
      const topicFeedback = feedback.filter((entry) => entry.targetId === interestId);
      const feedbackScore = topicFeedback.reduce(
        (sum, entry) => sum + actionDelta(entry.action),
        0
      );
      const weightedAverage =
        items.reduce((sum, item) => sum + item.confidence * recencyWeight(item.timestampBucket), 0) /
        items.reduce((sum, item) => sum + recencyWeight(item.timestampBucket), 0);
      const confidence = Math.max(0.05, Math.min(0.99, weightedAverage + feedbackScore));
      const hidden = topicFeedback.some(
        (entry) => entry.action === "hide-topic" || entry.action === "this-is-wrong"
      );
      const evidence = items
        .slice()
        .sort((a, b) => new Date(b.timestampBucket).getTime() - new Date(a.timestampBucket).getTime())
        .slice(0, 2)
        .map((item) => `${item.topicLabel || item.pageTitle} on ${item.normalizedDomain}`);

      return {
        id: interestId,
        anonymousUserId,
        category: representative.category,
        topicLabel,
        topicTags: Array.from(new Set(items.flatMap((item) => item.topicTags))).slice(0, 8),
        confidence,
        change: computeChange(items, feedbackScore),
        reasoning:
          topicFeedback.length > 0
            ? `FOMO saw ${items.length} supporting signals, including ${evidence.join(" and ")}. Your feedback shifted this topic by ${feedbackScore >= 0 ? "+" : ""}${feedbackScore.toFixed(2)}.`
            : `FOMO saw ${items.length} supporting signals, including ${evidence.join(" and ")}.`,
        contributingSignals: items.map((item) => item.id),
        hidden,
        signalCount: items.length,
        feedbackScore,
        shareable: items.some((item) => privacy.shareableCategories.includes(item.category))
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

import type { BrowsingSignal, CommunityTrend } from "@/lib/types";

function calculateTrendScore(recent: number, previous: number, uniqueUsers: number) {
  const growth = previous === 0 ? recent : (recent - previous) / previous;
  const recencyBoost = recent > 0 ? Math.min(recent / 30, 1) : 0;
  return recent * 0.4 + growth * 20 + uniqueUsers * 0.5 + recencyBoost * 10;
}

export function buildCommunityTrends(signals: BrowsingSignal[]): CommunityTrend[] {
  const now = Date.now();
  const past24h = signals.filter((signal) => now - new Date(signal.timestampBucket).getTime() <= 24 * 60 * 60 * 1000);
  const previous24h = signals.filter((signal) => {
    const age = now - new Date(signal.timestampBucket).getTime();
    return age > 24 * 60 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
  });

  const topicLabels = Array.from(new Set(signals.map((signal) => signal.topicLabel.trim().toLowerCase())));

  return topicLabels
    .map((topicKey) => {
      const recentSignals = past24h.filter(
        (signal) => signal.topicLabel.trim().toLowerCase() === topicKey
      );
      const previousSignals = previous24h.filter(
        (signal) => signal.topicLabel.trim().toLowerCase() === topicKey
      );
      const representative = recentSignals[0] ?? previousSignals[0];
      if (!representative) {
        return null;
      }

      const topicLabel = representative.topicLabel;
      const recent = recentSignals.length;
      const previous = previousSignals.length;
      const uniqueUsers = new Set(recentSignals.map((signal) => signal.anonymousUserId)).size;
      const changePct = previous === 0 ? recent * 100 : ((recent - previous) / previous) * 100;
      const trendScore = calculateTrendScore(recent, previous, uniqueUsers);
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
        explanation: `Interest in ${topicLabel} is rising because ${uniqueUsers} anonymous users generated ${recent} matching signals in the last 24 hours, ${previous === 0 ? "from a near-zero baseline" : `up ${Math.round(changePct)}% from the previous period`}.`
      };
    })
    .filter((trend): trend is CommunityTrend => Boolean(trend && trend.anonymousSignals > 0))
    .sort((a, b) => b.trendScore - a.trendScore);
}

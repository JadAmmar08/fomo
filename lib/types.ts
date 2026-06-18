export const CATEGORIES = [
  "startups",
  "finance",
  "healthcare",
  "sports",
  "entertainment",
  "school/campus",
  "research",
  "technology",
  "fashion",
  "food",
  "events"
] as const;

export type Category = (typeof CATEGORIES)[number];

export type TrendState = "rising" | "falling" | "stable";

export type SignalSource = "extension" | "manual" | "seed";

export interface BrowsingSignal {
  id: string;
  anonymousUserId: string;
  normalizedDomain: string;
  urlPath: string;
  pageTitle: string;
  timestampBucket: string;
  category: Category;
  topicLabel: string;
  topicTags: string[];
  confidence: number;
  reasoning: string;
  source: SignalSource;
}

export interface UserInterest {
  id: string;
  anonymousUserId: string;
  category: Category;
  topicLabel: string;
  topicTags: string[];
  confidence: number;
  change: TrendState;
  reasoning: string;
  contributingSignals: string[];
  hidden: boolean;
  signalCount: number;
  feedbackScore: number;
  shareable: boolean;
}

export interface CommunityTrend {
  id: string;
  category: Category;
  topicLabel: string;
  topicTags: string[];
  trendScore: number;
  anonymousSignals: number;
  uniqueUsers: number;
  timeWindow: string;
  changePct: number;
  explanation: string;
}

export interface FeedbackEntry {
  id: string;
  anonymousUserId: string;
  targetType: "mirror" | "pulse";
  targetId: string;
  action: "good-catch" | "not-relevant" | "hide-topic" | "this-is-wrong" | "more-like-this";
  createdAt: string;
}

export interface BlockedDomain {
  id: string;
  anonymousUserId: string;
  domain: string;
  reason: string;
}

export interface PrivacySettings {
  anonymousUserId: string;
  trackingPaused: boolean;
  shareableCategories: Category[];
  localDataRetention: "keep" | "delete";
  accountDataRetention: "keep" | "delete";
}

export interface FomoUser {
  id: string;
  anonymousUserId: string;
  name: string;
  createdAt: string;
}

export interface CommunityPlacement {
  id: string;
  name: string;
  description: string;
  confidence: number;
  primaryCategories: Category[];
  signal: string;
}

export interface MirrorResponse {
  user: FomoUser;
  interests: UserInterest[];
  communities: CommunityPlacement[];
  recentSignals: BrowsingSignal[];
  privacy: PrivacySettings;
  storageMode: "database" | "demo";
  blockedDomains: string[];
  whatFomoKnows: {
    sharedAnonymously: Category[];
    neverShared: string[];
    collectedData: string[];
    hiddenTopics: Category[];
  };
}

export interface PulseResponse {
  trends: CommunityTrend[];
  generatedAt: string;
  storageMode: "database" | "demo";
}

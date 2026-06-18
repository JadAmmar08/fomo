import { buildUserInterests } from "@/lib/interests";
import { buildCommunityTrends } from "@/lib/trends";
import type {
  BlockedDomain,
  BrowsingSignal,
  CommunityTrend,
  FeedbackEntry,
  FomoUser,
  PrivacySettings
} from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { id, toHourBucket } from "@/lib/utils";

const DEMO_USER_ID = "anon_demo";

const users = new Map<string, FomoUser>();
const privacySettingsByUser = new Map<string, PrivacySettings>();
let signals: BrowsingSignal[] = [];
let feedback: FeedbackEntry[] = [];
let blockedDomains: BlockedDomain[] = [];

function defaultPrivacySettings(anonymousUserId: string): PrivacySettings {
  return {
    anonymousUserId,
    trackingPaused: false,
    shareableCategories: [...CATEGORIES],
    localDataRetention: "keep",
    accountDataRetention: "keep"
  };
}

function ensureDemoUser(anonymousUserId: string) {
  const existing = users.get(anonymousUserId);
  if (existing) {
    return existing;
  }

  const name = anonymousUserId === DEMO_USER_ID ? "Nisreen" : "FOMO user";
  const user: FomoUser = {
    id: id("user"),
    anonymousUserId,
    name,
    createdAt: new Date().toISOString()
  };

  users.set(anonymousUserId, user);
  if (!privacySettingsByUser.has(anonymousUserId)) {
    privacySettingsByUser.set(anonymousUserId, defaultPrivacySettings(anonymousUserId));
  }

  return user;
}

function seed() {
  if (signals.length > 0) {
    return;
  }

  ensureDemoUser(DEMO_USER_ID);
  signals = [];
}

seed();

export function getDemoState(anonymousUserId: string) {
  const user = ensureDemoUser(anonymousUserId);
  const privacySettings = privacySettingsByUser.get(anonymousUserId) ?? defaultPrivacySettings(anonymousUserId);
  const ownSignals = signals.filter((signal) => signal.anonymousUserId === anonymousUserId);
  const ownFeedback = feedback.filter((entry) => entry.anonymousUserId === anonymousUserId);
  const interests = buildUserInterests(anonymousUserId, ownSignals, ownFeedback, privacySettings);
  const visibleCategories = new Set(
    Array.from(privacySettingsByUser.values()).flatMap((settings) => settings.shareableCategories)
  );
  const sharedSignals = signals.filter((signal) => visibleCategories.has(signal.category));
  const trends = buildCommunityTrends(sharedSignals);

  return {
    user,
    signals,
    ownSignals,
    feedback: ownFeedback,
    blockedDomains: blockedDomains.filter((entry) => entry.anonymousUserId === anonymousUserId),
    privacySettings,
    interests,
    trends
  };
}

export function addSignal(signal: BrowsingSignal) {
  ensureDemoUser(signal.anonymousUserId);
  signals = [signal, ...signals];
}

export function addFeedback(entry: FeedbackEntry) {
  ensureDemoUser(entry.anonymousUserId);
  feedback = [entry, ...feedback];
}

export function updatePrivacySettings(anonymousUserId: string, update: Partial<PrivacySettings>) {
  const current = privacySettingsByUser.get(anonymousUserId) ?? defaultPrivacySettings(anonymousUserId);
  privacySettingsByUser.set(anonymousUserId, {
    ...current,
    ...update,
    anonymousUserId
  });
}

export function addBlockedDomain(anonymousUserId: string, domain: string, reason = "never-track") {
  const exists = blockedDomains.some(
    (entry) => entry.anonymousUserId === anonymousUserId && entry.domain === domain
  );

  if (exists) {
    return;
  }

  blockedDomains = [
    {
      id: id("blocked"),
      anonymousUserId,
      domain,
      reason
    },
    ...blockedDomains
  ];
}

export function deleteLocalData(anonymousUserId: string) {
  signals = signals.filter((signal) => signal.anonymousUserId !== anonymousUserId);
  feedback = feedback.filter((entry) => entry.anonymousUserId !== anonymousUserId);
}

export function deleteUserData(anonymousUserId: string) {
  signals = signals.filter((signal) => signal.anonymousUserId !== anonymousUserId);
  feedback = feedback.filter((entry) => entry.anonymousUserId !== anonymousUserId);
  blockedDomains = blockedDomains.filter((entry) => entry.anonymousUserId !== anonymousUserId);
  privacySettingsByUser.delete(anonymousUserId);
  users.delete(anonymousUserId);
}

export function getPulse(anonymousUserId?: string): CommunityTrend[] {
  const userId = anonymousUserId ?? DEMO_USER_ID;
  ensureDemoUser(userId);
  const settings = privacySettingsByUser.get(userId) ?? defaultPrivacySettings(userId);
  const ownSignals = signals.filter(
    (signal) =>
      signal.anonymousUserId === userId &&
      settings.shareableCategories.includes(signal.category)
  );

  return buildCommunityTrends(ownSignals);
}

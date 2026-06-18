import { classifySignal, isWeakTopicLabel } from "@/lib/classifier";
import { CATEGORIES } from "@/lib/types";
import {
  deleteLocalData,
  deleteUserData,
  getDemoState,
  getPulse,
  addBlockedDomain,
  addFeedback,
  addSignal,
  updatePrivacySettings
} from "@/lib/demo-data";
import {
  deleteDatabaseData,
  getDatabaseMirrorState,
  getDatabasePulseState,
  insertDatabaseFeedback,
  insertDatabaseSignal,
  isDatabaseMode,
  materializeDatabaseTrends,
  upsertDatabasePrivacySettings
} from "@/lib/database-store";
import { getServerAnonymousUserId } from "@/lib/session";
import { sanitizePath } from "@/lib/privacy";
import type {
  BrowsingSignal,
  Category,
  FeedbackEntry,
  MirrorResponse,
  PrivacySettings,
  PulseResponse
} from "@/lib/types";
import { id, toHourBucket } from "@/lib/utils";

async function resolveAnonymousUserId(anonymousUserId?: string) {
  return anonymousUserId ?? (await getServerAnonymousUserId());
}

function baseWhatFomoKnows(mirror: {
  privacy: PrivacySettings;
  interests: MirrorResponse["interests"];
}) {
  return {
    sharedAnonymously: mirror.privacy.shareableCategories,
    neverShared: [
      "Passwords",
      "Form inputs",
      "Cookies",
      "Screenshots",
      "Sensitive banking, health, adult, or messaging pages"
    ],
    collectedData: [
      "Page title",
      "Normalized domain",
      "URL path without query parameters",
      "Timestamp rounded to the hour",
      "Broad category and confidence"
    ],
    hiddenTopics: mirror.interests.filter((interest) => interest.hidden).map((interest) => interest.category)
  };
}

export async function getMirror(anonymousUserId?: string): Promise<MirrorResponse> {
  const resolvedAnonymousUserId = await resolveAnonymousUserId(anonymousUserId);

  if (isDatabaseMode()) {
    const state = await getDatabaseMirrorState(resolvedAnonymousUserId);
    if (state) {
      const mirror = {
      user: state.user,
        interests: state.interests.filter((interest) => !interest.hidden),
        recentSignals: state.ownSignals.slice(0, 10),
        privacy: state.privacySettings
      };

      return {
        ...mirror,
        storageMode: "database",
        blockedDomains: state.blockedDomains.map((entry) => entry.domain),
        whatFomoKnows: baseWhatFomoKnows({
          ...mirror,
          interests: state.interests
        })
      };
    }
  }

  const state = getDemoState(resolvedAnonymousUserId);
  const mirror = {
    user: state.user,
    interests: state.interests.filter((interest) => !interest.hidden),
    recentSignals: state.ownSignals.slice(0, 10),
    privacy: state.privacySettings
  };

  return {
    ...mirror,
    storageMode: "demo",
    blockedDomains: state.blockedDomains.map((entry) => entry.domain),
    whatFomoKnows: baseWhatFomoKnows({
      ...mirror,
      interests: state.interests
    })
  };
}

export async function getPulseResponse(): Promise<PulseResponse> {
  const resolvedAnonymousUserId = await resolveAnonymousUserId();

  if (isDatabaseMode()) {
    const trends = await getDatabasePulseState(resolvedAnonymousUserId);
    if (trends) {
      return {
        trends,
        generatedAt: new Date().toISOString(),
        storageMode: "database"
      };
    }
  }

  return {
    trends: getPulse(resolvedAnonymousUserId),
    generatedAt: new Date().toISOString(),
    storageMode: "demo"
  };
}

export async function createSignal(input: {
  anonymousUserId?: string;
  normalizedDomain: string;
  urlPath: string;
  pageTitle: string;
  source?: BrowsingSignal["source"];
  localCategory?: string;
  localConfidence?: number;
  localReasoning?: string;
  localTopicLabel?: string;
  localTopicTags?: string[];
  pageHints?: string[];
  pageContent?: string;
  preclassified?: boolean;
}) {
  const anonymousUserId = await resolveAnonymousUserId(input.anonymousUserId);
  const canUsePreclassified =
    input.preclassified === true &&
    typeof input.localCategory === "string" &&
    CATEGORIES.includes(input.localCategory as Category) &&
    typeof input.localTopicLabel === "string" &&
    !isWeakTopicLabel(input.localTopicLabel, { domain: input.normalizedDomain, urlPath: input.urlPath }) &&
    Array.isArray(input.localTopicTags) &&
    typeof input.localConfidence === "number" &&
    typeof input.localReasoning === "string";

  const classification = canUsePreclassified
    ? {
        category: input.localCategory as Category,
        topicLabel: input.localTopicLabel!,
        topicTags: input.localTopicTags!,
        confidence: input.localConfidence!,
        reasoning: input.localReasoning!
      }
    : await classifySignal({
        domain: input.normalizedDomain,
        pageTitle: input.pageTitle,
        urlPath: input.urlPath,
        localCategory: input.localCategory,
        localConfidence: input.localConfidence,
        localReasoning: input.localReasoning,
        localTopicLabel: input.localTopicLabel,
        localTopicTags: input.localTopicTags,
        pageHints: input.pageHints,
        pageContent: input.pageContent
      });

  const signal: BrowsingSignal = {
    id: id("signal"),
    anonymousUserId,
    normalizedDomain: input.normalizedDomain,
    urlPath: sanitizePath(input.urlPath),
    pageTitle: input.pageTitle,
    timestampBucket: toHourBucket(new Date()),
    category: classification.category,
    topicLabel: classification.topicLabel,
    topicTags: classification.topicTags,
    confidence: classification.confidence,
    reasoning: classification.reasoning,
    source: input.source ?? "extension"
  };

  if (isDatabaseMode()) {
    await insertDatabaseSignal(signal);
  } else {
    addSignal(signal);
  }

  return signal;
}

export async function recordFeedback(
  input: Omit<FeedbackEntry, "id" | "createdAt" | "anonymousUserId"> & {
    anonymousUserId?: string;
  }
) {
  const entry: FeedbackEntry = {
    id: id("feedback"),
    createdAt: new Date().toISOString(),
    anonymousUserId: await resolveAnonymousUserId(input.anonymousUserId),
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action
  };

  if (isDatabaseMode()) {
    await insertDatabaseFeedback(entry);
  } else {
    addFeedback(entry);
  }

  return entry;
}

export async function savePrivacySettings(
  input: Partial<PrivacySettings> & { blockDomain?: string; anonymousUserId?: string }
) {
  const anonymousUserId = await resolveAnonymousUserId(input.anonymousUserId);

  if (isDatabaseMode()) {
    await upsertDatabasePrivacySettings(anonymousUserId, input);
    return getMirror(anonymousUserId);
  }

  if (input.blockDomain) {
    addBlockedDomain(anonymousUserId, input.blockDomain);
  }

  const { blockDomain: _blockDomain, anonymousUserId: _anonymousUserId, ...settingsUpdate } = input;
  updatePrivacySettings(anonymousUserId, settingsUpdate);
  return getMirror(anonymousUserId);
}

export async function destroyUserData(scope: "local" | "account", anonymousUserId?: string) {
  const resolvedAnonymousUserId = await resolveAnonymousUserId(anonymousUserId);

  if (isDatabaseMode()) {
    return (
      (await deleteDatabaseData(resolvedAnonymousUserId, scope)) ?? {
        ok: true,
        scope
      }
    );
  }

  if (scope === "local") {
    deleteLocalData(resolvedAnonymousUserId);
  } else {
    deleteUserData(resolvedAnonymousUserId);
  }

  return { ok: true, scope };
}

export async function recomputeTrends() {
  if (isDatabaseMode()) {
    const trends = await materializeDatabaseTrends();
    return trends ?? [];
  }

  return getPulse();
}

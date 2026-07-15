import { NextRequest, NextResponse } from "next/server";
import { classifySignal } from "@/lib/classifier";
import { isSensitiveMetadata, sanitizePath } from "@/lib/privacy";
import { getCachedClassification, isDatabaseMode, isInAnyRoom } from "@/lib/database-store";
import { getRequestAnonymousUserId } from "@/lib/session";
import { logApiCall } from "@/lib/cost-log";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const normalizedDomain = String(body.normalizedDomain ?? "");
  const urlPath = String(body.urlPath ?? "/");

  if (!normalizedDomain) {
    return NextResponse.json({ error: "normalizedDomain is required" }, { status: 400 });
  }

  if (isSensitiveMetadata(normalizedDomain, urlPath)) {
    return NextResponse.json(
      { error: "Sensitive pages are excluded from collection." },
      { status: 403 }
    );
  }

  const rawTitle = String(body.rawTitle ?? body.pageTitle ?? "Untitled page");

  if (isDatabaseMode()) {
    const cached = await getCachedClassification(normalizedDomain, urlPath);
    if (cached) {
      logApiCall({ callType: "classification", model: "cache", inputTokens: 0, outputTokens: 0, cacheHit: true });
      return NextResponse.json(cached);
    }

    const anonymousUserId = getRequestAnonymousUserId(
      request,
      typeof body.anonymousUserId === "string" ? body.anonymousUserId : undefined
    );
    if (!(await isInAnyRoom(anonymousUserId))) {
      return NextResponse.json({
        category: body.localCategory ?? "technology",
        topicLabel: body.localTopicLabel ?? rawTitle,
        topicTags: Array.isArray(body.localTopicTags) ? body.localTopicTags : [],
        confidence: typeof body.localConfidence === "number" ? body.localConfidence : 0,
        reasoning: body.localReasoning ?? "Skipped paid classification: user not in an active room"
      });
    }
  }

  const classification = await classifySignal({
    domain: normalizedDomain,
    pageTitle: rawTitle,
    urlPath,
    localCategory: typeof body.localCategory === "string" ? body.localCategory : undefined,
    localConfidence:
      typeof body.localConfidence === "number" ? body.localConfidence : undefined,
    localReasoning: typeof body.localReasoning === "string" ? body.localReasoning : undefined,
    localTopicLabel:
      typeof body.localTopicLabel === "string" ? body.localTopicLabel : undefined,
    localTopicTags: Array.isArray(body.localTopicTags) ? body.localTopicTags : undefined,
    pageHints: Array.isArray(body.pageHints) ? body.pageHints : undefined,
    pageContent: typeof body.pageContent === "string" ? body.pageContent : undefined
  });

  // For video sites, if Claude echoed the title back, append platform at minimum
  const videoSites: Record<string, string> = {
    "youtube.com": "on YouTube", "youtu.be": "on YouTube",
    "tiktok.com": "on TikTok", "twitch.tv": "on Twitch"
  };
  const platformSuffix = videoSites[normalizedDomain];
  if (platformSuffix && classification.topicLabel) {
    const label = classification.topicLabel.toLowerCase();
    const alreadyHasSuffix = label.includes("on youtube") || label.includes("on tiktok") || label.includes("on twitch");
    if (!alreadyHasSuffix) {
      classification.topicLabel = classification.topicLabel + " " + platformSuffix;
    }
  }

  return NextResponse.json(classification);
}

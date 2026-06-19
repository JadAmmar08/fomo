import { NextRequest, NextResponse } from "next/server";
import { classifySignal } from "@/lib/classifier";
import { isSensitiveMetadata } from "@/lib/privacy";

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
    const title = rawTitle.toLowerCase().slice(0, 60);
    const overlap = title.split(" ").filter(w => w.length > 3 && label.includes(w)).length;
    const titleWords = title.split(" ").filter(w => w.length > 3).length;
    if (titleWords > 0 && overlap / titleWords > 0.5) {
      // Label is too close to the title — trim and append platform
      const trimmed = classification.topicLabel.replace(/\s*[\|–-].*$/, "").trim();
      const short = trimmed.split(" ").slice(0, 5).join(" ");
      classification.topicLabel = short + " " + platformSuffix;
    } else if (!label.includes("on youtube") && !label.includes("on tiktok") && !label.includes("on twitch")) {
      classification.topicLabel = classification.topicLabel + " " + platformSuffix;
    }
  }

  return NextResponse.json(classification);
}

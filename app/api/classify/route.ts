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

  const classification = await classifySignal({
    domain: normalizedDomain,
    pageTitle: String(body.rawTitle ?? body.pageTitle ?? "Untitled page"),
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

  return NextResponse.json(classification);
}

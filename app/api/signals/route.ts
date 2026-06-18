import { NextRequest, NextResponse } from "next/server";
import { createSignal } from "@/lib/store";
import { isSensitiveMetadata } from "@/lib/privacy";
import { attachAnonymousCookie, getRequestAnonymousUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const domain = String(body.normalizedDomain ?? "");
  const anonymousUserId = getRequestAnonymousUserId(
    request,
    typeof body.anonymousUserId === "string" ? body.anonymousUserId : undefined
  );

  if (!domain) {
    return NextResponse.json({ error: "normalizedDomain is required" }, { status: 400 });
  }

  if (isSensitiveMetadata(domain, String(body.urlPath ?? "/"))) {
    return NextResponse.json(
      { error: "Sensitive pages are excluded from collection." },
      { status: 403 }
    );
  }

  const signal = await createSignal({
    anonymousUserId,
    normalizedDomain: domain,
    urlPath: String(body.urlPath ?? "/"),
    pageTitle: String(body.pageTitle ?? "Untitled page"),
    source: body.source,
    localCategory: body.localCategory,
    localConfidence:
      typeof body.localConfidence === "number" ? body.localConfidence : undefined,
    localReasoning: body.localReasoning,
    localTopicLabel: body.localTopicLabel,
    localTopicTags: Array.isArray(body.localTopicTags) ? body.localTopicTags : undefined,
    pageHints: Array.isArray(body.pageHints) ? body.pageHints : undefined,
    pageContent: typeof body.pageContent === "string" ? body.pageContent : undefined,
    preclassified: body.preclassified === true
  });

  return attachAnonymousCookie(NextResponse.json(signal, { status: 201 }), anonymousUserId);
}

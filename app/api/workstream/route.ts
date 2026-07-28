import { NextRequest, NextResponse } from "next/server";
import { getCombinedWorkstream } from "@/lib/workstream";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  try {
    const { items, summary, pulseConnections, soloHighlights } = await getCombinedWorkstream(anonymousUserId, roomId);
    return NextResponse.json({
      summary,
      // Slack's item is a synthetic stand-in used only to feed the summary — it's
      // not a real file, so it doesn't belong in a feed of actual linked items.
      items: items
        .filter((i) => i.source !== "slack")
        .map((i) => ({ source: i.source, label: i.label, name: i.name, modifiedTime: i.modifiedTime, link: i.link })),
      pulseConnections,
      soloHighlights
    });
  } catch (err) {
    console.error("[workstream] failed:", err);
    return NextResponse.json({ error: "Could not read workstream activity" }, { status: 500 });
  }
}

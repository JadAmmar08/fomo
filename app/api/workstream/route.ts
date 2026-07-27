import { NextRequest, NextResponse } from "next/server";
import { getCombinedWorkstream } from "@/lib/workstream";
import { getRequestAnonymousUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const anonymousUserId = getRequestAnonymousUserId(req);
  const roomId = req.nextUrl.searchParams.get("roomId") ?? "";

  try {
    const { items, summary } = await getCombinedWorkstream(anonymousUserId, roomId);
    return NextResponse.json({
      summary,
      items: items.map((i) => ({ source: i.source, label: i.label, name: i.name, modifiedTime: i.modifiedTime, link: i.link }))
    });
  } catch (err) {
    console.error("[workstream] failed:", err);
    return NextResponse.json({ error: "Could not read workstream activity" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { handleFileChangeNotification } from "@/lib/file-watch";

// Graph validates a new subscription by POSTing here with a validationToken query
// param that must be echoed straight back as plain text within 10 seconds — this has
// to be handled before anything else, real notifications never carry that param.
export async function POST(req: NextRequest) {
  const validationToken = req.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const secret = process.env.FILE_WATCH_WEBHOOK_SECRET;
  const body = await req.json().catch(() => null);
  const notifications = body?.value as Array<{ subscriptionId: string; clientState?: string }> | undefined;
  if (!secret || !notifications) return NextResponse.json({ ok: true });

  for (const n of notifications) {
    // clientState is the shared secret we set at subscription creation (lib/file-watch.ts
    // registerFileWatch) — Graph echoes it back on every notification unmodified.
    if (n.clientState !== secret) continue;
    await handleFileChangeNotification("microsoft", n.subscriptionId).catch((err) => console.error("[webhook microsoft] failed:", err));
  }

  return NextResponse.json({ ok: true });
}

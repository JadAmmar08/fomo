import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Proxy to the cron endpoint with proper auth
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.DIGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL("/api/digest/cron", req.url);
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
  });

  const data = await response.json();
  return NextResponse.json(data);
}

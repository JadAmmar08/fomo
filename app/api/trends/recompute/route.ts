import { NextResponse } from "next/server";
import { recomputeTrends } from "@/lib/store";

export async function POST() {
  const trends = await recomputeTrends();
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    trends
  });
}

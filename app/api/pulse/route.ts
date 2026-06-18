import { NextResponse } from "next/server";
import { getPulseResponse } from "@/lib/store";

export async function GET() {
  const pulse = await getPulseResponse();
  return NextResponse.json(pulse);
}

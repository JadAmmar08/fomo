import { NextResponse } from "next/server";
import { getMirror } from "@/lib/store";

export async function GET() {
  const mirror = await getMirror();
  return NextResponse.json(mirror);
}

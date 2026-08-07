import { NextRequest, NextResponse } from "next/server";
import { getTeamMemory, getTeamMemoryMessages, setTeamMemory } from "@/lib/team-memory";

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("room");
  if (!roomId) return NextResponse.json({ error: "room required" }, { status: 400 });
  const [memory, messages] = await Promise.all([getTeamMemory(roomId), getTeamMemoryMessages(roomId)]);
  return NextResponse.json({ memory, messages });
}

export async function PUT(req: NextRequest) {
  const { roomId, content } = await req.json().catch(() => ({}));
  if (!roomId || typeof content !== "string") {
    return NextResponse.json({ error: "roomId and content required" }, { status: 400 });
  }
  const memory = await setTeamMemory(roomId, content);
  return NextResponse.json({ memory });
}

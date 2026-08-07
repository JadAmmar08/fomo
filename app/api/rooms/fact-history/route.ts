import { NextRequest, NextResponse } from "next/server";
import { listTrackedEntities, getEntityFactHistory } from "@/lib/fact-history";

// GET ?room=slug -> list of tracked entities (the directory listing)
// GET ?room=slug&entity=Acme+Corp -> full history for one entity (the file's contents)
export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get("room");
  const entity = req.nextUrl.searchParams.get("entity");
  if (!roomId) return NextResponse.json({ error: "room required" }, { status: 400 });

  if (entity) {
    const history = await getEntityFactHistory(roomId, entity);
    return NextResponse.json({ entity, history });
  }
  const entities = await listTrackedEntities(roomId);
  return NextResponse.json({ entities });
}

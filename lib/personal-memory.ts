import { getPool } from "@/lib/postgres";
import { logApiCall } from "@/lib/cost-log";

export interface PersonalMemory {
  content: string;
  updatedAt: string;
}

export interface PersonalMemoryMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// Fetches (or lazily creates) the caller's own memory row. Never takes a
// "whose memory" parameter beyond anonymousUserId+roomId — there is no route
// or function in this file that can return someone else's row, by design.
export async function getPersonalMemory(anonymousUserId: string, roomId: string): Promise<PersonalMemory> {
  const pool = getPool();
  if (!pool) return { content: "", updatedAt: new Date().toISOString() };

  const res = await pool.query<{ content: string; updated_at: string }>(
    `select content, updated_at from personal_memory where anonymous_user_id = $1 and room_id = $2`,
    [anonymousUserId, roomId]
  );
  if (res.rows[0]) {
    return { content: res.rows[0].content, updatedAt: res.rows[0].updated_at };
  }
  return { content: "", updatedAt: new Date().toISOString() };
}

export async function getPersonalMemoryMessages(anonymousUserId: string, roomId: string): Promise<PersonalMemoryMessage[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<{ role: "user" | "assistant"; content: string; created_at: string }>(
    `select role, content, created_at from personal_memory_messages
     where anonymous_user_id = $1 and room_id = $2
     order by created_at asc
     limit 200`,
    [anonymousUserId, roomId]
  );
  return res.rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
}

// A conversational turn: the person's message can either just be a question
// ("what do you think I've been doing lately") or a correction ("no, I always
// double-check numbers before pushing"). The model decides whether the
// exchange should actually change what's remembered — most messages won't,
// and forcing an update on every turn would make the memory drift on chit-chat
// rather than only updating on a genuine correction or new observation.
export async function sendPersonalMemoryChat(
  anonymousUserId: string,
  roomId: string,
  userMessage: string
): Promise<{ reply: string; memory: PersonalMemory }> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");

  const [current, history] = await Promise.all([
    getPersonalMemory(anonymousUserId, roomId),
    getPersonalMemoryMessages(anonymousUserId, roomId)
  ]);

  await pool.query(
    `insert into personal_memory_messages (anonymous_user_id, room_id, role, content) values ($1, $2, 'user', $3)`,
    [anonymousUserId, roomId, userMessage]
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { reply: "Chat isn't configured right now.", memory: current };
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const transcript = history.slice(-20).map((m) => `${m.role}: ${m.content}`).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    tools: [
      {
        name: "memory_turn",
        description: "Respond to the person and optionally update what's remembered about how they work.",
        input_schema: {
          type: "object" as const,
          properties: {
            reply: { type: "string", description: "Conversational reply to the person, speaking directly to them." },
            updatedMemory: {
              type: "string",
              description: "The full replacement memory text if this message genuinely adds or corrects something real. Empty string if nothing should change."
            }
          },
          required: ["reply", "updatedMemory"],
          additionalProperties: false
        }
      }
    ],
    tool_choice: { type: "tool", name: "memory_turn" },
    system: `This is a private, self-facing memory file: what FOMO currently understands about how this one person works within their project. Only this person will ever read it, it is never shown to teammates or managers. Speak directly to them, second person ("you tend to..."), never third person or evaluative language ("this user..."). Never invent claims, only reflect what's actually been observed or what the person tells you directly in this conversation. The current memory content is:\n\n${current.content || "(nothing recorded yet)"}\n\nRecent conversation:\n${transcript}\n\nIf their new message is just a question or small talk, leave updatedMemory as an empty string. Only produce updatedMemory when they've told you something genuinely worth remembering about how they work, or corrected something already recorded. NO EM-DASHES.`,
    messages: [{ role: "user", content: userMessage }]
  });

  logApiCall({
    callType: "personal_memory_chat",
    model: "claude-sonnet-4-6",
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    roomId,
    anonymousUserId
  });

  const block = message.content.find((b) => b.type === "tool_use");
  const out = block && block.type === "tool_use" ? (block.input as { reply?: string; updatedMemory?: string }) : {};
  const reply = out.reply || "Got it.";

  await pool.query(
    `insert into personal_memory_messages (anonymous_user_id, room_id, role, content) values ($1, $2, 'assistant', $3)`,
    [anonymousUserId, roomId, reply]
  );

  let memory = current;
  if (out.updatedMemory && out.updatedMemory.trim()) {
    await pool.query(
      `insert into personal_memory (anonymous_user_id, room_id, content, updated_at)
       values ($1, $2, $3, now())
       on conflict (anonymous_user_id, room_id) do update set content = excluded.content, updated_at = now()`,
      [anonymousUserId, roomId, out.updatedMemory.trim()]
    );
    memory = { content: out.updatedMemory.trim(), updatedAt: new Date().toISOString() };
  }

  return { reply, memory };
}

// Direct edit, no AI involved — the person should always be able to just
// rewrite their own memory outright, not only through conversation.
export async function setPersonalMemory(anonymousUserId: string, roomId: string, content: string): Promise<PersonalMemory> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `insert into personal_memory (anonymous_user_id, room_id, content, updated_at)
     values ($1, $2, $3, now())
     on conflict (anonymous_user_id, room_id) do update set content = excluded.content, updated_at = now()`,
    [anonymousUserId, roomId, content]
  );
  return { content, updatedAt: new Date().toISOString() };
}

// KT handoff: takes a frozen snapshot of the sharer's CURRENT memory content,
// not a live link — the recipient sees what was true at share time. The
// sharer must explicitly re-share to update what the recipient has; nothing
// propagates automatically.
export async function sharePersonalMemory(roomId: string, sharedBy: string, sharedWith: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const current = await getPersonalMemory(sharedBy, roomId);
  await pool.query(
    `insert into personal_memory_shares (room_id, shared_by, shared_with, snapshot_content) values ($1, $2, $3, $4)`,
    [roomId, sharedBy, sharedWith, current.content]
  );
}

export interface PersonalMemoryShare {
  sharedBy: string;
  snapshotContent: string;
  sharedAt: string;
}

// Only ever returns shares where sharedWith = the caller's own id — this is
// the one legitimate way another person's memory content becomes visible to
// you, and only because they explicitly chose to hand it to you.
export async function getSharedMemories(anonymousUserId: string, roomId: string): Promise<PersonalMemoryShare[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<{ shared_by: string; snapshot_content: string; shared_at: string }>(
    `select shared_by, snapshot_content, shared_at from personal_memory_shares
     where shared_with = $1 and room_id = $2
     order by shared_at desc`,
    [anonymousUserId, roomId]
  );
  return res.rows.map((r) => ({ sharedBy: r.shared_by, snapshotContent: r.snapshot_content, sharedAt: r.shared_at }));
}

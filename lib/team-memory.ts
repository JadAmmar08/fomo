import { getPool } from "@/lib/postgres";
import { logApiCall } from "@/lib/cost-log";

export interface TeamMemory {
  content: string;
  updatedAt: string;
}

export interface TeamMemoryMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// The shared counterpart to personal-memory.ts's per-person file — one record
// per room, visible and editable by anyone in it. No privacy boundary to
// enforce here (unlike personal memory), since this is explicitly team-shared
// by design.
export async function getTeamMemory(roomId: string): Promise<TeamMemory> {
  const pool = getPool();
  if (!pool) return { content: "", updatedAt: new Date().toISOString() };
  const res = await pool.query<{ content: string; updated_at: string }>(
    `select content, updated_at from team_memory where room_id = $1`,
    [roomId]
  );
  if (res.rows[0]) return { content: res.rows[0].content, updatedAt: res.rows[0].updated_at };
  return { content: "", updatedAt: new Date().toISOString() };
}

export async function getTeamMemoryMessages(roomId: string): Promise<TeamMemoryMessage[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<{ role: "user" | "assistant"; content: string; created_at: string }>(
    `select role, content, created_at from team_memory_messages where room_id = $1 order by created_at asc limit 200`,
    [roomId]
  );
  return res.rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
}

export async function sendTeamMemoryChat(
  anonymousUserId: string,
  roomId: string,
  userMessage: string
): Promise<{ reply: string; memory: TeamMemory }> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");

  const [current, history] = await Promise.all([getTeamMemory(roomId), getTeamMemoryMessages(roomId)]);

  await pool.query(
    `insert into team_memory_messages (room_id, anonymous_user_id, role, content) values ($1, $2, 'user', $3)`,
    [roomId, anonymousUserId, userMessage]
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "Chat isn't configured right now.", memory: current };

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const transcript = history.slice(-20).map((m) => `${m.role}: ${m.content}`).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    tools: [
      {
        name: "team_memory_turn",
        description: "Respond to a team member and optionally update what's remembered about this team/project.",
        input_schema: {
          type: "object" as const,
          properties: {
            reply: { type: "string", description: "Conversational reply, speaking to the team member." },
            updatedMemory: {
              type: "string",
              description: "The full replacement memory text if this message genuinely adds or corrects something real and worth the whole team knowing. Empty string if nothing should change."
            }
          },
          required: ["reply", "updatedMemory"],
          additionalProperties: false
        }
      }
    ],
    tool_choice: { type: "tool", name: "team_memory_turn" },
    system: `This is the shared team memory for this project: what FOMO currently understands about the team's work, decisions, and context, visible and editable by everyone on the team. Never invent claims, only reflect what's actually been observed or what someone tells you directly. The current memory content is:\n\n${current.content || "(nothing recorded yet)"}\n\nRecent conversation:\n${transcript}\n\nIf the new message is just a question or small talk, leave updatedMemory as an empty string. Only produce updatedMemory when someone has told you something genuinely worth the whole team remembering, or corrected something already recorded. Keep the whole memory SHORT, plain prose, a few sentences, not an exhaustive log, plain text only, no markdown syntax. NO EM-DASHES.`,
    messages: [{ role: "user", content: userMessage }]
  });

  logApiCall({
    callType: "team_memory_chat",
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
    `insert into team_memory_messages (room_id, anonymous_user_id, role, content) values ($1, $2, 'assistant', $3)`,
    [roomId, anonymousUserId, reply]
  );

  let memory = current;
  if (out.updatedMemory && out.updatedMemory.trim()) {
    await pool.query(
      `insert into team_memory (room_id, content, updated_at) values ($1, $2, now())
       on conflict (room_id) do update set content = excluded.content, updated_at = now()`,
      [roomId, out.updatedMemory.trim()]
    );
    memory = { content: out.updatedMemory.trim(), updatedAt: new Date().toISOString() };
  }

  return { reply, memory };
}

export async function setTeamMemory(roomId: string, content: string): Promise<TeamMemory> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  await pool.query(
    `insert into team_memory (room_id, content, updated_at) values ($1, $2, now())
     on conflict (room_id) do update set content = excluded.content, updated_at = now()`,
    [roomId, content]
  );
  return { content, updatedAt: new Date().toISOString() };
}

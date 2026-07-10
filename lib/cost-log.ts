import { getPool } from "@/lib/postgres";

type CallType = "classification" | "pulse_synthesis" | "mirror_synthesis" | "guidance_synthesis";

// Per-million-token pricing, approximate. Update if Anthropic pricing changes.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 }
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = PRICING[model];
  if (!rate) return 0;
  return (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
}

// Fire-and-forget: never let logging failures affect the actual AI call's result.
export function logApiCall(params: {
  callType: CallType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit?: boolean;
  roomId?: string;
  anonymousUserId?: string;
}) {
  const pool = getPool();
  if (!pool) return;

  const cost = params.cacheHit ? 0 : estimateCost(params.model, params.inputTokens, params.outputTokens);

  pool
    .query(
      `insert into cost_log (call_type, room_id, anonymous_user_id, input_tokens, output_tokens, estimated_cost, cache_hit)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.callType,
        params.roomId ?? null,
        params.anonymousUserId ?? null,
        params.inputTokens,
        params.outputTokens,
        cost,
        params.cacheHit ?? false
      ]
    )
    .catch((err) => console.error("[cost-log] failed to record call", err));
}

export function logFeatureView(params: {
  eventType: "pulse_view" | "mirror_view" | "guidance_view";
  anonymousUserId: string;
  roomId?: string;
}) {
  const pool = getPool();
  if (!pool || !params.anonymousUserId) return;

  pool
    .query(
      `insert into feature_views (event_type, anonymous_user_id, room_id) values ($1, $2, $3)`,
      [params.eventType, params.anonymousUserId, params.roomId ?? null]
    )
    .catch((err) => console.error("[cost-log] failed to record view", err));
}

import type { NextRequest } from "next/server";
import { getPool } from "@/lib/postgres";
import { getRequestAnonymousUserId } from "@/lib/session";

// Resolves the request's identity AND confirms it has a real account behind it — used to
// gate team-level actions (create/join a team, connect an integration) so they can never
// happen under an identity with no email attached. Plain browsing/classification stays
// anonymous-first and doesn't use this; only actions that create cross-device, shared state
// need a real account guaranteed up front. Kept out of lib/session.ts (rather than added
// there) because session.ts is imported by middleware.ts, which runs in the Edge runtime
// and can't bundle the Postgres client.
export async function getAccountForRequest(request: NextRequest): Promise<{ anonymousUserId: string; email: string } | null> {
  const anonymousUserId = getRequestAnonymousUserId(request);
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ email: string }>(`select email from accounts where anonymous_user_id = $1`, [anonymousUserId]);
  if (res.rows.length === 0) return null;
  return { anonymousUserId, email: res.rows[0].email };
}

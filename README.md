# FOMO

A living record of where a project stands.

FOMO connects to the tools a project team already uses (Google Drive, Microsoft OneDrive, Slack, and an optional Chrome extension) and keeps one continuously updated model of the project's actual state — what's currently understood, what's changed, where separate people's work overlaps or contradicts, and what a new person would need to know to get caught up. Three surfaces are built on that one model. Everything is anonymous by design: FOMO describes the work, never who did it.

**Live at [usefomo.net](https://usefomo.net)**

## The three surfaces

- **Discovery** — a personal view of what you're working on (stated by you, or inferred from your connected files). Every recommendation it produces is a genuine connection to what someone else on the team is doing — an overlap, a contradiction, or relevant material a teammate already has. If nothing genuinely connects, it shows nothing; it never pads the list with generic "explore this" filler. "Request it" hands over a teammate's relevant material immediately, no approval step, the owner just gets notified afterward.
- **Pulse** — finds genuine overlap or contradiction between different people's *current* work, reasoning over synthesized per-person digests (not raw excerpts or topic labels), which are themselves temporally aware (tracks what superseded what) and status-aware (distinguishes a settled conclusion from an open hypothesis).
- **Team Mirror** — a five-column board anyone can scan to get caught up in minutes: **Live** (current theses), **In tension** (active disagreements), **Unresolved** (open questions), **Stale** (unrevisited assumptions), **Settled** (decisions, with rationale). Any card can be pinned so it survives future recomputes.

Both Pulse and Discovery push a real notification the moment something genuinely new is found — ambient, not a dashboard you have to remember to check.

## How it works

1. Create a team and write a real description of what it's actually working on — this is the main signal FOMO uses to separate relevant work from noise, so it's required, not optional.
2. Connect what you use: Drive, OneDrive, Slack, or the Chrome extension. Scope is yours to choose, per tool, per person, down to a single file. External or client-facing Slack channels always need their own separate, explicit confirmation, never bundled into a bulk approval.
3. Optionally, describe what you're personally working on in Discovery — this is explicit, self-reported ground truth and outranks anything inferred from your files or browsing. Update it anytime; FOMO notices when your stated focus has shifted.
4. Open Team Mirror or Pulse at your next meeting, or just wait for a push notification when something genuine surfaces.

No account is required beyond an anonymous ID (email is optional, only for cross-device sign-in).

## Stack

- **Frontend/Backend:** Next.js App Router + TypeScript on Vercel
- **Database:** Supabase PostgreSQL
- **AI:** Claude Sonnet (Discovery, Pulse, Team Mirror synthesis), Claude Haiku (page/content classification, per-member digests), via the Anthropic API
- **Integrations:** Google Drive, Microsoft OneDrive (Graph API), Slack (Web API + OAuth), each with granular per-user connection scope
- **Push notifications:** Web Push (VAPID), triggered on genuinely new Pulse connections and Discovery signals
- **Freshness:** a GitHub Actions workflow refreshes Pulse/Discovery every 15 minutes (triggers the normal cached path, doesn't force-recompute — see `/api/insights/cron`); Vercel cron handles the daily signal-retention cleanup
- **Extension:** Manifest V3 Chrome extension (optional, browsing-based signal only)

## Key architectural decisions

- **One underlying model, three surfaces.** Discovery, Pulse, and Team Mirror aren't three separate features — they all read from the same per-member digest layer, which is what makes "your work relates to theirs" and "here's the project's current state" consistent with each other.
- **Digests over raw excerpts.** Reasoning over 15+ raw file excerpts per person was both thin and expensive. Each person's connected activity is first synthesized into a short, cached digest of real findings/decisions (`member_workstream_digests`), ordered oldest-to-newest so it can track what superseded what, and explicitly told to distinguish a draft/hypothesis from a settled conclusion.
- **Explicit ground truth outranks inference.** A person's own stated workstream note beats their digest, which beats raw browsing topics, in that order, in every prompt that reasons about what someone is doing.
- **Team-signal only, always.** Discovery does not produce generic research suggestions. Every recommendation must be a real, verifiable connection to something else on the team; an empty result is the correct, common answer, not a failure state.
- **Anonymous by construction, not by convention.** Team-facing outputs (Pulse connections, Mirror cards) are generated from stripped, unattributed signals and mechanically filtered for identity leaks before ever reaching a user. Identity is used only for account mechanics and the one-to-one handoff request.
- **Handoff has no approval gate.** Clicking "Request it" shares the underlying item immediately; the owner is notified after the fact, not asked to approve. A deliberate tradeoff for speed over friction, tracked via `handoff_requests`.
- **Mechanical safety nets under every AI output.** Em-dash stripping, one-sentence enforcement, fabricated-stat filtering, throat-clearing-preamble stripping, near-duplicate detection, and anonymity-leak filtering all sit underneath the prompts, not instead of them — prompting alone hasn't proven reliable enough on its own.

## Privacy

**Collected, only from what's explicitly connected:** file names/content and modified dates (Drive, OneDrive), message text in linked channels (Slack), page titles/URLs/visible text snippets (optional Chrome extension, not stored after classification).

**Never collected:** passwords, form inputs, banking/health pages, anyone's identity in a team-facing output.

**Consent model:** every connection is opt-in, per person, per tool, with a chosen scope (one file up to everything owned). External/client-facing Slack channels always require their own separate, explicit yes. Disconnecting a tool deletes the content tied to that connection.

**Known limitations, stated plainly:** no SSO/enterprise identity integration yet; OAuth tokens are stored in the primary database, protected by the database provider's infrastructure-level encryption, not additional application-layer encryption; no formal third-party security audit or SOC 2. A two-page overview for IT/security reviewers is at [`/fomo-data-privacy-overview.pdf`](https://usefomo.net/fomo-data-privacy-overview.pdf).

## API routes (selected)

- `POST /api/rooms` — create a team (requires a real description, 20+ characters)
- `GET /api/rooms/pulse` — Pulse (cross-member overlap/contradiction)
- `GET /api/rooms/mirror` — Team Mirror (five-state board + timeline)
- `GET/POST /api/rooms/workstream-note` — a person's own stated workstream description
- `GET /api/guidance` — Discovery (team-signal recommendations)
- `POST /api/discovery/handoff` — request a teammate's connected item, shared immediately
- `POST /api/discovery/feedback` — useful / not relevant feedback on a Discovery card
- `GET/POST/DELETE /api/pins` — pin a Pulse/Discovery/Mirror card so it survives recomputes
- `GET /api/workstream` — combined Drive/OneDrive/Slack activity feed + synthesis
- `GET/POST /api/integrations/{google,microsoft,slack}/*` — connect, scope, and manage each source
- `POST /api/signals`, `POST /api/classify` — Chrome extension browsing-signal ingestion and classification
- `GET /api/insights/cron` — 15-minute refresh trigger (GitHub Actions), respects normal caching
- `GET /api/cleanup/cron` — daily signal retention cleanup (Vercel cron)
- `GET /admin` — admin dashboard (protected, per-team pilot health and AI spend)

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

- `DATABASE_URL` — Supabase PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `NEXT_PUBLIC_APP_URL` — app URL (https://usefomo.net)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` — Drive OAuth
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_REDIRECT_URI` — OneDrive OAuth
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` — Slack OAuth
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — Web Push
- `CRON_SECRET` — Vercel daily cleanup cron auth
- `INSIGHTS_CRON_SECRET` — GitHub Actions 15-minute refresh auth (set in Vercel, not `.env.local`)
- `ADMIN_KEY` — admin dashboard access key

## Built by

Jad Ammar — USC Marshall '30. Started as a 3-day build with zero prior coding experience; the architecture described above reflects ongoing iteration since.

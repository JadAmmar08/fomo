# FOMO MVP

FOMO is a transparent social sensing MVP built with Next.js + TypeScript and a Manifest V3 Chrome extension. The core product principle is that FOMO is not a black-box recommendation engine: it exposes how it models the user, why topics appear, and how anonymous community trends are produced.

## What ships in this MVP

- Next.js dashboard with:
  - Landing page
  - Onboarding page
  - Private Mirror page
  - Community Pulse page
  - Settings/privacy page
- API routes for:
  - `POST /api/signals`
  - `GET /api/mirror`
  - `GET /api/pulse`
  - `GET /api/session`
  - `POST /api/feedback`
  - `POST /api/settings/privacy`
  - `DELETE /api/user-data`
- Smarter weighted local classifier with optional OpenAI-compatible classifier behind env vars
- Seeded demo data so the UI works immediately
- Manifest V3 Chrome extension with popup, automatic background syncing, local classification, and blocked-site protections
- Anonymous session identity with per-user saved state
- Postgres-backed persistence when `DATABASE_URL` is configured, with automatic demo fallback when it is not
- PostgreSQL schema for the production data model

## Stack

- Frontend and backend: Next.js App Router + TypeScript
- Database target: PostgreSQL (`db/schema.sql`)
- MVP runtime store: in-memory demo store in [`lib/demo-data.ts`](/Users/nisreenammar/Documents/FOMO/lib/demo-data.ts)
- Persistence path: PostgreSQL-backed store in [`lib/database-store.ts`](/Users/nisreenammar/Documents/FOMO/lib/database-store.ts)
- Extension: Manifest V3 in [`extension/`](/Users/nisreenammar/Documents/FOMO/extension)

## Product surfaces

### 1. Private Mirror

Shows:

- detected interest categories
- confidence score
- recent change (`rising`, `falling`, `stable`)
- explanation for why the category exists
- feedback actions:
  - `This is wrong`
  - `Hide`
  - `More like this`
  - `Good catch`

### 2. Community Pulse

Shows:

- trending topics across the community
- trend score
- anonymous signal count
- number of unique anonymous users
- time window
- explanation for why the trend is rising
- feedback actions:
  - `Good catch`
  - `Not relevant`
  - `Hide topic`

### 3. Settings / Transparency

Lets the user:

- pause tracking
- delete local data
- delete account data
- choose which categories can contribute anonymously
- inspect exactly what data is collected

## Privacy model

FOMO is designed around safe metadata instead of invasive collection.

### Collected

- page title
- normalized domain
- URL path without query parameters
- timestamp rounded to the hour
- broad category
- confidence
- short reasoning

### Never collected

- passwords
- form inputs
- cookies
- full page screenshots
- sensitive page content

### Excluded page types

The extension blocks or avoids sending signals for:

- banking pages
- health portals
- adult/private sites
- messaging pages

The sensitive filtering rules live in:

- dashboard/backend: [`lib/privacy.ts`](/Users/nisreenammar/Documents/FOMO/lib/privacy.ts)
- extension: [`extension/classifier.js`](/Users/nisreenammar/Documents/FOMO/extension/classifier.js)

## Architecture

### Frontend

- [`app/page.tsx`](/Users/nisreenammar/Documents/FOMO/app/page.tsx): landing page
- [`app/onboarding/page.tsx`](/Users/nisreenammar/Documents/FOMO/app/onboarding/page.tsx): onboarding and data contract
- [`app/mirror/page.tsx`](/Users/nisreenammar/Documents/FOMO/app/mirror/page.tsx): private mirror
- [`app/pulse/page.tsx`](/Users/nisreenammar/Documents/FOMO/app/pulse/page.tsx): anonymous community trends
- [`app/settings/page.tsx`](/Users/nisreenammar/Documents/FOMO/app/settings/page.tsx): privacy controls

### Backend / API

- [`app/api/signals/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/signals/route.ts): accepts privacy-safe browsing metadata
- [`app/api/mirror/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/mirror/route.ts): returns the user mirror model
- [`app/api/pulse/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/pulse/route.ts): returns community trends
- [`app/api/session/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/session/route.ts): returns or establishes the anonymous session used by the website and extension
- [`app/api/feedback/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/feedback/route.ts): stores mirror/pulse feedback
- [`app/api/settings/privacy/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/settings/privacy/route.ts): updates privacy preferences
- [`app/api/user-data/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/user-data/route.ts): deletes local or account data
- [`app/api/trends/recompute/route.ts`](/Users/nisreenammar/Documents/FOMO/app/api/trends/recompute/route.ts): triggerable aggregation endpoint for scheduled jobs

### Core logic

- [`lib/classifier.ts`](/Users/nisreenammar/Documents/FOMO/lib/classifier.ts): rule-based classification with optional OpenAI-compatible fallback
- [`lib/interests.ts`](/Users/nisreenammar/Documents/FOMO/lib/interests.ts): feedback-aware interest scoring and mirror weighting
- [`lib/trends.ts`](/Users/nisreenammar/Documents/FOMO/lib/trends.ts): trend scoring and explanations
- [`lib/store.ts`](/Users/nisreenammar/Documents/FOMO/lib/store.ts): MVP data access layer
- [`lib/demo-data.ts`](/Users/nisreenammar/Documents/FOMO/lib/demo-data.ts): seeded in-memory data store
- [`lib/session.ts`](/Users/nisreenammar/Documents/FOMO/lib/session.ts): anonymous session helpers

### Chrome extension

- [`extension/manifest.json`](/Users/nisreenammar/Documents/FOMO/extension/manifest.json)
- [`extension/background.js`](/Users/nisreenammar/Documents/FOMO/extension/background.js)
- [`extension/popup.html`](/Users/nisreenammar/Documents/FOMO/extension/popup.html)
- [`extension/popup.js`](/Users/nisreenammar/Documents/FOMO/extension/popup.js)

## Trend engine

Community Pulse trends are derived from:

- recent signal volume
- growth compared to the previous period
- number of unique anonymous users
- recency boost

Example explanation generated by the engine:

`Interest in Healthcare is rising because 4 anonymous users generated 11 matching signals in the last 24 hours, up 80% from the previous period.`

For a production deployment, this should run as a scheduled job that materializes `community_trends` on a cadence such as every 15 minutes.

## Optional AI classifier

The default MVP classifier uses weighted title/domain/path evidence and never needs to send sensitive content anywhere.

If you want an OpenAI-compatible classifier:

1. Copy `.env.example` to `.env.local`
2. Set:
   - `OPENAI_CLASSIFIER_ENABLED=true`
   - `OPENAI_BASE_URL`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`

Important safety constraint:

- only safe metadata is sent to the classifier
- no query parameters
- no page body text
- no screenshots
- no passwords or form inputs

If enabled, the backend classifier uses the combination of domain semantics, title context, and safe path metadata to infer what the user is looking at more accurately than a plain keyword check.

## Anonymous auth and saved state

FOMO now creates an anonymous per-user session automatically. That session ID is stored in a cookie for the website, and the extension also requests the current session so it can attach signals to the same anonymous user when possible.

This gives the MVP:

- per-user mirror state
- per-user privacy settings
- per-user blocked domains
- per-user feedback history

This is still anonymous auth, not full account auth. For production, the next step would be email or OAuth sign-in layered on top of the same data model.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

5. Load the extension:
   - open `chrome://extensions`
   - enable Developer Mode
   - click `Load unpacked`
   - select [`extension/`](/Users/nisreenammar/Documents/FOMO/extension)
   - after code changes, click `Reload` on the FOMO extension card

## Persistence modes

FOMO now runs in two modes:

- `database`: if `DATABASE_URL` is configured and reachable, user/session state is stored in PostgreSQL
- `demo`: if no database is configured, the app falls back to an in-memory seeded store so the product still works instantly

You can see the active mode inside the UI.

## PostgreSQL setup

When you are ready to use persistent storage:

1. Create a PostgreSQL database.
2. Set `DATABASE_URL` in `.env.local`.
3. Run the SQL in [`db/schema.sql`](/Users/nisreenammar/Documents/FOMO/db/schema.sql).
4. Restart the Next.js server.

The app will automatically use the database-backed store when `DATABASE_URL` is available.

## API examples

### Send a signal

```bash
curl -X POST http://localhost:3000/api/signals \
  -H "Content-Type: application/json" \
  -d '{
    "normalizedDomain": "github.com",
    "urlPath": "/trending/typescript",
    "pageTitle": "Trending TypeScript repositories"
  }'
```

### Read the mirror

```bash
curl http://localhost:3000/api/mirror
```

### Read the pulse

```bash
curl http://localhost:3000/api/pulse
```

## Production hardening TODOs

- add full account auth (email/OAuth) on top of the anonymous session model
- add server-side migrations and automated schema management
- move trend aggregation into a real scheduled worker or cron job
- add rate limiting and abuse prevention on signal ingestion
- add tests for classification, filtering, feedback weighting, and API routes
- add analytics for false positives and category drift
- add a stronger sensitive-site taxonomy and allowlist/denylist controls
- verify extension behavior on Chrome Web Store review requirements
- support signed, encrypted local cache for extension state

## Notes on MVP behavior

- the dashboard works immediately because seeded demo data is embedded in the app
- when feedback is saved, it changes the mirror weighting for that topic
- local data deletion clears that user’s signals and feedback
- account deletion removes that user’s persisted or in-memory state

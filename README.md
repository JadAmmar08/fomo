# FOMO

Turn a team's separate browsing into shared intelligence — without anyone changing how they work.

FOMO is a free, private Chrome extension + web app for research-heavy teams. It quietly reads what each person is already researching in their browser and uses AI to surface the connections, tensions, and open questions between what different teammates are separately looking into — never who found what, only how it connects.

**Live at [usefomo.co](https://usefomo.co)** · **[Chrome Web Store](https://chromewebstore.google.com/detail/FOMO/dfnmincjfmcbhnilbhbfhgkhegdhdnal)**

## How it works

1. Install the Chrome extension and create or join a team
2. Browse normally — FOMO classifies pages in the background, no manual input
3. **Team Pulse** surfaces cross-member connections, tensions, and standout solo research, filtered against the team's own stated focus
4. **Team Mirror** builds the team's evolving mental model — working theses, stale assumptions nobody's revisited, and how thinking has shifted over time
5. **Individual guidance** reads your own research pattern and points you toward directions worth exploring, distinct from the team view

No account needed beyond an anonymous ID. No one can see who researched what — only the aggregate, anonymized signal.

## Stack

- **Frontend/Backend:** Next.js App Router + TypeScript on Vercel
- **Database:** Supabase PostgreSQL
- **AI:** Claude Sonnet (Team Pulse & Team Mirror synthesis), Claude Haiku (page classification & individual guidance), via the Anthropic API
- **Email:** Resend (digest emails + notifications)
- **Extension:** Manifest V3 Chrome extension

## Key features

- **Team relevance filtering** — connections and highlights are checked against the team's own name/description before surfacing, so off-topic browsing doesn't pollute team insight
- **Team Pulse** — AI-found connections between what different members are separately researching, ranked by insight value (implication, tension, question, opportunity, blind spot)
- **Team Mirror** — the team's working theses, stale/unchallenged assumptions, and a timeline of belief shifts, derived from connection history
- **Individual guidance** — a private read on your own research pattern, with directions and open questions to explore next
- **Mechanical safety nets on every AI output** — em-dash stripping, one-sentence enforcement, fabricated-stat filtering, and anonymity-leak filtering sit underneath every prompt, not just the prompt itself
- **AI-powered classification with server-side cache** — every page is classified once and never reclassified
- **Admin dashboard** — per-team pilot health: member counts, active members, signal volume, connection/thesis counts, and per-member engagement, to see whether a team is actually using it

## Privacy

**Collected:** Page titles, URLs, page content (for AI classification), time on page

**Never collected:** Passwords, messages, form inputs, banking/health pages, your identity

**Blocked domains:** Instagram, Facebook, Twitter/X, TikTok, Snapchat, Pinterest, Threads, Google services, YouTube Shorts

## API routes

- `POST /api/signals` — receive browsing signals from extension
- `POST /api/classify` — classify a page (with server-side cache)
- `GET/POST /api/rooms` — create/list teams
- `POST /api/rooms/join` — join a team
- `GET /api/rooms/pulse` — Team Pulse (cross-member connections)
- `GET /api/rooms/mirror` — Team Mirror (working theses, stale assumptions, shifts)
- `GET /api/guidance` — individual research guidance
- `GET /api/session` — anonymous session management
- `POST /api/feedback` — mirror/pulse feedback
- `POST /api/waitlist` — email signup (links to anonymous ID)
- `GET /api/digest/cron` — daily personalized digest (Vercel cron, 9am EST)
- `GET /api/digest/click` — track digest email click-throughs
- `GET /admin` — admin dashboard (protected, per-team pilot health)

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

- `DATABASE_URL` — Supabase PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `RESEND_API_KEY` — Resend email API key
- `RESEND_FROM_EMAIL` — sender email address
- `NEXT_PUBLIC_APP_URL` — app URL (https://usefomo.co)
- `NEXT_PUBLIC_CHROME_STORE_URL` — Chrome Web Store listing URL
- `CRON_SECRET` — Vercel cron authentication
- `DIGEST_API_KEY` — manual digest trigger auth
- `ADMIN_KEY` — admin dashboard access key

## Built by

Jad Ammar — USC Marshall '30. Built in 3 days with zero prior coding experience.

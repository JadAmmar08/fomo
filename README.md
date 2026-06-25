# FOMO

See what your community is paying attention to.

FOMO is a Chrome extension that silently classifies what you browse using AI, builds a personal attention profile (your Mirror), and shows a live feed of what people like you are into right now (the Pulse).

**Live at [usefomo.co](https://usefomo.co)** · **[Chrome Web Store](https://chromewebstore.google.com/detail/FOMO/dfnmincjfmcbhnilbhbfhgkhegdhdnal)**

## How it works

1. Install the Chrome extension
2. Browse normally — FOMO runs silently in the background
3. Your **Mirror** builds a profile of who you are based on what you read
4. The **Pulse** shows what your community is paying attention to right now
5. Daily **digest emails** surface trends personalized to your interests

No account needed. No followers. No posting. Everything is anonymous by default.

## Stack

- **Frontend/Backend:** Next.js App Router + TypeScript on Vercel
- **Database:** Supabase PostgreSQL via pgbouncer
- **AI Classification:** Claude Haiku (via Anthropic API)
- **Email:** Resend (digest emails + notifications)
- **Extension:** Manifest V3 Chrome extension

## Key features

- **AI-powered classification** — Claude Haiku classifies every page into topics and categories
- **Server-side classification cache** — same URL never gets classified twice
- **Personalized digest emails** — Haiku writes casual, friend-like briefings based on your interests
- **Junk filtering** — logins, shopping, dashboards, utility pages filtered at API level
- **Quality-ranked Pulse** — research, finance, startups rank higher than shopping
- **Mirror identity** — content script syncs user identity via URL param, no cookie dependency
- **Share buttons** — text a friend or share on X directly from your mirror

## Privacy

**Collected:** Page titles, URLs, page content (for AI classification), time on page

**Never collected:** Passwords, messages, form inputs, banking/health pages, your identity

**Blocked domains:** Instagram, Facebook, Twitter/X, TikTok, Snapchat, Pinterest, Threads, Google services, YouTube Shorts

## API routes

- `POST /api/signals` — receive browsing signals from extension
- `POST /api/classify` — classify a page (with server-side cache)
- `GET /api/pulse` — community trends
- `GET /api/session` — anonymous session management
- `POST /api/feedback` — mirror/pulse feedback
- `POST /api/waitlist` — email signup (links to anonymous ID)
- `GET /api/digest/cron` — daily personalized digest (Vercel cron, 9am EST)
- `GET /api/digest/click` — track digest email click-throughs
- `GET /admin` — admin dashboard (protected)

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

## Built by

Jad Ammar — USC Marshall '30. Built in 3 days with zero prior coding experience.

# بطولة تنس الطاولة — Table Tennis Bracket App

Next.js 14 (App Router) + Supabase + Tailwind, deployable free on Vercel.

## 1. Supabase setup (~10 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to **SQL Editor > New query**, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
   This creates the `players`, `matches`, `tournament_state` tables, Row Level
   Security policies (public read, authenticated-only write), and enables
   Realtime on all three tables.
3. Go to **Authentication > Users > Add user** and create the one admin
   account (email + password). This is the only login the app has.
4. Go to **Project Settings > API** and copy the **Project URL** and
   **anon public key**.

## 2. Local development

```bash
npm install
cp .env.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the two environment variables from `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the
   Vercel project settings.
4. Deploy. Framework preset is auto-detected (Next.js); `vercel.json` is
   included for clarity but no extra config is required.

The anon key is safe to expose in the frontend — Row Level Security in
`supabase/schema.sql` is what actually protects writes (public can read
everything, only an authenticated user can write).

## 4. Admin access

The admin dashboard lives at `/admin` and is not linked from the site nav.
Before going live, **rename the `src/app/admin` folder** to something only
you know (e.g. `src/app/kleeja-9f2/`) so the URL itself isn't guessable —
the login screen behind it is the second layer of protection.

## 5. Project structure

- `supabase/schema.sql` — full DB schema, RLS policies, realtime publication.
- `supabase/group-stage-migration.sql` — just the group-stage columns, for a
  database created before that feature (already part of `schema.sql`).
- `src/lib/validation.ts` — the scoring rulebook (11-x, 7-0 mercy, 10-10 decider).
- `src/lib/bracket.ts` — random draw + bye placement + tree generation.
- `src/lib/groups.ts` — group draw, round-robin fixtures, standings, and the
  seeding that turns qualifiers into a knockout tree.
- `src/lib/match.ts` — best-of-3 final logic, «ما لك كليجا» detection.
- `src/lib/actions.ts` — all admin server actions (draw, scoring, edit/recompute, reset).
- `src/lib/jokes.ts` — bilingual joke pool for kleeja easter eggs (append lines here).
- `src/app/(public pages)` — Home, Bracket (tree/list), Players, Rules, Prize, Hall of Fame/Shame.
- `src/app/admin` — hidden admin dashboard.

## 6. Tournament formats

The admin picks one before the draw, on `/admin`:

- **خروج مباشر (knockout)** — the original single-elimination tree, drawn at
  random, by hand, or live on air.
- **مجموعات (groups)** — the roster is dealt into round-robin groups (at least
  3 players each) and everyone plays everyone in their group once. Tables are
  ranked on **wins and losses alone**; a tie is broken by point difference and
  then by points scored. When every group match has a result, one button seeds
  the top *n* of each group into a knockout tree — 16 qualifiers walk into the
  round of 16, 8 into the quarters, and so on. The seeding keeps two players
  from the same group out of each other's first match, and with two qualifying
  from an even number of groups a winner and their own runner-up can only meet
  in the final.

The knockout tree is built once, from the tables as they stand at that moment,
so results are worth checking before pressing the button.

## 7. Still open (see original spec)

- Real funders / prize copy for 2nd & 3rd place.
- Event date for the homepage countdown (wire into `tournament_state.event_date`).
- Referee profile page for عبدالله الهليس.
- Roster is entered from the admin page — no seed data included.
"# ping-pong-tournament-kasp" 

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
- `supabase/group-tiebreak-migration.sql` — just the hand-picked qualifiers
  column, for a database created before that feature (also in `schema.sql`).
- `supabase/third-place-migration.sql` — just the widened round constraint that
  lets the third-place match (`'3P'`) exist, for a database created before it
  (also in `schema.sql`). It rewrites `valid_round` with every round code the
  app uses, so it is also the fix for a `valid_round` violation on any other
  round — see [Troubleshooting](#8-troubleshooting).
- `src/lib/validation.ts` — the scoring rulebook (11-x, 11-0 shutout, 10-10 decider).
- `src/lib/bracket.ts` — random draw + bye placement + tree generation.
- `src/lib/groups.ts` — group draw, round-robin fixtures, standings, the
  hand-picked qualifiers that settle a tie, and the seeding that turns
  qualifiers into a knockout tree.
- `src/lib/match.ts` — series lengths per round (best of 3 / 5 / 7, and the
  third-place match at best of 3), «ما لك كليجا» detection.
- `src/lib/time.ts` — the tournament clock: every match time is written and read
  in `Asia/Riyadh`, whatever zone the device or the server happens to be in.
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
  ranked on **table points**: a win by 6 points or more is worth 2 and docks the
  loser 1, any closer win is worth 1 and the loser nothing, and a walkover pays
  the narrow win. Players level on points are split head-to-head first, then on
  point difference, then on points scored. When every group match has a result, one button seeds
  the top *n* of each group into a knockout tree — 16 qualifiers walk into the
  round of 16, 8 into the quarters, and so on. The seeding keeps two players
  from the same group out of each other's first match, and with two qualifying
  from an even number of groups a winner and their own runner-up can only meet
  in the final.

The knockout tree is built once, from the tables as they stand at that moment,
so results are worth checking before pressing the button.

### The third-place match

Any tree deep enough to have semifinals is drawn with a third-place match
(round `3P`, best of 3 — short, since it is played once both are already out).
It hangs off the tree rather than sitting in it: nothing feeds it a winner, so
its two slots are filled with whoever *lost* the semifinals, seated as each one
is settled. The bracket page shows it as its own card under the tree, and it
counts in the stats like any other match — except for «طاح على يد», since
neither player was knocked out by it.

Correct a semifinal after the third-place match has been played and the
third-place result is voided along with the players it was played between; the
edit warning on `/admin` lists it before anything is wiped. A tournament drawn
before this feature existed has no such match, so `/admin` offers a button to
add one — run `supabase/third-place-migration.sql` first.

There is no third prize. The match is played for the place itself, which is
what `/prize` says on it.

## 7. Fixing a match after the fact

The match board on `/admin` shows what's on the table and what's still to play —
the top of that queue is tagged **التالية** — and files everything already
scored under **مباريات انتهت**, folded shut until you open it. The public list at
`/matches` reads the same way: live and upcoming first, results behind
**النتائج السابقة**. Either fold opens itself when there's nothing left to play.

Every match card on `/admin` has **امسح النتيجة**, which puts the match back to
"not played yet" — for a score typed against a match that never happened, a
walkover called too early, or a wrong first game of a series. Before it
wipes anything it lists the later matches that were built on that winner, since
those are voided along with it (and a voided final un-crowns the champion). A
bye is the one thing it won't touch: that follows from who is placed in the
match, so it is undone in **غيّر اللاعبين**.

Match times are stored as UTC but always entered and displayed on the
tournament's own clock (`Asia/Riyadh`, see `src/lib/time.ts`). 4:30 م typed in
the admin picker is 4:30 م on every phone in the hall and on the server-rendered
homepage. Move the tournament to another city and that one constant is the only
thing to change.

## 8. Troubleshooting

**`new row for relation "matches" violates check constraint "valid_round"`**

The database is older than the app: its `valid_round` check still lists the
round codes that existed when the schema was first run, and the app is trying
to write one added later — `'G'` for the group stage, `'3P'` for the
third-place match. Nothing is wrong with the roster or the draw.

Fix it once in **SQL Editor > New query** with
[`supabase/third-place-migration.sql`](supabase/third-place-migration.sql),
which widens the check to the full list the app uses
(`'G','R1','R16','QF','SF','3P','F','judge'`), then retry the action. Re-running
the whole of `supabase/schema.sql` does the same thing and is equally safe —
every statement in it is idempotent.

Note that each migration file rewrites `valid_round` with the *complete* list,
not just the codes it introduces, so running an old migration after a newer one
can't take a round code back off the database.

## 9. Still open (see original spec)

- The champion takes a box of kleeja and a Claude subscription; second place has
  no prize, and third place is a match rather than a prize. If a real 2nd/3rd
  prize ever appears, the copy lives in `dict.*.prize` in
  `src/lib/i18n/dictionary.ts` and the page in `src/app/prize/page.tsx`.
- Event date for the homepage countdown (wire into `tournament_state.event_date`).
- Referee profile page for عبدالله الهليس.
- Roster is entered from the admin page — no seed data included.
"# ping-pong-tournament-kasp" 

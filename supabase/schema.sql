-- بطولة تنس الطاولة — Supabase schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query > paste > Run).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- matches (bracket + judge match share this table; judge match has round = 'judge')
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  round text not null,                -- 'G','R1','R16','QF','SF','F','judge'
  bracket_slot int not null default 0, -- ordering within round
  -- Group stage only: which group this round-robin match belongs to (0-based).
  -- Null for every knockout match.
  group_no int,
  player1_id uuid references players(id) on delete set null,
  player2_id uuid references players(id) on delete set null,
  -- Array of games: [{ score1, score2, decider_score1?, decider_score2? }, ...]
  -- Every round is a single game except 'SF' and 'F' (best of 3, first to 2).
  games jsonb not null default '[]'::jsonb,
  winner_id uuid references players(id) on delete set null,
  outcome_type text not null default 'pending', -- pending | score | absent | withdrew | bye
  outcome_reason text,
  scheduled_at timestamptz,
  is_live boolean not null default false,
  next_match_id uuid references matches(id) on delete set null,
  next_match_slot int,                -- 1 or 2: which slot the winner feeds into
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_outcome_type check (outcome_type in ('pending','score','absent','withdrew','bye'))
);

-- For projects created before the group stage existed.
alter table matches add column if not exists group_no int;

-- Dropped first so re-running this file doesn't error on the older constraint,
-- which didn't know about the group round.
alter table matches drop constraint if exists valid_round;
alter table matches add constraint valid_round
  check (round in ('G','R1','R16','QF','SF','F','judge'));

create index if not exists idx_matches_round on matches (round);
create index if not exists idx_matches_next on matches (next_match_id);
create index if not exists idx_matches_group on matches (group_no);

-- ---------------------------------------------------------------------------
-- tournament_state — single row, drives draw/reset/event date
-- ---------------------------------------------------------------------------
create table if not exists tournament_state (
  id int primary key default 1,
  drawn boolean not null default false,
  event_date timestamptz,
  champion_id uuid references players(id) on delete set null,
  -- «أفضل شمات» — a spectator award, judged by the admin, not by the results.
  best_shamat_name text,
  best_shamat_quote text,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);

-- For projects created before the shamat award existed.
alter table tournament_state add column if not exists best_shamat_name text;
alter table tournament_state add column if not exists best_shamat_quote text;

-- ---------------------------------------------------------------------------
-- Tournament format.
--
-- 'knockout' — the classic single-elimination tree, drawn in one go.
-- 'groups'   — a round-robin group stage first; the top `advance_per_group` of
--              each group then feed a knockout tree (16 qualifiers enter at the
--              round of 16, 8 at the quarters, and so on).
-- ---------------------------------------------------------------------------
alter table tournament_state add column if not exists format text not null default 'knockout';
alter table tournament_state add column if not exists group_count int;
alter table tournament_state add column if not exists advance_per_group int;

alter table tournament_state drop constraint if exists valid_format;
alter table tournament_state add constraint valid_format
  check (format in ('knockout','groups'));

insert into tournament_state (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- statements — quotes from players/spectators, typed in by the admin and
-- scrolled across the hall of fame page.
-- ---------------------------------------------------------------------------
create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quote text not null,
  player_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_statements_created on statements (created_at);
create index if not exists idx_statements_player on statements (player_id);

-- ---------------------------------------------------------------------------
-- draw_slots — the live draw («القرعة على الهواء»).
--
-- The draw itself happens in the room with paper slips; this table is only the
-- scoreboard for it. One row per *filled* first-round seat: seat i belongs to
-- match floor(i/2), side (i%2)+1, out of `tournament_state.draw_size` seats.
-- Rows land one at a time as each paper is read out, and every spectator's page
-- updates over Realtime. An empty seat next to a filled one is a bye.
--
-- The real `matches` tree is not built here — it is built once, from these
-- seats, when the admin confirms the draw.
-- ---------------------------------------------------------------------------
create table if not exists draw_slots (
  seat int primary key,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- A player can only come out of the bag once.
create unique index if not exists idx_draw_slots_player on draw_slots (player_id);

alter table tournament_state add column if not exists draw_status text not null default 'idle';
alter table tournament_state add column if not exists draw_size int;

-- Dropped first so re-running this file doesn't error on an existing constraint.
alter table tournament_state drop constraint if exists valid_draw_status;
alter table tournament_state add constraint valid_draw_status
  check (draw_status in ('idle','live','done'));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_matches_updated_at on matches;
create trigger trg_matches_updated_at before update on matches
  for each row execute function set_updated_at();

drop trigger if exists trg_state_updated_at on tournament_state;
create trigger trg_state_updated_at before update on tournament_state
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — public read-only, writes require an authenticated admin
-- ---------------------------------------------------------------------------
alter table players enable row level security;
alter table matches enable row level security;
alter table tournament_state enable row level security;
alter table statements enable row level security;
alter table draw_slots enable row level security;

drop policy if exists "public read players" on players;
create policy "public read players" on players for select using (true);
drop policy if exists "admin write players" on players;
create policy "admin write players" on players for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches for select using (true);
drop policy if exists "admin write matches" on matches;
create policy "admin write matches" on matches for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read state" on tournament_state;
create policy "public read state" on tournament_state for select using (true);
drop policy if exists "admin write state" on tournament_state;
create policy "admin write state" on tournament_state for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read statements" on statements;
create policy "public read statements" on statements for select using (true);
drop policy if exists "admin write statements" on statements;
create policy "admin write statements" on statements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read draw slots" on draw_slots;
create policy "public read draw slots" on draw_slots for select using (true);
drop policy if exists "admin write draw slots" on draw_slots;
create policy "admin write draw slots" on draw_slots for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Realtime: add tables to the supabase_realtime publication.
-- Every add is guarded: `alter publication ... add table` errors if the table
-- is already a member, and the SQL editor runs this file as one transaction,
-- so a single such error would roll back everything above it.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['players','matches','tournament_state','statements','draw_slots'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

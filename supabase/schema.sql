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
  round text not null,                -- 'R1','R16','QF','SF','F','judge'
  bracket_slot int not null default 0, -- ordering within round
  player1_id uuid references players(id) on delete set null,
  player2_id uuid references players(id) on delete set null,
  -- Array of games: [{ score1, score2, decider_score1?, decider_score2? }, ...]
  -- Every round is a single game except 'F' (best of 3, first to 2 game-wins).
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

  constraint valid_outcome_type check (outcome_type in ('pending','score','absent','withdrew','bye')),
  constraint valid_round check (round in ('R1','R16','QF','SF','F','judge'))
);

create index if not exists idx_matches_round on matches (round);
create index if not exists idx_matches_next on matches (next_match_id);

-- ---------------------------------------------------------------------------
-- tournament_state — single row, drives draw/reset/event date
-- ---------------------------------------------------------------------------
create table if not exists tournament_state (
  id int primary key default 1,
  drawn boolean not null default false,
  event_date timestamptz,
  champion_id uuid references players(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);

insert into tournament_state (id) values (1) on conflict (id) do nothing;

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

-- ---------------------------------------------------------------------------
-- Realtime: add tables to the supabase_realtime publication
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table tournament_state;
alter publication supabase_realtime add table players;

-- بطولة تنس الطاولة — group stage migration
--
-- Only the changes the group stage needs, for a project whose database was
-- created before it existed. Run it once in the Supabase SQL editor
-- (Project > SQL Editor > New query > paste > Run).
--
-- Every statement is idempotent, so running it twice is harmless, and it is
-- already included in `schema.sql` — a fresh project needs only that file.
-- Nothing here touches existing rows: current matches keep a null group_no and
-- the tournament stays on the 'knockout' format until a group draw is made.

-- ---------------------------------------------------------------------------
-- matches: which group a round-robin fixture belongs to, and the 'G' round.
-- ---------------------------------------------------------------------------
alter table matches add column if not exists group_no int;

alter table matches drop constraint if exists valid_round;
alter table matches add constraint valid_round
  check (round in ('G','R1','R16','QF','SF','F','judge'));

create index if not exists idx_matches_group on matches (group_no);

-- ---------------------------------------------------------------------------
-- tournament_state: the format, and the two numbers behind a group draw.
--
-- 'knockout' — the single-elimination tree, drawn in one go.
-- 'groups'   — round-robin groups first; the top `advance_per_group` of each
--              then feed the tree (16 qualifiers enter at the round of 16).
-- ---------------------------------------------------------------------------
alter table tournament_state add column if not exists format text not null default 'knockout';
alter table tournament_state add column if not exists group_count int;
alter table tournament_state add column if not exists advance_per_group int;

alter table tournament_state drop constraint if exists valid_format;
alter table tournament_state add constraint valid_format
  check (format in ('knockout','groups'));

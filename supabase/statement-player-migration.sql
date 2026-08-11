-- بطولة تنس الطاولة — statement-player migration
--
-- Only the change linking statements to a player, for a project whose
-- database was created before it existed. Run it once in the Supabase SQL
-- editor (Project > SQL Editor > New query > paste > Run).
--
-- Idempotent, so running it twice is harmless, and it is already included in
-- `schema.sql` — a fresh project needs only that file. Nothing here touches
-- existing rows: every statement keeps a null player_id until an admin links
-- it to a roster name.
-- ---------------------------------------------------------------------------
alter table statements add column if not exists player_id uuid references players(id) on delete set null;

create index if not exists idx_statements_player on statements (player_id);

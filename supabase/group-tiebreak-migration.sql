-- بطولة تنس الطاولة — manual group tiebreak migration
--
-- Only the change that hand-picked qualifiers need, for a project whose
-- database already has the group stage. Run it once in the Supabase SQL editor
-- (Project > SQL Editor > New query > paste > Run).
--
-- The statement is idempotent, so running it twice is harmless, and it is
-- already included in `schema.sql` — a fresh project needs only that file.
-- Existing tournaments come out with an empty object, which means every group
-- is still ranked by its results, exactly as before.

-- ---------------------------------------------------------------------------
-- tournament_state: qualifying places settled by hand.
--
-- Group number to an ordered list of player ids: { "0": ["<uuid>", "<uuid>"] }.
-- A group only appears here when the admin picked its qualifiers themselves —
-- the usual case for a decider played in the room between two players level on
-- points and never written down as a match.
-- ---------------------------------------------------------------------------
alter table tournament_state add column if not exists group_tiebreaks jsonb not null default '{}'::jsonb;

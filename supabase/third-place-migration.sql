-- مباراة المركز الثالث — third-place match.
--
-- Only for a database created before the third-place match existed; it is
-- already part of schema.sql. Run it once in the Supabase SQL editor.
--
-- All it does is widen the round constraint to accept '3P'. The row itself is
-- written by the app: every new draw deep enough to have semifinals gets a
-- third-place fixture with the tree, and a tournament already drawn gets one
-- from the «مباراة المركز الثالث» button on /admin. Its two players are the
-- losing semifinalists, seated as each semifinal is settled, and the series is
-- best of 5 — the same length as the semifinal they just lost.

alter table matches drop constraint if exists valid_round;
alter table matches add constraint valid_round
  check (round in ('G','R1','R16','QF','SF','3P','F','judge'));

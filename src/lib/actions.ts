"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildBracket, generateBracket, validatePairings, type DraftMatch, type Pairing } from "@/lib/bracket";
import { drawSeatCount, seatArray, seatsToPairings } from "@/lib/draw";
import {
  MIN_GROUP_SIZE,
  distributeIntoGroups,
  groupsFromMatches,
  knockoutPairingsFromQualifiers,
  possibleGroupCounts,
  roundRobinPairs,
  validateGroupSplit,
} from "@/lib/groups";
import { gameWinCounts, gamesToWin, seriesWinner } from "@/lib/match";
import { validateDeciderScore, validateDoublePointUse, validateGameScore } from "@/lib/validation";
import type { Game, GroupTiebreaks, Match, Round } from "@/lib/supabase/types";

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مصرح، سجّل الدخول");
  return supabase;
}

export async function signIn(email: string, password: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "كلمة المرور غلط يا طويل العمر" };
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Players (pre-draw only)
// ---------------------------------------------------------------------------

export async function addPlayer(name: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "ما تقدر تضيف لاعبين بعد سحب القرعة" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "اكتب اسم اللاعب" };
  const { error } = await supabase.from("players").insert({ name: trimmed });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/players");
  return { ok: true, data: null };
}

/**
 * Adds a pasted roster in one go. Skips blanks, repeats inside the paste, and
 * names already registered, then reports what actually landed.
 */
export async function addPlayers(
  names: string[]
): Promise<ActionResult<{ added: number; skipped: number }>> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "ما تقدر تضيف لاعبين بعد سحب القرعة" };

  const { data: existing, error: exErr } = await supabase.from("players").select("name");
  if (exErr) return { ok: false, error: exErr.message };

  const key = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
  const taken = new Set((existing ?? []).map((p) => key(p.name)));

  const fresh: string[] = [];
  let skipped = 0;
  for (const raw of names) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (taken.has(key(trimmed))) {
      skipped++;
      continue;
    }
    taken.add(key(trimmed));
    fresh.push(trimmed);
  }

  if (fresh.length === 0) {
    return skipped > 0
      ? { ok: false, error: "كل الأسماء مسجّلة من قبل" }
      : { ok: false, error: "اكتب اسم واحد على الأقل" };
  }

  const { error } = await supabase.from("players").insert(fresh.map((name) => ({ name })));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/players");
  return { ok: true, data: { added: fresh.length, skipped } };
}

export async function removePlayer(id: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "ما تقدر تحذف لاعبين بعد سحب القرعة" };
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/players");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

/** The instant and manual draws refuse to run underneath a live ceremony. */
const LIVE_DRAW_BUSY = "فيه قرعة شغالة على الهواء. أنهها أو ألغها أول.";

/**
 * A database whose schema predates a round code — 'G' for the group stage, '3P'
 * for the third-place match — still carries the old `valid_round` check, and
 * the insert comes back as a bare Postgres constraint message that names
 * nothing the admin can act on. Swap it for the fix.
 */
const STALE_ROUND_CONSTRAINT =
  "قاعدة البيانات ما تقبل هذي الجولة — سكيمتها أقدم من الميزة. شغّل supabase/third-place-migration.sql بمحرر SQL في سوبابيس، وبعدها أعد المحاولة.";

function matchInsertError(
  error: { message?: string; details?: string | null } | null,
  fallback: string
): string {
  if (!error) return fallback;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("valid_round")) return STALE_ROUND_CONSTRAINT;
  return error.message ?? fallback;
}

/** Writes a freshly built bracket: the match rows, then their next-match links. */
async function insertBracket(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  draft: DraftMatch[]
): Promise<ActionResult> {
  // Insert placeholder rows first to get real ids, then patch next_match_id links.
  const insertPayload = draft.map((m) => ({
    round: m.round,
    bracket_slot: m.bracketSlot,
    player1_id: m.player1Id,
    player2_id: m.player2Id,
    outcome_type: m.outcomeType,
    winner_id: m.winnerId,
    games: [] as Game[],
  }));

  const { data: inserted, error: insErr } = await supabase.from("matches").insert(insertPayload).select("id");
  if (insErr || !inserted) return { ok: false, error: matchInsertError(insErr, "فشل إنشاء الشجرة") };

  const idAt = (i: number) => inserted[i].id;
  const updates = draft
    .map((m, i) =>
      m.nextIndex != null
        ? { id: idAt(i), next_match_id: idAt(m.nextIndex), next_match_slot: m.nextSlot }
        : null
    )
    .filter(Boolean) as { id: string; next_match_id: string; next_match_slot: number }[];

  for (const u of updates) {
    const { error } = await supabase
      .from("matches")
      .update({ next_match_id: u.next_match_id, next_match_slot: u.next_match_slot })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message };
  }

  // A tree deep enough to have semifinals gets a third-place match with it.
  if (draft.some((m) => m.round === "SF")) {
    const res = await insertThirdPlaceMatch(supabase);
    if (!res.ok) return res;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Writes the empty third-place fixture. Its two slots stay TBD until the
 * semifinals hand it their losers. */
async function insertThirdPlaceMatch(
  supabase: Awaited<ReturnType<typeof requireAdmin>>
): Promise<ActionResult> {
  const { error } = await supabase.from("matches").insert({
    round: "3P" as const,
    bracket_slot: 0,
    outcome_type: "pending" as const,
    games: [] as Game[],
  });
  if (error) return { ok: false, error: matchInsertError(error, "فشل إنشاء مباراة المركز الثالث") };
  return { ok: true, data: null };
}

/** Writes a freshly built bracket and flips the tournament into "drawn". */
async function persistDraft(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  draft: DraftMatch[]
): Promise<ActionResult> {
  const res = await insertBracket(supabase, draft);
  if (!res.ok) return res;

  await supabase.from("tournament_state").update({ drawn: true, format: "knockout" }).eq("id", 1);

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function runDraw(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn, draw_status").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };
  if (state?.draw_status === "live") return { ok: false, error: LIVE_DRAW_BUSY };

  const { data: players, error: pErr } = await supabase.from("players").select("id");
  if (pErr) return { ok: false, error: pErr.message };
  if (!players || players.length < 2) return { ok: false, error: "لازم لاعبين اثنين على الأقل" };

  return persistDraft(supabase, generateBracket(players.map((p) => p.id)));
}

/** Same as runDraw, but the admin decided every first-round pairing by hand. */
export async function runManualDraw(pairings: Pairing[]): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn, draw_status").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };
  if (state?.draw_status === "live") return { ok: false, error: LIVE_DRAW_BUSY };

  const { data: players, error: pErr } = await supabase.from("players").select("id");
  if (pErr) return { ok: false, error: pErr.message };
  if (!players || players.length < 2) return { ok: false, error: "لازم لاعبين اثنين على الأقل" };

  const check = validatePairings(pairings, players.map((p) => p.id));
  if (!check.valid) return { ok: false, error: check.error };

  return persistDraft(supabase, buildBracket(pairings));
}

export async function resetTournament(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  await supabase.from("matches").delete().neq("round", "__never__");
  await supabase.from("draw_slots").delete().gte("seat", 0);
  await supabase
    .from("tournament_state")
    .update({
      drawn: false,
      champion_id: null,
      draw_status: "idle",
      draw_size: null,
      format: "knockout",
      group_count: null,
      advance_per_group: null,
      group_tiebreaks: {},
    })
    .eq("id", 1);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Group stage — «دور المجموعات»
//
// The roster is dealt into groups that each play a full round robin. Ranking is
// wins, and points only break a tie. When every group has finished, the top
// `advance_per_group` of each one are seeded into a knockout tree — sixteen
// qualifiers walk into the round of 16, eight into the quarters, and so on.
// ---------------------------------------------------------------------------

/** Shared tail of both group draws: the roster, then the fixtures. */
async function readRosterForGroups(
  supabase: Awaited<ReturnType<typeof requireAdmin>>
): Promise<ActionResult<string[]>> {
  const { data: state } = await supabase.from("tournament_state").select("drawn, draw_status").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };
  if (state?.draw_status === "live") return { ok: false, error: LIVE_DRAW_BUSY };

  const { data: players, error } = await supabase.from("players").select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (players ?? []).map((p) => p.id) };
}

/** Writes the round-robin fixtures for a validated split and opens the stage. */
async function persistGroups(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  groups: string[][],
  advancePerGroup: number
): Promise<ActionResult> {
  const rows = groups.flatMap((members, groupNo) =>
    roundRobinPairs(members).map(([p1, p2]) => ({ groupNo, p1, p2 }))
  );
  if (rows.length === 0) return { ok: false, error: "ما طلعت أي مباراة من هذي القسمة" };

  const { error: insErr } = await supabase.from("matches").insert(
    rows.map((r, i) => ({
      round: "G" as const,
      group_no: r.groupNo,
      bracket_slot: i,
      player1_id: r.p1,
      player2_id: r.p2,
      outcome_type: "pending" as const,
      games: [] as Game[],
    }))
  );
  if (insErr) return { ok: false, error: matchInsertError(insErr, "فشل إنشاء مباريات المجموعات") };

  const { error: stateErr } = await supabase
    .from("tournament_state")
    .update({
      drawn: true,
      format: "groups",
      group_count: groups.length,
      advance_per_group: advancePerGroup,
      group_tiebreaks: {},
    })
    .eq("id", 1);
  if (stateErr) return { ok: false, error: stateErr.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Draws the roster into round-robin groups instead of a knockout tree. */
export async function runGroupDraw(
  groupCount: number,
  advancePerGroup: number
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const roster = await readRosterForGroups(supabase);
  if (!roster.ok) return roster;
  const ids = roster.data;

  if (!possibleGroupCounts(ids.length).includes(groupCount)) {
    return {
      ok: false,
      error: `ما ينفع ${groupCount} مجموعات لـ ${ids.length} لاعب. كل مجموعة لازم ${MIN_GROUP_SIZE} لاعبين على الأقل.`,
    };
  }

  const groups = distributeIntoGroups(ids, groupCount);
  const check = validateGroupSplit(groups, ids, advancePerGroup);
  if (!check.valid) return { ok: false, error: check.error };

  return persistGroups(supabase, groups, advancePerGroup);
}

/** Same as runGroupDraw, but the admin filled every group by hand. */
export async function runManualGroupDraw(
  groups: string[][],
  advancePerGroup: number
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const roster = await readRosterForGroups(supabase);
  if (!roster.ok) return roster;

  const check = validateGroupSplit(groups, roster.data, advancePerGroup);
  if (!check.valid) return { ok: false, error: check.error };

  return persistGroups(supabase, groups, advancePerGroup);
}

/**
 * Hand-picks who takes the qualifying places in one group, in order.
 *
 * Two players level on everything the table looks at usually settle it over a
 * decider on the table, and that game is nobody's business to record: it isn't
 * part of the round robin and its score would skew the standings it was played
 * to break. So the admin writes down the outcome instead of the game — this is
 * where that goes. Passing an empty `order` tears the pin up and hands the
 * group back to its results.
 *
 * The pin only holds the qualifying places; whoever isn't in it keeps the
 * ranking the results gave them.
 */
export async function setGroupTiebreak(groupNo: number, order: string[]): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase
    .from("tournament_state")
    .select("drawn, format, advance_per_group, group_tiebreaks")
    .single();
  if (!state?.drawn || state.format !== "groups") return { ok: false, error: "ما به دور مجموعات" };

  const { data: matches, error: mErr } = await supabase.from("matches").select("*").neq("round", "judge");
  if (mErr) return { ok: false, error: mErr.message };

  const all = (matches ?? []) as Match[];
  if (all.some((m) => m.round !== "G")) {
    return { ok: false, error: "الأدوار الإقصائية انبنت، ما ينفع تغيّر المتأهلين الحين" };
  }

  const group = groupsFromMatches(all).find((g) => g.groupNo === groupNo);
  if (!group) return { ok: false, error: "ما به مجموعة بهذا الرقم" };

  const places = Math.min(state.advance_per_group ?? 2, group.members.length);
  const current = (state.group_tiebreaks ?? {}) as GroupTiebreaks;
  const next: GroupTiebreaks = { ...current };

  if (order.length === 0) {
    delete next[String(groupNo)];
  } else {
    if (order.length !== places) {
      return { ok: false, error: `لازم تختار ${places} متأهلين بالضبط من المجموعة` };
    }
    if (new Set(order).size !== order.length) {
      return { ok: false, error: "فيه لاعب مختار مرتين" };
    }
    if (order.some((id) => !group.members.includes(id))) {
      return { ok: false, error: "فيه لاعب مو من هذي المجموعة" };
    }
    next[String(groupNo)] = order;
  }

  const { error } = await supabase
    .from("tournament_state")
    .update({ group_tiebreaks: next })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Closes the group stage and builds the knockout tree from the qualifiers.
 * Refuses while any group match is still open — a half-finished table would
 * seed the wrong people, and the tree can't be redrawn once it exists.
 */
export async function buildKnockoutFromGroups(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase
    .from("tournament_state")
    .select("drawn, format, advance_per_group, group_tiebreaks")
    .single();
  if (!state?.drawn || state.format !== "groups") return { ok: false, error: "ما به دور مجموعات" };

  const { data: matches, error: mErr } = await supabase.from("matches").select("*").neq("round", "judge");
  if (mErr) return { ok: false, error: mErr.message };

  const all = (matches ?? []) as Match[];
  if (all.some((m) => m.round !== "G")) {
    return { ok: false, error: "الأدوار الإقصائية انبنت من قبل" };
  }

  const groups = groupsFromMatches(all, (state.group_tiebreaks ?? {}) as GroupTiebreaks);
  if (groups.length === 0) return { ok: false, error: "ما به مباريات مجموعات" };

  const pending = groups.reduce((sum, g) => sum + (g.total - g.played), 0);
  if (pending > 0) return { ok: false, error: `باقي ${pending} مباراة بدور المجموعات` };

  const advance = state.advance_per_group ?? 2;
  const qualifiers = groups.map((g) => g.standings.slice(0, advance).map((s) => s.playerId));
  const total = qualifiers.reduce((sum, q) => sum + q.length, 0);
  if (total < 2) return { ok: false, error: "لازم متأهلين اثنين على الأقل" };

  return insertBracket(supabase, buildBracket(knockoutPairingsFromQualifiers(qualifiers)));
}

// ---------------------------------------------------------------------------
// Live draw — «القرعة على الهواء»
//
// The draw happens in the room with paper slips. These actions only publish it
// seat by seat so the crowd can follow along; no pairing is decided here. The
// real bracket is built once, from the finished board, by finishLiveDraw.
// ---------------------------------------------------------------------------

export async function startLiveDraw(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };

  const { data: players, error: pErr } = await supabase.from("players").select("id");
  if (pErr) return { ok: false, error: pErr.message };
  if (!players || players.length < 2) return { ok: false, error: "لازم لاعبين اثنين على الأقل" };

  // A fresh board every time the ceremony opens.
  await supabase.from("draw_slots").delete().gte("seat", 0);
  const { error } = await supabase
    .from("tournament_state")
    .update({ draw_status: "live", draw_size: drawSeatCount(players.length) })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Puts one player into one seat, or empties it with a null player. Placing an
 * already-placed player swaps the two seats, the same forgiving behaviour the
 * manual arrangement panel has — the admin is typing this while a room waits.
 */
export async function setDrawSlot(seat: number, playerId: string | null): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase
    .from("tournament_state")
    .select("drawn, draw_status, draw_size")
    .single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل" };
  if (state?.draw_status !== "live") return { ok: false, error: "ابدأ القرعة أول" };

  const size = state.draw_size ?? 0;
  if (!Number.isInteger(seat) || seat < 0 || seat >= size) return { ok: false, error: "خانة مو موجودة" };

  const { data: rows, error: readErr } = await supabase.from("draw_slots").select("*");
  if (readErr) return { ok: false, error: readErr.message };
  const board = rows ?? [];
  const occupant = board.find((r) => r.seat === seat) ?? null;

  if (playerId == null) {
    if (occupant) {
      const { error } = await supabase.from("draw_slots").delete().eq("seat", seat);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  }

  const existing = board.find((r) => r.player_id === playerId) ?? null;
  if (existing?.seat === seat) return { ok: true, data: null };

  const { data: player } = await supabase.from("players").select("id").eq("id", playerId).maybeSingle();
  if (!player) return { ok: false, error: "اللاعب مو مسجّل بالقائمة" };

  // player_id is unique, so both affected seats are cleared before either is
  // rewritten — otherwise the new row collides with the player's old one.
  const clearing = existing ? [seat, existing.seat] : [seat];
  const { error: delErr } = await supabase.from("draw_slots").delete().in("seat", clearing);
  if (delErr) return { ok: false, error: delErr.message };

  const inserts = [{ seat, player_id: playerId }];
  // Dropping a placed player onto an occupied seat trades their places.
  if (existing && occupant) inserts.push({ seat: existing.seat, player_id: occupant.player_id });

  const { error: insErr } = await supabase.from("draw_slots").insert(inserts);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Abandons the ceremony and wipes the board. The roster is untouched. */
export async function cancelLiveDraw(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت، ما ينفع تلغيها" };

  await supabase.from("draw_slots").delete().gte("seat", 0);
  const { error } = await supabase
    .from("tournament_state")
    .update({ draw_status: "idle", draw_size: null })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Turns the finished board into the real bracket. */
export async function finishLiveDraw(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase
    .from("tournament_state")
    .select("drawn, draw_status, draw_size")
    .single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل" };
  if (state?.draw_status !== "live") return { ok: false, error: "ما به قرعة شغالة" };
  const size = state.draw_size ?? 0;

  const [{ data: players, error: pErr }, { data: slots, error: sErr }] = await Promise.all([
    supabase.from("players").select("id"),
    supabase.from("draw_slots").select("*"),
  ]);
  if (pErr) return { ok: false, error: pErr.message };
  if (sErr) return { ok: false, error: sErr.message };
  if (!players || players.length < 2) return { ok: false, error: "لازم لاعبين اثنين على الأقل" };

  // The grid was sized when the ceremony opened; a roster change since then
  // means it no longer fits, and silently resizing it would move people around.
  if (size !== drawSeatCount(players.length)) {
    return { ok: false, error: "عدد اللاعبين تغيّر بعد ما بدأت القرعة. ألغِ القرعة وابدأها من جديد." };
  }

  const pairings = seatsToPairings(seatArray(slots ?? [], size));
  const check = validatePairings(pairings, players.map((p) => p.id));
  if (!check.valid) return { ok: false, error: check.error };

  // Claiming the status first is the lock: a second click lands on a status
  // that is no longer 'live' and bails out instead of building a second tree.
  const { error: lockErr } = await supabase
    .from("tournament_state")
    .update({ draw_status: "done" })
    .eq("id", 1)
    .eq("draw_status", "live");
  if (lockErr) return { ok: false, error: lockErr.message };

  const res = await persistDraft(supabase, buildBracket(pairings));
  if (!res.ok) {
    await supabase.from("tournament_state").update({ draw_status: "live" }).eq("id", 1);
    return res;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Scheduling / live flag
// ---------------------------------------------------------------------------

export async function setSchedule(matchId: string, scheduledAt: string | null): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("matches").update({ scheduled_at: scheduledAt }).eq("id", matchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function setLive(matchId: string, isLive: boolean): Promise<ActionResult> {
  const supabase = await requireAdmin();
  if (isLive) {
    // Only one match live at a time on the homepage.
    await supabase.from("matches").update({ is_live: false }).eq("is_live", true);
  }
  const { error } = await supabase.from("matches").update({ is_live: isLive }).eq("id", matchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Manual player placement
// ---------------------------------------------------------------------------

/**
 * Hand-places players into a match's two slots. Only allowed while the match has
 * no result yet. A first-round match left with a single player becomes a bye and
 * advances that player; later rounds keep their empty slot as TBD because an
 * upstream match still owes them a winner.
 */
export async function setMatchPlayers(
  matchId: string,
  player1Id: string | null,
  player2Id: string | null
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: match, error: mErr } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (mErr || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };

  if ((match.games as Game[]).length > 0 || (match.outcome_type !== "pending" && match.outcome_type !== "bye")) {
    return { ok: false, error: "المباراة لها نتيجة، عدّل النتيجة أول" };
  }
  if (player1Id && player1Id === player2Id) {
    return { ok: false, error: "ما ينفع نفس اللاعب بالطرفين" };
  }

  // A player can only appear once per knockout round. The group stage is the
  // exception: a round robin is nothing but the same names over and over.
  if (match.round !== "G") {
    const { data: siblings } = await supabase
      .from("matches")
      .select("id, player1_id, player2_id")
      .eq("round", match.round)
      .neq("id", matchId);
    const clash = [player1Id, player2Id].find(
      (id) => id && siblings?.some((s) => s.player1_id === id || s.player2_id === id)
    );
    if (clash) return { ok: false, error: "اللاعب محطوط بمباراة ثانية بنفس الدور" };
  }

  // One player alone is a bye only when nothing can ever fill the other slot.
  // A group match has no feeders at all, but it is still a fixture, not a bye —
  // and neither is the third-place match, whose players arrive from the
  // semifinals by way of losing them, not through a next-match link.
  const lone = player1Id && !player2Id ? player1Id : !player1Id && player2Id ? player2Id : null;
  const canWalkThrough = match.round !== "G" && match.round !== "3P";
  const winnerId =
    canWalkThrough && lone && (await slotIsOrphaned(supabase, matchId, player1Id ? 2 : 1))
      ? lone
      : null;

  // Changing who advances would poison an already-played next match.
  if (winnerId !== match.winner_id && match.next_match_id) {
    const { data: next } = await supabase.from("matches").select("*").eq("id", match.next_match_id).single();
    if (next && ((next.games as Game[]).length > 0 || next.winner_id)) {
      return { ok: false, error: "المباراة اللي بعدها انلعبت، صفّر نتيجتها أول" };
    }
  }

  const { error: updErr } = await supabase
    .from("matches")
    .update({
      player1_id: player1Id,
      player2_id: player2Id,
      winner_id: winnerId,
      outcome_type: winnerId ? "bye" : "pending",
      outcome_reason: null,
    })
    .eq("id", matchId);
  if (updErr) return { ok: false, error: updErr.message };

  // Keep the downstream slot in sync (clears it when the bye is undone).
  if (winnerId !== match.winner_id) await propagateWinner(supabase, match as Match, winnerId);

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Score entry
// ---------------------------------------------------------------------------

/** True when nothing feeds `slot` of `matchId`, so that slot stays empty forever. */
async function slotIsOrphaned(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  matchId: string,
  slot: 1 | 2
): Promise<boolean> {
  const { data } = await supabase
    .from("matches")
    .select("id")
    .eq("next_match_id", matchId)
    .eq("next_match_slot", slot);
  return !data || data.length === 0;
}

/**
 * Re-seats the third-place match from the semifinals as they stand right now.
 *
 * Nothing feeds the bronze match by next_match_id — it is fed by who *lost*,
 * which the tree has no wiring for — so it is rebuilt from both semifinals
 * every time one of them changes. Reading the rows fresh keeps it idempotent:
 * a cleared semifinal empties the slot again, and a corrected one swaps the
 * name for the right loser.
 *
 * A semifinal nobody played (a walkthrough bye) has no loser, so that slot
 * stays empty. A bronze already played is only touched when the semifinals no
 * longer name the two people who played it — then it is voided along with them,
 * the same way a changed winner voids what was built on it downstream.
 */
async function seatThirdPlace(supabase: Awaited<ReturnType<typeof requireAdmin>>) {
  const { data: bronze } = await supabase.from("matches").select("*").eq("round", "3P").maybeSingle();
  if (!bronze) return;

  const { data: semis } = await supabase
    .from("matches")
    .select("*")
    .eq("round", "SF")
    .order("bracket_slot", { ascending: true });

  const loserOf = (m: Match | undefined): string | null => {
    if (!m || !m.winner_id || !m.player1_id || !m.player2_id) return null;
    if (m.outcome_type === "bye") return null;
    return m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
  };

  // The top half of the tree takes the top slot, so the bronze card reads the
  // same way round as the semifinals above it.
  const p1 = loserOf((semis ?? [])[0] as Match | undefined);
  const p2 = loserOf((semis ?? [])[1] as Match | undefined);
  if (p1 === bronze.player1_id && p2 === bronze.player2_id) return;

  const played = (bronze.games as Game[]).length > 0 || bronze.outcome_type !== "pending";

  await supabase
    .from("matches")
    .update({
      player1_id: p1,
      player2_id: p2,
      ...(played
        ? {
            games: [] as Game[],
            winner_id: null,
            outcome_type: "pending" as const,
            outcome_reason: null,
            is_live: false,
          }
        : {}),
    })
    .eq("id", bronze.id);
}

async function propagateWinner(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  match: Match,
  winnerId: string | null
) {
  // Every path that settles or unsettles a semifinal comes through here, so
  // this is where the beaten semifinalist is handed to the bronze match.
  if (match.round === "SF") await seatThirdPlace(supabase);
  if (!match.next_match_id || !match.next_match_slot) return;
  const field = match.next_match_slot === 1 ? "player1_id" : "player2_id";
  await supabase.from("matches").update({ [field]: winnerId }).eq("id", match.next_match_id);
  await resolveWalkthrough(supabase, match.next_match_id);
}

/**
 * A match holding one player whose opposite slot has no feeder can never be
 * played, so that player walks through to the next round. Cascades, since the
 * walkthrough may orphan the match after it too.
 */
async function resolveWalkthrough(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  matchId: string
) {
  const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!m) return;
  // Never touch a match that has been played or ruled on.
  if ((m.games as Game[]).length > 0) return;
  if (m.outcome_type !== "pending" && m.outcome_type !== "bye") return;

  const lone = m.player1_id && !m.player2_id ? m.player1_id : !m.player1_id && m.player2_id ? m.player2_id : null;
  const walksThrough = lone != null && (await slotIsOrphaned(supabase, matchId, m.player1_id ? 2 : 1));
  const winnerId = walksThrough ? lone : null;
  if (winnerId === m.winner_id) return;

  await supabase
    .from("matches")
    .update({ winner_id: winnerId, outcome_type: winnerId ? "bye" : "pending" })
    .eq("id", matchId);
  await propagateWinner(supabase, m as Match, winnerId);
}

/** Records one game's score for a match, appending to its games array. */
export async function recordGameResult(
  matchId: string,
  score1: number,
  score2: number,
  deciderScore1?: number,
  deciderScore2?: number
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: match, error: mErr } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (mErr || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };

  // A decided match takes no more games. The admin row already hides the button,
  // but two tabs — or a second submit that beat the first one's refresh — would
  // otherwise append a game the match never had room for. In the group stage
  // that is silent damage: one game decides the match, so a stray second game
  // still leaves the right winner standing while both scores land in the
  // standings, and a 11-5 win that was worth 2 collapses to 1. Corrections go
  // through عدّل, and a result typed against the wrong match through امسح النتيجة.
  if (match.winner_id || match.outcome_type !== "pending") {
    return { ok: false, error: "المباراة لها نتيجة، عدّلها أو امسحها أول" };
  }

  const outcome = validateGameScore(score1, score2);
  if (!outcome.valid) return { ok: false, error: outcome.error };

  const game: Game = { score1, score2 };
  if (outcome.needsDecider) {
    if (deciderScore1 == null || deciderScore2 == null) {
      return { ok: false, error: "النتيجة 10-10, أدخل نتيجة الديسايدر" };
    }
    const dec = validateDeciderScore(deciderScore1, deciderScore2);
    if (!dec.valid) return { ok: false, error: dec.error };
    game.decider_score1 = deciderScore1;
    game.decider_score2 = deciderScore2;
  }

  const games = [...(match.games as Game[]), game];
  const doublePoint = validateDoublePointUse(games);
  if (!doublePoint.valid) return { ok: false, error: doublePoint.error };

  const winner = seriesWinner(match.round as Round, games);
  const winnerId = winner === 1 ? match.player1_id : winner === 2 ? match.player2_id : null;

  const { error: updErr } = await supabase
    .from("matches")
    .update({
      games,
      winner_id: winnerId,
      outcome_type: winnerId ? "score" : "pending",
      is_live: winnerId ? false : match.is_live,
    })
    .eq("id", matchId);
  if (updErr) return { ok: false, error: updErr.message };

  if (winnerId) {
    await propagateWinner(supabase, match as Match, winnerId);
    if (match.round === "F") {
      await supabase.from("tournament_state").update({ champion_id: winnerId }).eq("id", 1);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function recordWalkover(
  matchId: string,
  absentOrWithdrewPlayerId: string,
  type: "absent" | "withdrew",
  reason: string
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: match, error: mErr } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (mErr || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };
  if (!match.player1_id || !match.player2_id) return { ok: false, error: "لازم اللاعبين معروفين أول" };
  // Same rule as scoring: a match that has been played or already ruled on is
  // not a walkover, and calling one would leave its games behind unread.
  if (match.winner_id || match.outcome_type !== "pending") {
    return { ok: false, error: "المباراة لها نتيجة، عدّلها أو امسحها أول" };
  }

  const winnerId = match.player1_id === absentOrWithdrewPlayerId ? match.player2_id : match.player1_id;

  const { error } = await supabase
    .from("matches")
    .update({ winner_id: winnerId, outcome_type: type, outcome_reason: reason, is_live: false })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  await propagateWinner(supabase, match as Match, winnerId!);
  if (match.round === "F") {
    await supabase.from("tournament_state").update({ champion_id: winnerId }).eq("id", 1);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Edit result, smart recompute
// ---------------------------------------------------------------------------

/** Walks the next_match chain from `matchId` collecting every match that
 * currently depends on its winner, so the UI can warn before voiding them.
 * A null `newWinnerId` asks the same question for wiping the result entirely. */
export async function previewEditImpact(matchId: string, newWinnerId: string | null): Promise<
  ActionResult<{ sameWinner: boolean; affected: { id: string; round: string }[] }>
> {
  const supabase = await requireAdmin();
  const { data: match, error } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (error || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };

  const sameWinner = match.winner_id === newWinnerId;
  if (sameWinner) return { ok: true, data: { sameWinner: true, affected: [] } };

  const affected: { id: string; round: string }[] = [];
  let cursor = match.next_match_id;
  while (cursor) {
    const { data: next } = await supabase.from("matches").select("*").eq("id", cursor).single();
    if (!next) break;
    if (next.winner_id || (next.games as Game[]).length > 0 || next.outcome_type !== "pending") {
      affected.push({ id: next.id, round: next.round });
    }
    cursor = next.next_match_id;
  }

  // The third-place match isn't on that chain, but it is built on this
  // semifinal's loser, so a different winner here voids it just the same.
  if (match.round === "SF") {
    const { data: bronze } = await supabase.from("matches").select("*").eq("round", "3P").maybeSingle();
    if (bronze && (bronze.winner_id || (bronze.games as Game[]).length > 0)) {
      affected.push({ id: bronze.id, round: bronze.round });
    }
  }

  return { ok: true, data: { sameWinner: false, affected } };
}

/**
 * Voids every match down the chain from `match`, because its winner is no
 * longer the one those matches were played on. The match immediately after it
 * keeps whatever propagateWinner just seated there; deeper rounds only ever
 * held the old winner by way of that first match, so their slot goes back to
 * TBD. A voided final also un-crowns the champion.
 */
async function voidDownstream(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  match: Match,
  oldWinnerId: string | null
) {
  let cursor = match.next_match_id;
  let firstHop = true;
  while (cursor) {
    const { data: next } = await supabase.from("matches").select("*").eq("id", cursor).single();
    if (!next) break;
    const nextCursor = next.next_match_id;
    const keepSlot = (id: string | null) => (firstHop || !oldWinnerId || id !== oldWinnerId ? id : null);

    await supabase
      .from("matches")
      .update({
        games: [],
        winner_id: null,
        outcome_type: "pending",
        outcome_reason: null,
        is_live: false,
        player1_id: keepSlot(next.player1_id),
        player2_id: keepSlot(next.player2_id),
      })
      .eq("id", next.id);

    if (next.round === "F") {
      await supabase.from("tournament_state").update({ champion_id: null }).eq("id", 1);
    }
    // A voided semifinal takes its loser back out of the third-place match.
    if (next.round === "SF") await seatThirdPlace(supabase);

    cursor = nextCursor;
    firstHop = false;
  }
}

/** Applies an edited result. If the winner changed, voids every downstream
 * match that depended on the old winner (never silently, call previewEditImpact first). */
export async function editResult(
  matchId: string,
  games: Game[],
  winnerId: string | null
): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: match, error } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (error || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };

  // A correction goes through the same rulebook as the original entry.
  for (const g of games) {
    const outcome = validateGameScore(g.score1, g.score2);
    if (!outcome.valid) return { ok: false, error: outcome.error };
    if (outcome.needsDecider) {
      if (g.decider_score1 == null || g.decider_score2 == null) {
        return { ok: false, error: "النتيجة 10-10, أدخل نتيجة الديسايدر" };
      }
      const dec = validateDeciderScore(g.decider_score1, g.decider_score2);
      if (!dec.valid) return { ok: false, error: dec.error };
    }
  }
  const doublePoint = validateDoublePointUse(games);
  if (!doublePoint.valid) return { ok: false, error: doublePoint.error };

  const winnerChanged = match.winner_id !== winnerId;

  const { error: updErr } = await supabase
    .from("matches")
    .update({ games, winner_id: winnerId, outcome_type: winnerId ? "score" : "pending" })
    .eq("id", matchId);
  if (updErr) return { ok: false, error: updErr.message };

  // Re-seat the next round first — including with a null, when the edit left
  // the match undecided — so voidDownstream reads a slot that is already right.
  if (winnerId || winnerChanged) await propagateWinner(supabase, match as Match, winnerId);

  if (winnerChanged) {
    await voidDownstream(supabase, match as Match, match.winner_id);
    if (match.round === "F") {
      await supabase.from("tournament_state").update({ champion_id: winnerId }).eq("id", 1);
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/**
 * Wipes a match back to "not played yet" — the escape hatch for a score typed
 * against a match that never happened, a walkover called too early, or a first
 * game of a series that went in wrong. Everything the old winner went on
 * to reach is voided with it, so the admin sees the damage first via
 * previewEditImpact.
 */
export async function clearResult(matchId: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: match, error } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (error || !match) return { ok: false, error: "المباراة ما فيه لها وجود" };

  // A bye isn't a result anybody typed; it follows from who is placed in the
  // match, so it's undone by moving players, not by clearing a score.
  if (match.outcome_type === "bye") {
    return { ok: false, error: "الاستراحة تتغيّر من اللاعبين، مو من النتيجة" };
  }
  if ((match.games as Game[]).length === 0 && match.outcome_type === "pending") {
    return { ok: false, error: "ما فيه نتيجة تنمسح" };
  }

  const oldWinnerId = match.winner_id;

  const { error: updErr } = await supabase
    .from("matches")
    .update({
      games: [] as Game[],
      winner_id: null,
      outcome_type: "pending",
      outcome_reason: null,
      is_live: false,
    })
    .eq("id", matchId);
  if (updErr) return { ok: false, error: updErr.message };

  if (oldWinnerId) {
    // Pull the old winner back out of the next round, then void the rest.
    await propagateWinner(supabase, match as Match, null);
    await voidDownstream(supabase, match as Match, oldWinnerId);
  }
  if (match.round === "F") {
    await supabase.from("tournament_state").update({ champion_id: null }).eq("id", 1);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// «أفضل شمات» — spectator award, judged by the admin
// ---------------------------------------------------------------------------

/** Sets (or clears, with an empty name) the best-shamat award. */
export async function setBestShamat(name: string, quote: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanQuote = quote.trim().replace(/\s+/g, " ");
  if (cleanName.length > 60) return { ok: false, error: "الاسم طويل، خلّه أقصر" };
  if (cleanQuote.length > 200) return { ok: false, error: "الشماتة طويلة، اختصرها" };
  if (!cleanName && cleanQuote) return { ok: false, error: "اكتب اسم الشامت" };

  const { error } = await supabase
    .from("tournament_state")
    .update({
      best_shamat_name: cleanName || null,
      best_shamat_quote: cleanName ? cleanQuote || null : null,
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Statements — quotes scrolled across the hall of fame page
// ---------------------------------------------------------------------------

export async function addStatement(name: string, quote: string, playerId?: string | null): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanQuote = quote.trim().replace(/\s+/g, " ");
  if (!cleanName) return { ok: false, error: "اكتب اسم صاحب التصريح" };
  if (!cleanQuote) return { ok: false, error: "اكتب التصريح" };
  if (cleanName.length > 60) return { ok: false, error: "الاسم طويل، خلّه أقصر" };
  if (cleanQuote.length > 200) return { ok: false, error: "التصريح طويل، اختصره" };

  const { error } = await supabase
    .from("statements")
    .insert({ name: cleanName, quote: cleanQuote, player_id: playerId || null });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function removeStatement(id: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Third-place match — «مباراة المركز الثالث»
// ---------------------------------------------------------------------------

/**
 * Adds the third-place match to a tree that was drawn before it existed. Every
 * new draw gets one with the tree, so this is only ever the catch-up button;
 * it seats whichever semifinal losers are already known.
 */
export async function createThirdPlaceMatch(): Promise<ActionResult> {
  const supabase = await requireAdmin();

  const { data: existing } = await supabase.from("matches").select("id").eq("round", "3P").maybeSingle();
  if (existing) return { ok: false, error: "مباراة المركز الثالث موجودة من قبل" };

  const { data: semis, error: sfErr } = await supabase.from("matches").select("id").eq("round", "SF");
  if (sfErr) return { ok: false, error: sfErr.message };
  if (!semis || semis.length === 0) return { ok: false, error: "ما به نصف نهائي، ما به مركز ثالث" };

  const res = await insertThirdPlaceMatch(supabase);
  if (!res.ok) return res;

  await seatThirdPlace(supabase);

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Judge match (bonus exhibition, outside the bracket)
// ---------------------------------------------------------------------------

export async function createJudgeMatch(championId: string, refereeName: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: existing } = await supabase.from("matches").select("id").eq("round", "judge").maybeSingle();
  if (existing) return { ok: false, error: "مباراة القاضي موجودة من قبل" };

  const name = refereeName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "اكتب اسم الحكم" };

  const { data: referee, error: refErr } = await supabase
    .from("players")
    .insert({ name })
    .select("id")
    .single();
  if (refErr || !referee) return { ok: false, error: refErr?.message ?? "فشل إنشاء القاضي" };

  const { error } = await supabase.from("matches").insert({
    round: "judge",
    bracket_slot: 0,
    player1_id: championId,
    player2_id: referee.id,
    outcome_type: "pending",
    games: [],
  });
  if (error) return { ok: false, error: matchInsertError(error, "فشل إنشاء مباراة الحكم") };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

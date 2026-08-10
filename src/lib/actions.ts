"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildBracket, generateBracket, validatePairings, type DraftMatch, type Pairing } from "@/lib/bracket";
import { gameWinCounts, gamesToWin, seriesWinner } from "@/lib/match";
import { validateDeciderScore, validateGameScore } from "@/lib/validation";
import type { Game, Match, Round } from "@/lib/supabase/types";

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

/** Writes a freshly built bracket and flips the tournament into "drawn". */
async function persistDraft(
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
  if (insErr || !inserted) return { ok: false, error: insErr?.message ?? "فشل إنشاء الشجرة" };

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

  await supabase.from("tournament_state").update({ drawn: true }).eq("id", 1);

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function runDraw(): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };

  const { data: players, error: pErr } = await supabase.from("players").select("id");
  if (pErr) return { ok: false, error: pErr.message };
  if (!players || players.length < 2) return { ok: false, error: "لازم لاعبين اثنين على الأقل" };

  return persistDraft(supabase, generateBracket(players.map((p) => p.id)));
}

/** Same as runDraw, but the admin decided every first-round pairing by hand. */
export async function runManualDraw(pairings: Pairing[]): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const { data: state } = await supabase.from("tournament_state").select("drawn").single();
  if (state?.drawn) return { ok: false, error: "القرعة انسحبت من قبل. صفّر البطولة أول لو تبي تعيد." };

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
  await supabase.from("tournament_state").update({ drawn: false, champion_id: null }).eq("id", 1);
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

  // A player can only appear once per round.
  const { data: siblings } = await supabase
    .from("matches")
    .select("id, player1_id, player2_id")
    .eq("round", match.round)
    .neq("id", matchId);
  const clash = [player1Id, player2Id].find(
    (id) => id && siblings?.some((s) => s.player1_id === id || s.player2_id === id)
  );
  if (clash) return { ok: false, error: "اللاعب محطوط بمباراة ثانية بنفس الدور" };

  // One player alone is a bye only when nothing can ever fill the other slot.
  const lone = player1Id && !player2Id ? player1Id : !player1Id && player2Id ? player2Id : null;
  const winnerId =
    lone && (await slotIsOrphaned(supabase, matchId, player1Id ? 2 : 1)) ? lone : null;

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

async function propagateWinner(
  supabase: Awaited<ReturnType<typeof requireAdmin>>,
  match: Match,
  winnerId: string | null
) {
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
 * currently depends on its winner, so the UI can warn before voiding them. */
export async function previewEditImpact(matchId: string, newWinnerId: string): Promise<
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

  return { ok: true, data: { sameWinner: false, affected } };
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

  const winnerChanged = match.winner_id !== winnerId;

  const { error: updErr } = await supabase
    .from("matches")
    .update({ games, winner_id: winnerId, outcome_type: winnerId ? "score" : "pending" })
    .eq("id", matchId);
  if (updErr) return { ok: false, error: updErr.message };

  if (winnerId) await propagateWinner(supabase, match as Match, winnerId);

  if (winnerChanged) {
    // Void every downstream match that depended on the previous result.
    let cursor = match.next_match_id;
    while (cursor) {
      const { data: next } = await supabase.from("matches").select("*").eq("id", cursor).single();
      if (!next) break;
      const nextCursor = next.next_match_id;
      await supabase
        .from("matches")
        .update({
          games: [],
          winner_id: null,
          outcome_type: "pending",
          outcome_reason: null,
          // Clear whichever slot the voided winner used to occupy so the
          // bracket shows TBD again instead of a stale name.
          player1_id: next.player1_id === match.winner_id ? (winnerId ?? null) : next.player1_id,
          player2_id: next.player2_id === match.winner_id ? (winnerId ?? null) : next.player2_id,
        })
        .eq("id", next.id);
      cursor = nextCursor;
    }
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

export async function addStatement(name: string, quote: string): Promise<ActionResult> {
  const supabase = await requireAdmin();
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanQuote = quote.trim().replace(/\s+/g, " ");
  if (!cleanName) return { ok: false, error: "اكتب اسم صاحب التصريح" };
  if (!cleanQuote) return { ok: false, error: "اكتب التصريح" };
  if (cleanName.length > 60) return { ok: false, error: "الاسم طويل، خلّه أقصر" };
  if (cleanQuote.length > 200) return { ok: false, error: "التصريح طويل، اختصره" };

  const { error } = await supabase.from("statements").insert({ name: cleanName, quote: cleanQuote });
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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

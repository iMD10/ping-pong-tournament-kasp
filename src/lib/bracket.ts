import type { Round } from "@/lib/supabase/types";

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Maps a round's distance-from-final into a round code.
 * distance 0 = final, 1 = semis, 2 = quarters, 3 = round of 16, 4+ = "R{size}".
 */
export function roundCodeForDistance(distance: number, matchesInRound: number): Round {
  if (distance === 0) return "F";
  if (distance === 1) return "SF";
  if (distance === 2) return "QF";
  if (distance === 3) return "R16";
  return "R1";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DraftMatch {
  round: Round;
  bracketSlot: number;
  player1Id: string | null;
  player2Id: string | null;
  outcomeType: "pending" | "bye";
  winnerId: string | null;
  /** index into the flat draft array of the match this one's winner feeds into */
  nextIndex: number | null;
  nextSlot: 1 | 2 | null;
}

/** One first-round pairing; a null slot means the other player gets a bye. */
export type Pairing = [string | null, string | null];

/**
 * Builds the full bracket tree (all rounds, TBD slots included) from explicit
 * first-round pairings. Returns a flat list of draft matches ready to be
 * inserted, each with a self-referential nextIndex the caller resolves to real
 * ids after insert.
 *
 * A pairing with nobody in it is not a match at all: it gets dropped, and the
 * next-round match it would have fed is left with a slot no one can ever fill,
 * so whoever holds the other side walks through.
 */
export function buildBracket(round1Slots: Pairing[]): DraftMatch[] {
  const numFirstRoundMatches = round1Slots.length;
  const totalRounds = Math.log2(numFirstRoundMatches * 2);

  // Build rounds as arrays-of-arrays of draft matches, then flatten with next-links.
  const rounds: DraftMatch[][] = [];

  const round1: DraftMatch[] = round1Slots.map(([p1, p2], slot) => {
    const isBye = p1 == null || p2 == null;
    return {
      round: roundCodeForDistance(totalRounds - 1, numFirstRoundMatches),
      bracketSlot: slot,
      player1Id: p1,
      player2Id: p2,
      outcomeType: isBye ? "bye" : "pending",
      winnerId: isBye ? p1 ?? p2 : null,
      nextIndex: null,
      nextSlot: null,
    };
  });
  rounds.push(round1);

  let prevCount = numFirstRoundMatches;
  for (let r = 1; r < totalRounds; r++) {
    const count = prevCount / 2;
    const distance = totalRounds - 1 - r;
    const roundMatches: DraftMatch[] = Array.from({ length: count }, (_, slot) => ({
      round: roundCodeForDistance(distance, count),
      bracketSlot: slot,
      player1Id: null,
      player2Id: null,
      outcomeType: "pending",
      winnerId: null,
      nextIndex: null,
      nextSlot: null,
    }));
    rounds.push(roundMatches);
    prevCount = count;
  }

  // Flatten and wire next-links (round r match i feeds round r+1 match floor(i/2), slot (i%2)+1).
  const flat: DraftMatch[] = [];
  const roundStartIndex: number[] = [];
  for (const round of rounds) {
    roundStartIndex.push(flat.length);
    flat.push(...round);
  }

  for (let r = 0; r < rounds.length - 1; r++) {
    const startThis = roundStartIndex[r];
    const startNext = roundStartIndex[r + 1];
    for (let i = 0; i < rounds[r].length; i++) {
      const match = flat[startThis + i];
      match.nextIndex = startNext + Math.floor(i / 2);
      match.nextSlot = (i % 2 === 0 ? 1 : 2) as 1 | 2;
    }
  }

  // Empty first-round pairings are dropped rather than inserted as ghost cards.
  const omitted = flat.map((m, i) => i < numFirstRoundMatches && m.player1Id == null && m.player2Id == null);
  const hasFeeder = (index: number, slot: 1 | 2) =>
    flat.some((m, i) => !omitted[i] && m.nextIndex === index && m.nextSlot === slot);

  // Single forward pass (flat is round-ordered): resolve walkthroughs, then push
  // each known winner into the slot it feeds, so the tree shows the advanced
  // player immediately instead of a TBD next to an empty bye card.
  for (let i = 0; i < flat.length; i++) {
    if (omitted[i]) continue;
    const m = flat[i];

    if (i >= numFirstRoundMatches) {
      const empty = m.player1Id == null && m.player2Id == null;
      if (empty && !hasFeeder(i, 1) && !hasFeeder(i, 2)) {
        // Every path into this match was dropped, so it is not a match either.
        omitted[i] = true;
        continue;
      }
      const present = m.player1Id ?? m.player2Id;
      const both = m.player1Id != null && m.player2Id != null;
      if (!both && present != null && !hasFeeder(i, m.player1Id == null ? 1 : 2)) {
        m.outcomeType = "bye";
        m.winnerId = present;
      }
    }

    if (m.winnerId && m.nextIndex != null) {
      const next = flat[m.nextIndex];
      if (m.nextSlot === 1) next.player1Id = m.winnerId;
      if (m.nextSlot === 2) next.player2Id = m.winnerId;
    }
  }

  // Drop the omitted matches and rewrite the surviving next-links onto the
  // compacted array.
  const remap = new Map<number, number>();
  const kept: DraftMatch[] = [];
  flat.forEach((m, i) => {
    if (omitted[i]) return;
    remap.set(i, kept.length);
    kept.push(m);
  });
  for (const m of kept) {
    m.nextIndex = m.nextIndex == null ? null : remap.get(m.nextIndex) ?? null;
    if (m.nextIndex == null) m.nextSlot = null;
  }

  return kept;
}

/** Spreads a roster into first-round pairings at random, byes placed randomly. */
export function randomPairings(playerIds: string[]): Pairing[] {
  const size = nextPowerOfTwo(playerIds.length);
  const byes = size - playerIds.length;
  const numFirstRoundMatches = size / 2;

  const shuffledPlayers = shuffle(playerIds);

  // Pick which first-round match slots get a bye (paired with null).
  const byeMatchIndices = new Set(
    shuffle(Array.from({ length: numFirstRoundMatches }, (_, i) => i)).slice(0, byes)
  );

  const pairings: Pairing[] = [];
  let cursor = 0;
  for (let i = 0; i < numFirstRoundMatches; i++) {
    if (byeMatchIndices.has(i)) {
      pairings.push([shuffledPlayers[cursor], null]);
      cursor += 1;
    } else {
      pairings.push([shuffledPlayers[cursor], shuffledPlayers[cursor + 1]]);
      cursor += 2;
    }
  }
  return pairings;
}

/** Builds a full bracket from a shuffled roster (the classic random draw). */
export function generateBracket(playerIds: string[]): DraftMatch[] {
  return buildBracket(randomPairings(playerIds));
}

/**
 * Checks that a hand-made set of pairings is a legal draw for `playerIds`:
 * right number of slots and every player placed exactly once. Pairings left
 * empty are fine, buildBracket drops them.
 */
export function validatePairings(
  pairings: Pairing[],
  playerIds: string[]
): { valid: true } | { valid: false; error: string } {
  const expected = nextPowerOfTwo(playerIds.length) / 2;
  if (pairings.length !== expected) {
    return { valid: false, error: `لازم ${expected} مباراة بالجولة الأولى` };
  }

  const roster = new Set(playerIds);
  const seen = new Set<string>();

  for (const [p1, p2] of pairings) {
    for (const id of [p1, p2]) {
      if (id == null) continue;
      if (!roster.has(id)) return { valid: false, error: "فيه لاعب مو مسجّل بالقائمة" };
      if (seen.has(id)) return { valid: false, error: "فيه لاعب محطوط بأكثر من مكان" };
      seen.add(id);
    }
  }

  if (seen.size !== playerIds.length) {
    return { valid: false, error: `باقي ${playerIds.length - seen.size} لاعب بدون مكان` };
  }
  return { valid: true };
}

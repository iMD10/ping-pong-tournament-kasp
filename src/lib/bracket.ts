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

/**
 * Builds the full bracket tree (all rounds, TBD slots included) from a shuffled
 * roster, with byes auto-placed in round 1 only. Returns a flat list of draft
 * matches ready to be inserted, each with a self-referential nextIndex the
 * caller resolves to real ids after insert.
 */
export function generateBracket(playerIds: string[]): DraftMatch[] {
  const size = nextPowerOfTwo(playerIds.length);
  const byes = size - playerIds.length;
  const numFirstRoundMatches = size / 2;
  const totalRounds = Math.log2(size);

  const shuffledPlayers = shuffle(playerIds);

  // Pick which first-round match slots get a bye (paired with null).
  const byeMatchIndices = new Set(
    shuffle(Array.from({ length: numFirstRoundMatches }, (_, i) => i)).slice(0, byes)
  );

  const round1Slots: (string | null)[][] = [];
  let cursor = 0;
  for (let i = 0; i < numFirstRoundMatches; i++) {
    if (byeMatchIndices.has(i)) {
      round1Slots.push([shuffledPlayers[cursor], null]);
      cursor += 1;
    } else {
      round1Slots.push([shuffledPlayers[cursor], shuffledPlayers[cursor + 1]]);
      cursor += 2;
    }
  }

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

  // Propagate round-1 bye winners into the slot they feed, so the tree shows
  // the advanced player immediately instead of a TBD next to an empty bye card.
  for (const m of flat) {
    if (m.winnerId && m.nextIndex != null) {
      const next = flat[m.nextIndex];
      if (m.nextSlot === 1) next.player1Id = m.winnerId;
      if (m.nextSlot === 2) next.player2Id = m.winnerId;
    }
  }

  return flat;
}

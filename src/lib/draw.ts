import { nextPowerOfTwo, roundCodeForDistance, type Pairing } from "@/lib/bracket";
import type { DrawSlot, Round } from "@/lib/supabase/types";

/** Seats the live draw needs for a roster of this size (a power of two). */
export function drawSeatCount(playerCount: number): number {
  return nextPowerOfTwo(playerCount);
}

/**
 * A match in the *preview* tree shown while the draw is on air.
 *
 * This is deliberately not a `DraftMatch`. `buildBracket` resolves byes and
 * drops empty pairings, which is exactly wrong mid-draw: at the first paper
 * every pairing is still empty, so it would drop the entire tree. The skeleton
 * keeps every node, holds no result, and exists only to be rendered — byes and
 * dropped matches are settled once, by `buildBracket`, when the draw is
 * confirmed.
 */
export interface SkeletonMatch {
  /** Stable across re-renders: `${roundIndex}-${bracketSlot}`. */
  key: string;
  round: Round;
  bracketSlot: number;
  /** Seat indices of the two sides. Only round one has them. */
  seats: [number, number] | null;
  /** Key of the match this one feeds, null for the final. */
  nextKey: string | null;
}

/** The full tree for `size` seats, every node present and empty. */
export function buildSkeleton(size: number): SkeletonMatch[] {
  if (size < 2) return [];
  const totalRounds = Math.log2(size);
  const out: SkeletonMatch[] = [];

  let count = size / 2;
  for (let r = 0; r < totalRounds; r++) {
    const distance = totalRounds - 1 - r;
    for (let slot = 0; slot < count; slot++) {
      out.push({
        key: `${r}-${slot}`,
        round: roundCodeForDistance(distance, count),
        bracketSlot: slot,
        seats: r === 0 ? [slot * 2, slot * 2 + 1] : null,
        nextKey: distance === 0 ? null : `${r + 1}-${Math.floor(slot / 2)}`,
      });
    }
    count /= 2;
  }

  return out;
}

/** Rows from `draw_slots` as a dense seat array, empty seats null. */
export function seatArray(slots: DrawSlot[], size: number): (string | null)[] {
  const seats: (string | null)[] = Array.from({ length: size }, () => null);
  for (const s of slots) {
    if (s.seat >= 0 && s.seat < size) seats[s.seat] = s.player_id;
  }
  return seats;
}

/** Seat array chunked into first-round pairings for `buildBracket`. */
export function seatsToPairings(seats: (string | null)[]): Pairing[] {
  return Array.from({ length: Math.floor(seats.length / 2) }, (_, i) => [
    seats[i * 2],
    seats[i * 2 + 1],
  ]);
}

/** The next seat with nobody in it, or null when the board is full. */
export function nextEmptySeat(seats: (string | null)[]): number | null {
  const i = seats.indexOf(null);
  return i === -1 ? null : i;
}

"use client";

import { useState } from "react";
import { groupSizes, possibleGroupCounts } from "@/lib/groups";

export interface GroupSettings {
  /** Group counts this roster can actually be split into. */
  counts: number[];
  count: number;
  setCount: (count: number) => void;
  /** Players per group for the current count, biggest first. */
  sizes: number[];
  advanceOptions: number[];
  advance: number;
  setAdvance: (advance: number) => void;
  qualifiers: number;
  /** False when the roster is too small for a group stage at all. */
  possible: boolean;
}

/**
 * The two numbers behind every group draw, shared by the panel that draws it
 * and the panel that arranges it by hand.
 *
 * Both picks are held loosely: the roster can still change underneath, so each
 * one falls back to a fitting option the moment the chosen value stops making
 * sense, instead of stranding the admin on an impossible split.
 */
export function useGroupSettings(playerCount: number): GroupSettings {
  const [chosenCount, setCount] = useState(4);
  const [chosenAdvance, setAdvance] = useState(2);

  const counts = possibleGroupCounts(playerCount);
  const count = counts.includes(chosenCount)
    ? chosenCount
    : counts[Math.floor(counts.length / 2)] ?? 0;

  const sizes = count > 0 ? groupSizes(playerCount, count) : [];
  const smallest = sizes.length > 0 ? Math.min(...sizes) : 0;
  // At least one player in every group has to go home, so last place can never
  // qualify.
  const advanceOptions = Array.from({ length: Math.max(0, smallest - 1) }, (_, i) => i + 1);
  const advance = advanceOptions.includes(chosenAdvance) ? chosenAdvance : advanceOptions[0] ?? 1;
  const qualifiers = count * advance;

  return {
    counts,
    count,
    setCount,
    sizes,
    advanceOptions,
    advance,
    setAdvance,
    qualifiers,
    possible: counts.length > 0 && advanceOptions.length > 0 && qualifiers >= 2,
  };
}

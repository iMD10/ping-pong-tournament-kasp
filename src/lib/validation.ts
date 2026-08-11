// The rulebook, encoded. See SPEC.md §2.

import { ltr } from "@/lib/format";

export type GameOutcome =
  | { valid: false; error: string }
  | { valid: true; needsDecider: boolean; winner: 1 | 2 | null; mercy: boolean };

/** The score a game is played to. */
export const GAME_TARGET = 11;
/** The declared double point pays two, so a game can also end one past the
 * target — 12 — when the winner cashed it in from 10. */
export const MAX_GAME_SCORE = GAME_TARGET + 1;

/**
 * Validates a single game's main score against the rulebook.
 * Valid: 11-x (x between 0 and 10), 12-x (x between 0 and 9), or 10-10 (opens a
 * decider, no winner yet).
 *
 * Every game runs to 11. There is no early stop, so a shutout is 11-0 and
 * nothing shorter: with group tables ranked on points, ending a whitewash at
 * 7-0 would leave the winner behind someone who merely won 11-1.
 *
 * Each player declares one point per match in advance and is paid two for it,
 * which widens the finishing scores by exactly two cases. A player sitting on
 * 10 who cashes it in lands on 12, and one sitting on 9 against an opponent on
 * 10 jumps straight to 11-10 without the game ever reaching 10-10. 12-10 is not
 * among them: both players on 10 is 10-10, and the decider has already opened
 * by the time anyone could score again.
 */
export function validateGameScore(score1: number, score2: number): GameOutcome {
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, error: "النتيجة لازم تكون أرقام صحيحة" };
  }
  if (score1 < 0 || score2 < 0) {
    return { valid: false, error: "ما فيه نتيجة بالسالب" };
  }

  // 10-10 -> decider
  if (score1 === 10 && score2 === 10) {
    return { valid: true, needsDecider: true, winner: null, mercy: false };
  }

  // 11-x (x <= 10) or 12-x (x <= 9); a zero against either earns «ما لك كليجا».
  const cap = (winning: number) => (winning === MAX_GAME_SCORE ? 9 : 10);
  if (score1 >= GAME_TARGET && score1 <= MAX_GAME_SCORE && score2 >= 0 && score2 <= cap(score1)) {
    return { valid: true, needsDecider: false, winner: 1, mercy: score2 === 0 };
  }
  if (score2 >= GAME_TARGET && score2 <= MAX_GAME_SCORE && score1 >= 0 && score1 <= cap(score2)) {
    return { valid: true, needsDecider: false, winner: 2, mercy: score1 === 0 };
  }

  return {
    valid: false,
    // The typed pair is echoed in the order it was typed — this one is a
    // mirror of the input box, not a result to read winner-first.
    error: `نتيجة غير صحيحة (${ltr(`${score1}-${score2}`)}). المسموح: ${ltr("11-x")} (x من 0 إلى 10)، أو ${ltr(
      "12-x"
    )} (x من 0 إلى 9) إذا خلص الشوط بالنقطة المضاعفة، أو ${ltr("10-10")} لفتح الديسايدر.`,
  };
}

/**
 * The declared double point is one per player per match, not per game. Winning
 * it leaves no trace in the score unless it was the point that finished the
 * game, so the one thing the scores can prove is a player finishing two games
 * on 12 — that takes two double points, and nobody gets two.
 */
export function validateDoublePointUse(
  games: { score1: number; score2: number }[]
): { valid: true } | { valid: false; error: string } {
  const finishesOn12 = (side: 1 | 2) =>
    games.filter((g) => (side === 1 ? g.score1 : g.score2) === MAX_GAME_SCORE).length;
  if (finishesOn12(1) > 1 || finishesOn12(2) > 1) {
    return {
      valid: false,
      error: "النقطة المضاعفة وحدة لكل لاعب بالمباراة، ما ينفع نفس اللاعب يخلص شوطين بـ12.",
    };
  }
  return { valid: true };
}

export type DeciderOutcome =
  | { valid: false; error: string }
  | { valid: true; winner: 1 | 2 };

/**
 * Validates a decider score. Only reachable after the main game ends 10-10.
 * Starts at 0-0, first to lead by exactly 2 wins: 2-0, 3-1, 4-2, 5-3...
 */
export function validateDeciderScore(score1: number, score2: number): DeciderOutcome {
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, error: "النتيجة لازم تكون أرقام صحيحة" };
  }
  if (score1 < 0 || score2 < 0) {
    return { valid: false, error: "ما فيه نتيجة بالسالب" };
  }
  const diff = Math.abs(score1 - score2);
  const winnerScore = Math.max(score1, score2);
  if (diff !== 2 || winnerScore < 2) {
    return {
      valid: false,
      error: `نتيجة الديسايدر غير صحيحة (${ltr(`${score1}-${score2}`)}). لازم فرق نقطتين بالضبط، مثل ${ltr(
        "2-0"
      )} أو ${ltr("3-1")} أو ${ltr("4-2")}.`,
    };
  }
  return { valid: true, winner: score1 > score2 ? 1 : 2 };
}

/** A whitewash is a whitewash whether it finished on 11 or on the double point. */
export function isMalKKleeja(score1: number | null, score2: number | null): boolean {
  const shutout = (winning: number | null, losing: number | null) =>
    losing === 0 && winning != null && winning >= GAME_TARGET && winning <= MAX_GAME_SCORE;
  return shutout(score1, score2) || shutout(score2, score1);
}

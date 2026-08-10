// The rulebook, encoded. See SPEC.md §2.

export type GameOutcome =
  | { valid: false; error: string }
  | { valid: true; needsDecider: boolean; winner: 1 | 2 | null; mercy: boolean };

/**
 * Validates a single game's main score against the rulebook.
 * Valid: 11-x (x between 1 and 9), 7-0, or 10-10 (opens a decider, no winner yet).
 *
 * The 7-0 stop is MANDATORY, which makes every shutout above 7 impossible:
 * 8-0, 9-0, 10-0 and 11-0 are all rejected, because the game must have ended
 * the moment it reached 7-0.
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

  // 7-0, mandatory stop (either direction)
  if ((score1 === 7 && score2 === 0) || (score1 === 0 && score2 === 7)) {
    return { valid: true, needsDecider: false, winner: score1 === 7 ? 1 : 2, mercy: true };
  }

  // A shutout can never pass 7-0, so reject 8-0 … 11-0 with a rule-specific message.
  if ((score1 === 0 && score2 > 7) || (score2 === 0 && score1 > 7)) {
    return {
      valid: false,
      error: `نتيجة غير صحيحة (${score1}-${score2}). المباراة لازم توقف عند 7-0.`,
    };
  }

  // 11-x, 1 <= x <= 9
  if (score1 === 11 && score2 >= 1 && score2 <= 9) {
    return { valid: true, needsDecider: false, winner: 1, mercy: false };
  }
  if (score2 === 11 && score1 >= 1 && score1 <= 9) {
    return { valid: true, needsDecider: false, winner: 2, mercy: false };
  }

  return {
    valid: false,
    error: `نتيجة غير صحيحة (${score1}-${score2}). المسموح: 11-x (x من 1 إلى 9)، أو 7-0، أو 10-10 لفتح الديسايدر.`,
  };
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
      error: `نتيجة الديسايدر غير صحيحة (${score1}-${score2}). لازم فرق نقطتين بالضبط، مثل 2-0 أو 3-1 أو 4-2.`,
    };
  }
  return { valid: true, winner: score1 > score2 ? 1 : 2 };
}

export function isMalKKleeja(score1: number | null, score2: number | null): boolean {
  return (score1 === 7 && score2 === 0) || (score1 === 0 && score2 === 7);
}

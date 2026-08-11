import type { Game, Match, Round } from "@/lib/supabase/types";
import { isMalKKleeja } from "@/lib/validation";

/** How many games a round's series is played to. The knockout gets longer the
 * deeper it runs: the round of 16 and the quarterfinals are best of 3 (first to
 * 2), the semifinals best of 5 (first to 3), and the final best of 7 (first to
 * 4). A group match is a single game to 11, and the judge exhibition is a
 * one-off outside the tree. */
export function gamesToWin(round: Round): number {
  switch (round) {
    case "G":
    case "judge":
      return 1;
    case "SF":
      return 3;
    case "F":
      return 4;
    default:
      return 2;
  }
}

/** Winner of a single game (1 | 2 | null if still 10-10 with no decider recorded). */
export function gameWinner(game: Game): 1 | 2 | null {
  if (game.score1 === 10 && game.score2 === 10) {
    if (game.decider_score1 == null || game.decider_score2 == null) return null;
    return game.decider_score1 > game.decider_score2 ? 1 : 2;
  }
  return game.score1 > game.score2 ? 1 : 2;
}

/** Counts game-wins for player1/player2 across a match's games array. */
export function gameWinCounts(games: Game[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (const g of games) {
    const w = gameWinner(g);
    if (w === 1) p1++;
    else if (w === 2) p2++;
  }
  return { p1, p2 };
}

/** Whether the match series is decided by the games played so far. */
export function seriesWinner(round: Round, games: Game[]): 1 | 2 | null {
  const need = gamesToWin(round);
  const { p1, p2 } = gameWinCounts(games);
  if (p1 >= need) return 1;
  if (p2 >= need) return 2;
  return null;
}

/** Did «ما لك كليجا» fire anywhere in this match (any game won to zero)? */
export function matchHasMalKKleeja(match: Pick<Match, "games">): boolean {
  return match.games.some((g) => isMalKKleeja(g.score1, g.score2));
}

export function totalPointsFor(games: Game[], side: 1 | 2): number {
  return games.reduce((sum, g) => {
    if (g.score1 === 10 && g.score2 === 10 && g.decider_score1 != null) {
      return sum + (side === 1 ? g.score1 + (g.decider_score1 ?? 0) : g.score2 + (g.decider_score2 ?? 0));
    }
    return sum + (side === 1 ? g.score1 : g.score2);
  }, 0);
}

export const ROUND_LABELS_AR: Record<Round, string> = {
  G: "دور المجموعات",
  R1: "الجولة الأولى",
  R16: "دور الـ16",
  QF: "ربع النهائي",
  SF: "نصف النهائي",
  F: "النهائي",
  judge: "مباراة القاضي",
};

/** The series format spelled out, keyed by how many game wins it takes. */
export const SERIES_FORMAT_AR: Record<number, string> = {
  2: "أفضل من ثلاث، أول من يفوز بشوطين",
  3: "أفضل من خمس، أول من يفوز بثلاثة أشواط",
  4: "أفضل من سبع، أول من يفوز بأربعة أشواط",
};

export const ROUND_LABELS_EN: Record<Round, string> = {
  G: "Group stage",
  R1: "Round 1",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
  judge: "Judge Match",
};

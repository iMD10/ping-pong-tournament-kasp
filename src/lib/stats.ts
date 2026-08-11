import type { Match, Player, Round } from "@/lib/supabase/types";
import { totalPointsFor } from "@/lib/match";
import { isMalKKleeja } from "@/lib/validation";

export interface PlayerStats {
  playerId: string;
  /** Matches with a result, byes excluded — a bye is not a match anyone played. */
  played: number;
  wins: number;
  losses: number;
  /** Individual games, so points can be read per game instead of per tournament. */
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  eliminatedBy: string | null; // player id who knocked this player out (knockout rounds only)
  malKKleejaCount: number; // times this player lost a game 11-0
}

export function computeStats(players: Player[], matches: Match[]): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  for (const p of players) {
    stats.set(p.id, {
      playerId: p.id,
      played: 0,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      eliminatedBy: null,
      malKKleejaCount: 0,
    });
  }

  for (const m of matches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    if (m.round === "judge") continue;
    // A bye is a seat in the tree, not a match: it can't be a win anyone earned.
    if (m.outcome_type === "bye") continue;
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;

    const winnerStats = stats.get(m.winner_id);
    const loserStats = stats.get(loserId);
    if (winnerStats) {
      winnerStats.wins += 1;
      winnerStats.played += 1;
    }
    if (loserStats) {
      loserStats.losses += 1;
      loserStats.played += 1;
      // Losing a group match costs you nothing but the win column; only a
      // knockout defeat actually ends the run.
      if (m.round !== "G") loserStats.eliminatedBy = m.winner_id;
    }

    if (m.outcome_type === "score" && m.games.length > 0) {
      const p1Points = totalPointsFor(m.games, 1);
      const p2Points = totalPointsFor(m.games, 2);
      const s1 = stats.get(m.player1_id);
      const s2 = stats.get(m.player2_id);
      if (s1) {
        s1.gamesPlayed += m.games.length;
        s1.pointsFor += p1Points;
        s1.pointsAgainst += p2Points;
      }
      if (s2) {
        s2.gamesPlayed += m.games.length;
        s2.pointsFor += p2Points;
        s2.pointsAgainst += p1Points;
      }
      // Best-of-three means a player can be shut out twice in one match.
      const shutouts = m.games.filter((g) => isMalKKleeja(g.score1, g.score2)).length;
      if (shutouts > 0) {
        const loser = stats.get(loserId);
        if (loser) loser.malKKleejaCount += shutouts;
      }
    }
  }

  return stats;
}

export interface RankedStats extends PlayerStats {
  name: string;
  /** 1-based, shared by everyone level on wins, difference and points scored. */
  rank: number;
  pointDiff: number;
  /** 0–1; 0 for a player who hasn't played yet. */
  winRate: number;
  pointsPerGame: number;
}

/**
 * The whole field in one table, ranked the way a group table is: wins first,
 * point difference and then points scored only as tie-breaks. Anyone who
 * hasn't played sinks to the bottom instead of sitting tied for first.
 */
export function rankStats(players: Player[], matches: Match[]): RankedStats[] {
  const stats = computeStats(players, matches);
  const rows: RankedStats[] = players.map((p) => {
    const s = stats.get(p.id)!;
    return {
      ...s,
      name: p.name,
      pointDiff: s.pointsFor - s.pointsAgainst,
      winRate: s.played > 0 ? s.wins / s.played : 0,
      pointsPerGame: s.gamesPlayed > 0 ? s.pointsFor / s.gamesPlayed : 0,
      rank: 0,
    };
  });

  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.pointDiff - a.pointDiff ||
      b.pointsFor - a.pointsFor ||
      a.name.localeCompare(b.name)
  );

  // Players the table genuinely can't separate share a rank, so a two-way tie
  // for first doesn't render as a first and a second.
  rows.forEach((row, i) => {
    const above = rows[i - 1];
    const level =
      above &&
      above.wins === row.wins &&
      above.pointDiff === row.pointDiff &&
      above.pointsFor === row.pointsFor;
    row.rank = level ? above.rank : i + 1;
  });

  return rows;
}

/**
 * Total point margin across every game of a match. Reading only the last game
 * would hide two thirds of a best-of-three thrashing.
 */
export function matchMargin(m: Match): number {
  if (m.games.length === 0) return -1;
  return Math.abs(totalPointsFor(m.games, 1) - totalPointsFor(m.games, 2));
}

export interface TournamentSummary {
  matchesPlayed: number;
  matchesTotal: number;
  pointsScored: number;
  deciders: number;
  shutouts: number;
  absences: number;
}

/** The whole tournament in a handful of numbers, for the strip above the table. */
export function summarise(matches: Match[]): TournamentSummary {
  const real = matches.filter((m) => m.round !== "judge" && m.outcome_type !== "bye");
  const games = real.flatMap((m) => m.games);
  return {
    matchesPlayed: real.filter((m) => m.winner_id).length,
    matchesTotal: real.length,
    pointsScored: real.reduce((sum, m) => sum + totalPointsFor(m.games, 1) + totalPointsFor(m.games, 2), 0),
    deciders: games.filter((g) => g.score1 === 10 && g.score2 === 10 && g.decider_score1 != null).length,
    shutouts: games.filter((g) => isMalKKleeja(g.score1, g.score2)).length,
    absences: real.filter((m) => m.outcome_type === "absent" || m.outcome_type === "withdrew").length,
  };
}

/**
 * Everyone level at the top on a metric, so a shared record reads as shared
 * instead of the sort silently picking one of them.
 */
export function topTied<T>(items: T[], value: (x: T) => number): T[] {
  if (items.length === 0) return [];
  const best = Math.max(...items.map(value));
  if (!Number.isFinite(best)) return [];
  return items.filter((x) => value(x) === best);
}

/** How far into the tournament a round sits, for breaking ties on match records. */
export const ROUND_ORDER: Record<Round, number> = { judge: -1, G: 0, R1: 1, R16: 2, QF: 3, SF: 4, F: 5 };

/**
 * Everyone still level after a metric *and* a tie-break.
 *
 * Match records need this because the scoring rules cap them: a shutout is
 * 11-0 and every single-game round tops out there, so a plain maximum leaves
 * a dozen matches level and the array order — which is bracket order — picks
 * the winner. Breaking on the round means the same 11-0 counts for more in a
 * quarterfinal than in a group, and whatever is still tied after that is
 * genuinely tied.
 */
export function topTiedBy<T>(items: T[], value: (x: T) => number, tieBreak: (x: T) => number): T[] {
  if (items.length === 0) return [];
  let bestValue = -Infinity;
  let bestTieBreak = -Infinity;
  for (const x of items) {
    const v = value(x);
    const b = tieBreak(x);
    if (v > bestValue || (v === bestValue && b > bestTieBreak)) {
      bestValue = v;
      bestTieBreak = b;
    }
  }
  if (!Number.isFinite(bestValue)) return [];
  return items.filter((x) => value(x) === bestValue && tieBreak(x) === bestTieBreak);
}

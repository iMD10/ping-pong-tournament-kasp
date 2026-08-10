import type { Match, Player } from "@/lib/supabase/types";
import { totalPointsFor } from "@/lib/match";

export interface PlayerStats {
  playerId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  eliminatedBy: string | null; // player id who knocked this player out (knockout rounds only)
  malKKleejaCount: number; // times this player lost a match 7-0
}

export function computeStats(players: Player[], matches: Match[]): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();
  for (const p of players) {
    stats.set(p.id, {
      playerId: p.id,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      eliminatedBy: null,
      malKKleejaCount: 0,
    });
  }

  for (const m of matches) {
    if (!m.player1_id || !m.player2_id || !m.winner_id) continue;
    if (m.round === "judge") continue;
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id;

    const winnerStats = stats.get(m.winner_id);
    const loserStats = stats.get(loserId);
    if (winnerStats) winnerStats.wins += 1;
    if (loserStats) {
      loserStats.losses += 1;
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
        s1.pointsFor += p1Points;
        s1.pointsAgainst += p2Points;
      }
      if (s2) {
        s2.pointsFor += p2Points;
        s2.pointsAgainst += p1Points;
      }
      const mercyLoser = m.games.find((g) => (g.score1 === 7 && g.score2 === 0) || (g.score1 === 0 && g.score2 === 7));
      if (mercyLoser) {
        const loser = stats.get(loserId);
        if (loser) loser.malKKleejaCount += 1;
      }
    }
  }

  return stats;
}

import { getMatches, getPlayers, getState, playerName } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { PageShell } from "@/components/PageShell";
import { KleejaIcon } from "@/components/KleejaIcon";
import { getT } from "@/lib/i18n/server";
import type { Match } from "@/lib/supabase/types";
import type { ReactNode } from "react";

export const revalidate = 0;

function margin(m: Match): number {
  if (m.games.length === 0) return -1;
  const last = m.games[m.games.length - 1];
  if (last.score1 === 10 && last.score2 === 10 && last.decider_score1 != null) {
    return Math.abs((last.decider_score1 ?? 0) - (last.decider_score2 ?? 0));
  }
  return Math.abs(last.score1 - last.score2);
}

export default async function HallPage() {
  const [players, matches, state] = await Promise.all([getPlayers(), getMatches(), getState()]);
  const t = getT();
  const scored = matches.filter((m) => m.outcome_type === "score" && m.games.length > 0);
  const stats = computeStats(players, matches);

  const malKleeja = scored.filter((m) =>
    m.games.some((g) => (g.score1 === 7 && g.score2 === 0) || (g.score1 === 0 && g.score2 === 7))
  );
  const biggestBlowout = [...scored].sort((a, b) => margin(b) - margin(a))[0];
  const deciderSurvivor = [...stats.values()]
    .map((s) => ({
      id: s.playerId,
      count: matches.filter(
        (m) => m.winner_id === s.playerId && m.games.some((g) => g.score1 === 10 && g.score2 === 10)
      ).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const longestDecider = scored
    .flatMap((m) => m.games.filter((g) => g.decider_score1 != null))
    .sort((a, b) => Math.max(b.decider_score1!, b.decider_score2!) - Math.max(a.decider_score1!, a.decider_score2!))[0];
  const mostPoints = [...stats.values()].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  // Whichever round the tournament opened with — groups when there is a group
  // stage, round one when it's a straight knockout.
  const openingRound = matches.some((m) => m.round === "G") ? "G" : "R1";
  const fastestExit = [...scored]
    .filter((m) => m.round === openingRound)
    .sort((a, b) => margin(b) - margin(a))[0];
  const absentCount = matches.filter((m) => m.outcome_type === "absent").length;

  return (
    <PageShell title={t.hall.title} subtitle={t.hall.subtitle}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Award
          icon={<KleejaIcon className="h-6 w-6" />}
          title={t.hall.malKleeja}
          value={malKleeja.length > 0 ? `${malKleeja.length} ${t.hall.cases}` : t.hall.none}
          shame
        />
        <Award
          icon="💥"
          title={t.hall.blowout}
          value={biggestBlowout ? playerName(players, biggestBlowout.winner_id) : "-"}
          note={biggestBlowout ? `${t.hall.pointGap} ${margin(biggestBlowout)} ${t.hall.point}` : undefined}
        />
        <Award
          icon="🧊"
          title={t.hall.deciderSurvivor}
          value={deciderSurvivor && deciderSurvivor.count > 0 ? playerName(players, deciderSurvivor.id) : "-"}
          note={deciderSurvivor && deciderSurvivor.count > 0 ? `${deciderSurvivor.count} ${t.hall.times}` : undefined}
        />
        <Award
          icon="⏱️"
          title={t.hall.longestDecider}
          value={longestDecider ? `${longestDecider.decider_score1}-${longestDecider.decider_score2}` : "-"}
        />
        <Award
          icon="🎯"
          title={t.hall.mostPoints}
          value={mostPoints && mostPoints.pointsFor > 0 ? playerName(players, mostPoints.playerId) : "-"}
          note={mostPoints && mostPoints.pointsFor > 0 ? `${mostPoints.pointsFor} ${t.hall.point}` : undefined}
        />
        <Award
          icon="🚪"
          title={t.hall.fastestExit}
          value={
            fastestExit
              ? playerName(
                  players,
                  fastestExit.winner_id === fastestExit.player1_id ? fastestExit.player2_id : fastestExit.player1_id
                )
              : "-"
          }
          shame
        />
        <Award
          icon="👻"
          title={t.hall.absent}
          value={absentCount > 0 ? `${absentCount} ${t.hall.cases}` : t.hall.none}
          shame
        />
        <Award
          icon="😈"
          title={t.hall.bestShamat}
          value={state?.best_shamat_name || t.hall.none}
          // The shamat itself is a quote, so it gets quotation marks; the
          // fallback line is a description of the award and stays bare.
          note={
            state?.best_shamat_name && state.best_shamat_quote
              ? `«${state.best_shamat_quote}»`
              : t.hall.bestShamatNote
          }
        />
      </div>
    </PageShell>
  );
}

function Award({
  icon,
  title,
  value,
  note,
  shame = false,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  note?: string;
  shame?: boolean;
}) {
  return (
    <div className="liquid-glass-panel rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-fg/70">{title}</div>
          <div className={`mt-1.5 truncate text-lg font-medium ${shame ? "text-live" : "text-accent"}`}>{value}</div>
          {note && <div className="mt-0.5 text-xs text-fg/70">{note}</div>}
        </div>
      </div>
    </div>
  );
}

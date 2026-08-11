import Link from "next/link";
import { getMatches, getPlayers, getState, playerName } from "@/lib/data";
import { ROUND_ORDER, matchMargin, rankStats, summarise, topTied, topTiedBy } from "@/lib/stats";
import { PageShell } from "@/components/PageShell";
import { StatsTable, SummaryStrip } from "@/components/StatsTable";
import { KleejaIcon } from "@/components/KleejaIcon";
import { getT } from "@/lib/i18n/server";
import { isMalKKleeja } from "@/lib/validation";
import type { Match, Player } from "@/lib/supabase/types";
import type { ReactNode } from "react";

export const revalidate = 0;

/** The top of the leaderboard on the hall page; the rest lives on /players. */
const LEADERBOARD_ROWS = 5;

/** Two entries spelled out, the rest as a count — the card has one line for it. */
function shortList(labels: string[]): string {
  return labels.length > 2 ? `${labels.slice(0, 2).join(" · ")} +${labels.length - 2}` : labels.join(" · ");
}

/** Everyone level at the top, so a shared record reads as shared. */
function tiedNames(players: Player[], ids: (string | null)[]): string {
  return shortList(ids.map((id) => playerName(players, id)));
}

function loserOf(m: Match): string | null {
  if (!m.winner_id) return null;
  return m.winner_id === m.player1_id ? m.player2_id : m.player1_id;
}

export default async function HallPage() {
  const [players, matches, state] = await Promise.all([getPlayers(), getMatches(), getState()]);
  const t = getT();
  const scored = matches.filter((m) => m.outcome_type === "score" && m.games.length > 0);
  const ranked = rankStats(players, matches);
  const summary = summarise(matches);
  const anyResults = summary.matchesPlayed > 0;

  const malKleeja = scored.filter((m) => m.games.some((g) => isMalKKleeja(g.score1, g.score2)));
  const worstSufferers = topTied(
    ranked.filter((s) => s.malKKleejaCount > 0),
    (s) => s.malKKleejaCount
  );

  const blowouts = topTiedBy(scored, matchMargin, (m) => ROUND_ORDER[m.round]);
  const biggestBlowout = blowouts[0];

  const deciderCounts = ranked.map((s) => ({
    id: s.playerId,
    count: matches.filter(
      (m) => m.winner_id === s.playerId && m.games.some((g) => g.score1 === 10 && g.score2 === 10)
    ).length,
  }));
  const deciderSurvivors = topTied(
    deciderCounts.filter((d) => d.count > 0),
    (d) => d.count
  );

  // Keep each decider attached to its match, so the card can name the two
  // people who sat through it rather than showing a bare 12-10.
  const deciderGames = scored.flatMap((m) =>
    m.games.filter((g) => g.decider_score1 != null).map((g) => ({ match: m, game: g }))
  );
  const longestDeciders = topTiedBy(
    deciderGames,
    (d) => Math.max(d.game.decider_score1!, d.game.decider_score2!),
    (d) => ROUND_ORDER[d.match.round]
  );
  const longestDecider = longestDeciders[0];

  // Points per game, not points in total: the champion plays the most matches
  // by construction, so a running total only ever crowns whoever went furthest.
  // Two games minimum, until nobody has played two.
  const seasoned = ranked.filter((s) => s.gamesPlayed >= 2);
  const scorers = seasoned.length > 0 ? seasoned : ranked.filter((s) => s.gamesPlayed > 0);
  const machines = topTied(scorers, (s) => s.pointsPerGame);

  // Whichever round the tournament opened with — groups when there is a group
  // stage, round one when it's a straight knockout.
  // Every candidate is in the same round here, so the margin is the only key
  // and a shutout ties with every other shutout of the opening round.
  const openingRound = matches.some((m) => m.round === "G") ? "G" : "R1";
  const fastestExits = topTied(
    scored.filter((m) => m.round === openingRound),
    matchMargin
  );
  const fastestExit = fastestExits[0];

  return (
    <PageShell title={t.hall.title} subtitle={t.hall.subtitle}>
      {players.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-medium tracking-tight text-fg/90">{t.stats.glance}</h2>
          <SummaryStrip
            items={[
              { label: t.stats.matchesPlayed, value: `${summary.matchesPlayed}/${summary.matchesTotal}` },
              { label: t.stats.pointsScored, value: String(summary.pointsScored) },
              { label: t.stats.players, value: String(players.length) },
              { label: t.stats.deciders, value: String(summary.deciders) },
              { label: t.stats.shutouts, value: String(summary.shutouts) },
              { label: t.stats.absences, value: String(summary.absences) },
            ]}
          />

          <div className="mb-3 mt-8 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium tracking-tight text-fg/90">{t.stats.title}</h2>
            {ranked.length > LEADERBOARD_ROWS && (
              <Link href="/players" className="shrink-0 text-sm text-accent hover:underline">
                {t.stats.viewAll}
              </Link>
            )}
          </div>
          <StatsTable rows={ranked} t={t} limit={LEADERBOARD_ROWS} championId={state?.champion_id} />
          {!anyResults && <p className="mt-3 text-center text-xs text-fg/55">{t.stats.noResults}</p>}

          <h2 className="mb-3 mt-8 text-lg font-medium tracking-tight text-fg/90">{t.hall.awards}</h2>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Award
          icon={<KleejaIcon className="h-6 w-6" />}
          title={t.hall.malKleeja}
          hint={t.hall.hints.malKleeja}
          value={malKleeja.length > 0 ? `${malKleeja.length} ${t.hall.cases}` : t.hall.none}
          note={
            worstSufferers.length > 0
              ? `${tiedNames(players, worstSufferers.map((s) => s.playerId))} × ${worstSufferers[0].malKKleejaCount}`
              : undefined
          }
          shame
        />
        <Award
          icon="💥"
          title={t.hall.blowout}
          hint={t.hall.hints.blowout}
          value={biggestBlowout ? tiedNames(players, blowouts.map((m) => m.winner_id)) : "-"}
          // Naming the beaten player only works while there is one of them;
          // level records share the margin and the round, so those carry it.
          note={
            biggestBlowout
              ? [
                  blowouts.length === 1 ? `${t.hall.beat} ${playerName(players, loserOf(biggestBlowout))}` : null,
                  `${t.hall.pointGap} ${matchMargin(biggestBlowout)} ${t.hall.point}`,
                  t.rounds[biggestBlowout.round],
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
          href={blowouts.length === 1 && biggestBlowout.winner_id ? `/players/${biggestBlowout.winner_id}` : undefined}
        />
        <Award
          icon="🧊"
          title={t.hall.deciderSurvivor}
          hint={t.hall.hints.deciderSurvivor}
          value={deciderSurvivors.length > 0 ? tiedNames(players, deciderSurvivors.map((d) => d.id)) : "-"}
          note={deciderSurvivors.length > 0 ? `${deciderSurvivors[0].count} ${t.hall.times}` : undefined}
          href={deciderSurvivors.length === 1 ? `/players/${deciderSurvivors[0].id}` : undefined}
        />
        <Award
          icon="⏱️"
          title={t.hall.longestDecider}
          hint={t.hall.hints.longestDecider}
          value={
            longestDecider
              ? shortList(
                  longestDeciders.map(
                    (d) =>
                      `${playerName(players, d.match.player1_id)} ${t.match.vs} ${playerName(
                        players,
                        d.match.player2_id
                      )}`
                  )
                )
              : "-"
          }
          note={
            longestDecider
              ? `${t.match.decider} ${longestDecider.game.decider_score1}-${longestDecider.game.decider_score2} · ${
                  t.rounds[longestDecider.match.round]
                }`
              : undefined
          }
        />
        <Award
          icon="🎯"
          title={t.hall.mostPoints}
          hint={t.hall.hints.mostPoints}
          value={machines.length > 0 ? tiedNames(players, machines.map((s) => s.playerId)) : "-"}
          note={machines.length > 0 ? `${machines[0].pointsPerGame.toFixed(1)} ${t.hall.perGame}` : undefined}
          href={machines.length === 1 ? `/players/${machines[0].playerId}` : undefined}
        />
        <Award
          icon="🚪"
          title={t.hall.fastestExit}
          hint={t.hall.hints.fastestExit}
          value={fastestExit ? tiedNames(players, fastestExits.map(loserOf)) : "-"}
          note={
            fastestExit
              ? [
                  fastestExits.length === 1
                    ? `${t.players.eliminatedBy} ${playerName(players, fastestExit.winner_id)}`
                    : null,
                  `${t.hall.pointGap} ${matchMargin(fastestExit)} ${t.hall.point}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
          }
          href={fastestExits.length === 1 ? `/players/${loserOf(fastestExit)}` : undefined}
          shame
        />
        <Award
          icon="👻"
          title={t.hall.absent}
          hint={t.hall.hints.absent}
          value={summary.absences > 0 ? `${summary.absences} ${t.hall.cases}` : t.hall.none}
          shame
        />
        <Award
          icon="😈"
          title={t.hall.bestShamat}
          hint={t.hall.hints.bestShamat}
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
  hint,
  value,
  note,
  href,
  shame = false,
}: {
  icon: ReactNode;
  title: string;
  /** The rule the award was computed from, so the card explains itself. */
  hint: string;
  value: string;
  note?: string;
  /** Where the award points, when it names exactly one player. */
  href?: string;
  shame?: boolean;
}) {
  const body = (
    <div className="flex items-start gap-3">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-fg/70">{title}</div>
        <div className="mt-1 text-[11px] leading-snug text-fg/45">{hint}</div>
        <div className={`mt-2 truncate text-lg font-medium ${shame ? "text-live" : "text-accent"}`}>{value}</div>
        {note && <div className="mt-0.5 truncate text-xs text-fg/70">{note}</div>}
      </div>
    </div>
  );

  const shell = "liquid-glass-panel rounded-2xl px-4 py-4 sm:px-5 sm:py-5";
  return href ? (
    <Link href={href} className={`${shell} transition-colors hover:bg-fg/[0.06]`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

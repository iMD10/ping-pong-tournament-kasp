import { Check } from "lucide-react";
import type { Game, Match, Player } from "@/lib/supabase/types";
import { groupLabel } from "@/lib/groups";
import { matchHasMalKKleeja } from "@/lib/match";
import { playerName } from "@/lib/players";
import { formatMatchTime } from "@/lib/time";
import type { Dict } from "@/lib/i18n/dictionary";
import { KleejaIcon } from "@/components/KleejaIcon";

/** One player's number for each game, with the 10-10 decider kept alongside so
 * it can render as a superscript instead of a parenthetical that wraps. */
function sideScores(games: Game[], side: 1 | 2) {
  return games.map((g) => {
    const main = side === 1 ? g.score1 : g.score2;
    const decider =
      g.score1 === 10 && g.score2 === 10 && g.decider_score1 != null
        ? side === 1
          ? g.decider_score1
          : g.decider_score2
        : null;
    return { main, decider: decider ?? null };
  });
}

function PlayerRow({
  name,
  tbd,
  isWinner,
  hasPlayer,
  scores,
}: {
  name: string;
  tbd: string;
  isWinner: boolean;
  hasPlayer: boolean;
  scores: { main: number; decider: number | null }[];
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
          isWinner ? "bg-accent/20 text-accent" : "text-transparent"
        }`}
      >
        {isWinner && <Check size={11} strokeWidth={3} />}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm leading-7 ${
          !hasPlayer ? "text-fg/55" : isWinner ? "font-semibold text-fg" : "text-fg/70"
        }`}
      >
        {name || tbd}
      </span>
      {scores.length > 0 && (
        <span className="flex shrink-0 items-center gap-1.5">
          {scores.map((s, i) => (
            <span
              key={i}
              className={`min-w-[1.5rem] rounded-md px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${
                isWinner ? "bg-fg/10 font-semibold text-fg" : "bg-fg/5 text-fg/70"
              }`}
            >
              {s.main}
              {s.decider != null && <sup className="ms-0.5 text-[11px] opacity-70">{s.decider}</sup>}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  players,
  t,
  locale,
}: {
  match: Match;
  players: Player[];
  t: Dict;
  locale: string;
}) {
  const p1 = playerName(players, match.player1_id);
  const p2 = playerName(players, match.player2_id);
  const mercy = matchHasMalKKleeja(match);
  const finished = !!match.winner_id;

  return (
    <div className={`liquid-glass-panel w-full rounded-2xl p-4 sm:p-5 ${match.is_live ? "glass-live" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2 text-[12px] uppercase tracking-wide text-fg/70">
        {/* Arabic descenders (the ي dots) sit below a default line box and get
            shaved by truncate's overflow:hidden, hence the roomier leading. */}
        <span className="truncate leading-6">
          {t.rounds[match.round]}
          {match.round === "G" && match.group_no != null && ` · ${groupLabel(match.group_no)}`}
        </span>
        {match.is_live ? (
          <span className="flex shrink-0 items-center gap-1.5 font-semibold text-live">
            <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
            {t.match.live}
          </span>
        ) : (
          match.scheduled_at &&
          !finished && (
            <span className="shrink-0 tracking-normal">
              {formatMatchTime(match.scheduled_at, locale)}
            </span>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PlayerRow
          name={p1}
          tbd={t.match.tbd}
          hasPlayer={!!match.player1_id}
          isWinner={!!match.winner_id && match.winner_id === match.player1_id}
          scores={sideScores(match.games, 1)}
        />
        <PlayerRow
          name={p2}
          tbd={t.match.tbd}
          hasPlayer={!!match.player2_id}
          isWinner={!!match.winner_id && match.winner_id === match.player2_id}
          scores={sideScores(match.games, 2)}
        />
      </div>

      {(match.outcome_type === "absent" || match.outcome_type === "withdrew") && (
        <div className="mt-3 rounded-lg bg-live/10 px-2.5 py-1.5 text-center text-xs text-live">
          {match.outcome_type === "absent" ? t.match.absent : t.match.withdrew}
          {match.outcome_reason ? `, ${match.outcome_reason}` : ""}
        </div>
      )}
      {match.outcome_type === "bye" && (
        <div className="mt-3 text-center text-xs text-fg/70">{t.match.bye}</div>
      )}

      {mercy && (
        <div className="mt-3 flex justify-center">
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            {t.match.malKleeja} <KleejaIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </div>
  );
}

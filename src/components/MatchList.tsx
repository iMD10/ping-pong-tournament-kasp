"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Match, Player, Round } from "@/lib/supabase/types";
import { MatchCard } from "@/components/MatchCard";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import { isTournamentToday } from "@/lib/time";
import type { Dict } from "@/lib/i18n/dictionary";

type MatchStatus = "live" | "upcoming" | "finished";
// "today" cuts across the other three: a match on today's card can be any of
// them, so it filters on the schedule rather than on the match's state.
type StatusFilter = "all" | "today" | MatchStatus;

const ROUND_ORDER: Round[] = ["G", "R1", "R16", "QF", "SF", "F"];

/** The tournament whole, group matches included — the one view that answers
 * "when do I play" and "what was the score" without reading a tree. */
export function MatchList({
  matches: allMatches,
  players,
  t,
  locale,
}: {
  matches: Match[];
  players: Player[];
  t: Dict;
  locale: string;
}) {
  useLiveRefresh();

  const [tab, setTab] = useState<"all" | Round>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const roundsPresent = ROUND_ORDER.filter((r) => allMatches.some((m) => m.round === r));

  const classify = (m: Match): MatchStatus => {
    if (m.is_live) return "live";
    if (m.winner_id || m.outcome_type !== "pending") return "finished";
    return "upcoming";
  };

  // With both stages in one list, a raw slot number no longer orders anything:
  // group and knockout matches number themselves separately.
  const byBracketOrder = (a: Match, b: Match) =>
    ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) ||
    (a.group_no ?? 0) - (b.group_no ?? 0) ||
    a.bracket_slot - b.bracket_slot;

  const matchesStatus = (m: Match) => {
    if (status === "all") return true;
    if (status === "today") return isTournamentToday(m.scheduled_at);
    return classify(m) === status;
  };

  const filtered = allMatches
    .filter((m) => tab === "all" || m.round === tab)
    .filter(matchesStatus)
    .filter((m) => m.player1_id || m.player2_id || tab !== "all")
    .sort(byBracketOrder);

  const live = filtered.filter((m) => classify(m) === "live");
  const upcoming = filtered
    .filter((m) => classify(m) === "upcoming")
    .sort((a, b) => {
      if (a.scheduled_at && b.scheduled_at) return a.scheduled_at.localeCompare(b.scheduled_at);
      if (a.scheduled_at) return -1;
      if (b.scheduled_at) return 1;
      return byBracketOrder(a, b);
    });
  const finished = filtered
    .filter((m) => classify(m) === "finished")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  // Today's card reads best the same way the full feed does — what's on now,
  // then what's next, then what's already done.
  const grouped = tab === "all" && (status === "all" || status === "today");
  const feed = grouped ? [...live, ...upcoming, ...finished] : filtered;

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${
      on ? "bg-fg text-bg font-medium" : "liquid-glass text-fg/70 hover:text-fg"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="thin-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button onClick={() => setTab("all")} className={pill(tab === "all")}>
          {t.bracket.all}
        </button>
        {roundsPresent.map((r) => {
          const roundMatches = allMatches.filter((m) => m.round === r);
          const allDone = roundMatches.every((m) => classify(m) === "finished");
          return (
            <button
              key={r}
              onClick={() => setTab(r)}
              className={`${pill(tab === r)} inline-flex items-center gap-1.5`}
            >
              {/* The full "group stage" wording is too long for a pill. */}
              {r === "G" ? t.groups.tab : t.rounds[r]}
              {allDone && <Check size={13} strokeWidth={2.5} className="text-accent" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {(["all", "today", "live", "upcoming", "finished"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-2 text-xs transition-colors ${
              status === s ? "bg-fg/10 font-medium text-fg" : "text-fg/70 hover:text-fg"
            }`}
          >
            {t.bracket[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {feed.length === 0 && (
          <div className="liquid-glass-panel col-span-full rounded-2xl px-6 py-12 text-center text-sm text-fg/70">
            {status === "today" ? t.bracket.noneToday : t.bracket.nothingHere}
          </div>
        )}
        {feed.map((m) => (
          <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
        ))}
      </div>
    </div>
  );
}

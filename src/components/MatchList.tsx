"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { Match, Player, Round } from "@/lib/supabase/types";
import { MatchCard } from "@/components/MatchCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import { byKickoff, byMostRecent, matchStatus } from "@/lib/match";
import { isTournamentToday } from "@/lib/time";
import type { Dict } from "@/lib/i18n/dictionary";

// "today" cuts across the other three: a match on today's card can be any of
// them, so it filters on the schedule rather than on the match's state.
type StatusFilter = "all" | "today" | "live" | "upcoming" | "finished";

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

  // With both stages in one list, a raw slot number no longer orders anything:
  // group and knockout matches number themselves separately.
  const byBracketOrder = (a: Match, b: Match) =>
    ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round) ||
    (a.group_no ?? 0) - (b.group_no ?? 0) ||
    a.bracket_slot - b.bracket_slot;

  const matchesStatus = (m: Match) => {
    if (status === "all") return true;
    if (status === "today") return isTournamentToday(m.scheduled_at);
    return matchStatus(m) === status;
  };

  const filtered = allMatches
    .filter((m) => tab === "all" || m.round === tab)
    .filter(matchesStatus)
    .filter((m) => m.player1_id || m.player2_id || tab !== "all")
    .sort(byBracketOrder);

  const live = filtered.filter((m) => matchStatus(m) === "live");
  const upcoming = filtered.filter((m) => matchStatus(m) === "upcoming").sort(byKickoff(byBracketOrder));
  const finished = filtered.filter((m) => matchStatus(m) === "finished").sort(byMostRecent);

  // What's on now and what's next is the page; what already happened waits
  // behind a fold, the way a fixture list keeps its results. Asking for the
  // finished filter is asking for the results, so there they lead instead.
  const resultsLead = status === "finished";
  const current = resultsLead ? [] : [...live, ...upcoming];
  const emptyNote = status === "today" ? t.bracket.noneToday : t.bracket.nothingHere;

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${
      on ? "bg-fg text-bg font-medium" : "liquid-glass text-fg/70 hover:text-fg"
    }`;

  const cards = (list: Match[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((m) => (
        <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="thin-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button onClick={() => setTab("all")} className={pill(tab === "all")}>
          {t.bracket.all}
        </button>
        {roundsPresent.map((r) => {
          const roundMatches = allMatches.filter((m) => m.round === r);
          const allDone = roundMatches.every((m) => matchStatus(m) === "finished");
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

      {resultsLead ? (
        finished.length > 0 ? (
          cards(finished)
        ) : (
          <EmptyRow>{emptyNote}</EmptyRow>
        )
      ) : (
        <>
          {current.length > 0 ? (
            cards(current)
          ) : (
            <EmptyRow>{finished.length > 0 ? t.bracket.noneLeft : emptyNote}</EmptyRow>
          )}

          {finished.length > 0 && (
            <CollapsibleSection
              title={t.bracket.results}
              count={finished.length}
              // Nothing above it to read means the results are the page.
              defaultOpen={current.length === 0}
            >
              {cards(finished)}
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="liquid-glass-panel rounded-2xl px-6 py-12 text-center text-sm text-fg/70">
      {children}
    </div>
  );
}

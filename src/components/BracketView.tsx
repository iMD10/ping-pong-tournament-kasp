"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import type { GroupTiebreaks, Match, Player } from "@/lib/supabase/types";
import { groupsFromMatches, projectKnockout } from "@/lib/groups";
import { playerName } from "@/lib/players";
import { GroupTable } from "@/components/GroupTable";
import { MatchCard } from "@/components/MatchCard";
import { ProjectedBracket } from "@/components/ProjectedBracket";
import { TreeNode } from "@/components/TreeNode";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { Dict } from "@/lib/i18n/dictionary";

export function BracketView({
  matches: allMatches,
  players,
  advancePerGroup,
  tiebreaks,
  view,
  t,
  locale,
}: {
  matches: Match[];
  players: Player[];
  advancePerGroup: number;
  /** Qualifying places the admin settled by hand, where a group needed it. */
  tiebreaks: GroupTiebreaks | null;
  // Which stage view to draw. Owned by the URL on the page above, so the view
  // survives a share, a bookmark and the back button.
  view: "groups" | "tree";
  t: Dict;
  locale: string;
}) {
  useLiveRefresh();

  // The group stage and the tree are two different shapes of the same table, so
  // the tables and the tree each get their own view. Every match in one flat
  // feed, group matches included, is its own page at /matches.
  const groups = useMemo(() => groupsFromMatches(allMatches, tiebreaks), [allMatches, tiebreaks]);
  const knockout = useMemo(() => allMatches.filter((m) => m.round !== "G"), [allMatches]);
  const hasGroups = groups.length > 0;
  const knockoutStarted = knockout.length > 0;

  // Until the qualifiers are seeded the tree is empty, but its shape is already
  // decided — so draw it with the group places standing in for the players.
  const projected = useMemo(
    () => (knockoutStarted ? [] : projectKnockout(groups, advancePerGroup)),
    [groups, advancePerGroup, knockoutStarted]
  );

  const finalMatch = knockout.find((m) => m.round === "F");
  const childrenMap = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of knockout) {
      if (m.next_match_id) {
        const arr = map.get(m.next_match_id) ?? [];
        arr.push(m);
        map.set(m.next_match_id, arr);
      }
    }
    return map;
  }, [knockout]);

  // Before the qualifiers are seeded there is no tree to be empty about.
  const emptyTree = hasGroups && !knockoutStarted ? t.groups.knockoutPending : t.bracket.nothingHere;

  return (
    <div className="flex flex-col gap-5">
      {view === "groups" && (
        <div className="flex flex-col gap-8">
          <p className="text-center text-xs text-fg/55">{t.groups.qualifiedNote}</p>
          {groups.map((group) => (
            <section key={group.groupNo} className="flex flex-col gap-3">
              <GroupTable group={group} players={players} advance={advancePerGroup} t={t} />
              <details>
                <summary className="cursor-pointer list-none text-xs text-fg/55 transition-colors hover:text-fg/80">
                  {t.groups.matches} ({group.total})
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {group.matches.map((m) => (
                    <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
                  ))}
                </div>
              </details>
            </section>
          ))}
        </div>
      )}

      {view === "tree" &&
        (finalMatch ? (
          <div className="thin-scroll -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
            <div className="inline-flex min-w-full items-center justify-center gap-5 p-1">
              <TreeNode match={finalMatch} childrenMap={childrenMap} players={players} t={t} locale={locale} />
              {finalMatch.winner_id && (
                <>
                  <span className="h-px w-5 shrink-0 bg-line/30" aria-hidden />
                  <div className="liquid-glass-panel glass-champion flex w-[11rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-4 py-5 text-center">
                    <Trophy size={22} className="text-accent" />
                    <span className="text-[12px] uppercase tracking-wide text-fg/70">
                      {t.home.championTitle}
                    </span>
                    <span className="text-sm font-semibold text-fg">
                      {playerName(players, finalMatch.winner_id)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : projected.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-xs text-fg/55">{t.groups.projectedNote}</p>
            <ProjectedBracket matches={projected} players={players} t={t} />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-fg/70">{emptyTree}</p>
        ))}
    </div>
  );
}

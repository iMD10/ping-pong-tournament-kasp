"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LayoutList, Network, Trophy, Users } from "lucide-react";
import type { Match, Player, Round } from "@/lib/supabase/types";
import { groupsFromMatches, projectKnockout } from "@/lib/groups";
import { playerName } from "@/lib/players";
import { GroupTable } from "@/components/GroupTable";
import { MatchCard } from "@/components/MatchCard";
import { ProjectedBracket } from "@/components/ProjectedBracket";
import { TreeNode } from "@/components/TreeNode";
import { useLiveRefresh } from "@/components/useLiveRefresh";
import type { Dict } from "@/lib/i18n/dictionary";

type ViewMode = "groups" | "tree" | "list";
type StatusFilter = "all" | "live" | "upcoming" | "finished";

const ROUND_ORDER: Round[] = ["G", "R1", "R16", "QF", "SF", "F"];

export function BracketView({
  matches: allMatches,
  players,
  advancePerGroup,
  t,
  locale,
}: {
  matches: Match[];
  players: Player[];
  advancePerGroup: number;
  t: Dict;
  locale: string;
}) {
  useLiveRefresh();

  // The group stage and the tree are two different shapes of the same table, so
  // the tables and the tree each get their own view. The list is the one place
  // that shows the tournament whole, group matches included.
  const groups = useMemo(() => groupsFromMatches(allMatches), [allMatches]);
  const knockout = useMemo(() => allMatches.filter((m) => m.round !== "G"), [allMatches]);
  const hasGroups = groups.length > 0;
  const knockoutStarted = knockout.length > 0;

  // Until the qualifiers are seeded the tree is empty, but its shape is already
  // decided — so draw it with the group places standing in for the players.
  const projected = useMemo(
    () => (knockoutStarted ? [] : projectKnockout(groups, advancePerGroup)),
    [groups, advancePerGroup, knockoutStarted]
  );

  const [view, setView] = useState<ViewMode>(hasGroups && !knockoutStarted ? "groups" : "tree");
  const [tab, setTab] = useState<"all" | Round>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    // A stored preference only applies to the views this tournament actually
    // has: no groups means no groups tab to restore.
    const stored = window.localStorage.getItem("bracketView");
    if (stored === "tree" || stored === "list" || (stored === "groups" && hasGroups)) setView(stored);
  }, [hasGroups]);

  const changeView = (v: ViewMode) => {
    setView(v);
    window.localStorage.setItem("bracketView", v);
  };

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

  const roundsPresent = useMemo(
    () => ROUND_ORDER.filter((r) => allMatches.some((m) => m.round === r)),
    [allMatches]
  );

  const classify = (m: Match): StatusFilter => {
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

  const filtered = allMatches
    .filter((m) => tab === "all" || m.round === tab)
    .filter((m) => status === "all" || classify(m) === status)
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

  const feed = tab === "all" && status === "all" ? [...live, ...upcoming, ...finished] : filtered;

  // Before the qualifiers are seeded there is no tree to be empty about. The
  // list has the group matches to fall back on, so an empty one there is just
  // a filter that matched nothing.
  const emptyTree = hasGroups && !knockoutStarted ? t.groups.knockoutPending : t.bracket.nothingHere;

  const pill = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${
      on ? "bg-fg text-bg font-medium" : "liquid-glass text-fg/70 hover:text-fg"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <div className="liquid-glass flex items-center gap-1 rounded-xl p-1.5">
          {hasGroups && (
            <button
              onClick={() => changeView("groups")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                view === "groups" ? "bg-fg/10 font-medium text-fg" : "text-fg/70 hover:text-fg"
              }`}
            >
              <Users size={15} strokeWidth={1.75} />
              {t.groups.tab}
            </button>
          )}
          <button
            onClick={() => changeView("tree")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
              view === "tree" ? "bg-fg/10 font-medium text-fg" : "text-fg/70 hover:text-fg"
            }`}
          >
            <Network size={15} strokeWidth={1.75} />
            {t.bracket.tree}
          </button>
          <button
            onClick={() => changeView("list")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
              view === "list" ? "bg-fg/10 font-medium text-fg" : "text-fg/70 hover:text-fg"
            }`}
          >
            <LayoutList size={15} strokeWidth={1.75} />
            {t.bracket.list}
          </button>
        </div>
      </div>

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

      {view === "list" && (
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
            {(["all", "live", "upcoming", "finished"] as StatusFilter[]).map((s) => (
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
                {t.bracket.nothingHere}
              </div>
            )}
            {feed.map((m) => (
              <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { buildKnockoutFromGroups } from "@/lib/actions";
import { entryRoundCode, groupLabel, groupsFromMatches } from "@/lib/groups";
import { ROUND_LABELS_AR } from "@/lib/match";
import { playerName } from "@/lib/players";
import { getDict } from "@/lib/i18n/dictionary";
import { GroupTable } from "@/components/GroupTable";
import type { Match, Player } from "@/lib/supabase/types";

/**
 * The group stage as the admin sees it: live tables, and the one button that
 * closes the stage and seeds the qualifiers into the tree.
 */
export function GroupsPanel({
  matches,
  players,
  advancePerGroup,
  knockoutStarted,
}: {
  matches: Match[];
  players: Player[];
  advancePerGroup: number;
  knockoutStarted: boolean;
}) {
  const router = useRouter();
  const t = getDict("ar");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => groupsFromMatches(matches), [matches]);
  if (groups.length === 0) return null;

  const remaining = groups.reduce((sum, g) => sum + (g.total - g.played), 0);
  const qualifiers = groups.flatMap((g) => g.standings.slice(0, advancePerGroup));

  const build = () => {
    setError(null);
    startTransition(async () => {
      const res = await buildKnockoutFromGroups();
      if (!res.ok) setError(res.error);
      else router.refresh();
      setConfirming(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-fg/90">دور المجموعات</h2>
        <span className="text-xs text-fg/70">
          {remaining > 0 ? `باقي ${remaining} مباراة` : "كل المباريات انلعبت"}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <GroupTable
            key={group.groupNo}
            group={group}
            players={players}
            advance={advancePerGroup}
            t={t}
          />
        ))}
      </div>

      <div className="liquid-glass-panel flex flex-col gap-3 rounded-2xl p-5">
        {error && <p className="text-xs text-live">{error}</p>}

        {knockoutStarted ? (
          <p className="text-sm text-accent">
            الأدوار الإقصائية انبنت من المتأهلين ✓ تلقاها تحت مع باقي المباريات.
          </p>
        ) : remaining > 0 ? (
          <p className="text-sm text-fg/70">
            لازم تخلص كل مباريات المجموعات قبل ما تبني الأدوار الإقصائية. باقي {remaining} مباراة.
          </p>
        ) : confirming ? (
          <>
            <p className="text-sm text-fg/70">
              المتأهلون ({qualifiers.length}) بينزلون{" "}
              <span className="font-medium text-fg">
                {ROUND_LABELS_AR[entryRoundCode(qualifiers.length)]}
              </span>
              . أول كل مجموعة ما يواجه ثاني نفس مجموعته بأول دور.
            </p>
            <ul className="grid gap-1.5 text-xs text-fg/70 sm:grid-cols-2">
              {groups.map((group) =>
                group.standings.slice(0, advancePerGroup).map((row, i) => (
                  <li key={row.playerId}>
                    <span className="text-fg/55">
                      {groupLabel(group.groupNo)}
                      {i + 1}
                    </span>{" "}
                    <span className="text-fg">{playerName(players, row.playerId)}</span>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={build}
                className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
              >
                نعم، ابنِ الشجرة
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="liquid-glass rounded-full px-5 py-2.5 text-sm text-fg/70"
              >
                تراجع
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="flex w-fit items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90"
            >
              <Trophy size={15} />
              ابنِ الأدوار الإقصائية
            </button>
            <p className="text-xs leading-relaxed text-fg/70">
              ياخذ أول {advancePerGroup} من كل مجموعة ويحطهم بالشجرة. ما ينبني إلا مرة وحدة، فراجع
              الجداول قبلها.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

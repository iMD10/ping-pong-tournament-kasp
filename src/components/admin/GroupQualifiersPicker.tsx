"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Scale } from "lucide-react";
import { setGroupTiebreak } from "@/lib/actions";
import { groupLabel, tieOnQualifyingLine, type GroupView } from "@/lib/groups";
import { playerName } from "@/lib/players";
import type { Player } from "@/lib/supabase/types";

const selectCls =
  "w-full min-w-0 rounded-lg bg-fg/[0.08] px-3 py-2 text-sm text-fg outline-none transition-colors focus:bg-fg/[0.14] [color-scheme:dark]";

/** «أول»، «ثاني»، … for the qualifying places, by index. */
const PLACE_LABELS_AR = ["أول", "ثاني", "ثالث", "رابع", "خامس", "سادس"];

function placeLabel(i: number): string {
  return PLACE_LABELS_AR[i] ?? `مركز ${i + 1}`;
}

/**
 * Picks who takes each qualifying place in one finished group, by hand.
 *
 * Two players level on everything the table ranks on settle it over a decider
 * on the table, and that game stays off the record — it isn't part of the round
 * robin, and its score would move the very standings it was played to break.
 * So the admin records the outcome here instead of the game: the places they
 * choose are what gets seeded into the tree, and everyone else keeps the
 * ranking their results earned.
 *
 * It opens by itself when a group ends with a tie across the qualifying line —
 * the case that needs a decision — and is a button away for any other group,
 * because a walkover or a withdrawal can want the same override.
 */
export function GroupQualifiersPicker({
  group,
  players,
  advance,
}: {
  group: GroupView;
  players: Player[];
  advance: number;
}) {
  const router = useRouter();
  const places = Math.min(advance, group.members.length);
  const tied = tieOnQualifyingLine(group.standings, advance);
  // A pin already answered the question, so the group stops asking it.
  const needsDecision = group.pinned.length === 0 && tied.length > 0;

  const [open, setOpen] = useState(needsDecision);
  const [picks, setPicks] = useState<string[]>(() =>
    group.standings.slice(0, places).map((row) => row.playerId)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!group.complete || places < 1) return null;

  // Picking someone who already holds another place swaps the two, so the
  // admin can reorder the qualifiers without ever emptying a slot first.
  const setPick = (index: number, id: string) => {
    setError(null);
    setPicks((prev) => {
      const next = [...prev];
      const existing = prev.indexOf(id);
      if (existing !== -1 && existing !== index) next[existing] = prev[index];
      next[index] = id;
      return next;
    });
  };

  const run = (order: string[]) => {
    setError(null);
    startTransition(async () => {
      const res = await setGroupTiebreak(group.groupNo, order);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  const unchanged =
    picks.length === group.pinned.length && picks.every((id, i) => id === group.pinned[i]);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-1">
        {group.pinned.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-accent">
            <Scale size={12} />
            متأهلو المجموعة {groupLabel(group.groupNo)} محسومين بالفاصلة
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] text-fg/70 transition-colors hover:text-fg"
        >
          <Pencil size={12} />
          {group.pinned.length > 0 ? "عدّل المتأهلين" : "اختر المتأهلين يدويًا"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-fg/[0.05] p-3.5">
      <div className="mb-2.5 flex items-start gap-2">
        <Scale size={14} className="mt-0.5 shrink-0 text-fg/70" />
        <div>
          <p className="text-[13px] font-medium text-fg/85">
            متأهلو المجموعة {groupLabel(group.groupNo)}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fg/70">
            {needsDecision ? (
              <>
                <span className="text-fg/85">
                  {tied.map((row) => playerName(players, row.playerId)).join(" و ")}
                </span>{" "}
                متعادلين على خط التأهل. العبوا فاصلة بينهم وحط النتيجة هنا — الفاصلة ما تنسجّل
                كمباراة وما تأثر على الجدول.
              </>
            ) : (
              "اختيارك هذا هو اللي ينزل بالشجرة بدل ترتيب الجدول. الباقي يظلون بترتيب نتايجهم."
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {Array.from({ length: places }, (_, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] text-fg/55">{placeLabel(i)}</span>
            <select
              value={picks[i] ?? ""}
              onChange={(e) => setPick(i, e.target.value)}
              aria-label={`${placeLabel(i)} المجموعة ${groupLabel(group.groupNo)}`}
              className={selectCls}
            >
              {group.members.map((id) => (
                <option key={id} value={id}>
                  {playerName(players, id)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {error && <p className="mt-2.5 text-xs text-live">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={pending || unchanged}
          onClick={() => run(picks)}
          className="rounded-full bg-fg px-4 py-2 text-[13px] font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
        >
          اعتمد هالمتأهلين
        </button>
        {group.pinned.length > 0 && (
          <button
            disabled={pending}
            onClick={() => run([])}
            className="liquid-glass flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] text-fg/70 transition-colors hover:text-fg disabled:opacity-40"
          >
            <RotateCcw size={12} />
            رجّع ترتيب الجدول
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="liquid-glass rounded-full px-4 py-2 text-[13px] text-fg/70"
        >
          إخفاء
        </button>
      </div>
    </div>
  );
}

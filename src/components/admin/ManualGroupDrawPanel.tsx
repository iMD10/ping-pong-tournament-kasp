"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Eraser, AlertTriangle, X } from "lucide-react";
import { runManualGroupDraw } from "@/lib/actions";
import { distributeIntoGroups, entryRoundCode, groupLabel } from "@/lib/groups";
import { ROUND_LABELS_AR } from "@/lib/match";
import type { Player } from "@/lib/supabase/types";
import type { GroupSettings } from "@/components/admin/useGroupSettings";

const selectCls =
  "w-full min-w-0 rounded-lg bg-fg/[0.08] px-3 py-2 text-sm text-fg outline-none transition-colors focus:bg-fg/[0.14] [color-scheme:dark]";

/** Slot index -> group, given the players-per-group layout. */
function groupOfSlot(sizes: number[], index: number): number {
  let cursor = 0;
  for (let g = 0; g < sizes.length; g++) {
    cursor += sizes[g];
    if (index < cursor) return g;
  }
  return sizes.length - 1;
}

/** The flat slot array chunked back into groups. */
function slotsToGroups(slots: (string | null)[], sizes: number[]): string[][] {
  const groups: string[][] = [];
  let cursor = 0;
  for (const size of sizes) {
    groups.push(slots.slice(cursor, cursor + size).filter(Boolean) as string[]);
    cursor += size;
  }
  return groups;
}

/**
 * Hand-fills the groups before the draw is locked in. Slots hold player ids and
 * belong to a group by position; picking a player who is already placed swaps
 * the two slots, so moving someone between groups never duplicates them.
 */
export function ManualGroupDrawPanel({
  players,
  settings,
  onClose,
}: {
  players: Player[];
  settings: GroupSettings;
  onClose: () => void;
}) {
  const router = useRouter();
  const { sizes, advance, qualifiers } = settings;
  // Opens filled in roster order, so the admin edits a board they can predict
  // instead of an empty one — the shuffle button is right there for random.
  const [slots, setSlots] = useState<(string | null)[]>(() => players.map((p) => p.id));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setSlot = (index: number, id: string | null) => {
    setConfirming(false);
    setSlots((prev) => {
      const next = [...prev];
      const existing = id ? prev.indexOf(id) : -1;
      if (existing !== -1 && existing !== index) next[existing] = prev[index];
      next[index] = id;
      return next;
    });
  };

  const placed = new Set(slots.filter(Boolean) as string[]);
  const unplaced = players.filter((p) => !placed.has(p.id));
  const groups = slotsToGroups(slots, sizes);
  const shortest = Math.min(...groups.map((g) => g.length));
  const ready = unplaced.length === 0 && shortest > advance;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await runManualGroupDraw(groups, advance);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
      } else {
        onClose();
        router.refresh();
      }
    });
  };

  let slotCursor = 0;

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-fg">ترتيب المجموعات يدوي</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg/70">
            حط كل لاعب بمجموعته. لو اخترت لاعب محطوط بمكان ثاني، بيتبادلون الأماكن. كل واحد يلعب مع
            كل من بمجموعته، ويتأهل أول {advance} منها.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="إغلاق ترتيب المجموعات"
          className="shrink-0 text-fg/70 transition-colors hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setConfirming(false);
            // Dealt round robin, so the biggest groups come first and line up
            // with the slot layout.
            setSlots(distributeIntoGroups(players.map((p) => p.id), sizes.length).flat());
          }}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-fg/70 transition-colors hover:text-fg"
        >
          <Shuffle size={13} />
          وزّعهم عشوائي
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setSlots(Array.from({ length: players.length }, () => null));
          }}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-fg/70 transition-colors hover:text-fg"
        >
          <Eraser size={13} />
          فضّي الكل
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {sizes.map((size, g) => {
          const start = slotCursor;
          slotCursor += size;
          const filled = groups[g].length;
          return (
            <div key={g} className="rounded-xl bg-fg/[0.05] p-3">
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="font-medium text-fg/85">المجموعة {groupLabel(g)}</span>
                <span className={`tabular-nums ${filled === size ? "text-accent" : "text-fg/55"}`}>
                  {filled}/{size}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: size }, (_, i) => (
                  <SlotSelect
                    key={start + i}
                    players={players}
                    slots={slots}
                    sizes={sizes}
                    index={start + i}
                    onPick={setSlot}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-fg/70">
            باقي بدون مجموعة <span className="tabular-nums">({unplaced.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unplaced.map((p) => (
              <span key={p.id} className="rounded-full bg-fg/[0.08] px-3 py-1.5 text-xs text-fg/85">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-live">{error}</p>}

      <div className="mt-5 border-t border-fg/[0.07] pt-4">
        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-live">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              بتنعتمد المجموعات بهذا الترتيب، ويتأهل {qualifiers} لـ
              {ROUND_LABELS_AR[entryRoundCode(qualifiers)]}. ما تقدر ترجع بعدها إلا بتصفير البطولة.
            </p>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={submit}
                className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
              >
                نعم، اعتمد
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="liquid-glass rounded-full px-5 py-2.5 text-sm text-fg/70"
              >
                تراجع
              </button>
            </div>
          </div>
        ) : (
          <button
            disabled={!ready}
            onClick={() => setConfirming(true)}
            className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
          >
            اعتمد هذي المجموعات
          </button>
        )}
      </div>
    </div>
  );
}

function SlotSelect({
  players,
  slots,
  sizes,
  index,
  onPick,
}: {
  players: Player[];
  slots: (string | null)[];
  sizes: number[];
  index: number;
  onPick: (index: number, id: string | null) => void;
}) {
  const value = slots[index] ?? "";
  return (
    <select
      value={value}
      onChange={(e) => onPick(index, e.target.value || null)}
      aria-label={`المجموعة ${groupLabel(groupOfSlot(sizes, index))}، الخانة ${index + 1}`}
      className={selectCls}
    >
      <option value="">— فاضي —</option>
      {players.map((p) => {
        const at = slots.indexOf(p.id);
        const elsewhere = at !== -1 && at !== index;
        // Where a swap would send them, so the admin sees the trade before it
        // happens rather than hunting for the name afterwards.
        return (
          <option key={p.id} value={p.id}>
            {elsewhere ? `${p.name} ⇄ ${groupLabel(groupOfSlot(sizes, at))}` : p.name}
          </option>
        );
      })}
    </select>
  );
}

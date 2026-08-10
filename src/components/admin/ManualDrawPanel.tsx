"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, Eraser, AlertTriangle, X } from "lucide-react";
import { runManualDraw } from "@/lib/actions";
import { nextPowerOfTwo, randomPairings, type Pairing } from "@/lib/bracket";
import type { Player } from "@/lib/supabase/types";

const selectCls =
  "min-w-0 flex-1 rounded-lg bg-fg/[0.08] px-3 py-2 text-sm text-fg outline-none transition-colors focus:bg-fg/[0.14] [color-scheme:dark]";

/**
 * Opening layout: one player per match first, then second players, so byes land
 * on the last matches instead of leaving a whole match empty.
 */
function defaultSlots(playerIds: string[], size: number): (string | null)[] {
  const slots: (string | null)[] = Array.from({ length: size }, () => null);
  const matches = size / 2;
  playerIds.forEach((id, i) => {
    const side = i < matches ? 0 : 1;
    slots[(i % matches) * 2 + side] = id;
  });
  return slots;
}

/**
 * Hand-arranges the first round before the draw is locked in. Slots hold player
 * ids; an empty slot next to a filled one is a bye. Picking a player who is
 * already placed swaps the two slots instead of duplicating them.
 */
export function ManualDrawPanel({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const router = useRouter();
  const size = nextPowerOfTwo(players.length);
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    defaultSlots(players.map((p) => p.id), size)
  );
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
  const pairs: Pairing[] = Array.from({ length: size / 2 }, (_, i) => [slots[i * 2], slots[i * 2 + 1]]);
  const emptyCount = pairs.filter(([a, b]) => a == null && b == null).length;
  const ready = unplaced.length === 0 && players.length >= 2;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await runManualDraw(pairs);
      if (!res.ok) {
        setError(res.error);
        setConfirming(false);
      } else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-fg">ترتيب القرعة يدوي</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg/70">
            حط كل لاعب بمكانه. اللاعب اللي بروحه بمباراة ياخذ استراحة ويعدّي للدور اللي بعده،
            والمباراة اللي ما فيها أحد تنشال من الشجرة.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="إغلاق الترتيب اليدوي"
          className="shrink-0 text-fg/70 transition-colors hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setConfirming(false);
            setSlots(randomPairings(players.map((p) => p.id)).flat());
          }}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-fg/70 transition-colors hover:text-fg"
        >
          <Shuffle size={13} />
          وزّعهم عشوائي
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setSlots(Array.from({ length: size }, () => null));
          }}
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-fg/70 transition-colors hover:text-fg"
        >
          <Eraser size={13} />
          فضّي الكل
        </button>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2">
        {pairs.map(([p1, p2], i) => {
          const isBye = (p1 == null) !== (p2 == null);
          const isEmpty = p1 == null && p2 == null;
          return (
            <div key={i} className={`rounded-xl p-3 ${isEmpty ? "bg-fg/[0.02]" : "bg-fg/[0.05]"}`}>
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="text-fg/70">مباراة {i + 1}</span>
                {isBye && <span className="text-accent">استراحة</span>}
                {isEmpty && <span className="text-fg/55">تنشال</span>}
              </div>
              <div className="flex items-center gap-2">
                <SlotSelect players={players} slots={slots} index={i * 2} onPick={setSlot} />
                <span className="shrink-0 text-xs text-fg/55">ضد</span>
                <SlotSelect players={players} slots={slots} index={i * 2 + 1} onPick={setSlot} />
              </div>
            </div>
          );
        })}
      </div>

      {unplaced.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-fg/70">
            باقي بدون مكان <span className="tabular-nums">({unplaced.length})</span>
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
              بتنعتمد القرعة بهذا الترتيب
              {emptyCount > 0 ? `، و${emptyCount} مباراة فاضية بتنشال` : ""}. ما تقدر ترجع بعدها إلا
              بتصفير البطولة.
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
            اعتمد هذا الترتيب
          </button>
        )}
      </div>
    </div>
  );
}

function SlotSelect({
  players,
  slots,
  index,
  onPick,
}: {
  players: Player[];
  slots: (string | null)[];
  index: number;
  onPick: (index: number, id: string | null) => void;
}) {
  const value = slots[index] ?? "";
  return (
    <select
      value={value}
      onChange={(e) => onPick(index, e.target.value || null)}
      aria-label={`الخانة ${index + 1}`}
      className={selectCls}
    >
      <option value="">— فاضي —</option>
      {players.map((p) => {
        const at = slots.indexOf(p.id);
        const elsewhere = at !== -1 && at !== index;
        return (
          <option key={p.id} value={p.id}>
            {elsewhere ? `${p.name} ⇄` : p.name}
          </option>
        );
      })}
    </select>
  );
}

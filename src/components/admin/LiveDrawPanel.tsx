"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, ExternalLink, X, AlertTriangle } from "lucide-react";
import { startLiveDraw, setDrawSlot, cancelLiveDraw, finishLiveDraw } from "@/lib/actions";
import { drawSeatCount, seatArray, nextEmptySeat } from "@/lib/draw";
import { playerName } from "@/lib/players";
import type { DrawSlot, DrawStatus, Player } from "@/lib/supabase/types";

/**
 * Runs the draw as it happens in the room: the admin pulls a paper, taps the
 * name, and it lands on the board for everyone watching /draw. Nothing here
 * picks anybody — the papers do that. The bracket itself is only built at the
 * end, from the finished board.
 */
export function LiveDrawPanel({
  players,
  slots,
  status,
  size,
}: {
  players: Player[];
  slots: DrawSlot[];
  status: DrawStatus;
  size: number | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // null means "follow the next empty seat", which is what you want while the
  // draw runs in order; tapping a seat pins it for a correction.
  const [target, setTarget] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true; data: null } | { ok: false; error: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  };

  if (status === "idle") {
    return (
      <div className="liquid-glass-panel rounded-2xl p-5">
        <h2 className="mb-1 font-medium text-fg">القرعة على الهواء</h2>
        <p className="mb-4 text-xs leading-relaxed text-fg/70">
          اسحب الأوراق بيدك، وحط كل اسم هنا وقت ما يطلع. الحضور يتابعون التوزيع لحظة بلحظة من صفحة
          القرعة، والشجرة ما تنبني إلا لما تعتمدها بالآخر.
        </p>
        {error && <p className="mb-3 text-xs text-live">{error}</p>}
        <button
          disabled={pending || players.length < 2}
          onClick={() => run(startLiveDraw)}
          className="flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
        >
          <Radio size={15} />
          ابدأ القرعة على الهواء
        </button>
        {players.length >= 2 && (
          <p className="mt-3 text-xs text-fg/55">
            بتنفتح <span className="tabular-nums">{drawSeatCount(players.length) / 2}</span> مباراة
            لـ <span className="tabular-nums">{players.length}</span> لاعب.
          </p>
        )}
      </div>
    );
  }

  const seatCount = size ?? 0;
  const seats = seatArray(slots, seatCount);
  const placed = new Set(slots.map((s) => s.player_id));
  const inBag = players.filter((p) => !placed.has(p.id));
  const auto = nextEmptySeat(seats);
  const activeSeat = target ?? auto;
  const rosterChanged = seatCount !== drawSeatCount(players.length);
  const ready = inBag.length === 0 && !rosterChanged;

  const place = (playerId: string) => {
    if (activeSeat == null) return;
    run(() => setDrawSlot(activeSeat, playerId), () => setTarget(null));
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium text-fg">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            القرعة على الهواء
          </h2>
          <p className="mt-1 text-xs text-fg/70">
            انسحب <span className="tabular-nums text-fg">{slots.length}</span> من{" "}
            <span className="tabular-nums text-fg">{players.length}</span>
          </p>
        </div>
        <Link
          href="/draw"
          target="_blank"
          className="liquid-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-fg/70 transition-colors hover:text-fg"
        >
          <ExternalLink size={13} />
          شاشة الحضور
        </Link>
      </div>

      {error && <p className="mb-3 text-xs text-live">{error}</p>}
      {rosterChanged && (
        <p className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-live">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          عدد اللاعبين تغيّر بعد ما بدأت القرعة. ألغِ القرعة وابدأها من جديد عشان الشبكة تضبط.
        </p>
      )}

      {inBag.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs text-fg/70">
            {activeSeat == null
              ? "كل الخانات معمورة"
              : `اضغط الاسم اللي طلع بالورقة، بينزل بمباراة ${Math.floor(activeSeat / 2) + 1} — الطرف ${
                  activeSeat % 2 === 0 ? "الأول" : "الثاني"
                }`}
          </p>
          <div className="flex flex-wrap gap-2">
            {inBag.map((p) => (
              <button
                key={p.id}
                disabled={pending || activeSeat == null}
                onClick={() => place(p.id)}
                className="rounded-full bg-fg/[0.08] px-3.5 py-2 text-sm text-fg/85 transition-colors hover:bg-fg/[0.16] hover:text-fg disabled:opacity-40"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2">
        {Array.from({ length: seatCount / 2 }, (_, i) => {
          const pair: [number, number] = [i * 2, i * 2 + 1];
          const filled = pair.filter((s) => seats[s]).length;
          return (
            <div key={i} className="rounded-xl bg-fg/[0.05] p-3">
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="text-fg/70">مباراة {i + 1}</span>
                {filled === 1 && <span className="text-accent">استراحة</span>}
                {filled === 0 && <span className="text-fg/55">فاضية</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                {pair.map((seat) => (
                  <SeatButton
                    key={seat}
                    label={seats[seat] ? playerName(players, seats[seat]) : "— فاضي —"}
                    filled={!!seats[seat]}
                    active={activeSeat === seat}
                    disabled={pending}
                    onSelect={() => setTarget(seat === target ? null : seat)}
                    onClear={() => run(() => setDrawSlot(seat, null), () => setTarget(null))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-fg/[0.07] pt-4">
        {confirming ? (
          <>
            <p className="w-full text-xs leading-relaxed text-live">
              بتنعتمد القرعة بهذا التوزيع وتنبني الشجرة. ما تقدر ترجع بعدها إلا بتصفير البطولة.
            </p>
            <button
              disabled={pending}
              onClick={() => run(finishLiveDraw, () => setConfirming(false))}
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
          </>
        ) : (
          <>
            <button
              disabled={!ready || pending}
              onClick={() => setConfirming(true)}
              className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
            >
              أنهِ القرعة واعتمدها
            </button>
            <button
              disabled={pending}
              onClick={() => run(cancelLiveDraw, () => setTarget(null))}
              className="text-xs font-medium text-fg/70 transition-colors hover:text-live"
            >
              ألغِ القرعة
            </button>
            {inBag.length > 0 && (
              <span className="text-xs text-fg/55">
                باقي <span className="tabular-nums">{inBag.length}</span> ما نزلوا
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SeatButton({
  label,
  filled,
  active,
  disabled,
  onSelect,
  onClear,
}: {
  label: string;
  filled: boolean;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg transition-colors ${
        active ? "bg-accent/15 ring-1 ring-accent/40" : filled ? "bg-fg/[0.09]" : "bg-fg/[0.03]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`min-w-0 flex-1 truncate px-3 py-2 text-start text-sm disabled:opacity-40 ${
          filled ? "font-medium text-fg" : "text-fg/40"
        }`}
      >
        {label}
      </button>
      {filled && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label={`فضّي ${label}`}
          className="shrink-0 px-2.5 py-2 text-fg/50 transition-colors hover:text-live disabled:opacity-40"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

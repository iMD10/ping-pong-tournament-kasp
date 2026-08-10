"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { runDraw, resetTournament } from "@/lib/actions";

export function DrawPanel({
  drawn,
  playerCount,
  manualOpen,
  onToggleManual,
}: {
  drawn: boolean;
  playerCount: number;
  manualOpen: boolean;
  onToggleManual: () => void;
}) {
  const router = useRouter();
  const [confirmingDraw, setConfirmingDraw] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const draw = () => {
    setError(null);
    startTransition(async () => {
      const res = await runDraw();
      if (!res.ok) setError(res.error);
      else router.refresh();
      setConfirmingDraw(false);
    });
  };

  const reset = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetTournament();
      if (!res.ok) setError(res.error);
      else router.refresh();
      setResetStep(0);
    });
  };

  return (
    <div className="liquid-glass-panel flex flex-col rounded-2xl p-5">
      <h2 className="mb-4 font-medium text-fg">القرعة</h2>
      {error && <p className="mb-3 text-xs text-live">{error}</p>}

      {!drawn ? (
        confirmingDraw ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg/70">
              بتنسحب القرعة لـ <span className="font-medium text-fg">{playerCount}</span> لاعب. ما تقدر
              ترجع بعدها إلا بتصفير البطولة.
            </p>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={draw}
                className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90"
              >
                نعم، اسحب
              </button>
              <button
                onClick={() => setConfirmingDraw(false)}
                className="liquid-glass rounded-full px-5 py-2.5 text-sm text-fg/70"
              >
                تراجع
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmingDraw(true)}
                disabled={playerCount < 2}
                className="flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
              >
                <Shuffle size={15} />
                اسحب القرعة
              </button>
              <button
                onClick={onToggleManual}
                disabled={playerCount < 2}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors disabled:opacity-40 ${
                  manualOpen ? "bg-fg/[0.14] text-fg" : "liquid-glass text-fg/70 hover:text-fg"
                }`}
              >
                <SlidersHorizontal size={15} />
                رتّبها يدوي
              </button>
            </div>
            <p className="text-xs leading-relaxed text-fg/70">
              العشوائي يوزّع اللاعبين والاستراحات بنفسه. اليدوي يخليك تحدد كل مواجهة بنفسك.
            </p>
          </div>
        )
      ) : (
        <p className="text-sm text-accent">القرعة انسحبت ✓</p>
      )}

      <div className="mt-auto border-t border-fg/[0.07] pt-4">
        {resetStep === 0 && (
          <button
            onClick={() => setResetStep(1)}
            className="text-xs font-medium text-fg/70 transition-colors hover:text-live"
          >
            صفّر البطولة
          </button>
        )}
        {resetStep > 0 && (
          <div className="flex flex-col gap-2.5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-live">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              {resetStep === 1
                ? "هذا يمسح كل المباريات والنتائج. متأكد؟"
                : "تأكيد أخير، ما فيه رجعة بعدها."}
            </p>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={() => (resetStep === 1 ? setResetStep(2) : reset())}
                className="rounded-full bg-live px-4 py-2 text-xs font-medium text-bg transition-opacity hover:opacity-90"
              >
                {resetStep === 1 ? "متأكد" : "صفّر الحين"}
              </button>
              <button
                onClick={() => setResetStep(0)}
                className="liquid-glass rounded-full px-4 py-2 text-xs text-fg/70"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

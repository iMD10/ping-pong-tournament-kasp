"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { runDraw, runGroupDraw, resetTournament } from "@/lib/actions";
import { entryRoundCode, groupSizes, possibleGroupCounts } from "@/lib/groups";
import { ROUND_LABELS_AR } from "@/lib/match";
import type { TournamentFormat } from "@/lib/supabase/types";

const selectCls =
  "rounded-lg bg-fg/[0.08] px-3 py-2 text-xs text-fg outline-none focus:bg-fg/[0.14] [color-scheme:dark]";

export function DrawPanel({
  drawn,
  playerCount,
  format,
  onFormatChange,
  manualOpen,
  onToggleManual,
  liveDrawRunning,
}: {
  drawn: boolean;
  playerCount: number;
  format: TournamentFormat;
  onFormatChange: (format: TournamentFormat) => void;
  manualOpen: boolean;
  onToggleManual: () => void;
  liveDrawRunning: boolean;
}) {
  const router = useRouter();
  const [confirmingDraw, setConfirmingDraw] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The roster can still change under this panel, so both picks fall back to a
  // sane option whenever the current one stops fitting the player count.
  const groupCounts = possibleGroupCounts(playerCount);
  const [chosenGroupCount, setGroupCount] = useState(4);
  const groupCount = groupCounts.includes(chosenGroupCount)
    ? chosenGroupCount
    : groupCounts[Math.floor(groupCounts.length / 2)] ?? 0;
  const sizes = groupCount > 0 ? groupSizes(playerCount, groupCount) : [];
  const smallestGroup = sizes.length > 0 ? Math.min(...sizes) : 0;
  // At least one player in every group has to go home, so the last place can
  // never qualify.
  const advanceOptions = Array.from({ length: Math.max(0, smallestGroup - 1) }, (_, i) => i + 1);
  const [advance, setAdvance] = useState(2);
  const advancePerGroup = advanceOptions.includes(advance) ? advance : advanceOptions[0] ?? 1;
  const qualifiers = groupCount * advancePerGroup;
  const groupsPossible = groupCounts.length > 0 && advanceOptions.length > 0 && qualifiers >= 2;

  const draw = () => {
    setError(null);
    startTransition(async () => {
      const res =
        format === "groups" ? await runGroupDraw(groupCount, advancePerGroup) : await runDraw();
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

  const formatTab = (value: TournamentFormat, label: string) => (
    <button
      key={value}
      onClick={() => {
        onFormatChange(value);
        setConfirmingDraw(false);
        setError(null);
      }}
      className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
        format === value ? "bg-fg/[0.14] font-medium text-fg" : "text-fg/70 hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="liquid-glass-panel flex flex-col rounded-2xl p-5">
      <h2 className="mb-4 font-medium text-fg">القرعة</h2>
      {error && <p className="mb-3 text-xs text-live">{error}</p>}

      {liveDrawRunning && !drawn ? (
        <p className="text-sm text-fg/70">
          فيه قرعة شغالة على الهواء تحت. أنهها أو ألغها لو تبي تسحب من هنا.
        </p>
      ) : !drawn ? (
        confirmingDraw ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg/70">
              {format === "groups" ? (
                <>
                  بينقسم <span className="font-medium text-fg">{playerCount}</span> لاعب على{" "}
                  <span className="font-medium text-fg">{groupCount}</span> مجموعات، ويتأهل{" "}
                  <span className="font-medium text-fg">{qualifiers}</span> لـ
                  {ROUND_LABELS_AR[entryRoundCode(qualifiers)]}.
                </>
              ) : (
                <>
                  بتنسحب القرعة لـ <span className="font-medium text-fg">{playerCount}</span> لاعب.
                </>
              )}{" "}
              ما تقدر ترجع بعدها إلا بتصفير البطولة.
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
            <div className="flex gap-1 rounded-xl bg-fg/[0.05] p-1">
              {formatTab("knockout", "خروج مباشر")}
              {formatTab("groups", "مجموعات")}
            </div>

            {format === "groups" && (
              <div className="flex flex-col gap-2.5 rounded-xl bg-fg/[0.05] p-3.5">
                {groupsPossible ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-fg/70">
                      <label className="flex items-center gap-2">
                        عدد المجموعات
                        <select
                          value={groupCount}
                          onChange={(e) => setGroupCount(Number(e.target.value))}
                          className={selectCls}
                        >
                          {groupCounts.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2">
                        يتأهل من كل مجموعة
                        <select
                          value={advancePerGroup}
                          onChange={(e) => setAdvance(Number(e.target.value))}
                          className={selectCls}
                        >
                          {advanceOptions.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="text-[12px] leading-relaxed text-fg/70">
                      المجموعات: {sizes.join(" · ")} لاعب. كل واحد يلعب مع كل من بمجموعته، والترتيب
                      بالفوز وإذا تعادلوا يفصل فرق النقاط. يتأهل {qualifiers} لـ
                      {ROUND_LABELS_AR[entryRoundCode(qualifiers)]}.
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] leading-relaxed text-fg/70">
                    ما يكفون لاعبين لدور مجموعات. لازم 6 لاعبين على الأقل (٣ بكل مجموعة).
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmingDraw(true)}
                disabled={playerCount < 2 || (format === "groups" && !groupsPossible)}
                className="flex items-center gap-2 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
              >
                <Shuffle size={15} />
                {format === "groups" ? "اسحب المجموعات" : "اسحب القرعة"}
              </button>
              {format === "knockout" && (
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
              )}
            </div>
            <p className="text-xs leading-relaxed text-fg/70">
              {format === "groups"
                ? "الأدوار الإقصائية تنبني من المتأهلين بعد ما تخلص كل مباريات المجموعات."
                : "العشوائي يوزّع اللاعبين والاستراحات بنفسه. اليدوي يخليك تحدد كل مواجهة بنفسك."}
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

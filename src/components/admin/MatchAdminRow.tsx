"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, Pencil, CalendarClock, UserX, Users } from "lucide-react";
import type { Match, Player } from "@/lib/supabase/types";
import { formatScoreLine, gameWinCounts, gamesToWin, ROUND_LABELS_AR } from "@/lib/match";
import { playerName } from "@/lib/players";
import {
  editResult,
  previewEditImpact,
  recordGameResult,
  recordWalkover,
  setLive,
  setMatchPlayers,
  setSchedule,
} from "@/lib/actions";

const inputCls =
  "w-16 rounded-lg bg-fg/[0.08] px-2 py-1.5 text-center text-sm tabular-nums text-fg outline-none focus:bg-fg/[0.14]";
const selectCls =
  "min-w-0 flex-1 rounded-lg bg-fg/[0.08] px-3 py-2 text-xs text-fg outline-none focus:bg-fg/[0.14] [color-scheme:dark]";

export function MatchAdminRow({ match, players }: { match: Match; players: Player[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "score" | "edit" | "walkover" | "players">("idle");

  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [d1, setD1] = useState("");
  const [d2, setD2] = useState("");
  const needsDecider = s1 === "10" && s2 === "10";

  const [walkoverType, setWalkoverType] = useState<"absent" | "withdrew">("absent");
  const [walkoverWho, setWalkoverWho] = useState<string>("");
  const [walkoverReason, setWalkoverReason] = useState("");

  const [editWarning, setEditWarning] = useState<{ id: string; round: string }[] | null>(null);

  const [slot1, setSlot1] = useState(match.player1_id ?? "");
  const [slot2, setSlot2] = useState(match.player2_id ?? "");

  const p1Name = playerName(players, match.player1_id);
  const p2Name = playerName(players, match.player2_id);
  const canScore = !!(match.player1_id && match.player2_id) && !match.winner_id && match.outcome_type === "pending";
  const canEdit = !!match.winner_id && match.outcome_type === "score";
  // Players can be rearranged only while the match has no result of its own.
  const canAssign =
    match.round !== "judge" &&
    match.games.length === 0 &&
    (match.outcome_type === "pending" || match.outcome_type === "bye");
  const { p1: p1Wins, p2: p2Wins } = gameWinCounts(match.games);
  const need = gamesToWin(match.round);

  const resetForm = () => {
    setS1("");
    setS2("");
    setD1("");
    setD2("");
    setMode("idle");
    setError(null);
  };

  const winnerSideFromInputs = () => {
    const a = Number(s1);
    const b = Number(s2);
    if (a === 10 && b === 10) return Number(d1) > Number(d2) ? 1 : 2;
    return a > b ? 1 : 2;
  };

  const submitScore = () => {
    setError(null);
    startTransition(async () => {
      const res = await recordGameResult(
        match.id,
        Number(s1),
        Number(s2),
        needsDecider ? Number(d1) : undefined,
        needsDecider ? Number(d2) : undefined
      );
      if (!res.ok) setError(res.error);
      else {
        resetForm();
        router.refresh();
      }
    });
  };

  const applyEdit = (newWinnerId: string) => {
    const games = match.games.length > 0 ? match.games.slice(0, -1) : [];
    const game: any = { score1: Number(s1), score2: Number(s2) };
    if (Number(s1) === 10 && Number(s2) === 10) {
      game.decider_score1 = Number(d1);
      game.decider_score2 = Number(d2);
    }
    games.push(game);
    startTransition(async () => {
      const res = await editResult(match.id, games, newWinnerId);
      if (!res.ok) setError(res.error);
      else {
        resetForm();
        setEditWarning(null);
        router.refresh();
      }
    });
  };

  const submitEditPreview = () => {
    setError(null);
    const newWinnerId = (winnerSideFromInputs() === 1 ? match.player1_id : match.player2_id)!;
    startTransition(async () => {
      const res = await previewEditImpact(match.id, newWinnerId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data.sameWinner || res.data.affected.length === 0) applyEdit(newWinnerId);
      else setEditWarning(res.data.affected);
    });
  };

  const submitWalkover = () => {
    setError(null);
    if (!walkoverWho) {
      setError("اختر مين الغايب/المنسحب");
      return;
    }
    startTransition(async () => {
      const res = await recordWalkover(match.id, walkoverWho, walkoverType, walkoverReason);
      if (!res.ok) setError(res.error);
      else {
        setMode("idle");
        router.refresh();
      }
    });
  };

  const submitPlayers = () => {
    setError(null);
    startTransition(async () => {
      const res = await setMatchPlayers(match.id, slot1 || null, slot2 || null);
      if (!res.ok) setError(res.error);
      else {
        setMode("idle");
        router.refresh();
      }
    });
  };

  const toggleLive = () => {
    startTransition(async () => {
      await setLive(match.id, !match.is_live);
      router.refresh();
    });
  };

  const updateSchedule = (value: string) => {
    startTransition(async () => {
      await setSchedule(match.id, value ? new Date(value).toISOString() : null);
      router.refresh();
    });
  };

  return (
    <div className={`liquid-glass-panel rounded-2xl p-4 ${match.is_live ? "glass-live" : ""}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12px] uppercase tracking-wide text-fg/70">{ROUND_LABELS_AR[match.round]}</span>
        {canScore && (
          <button
            onClick={toggleLive}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
              match.is_live ? "bg-live text-bg" : "bg-fg/[0.08] text-fg/70 hover:text-fg"
            }`}
          >
            <Radio size={11} />
            {match.is_live ? "يلعب الآن" : "بث مباشر"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate text-sm ${match.winner_id === match.player1_id ? "font-semibold text-fg" : "text-fg/70"}`}>
          {p1Name || "؟؟؟"}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-fg/70">
          {need > 1 ? `${p1Wins}–${p2Wins}` : "VS"}
        </span>
        <span className={`min-w-0 flex-1 truncate text-end text-sm ${match.winner_id === match.player2_id ? "font-semibold text-fg" : "text-fg/70"}`}>
          {p2Name || "؟؟؟"}
        </span>
      </div>

      {match.games.length > 0 && (
        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {match.games.map((g, i) => (
            <span key={i} className="rounded-md bg-fg/10 px-2 py-1 font-mono text-xs tabular-nums text-fg/75">
              {formatScoreLine(g)}
            </span>
          ))}
        </div>
      )}

      {match.outcome_type !== "pending" && match.outcome_type !== "score" && (
        <div className="mt-2.5 text-center text-xs text-live">
          {match.outcome_type === "bye" ? "استراحة" : match.outcome_type === "absent" ? "ما حضر" : "انسحب"}
          {match.outcome_reason ? `, ${match.outcome_reason}` : ""}
        </div>
      )}

      {canScore && need > 1 && (
        <p className="mt-2 text-center text-[12px] text-fg/70">أفضل من ثلاث، أول من يفوز بمبارتين</p>
      )}

      {match.scheduled_at && (
        <p className="mt-2 text-center text-[12px] text-fg/70">
          {new Date(match.scheduled_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}

      {error && <p className="mt-2.5 text-xs text-live">{error}</p>}

      {mode === "idle" && (canScore || canEdit || canAssign) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canScore && (
            <button
              onClick={() => setMode("score")}
              className="rounded-full bg-fg px-4 py-2 text-xs font-medium text-bg transition-colors hover:opacity-90"
            >
              سجّل نتيجة
            </button>
          )}
          {canScore && (
            <button
              onClick={() => setMode("walkover")}
              className="liquid-glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-fg/70 hover:text-fg"
            >
              <UserX size={13} />
              ما حضر / انسحب
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => {
                const last = match.games[match.games.length - 1];
                setS1(String(last.score1));
                setS2(String(last.score2));
                setD1(last.decider_score1 != null ? String(last.decider_score1) : "");
                setD2(last.decider_score2 != null ? String(last.decider_score2) : "");
                setMode("edit");
              }}
              className="liquid-glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-fg/70 hover:text-fg"
            >
              <Pencil size={13} />
              عدّل
            </button>
          )}
          {canAssign && (
            <button
              onClick={() => {
                setSlot1(match.player1_id ?? "");
                setSlot2(match.player2_id ?? "");
                setMode("players");
              }}
              className="liquid-glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-fg/70 hover:text-fg"
            >
              <Users size={13} />
              {match.player1_id && match.player2_id ? "غيّر اللاعبين" : "حط لاعبين"}
            </button>
          )}
          {canScore && (
            <label className="liquid-glass flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs text-fg/70">
              <CalendarClock size={13} />
              <input
                type="datetime-local"
                onChange={(e) => updateSchedule(e.target.value)}
                className="w-[130px] bg-transparent text-xs text-fg/70 outline-none [color-scheme:dark]"
              />
            </label>
          )}
        </div>
      )}

      {(mode === "score" || mode === "edit") && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-fg/[0.05] p-3.5">
          <div className="flex items-center justify-center gap-2">
            <input type="number" value={s1} onChange={(e) => setS1(e.target.value)} placeholder="0" className={inputCls} />
            <span className="text-fg/55">–</span>
            <input type="number" value={s2} onChange={(e) => setS2(e.target.value)} placeholder="0" className={inputCls} />
          </div>

          {needsDecider && (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-fg/70">ديسايدر</span>
              <input type="number" value={d1} onChange={(e) => setD1(e.target.value)} className={inputCls} />
              <span className="text-fg/55">–</span>
              <input type="number" value={d2} onChange={(e) => setD2(e.target.value)} className={inputCls} />
            </div>
          )}

          {editWarning ? (
            <div className="rounded-lg bg-live/10 p-3 text-xs text-live">
              <p className="font-semibold">تغيير الفايز بيلغي نتائج:</p>
              <ul className="mt-1 list-inside list-disc text-live/80">
                {editWarning.map((a) => (
                  <li key={a.id}>{ROUND_LABELS_AR[a.round as keyof typeof ROUND_LABELS_AR] ?? a.round}</li>
                ))}
              </ul>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => applyEdit((winnerSideFromInputs() === 1 ? match.player1_id : match.player2_id)!)}
                  className="rounded-full bg-live px-3 py-1.5 font-medium text-bg"
                >
                  أكمل
                </button>
                <button onClick={() => setEditWarning(null)} className="rounded-full bg-fg/10 px-3 py-1.5 text-fg/70">
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-2">
              <button
                disabled={pending || !s1 || !s2}
                onClick={mode === "score" ? submitScore : submitEditPreview}
                className="rounded-full bg-fg px-5 py-2 text-xs font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-40"
              >
                حفظ
              </button>
              <button onClick={resetForm} className="rounded-full bg-fg/10 px-4 py-2 text-xs text-fg/70">
                إلغاء
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "players" && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-fg/[0.05] p-3.5">
          <div className="flex items-center gap-2">
            <select value={slot1} onChange={(e) => setSlot1(e.target.value)} aria-label="اللاعب الأول" className={selectCls}>
              <option value="">— فاضي —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === slot2}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-xs text-fg/55">ضد</span>
            <select value={slot2} onChange={(e) => setSlot2(e.target.value)} aria-label="اللاعب الثاني" className={selectCls}>
              <option value="">— فاضي —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === slot1}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[12px] leading-relaxed text-fg/70">
            خلّ الخانة فاضية لو لسه ما تحدد. اللاعب اللي بروحه بالجولة الأولى ياخذ استراحة ويعدّي.
          </p>
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={submitPlayers}
              className="rounded-full bg-fg px-4 py-2 text-xs font-medium text-bg disabled:opacity-40"
            >
              حفظ
            </button>
            <button onClick={() => setMode("idle")} className="rounded-full bg-fg/10 px-4 py-2 text-xs text-fg/70">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {mode === "walkover" && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-fg/[0.05] p-3.5 text-sm">
          <div className="flex gap-2">
            {(["absent", "withdrew"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setWalkoverType(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                  walkoverType === t ? "bg-live text-bg" : "bg-fg/[0.06] text-fg/70"
                }`}
              >
                {t === "absent" ? "ما حضر" : "انسحب"}
              </button>
            ))}
          </div>
          <select
            value={walkoverWho}
            onChange={(e) => setWalkoverWho(e.target.value)}
            className="rounded-lg bg-fg/[0.08] px-3 py-2 text-xs text-fg outline-none [color-scheme:dark]"
          >
            <option value="">مين؟</option>
            <option value={match.player1_id ?? ""}>{p1Name}</option>
            <option value={match.player2_id ?? ""}>{p2Name}</option>
          </select>
          <input
            value={walkoverReason}
            onChange={(e) => setWalkoverReason(e.target.value)}
            placeholder="السبب (اختياري)"
            className="rounded-lg bg-fg/[0.08] px-3 py-2 text-xs text-fg placeholder-fg/30 outline-none"
          />
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={submitWalkover}
              className="rounded-full bg-fg px-4 py-2 text-xs font-medium text-bg disabled:opacity-40"
            >
              حفظ
            </button>
            <button onClick={() => setMode("idle")} className="rounded-full bg-fg/10 px-4 py-2 text-xs text-fg/70">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

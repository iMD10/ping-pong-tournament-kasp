"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJudgeMatch } from "@/lib/actions";
import { MatchAdminRow } from "@/components/admin/MatchAdminRow";
import { playerName } from "@/lib/players";
import type { Match, Player } from "@/lib/supabase/types";

export function JudgeMatchPanel({
  championId,
  judgeMatch,
  players,
}: {
  championId: string | null;
  judgeMatch: Match | null;
  players: Player[];
}) {
  const router = useRouter();
  const [refereeName, setRefereeName] = useState("عبدالله الهليس");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!championId) return null;

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await createJudgeMatch(championId, refereeName);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="liquid-glass-panel rounded-2xl p-5">
      <h2 className="font-medium text-fg">إذا كان خصمك القاضي فمن تقاضي</h2>
      <p className="mb-4 mt-1 text-xs text-fg/70">
        مباراة استعراضية خارج الشجرة. ما تحسب في الإحصائيات.
      </p>
      {!judgeMatch ? (
        <>
          <p className="mb-2 text-xs text-fg/70">
            البطل <span className="font-medium text-fg">{playerName(players, championId)}</span> ضد
            الحكم:
          </p>
          <div className="flex gap-2">
            <input
              value={refereeName}
              onChange={(e) => setRefereeName(e.target.value)}
              aria-label="اسم الحكم"
              className="flex-1 rounded-xl bg-fg/[0.06] px-4 py-2.5 text-sm text-fg outline-none focus:bg-fg/[0.1]"
            />
            <button
              disabled={pending || !refereeName.trim()}
              onClick={create}
              className="rounded-xl bg-fg px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
            >
              ابدأ
            </button>
          </div>
        </>
      ) : (
        <MatchAdminRow match={judgeMatch} players={players} />
      )}
      {error && <p className="mt-2 text-xs text-live">{error}</p>}
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMatches, getPlayers } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function PlayersPage() {
  const [players, matches] = await Promise.all([getPlayers(), getMatches()]);
  const stats = computeStats(players, matches);
  const t = getT();
  const rtl = getLang() === "ar";
  const Chevron = rtl ? ChevronLeft : ChevronRight;

  return (
    <PageShell
      title={t.players.title}
      subtitle={t.players.subtitle}
      badge={players.length > 0 ? `${players.length} · ${t.nav.players}` : undefined}
    >
      {players.length === 0 ? (
        <EmptyState>{t.players.empty}</EmptyState>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {players.map((p) => {
            const s = stats.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="liquid-glass-panel group flex min-h-[3.25rem] items-center justify-between rounded-2xl px-4 py-3.5 transition-colors hover:bg-fg/[0.06]"
              >
                <span className="font-medium text-fg">{p.name}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums text-fg/70">
                  {s && (
                    <>
                      <span className="text-accent">{s.wins}</span>
                      <span className="text-fg/55">/</span>
                      <span>{s.losses}</span>
                    </>
                  )}
                  <Chevron size={15} className="text-fg/55" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

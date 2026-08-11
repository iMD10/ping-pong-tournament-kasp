import { getMatches, getPlayers, getState } from "@/lib/data";
import { rankStats } from "@/lib/stats";
import { EmptyState, PageShell } from "@/components/PageShell";
import { StatsTable } from "@/components/StatsTable";
import { getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function PlayersPage() {
  const [players, matches, state] = await Promise.all([getPlayers(), getMatches(), getState()]);
  const rows = rankStats(players, matches);
  const t = getT();
  // The table stands in for the roster before a ball is hit: the columns are
  // empty but the shape of the page never changes under the reader.
  const anyResults = rows.some((r) => r.played > 0);

  return (
    <PageShell
      title={t.players.title}
      subtitle={t.players.subtitle}
      badge={players.length > 0 ? `${players.length} · ${t.nav.players}` : undefined}
    >
      {players.length === 0 ? (
        <EmptyState>{t.players.empty}</EmptyState>
      ) : (
        <>
          <StatsTable rows={rows} t={t} championId={state?.champion_id} />
          <p className="mt-3 text-center text-xs leading-relaxed text-fg/55">
            {anyResults ? t.stats.note : t.stats.noResults}
          </p>
        </>
      )}
    </PageShell>
  );
}

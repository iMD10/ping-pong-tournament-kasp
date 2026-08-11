import { getJudgeMatch, getMatches, getPlayers, getState } from "@/lib/data";
import { MatchCard } from "@/components/MatchCard";
import { MatchList } from "@/components/MatchList";
import { OnAirBanner } from "@/components/OnAirBanner";
import { LiveWatch } from "@/components/LiveWatch";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function MatchesPage() {
  const [matches, players, judgeMatch, state] = await Promise.all([
    getMatches(),
    getPlayers(),
    getJudgeMatch(),
    getState(),
  ]);
  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";

  const hasGroups = matches.some((m) => m.round === "G");

  return (
    <PageShell title={t.matches.title} subtitle={t.matches.subtitle} badge={t.brand} wide>
      {matches.length === 0 ? (
        <>
          {state?.draw_status === "live" ? (
            <OnAirBanner title={t.draw.onAir} cta={t.draw.watch} />
          ) : (
            <EmptyState>{t.bracket.empty}</EmptyState>
          )}
          <LiveWatch tables={["tournament_state", "matches"]} />
        </>
      ) : (
        <div className="flex flex-col gap-5">
          <ViewSwitcher active="matches" hasGroups={hasGroups} t={t} />
          <MatchList matches={matches} players={players} t={t} locale={locale} />
        </div>
      )}

      {/* The champion-vs-referee exhibition isn't in the tree and isn't in
          `matches`, so it gets its own section rather than a row in the feed. */}
      {judgeMatch && (
        <section className="mt-10">
          <h2 className="text-lg font-medium tracking-tight text-fg/90">{t.match.exhibition}</h2>
          <p className="mb-4 mt-1 text-sm text-fg/70">{t.match.exhibitionNote}</p>
          <div className="sm:max-w-md">
            <MatchCard match={judgeMatch} players={players} t={t} locale={locale} />
          </div>
        </section>
      )}
    </PageShell>
  );
}

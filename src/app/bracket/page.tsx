import { getJudgeMatch, getMatches, getPlayers, getState } from "@/lib/data";
import { BracketView } from "@/components/BracketView";
import { MatchCard } from "@/components/MatchCard";
import { OnAirBanner } from "@/components/OnAirBanner";
import { LiveWatch } from "@/components/LiveWatch";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function BracketPage() {
  const [matches, players, judgeMatch, state] = await Promise.all([
    getMatches(),
    getPlayers(),
    getJudgeMatch(),
    getState(),
  ]);
  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";

  return (
    <PageShell title={t.bracket.title} subtitle={t.bracket.subtitle} badge={t.brand} wide>
      {matches.length === 0 ? (
        // No tree yet — but if the draw is on air, that's where everyone should
        // be, and this page has to notice the moment it starts or finishes.
        <>
          {state?.draw_status === "live" ? (
            <OnAirBanner title={t.draw.onAir} cta={t.draw.watch} />
          ) : (
            <EmptyState>{t.bracket.empty}</EmptyState>
          )}
          <LiveWatch tables={["tournament_state", "matches"]} />
        </>
      ) : (
        <BracketView
          matches={matches}
          players={players}
          advancePerGroup={state?.advance_per_group ?? 2}
          t={t}
          locale={locale}
        />
      )}

      {/* The champion-vs-referee exhibition lives outside the tree, so it gets
          its own section instead of a node in the bracket. */}
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

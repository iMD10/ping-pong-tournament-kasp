import { getMatches, getPlayers, getState } from "@/lib/data";
import { BracketView } from "@/components/BracketView";
import { OnAirBanner } from "@/components/OnAirBanner";
import { LiveWatch } from "@/components/LiveWatch";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function BracketPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const [matches, players, state] = await Promise.all([getMatches(), getPlayers(), getState()]);
  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";

  const hasGroups = matches.some((m) => m.round === "G");
  const knockoutStarted = matches.some((m) => m.round !== "G");

  // The URL decides, so a link lands on the view it promised. A ?view= that
  // this tournament has no shape for falls back to the stage being played.
  const view: "groups" | "tree" =
    searchParams.view === "groups" && hasGroups
      ? "groups"
      : searchParams.view === "tree"
        ? "tree"
        : hasGroups && !knockoutStarted
          ? "groups"
          : "tree";

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
        <div className="flex flex-col gap-5">
          <ViewSwitcher active={view} hasGroups={hasGroups} t={t} />
          <BracketView
            matches={matches}
            players={players}
            advancePerGroup={state?.advance_per_group ?? 2}
            tiebreaks={state?.group_tiebreaks ?? null}
            view={view}
            t={t}
            locale={locale}
          />
        </div>
      )}
    </PageShell>
  );
}

import { getJudgeMatch, getMatches, getPlayers } from "@/lib/data";
import { BracketView } from "@/components/BracketView";
import { MatchCard } from "@/components/MatchCard";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function BracketPage() {
  const [matches, players, judgeMatch] = await Promise.all([
    getMatches(),
    getPlayers(),
    getJudgeMatch(),
  ]);
  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";

  return (
    <PageShell title={t.bracket.title} subtitle={t.bracket.subtitle} badge={t.brand} wide>
      {matches.length === 0 ? (
        <EmptyState>{t.bracket.empty}</EmptyState>
      ) : (
        <BracketView matches={matches} players={players} t={t} locale={locale} />
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

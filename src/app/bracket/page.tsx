import { getMatches, getPlayers } from "@/lib/data";
import { BracketView } from "@/components/BracketView";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function BracketPage() {
  const [matches, players] = await Promise.all([getMatches(), getPlayers()]);
  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";

  return (
    <PageShell title={t.bracket.title} subtitle={t.bracket.subtitle} badge={t.brand} wide>
      {matches.length === 0 ? (
        <EmptyState>{t.bracket.empty}</EmptyState>
      ) : (
        <BracketView matches={matches} players={players} t={t} locale={locale} />
      )}
    </PageShell>
  );
}

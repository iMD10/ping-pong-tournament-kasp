import { getMatches, getPlayers, getState, playerName } from "@/lib/data";
import { MatchCard } from "@/components/MatchCard";
import { HeroMedia } from "@/components/HeroMedia";
import { KleejaIcon } from "@/components/KleejaIcon";
import { HeroBadge } from "@/components/HeroBadge";
import { HeroText } from "@/components/HeroText";
import { BottomLeftCard } from "@/components/BottomLeftCard";
import { BottomRightCorner } from "@/components/BottomRightCorner";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function HomePage() {
  const [matches, players, state] = await Promise.all([getMatches(), getPlayers(), getState()]);
  const t = getT();
  const lang = getLang();
  const locale = lang === "ar" ? "ar-SA" : "en-GB";

  const live = matches.find((m) => m.is_live);
  const upcoming = matches
    .filter((m) => !m.is_live && !m.winner_id && m.outcome_type === "pending" && m.player1_id && m.player2_id)
    .sort((a, b) => {
      if (a.scheduled_at && b.scheduled_at) return a.scheduled_at.localeCompare(b.scheduled_at);
      if (a.scheduled_at) return -1;
      if (b.scheduled_at) return 1;
      return a.bracket_slot - b.bracket_slot;
    })
    .slice(0, 4);

  const champion = state?.champion_id ? playerName(players, state.champion_id) : null;

  return (
    <>
      <section className="relative flex min-h-[100svh] w-full flex-col justify-center overflow-hidden">
        <HeroMedia />
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-navy/95 via-navy/55 to-navy/65" />
        <img
          src="/klija.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-5 top-24 z-10 h-28 w-28 rotate-[14deg] object-contain opacity-10 sm:right-10 sm:h-44 sm:w-44"
        />

        <div className="relative z-20 flex w-full flex-col items-center px-6 py-24 text-center">
          <HeroBadge
            label={champion ? t.home.championEyebrow : live ? t.home.playingNow : t.brand}
            isChampion={!!champion}
          />
          <HeroText
            champion={champion}
            championTitle={t.home.championTitle}
            title1={t.home.title1}
            title2={t.home.title2}
            lede={champion ? t.home.championLede : t.home.lede}
          />
        </div>

        <BottomLeftCard
          count={players.length}
          label={t.nav.players}
          ctaLabel={t.home.ctaBracket}
          ctaHref="/bracket"
        />

        {live ? (
          <BottomRightCorner
            title={t.home.playingNow}
            subtitle={`${playerName(players, live.player1_id)} vs ${playerName(players, live.player2_id)}`}
            href="/bracket"
          />
        ) : (
          <BottomRightCorner title={t.rules.title} subtitle={t.home.ctaRules} href="/rules" />
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-12 sm:py-16">
        {!state?.drawn ? (
          <div className="liquid-glass-panel rounded-2xl px-6 py-14 text-center">
            <KleejaIcon className="animate-float-ball mx-auto mb-4 h-12 w-12 opacity-60" />
            <p className="text-sm text-fg/70">{t.home.notDrawn}</p>
          </div>
        ) : upcoming.length > 0 ? (
          <>
            <h2 className="mb-5 text-lg font-medium tracking-tight text-fg/90">{t.home.upcoming}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((m) => (
                <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
              ))}
            </div>
          </>
        ) : (
          <div className="liquid-glass-panel rounded-2xl px-6 py-14 text-center text-sm text-fg/70">
            {t.home.noUpcoming}
          </div>
        )}
      </section>
    </>
  );
}

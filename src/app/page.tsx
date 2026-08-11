import Link from "next/link";
import { getJudgeMatch, getMatches, getPlayers, getState, getStatements, playerName } from "@/lib/data";
import { MatchCard } from "@/components/MatchCard";
import { StatementsTicker } from "@/components/StatementsTicker";
import { HeroMedia } from "@/components/HeroMedia";
import { KleejaIcon } from "@/components/KleejaIcon";
import { HeroBadge } from "@/components/HeroBadge";
import { HeroText } from "@/components/HeroText";
import { BottomLeftCard } from "@/components/BottomLeftCard";
import { BottomRightCorner } from "@/components/BottomRightCorner";
import { OnAirBanner } from "@/components/OnAirBanner";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function HomePage() {
  const [matches, players, state, judgeMatch, statements] = await Promise.all([
    getMatches(),
    getPlayers(),
    getState(),
    getJudgeMatch(),
    getStatements(),
  ]);
  const t = getT();
  const lang = getLang();
  const locale = lang === "ar" ? "ar-SA" : "en-GB";

  // The exhibition isn't in `matches`, but it still deserves the live banner.
  const live = matches.find((m) => m.is_live) ?? (judgeMatch?.is_live ? judgeMatch : null);
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

        {/* Extra bottom padding only while the ticker is in the flow (below lg)
            and only when it has something to show, so the centred stack lifts
            clear of the players card pinned to the bottom corner. */}
        <div
          className={`relative z-20 flex w-full flex-col items-center px-6 pt-24 text-center ${
            statements.length > 0 ? "pb-44 lg:pb-24" : "pb-24"
          }`}
        >
          {/* <HeroBadge
            label={champion ? t.home.championEyebrow : live ? t.home.playingNow : t.brand}
            isChampion={!!champion}
          /> */}
          <HeroText
            champion={champion}
            championTitle={t.home.championTitle}
            title1={t.home.title1}
            title2={t.home.title2}
            lede={champion ? t.home.championLede : t.home.lede}
          />
          <StatementsTicker statements={statements} title={t.home.statements} />
        </div>

        {/* Once there's a card to read, the match list is what people came for;
            before the draw, the bracket page is the only thing to see. */}
        <BottomLeftCard
          count={players.length}
          label={t.nav.players}
          ctaLabel={state?.drawn ? t.home.ctaMatches : t.home.ctaBracket}
          ctaHref={state?.drawn ? "/matches" : "/bracket"}
        />

        {live ? (
          <BottomRightCorner
            title={t.home.playingNow}
            subtitle={`${playerName(players, live.player1_id)} vs ${playerName(players, live.player2_id)}`}
            // The live score is in the feed, not in the tree.
            href="/matches"
          />
        ) : (
          <BottomRightCorner title={''} subtitle={t.home.ctaRules} href="/rules" />
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-12 sm:py-16">
        {!state?.drawn ? (
          state?.draw_status === "live" ? (
            <OnAirBanner title={t.draw.onAir} cta={t.draw.watch} />
          ) : (
            <div className="liquid-glass-panel rounded-2xl px-6 py-14 text-center">
              <KleejaIcon className="animate-float-ball mx-auto mb-4 h-12 w-12 opacity-60" />
              <p className="text-sm text-fg/70">{t.home.notDrawn}</p>
            </div>
          )
        ) : upcoming.length > 0 ? (
          <>
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-medium tracking-tight text-fg/90">{t.home.upcoming}</h2>
              {/* Only the next four fit here — the rest of the card is a click away. */}
              <Link href="/matches" className="shrink-0 text-sm text-accent hover:underline">
                {t.home.ctaMatches}
              </Link>
            </div>
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

        {judgeMatch && (
          <div className="mt-12">
            <h2 className="text-lg font-medium tracking-tight text-fg/90">{t.match.exhibition}</h2>
            <p className="mb-5 mt-1 text-sm text-fg/70">{t.match.exhibitionNote}</p>
            <div className="sm:max-w-md">
              <MatchCard match={judgeMatch} players={players} t={t} locale={locale} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

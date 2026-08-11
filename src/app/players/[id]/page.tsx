import { notFound } from "next/navigation";
import { Quote } from "lucide-react";
import { getMatches, getPlayers, getStatements, playerName } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { MatchCard } from "@/components/MatchCard";
import { PageShell } from "@/components/PageShell";
import { KleejaIcon } from "@/components/KleejaIcon";
import { getLang, getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const [players, matches, statements] = await Promise.all([getPlayers(), getMatches(), getStatements()]);
  const player = players.find((p) => p.id === params.id);
  if (!player) notFound();

  const t = getT();
  const locale = getLang() === "ar" ? "ar-SA" : "en-GB";
  const stats = computeStats(players, matches).get(player.id);
  const playerMatches = matches
    .filter((m) => m.player1_id === player.id || m.player2_id === player.id)
    .sort((a, b) => a.bracket_slot - b.bracket_slot);
  const playerStatements = statements
    .filter((s) => s.player_id === player.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <PageShell title={player.name}>
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label={t.players.wins} value={stats?.wins ?? 0} accent />
        <Stat label={t.players.losses} value={stats?.losses ?? 0} />
        <Stat label={t.players.pointsFor} value={stats?.pointsFor ?? 0} />
        <Stat label={t.players.pointsAgainst} value={stats?.pointsAgainst ?? 0} />
      </div>

      {stats?.eliminatedBy && (
        <div className="liquid-glass-panel mb-4 rounded-2xl px-4 py-3.5 text-sm text-fg/70">
          {t.players.eliminatedBy}{" "}
          <span className="font-medium text-fg">{playerName(players, stats.eliminatedBy)}</span>
        </div>
      )}

      {stats && stats.malKKleejaCount > 0 && (
        <div className="liquid-glass-panel mb-6 flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3.5 text-center text-sm font-semibold text-accent">
          {t.match.malKleeja} <KleejaIcon className="h-4 w-4" /> × {stats.malKKleejaCount}
        </div>
      )}

      <h2 className="mb-4 text-lg font-medium tracking-tight text-fg/90">{t.players.matches}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {playerMatches.map((m) => (
          <MatchCard key={m.id} match={m} players={players} t={t} locale={locale} />
        ))}
      </div>

      {playerStatements.length > 0 && (
        <>
          <h2 className="mb-4 mt-8 text-lg font-medium tracking-tight text-fg/90">
            {t.players.statementsTitle}
          </h2>
          <ul className="flex flex-col gap-3">
            {playerStatements.map((s) => (
              <li
                key={s.id}
                className="liquid-glass-panel flex items-start gap-3 rounded-2xl px-4 py-3.5"
              >
                <Quote size={16} className="mt-1 shrink-0 text-accent" />
                <p dir="auto" className="text-sm leading-relaxed text-fg/85">
                  {s.quote}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="liquid-glass-panel rounded-2xl px-3 py-4 text-center">
      <div className={`text-2xl font-semibold tabular-nums ${accent ? "text-accent" : "text-fg"}`}>{value}</div>
      <div className="mt-1 text-xs text-fg/70">{label}</div>
    </div>
  );
}

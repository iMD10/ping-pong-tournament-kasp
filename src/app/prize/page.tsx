import { Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { KleejaIcon } from "@/components/KleejaIcon";
import { PageShell } from "@/components/PageShell";

/** One prize, its own line: what it is, and what it actually means. */
function PrizeRow({
  icon,
  name,
  note,
}: {
  icon: React.ReactNode;
  name: string;
  note: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-fg/[0.06] px-4 py-3.5 text-start">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{name}</span>
        <span className="mt-1 block text-xs leading-relaxed text-fg/70">{note}</span>
      </span>
    </li>
  );
}

export default function PrizePage() {
  const t = getT();

  return (
    <PageShell title={t.prize.title} subtitle={t.prize.lede} badge={t.nav.prize}>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="liquid-glass-panel glass-champion rounded-3xl px-6 py-12 text-center sm:px-8 sm:py-14">
          <div className="animate-float-ball mb-8 flex justify-center">
            <KleejaIcon className="h-20 w-20 sm:h-24 sm:w-24" />
          </div>

          <p className="text-xs uppercase tracking-widest text-fg/70">{t.prize.forChampion}</p>
          <ul className="mt-5 flex flex-col gap-3">
            <PrizeRow
              icon={<KleejaIcon className="h-5 w-5" />}
              name={t.prize.kleeja}
              note={t.prize.kleejaNote}
            />
            <PrizeRow
              icon={<Sparkles size={20} />}
              name={t.prize.claude}
              note={t.prize.claudeNote}
            />
          </ul>

          <div className="mx-auto mt-8 max-w-xs border-t border-fg/10 pt-6">
            <p className="text-xs uppercase tracking-widest text-fg/70">{t.prize.fundedBy}</p>
            <p className="mt-2 text-sm font-semibold text-accent">القصمان · بني شهر</p>
          </div>
        </div>

        {/* The bronze match has nothing on it but the place itself, and the page
            says so rather than letting the silence imply a third prize. */}
        <div className="liquid-glass-panel rounded-3xl px-6 py-6 text-center sm:px-8">
          <p className="text-xs uppercase tracking-widest text-fg/70">{t.prize.thirdPlace}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-fg/70">
            {t.prize.thirdPlaceNote}
          </p>
        </div>
      </div>
    </PageShell>
  );
}

import { getT } from "@/lib/i18n/server";
import { KleejaIcon } from "@/components/KleejaIcon";
import { PageShell } from "@/components/PageShell";

export default function PrizePage() {
  const t = getT();

  return (
    <PageShell title={t.prize.title} subtitle={t.prize.lede} badge={t.nav.prize}>
      <div className="liquid-glass-panel glass-champion mx-auto max-w-xl rounded-3xl px-6 py-14 text-center sm:px-8 sm:py-16">
        <div className="animate-float-ball mb-8 flex justify-center">
          <KleejaIcon className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
        <div className="mx-auto max-w-xs border-t border-fg/10 pt-6">
          <p className="text-xs uppercase tracking-widest text-fg/70">{t.prize.fundedBy}</p>
          <p className="mt-2 text-sm font-semibold text-accent">القصمان · بني شهر</p>
        </div>
      </div>
    </PageShell>
  );
}

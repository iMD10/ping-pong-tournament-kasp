import { PageShell } from "@/components/PageShell";
import { RULES } from "@/lib/i18n/dictionary";
import { getLang, getT } from "@/lib/i18n/server";

export default function RulesPage() {
  const t = getT();
  const rules = RULES[getLang()];

  return (
    <PageShell title={t.rules.title} subtitle={t.rules.subtitle}>
      <ol className="liquid-glass-panel divide-y divide-fg/[0.08] rounded-2xl px-4 py-1 sm:px-6">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-4 py-4">
            <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-fg/70">{i + 1}</span>
            <span className="text-[15px] leading-relaxed text-fg/85">{r}</span>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}

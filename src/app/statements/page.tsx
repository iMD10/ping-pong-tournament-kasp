import { getStatements } from "@/lib/data";
import { PageShell } from "@/components/PageShell";
import { StatementsBrowser } from "@/components/StatementsBrowser";
import { getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function StatementsPage() {
  const statements = await getStatements();
  const t = getT();

  return (
    <PageShell
      title={t.statements.title}
      subtitle={t.statements.subtitle}
      badge={statements.length > 0 ? `${statements.length} · ${t.nav.statements}` : undefined}
    >
      <StatementsBrowser statements={statements} t={t.statements} />
    </PageShell>
  );
}

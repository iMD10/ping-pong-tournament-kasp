import { getDrawSlots, getPlayers, getState } from "@/lib/data";
import { DrawCeremony } from "@/components/DrawCeremony";
import { LiveWatch } from "@/components/LiveWatch";
import { EmptyState, PageShell } from "@/components/PageShell";
import { getT } from "@/lib/i18n/server";

export const revalidate = 0;

export default async function DrawPage() {
  const [players, slots, state] = await Promise.all([getPlayers(), getDrawSlots(), getState()]);
  const t = getT();

  const size = state?.draw_size ?? 0;
  const status = state?.draw_status ?? "idle";
  const running = (status === "live" || status === "done") && size >= 2;

  return (
    <PageShell title={t.draw.title} subtitle={t.draw.subtitle} badge={t.brand} wide>
      {running ? (
        <DrawCeremony
          players={players}
          slots={slots}
          size={size}
          done={status === "done"}
          t={t}
        />
      ) : (
        <>
          <EmptyState>{t.draw.notStarted}</EmptyState>
          {/* Nothing on this page is interactive yet, but it still has to flip
              itself over the moment the admin starts the ceremony. */}
          <LiveWatch tables={["tournament_state"]} />
        </>
      )}
    </PageShell>
  );
}

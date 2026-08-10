import { createClient } from "@/lib/supabase/server";
import { getJudgeMatch, getMatches, getPlayers, getState } from "@/lib/data";
import { LoginForm } from "@/components/admin/LoginForm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const revalidate = 0;

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </main>
    );
  }

  const [players, matches, judgeMatch, state] = await Promise.all([
    getPlayers(),
    getMatches(),
    getJudgeMatch(),
    getState(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <AdminDashboard players={players} matches={matches} judgeMatch={judgeMatch} state={state} />
    </main>
  );
}

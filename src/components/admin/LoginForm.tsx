"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { signIn } from "@/lib/actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn(email, password);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="liquid-glass-panel flex flex-col gap-3 rounded-3xl p-7">
      <div className="mb-2 flex flex-col items-center gap-3">
        <span className="liquid-glass rounded-2xl p-3">
          <Lock size={20} className="text-accent" />
        </span>
        <h1 className="text-lg font-medium tracking-tight text-fg">دخول الإدارة</h1>
      </div>
      <input
        type="email"
        placeholder="الإيميل"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-xl bg-fg/[0.06] px-4 py-3 text-sm text-fg placeholder-fg/30 outline-none transition focus:bg-fg/[0.1]"
        required
      />
      <input
        type="password"
        placeholder="كلمة المرور"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-xl bg-fg/[0.06] px-4 py-3 text-sm text-fg placeholder-fg/30 outline-none transition focus:bg-fg/[0.1]"
        required
      />
      {error && <p className="text-sm text-live">{error}</p>}
      <button
        disabled={pending}
        className="mt-1 rounded-full bg-fg py-3 text-sm font-medium text-bg transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "..." : "دخول"}
      </button>
    </form>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to matches/tournament_state changes and refreshes the current
 * server-rendered page so scores/live flags update for everyone watching. */
export function useLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("public-tournament")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_state" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);
}

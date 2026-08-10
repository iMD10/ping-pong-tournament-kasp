"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_TABLES = ["matches", "tournament_state"];

/** Subscribes to the given tables and refreshes the current server-rendered
 * page so scores/live flags update for everyone watching. Defaults to
 * matches/tournament_state. */
export function useLiveRefresh(tables: string[] = DEFAULT_TABLES) {
  const router = useRouter();
  // Depend on the names, not the array identity, so an inline literal at the
  // call site doesn't resubscribe on every render.
  const key = tables.join(",");
  // supabase-js hands back the *same* channel for a repeated topic, and adding
  // listeners to an already-subscribed channel throws. A per-instance topic
  // keeps two components on one page from colliding.
  const id = useId();

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`public-tournament:${id}:${key}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        router.refresh()
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, key, id]);
}

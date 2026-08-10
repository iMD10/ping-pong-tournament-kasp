"use client";

import { useLiveRefresh } from "@/components/useLiveRefresh";

/**
 * Renders nothing, just keeps a server-rendered page subscribed. Used where the
 * page has no interactive component of its own but still has to react — the
 * draw page waiting to be started, the homepage waiting for it to go on air.
 */
export function LiveWatch({ tables }: { tables: string[] }) {
  useLiveRefresh(tables);
  return null;
}

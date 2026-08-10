"use client";

import { motion } from "motion/react";
import { Sparkles, Trophy } from "lucide-react";

export function HeroBadge({ label, isChampion }: { label: string; isChampion?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-md"
    >
      {isChampion ? (
        <Trophy className="h-4 w-4 text-accent" />
      ) : (
        <Sparkles className="h-4 w-4 text-accent" />
      )}
      <span className="text-[14px] font-medium text-fg/90">{label}</span>
    </motion.div>
  );
}

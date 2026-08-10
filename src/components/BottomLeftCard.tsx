"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

export function BottomLeftCard({
  count,
  label,
  ctaLabel,
  ctaHref,
}: {
  count: number;
  label: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="absolute bottom-28 left-4 right-auto z-20 flex w-fit min-w-[140px] flex-col gap-2 rounded-[1.2rem] border border-white/40 bg-white/75 p-3 shadow-lg shadow-black/5 backdrop-blur-xl md:bottom-6 md:left-6 md:min-w-[150px] md:gap-3 md:rounded-[1.5rem] md:p-4 lg:bottom-10 lg:left-10 lg:min-w-[180px] lg:rounded-[2.2rem] lg:p-5"
    >
      <div className="flex flex-col">
        <span className="text-2xl font-medium tracking-tight text-fg md:text-3xl">{count}</span>
        <span className="text-[12px] font-medium uppercase tracking-wider text-fg/70 md:text-[13px]">
          {label}
        </span>
      </div>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="self-start">
        <Link
          href={ctaHref}
          className="btn-navy group flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-5 shadow-sm"
        >
          <div className="flex items-center justify-center rounded-full bg-white/20 p-1">
            <ArrowUpRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-0.5" />
          </div>
          <span className="text-[14px] font-semibold text-white">{ctaLabel}</span>
        </Link>
      </motion.div>
    </motion.div>
  );
}

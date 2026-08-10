"use client";

import { motion } from "motion/react";

export function HeroText({
  champion,
  championTitle,
  title1,
  title2,
  lede,
}: {
  champion: string | null;
  championTitle: string;
  title1: string;
  title2: string;
  lede: string;
}) {
  return (
    <>
      <motion.h1
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-4 max-w-3xl text-[2.25rem] font-normal leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
      >
        {champion ? (
          <>
            {championTitle}: <span className="text-[#f0c56a]">{champion}</span>
          </>
        ) : (
          <>
            {title1}
            <br />
            <span className="text-accent">{title2}</span>
          </>
        )}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="max-w-xl text-sm font-normal leading-relaxed text-white/70 sm:text-base"
      >
        {lede}
      </motion.p>
    </>
  );
}

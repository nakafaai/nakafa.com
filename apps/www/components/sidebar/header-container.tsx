"use client";

import { motion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

export function HeaderContainer({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();

  const borderOpacity = useTransform(scrollY, [0, 50], [0, 1]);

  return (
    <motion.header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background/30 backdrop-blur-xs lg:hidden">
      <motion.div
        className="absolute right-0 bottom-0 left-0 h-[1px] bg-border"
        style={{ opacity: borderOpacity }}
      />
      {children}
    </motion.header>
  );
}

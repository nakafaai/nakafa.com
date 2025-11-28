"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { motion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

const BORDER_OPACITY_MIN = 0;
const BORDER_OPACITY_MAX = 1;
const BORDER_OPACITY_THRESHOLD_MIN = 0;
const BORDER_OPACITY_THRESHOLD_MAX = 50;

export function HeaderContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();

  //chat page not using window scroll
  const isChat = pathname.includes("/chat");

  const borderOpacity = useTransform(
    scrollY,
    [BORDER_OPACITY_THRESHOLD_MIN, BORDER_OPACITY_THRESHOLD_MAX],
    [BORDER_OPACITY_MIN, BORDER_OPACITY_MAX]
  );

  return (
    <motion.header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background/80 backdrop-blur-xs lg:hidden">
      <motion.div
        className="absolute right-0 bottom-0 left-0 h-[1px] bg-border"
        style={{ opacity: isChat ? 1 : (borderOpacity ?? 0) }}
      />
      {children}
    </motion.header>
  );
}

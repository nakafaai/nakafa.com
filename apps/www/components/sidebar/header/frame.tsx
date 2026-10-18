"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import {
  domAnimation,
  LazyMotion,
  useScroll,
  useTransform,
} from "motion/react";
// biome-ignore lint/performance/noNamespaceImport: Motion documents this namespace for the smaller LazyMotion entrypoint.
import * as m from "motion/react-m";
import type { ReactNode } from "react";

const BORDER_OPACITY_MIN = 0;
const BORDER_OPACITY_MAX = 1;
const BORDER_OPACITY_THRESHOLD_MIN = 0;
const BORDER_OPACITY_THRESHOLD_MAX = 50;

/**
 * The app's bar on a phone, for a page that draws no header of its own. A page header
 * holds the sidebar's trigger itself, so the bar hides while one is on the page and the
 * phone shows one header row.
 */
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
    <LazyMotion features={domAnimation} strict>
      <m.header
        className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background group-has-[[data-shell-title]]/sidebar-wrapper:hidden group-data-titled/sidebar-wrapper:hidden lg:hidden"
        data-slot="app-header"
      >
        <m.div
          className="absolute right-0 bottom-0 left-0 h-px bg-border"
          style={{ opacity: isChat ? 1 : (borderOpacity ?? 0) }}
        />
        {children}
      </m.header>
    </LazyMotion>
  );
}

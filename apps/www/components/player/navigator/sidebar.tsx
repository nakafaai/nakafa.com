"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { keepVisible } from "@/components/player/navigator/scroll";
import { usePlayer } from "@/components/player/provider";

/**
 * The navigator beside the questions from the large breakpoint: a column that
 * stays under the header while the questions scroll, and scrolls by itself to
 * keep the current number in view. The page never moves for it.
 */
export function PlayerSidebar({ children }: { children: ReactNode }) {
  const t = useTranslations("Player");
  const current = usePlayer((state) => state.current);
  const column = useRef<HTMLElement>(null);

  useEffect(() => {
    const cell = column.current?.querySelector<HTMLElement>(
      '[aria-current="step"]'
    );
    if (!(column.current && cell) || current === null) {
      return;
    }
    column.current.scrollTop = keepVisible({
      bottom: cell.offsetTop + cell.offsetHeight,
      height: column.current.clientHeight,
      scrollTop: column.current.scrollTop,
      top: cell.offsetTop,
    });
  }, [current]);

  return (
    <aside
      aria-label={t("navigator")}
      className="sticky top-16 hidden h-[calc(100svh-8rem-env(safe-area-inset-bottom,0px))] w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex"
      data-player-sidebar=""
      ref={column}
    >
      {children}
    </aside>
  );
}

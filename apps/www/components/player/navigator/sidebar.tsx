"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { PlayerCounts } from "@/components/player/navigator/counts";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerViewToggle } from "@/components/player/navigator/view";

/** Shortcut rows of the legend, in the order the footer reads. */
const SHORTCUTS = [
  { keys: ["←", "→"], label: "shortcut-step" },
  { keys: ["F"], label: "shortcut-flag" },
  { keys: ["1-5"], label: "shortcut-pick" },
  { keys: ["G"], label: "shortcut-navigator" },
] as const;

/**
 * The wide-screen navigator: a sticky column beside the questions that keeps
 * the current number in view as the reader scrolls.
 */
export function PlayerSidebar() {
  const t = useTranslations("Player");
  const questions = usePlayer((session) => session.state.questions);
  const current = usePlayerView((view) => view.current);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const aside = asideRef.current;
    const cell = aside?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!(aside && cell) || current === null) {
      return;
    }
    keepCellVisible(aside, cell);
  }, [current]);

  return (
    <aside
      className="sticky top-16 hidden h-[calc(100svh-8rem-env(safe-area-inset-bottom,0px))] w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex"
      ref={asideRef}
    >
      <PlayerCounts />
      <nav aria-label={t("navigator")} data-player-sidebar="">
        <PlayerGrid questions={questions} />
      </nav>
      <PlayerViewToggle />
      <section aria-label={t("shortcuts")} className="mt-auto space-y-2">
        <h2 className="font-medium text-sm">{t("shortcuts")}</h2>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-muted-foreground text-xs">
          {SHORTCUTS.map((shortcut) => (
            <div className="contents" key={shortcut.label}>
              <dt className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <Badge key={key} render={<kbd />} variant="outline">
                    {key}
                  </Badge>
                ))}
              </dt>
              <dd>{t(shortcut.label)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}

/**
 * Scrolls only the sidebar so the current cell stays visible on long grids;
 * the page itself never moves.
 */
function keepCellVisible(aside: HTMLElement, cell: HTMLElement) {
  const top = cell.offsetTop;
  const bottom = top + cell.offsetHeight;
  if (top < aside.scrollTop) {
    aside.scrollTop = top;
  } else if (bottom > aside.scrollTop + aside.clientHeight) {
    aside.scrollTop = bottom - aside.clientHeight;
  }
}

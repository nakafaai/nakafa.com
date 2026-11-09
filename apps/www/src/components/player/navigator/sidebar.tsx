import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { keepVisible } from "@/components/player/navigator/scroll";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";
import { usePlayer } from "@/components/player/provider";
import { PaneHeader } from "@/components/shared/pane";

/**
 * The navigator in its pane beside the questions from the large breakpoint: the
 * numbers, then the keys, in a column as wide as its pane that stays under the
 * header while the questions scroll, and scrolls by itself to keep the current
 * number in view. The page never moves for it.
 */
export function PlayerSidebar({ children }: { children: ReactNode }) {
  const tCommon = useTranslations("Common");
  const current = usePlayer((state) => state.current);
  const column = useRef<HTMLDivElement>(null);

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
    // The pane holds the column. It scrolls in the scroll area's viewport, under an overlay bar that takes no room;
    // the viewport is what keeps the current number in view.
    <div
      className="hidden h-full min-h-0 w-full min-w-0 flex-col lg:flex"
      data-player-sidebar=""
    >
      <PaneHeader title={tCommon("exam-questions")} />
      <ScrollArea viewportClassName="relative" viewportRef={column}>
        <div className="flex flex-col gap-4 px-6 py-4">
          {children}
          <PlayerShortcuts />
        </div>
      </ScrollArea>
    </div>
  );
}

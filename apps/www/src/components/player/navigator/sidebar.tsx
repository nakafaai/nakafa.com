import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { keepVisible } from "@/components/player/navigator/scroll";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";
import { usePlayer } from "@/components/player/provider";

/**
 * The navigator in its pane beside the questions from the large breakpoint: the
 * numbers, then the keys, in a column as wide as its pane that stays under the
 * header while the questions scroll, and scrolls by itself to keep the current
 * number in view. The page never moves for it.
 */
export function PlayerSidebar({ children }: { children: ReactNode }) {
  const t = useTranslations("Player");
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
    // The aside is the column that sticks under the header, since a scroll area's root is positioned to hold
    // its bar. The column scrolls in the scroll area's viewport inside it, under an overlay bar that takes no
    // room; the viewport is what keeps the current number in view.
    <aside
      aria-label={t("navigator")}
      className="sticky top-16 hidden h-[calc(100svh-8rem-env(safe-area-inset-bottom,0px))] w-full min-w-0 lg:block"
      data-player-sidebar=""
    >
      <ScrollArea viewportClassName="relative" viewportRef={column}>
        <div className="flex flex-col gap-4 px-6 py-4">
          {children}
          <PlayerShortcuts />
        </div>
      </ScrollArea>
    </aside>
  );
}

"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { PlayerCounts } from "@/components/player/navigator/counts";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerViewToggle } from "@/components/player/navigator/view";

/** Id the footer opener points its `aria-controls` at. */
export const PLAYER_SHEET_ID = "player-navigator";

/**
 * The small-screen navigator: a bottom sheet opened from the footer. Picking
 * a number closes it first and jumps once the close animation ends.
 */
export function PlayerSheet() {
  const t = useTranslations("Player");
  const tCommon = useTranslations("Common");
  const questions = usePlayer((session) => session.state.questions);
  const close = usePlayerView((view) => view.close);
  const open = usePlayerView((view) => view.open);
  const overlay = usePlayerView((view) => view.overlay);
  const pending = usePlayerView((view) => view.pending);
  const settle = usePlayerView((view) => view.settle);
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet
      onOpenChange={(next) => (next ? open("navigator") : close())}
      onOpenChangeComplete={(next) => {
        if (!next) {
          settle();
        }
      }}
      open={overlay === "navigator"}
    >
      <SheetPopup
        className="pb-[env(safe-area-inset-bottom,0px)]"
        finalFocus={pending === null}
        id={PLAYER_SHEET_ID}
        initialFocus={() =>
          gridRef.current?.querySelector<HTMLElement>(
            '[aria-current="step"]'
          ) ?? true
        }
        showCloseButton={false}
        side="bottom"
      >
        <SheetHeader className="flex-row items-start justify-between gap-4">
          <div className="grid gap-2">
            <SheetTitle>{t("navigator")}</SheetTitle>
            <SheetDescription render={<div />}>
              <PlayerCounts />
            </SheetDescription>
          </div>
          <SheetClose
            render={
              <Button
                aria-label={tCommon("close")}
                size="icon"
                variant="ghost"
              />
            }
          >
            <HugeIcons icon={Cancel01Icon} />
          </SheetClose>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4" ref={gridRef}>
          <PlayerGrid questions={questions} />
          <PlayerViewToggle />
        </div>
      </SheetPopup>
    </Sheet>
  );
}

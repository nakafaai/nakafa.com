"use client";

import {
  Sheet,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { monospace } from "@repo/design-system/lib/monospace";
import { cn } from "cn";
import { type ReactNode, useRef } from "react";
import { useTranslations } from "use-intl";
import { usePlayer } from "@/components/player/provider";

/**
 * The navigator below the large breakpoint: a sheet that the footer opens. It
 * opens on the current number. Picking a number closes the sheet first, and
 * the question is revealed once the sheet has finished closing, because the
 * page cannot scroll while the sheet holds it.
 */
export function PlayerSheet({ children }: { children: ReactNode }) {
  const t = useTranslations("Player");
  const overlay = usePlayer((state) => state.overlay);
  const waiting = usePlayer((state) => state.pending !== null);
  const open = usePlayer((state) => state.open);
  const close = usePlayer((state) => state.close);
  const settle = usePlayer((state) => state.settle);
  const body = useRef<HTMLDivElement>(null);

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
        finalFocus={!waiting}
        initialFocus={() =>
          body.current?.querySelector<HTMLElement>('[aria-current="step"]') ??
          true
        }
        side="bottom"
      >
        <SheetHeader>
          <SheetTitle>{t("navigator")}</SheetTitle>
        </SheetHeader>
        <div className={cn(monospace, "grid gap-4 p-4")} ref={body}>
          {children}
        </div>
      </SheetPopup>
    </Sheet>
  );
}

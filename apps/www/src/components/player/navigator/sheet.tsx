import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { monospace } from "@repo/design-system/lib/monospace";
import { cn } from "cn";
import { type ReactNode, useRef } from "react";
import { useTranslations } from "use-intl";
import { usePlayer } from "@/components/player/provider";

/**
 * The navigator below the large breakpoint: a drawer that the footer opens, with
 * the numbers and their legend in its body. It opens on the current number.
 * Picking a number closes the drawer first, and the question is revealed once
 * the drawer has finished closing, because the page cannot scroll while the
 * drawer holds it.
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
    <Drawer
      onOpenChange={(next) => (next ? open("navigator") : close())}
      onOpenChangeComplete={(next) => {
        if (!next) {
          settle();
        }
      }}
      open={overlay === "navigator"}
      showSwipeHandle
    >
      <DrawerContent
        finalFocus={!waiting}
        initialFocus={() =>
          body.current?.querySelector<HTMLElement>('[aria-current="step"]') ??
          true
        }
      >
        <DrawerHeader>
          <DrawerTitle>{t("navigator")}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className={cn(monospace, "grid gap-4")} ref={body}>
          {children}
        </DrawerPanel>
      </DrawerContent>
    </Drawer>
  );
}

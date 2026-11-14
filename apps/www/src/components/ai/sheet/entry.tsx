"use client";

import { ArrowUpRight01Icon, StarsIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useEarlyPress } from "@repo/design-system/hooks/press";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { useAi } from "@/components/ai/context";

const FIRST_INTERACTION = ["keydown", "pointerdown", "scroll"] as const;

/**
 * Renders the sticky Nina entry button for the current page: a bar docked to
 * the bottom of a phone's page, and a floating button from a tablet. It is part of
 * the page's HTML, and the sheet behind it is warmed before the press: once
 * the reader first interacts with the page, and again on intent. A press
 * before React takes the page over opens the sheet once React mounts the
 * button (`useEarlyPress`).
 */
export function SheetEntry({ contextTitle = "" }: { contextTitle?: string }) {
  const open = useAi((state) => state.open);
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);
  const warm = useAi((state) => state.warm);
  const t = useTranslations("Ai");

  // A reader who scrolls, types or presses is reading this page, so the sheet
  // renders its body in the browser's next idle moment. A visit that never
  // interacts never loads the body.
  useEffect(() => {
    const controller = new AbortController();
    function warmWhenIdle() {
      controller.abort();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(warm);
        return;
      }
      warm();
    }
    for (const type of FIRST_INTERACTION) {
      // Captured, because a scroll inside a nested container does not bubble.
      window.addEventListener(type, warmWhenIdle, {
        capture: true,
        passive: true,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
  }, [warm]);

  /** Opens Nina with the current page title ready for default suggestions. */
  function handleOpen() {
    setContextTitle(contextTitle.trim() || null);
    setOpen(!open);
  }

  const press = useEarlyPress<HTMLButtonElement>(handleOpen);

  // On a phone the strip is a bar docked to the bottom of the page, on the page's own surface with a line above it
  // and the home indicator's room below, so the text scrolls under a whole edge and the button never lies on a
  // heading. From a tablet the button floats, and the strip spans the page's width, so only the button takes a
  // press: a control beside it, such as a comment's Post, stays pressable.
  return (
    <aside
      className="group/entry max-sm:bg-background sticky right-0 bottom-0 left-0 z-50 transition-[opacity,translate] duration-300 ease-out data-open:translate-y-50 data-open:opacity-0 motion-reduce:transition-none max-sm:border-t max-sm:px-4 max-sm:pt-3 max-sm:pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(3))] sm:pointer-events-none sm:px-6 sm:pb-6"
      data-open={open ? "" : undefined}
      inert={open}
    >
      <div className="mx-auto sm:max-w-xs">
        <Button
          {...press}
          className="pointer-events-auto w-full justify-between transition-transform duration-200 group-data-open/entry:pointer-events-none sm:hover:scale-105"
          onFocus={warm}
          onMouseEnter={warm}
          onPointerDown={warm}
          size="lg"
          variant="default-outline"
        >
          <div className="flex items-center gap-2">
            <HugeIcons icon={StarsIcon} />
            <span>{t("ask-nina")}</span>
          </div>

          <HugeIcons icon={ArrowUpRight01Icon} />
        </Button>
      </div>
    </aside>
  );
}

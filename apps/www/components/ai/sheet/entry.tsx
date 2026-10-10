"use client";

import { ArrowUpRight01Icon, StarsIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useAi } from "@/components/ai/context";

const FIRST_INTERACTION = ["keydown", "pointerdown", "scroll"] as const;

/**
 * Renders the sticky Nina entry button for the current page. It is part of
 * the page's HTML, and the sheet behind it is warmed before the press: once
 * the reader first interacts with the page, and again on intent.
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

  return (
    <aside
      className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6 transition-[opacity,translate] duration-300 ease-out data-open:pointer-events-none data-open:translate-y-50 data-open:opacity-0 motion-reduce:transition-none"
      data-open={open ? "" : undefined}
      inert={open}
    >
      <div className="mx-auto sm:max-w-xs">
        <Button
          className="w-full justify-between transition-transform duration-200 hover:scale-105"
          onClick={handleOpen}
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

"use client";

import { ArrowUpRight01Icon, StarsIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent } from "react";
import { useAi } from "@/components/ai/context";
import { preloadAiSheet } from "@/components/ai/sheet/module";

const FIRST_INTERACTION = ["keydown", "pointerdown", "scroll"] as const;

/**
 * Renders the sticky Nina entry button for the current page. It is part of
 * the page's HTML, and its sheet body is warmed before the press: once the
 * learner first interacts with the page, and again on intent.
 */
export function SheetEntry({ contextTitle = "" }: { contextTitle?: string }) {
  const open = useAi((state) => state.open);
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);
  const hasChat = useAi((state) => state.activeChatId !== null);
  const t = useTranslations("Ai");

  /** Warms the body the sheet will show: the open chat, or the new-chat one. */
  function preload() {
    Effect.runFork(preloadAiSheet(hasChat));
  }
  const preloadWhenIdle = useEffectEvent(preload);

  // A learner who scrolls, types or presses is reading this page, so the
  // browser fetches the body in its next idle moment. A visit that never
  // interacts loads nothing.
  useEffect(() => {
    const controller = new AbortController();
    function warm() {
      controller.abort();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => preloadWhenIdle());
        return;
      }
      preloadWhenIdle();
    }
    for (const type of FIRST_INTERACTION) {
      window.addEventListener(type, warm, {
        passive: true,
        signal: controller.signal,
      });
    }
    return () => controller.abort();
  }, []);

  /** Opens Nina with the current page title ready for default suggestions. */
  function handleOpen() {
    preload();
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
          onFocus={preload}
          onMouseEnter={preload}
          onPointerDown={preload}
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

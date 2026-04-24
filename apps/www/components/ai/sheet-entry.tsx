"use client";

import { ArrowUpRight01Icon, StarsIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context/use-ai";
import { usePageTitle } from "@/components/ai/context/use-page-title";

const SLIDE_DISTANCE = 200;

/** Renders the sticky Nina entry button when no audio toolbar is available. */
export function SheetEntry() {
  const contextTitle = usePageTitle();
  const open = useAi((state) => state.open);
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  /** Opens Nina with the current page title ready for default suggestions. */
  function handleOpen() {
    setContextTitle(contextTitle || null);
    setOpen(!open);
  }

  return (
    <motion.aside
      animate={{
        opacity: open ? 0 : 1,
        y: open ? SLIDE_DISTANCE : 0,
      }}
      className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6"
      initial={{ y: SLIDE_DISTANCE, opacity: 0 }}
      key="button"
      transition={{
        duration: 0.3,
        ease: "easeOut",
      }}
    >
      <div className="mx-auto sm:max-w-xs">
        <Button
          className="w-full justify-between duration-200 hover:scale-105"
          onClick={handleOpen}
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
    </motion.aside>
  );
}

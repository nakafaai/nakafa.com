"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAi } from "@/lib/context/use-ai";

const NEAR_BOTTOM_THRESHOLD = 0.95;
const SLIDE_DISTANCE = 200;

export function AiSheetOpen() {
  const setOpen = useAi((state) => state.setOpen);
  const open = useAi((state) => state.open);
  const t = useTranslations("Ai");

  const { scrollYProgress } = useScroll();
  const [isNearBottom, setIsNearBottom] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setIsNearBottom(latest > NEAR_BOTTOM_THRESHOLD);
  });

  const shouldHide = isNearBottom || open;

  return (
    <AnimatePresence mode="popLayout">
      {shouldHide ? (
        <div className="px-6 pb-6">
          <div className="mx-auto sm:max-w-xs">
            <div className="block h-10 w-full" />
          </div>
        </div>
      ) : (
        <motion.aside
          animate={{
            y: 0,
            opacity: 1,
          }}
          className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6"
          exit={{
            y: SLIDE_DISTANCE,
            opacity: 0,
          }}
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
              onClick={() => setOpen(true)}
              size="lg"
              variant="default-outline"
            >
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4" />
                <span>{t("ask-nina")}</span>
              </div>

              <ArrowUpRightIcon className="size-4" />
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

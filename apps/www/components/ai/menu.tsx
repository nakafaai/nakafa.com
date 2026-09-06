"use client";

import { StarsIcon } from "@hugeicons/core-free-icons";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context/use-ai";
import { preloadAiSheet } from "@/components/ai/sheet-module";

/** Opens the existing Nina sheet with the current reading context. */
export function AiMenuItem({ contextTitle }: { contextTitle: string }) {
  const t = useTranslations("Ai");
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);

  function preload() {
    Effect.runFork(preloadAiSheet());
  }

  function handleOpen() {
    preload();
    setContextTitle(contextTitle);
    setOpen(true);
  }

  return (
    <DropdownMenuItem
      onClick={handleOpen}
      onFocus={preload}
      onMouseEnter={preload}
    >
      <HugeIcons icon={StarsIcon} />
      {t("ask-nina")}
    </DropdownMenuItem>
  );
}

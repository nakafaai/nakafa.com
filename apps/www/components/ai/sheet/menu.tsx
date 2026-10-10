"use client";

import { StarsIcon } from "@hugeicons/core-free-icons";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context";

/** Opens the existing Nina sheet with the current reading context. */
export function AiMenuItem({ contextTitle }: { contextTitle: string }) {
  const t = useTranslations("Ai");
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);
  const warm = useAi((state) => state.warm);

  function handleOpen() {
    setContextTitle(contextTitle);
    setOpen(true);
  }

  return (
    <DropdownMenuItem onClick={handleOpen} onFocus={warm} onMouseEnter={warm}>
      <HugeIcons icon={StarsIcon} />
      {t("ask-nina")}
    </DropdownMenuItem>
  );
}

"use client";

import {
  ArrowDown01Icon,
  Calculator01Icon,
  EqualSignIcon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data-parts";
import { BlockMathKatex } from "@repo/design-system/components/markdown/math";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

interface Props {
  message: DataPart["calculator"];
}

export const CalculatorPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const [open, setOpen] = useState(true);

  const error = message.status === "error";

  return (
    <Collapsible
      className="overflow-hidden rounded-md border"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between bg-muted/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeIcons
            className={cn("size-4", error && "text-destructive")}
            icon={error ? Sad02Icon : Calculator01Icon}
          />
          <span className="text-sm">{t("calculator")}</span>
        </div>
        <HugeIcons
          className={cn(
            "size-4 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t bg-muted/40 px-4 text-sm">
        <BlockMathKatex>{message.original.latex}</BlockMathKatex>

        <div className="flex items-center justify-center">
          <HugeIcons className="size-4" icon={EqualSignIcon} />
        </div>

        <BlockMathKatex>{message.result.latex}</BlockMathKatex>
      </CollapsibleContent>
    </Collapsible>
  );
});
CalculatorPart.displayName = "CalculatorPart";

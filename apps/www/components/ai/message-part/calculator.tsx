"use client";

import type { DataPart } from "@repo/ai/types/data-parts";
import { BlockMathKatex } from "@repo/design-system/components/markdown/math";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { cn } from "@repo/design-system/lib/utils";
import {
  CalculatorIcon,
  ChevronDownIcon,
  EqualIcon,
  FrownIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

type Props = {
  message: DataPart["calculator"];
};

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
          {error ? (
            <FrownIcon className="size-4 text-destructive" />
          ) : (
            <CalculatorIcon className="size-4" />
          )}
          <span className="text-sm">{t("calculator")}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t bg-muted/40 px-4 text-sm">
        <BlockMathKatex>{message.original.latex}</BlockMathKatex>

        <EqualIcon className="size-4" />

        <BlockMathKatex>{message.result.latex}</BlockMathKatex>
      </CollapsibleContent>
    </Collapsible>
  );
});
CalculatorPart.displayName = "CalculatorPart";

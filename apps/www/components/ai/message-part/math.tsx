"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { DataPart } from "@repo/ai/schema/data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { MathEvidence } from "@/components/ai/message-part/math/evidence";
import { getMathIcon } from "@/components/ai/message-part/math/icons";

interface Props {
  message: DataPart["math"];
}

/** Renders one deterministic math evidence part in the chat transcript. */
export const MathPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(false);

  return (
    <Collapsible
      className="not-prose flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <HugeIcons
          className={cn(
            "size-4 shrink-0",
            message.status === "error" ? "text-destructive" : undefined
          )}
          icon={getMathIcon(message.kind)}
        />
        <span className="truncate">{t(`math-${message.kind}`)}</span>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none">
        <MathEvidence message={message} />
      </CollapsibleContent>
    </Collapsible>
  );
});
MathPart.displayName = "MathPart";

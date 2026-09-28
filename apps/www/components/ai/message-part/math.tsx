"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { useTranslations } from "next-intl";

import { MathEvidence } from "@/components/ai/message-part/math/evidence";
import { getMathIcon } from "@/components/ai/message-part/math/icons";

interface Props {
  message: DataPart["math"];
}

/** Renders one deterministic math evidence part in the chat transcript. */
export function MathPart({ message }: Props) {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(false);

  return (
    <Collapsible
      className="not-prose flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 text-sm transition-colors",
          message.status === "error"
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <HugeIcons
          className="size-4 shrink-0"
          icon={getMathIcon(message.kind)}
        />
        <span className="truncate">
          {message.status === "error"
            ? t("tool-failures.math")
            : t(`math-${message.kind}`)}
        </span>
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
}
MathPart.displayName = "MathPart";

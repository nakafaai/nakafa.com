"use client";

import { AlertCircleIcon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
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
import type { ComponentProps, ReactNode } from "react";
import { StepDetails, StepLabel } from "@/components/ai/message/evidence/step";

interface Props {
  children: ReactNode;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  message: DataPart["math"];
}

/**
 * Frames one deterministic math result as a step that opens. Callers render its
 * evidence body and choose its operation icon, so this shell never loads the
 * full icon map. Its label and its arrow sit like the activity row above it:
 * the arrow right after the words and always shown, and the body where the
 * words start.
 */
export function MathPart({ children, icon, message }: Props) {
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
          "group/math flex w-fit max-w-full cursor-pointer items-start gap-2 rounded-sm text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          message.status === "error"
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {/* The label wraps, so a long one in any language is read in full. */}
        <StepLabel icon={message.status === "error" ? AlertCircleIcon : icon}>
          {message.status === "error"
            ? t("tool-failures.math")
            : t(`math-${message.kind}`)}
        </StepLabel>
        <HugeIcons
          className={cn(
            "mt-0.5 size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      {/* Math takes the size of the words around it, as every text of a step does: KaTeX alone would draw it a fifth larger. */}
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none [&_.katex]:text-[1em]">
        <StepDetails>{children}</StepDetails>
      </CollapsibleContent>
    </Collapsible>
  );
}
MathPart.displayName = "MathPart";

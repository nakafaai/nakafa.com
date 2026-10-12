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
import type { ComponentProps, ReactNode } from "react";

interface Props {
  children: ReactNode;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  message: DataPart["math"];
}

/**
 * Frames one deterministic math result. Callers render its evidence body and
 * choose its operation icon, so this shell never loads the full icon map.
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
          "group/math flex w-full cursor-pointer items-start gap-2 text-start text-sm transition-colors",
          message.status === "error"
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <HugeIcons className="mt-0.5 size-4 shrink-0" icon={icon} />
        {/* The label wraps, so a long one in any language is read in full. */}
        <span className="min-w-0 flex-1">
          {message.status === "error"
            ? t("tool-failures.math")
            : t(`math-${message.kind}`)}
        </span>
        <HugeIcons
          className={cn(
            "mt-0.5 size-4 shrink-0 transition-[opacity,rotate] duration-150 group-hover/math:opacity-100 group-focus-visible/math:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:opacity-0",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
MathPart.displayName = "MathPart";

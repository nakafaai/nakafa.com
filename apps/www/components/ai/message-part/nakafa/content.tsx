"use client";

import { ArrowDown01Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface Props {
  message: Extract<NakafaDataPart, { kind: "content"; status: "done" }>;
}

/** Renders a bounded preview for one retrieved Nakafa content page. */
export const ContentPart = ({ message }: Props) => {
  const t = useTranslations("Ai");
  const [open, setOpen] = useState(true);

  return (
    <Collapsible
      className="overflow-hidden rounded-md border"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between bg-muted/80 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeIcons className="size-4 shrink-0" icon={BookOpen02Icon} />
          <span className="truncate text-sm">{t("nakafa-content")}</span>
        </div>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform ease-out",
            open ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsiblePanel className="border-t bg-muted/40">
        <a
          className="grid gap-2 p-4"
          href={message.result.url}
          rel="noopener noreferrer"
          target="_blank"
          title={message.result.url}
        >
          <p className="text-sm">{message.result.title}</p>
          <span className="text-muted-foreground text-sm">
            {message.result.description}
          </span>
        </a>
      </CollapsiblePanel>
    </Collapsible>
  );
};
ContentPart.displayName = "ContentPart";

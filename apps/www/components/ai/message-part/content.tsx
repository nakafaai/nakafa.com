"use client";

import type { DataPart } from "@repo/ai/types/data-parts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { BookOpenIcon, ChevronDownIcon, FrownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, type PropsWithChildren, useState } from "react";

type Props = {
  message: DataPart["get-content"];
};

export const ContentPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const isLoading = message.status === "loading";
  const isError = message.status === "error";

  const [open, setOpen] = useState(true);

  if (isLoading) {
    return (
      <ContentCard>
        <SpinnerIcon className="size-4" />
        <p className="text-sm">{t("get-content-loading")}</p>
      </ContentCard>
    );
  }

  if (isError) {
    return (
      <ContentCard>
        <FrownIcon className="size-4" />
        <p className="text-sm">{t("get-content-error")}</p>
      </ContentCard>
    );
  }

  return (
    <Collapsible
      className="overflow-hidden rounded-md border"
      defaultOpen={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between bg-muted/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpenIcon className="size-4" />
          <span className="text-sm">{t("get-content")}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-4 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t bg-muted/40">
        <a
          className="grid gap-2 p-4"
          href={message.url}
          rel="noopener noreferrer"
          target="_blank"
          title={message.url}
        >
          <p className="text-sm">{message.title}</p>
          <span className="text-muted-foreground text-sm">
            {message.description}
          </span>
        </a>
      </CollapsibleContent>
    </Collapsible>
  );
});
ContentPart.displayName = "ContentPart";

const ContentCard = memo(
  ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className="overflow-hidden rounded-md border">
      <div
        className={cn(
          "flex w-full items-center gap-2 bg-muted/80 px-4 py-3",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
);
ContentCard.displayName = "ContentCard";

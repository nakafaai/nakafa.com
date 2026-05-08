"use client";

import { ArrowUpRight01Icon, Task01Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: Extract<NakafaDataPart, { kind: "exercise"; status: "done" }>;
}

/** Renders a compact exercise-set or exercise-question preview. */
export const ExercisePart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-muted-foreground" icon={Task01Icon} />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-exercise")}
        </span>
        <Badge variant="muted">{message.result.count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {message.result.numbers.map((number) => (
          <Badge key={number} variant="outline">
            {number}
          </Badge>
        ))}
        <Button
          className="max-w-full"
          nativeButton={false}
          render={
            <a
              className="min-w-0"
              href={message.result.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="truncate">{message.result.title}</span>
              <HugeIcons icon={ArrowUpRight01Icon} />
            </a>
          }
          size="sm"
          variant="outline"
        />
      </div>
    </div>
  );
});
ExercisePart.displayName = "ExercisePart";

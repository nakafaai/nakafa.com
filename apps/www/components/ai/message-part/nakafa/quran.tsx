"use client";

import { ArrowUpRight01Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: Extract<NakafaDataPart, { kind: "quran"; status: "done" }>;
}

/** Renders a compact Quran reference preview. */
export const QuranPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={BookOpen02Icon}
        />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-quran")}
        </span>
        <Badge variant="muted">{message.result.verse_count}</Badge>
      </div>
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
            <span className="truncate">
              {message.result.name}: {message.result.from_verse}-
              {message.result.to_verse}
            </span>
            <HugeIcons icon={ArrowUpRight01Icon} />
          </a>
        }
        size="sm"
        variant="outline"
      />
    </div>
  );
});
QuranPart.displayName = "QuranPart";

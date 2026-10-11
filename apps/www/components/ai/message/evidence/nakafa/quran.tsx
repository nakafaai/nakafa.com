"use client";

import { ArrowUpRight01Icon, Quran02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

interface Props {
  message: Extract<NakafaDataPart, { kind: "quran"; status: "done" }>;
}

/** Renders a compact Quran reference preview. */
export function QuranPart({ message }: Props) {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={Quran02Icon}
        />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-quran")}
        </span>
      </div>
      <div className="ms-2 flex flex-col gap-3 border-s ps-4">
        <Button
          className="max-w-full self-start"
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
    </div>
  );
}
QuranPart.displayName = "QuranPart";

"use client";

import { ArrowUpRight01Icon, Quran02Icon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/backend/confect/nina/contract/data";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

interface Props {
  message: Extract<NakafaDataPart, { kind: "quran"; status: "done" }>;
}

/**
 * Renders a compact Quran reference preview: the surah, and the verse or the
 * verses of it. The name gives way first when the row is narrow, because the
 * numbers are what a learner compares.
 */
export function QuranPart({ message }: Props) {
  const t = useTranslations("Ai");
  const { from_verse: from, name, to_verse: to, url } = message.result;

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
      <Button
        className="max-w-full self-start"
        nativeButton={false}
        render={
          <a
            className="min-w-0"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="flex min-w-0">
              <span className="truncate">{name}</span>
              <span className="shrink-0">
                : {from === to ? from : `${from}-${to}`}
              </span>
            </span>
            <HugeIcons icon={ArrowUpRight01Icon} />
          </a>
        }
        size="sm"
        variant="outline"
      />
    </div>
  );
}
QuranPart.displayName = "QuranPart";

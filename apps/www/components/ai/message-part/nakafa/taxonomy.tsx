"use client";

import { GridIcon } from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: Extract<NakafaDataPart, { kind: "taxonomy"; status: "done" }>;
}

/** Renders the available Nakafa taxonomy sections for one locale. */
export const TaxonomyPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons className="size-4 text-muted-foreground" icon={GridIcon} />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-taxonomy")}
        </span>
        <Badge variant="muted">{message.result.locale}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {message.result.sections.map((section) => (
          <Badge key={section} variant="outline">
            {section}
          </Badge>
        ))}
      </div>
    </div>
  );
});
TaxonomyPart.displayName = "TaxonomyPart";

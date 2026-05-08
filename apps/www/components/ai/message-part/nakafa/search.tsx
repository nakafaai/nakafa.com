"use client";

import {
  ArrowUpRight01Icon,
  LayerIcon,
  Search02Icon,
} from "@hugeicons/core-free-icons";
import type { NakafaDataPart } from "@repo/ai/schema/data";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

const MAX_SHOWN_RESULTS = 5;

interface Props {
  message: Extract<NakafaDataPart, { kind: "search"; status: "done" }>;
}

/** Renders Nakafa search results with a bounded default list. */
export const SearchPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, setExpanded] = useState(false);
  const items = expanded
    ? message.result.items
    : message.result.items.slice(0, MAX_SHOWN_RESULTS);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HugeIcons
          className="size-4 text-muted-foreground"
          icon={Search02Icon}
        />
        <span className="text-muted-foreground text-sm">
          {t("nakafa-search")}
        </span>
        <Badge variant="muted">{message.result.total_count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <Button
            className="max-w-full"
            key={item.content_id}
            nativeButton={false}
            render={
              <a
                className="min-w-0"
                href={item.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="truncate">{item.title}</span>
                <HugeIcons icon={ArrowUpRight01Icon} />
              </a>
            }
            size="sm"
            variant="outline"
          />
        ))}
        {message.result.items.length > MAX_SHOWN_RESULTS && !expanded ? (
          <Button onClick={() => setExpanded(true)} size="sm" variant="outline">
            {t("view-all")}
            <HugeIcons icon={LayerIcon} />
          </Button>
        ) : null}
      </div>
    </div>
  );
});
SearchPart.displayName = "SearchPart";

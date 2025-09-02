"use client";

import type { WebSearchOutput } from "@repo/ai/schema/tools";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: WebSearchOutput;
};

export const WebSearchTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  const isLoading =
    status === "input-streaming" || status === "input-available";

  const results = output?.data.news.concat(output?.data.web) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <SpinnerIcon className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">
          {t("web-search-loading")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{t("web-search")}</span>
      </div>
      {results.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {results.map((item, index) => (
            <Source href={item.url} key={`${item.url}-${index}`}>
              <SourceTrigger showFavicon />
              <SourceContent
                description={item.description}
                title={item.title}
              />
            </Source>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">
          {t("found-results", { count: results.length })}
        </div>
      )}
    </div>
  );
});

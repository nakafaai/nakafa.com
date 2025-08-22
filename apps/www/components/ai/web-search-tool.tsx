"use client";

import type { WebSearchOutput } from "@repo/ai/schema/tools";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
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
  const isLoading =
    status === "input-streaming" || status === "input-available";

  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            className="h-5 w-32 rounded-full"
            key={`web-search-skeleton-${index + 1}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {output?.data.news.map((item) => (
        <Source href={item.url} key={item.url}>
          <SourceTrigger showFavicon />
          <SourceContent description={item.description} title={item.title} />
        </Source>
      ))}
      {output?.data.web.map((item) => (
        <Source href={item.url} key={item.url}>
          <SourceTrigger showFavicon />
          <SourceContent description={item.description} title={item.title} />
        </Source>
      ))}
    </div>
  );
});

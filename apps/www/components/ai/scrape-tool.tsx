"use client";

import type { ScrapeOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { ExternalLinkIcon, ScanSearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: ScrapeOutput;
}

export const ScrapeTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  const isNakafa = output?.data.url?.includes("nakafa.com");

  return (
    <Tool>
      <ToolHeader
        icon={
          <ScanSearchIcon className="size-4 shrink-0 text-muted-foreground" />
        }
        state={status}
        type={t("scrape")}
      />
      <ToolContent>
        <div className="p-3">
          <a
            className="flex items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
            href={output?.data.url ?? ""}
            target={isNakafa ? undefined : "_blank"}
          >
            <span className="max-w-48 truncate sm:max-w-64">
              {output?.data.url}
            </span>
            <ExternalLinkIcon className="ml-1 size-3.5 shrink-0" />
          </a>
        </div>
      </ToolContent>
    </Tool>
  );
});
ScrapeTool.displayName = "ScrapeTool";

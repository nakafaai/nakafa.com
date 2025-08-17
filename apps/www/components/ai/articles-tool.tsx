"use client";

import type { GetArticlesOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { NewspaperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetArticlesOutput;
};

export const ArticlesTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader
        icon={<NewspaperIcon className="size-4 text-muted-foreground" />}
        state={status}
        type={t("get-articles")}
      />
      <ToolContent>
        <div className="p-3">
          <p className="text-muted-foreground text-sm">
            {t("found-articles", {
              count: output?.articles.length ?? 0,
            })}
          </p>
        </div>
      </ToolContent>
    </Tool>
  );
});
ArticlesTool.displayName = "ArticlesTool";

"use client";

import type {
  GetArticlesInput,
  GetArticlesOutput,
} from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { Badge } from "@repo/design-system/components/ui/badge";
import { NewspaperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Partial<GetArticlesInput>;
  output?: GetArticlesOutput;
};

export const ArticlesTool = memo(({ status, output, input }: Props) => {
  const t = useTranslations("Ai");
  const tArticles = useTranslations("Articles");

  return (
    <Tool>
      <ToolHeader
        icon={<NewspaperIcon className="size-4 text-muted-foreground" />}
        state={status}
        type={t("get-articles")}
      />
      <ToolContent>
        <div className="flex flex-col gap-3 p-3">
          {input && (
            <div className="flex flex-wrap gap-2">
              {input.category && (
                <Badge variant="outline">{tArticles(input.category)}</Badge>
              )}
            </div>
          )}
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

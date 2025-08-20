"use client";

import { buildContentSlug } from "@repo/ai/lib/utils";
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
import { buttonVariants } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpRightIcon, NewspaperIcon } from "lucide-react";
import Link from "next/link";
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
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {t("found-articles", {
                count: output?.articles.length ?? 0,
              })}
            </p>
            <Link
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" })
              )}
              href={`/${buildContentSlug({
                locale: "en",
                filters: { type: "articles", category: input?.category },
              })}`}
            >
              <ArrowUpRightIcon />
              {t("see")}
            </Link>
          </div>
        </div>
      </ToolContent>
    </Tool>
  );
});
ArticlesTool.displayName = "ArticlesTool";

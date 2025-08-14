"use client";

import type { GetContentsOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetContentsOutput;
};

export const ContentsTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader state={status} type={t("get-contents")} />
      <ToolContent>
        <div className="p-3">
          <p className="text-muted-foreground text-sm">
            {t("found-contents", {
              count: output?.contents.length ?? 0,
            })}
          </p>
        </div>
      </ToolContent>
    </Tool>
  );
});
ContentsTool.displayName = "ContentsTool";

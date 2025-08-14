"use client";

import type { MathEvalOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { InlineMath } from "@repo/design-system/markdown/math";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: MathEvalOutput;
};

export const MathEvalTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader state={status} type={t("math-eval")} />
      <ToolContent>
        <div className="p-3">
          <p className="text-muted-foreground text-sm">
            <InlineMath>{output?.result.latex ?? ""}</InlineMath>
          </p>
        </div>
      </ToolContent>
    </Tool>
  );
});
MathEvalTool.displayName = "MathEvalTool";

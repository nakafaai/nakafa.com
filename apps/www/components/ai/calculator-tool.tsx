"use client";

import type { CalculatorOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CalculatorIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: CalculatorOutput;
};

export const CalculatorTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader
        icon={
          <CalculatorIcon className="size-4 shrink-0 text-muted-foreground" />
        }
        state={status}
        type={t("calculator")}
      />
      <ToolContent>
        <div className="flex flex-col gap-3 p-3">
          <div className="grid gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              {t("input")}
            </span>
            <p className="text-muted-foreground text-sm">
              <InlineMath>{output?.original.latex ?? ""}</InlineMath>
            </p>
          </div>
          <div className="grid gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              {t("output")}
            </span>
            <p className="text-muted-foreground text-sm">
              <InlineMath>{output?.result.latex ?? ""}</InlineMath>
            </p>
          </div>
        </div>
      </ToolContent>
    </Tool>
  );
});
CalculatorTool.displayName = "CalculatorTool";

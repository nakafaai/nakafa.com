"use client";

import type { MathEvalOutput } from "@repo/ai/schema/tools";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { CalculatorIcon, CheckIcon, FrownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: MathEvalOutput;
} & ComponentProps<"div">;

export const MathEvalTool = memo(
  ({ status, className, output, ...props }: Props) => {
    const t = useTranslations("Ai");

    let icon = <SpinnerIcon className="size-4 shrink-0" />;
    if (status === "output-error") {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }
    if (status === "output-available" && !output) {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }
    if (status === "output-available" && output) {
      icon = <CheckIcon className="size-4 shrink-0" />;
    }

    return (
      <div
        className={cn(
          "relative w-fit rounded-xl border bg-card px-3 py-2 shadow-sm first:mt-0 last:mb-0",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalculatorIcon className="size-4 shrink-0" />
            <p className="font-medium text-sm">{t("math-eval")}</p>
          </div>
          {icon}
        </div>
      </div>
    );
  }
);
MathEvalTool.displayName = "MathEvalTool";

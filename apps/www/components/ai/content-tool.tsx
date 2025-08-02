"use client";

import type { GetContentOutput } from "@repo/ai/schema/tools";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { BookIcon, ExternalLinkIcon, FrownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetContentOutput;
} & ComponentProps<"div">;

export const ContentTool = memo(
  ({ status, className, output, ...props }: Props) => {
    const t = useTranslations("Ai");

    let icon = <SpinnerIcon className="size-4 shrink-0" />;
    if (status === "output-error") {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }
    if (status === "output-available" && !output) {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }
    if (output) {
      icon = <ExternalLinkIcon className="size-4 shrink-0" />;
    }

    return (
      <div
        className={cn(
          "relative flex h-10 w-fit items-center justify-center rounded-xl border bg-card px-3 shadow-sm first:mt-0 last:mb-0",
          className
        )}
        {...props}
      >
        {output && (
          <Link
            className="absolute inset-0 cursor-pointer"
            href={output.url}
            target="_blank"
            type="button"
          />
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookIcon className="size-4 shrink-0" />
            <p className="font-medium text-sm">{t("get-content")}</p>
          </div>
          {icon}
        </div>
      </div>
    );
  }
);
ContentTool.displayName = "ContentTool";

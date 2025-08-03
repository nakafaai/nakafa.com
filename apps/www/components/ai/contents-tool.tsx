"use client";

import type { GetContentsOutput } from "@repo/ai/schema/tools";
import { Badge } from "@repo/design-system/components/ui/badge";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { FrownIcon, LibraryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetContentsOutput;
} & ComponentProps<"div">;

export const ContentsTool = memo(
  ({ status, className, output, ...props }: Props) => {
    const t = useTranslations("Ai");

    let icon = <SpinnerIcon className="size-4 shrink-0" />;
    if (status === "output-error") {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }
    if (status === "output-available" && !output) {
      icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
    }

    return (
      <div
        className={cn(
          "relative flex h-10 w-fit items-center justify-center rounded-xl border bg-card px-3 shadow-sm first:mt-0 last:mb-0",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LibraryIcon className="size-4 shrink-0" />
            <p className="font-medium text-sm">{t("get-contents")}</p>
          </div>
          {output ? (
            <Badge variant="secondary">{output.content.length}</Badge>
          ) : (
            icon
          )}
        </div>
      </div>
    );
  }
);
ContentsTool.displayName = "ContentsTool";

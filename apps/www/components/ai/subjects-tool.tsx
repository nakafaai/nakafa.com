"use client";

import type { GetSubjectsOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpRightIcon, GraduationCapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetSubjectsOutput;
};

export const SubjectsTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader
        icon={
          <GraduationCapIcon className="size-4 shrink-0 text-muted-foreground" />
        }
        state={status}
        type={t("get-subjects")}
      />
      <ToolContent>
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {t("found-subjects", {
                count: output?.subjects.length ?? 0,
              })}
            </p>
            <NavigationLink
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" })
              )}
              href={output?.baseUrl ?? ""}
            >
              <ArrowUpRightIcon />
              {t("see")}
            </NavigationLink>
          </div>
        </div>
      </ToolContent>
    </Tool>
  );
});
SubjectsTool.displayName = "SubjectsTool";

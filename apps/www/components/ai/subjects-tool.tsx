"use client";

import type { GetSubjectsOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { LibraryIcon } from "lucide-react";
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
        icon={<LibraryIcon className="size-4 text-muted-foreground" />}
        state={status}
        type={t("get-subjects")}
      />
      <ToolContent>
        <div className="p-3">
          <p className="text-muted-foreground text-sm">
            {t("found-subjects", {
              count: output?.subjects.length ?? 0,
            })}
          </p>
        </div>
      </ToolContent>
    </Tool>
  );
});
SubjectsTool.displayName = "SubjectsTool";

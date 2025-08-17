"use client";

import type {
  GetSubjectsInput,
  GetSubjectsOutput,
} from "@repo/ai/schema/tools";
import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { Badge } from "@repo/design-system/components/ui/badge";
import { LibraryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Partial<GetSubjectsInput>;
  output?: GetSubjectsOutput;
};

export const SubjectsTool = memo(({ status, output, input }: Props) => {
  const t = useTranslations("Ai");
  const tSubjects = useTranslations("Subject");

  return (
    <Tool>
      <ToolHeader
        icon={<LibraryIcon className="size-4 text-muted-foreground" />}
        state={status}
        type={t("get-subjects")}
      />
      <ToolContent>
        <div className="flex flex-col gap-3 p-3">
          {input && (
            <div className="flex flex-wrap gap-2">
              {input.category && (
                <Badge variant="outline">{tSubjects(input.category)}</Badge>
              )}
              {input.grade && (
                <Badge variant="outline">
                  {tSubjects(getGradeNonNumeric(input.grade) ?? "grade", {
                    grade: input.grade,
                  })}
                </Badge>
              )}
              {input.material && (
                <Badge variant="outline">{tSubjects(input.material)}</Badge>
              )}
            </div>
          )}

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

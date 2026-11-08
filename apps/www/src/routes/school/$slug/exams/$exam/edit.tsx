import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readExamId } from "@/lib/tenant/params";

/**
 * The editor of one exam of the school, for a member who may open exams. A failed
 * address to an exam is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/exams/$exam/edit")({
  ...guardSchoolPage({
    opens: canOpenExams,
    reads: (params: { readonly exam: string }) =>
      Option.all({ examId: readExamId(params.exam) }),
  }),
  component: SchoolExamEditPage,
});

function SchoolExamEditPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  return <ExamEditor examId={examId} slug={slug} />;
}

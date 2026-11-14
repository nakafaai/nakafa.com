import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamTryPaper } from "@/components/tenant/exams/try/paper";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readExamId } from "@/lib/tenant/params";

/** One exam of the school, as its teacher tries it the way a student would. */
export const Route = createFileRoute("/school/$slug/exams/$exam/try")({
  beforeLoad: guardSchoolPage({
    reads: (params: { readonly exam: string }) =>
      Option.all({ examId: readExamId(params.exam) }),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolExamTryPage,
});

function SchoolExamTryPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  return <ExamTryPaper examId={examId} slug={slug} />;
}

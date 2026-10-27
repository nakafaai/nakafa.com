import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamTryPaper } from "@/components/tenant/exams/try/paper";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId } from "@/lib/tenant/params";

/** One exam of the school, as its teacher tries it the way a student would. */
export const Route = createFileRoute("/school/$slug/exams/$exam/try")({
  beforeLoad: ({ params }) => {
    const examId = readExamId(params.exam);
    if (Option.isNone(examId)) {
      throw notFound();
    }
    return { examId: examId.value };
  },
  component: SchoolExamTryPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamTryPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  return <ExamTryPaper examId={examId} slug={slug} />;
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamTryPaper } from "@/components/tenant/exams/try/paper";
import { readExamId } from "@/lib/tenant/params";

/** One exam of the school, as its teacher tries it the way a student would. */
export const Route = createFileRoute("/school/$slug/exams/$exam/try")({
  beforeLoad: ({ params }) => {
    const examIdOption = readExamId(params.exam);
    if (Option.isNone(examIdOption)) {
      throw notFound();
    }
    return { examId: examIdOption.value };
  },
  component: SchoolExamTryPage,
});

function SchoolExamTryPage(): ReactElement {
  const { examId, slug } = Route.useRouteContext();
  return <ExamTryPaper examId={examId} slug={slug} />;
}

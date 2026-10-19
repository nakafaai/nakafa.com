import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { readExamId } from "@/lib/tenant/params";

/** The editor of one exam of the school. */
export const Route = createFileRoute("/school/$slug/exams/$exam/edit")({
  beforeLoad: ({ params }) => {
    const examIdOption = readExamId(params.exam);
    if (Option.isNone(examIdOption)) {
      throw notFound();
    }
    return { examId: examIdOption.value };
  },
  component: SchoolExamEditPage,
});

function SchoolExamEditPage(): ReactElement {
  const { examId, slug } = Route.useRouteContext();
  return <ExamEditor examId={examId} slug={slug} />;
}

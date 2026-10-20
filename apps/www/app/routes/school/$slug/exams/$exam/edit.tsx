import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId } from "@/lib/tenant/params";

/** The editor of one exam of the school, for a member who may open exams. */
export const Route = createFileRoute("/school/$slug/exams/$exam/edit")({
  beforeLoad: ({ context, params }) => {
    const { school } = context;
    const examId = readExamId(params.exam);
    if (
      school._tag === "Member" &&
      (Option.isNone(examId) || !canOpenExams(school.viewer))
    ) {
      throw notFound();
    }
    return { examId: Option.getOrNull(examId) };
  },
  component: SchoolExamEditPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamEditPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  if (examId === null) {
    return null;
  }
  return <ExamEditor examId={examId} slug={slug} />;
}

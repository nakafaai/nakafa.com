import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamFn } from "@/lib/tenant/exams.fn";
import { readExamId } from "@/lib/tenant/params";

/**
 * The editor of one exam of the school, for a member who may open exams. A failed
 * address to an exam is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/exams/$exam/edit")({
  beforeLoad: ({ context, params }) => {
    const { school } = context;
    const examId = readExamId(params.exam);
    if (Option.isNone(examId)) {
      throw notFound();
    }
    if (school._tag === "Member" && !canOpenExams(school.viewer)) {
      throw notFound();
    }
    return { examId: examId.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readExamFn({ data: { examId: context.examId, slug: context.slug } });
  },
  component: SchoolExamEditPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamEditPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <ExamEditor examId={examId} preload={preload} slug={slug} />;
}

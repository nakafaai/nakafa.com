import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamRooms } from "@/components/tenant/exams/rooms";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId } from "@/lib/tenant/params";

/** The rooms of one exam of the school. A failed address to an exam is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/exams/$exam/")({
  beforeLoad: ({ params }) => {
    const examId = readExamId(params.exam);
    if (Option.isNone(examId)) {
      throw notFound();
    }
    return { examId: examId.value };
  },
  component: SchoolExamRoomsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamRoomsPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  return <ExamRooms examId={examId} slug={slug} />;
}

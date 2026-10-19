import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamRooms } from "@/components/tenant/exams/rooms";
import { readExamId } from "@/lib/tenant/params";

/** The rooms of one exam of the school. */
export const Route = createFileRoute("/school/$slug/exams/$exam/")({
  beforeLoad: ({ params }) => {
    const examIdOption = readExamId(params.exam);
    if (Option.isNone(examIdOption)) {
      throw notFound();
    }
    return { examId: examIdOption.value };
  },
  component: SchoolExamRoomsPage,
});

function SchoolExamRoomsPage(): ReactElement {
  const { examId, slug } = Route.useRouteContext();
  return <ExamRooms examId={examId} slug={slug} />;
}

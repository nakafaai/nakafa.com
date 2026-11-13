import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamRooms } from "@/components/tenant/exams/rooms";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readExamId } from "@/lib/tenant/params";

/** The rooms of one exam of the school. A failed address to an exam is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/exams/$exam/")({
  beforeLoad: guardSchoolPage({
    reads: (params: { readonly exam: string }) =>
      Option.all({ examId: readExamId(params.exam) }),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolExamRoomsPage,
});

function SchoolExamRoomsPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  return <ExamRooms examId={examId} slug={slug} />;
}

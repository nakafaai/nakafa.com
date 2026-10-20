import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamRooms } from "@/components/tenant/exams/rooms";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamId } from "@/lib/tenant/params";

/** The rooms of one exam of the school. */
export const Route = createFileRoute("/school/$slug/exams/$exam/")({
  beforeLoad: ({ context, params }) => {
    const examId = readExamId(params.exam);
    if (context.school._tag === "Member" && Option.isNone(examId)) {
      throw notFound();
    }
    return { examId };
  },
  component: SchoolExamRoomsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamRoomsPage(): ReactElement {
  const { examId, slug } = Route.useRouteContext();
  return Option.match(examId, {
    onNone: () => <></>,
    onSome: (id) => <ExamRooms examId={id} slug={slug} />,
  });
}

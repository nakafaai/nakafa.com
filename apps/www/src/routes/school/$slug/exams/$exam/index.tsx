import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ExamRooms, ROOM_PAGE_SIZE } from "@/components/tenant/exams/rooms";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readExamRoomsFn } from "@/lib/tenant/exams.functions";
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
  loader: ({ context }) => {
    if (!context.firstHtml || context.school._tag !== "Member") {
      return;
    }
    return readExamRoomsFn({
      data: {
        examId: context.examId,
        numItems: ROOM_PAGE_SIZE,
        slug: context.slug,
      },
    });
  },
  component: SchoolExamRoomsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamRoomsPage(): ReactElement | null {
  const { examId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <ExamRooms examId={examId} preload={preload} slug={slug} />;
}

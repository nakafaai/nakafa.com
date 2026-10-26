import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamList } from "@/components/tenant/exams/list";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { EXAM_PAGE_SIZE } from "@/lib/tenant/exams";
import { readExamListFn } from "@/lib/tenant/exams.functions";

/** The exams of the school, newest first. Only a viewer who may open exams sees the list. */
export const Route = createFileRoute("/school/$slug/exams/")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (school._tag === "Member" && !canOpenExams(school.viewer)) {
      throw notFound();
    }
  },
  loader: ({ context }) => {
    if (!context.firstHtml || context.school._tag !== "Member") {
      return;
    }
    return readExamListFn({
      data: { numItems: EXAM_PAGE_SIZE, slug: context.slug },
    });
  },
  component: SchoolExamsPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolExamsPage(): ReactElement | null {
  const { slug } = Route.useRouteContext();
  const first = Route.useLoaderData();
  return <ExamList first={first} slug={slug} />;
}

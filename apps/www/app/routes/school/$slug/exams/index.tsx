import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamList } from "@/components/tenant/exams/list";

/** The exams of the school, newest first. Only a viewer who may open exams sees the list. */
export const Route = createFileRoute("/school/$slug/exams/")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (school._tag === "Member" && !canOpenExams(school.viewer)) {
      throw notFound();
    }
  },
  component: SchoolExamsPage,
});

function SchoolExamsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <ExamList slug={slug} />;
}

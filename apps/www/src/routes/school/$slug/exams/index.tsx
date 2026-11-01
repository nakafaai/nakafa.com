import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { ExamList } from "@/components/tenant/exams/list";

/** The exams of the school, newest first, for a viewer the section's layout lets in. */
export const Route = createFileRoute("/school/$slug/exams/")({
  component: SchoolExamsPage,
});

function SchoolExamsPage(): ReactElement | null {
  const { slug } = Route.useRouteContext();
  return <ExamList slug={slug} />;
}

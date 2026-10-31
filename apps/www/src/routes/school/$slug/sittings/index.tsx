import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { StudentExams } from "@/components/tenant/exams/mine";

/** The student's own exams in the school, the page a student's school opens on. */
export const Route = createFileRoute("/school/$slug/sittings/")({
  component: SchoolSittingsPage,
});

function SchoolSittingsPage(): ReactElement {
  return <StudentExams />;
}

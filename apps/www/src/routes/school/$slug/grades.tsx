import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolOwnGrades } from "@/components/tenant/grades/own";

/** The viewer's own released grades in the school, of every class and period, which the browser reads live from Convex. */
export const Route = createFileRoute("/school/$slug/grades")({
  component: SchoolGradesPage,
});

function SchoolGradesPage(): ReactElement {
  return <SchoolOwnGrades />;
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolStudentsSettings } from "@/components/tenant/settings/students";

/** The login cards of the school's people. */
export const Route = createFileRoute("/school/$slug/settings/students")({
  component: SchoolStudentsPage,
});

function SchoolStudentsPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolStudentsSettings slug={slug} />;
}

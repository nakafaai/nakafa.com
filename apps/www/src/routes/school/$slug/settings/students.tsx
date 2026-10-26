import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolStudentsSettings,
} from "@/components/tenant/settings/students";
import { readStudentsFn } from "@/lib/tenant/settings.functions";

/** The login cards of the school's people. */
export const Route = createFileRoute("/school/$slug/settings/students")({
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
      ? readStudentsFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolStudentsPage,
});

function SchoolStudentsPage(): ReactElement {
  const first = Route.useLoaderData();
  return <SchoolStudentsSettings first={first} />;
}

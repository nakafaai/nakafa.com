import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolMembersSettings } from "@/components/tenant/settings/members";

/** The members of the school. */
export const Route = createFileRoute("/school/$slug/settings/members")({
  component: SchoolMembersPage,
});

function SchoolMembersPage(): ReactElement {
  return <SchoolMembersSettings />;
}

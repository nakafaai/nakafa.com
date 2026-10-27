import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolClientsSettings } from "@/components/tenant/settings/clients";

/** The integration clients of the school. */
export const Route = createFileRoute("/school/$slug/settings/clients")({
  component: SchoolClientsPage,
});

function SchoolClientsPage(): ReactElement {
  return <SchoolClientsSettings />;
}

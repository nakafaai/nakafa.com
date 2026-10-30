import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolAuditSettings } from "@/components/tenant/settings/audit";

/** The audit journal of the school: who changed what, and when. */
export const Route = createFileRoute("/school/$slug/settings/audit")({
  component: SchoolAuditPage,
});

function SchoolAuditPage(): ReactElement {
  return <SchoolAuditSettings />;
}

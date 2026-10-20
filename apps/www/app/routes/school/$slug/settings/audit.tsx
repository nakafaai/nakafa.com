import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolAuditSettings } from "@/components/tenant/settings/audit";

/** The audit log of the school: who changed what, and when. */
export const Route = createFileRoute("/school/$slug/settings/audit")({
  component: SchoolAuditPage,
});

function SchoolAuditPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolAuditSettings slug={slug} />;
}

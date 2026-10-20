import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolPoliciesSettings } from "@/components/tenant/settings/policies";

/** The policies of the school: Nina, student threads, and the allowed email domains. */
export const Route = createFileRoute("/school/$slug/settings/policies")({
  component: SchoolPoliciesPage,
});

function SchoolPoliciesPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolPoliciesSettings slug={slug} />;
}

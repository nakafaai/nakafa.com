import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolBillingSettings } from "@/components/tenant/settings/billing";

/** The billing of the school: its plan, its students, and its invoices. */
export const Route = createFileRoute("/school/$slug/settings/billing")({
  component: SchoolBillingPage,
});

function SchoolBillingPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolBillingSettings slug={slug} />;
}

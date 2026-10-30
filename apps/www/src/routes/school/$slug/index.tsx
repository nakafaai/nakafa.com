import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { TenantHome } from "@/components/tenant/home";

/**
 * The home of a school host, rendered inside the school shell for a member. Its tiles read live from Convex. A
 * visitor and an account that is not a member see the school's entry or outsider page instead.
 */
export const Route = createFileRoute("/school/$slug/")({
  component: SchoolHomePage,
});

function SchoolHomePage(): ReactElement {
  return <TenantHome />;
}

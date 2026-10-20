import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { TenantHome } from "@/components/tenant/home";

/** The home of a school host, rendered inside the school shell. */
export const Route = createFileRoute("/school/$slug/")({
  component: SchoolHomePage,
});

function SchoolHomePage(): ReactElement {
  return <TenantHome />;
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { GuardianLinksSettings } from "@/components/tenant/guardian/links";

/** The guardian links of the school, which its Admin and Staff keep. */
export const Route = createFileRoute("/school/$slug/settings/guardians")({
  component: SchoolGuardiansPage,
});

function SchoolGuardiansPage(): ReactElement {
  return <GuardianLinksSettings />;
}

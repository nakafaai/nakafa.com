import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolWebhooksSettings } from "@/components/tenant/settings/webhooks";

/** The webhooks of the school. */
export const Route = createFileRoute("/school/$slug/settings/webhooks")({
  component: SchoolWebhooksPage,
});

function SchoolWebhooksPage(): ReactElement {
  return <SchoolWebhooksSettings />;
}

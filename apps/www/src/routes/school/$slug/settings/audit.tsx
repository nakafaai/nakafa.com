import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  PAGE_SIZE,
  SchoolAuditSettings,
} from "@/components/tenant/settings/audit";
import { readAuditFn } from "@/lib/tenant/settings.functions";

/** The audit journal of the school: who changed what, and when. */
export const Route = createFileRoute("/school/$slug/settings/audit")({
  loader: ({ context }) =>
    context.firstHtml && context.school._tag === "Member"
      ? readAuditFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolAuditPage,
});

function SchoolAuditPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <SchoolAuditSettings preload={preload} slug={slug} />;
}

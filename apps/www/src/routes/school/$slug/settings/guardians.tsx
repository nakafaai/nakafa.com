import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import {
  GuardianLinksSettings,
  PAGE_SIZE,
} from "@/components/tenant/guardian/links";
import { readLinksFn } from "@/lib/tenant/guardians.functions";

/** The guardian links of the school, which its Admin and Staff keep. */
export const Route = createFileRoute("/school/$slug/settings/guardians")({
  loader: ({ context }) =>
    context.school._tag === "Member"
      ? readLinksFn({ data: { numItems: PAGE_SIZE, slug: context.slug } })
      : undefined,
  component: SchoolGuardiansPage,
});

function SchoolGuardiansPage(): ReactElement {
  const { slug } = Route.useRouteContext();
  const first = Route.useLoaderData();
  return <GuardianLinksSettings first={first} slug={slug} />;
}

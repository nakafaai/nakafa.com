import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { readClassAddress } from "@/lib/tenant/params";

/** The forum of one class of the school. */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/forum")({
  beforeLoad: ({ params }) => {
    const classAddressOption = readClassAddress(params.classSlug);
    if (Option.isNone(classAddressOption)) {
      throw notFound();
    }
    return { classAddress: classAddressOption.value };
  },
  component: SchoolClassForumPage,
});

function SchoolClassForumPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return <ClassShell classSlug={classAddress} slug={slug} tab="forum" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readClassAddress } from "@/lib/tenant/params";

/** The library of one class of the school, the newest item first. A failed address to a class is not found for every viewer. */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/library/"
)({
  ...guardSchoolPage({
    reads: (params: { readonly classSlug: string }) =>
      Option.all({ classAddress: readClassAddress(params.classSlug) }),
  }),
  component: SchoolClassLibraryPage,
});

function SchoolClassLibraryPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return (
    <ClassShell
      classSlug={classAddress}
      slug={slug}
      view={{ _tag: "library" }}
    />
  );
}

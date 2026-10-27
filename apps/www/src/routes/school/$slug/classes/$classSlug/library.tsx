import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress } from "@/lib/tenant/params";

/** The library of one class of the school, the newest item first. A failed address to a class is not found for every viewer. */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/library"
)({
  beforeLoad: ({ params }) => {
    const classAddress = readClassAddress(params.classSlug);
    if (Option.isNone(classAddress)) {
      throw notFound();
    }
    return { classAddress: classAddress.value };
  },
  component: SchoolClassLibraryPage,
  notFoundComponent: SchoolPageNotFound,
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

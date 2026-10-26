import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * The gradebook of one class of the school (ADR 0033, S2), which its subject teachers keep.
 * The page reads the class, its scheme, and the gradebook live from Convex in the browser. A
 * failed address to a class is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/grades")(
  {
    beforeLoad: ({ params }) => {
      const classAddress = readClassAddress(params.classSlug);
      if (Option.isNone(classAddress)) {
        throw notFound();
      }
      return { classAddress: classAddress.value };
    },
    component: SchoolClassGradesPage,
    notFoundComponent: SchoolPageNotFound,
  }
);

function SchoolClassGradesPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return (
    <ClassShell
      channel={Option.none()}
      classSlug={classAddress}
      slug={slug}
      tab="grades"
    />
  );
}

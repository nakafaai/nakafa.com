import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress } from "@/lib/tenant/params";

/** Who teaches one class of the school and who learns in it. A failed address to a class is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/people")(
  {
    beforeLoad: ({ params }) => {
      const classAddress = readClassAddress(params.classSlug);
      if (Option.isNone(classAddress)) {
        throw notFound();
      }
      return { classAddress: classAddress.value };
    },
    component: SchoolClassPeoplePage,
    notFoundComponent: SchoolPageNotFound,
  }
);

function SchoolClassPeoplePage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return (
    <ClassShell
      classSlug={classAddress}
      slug={slug}
      view={{ _tag: "people" }}
    />
  );
}

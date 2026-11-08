import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readClassAddress } from "@/lib/tenant/params";

/** The tasks of one class of the school, by deadline. A failed address to a class is not found for every viewer. */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/tasks/")(
  {
    ...guardSchoolPage({
      reads: (params: { readonly classSlug: string }) =>
        Option.all({ classAddress: readClassAddress(params.classSlug) }),
    }),
    component: SchoolClassTasksPage,
  }
);

function SchoolClassTasksPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return (
    <ClassShell classSlug={classAddress} slug={slug} view={{ _tag: "tasks" }} />
  );
}

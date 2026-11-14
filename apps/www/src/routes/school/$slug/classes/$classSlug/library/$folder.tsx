import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readClassAddress, readFolderAddress } from "@/lib/tenant/params";

/** One folder of a class's library. A folder the class does not hold shows the class's missing state. */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/library/$folder"
)({
  beforeLoad: guardSchoolPage({
    reads: (params: { readonly classSlug: string; readonly folder: string }) =>
      Option.all({
        classAddress: readClassAddress(params.classSlug),
        folderId: readFolderAddress(params.folder),
      }),
  }),
  notFoundComponent: SchoolPageNotFound,
  component: SchoolClassFolderPage,
});

function SchoolClassFolderPage(): ReactElement {
  const { classAddress, folderId, slug } = Route.useRouteContext();
  return (
    <ClassShell
      classSlug={classAddress}
      slug={slug}
      view={{ _tag: "folder", folderId }}
    />
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress, readFolderAddress } from "@/lib/tenant/params";

/** One folder of a class's library. A folder the class does not hold shows the class's missing state. */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/library/$folder"
)({
  beforeLoad: ({ params }) => {
    const classAddress = readClassAddress(params.classSlug);
    const folderId = readFolderAddress(params.folder);
    if (Option.isNone(classAddress) || Option.isNone(folderId)) {
      throw notFound();
    }
    return { classAddress: classAddress.value, folderId: folderId.value };
  },
  component: SchoolClassFolderPage,
  notFoundComponent: SchoolPageNotFound,
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

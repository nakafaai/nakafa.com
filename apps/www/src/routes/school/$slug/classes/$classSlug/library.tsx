import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { CHANNEL_PAGE_SIZE } from "@/components/tenant/classes/channels";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassForumFn } from "@/lib/tenant/classes.functions";
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
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readClassForumFn({
      data: {
        classSlug: context.classAddress,
        numItems: CHANNEL_PAGE_SIZE,
        slug: context.slug,
      },
    });
  },
  component: SchoolClassLibraryPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolClassLibraryPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <ClassShell
      classSlug={classAddress}
      preload={preload}
      slug={slug}
      view={{ _tag: "library" }}
    />
  );
}

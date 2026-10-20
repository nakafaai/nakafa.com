import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { CHANNEL_PAGE_SIZE } from "@/components/tenant/classes/channels";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassForumFn } from "@/lib/tenant/classes.fn";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * The home of one class of the school, which lists the class's channels as the forum does. A failed
 * address to a class is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/")({
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
  component: SchoolClassPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolClassPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <ClassShell
      classSlug={classAddress}
      preload={preload}
      slug={slug}
      tab="home"
    />
  );
}

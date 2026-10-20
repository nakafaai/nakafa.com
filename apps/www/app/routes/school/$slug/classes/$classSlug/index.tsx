import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassFn } from "@/lib/tenant/classes.fn";
import { readClassAddress } from "@/lib/tenant/params";

/** The home of one class of the school. A failed address to a class is not found for every viewer. */
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
    return readClassFn({
      data: { classSlug: context.classAddress, slug: context.slug },
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

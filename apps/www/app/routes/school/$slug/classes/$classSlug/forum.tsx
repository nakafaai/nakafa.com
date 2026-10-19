import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassAddress } from "@/lib/tenant/params";

/** The forum of one class of the school. */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/forum")({
  beforeLoad: ({ context, params }) => {
    const classAddress = readClassAddress(params.classSlug);
    if (context.school._tag === "Member" && Option.isNone(classAddress)) {
      throw notFound();
    }
    return { classAddress };
  },
  component: SchoolClassForumPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolClassForumPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  return Option.match(classAddress, {
    onNone: () => <></>,
    onSome: (address) => (
      <ClassShell classSlug={address} slug={slug} tab="forum" />
    ),
  });
}

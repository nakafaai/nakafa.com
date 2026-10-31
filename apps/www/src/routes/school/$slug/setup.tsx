import { createFileRoute, notFound } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import type { ReactElement } from "react";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { SchoolSetup } from "@/components/tenant/setup/page";

/** The setup of the school. Only a viewer who may manage the school sees it. */
export const Route = createFileRoute("/school/$slug/setup")({
  beforeLoad: ({ context }) => {
    const { school } = context;
    if (
      school._tag === "Member" &&
      !Arr.contains(school.viewer.can, "tenant.manage")
    ) {
      throw notFound();
    }
  },
  component: SchoolSetupPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolSetupPage(): ReactElement {
  return <SchoolSetup />;
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolProfileSettings } from "@/components/tenant/settings/profile";

/** The profile of the school: its mark, its name, and its address. */
export const Route = createFileRoute("/school/$slug/settings/profile")({
  component: SchoolProfilePage,
});

function SchoolProfilePage(): ReactElement {
  const { slug } = Route.useRouteContext();
  return <SchoolProfileSettings slug={slug} />;
}

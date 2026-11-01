import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { StudentFamily } from "@/components/tenant/guardian/family";

/** A student's parents: the links to them, and the invite of a new one (ADR 0034). */
export const Route = createFileRoute("/school/$slug/family")({
  component: SchoolFamilyPage,
});

function SchoolFamilyPage(): ReactElement {
  return <StudentFamily />;
}

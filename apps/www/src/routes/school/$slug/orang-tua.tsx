import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { GuardianHome } from "@/components/tenant/guardian/home";

/**
 * The parent home of a school host (ADR 0034). A visitor sees the school's entry with the
 * parent's email code form, which the layout draws; a signed-in guardian sees each linked
 * child, the NISN check of a pending link, and the released grades of a verified one.
 */
export const Route = createFileRoute("/school/$slug/orang-tua")({
  component: SchoolGuardianPage,
});

function SchoolGuardianPage(): ReactElement {
  return <GuardianHome />;
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolGradingSettings } from "@/components/tenant/settings/grading";

/** The versions of the school's grading scheme, the newest first, which an Admin adds to. */
export const Route = createFileRoute("/school/$slug/settings/grading")({
  component: SchoolGradingPage,
});

function SchoolGradingPage(): ReactElement {
  return <SchoolGradingSettings />;
}

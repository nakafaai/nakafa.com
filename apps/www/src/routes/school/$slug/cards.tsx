import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SchoolOwnReports } from "@/components/tenant/reports/own";

/** The viewer's own locked report cards in the school, which the browser reads live from Convex. */
export const Route = createFileRoute("/school/$slug/cards")({
  component: SchoolCardsPage,
});

function SchoolCardsPage(): ReactElement {
  return <SchoolOwnReports />;
}
